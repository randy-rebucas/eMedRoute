import { apiRequest } from './api';
import { emitRefresh } from './events';
import { clinicYmd } from './format';
import { ReferralState } from './types';
import { useApiData } from './useApiData';

const PATH = '/api/medical-representatives/referral-code';

/**
 * The rep's referral code. A clinic that signs up with it (or its link), or enters it later on its
 * billing page, gets the rep added to its representatives, so the two can set up a sponsorship.
 * The code is made the first time it's asked for. Errors: REP_INACTIVE (403).
 */
export function useReferral() {
  return useApiData<ReferralState>(PATH, { refreshOn: ['referral'], offline: true });
}

/** Replace the code with a new one; the old code and link stop working. */
export async function newReferralCode(): Promise<ReferralState> {
  const result = await apiRequest<ReferralState>(PATH, { method: 'POST' });
  emitRefresh('referral');
  return result;
}

/** How many of the listed clinics joined in the current month, on Manila's calendar. */
export function joinedThisMonth(clinics: ReferralState['clinics'], now: Date = new Date()): number {
  const month = clinicYmd(now).slice(0, 7);
  return clinics.filter((c) => {
    const at = new Date(c.joinedOn);
    return !Number.isNaN(at.getTime()) && clinicYmd(at).slice(0, 7) === month;
  }).length;
}
