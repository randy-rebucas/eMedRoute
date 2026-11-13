import { apiRequest } from './api';
import { emitRefresh } from './events';
import { clinicYmd } from './format';
import { InboxItem } from './types';
import { useApiData } from './useApiData';
import { usePaginatedList } from './usePaginatedList';

const PATH = '/api/medical-representatives/notifications/inbox';

/**
 * The rep's notifications, newest first (20 a page). Kept offline so the list still opens without
 * signal. `extra.unreadCount` is the unread total across every page.
 */
export function useInbox() {
  return usePaginatedList<InboxItem, { unreadCount?: number }>(PATH, { limit: 20, refreshOn: ['inbox'], offline: true });
}

/**
 * Unread count for the bell. `available` stays false until the server answers: an older server has
 * no inbox, and the bell must not lead to a screen that can only fail.
 */
export function useUnreadCount(): { count: number; available: boolean } {
  const { data } = useApiData<{ unreadCount?: number }>(`${PATH}?page=1&limit=1`, { envelope: true, refreshOn: ['inbox'], offline: true });
  return { count: data?.unreadCount ?? 0, available: data !== null };
}

/** POST /notifications/inbox/read. Returns the unread count left. */
export async function markInboxRead(target: { ids: string[] } | { all: true }): Promise<number> {
  const result = await apiRequest<{ unreadCount: number }>(`${PATH}/read`, { method: 'POST', body: target });
  emitRefresh('inbox');
  return result.unreadCount;
}

export type InboxDay = { day: string; data: InboxItem[] };

/** Group by Manila day, newest day first, keeping the server's newest-first order inside each. */
export function inboxByDay(items: InboxItem[]): InboxDay[] {
  const days: InboxDay[] = [];
  for (const item of items) {
    const day = clinicYmd(new Date(item.createdAt));
    const last = days[days.length - 1];
    if (last && last.day === day) last.data.push(item);
    else days.push({ day, data: [item] });
  }
  return days;
}
