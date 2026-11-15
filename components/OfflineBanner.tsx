import { formatDate, formatTime } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { Banner } from './ui';

/** "Oct 30, 9:41 AM" for when a saved copy was made. */
export function savedAtLabel(updatedAt: number): string {
  return `${formatDate(updatedAt, { month: 'short', day: 'numeric' })}, ${formatTime(updatedAt)}`;
}

/**
 * Shown above records that come from the device's saved copy because the server couldn't be
 * reached. Pass the hook's `offline` and `updatedAt`; renders nothing when online and up to date.
 */
export function OfflineBanner({
  offline,
  updatedAt,
  subject,
  refreshError,
}: {
  offline: boolean;
  /**
   * The last refresh failed for another reason (a server error) while older data is still on
   * screen. Pass it only when there is data showing; the empty-screen error state covers the rest.
   */
  refreshError?: string | null;
  updatedAt: number | null;
  /**
   * What is on screen, translated, e.g. t('visits.offlineSubject') → "your last-loaded visits"
   * (Filipino without a leading "ang"). Default: "your saved data".
   */
  subject?: string;
}) {
  const t = useT();
  if (!offline) return refreshError ? <Banner tone="warning" message={t('common.refreshFailed')} /> : null;
  const what = subject ?? t('common.offline.yourRecords');
  const message = updatedAt
    ? t('common.offline.bannerWhen', { subject: what, when: savedAtLabel(updatedAt) })
    : t('common.offline.banner', { subject: what });
  return <Banner tone="warning" message={message} />;
}
