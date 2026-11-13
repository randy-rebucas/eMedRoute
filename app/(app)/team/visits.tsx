import { useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { daysFromToday } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useTeam, useTeamVisits } from '@/lib/team';
import { colors, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { byDay, dayHeading } from '@/lib/visits';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { SkeletonRows, ThinProgress } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { FilterChips } from '@/components/pickers';
import { ListFooter, screenStyles } from '@/components/ui';
import { VisitRow } from '@/components/VisitRow';

/**
 * Every member's visits for the manager, newest first, under day headings (as the Visits tab),
 * filtered by member. Private notes are never sent. A member with nothing yet gets a way back to
 * everyone, so the filter is never a dead end.
 */
export default function TeamVisitsScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ memberId?: string }>();
  const [memberId, setMemberId] = useState<string>(params.memberId ?? 'all');
  const { data: team } = useTeam();
  const list = useTeamVisits(memberId === 'all' ? null : memberId);
  const members = useMemo(() => team?.team?.members ?? [], [team]);
  const sections = useMemo(() => byDay(list.items), [list.items]);
  const picked = members.find((m) => m.id === memberId) ?? null;

  const empty = list.loading ? (
    <SkeletonRows />
  ) : list.error ? (
    <ErrorState message={list.error} onRetry={list.reload} />
  ) : picked ? (
    <EmptyState
      art="team"
      title={t('team.noVisitsOf', { name: picked.name })}
      action={{ title: t('team.visits.showAll'), icon: 'people-outline', onPress: () => setMemberId('all') }}
    />
  ) : (
    <EmptyState art="team" title={t('team.noVisits')} />
  );

  return (
    <SectionList
      style={screenStyles.container}
      contentContainerStyle={screenStyles.list}
      sections={sections}
      keyExtractor={(v) => v._id}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.primary} />}
      onEndReached={list.hasMore ? list.loadMore : undefined}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={type.secondary}>{t('team.visitsIntro')}</Text>
          {members.length > 1 ? (
            <FilterChips
              label={t('team.visits.filter')}
              options={[{ value: 'all', label: t('team.everyone') }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
              value={memberId}
              onChange={setMemberId}
            />
          ) : null}
          {/* Only while there's something to show, so an idle slot doesn't add a gap. */}
          {list.stale || list.offline ? (
            <View>
              <ThinProgress active={list.stale && !list.offline} />
              <OfflineBanner offline={list.offline} updatedAt={list.updatedAt} subject={t('team.offlineSubject')} />
            </View>
          ) : null}
        </View>
      }
      renderSectionHeader={({ section }) => (
        <View style={styles.dayHead} accessibilityRole="header">
          <Text style={[styles.dayTitle, daysFromToday(section.day) === 0 && styles.dayTitleToday]}>{dayHeading(t, section.day)}</Text>
          <Text style={[type.secondary, styles.dayCount]}>{t('visits.week.total', { count: section.data.length })}</Text>
        </View>
      )}
      renderItem={({ item, index, section }) => (
        <VisitRow
          visit={item}
          member={item.member?.name ?? t('team.formerMember')}
          inDay={{ first: index === 0, last: index === section.data.length - 1 }}
        />
      )}
      ListEmptyComponent={empty}
      ListFooterComponent={<ListFooter loadingMore={list.loadingMore} error={list.loadMoreError} onRetry={list.loadMore} />}
    />
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginBottom: spacing.md },
  dayHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: 2, marginBottom: spacing.sm, marginTop: spacing.sm },
  dayTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  dayTitleToday: { color: colors.text },
  dayCount: { fontVariant: ['tabular-nums'] },
});
