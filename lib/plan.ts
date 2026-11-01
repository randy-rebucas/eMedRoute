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
