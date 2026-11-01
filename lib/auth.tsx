import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, apiRequest, ApiError, AUTH_ENDPOINTS, query, setSessionExpiredHandler, storeTokens, TokenPair } from './api';
import { clearSession, getOrCreateDeviceId, getSession } from './storage';
import { registerForPushNotifications, watchPushToken } from './push';
import { clearOfflineCache } from './offlineCache';
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
   * Second step with the authenticator code, within 5 minutes of the password step
   * (`PENDING_2FA_EXPIRED` after that). Throws when there is no pending sign-in.
   */
  verifyTwoFactor: (code: string) => Promise<void>;

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
      setState({ status: 'signedOut' });
      if (!signingOut.current) setNotice(message ?? t('common.sessionExpired'));
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  // Restore the stored session on launch, and register the device again.
  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) {
        setState({ status: 'signedOut' });
        return;
      }
      try {
        const profile = await apiRequest<RepProfile>(AUTH_ENDPOINTS.session);
        setState({ status: 'signedIn', rep: summaryFromProfile(profile) });
        registerForPushNotifications({ prompt: false }).catch(() => {});
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          // 401 here means even the refresh failed.
          await clearSession();
          setState({ status: 'signedOut' });
          return;
        }
        // Offline or server error: keep the session; screens show their own errors.
        setState({ status: 'signedIn', rep: null });
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
    await storeTokens(result);
    setNotice(null);
    setState({ status: 'signedIn', rep: result.medicalRepresentative });
    registerForPushNotifications({ prompt: false }).catch(() => {});
  }, []);

  const loginWithPassword = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      try {
        const result = await apiFetch<RepTokenResponse>(AUTH_ENDPOINTS.token, {
          method: 'POST',
          auth: false,
          body: { email, password },
        });
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
        }
      }
      // Whatever the server said, this device is signed out.
      await clearSession();
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
      verifyTwoFactor,
      applyRotatedTokens,
      setRepFromProfile,
      signOut,
    }),
    [state, signedIn, notice, loginWithPassword, verifyTwoFactor, applyRotatedTokens, setRepFromProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
