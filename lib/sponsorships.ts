import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { apiRequest, ApiError } from './api';
import { emitRefresh } from './events';
import { t } from './i18n';
import { isPayMongoUrl } from './onboarding';
import { SponsorshipsState, SponsorTerm, Sponsorship } from './types';
import { useApiData } from './useApiData';
import { daysLeft } from './plan';

const PATH = '/api/medical-representatives/sponsorships';

/**
 * Clinic sponsorships: the rep pays for a clinic's MyClinicSoft plan. Either side asks, the other
 * accepts, then the rep pays for 1, 3, 6 or 12 months on PayMongo's web page (opened in the
 * browser; nothing is bought in the app). Paying again later renews it.
 */
export function useSponsorships() {
  return useApiData<SponsorshipsState>(PATH, { refreshOn: ['sponsorships'], offline: true });
}

async function write<T>(path: string, method: 'POST' | 'PATCH', body: unknown): Promise<T> {
  const result = await apiRequest<T>(`${PATH}${path}`, { method, body });
  emitRefresh('sponsorships');
  return result;
}

/** Offer to sponsor a linked clinic. Errors: NOT_LINKED, ALREADY_OPEN, REP_INACTIVE. */
export const offerSponsorship = (clinicId: string, message?: string) =>
  write<Sponsorship>('', 'POST', { clinicId, message: message?.trim() || undefined });

/** Accept or decline a clinic's request; `cancel` withdraws an offer or ends an accepted sponsorship. */
export const updateSponsorship = (id: string, action: 'accept' | 'decline' | 'cancel') =>
  write<Sponsorship>(`/${encodeURIComponent(id)}`, 'PATCH', { action });

/** Where PayMongo's success/cancel page sends the browser back to (closes the auth session). */
export function sponsorshipReturnUrl(): string {
  return Linking.createURL('sponsorships');
}

/**
 * Pay for `months` on PayMongo's page in an auth session that closes by itself when PayMongo sends
 * the browser back to the app. Resolves once the rep is back (paid, cancelled or closed). The
 * clinic's plan is extended when PayMongo confirms the payment (a few seconds after paying), so the
 * list is refreshed on return and again shortly after.
 * Errors: NOT_ACCEPTED, BAD_TERM, PAYMENT_UNAVAILABLE, BAD_CHECKOUT_URL.
 */
export async function paySponsorship(id: string, months: SponsorTerm): Promise<void> {
  const returnUrl = sponsorshipReturnUrl();
  const { checkoutUrl } = await apiRequest<{ checkoutUrl: string }>(`${PATH}/${encodeURIComponent(id)}/checkout`, {
    method: 'POST',
    body: { months, returnUrl },
  });
  if (!isPayMongoUrl(checkoutUrl)) throw new ApiError(t('onboarding.pay.badLink'), 0, 'BAD_CHECKOUT_URL');
  try {
    await WebBrowser.openAuthSessionAsync(checkoutUrl, returnUrl);
  } finally {
    emitRefresh('sponsorships');
    setTimeout(() => emitRefresh('sponsorships'), 5000);
  }
}

/** Days before a paid period ends that the server reminds the rep to renew (RENEWAL_REMINDER_DAYS). */
export const RENEWAL_DAYS = 7;

/** Accepted, but the clinic's plan isn't running on the rep's money: never paid, or ran out. */
export const needsPayment = (s: Sponsorship) => s.status === 'accepted' && !s.active;

/**
 * The screen's three lists. Waiting: clinics asking the rep. Current: what the rep has to act on
 * first (accepted but unpaid or lapsed), then running plans soonest to run out, then offers the
 * clinic hasn't answered. Past keeps the server's newest-first order.
 */
export function sponsorshipGroups(list: Sponsorship[]) {
  const waiting = list.filter((s) => s.status === 'pending' && s.awaitingYou);
  const rank = (s: Sponsorship) => (needsPayment(s) ? 0 : s.status === 'accepted' ? 1 : 2);
  const ends = (s: Sponsorship) => (s.paidThrough ? new Date(s.paidThrough).getTime() : Infinity);
  const current = list
    .filter((s) => s.status === 'accepted' || (s.status === 'pending' && !s.awaitingYou))
    .sort((a, b) => rank(a) - rank(b) || ends(a) - ends(b));
  const past = list.filter((s) => s.status !== 'pending' && s.status !== 'accepted');
  return { waiting, current, past };
}

/** What the rep pays for in one line: running plans, the next to run out, money paid (refunds excluded). */
export function sponsorshipSummary(list: Sponsorship[]) {
  const running = list.filter((s) => s.status === 'accepted' && s.active && s.paidThrough);
  const next = [...running].sort((a, b) => new Date(a.paidThrough!).getTime() - new Date(b.paidThrough!).getTime())[0] ?? null;
  return {
    paying: running.length,
    next,
    waiting: list.filter((s) => s.status === 'pending' && s.awaitingYou).length,
    toPay: list.filter(needsPayment).length,
    totalPaid: list.reduce((sum, s) => sum + paidAmount(s), 0),
  };
}

/** Money the rep paid on one sponsorship, refunded payments left out. */
export function paidAmount(s: Sponsorship): number {
  return s.payments.reduce((sum, p) => (p.refunded ? sum : sum + p.amount), 0);
}

/**
 * Days left on a running sponsorship and the meter's fill: days left against the latest paid term
 * (renewals stack, so it caps at full). `soon` inside the server's reminder window.
 */
export function sponsorCover(s: Sponsorship, now: Date = new Date()): { left: number; share: number; soon: boolean } | null {
  if (s.status !== 'accepted' || !s.active || !s.paidThrough) return null;
  const left = daysLeft(s.paidThrough, now);
  const last = s.payments.filter((p) => !p.refunded).sort((a, b) => b.paidAt.localeCompare(a.paidAt))[0];
  const term = (last?.months ?? 1) * 30;
  return { left, share: Math.min(1, left / term), soon: left <= RENEWAL_DAYS };
}
