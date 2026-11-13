import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { apiFetch, ApiError } from './api';
import { t } from './i18n';
import { setActivationPass } from './storage';
import type { RepTokenResponse } from './types';

/**
 * Signing up in the app (backend: /api/medical-representatives/onboard/app/*):
 * details → emailed code → texted code → password → activation fee on PayMongo's page.
 * The email code comes first; the phone is texted only once the inbox is proven.
 * Nothing is created on the server until `completeSignup`.
 */
const BASE = '/api/medical-representatives/onboard/app';

export interface SignupDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  territory?: string;
}

export type CodeChannel = 'email' | 'phone';

export interface CompletedSignup {
  id: string;
  /** e.g. MR-1A2B3C4D, for support. */
  reference: string;
  /** `payment`: pay the fee online; `review`: our team activates the account. */
  activation: 'payment' | 'review';
  fee?: number;
  /** Missing on `payment` when the checkout couldn't be made; `activationCheckout` makes one. */
  checkoutUrl?: string;
  /** On `payment`: the pass to pay later and be signed in once paid. */
  activationToken?: string;
  activationExpiresAt?: string;
}

const post = <T>(path: string, body: unknown) => apiFetch<T>(`${BASE}${path}`, { method: 'POST', auth: false, body });

/** Emails the first code. Answers the same whether or not the address already has an account. */
export async function startSignup(details: SignupDetails): Promise<{ signupId: string; expiresInMinutes: number }> {
  return post('/start', {
    ...details,
    email: details.email.trim().toLowerCase(),
    territory: details.territory?.trim() || undefined,
  });
}

/**
 * Check a code. The email code's answer also says whether the phone code went out
 * (`phoneCodeSent: false` → offer "Send code").
 */
export function verifySignupCode(
  signupId: string,
  channel: CodeChannel,
  code: string
): Promise<{ next: 'phone' | 'password'; phone?: string; phoneCodeSent?: boolean }> {
  return post('/verify', { signupId, channel, code });
}

export function resendSignupCode(signupId: string, channel: CodeChannel): Promise<{ expiresInMinutes?: number }> {
  return post('/resend', { signupId, channel });
}

/** Create the account with this password. Errors: WEAK_PASSWORD, SIGNUP_EXPIRED, EMAIL_TAKEN. */
export function completeSignup(signupId: string, password: string): Promise<CompletedSignup> {
  return post('/complete', { signupId, password, returnUrl: activationReturnUrl() });
}

/** Who is paying: the password just typed, or the pass from a code sign-in or an earlier checkout. */
export type CheckoutAuth = { email: string; password: string } | { activationToken: string };

/**
 * A new activation checkout for an account that isn't paid yet (sign-in answered MEDREP_INACTIVE).
 * Errors: ALREADY_ACTIVE, ACTIVATION_BY_TEAM, ACTIVATION_EXPIRED, wrong email or password (401).
 */
export function activationCheckout(
  auth: CheckoutAuth
): Promise<{ checkoutUrl: string; reference: string; fee: number; activationToken: string; activationExpiresAt: string }> {
  const who = 'activationToken' in auth ? { activationToken: auth.activationToken } : { email: auth.email.trim(), password: auth.password };
  return post('/checkout', { ...who, returnUrl: activationReturnUrl() });
}

/**
 * Where PayMongo's success page sends the browser back to: this app's /activation screen
 * (emedroute://activation, or an exp:// link in Expo Go).
 */
export function activationReturnUrl(): string {
  return Linking.createURL('/activation');
}

/** The checkout the /activation screen should open when it appears (memory only; good once). */
let pendingCheckoutUrl: string | null = null;

export function takePendingCheckout(): string | null {
  const url = pendingCheckoutUrl;
  pendingCheckoutUrl = null;
  return url;
}

/**
 * Keep the pass (on disk, so a payment finished after the app was closed still signs in) and hand
 * the checkout to the /activation screen, which opens it and waits for the payment.
 */
export async function beginActivation(pass: { activationToken: string; activationExpiresAt: string }, checkoutUrl?: string): Promise<void> {
  await setActivationPass({ token: pass.activationToken, expiresAt: pass.activationExpiresAt });
  pendingCheckoutUrl = checkoutUrl ?? null;
}

export type ActivationCheck =
  | { kind: 'pending' }
  | { kind: 'signedIn'; session: RepTokenResponse }
  | { kind: 'twoFactor'; pendingToken: string };

/**
 * Has the payment landed? Until it has: pending. Then the pass is spent for a sign-in.
 * Errors: ACTIVATION_EXPIRED, SIGN_IN_REQUIRED.
 */
export async function checkActivation(activationToken: string): Promise<ActivationCheck> {
  try {
    const result = await post<Partial<RepTokenResponse> & { activated?: boolean }>('/activation', { activationToken });
    if (result.token && result.medicalRepresentative) return { kind: 'signedIn', session: result as RepTokenResponse };
    return { kind: 'pending' };
  } catch (error) {
    const body = error instanceof ApiError ? (error.body as { requires2fa?: unknown; pendingToken?: unknown } | undefined) : undefined;
    if (error instanceof ApiError && error.status === 401 && body?.requires2fa === true && typeof body.pendingToken === 'string') {
      return { kind: 'twoFactor', pendingToken: body.pendingToken };
    }
    throw error;
  }
}

/** Only PayMongo's own pages are opened from a server answer. */
export function isPayMongoUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && (hostname === 'paymongo.com' || hostname.endsWith('.paymongo.com'));
  } catch {
    return false;
  }
}

/**
 * Open the checkout in an auth session: it closes by itself when PayMongo's success page sends the
 * browser back to the app's link. Resolves when the rep is back (paid, cancelled or closed).
 */
export async function openActivationCheckout(url: string): Promise<void> {
  if (!isPayMongoUrl(url)) throw new ApiError(t('onboarding.pay.badLink'), 0, 'BAD_CHECKOUT_URL');
  await WebBrowser.openAuthSessionAsync(url, activationReturnUrl());
}

/**
 * Philippine mobile, as the server's normalizePhone reads it: 09XXXXXXXXX, 9XXXXXXXXX or
 * +639XXXXXXXXX (any +country number of 10–15 digits passes too). Used by sign-up and sign-in.
 */
export function looksLikeMobile(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return /^(?:63|0)?9\d{9}$/.test(digits) || (value.trim().startsWith('+') && digits.length >= 10 && digits.length <= 15);
}

/** The sign-up was dropped on the server (took over an hour, or was replaced): start again. */
export const isSignupExpired = (err: unknown) => err instanceof ApiError && err.code === 'SIGNUP_EXPIRED';
