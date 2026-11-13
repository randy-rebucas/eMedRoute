import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { emitRefresh, RefreshTopic } from './events';

/** Coming back to the app refetches at most this often. */
export const FOREGROUND_REFRESH_MS = 30_000;

/**
 * Data that changes while the app sits in the background: the clinic answers (visits, clinics),
 * PayMongo confirms a plan paid in the browser (subscription, sponsorships), support replies.
 */
const TOPICS: RefreshTopic[] = ['visits', 'clinics', 'dashboard', 'deliveries', 'sponsorships', 'subscription', 'support', 'inbox'];

/** When the app comes back to the foreground (at most every 30 s), screens showing live data refetch. */
export function useForegroundRefresh(enabled: boolean): void {
  const last = useRef(Date.now());
  useEffect(() => {
    if (!enabled) return;
    let previous = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      const wasAway = previous !== 'active';
      previous = next;
      if (next !== 'active' || !wasAway) return;
      const now = Date.now();
      if (now - last.current < FOREGROUND_REFRESH_MS) return;
      last.current = now;
      emitRefresh(...TOPICS);
    });
    return () => sub.remove();
  }, [enabled]);
}
