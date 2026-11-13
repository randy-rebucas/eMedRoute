import { useMemo, useRef, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { daysFromToday } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { inboxByDay, markInboxRead, useInbox } from '@/lib/inbox';
import { routeForNotification } from '@/lib/push';
import { colors, spacing } from '@/lib/theme';
import { InboxItem } from '@/lib/types';
import { type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { dayHeading } from '@/lib/visits';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { InboxRow } from '@/components/InboxRow';
import { SkeletonRows, ThinProgress } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Banner, ListFooter, screenStyles } from '@/components/ui';

/**
 * Everything the server told the rep (clinic answers, reminders, deliveries, expiring stock,
 * clinics and team, sponsorships, support), stored whether or not push reached the phone. Newest
 * first, one ruled card per Manila day. Tapping one marks it read and opens what it is about.
 */
export default function NotificationsScreen() {
  const t = useT();
  const list = useInbox();
  const { items, setItems, loading, refreshing, error, loadMoreError, loadingMore, hasMore, offline, stale, updatedAt } = list;
  const unread = list.extra?.unreadCount ?? items.filter((i) => !i.read).length;
  const sections = useMemo(() => inboxByDay(items), [items]);
  const [markingAll, setMarkingAll] = useState(false);
  const markingRef = useRef(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Read at once on screen; the server catches up (a failure only leaves the dot for next load).
  function showRead(ids: string[] | 'all') {
    setItems((prev) => prev.map((i) => (ids === 'all' || ids.includes(i.id) ? { ...i, read: true } : i)));
  }

  function open(item: InboxItem) {
    if (!item.read) {
      showRead([item.id]);
      markInboxRead({ ids: [item.id] }).catch(() => {});
    }
    const route = routeForNotification({ screen: item.screen ?? undefined, id: item.entityId ?? undefined });
    if (route.href) router.push(route.href as never);
  }

  async function markAll() {
    if (markingRef.current) return;
    markingRef.current = true;
    setMarkingAll(true);
    setProblem(null);
    try {
      await markInboxRead({ all: true });
      showRead('all');
    } catch (err) {
      setProblem(isNetworkError(err) ? t('common.needsConnection') : t('notifications.markFailed'));
    } finally {
      markingRef.current = false;
      setMarkingAll(false);
    }
  }

  const empty = loading ? (
    <SkeletonRows />
  ) : error ? (
    <ErrorState message={error} onRetry={list.reload} />
  ) : (
    <EmptyState art="calendar" title={t('notifications.empty.title')} hint={t('notifications.empty.hint')} />
  );

  return (
    <SectionList
      style={screenStyles.container}
      contentContainerStyle={screenStyles.list}
      sections={sections}
      keyExtractor={(item) => item.id}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={list.refresh} tintColor={colors.primary} />}
      onEndReached={hasMore ? list.loadMore : undefined}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        items.length > 0 || stale || offline || problem ? (
          <View style={styles.header}>
            {stale || offline ? (
              <View>
                <ThinProgress active={stale && !offline} />
                <OfflineBanner offline={offline} updatedAt={updatedAt} subject={t('notifications.offlineSubject')} />
              </View>
            ) : null}
            {problem ? <Banner message={problem} /> : null}
            {items.length > 0 ? (
              <View style={styles.lead}>
                <Text style={[styles.count, unread > 0 && styles.countUnread]} accessibilityLiveRegion="polite">
                  {unread > 0 ? t('notifications.unread', { count: unread }) : t('notifications.caughtUp')}
                </Text>
                {unread > 0 ? (
                  <TouchableOpacity
                    onPress={markAll}
                    disabled={markingAll || offline}
                    style={styles.markAll}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: markingAll || offline, busy: markingAll }}
                  >
                    <Text style={[styles.markAllText, (markingAll || offline) && styles.markAllOff]}>
                      {markingAll ? t('notifications.markingAllRead') : t('notifications.markAllRead')}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null
      }
      renderSectionHeader={({ section }) => (
        <Text style={[styles.dayTitle, daysFromToday(section.day) === 0 && styles.dayTitleToday]} accessibilityRole="header">
          {dayHeading(t, section.day)}
        </Text>
      )}
      renderItem={({ item, index, section }) => (
        <InboxRow item={item} first={index === 0} last={index === section.data.length - 1} onPress={open} />
      )}
      ListEmptyComponent={empty}
      ListFooterComponent={<ListFooter loadingMore={loadingMore} error={loadMoreError} onRetry={list.loadMore} />}
    />
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  lead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, minHeight: 44 },
  count: { ...type.secondary, fontWeight: '600', fontVariant: ['tabular-nums'] },
  countUnread: { color: colors.text },
  markAll: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  // The darker teal: this sits on the page background, where `primary` is under 4.5:1.
  markAllText: { fontSize: 15, fontWeight: '600', color: colors.primaryOnSoft },
  markAllOff: { color: colors.textMuted },
  dayTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 2,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  dayTitleToday: { color: colors.text },
});
