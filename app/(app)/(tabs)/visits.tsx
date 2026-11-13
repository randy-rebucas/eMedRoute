import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { daysFromToday } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { byDay, DateRange, dayHeading, Outcome, OUTCOME_STATUSES, useVisitList, visitDay, VisitSegment } from '@/lib/visits';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { SkeletonRows, ThinProgress } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { OutcomeBar } from '@/components/OutcomeBar';
import { photos, ScrimPhoto } from '@/components/Photo';
import { FilterChips, Segmented } from '@/components/pickers';
import { Button, ListFooter, screenStyles } from '@/components/ui';
import { VisitRow } from '@/components/VisitRow';
import { WeekStrip } from '@/components/WeekStrip';

const SEGMENTS: VisitSegment[] = ['upcoming', 'past', 'log'];
const RANGES: DateRange[] = ['any', 'thisMonth', 'lastMonth', 'last90'];
const OUTCOMES: Outcome[] = ['all', ...(Object.keys(OUTCOME_STATUSES) as Outcome[])];

/**
 * Visits: Upcoming (the next seven days at a glance, then every open visit by day), Past (how the
 * period went, as a filter, then the visits by day) and My log, with a date filter on the last two.
 */
export default function VisitsScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ segment?: string; range?: string; outcome?: string; open?: string }>();
  const [segment, setSegment] = useState<VisitSegment>('upcoming');
  const [range, setRange] = useState<DateRange>('any');
  const [outcome, setOutcome] = useState<Outcome>('all');
  /** Upcoming only: the day picked in the week strip, or null for every day. */
  const [pickedDay, setPickedDay] = useState<string | null>(null);

  // Home opens a segment (and range, and outcome) here. The params are cleared once applied, so
  // the same jump works again after the rep switched segment by hand.
  useEffect(() => {
    if (!params.segment && !params.range && !params.outcome) return;
    if (params.segment && (SEGMENTS as string[]).includes(params.segment)) setSegment(params.segment as VisitSegment);
    setRange(params.range && (RANGES as string[]).includes(params.range) ? (params.range as DateRange) : 'any');
    setOutcome(params.outcome && (OUTCOMES as string[]).includes(params.outcome) ? (params.outcome as Outcome) : 'all');
    setPickedDay(null);
    router.setParams({ segment: undefined, range: undefined, outcome: undefined });
  }, [params.segment, params.range, params.outcome]);

  // After a booking is sent: land on Upcoming, then open the new visit on top of it. Only a visit
  // id: a link from outside the app can't use this to open some other screen.
  useEffect(() => {
    if (!params.open) return;
    const id = params.open;
    router.setParams({ open: undefined });
    if (/^[a-f\d]{24}$/i.test(id)) router.push(`/visits/${encodeURIComponent(id)}`);
  }, [params.open]);

  const changeSegment = (next: VisitSegment) => {
    setSegment(next);
    setPickedDay(null);
  };

  const list = useVisitList(segment, segment === 'upcoming' ? 'any' : range, segment === 'past' ? outcome : 'all');
  const { items, loading, refreshing, loadingMore, error, loadMoreError, offline, stale, updatedAt, hasMore, summary } = list;
  const sections = useMemo(
    () => byDay(segment === 'upcoming' && pickedDay ? items.filter((v) => visitDay(v) === pickedDay) : items),
    [items, segment, pickedDay]
  );

  const emptyText =
    segment === 'past'
      ? outcome !== 'all'
        ? t('visits.outcome.emptyFiltered')
        : t('visits.empty.past')
      : t('visits.empty.log');

  const empty = loading ? (
    <SkeletonRows />
  ) : error ? (
    <ErrorState message={error} onRetry={list.reload} />
  ) : segment === 'upcoming' && pickedDay ? (
    <View style={styles.dayEmpty}>
      <Text style={[type.body, styles.dayEmptyText]}>{t('visits.day.none', { day: dayHeading(t, pickedDay) })}</Text>
      <Button title={t('visits.day.showAll')} variant="secondary" onPress={() => setPickedDay(null)} />
    </View>
  ) : segment === 'upcoming' ? (
    <ScrimPhoto source={photos.onTheRoad} style={styles.photoEmpty} top={0.5} bottom={0.97}>
      <View style={styles.photoEmptyInner}>
        <Text style={styles.photoEmptyTitle} accessibilityRole="header">
          {t('visits.empty.upcomingTitle')}
        </Text>
        <Text style={styles.photoEmptyHint}>{t('visits.empty.upcoming')}</Text>
        <Button title={t('visits.empty.findClinic')} icon="business-outline" onPress={() => router.push('/clinics')} style={styles.photoEmptyButton} />
      </View>
    </ScrimPhoto>
  ) : (
    <EmptyState
      art="calendar"
      title={emptyText}
      action={
        segment === 'log'
          ? { title: t('visits.log'), icon: 'add-outline', onPress: () => router.push('/visits/log') }
          : outcome !== 'all'
            ? // The outcome bar hides when the period has no visits, so the way out of the filter is here.
              { title: t('visits.outcome.showAll'), icon: 'close-circle-outline', onPress: () => setOutcome('all') }
            : undefined
      }
    />
  );

  return (
    <SafeAreaView style={screenStyles.container} edges={['top']}>
      <SectionList
        sections={sections}
        keyExtractor={(v) => v._id}
        contentContainerStyle={screenStyles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={list.refresh} tintColor={colors.primary} />}
        onEndReached={hasMore ? list.loadMore : undefined}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={type.screenTitle} accessibilityRole="header">
                {t('nav.visits')}
              </Text>
              <Button title={t('visits.log')} icon="add-outline" variant="secondary" onPress={() => router.push('/visits/log')} style={styles.logButton} />
            </View>
            <Segmented
              options={[
                { value: 'upcoming', label: t('visits.segment.upcoming') },
                { value: 'past', label: t('visits.segment.past') },
                { value: 'log', label: t('visits.segment.log') },
              ]}
              value={segment}
              onChange={changeSegment}
            />
            {segment !== 'upcoming' ? (
              <View style={styles.range}>
                <FilterChips
                  label={t('visits.range.label')}
                  options={[
                    { value: 'any', label: t('visits.range.any') },
                    { value: 'thisMonth', label: t('visits.range.thisMonth') },
                    { value: 'lastMonth', label: t('visits.range.lastMonth') },
                    { value: 'last90', label: t('visits.range.last90') },
                  ]}
                  value={range}
                  onChange={setRange}
                />
              </View>
            ) : null}
            {/* Only while there's something to show, so an idle slot doesn't add a gap. */}
            {stale || offline ? (
              <View>
                <ThinProgress active={stale && !offline} />
                <OfflineBanner offline={offline} updatedAt={updatedAt} subject={t('visits.offlineSubject')} />
              </View>
            ) : null}
            {segment === 'upcoming' && items.length > 0 ? <WeekStrip visits={items} picked={pickedDay} onPick={setPickedDay} more={hasMore} /> : null}
            {segment === 'past' && summary ? <OutcomeBar summary={summary} value={outcome} onChange={setOutcome} /> : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHead} accessibilityRole="header">
            <Text style={[styles.dayTitle, daysFromToday(section.day) === 0 && styles.dayTitleToday]}>{dayHeading(t, section.day)}</Text>
            <Text style={[type.secondary, styles.dayCount]}>{t('visits.week.total', { count: section.data.length })}</Text>
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <VisitRow visit={item} inDay={{ first: index === 0, last: index === section.data.length - 1 }} />
        )}
        ListEmptyComponent={empty}
        ListFooterComponent={<ListFooter loadingMore={loadingMore} error={loadMoreError} onRetry={list.loadMore} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.md, marginBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  logButton: { marginTop: 0 },
  range: {},
  dayHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: 2, marginBottom: spacing.sm },
  dayTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  dayTitleToday: { color: colors.text },
  dayCount: { fontVariant: ['tabular-nums'] },
  dayEmpty: { gap: spacing.md, paddingVertical: spacing.lg, alignItems: 'stretch' },
  dayEmptyText: { textAlign: 'center', color: colors.textMuted },
  photoEmpty: { minHeight: 240, borderRadius: radius.lg },
  photoEmptyInner: { flex: 1, justifyContent: 'flex-end', padding: spacing.md + 4 },
  photoEmptyTitle: { fontSize: 20, fontWeight: '700', color: colors.primaryText },
  photoEmptyHint: { fontSize: 14, lineHeight: 20, color: colors.onNavyMuted, marginTop: spacing.xs },
  photoEmptyButton: { marginTop: spacing.md },
});
