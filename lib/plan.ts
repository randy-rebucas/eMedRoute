import { Subscription } from './types';
import { useApiData } from './useApiData';

/**
 * The rep's plan: whether booking with clinics is covered (free, own plan or team seat), prices
 * and end dates. Payment happens on the web (store payment rules), so the app only shows status.
 */
export function useSubscription() {
  return useApiData<Subscription>('/api/medical-representatives/subscription', {
    refreshOn: ['subscription', 'team'],
    offline: true,
  });
}

/** Booking is blocked only when the server said so; while unknown (loading, offline) Book stays open. */
export function bookingBlocked(sub: Subscription | null | undefined): boolean {
  return !!sub && !sub.canBookClinics;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days of cover left (a part day counts as one); 0 once it has ended. */
export function daysLeft(expiresAt: string | null | undefined, now: Date = new Date()): number {
  if (!expiresAt) return 0;
  const ms = new Date(expiresAt).getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / DAY_MS) : 0;
}

/** Days in one paid period, for the days-left meter (renewals stack, so the meter caps at full). */
export function cycleDays(cycle: 'monthly' | 'yearly'): number {
  return cycle === 'yearly' ? 365 : 30;
}

/** Months the yearly price saves against twelve monthly ones (0 when it saves nothing). */
export function yearlyMonthsFree(prices: { monthly: number; yearly: number }): number {
  if (prices.monthly <= 0 || prices.yearly <= 0) return 0;
  const free = Math.round(12 - prices.yearly / prices.monthly);
  return free > 0 ? free : 0;
}

/**
 * The rep's newest billing request still waiting on support, so Plan can say "you already asked"
 * instead of letting them send the same request twice.
 */
export function openBillingRequest<T extends { category: string; status: string; createdAt: string }>(requests: T[]): T | null {
  const open = requests.filter((r) => r.category === 'billing' && (r.status === 'open' || r.status === 'in-progress'));
  open.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return open[0] ?? null;
}
