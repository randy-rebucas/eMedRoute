import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useT } from '@/lib/i18n';
import { colors, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { DateRange, useVisitList, VisitSegment } from '@/lib/visits';
import { ErrorState } from '@/components/ErrorState';
import { SkeletonRows, ThinProgress } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ChoiceChips, Segmented } from '@/components/pickers';
import { Button, ListFooter, screenStyles } from '@/components/ui';
import { VisitRow } from '@/components/VisitRow';

const SEGMENTS: VisitSegment[] = ['upcoming', 'past', 'log'];
const RANGES: DateRange[] = ['any', 'thisMonth', 'lastMonth', 'last90'];

/** Visits: Upcoming (waiting + approved), Past, and My log, with a date filter on the last two. */
export default function VisitsScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ segment?: string; range?: string }>();
  const [segment, setSegment] = useState<VisitSegment>('upcoming');
  const [range, setRange] = useState<DateRange>('any');

  // Home's counts open a segment (and range) here.
  useEffect(() => {
    if (params.segment && (SEGMENTS as string[]).includes(params.segment)) setSegment(params.segment as VisitSegment);
    setRange(params.range && (RANGES as string[]).includes(params.range) ? (params.range as DateRange) : 'any');
  }, [params.segment, params.range]);

  const list = useVisitList(segment, segment === 'upcoming' ? 'any' : range);
  const { items, loading, refreshing, loadingMore, error, loadMoreError, offline, stale, updatedAt, hasMore } = list;

  const empty =
    segment === 'upcoming' ? t('visits.empty.upcoming') : segment === 'past' ? t('visits.empty.past') : t('visits.empty.log');

  return (
    <SafeAreaView style={screenStyles.container} edges={['top']}>
      <FlatList
        data={items}
        keyExtractor={(v) => v._id}
        contentContainerStyle={screenStyles.list}
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
              onChange={setSegment}
            />
            {segment !== 'upcoming' ? (
              <View style={styles.range}>
                <ChoiceChips
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
            <ThinProgress active={stale && !offline} />
            <OfflineBanner offline={offline} updatedAt={updatedAt} subject={t('visits.offlineSubject')} />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonRows />
          ) : error ? (
            <ErrorState message={error} onRetry={list.reload} />
          ) : (
            <Text style={[type.secondary, styles.empty]}>{empty}</Text>
          )
        }
        ListFooterComponent={<ListFooter loadingMore={loadingMore} error={loadMoreError} onRetry={list.loadMore} />}
        renderItem={({ item }) => <VisitRow visit={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.md, marginBottom: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  logButton: { marginTop: 0 },
  range: { marginBottom: -spacing.md },
  empty: { textAlign: 'center', marginTop: spacing.lg },
});
