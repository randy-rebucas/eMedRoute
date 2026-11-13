import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { apiFetch, apiRequest, ApiError, AUTH_ENDPOINTS, query, setSessionExpiredHandler, storeTokens, TokenPair } from './api';
import { clearSession, getOrCreateDeviceId, getPendingSignOut, getSession, setPendingSignOut } from './storage';
import { registerForPushNotifications, watchPushToken } from './push';
import { clearOfflineCache } from './offlineCache';
import { resetClinicCaches } from './clinics';
import { commitPendingNow, settleDeletesForSignOut } from './undo';
import { isNetworkError } from './useApiData';
import { t } from './i18n';
import { RepProfile, RepSummary, RepTokenResponse, TwoFactorChallenge } from './types';

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; rep: RepSummary | null };

/** What a password sign-in led to: signed in, or a code is needed first (`/two-step`). */
export type SignInResult = { kind: 'signedIn' } | { kind: 'twoFactor' };

/** The server's limit for finishing two-step sign-in. */
export const PENDING_2FA_TTL_MS = 5 * 60_000;

/**
 * The password step's pending token, held in memory for the code screen (never in the URL or on
 * disk: it stands in for the password for five minutes).
 */
let pendingTwoFactor: { token: string; startedAt: number } | null = null;

export function getPendingTwoFactor(): { token: string; startedAt: number } | null {
  return pendingTwoFactor;
}

export function clearPendingTwoFactor(): void {
  pendingTwoFactor = null;
}

interface AuthContextValue {
  loading: boolean;
  signedIn: boolean;
  /** Who is signed in. Null after a launch that couldn't reach the server. */
  rep: RepSummary | null;
  /** One-off message for the sign-in screen (e.g. "session expired"). */
  notice: string | null;
  clearNotice: () => void;

  /** Throws ApiError for refusals (wrong password, PASSWORD_SETUP_REQUIRED, MEDREP_INACTIVE, …). */
  loginWithPassword: (email: string, password: string) => Promise<SignInResult>;
  /**
   * Text a sign-in code to this mobile number. Answers the same whether or not the number has an
   * account (only numbers verified at sign-up get a text). Throws CODES_UNAVAILABLE, 429.
   */
  requestLoginCode: (phone: string) => Promise<{ expiresInMinutes: number }>;
  /** Sign in with the texted code. Same results and refusals as `loginWithPassword`, plus CODE_*, MULTIPLE_ACCOUNTS. */
  loginWithCode: (phone: string, code: string) => Promise<SignInResult>;
  /**
   * Second step with the authenticator code, within 5 minutes of the password step
   * (`PENDING_2FA_EXPIRED` after that). Throws when there is no pending sign-in.
   */
  verifyTwoFactor: (code: string) => Promise<void>;
  /**
   * Finish a sign-in that came from elsewhere: the session /onboard/app/activation gives once the
   * activation fee is paid, or its two-step challenge (then go to `/two-step`).
   */
  acceptSignIn: (result: { kind: 'session'; session: RepTokenResponse } | { kind: 'twoFactor'; pendingToken: string }) => Promise<void>;

