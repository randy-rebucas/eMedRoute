import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { apiRequest, ApiError } from './api';
import { emitRefresh } from './events';
import { t } from './i18n';
import { isPayMongoUrl } from './onboarding';
import { SponsorshipsState, SponsorTerm, Sponsorship } from './types';
import { useApiData } from './useApiData';

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
