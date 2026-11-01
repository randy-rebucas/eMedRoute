import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useT } from '@/lib/i18n';
import { useTeam, useTeamVisits } from '@/lib/team';
import { colors, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { ErrorState } from '@/components/ErrorState';
import { SkeletonRows, ThinProgress } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ChoiceChips } from '@/components/pickers';
import { ListFooter, screenStyles } from '@/components/ui';
import { VisitRow } from '@/components/VisitRow';

/** Every member's visits for the manager, filtered by member. Private notes are never sent. */
export default function TeamVisitsScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ memberId?: string }>();
  const [memberId, setMemberId] = useState<string>(params.memberId ?? 'all');
  const { data: team } = useTeam();
  const list = useTeamVisits(memberId === 'all' ? null : memberId);
  const members = team?.team?.members ?? [];

  return (
    <FlatList
      style={screenStyles.container}
      contentContainerStyle={screenStyles.list}
      data={list.items}
      keyExtractor={(v) => v._id}
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.primary} />}
      onEndReached={list.hasMore ? list.loadMore : undefined}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={type.secondary}>{t('team.visitsIntro')}</Text>
          {members.length > 1 ? (
            <ChoiceChips
              options={[{ value: 'all', label: t('team.everyone') }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
              value={memberId}
              onChange={setMemberId}
            />
          ) : null}
          <ThinProgress active={list.stale && !list.offline} />
          <OfflineBanner offline={list.offline} updatedAt={list.updatedAt} subject={t('team.offlineSubject')} />
        </View>
      }
      ListEmptyComponent={
        list.loading ? (
          <SkeletonRows />
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : (
          <Text style={[type.secondary, styles.empty]}>{t('team.noVisits')}</Text>
        )
      }
      ListFooterComponent={<ListFooter loadingMore={list.loadingMore} error={list.loadMoreError} onRetry={list.loadMore} />}
      renderItem={({ item }) => <VisitRow visit={item} member={item.member?.name ?? t('team.formerMember')} />}
    />
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  empty: { textAlign: 'center', marginTop: spacing.lg },
});