  /** Store the new token pair a password change returns (other devices are signed out). */
  applyRotatedTokens: (pair: Partial<TokenPair>) => Promise<void>;
  /** Keep the header name in step with a profile edit. */
  setRepFromProfile: (profile: RepProfile) => void;
  /**
   * Sign out on this device, or everywhere. The local session is always cleared.
   * With `everywhere`, throws (after clearing) when the server didn't confirm the
   * other sessions were revoked; the same warning is also set as the sign-in `notice`.
   */
  signOut: (options?: { everywhere?: boolean }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function summaryFromProfile(p: RepProfile): RepSummary {
  return {
    id: p._id,
    name: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(),
    company: p.company,
    email: p.email,
  };
}

/** What this account left in memory: the next one starts clean. */
function forgetAccountState() {
  resetClinicCaches();
}

/**
 * Send a sign-out the server never got (the phone was offline): revokes that refresh token and
 * takes the device off push. Kept for the next launch while the server still can't be reached.
 */
async function retryPendingSignOut(): Promise<void> {
  const pending = await getPendingSignOut();
  if (!pending) return;
  try {
    await apiFetch(AUTH_ENDPOINTS.session + query({ deviceId: pending.deviceId }), {
      method: 'DELETE',
      auth: false,
      body: { refreshToken: pending.refreshToken },
    });
  } catch (error) {
    if (isNetworkError(error)) return;
    // Any answer from the server settles it: done, or that token is already dead.
  }
  await setPendingSignOut(null);
}

function isTwoFactorChallenge(body: unknown): body is TwoFactorChallenge {
  return (
    !!body &&
    typeof body === 'object' &&
    (body as Record<string, unknown>).requires2fa === true &&
    typeof (body as Record<string, unknown>).pendingToken === 'string'
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [notice, setNotice] = useState<string | null>(null);
  const signingOut = useRef(false);

  // A rejected refresh token anywhere in the app lands here.
  useEffect(() => {
    setSessionExpiredHandler((message) => {
      // The session is already gone: a delete waiting behind Undo can't be sent any more.
      settleDeletesForSignOut({ send: false });
      forgetAccountState();
      setState({ status: 'signedOut' });
      if (!signingOut.current) setNotice(message ?? t('common.sessionExpired'));
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  // A delete waiting behind Undo goes out when the app leaves the screen: the timer may never fire.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') commitPendingNow();
    });
    return () => sub.remove();
  }, []);

  // Restore the stored session on launch, and register the device again. With a stored session
  // the app opens at once (saved copies show offline); the server's check runs behind it, and a
  // dead session signs out through the session-expired handler.
  useEffect(() => {
    (async () => {
      retryPendingSignOut().catch(() => {});
      // An unreadable keychain must not leave the app on the splash: treat it as signed out.
      const session = await getSession().catch(() => null);
      if (!session) {
        setState({ status: 'signedOut' });
        return;
      }
      setState({ status: 'signedIn', rep: null });
      try {
        const profile = await apiRequest<RepProfile>(AUTH_ENDPOINTS.session);
        setState((prev) => (prev.status === 'signedIn' ? { status: 'signedIn', rep: summaryFromProfile(profile) } : prev));
        registerForPushNotifications({ prompt: false }).catch(() => {});
      } catch (error) {
        if (error instanceof ApiError && error.status === 401 && (await getSession())) {
          // A 401 that didn't go through the refresh (and so the handler): sign out here.
          await clearSession();
          forgetAccountState();
          setState({ status: 'signedOut' });
        }
        // Offline or server error: keep the session; screens show their own errors.
      }
    })();
  }, []);

  const signedIn = state.status === 'signedIn';

  useEffect(() => {
    if (!signedIn) return;
    return watchPushToken();
  }, [signedIn]);

  const completeSignIn = useCallback(async (result: RepTokenResponse) => {
    // A sign-in can replace another rep's session without a sign-out: start with no offline copies.
    await clearOfflineCache();
    await settleDeletesForSignOut({ send: false });
    forgetAccountState();
    await storeTokens(result);
    setNotice(null);
    setState({ status: 'signedIn', rep: result.medicalRepresentative });
    registerForPushNotifications({ prompt: false }).catch(() => {});
  }, []);


  /** A token sign-in (password or texted code): signed in, or the authenticator step next. */
  const tokenSignIn = useCallback(
    async (path: string, body: Record<string, string>): Promise<SignInResult> => {
      try {
        const result = await apiFetch<RepTokenResponse>(path, { method: 'POST', auth: false, body });
        await completeSignIn(result);
        return { kind: 'signedIn' };
      } catch (error) {
        // Two-step sign-in answers 401 with a pending token instead of a session.
        if (error instanceof ApiError && error.status === 401 && isTwoFactorChallenge(error.body)) {
          pendingTwoFactor = { token: error.body.pendingToken, startedAt: Date.now() };
          return { kind: 'twoFactor' };
        }
        throw error;
      }
    },
    [completeSignIn]
  );

  const requestLoginCode = useCallback(
    (phone: string) =>
      apiFetch<{ expiresInMinutes: number }>(AUTH_ENDPOINTS.otpRequest, { method: 'POST', auth: false, body: { phone: phone.trim() } }),
    []
  );

  const loginWithCode = useCallback(
    (phone: string, code: string) => tokenSignIn(AUTH_ENDPOINTS.otpVerify, { phone: phone.trim(), code }),
    [tokenSignIn]
  );

  const loginWithPassword = useCallback(
    (email: string, password: string) => tokenSignIn(AUTH_ENDPOINTS.token, { email, password }),
    [tokenSignIn]
  );

  const verifyTwoFactor = useCallback(
    async (code: string) => {
      const pending = pendingTwoFactor;
      if (!pending) throw new ApiError(t('auth.twoStep.expired'), 401, 'PENDING_2FA_EXPIRED');
      const result = await apiFetch<RepTokenResponse>(AUTH_ENDPOINTS.twoFactor, {
        method: 'POST',
        auth: false,
        body: { pendingToken: pending.token, code },
      });
      pendingTwoFactor = null;
      await completeSignIn(result);
    },
    [completeSignIn]
  );

  const acceptSignIn = useCallback(
    async (result: { kind: 'session'; session: RepTokenResponse } | { kind: 'twoFactor'; pendingToken: string }) => {
      if (result.kind === 'twoFactor') {
        pendingTwoFactor = { token: result.pendingToken, startedAt: Date.now() };
        return;
      }
      await completeSignIn(result.session);
    },
    [completeSignIn]
  );

  const applyRotatedTokens = useCallback(async (pair: Partial<TokenPair>) => {
    const session = await getSession();
    if (!session || !pair.token) return;
    await storeTokens({
      token: pair.token,
      expiresIn: pair.expiresIn,
      refreshToken: pair.refreshToken,
    });
    // A password change drops the backend's device registrations; register this one again.
    registerForPushNotifications({ prompt: false }).catch(() => {});
  }, []);

  const setRepFromProfile = useCallback((profile: RepProfile) => {
    setState((prev) => (prev.status === 'signedIn' ? { ...prev, rep: summaryFromProfile(profile) } : prev));
  }, []);

  const signOut = useCallback(async (options: { everywhere?: boolean } = {}) => {
    const everywhere = options.everywhere ?? false;
    signingOut.current = true;
    let failure: unknown = null;
    try {
      // A delete still behind Undo goes out now, while there is a session to send it with.
      await settleDeletesForSignOut({ send: true });
      const session = await getSession();
      if (session) {
        const deviceId = await getOrCreateDeviceId();
        const path = AUTH_ENDPOINTS.session + query({ deviceId, all: everywhere ? 'true' : undefined });
        try {
          // apiFetch refreshes a stale access token first. The refresh token always
          // rides along in the body, so the server can still revoke it when the access
          // token has expired.
          await apiFetch(path, {
            method: 'DELETE',
            // Read at send time: if the access token had to be refreshed first, the
            // refresh token rotated and only the new one is worth revoking.
            bodyFactory: async () => {
              const current = await getSession();
              return current?.refreshToken ? { refreshToken: current.refreshToken } : undefined;
            },
          });
        } catch (error) {
          failure = error;
          // Offline: try again on the next launch, so the phone stops getting this rep's pushes
          // and the refresh token dies on the server too.
          const current = await getSession();
          if (isNetworkError(error) && current?.refreshToken) {
            await setPendingSignOut({ deviceId, refreshToken: current.refreshToken }).catch(() => {});
          }
        }
      }
      // Whatever the server said, this device is signed out.
      await clearSession();
      forgetAccountState();
      setState({ status: 'signedOut' });
      if (everywhere && failure) {
        // "Everywhere" is a security action: tell the rep it may not have happened.
        const message = t('auth.notice.signOutEverywhereFailed');
        setNotice(message);
        throw new ApiError(
          message,
          failure instanceof ApiError ? failure.status : 0,
          'SIGN_OUT_EVERYWHERE_FAILED',
          failure instanceof ApiError ? failure.body : undefined
        );
      }
      setNotice(null);
    } finally {
      signingOut.current = false;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading: state.status === 'loading',
      signedIn,
      rep: state.status === 'signedIn' ? state.rep : null,
      notice,
      clearNotice: () => setNotice(null),
      loginWithPassword,
      requestLoginCode,
      loginWithCode,
      verifyTwoFactor,
      acceptSignIn,
      applyRotatedTokens,
      setRepFromProfile,
      signOut,
    }),
    [state, signedIn, notice, loginWithPassword, requestLoginCode, loginWithCode, verifyTwoFactor, acceptSignIn, applyRotatedTokens, setRepFromProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
