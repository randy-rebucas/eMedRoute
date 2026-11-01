import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useDashboard } from '@/lib/dashboard';
import { useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { mono, type } from '@/lib/typography';
import { AppHeader } from '@/components/AppHeader';
import { ErrorState } from '@/components/ErrorState';
import { SkeletonRows, ThinProgress } from '@/components/Loading';
import { NextVisitCard } from '@/components/NextVisitCard';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Button, screenStyles } from '@/components/ui';
import { VisitRow } from '@/components/VisitRow';

/** Home: the next visit first, then this month's counts and the rest of the upcoming visits. */
export default function HomeScreen() {
  const { rep } = useAuth();
  const t = useT();
  const { data, loading, refreshing, error, offline, stale, updatedAt, refresh } = useDashboard();
  const firstName = data?.profile.firstName ?? rep?.name.split(/\s+/)[0];
  const [next, ...later] = data?.nextVisits ?? [];

  return (
    <SafeAreaView style={screenStyles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={screenStyles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <AppHeader />
        <Text style={type.screenTitle} accessibilityRole="header">
          {firstName ? t('home.greeting', { name: firstName }) : t('home.greetingNoName')}
        </Text>
        <ThinProgress active={stale && !offline} />
        <OfflineBanner offline={offline} updatedAt={updatedAt} subject={t('home.offlineSubject')} />

        {!data ? (
          loading ? (
            <SkeletonRows count={3} />
          ) : (
            <ErrorState message={error ?? t('common.failedToLoad')} onRetry={refresh} />
          )
        ) : (
          <>
            {next ? (
              <NextVisitCard visit={next} />
            ) : (
              <View style={styles.empty}>
                <Text style={type.cardTitle}>{t('home.noNextVisit')}</Text>
                <Text style={type.secondary}>{t('home.noNextVisitHint')}</Text>
                <Button title={t('visits.log')} icon="add-outline" variant="secondary" onPress={() => router.push('/visits/log')} />
              </View>
            )}

            <View style={styles.counts}>
              <Count
                value={data.stats.visitsThisMonth}
                label={t('home.count.thisMonth')}
                onPress={() => router.push({ pathname: '/visits', params: { segment: 'past', range: 'thisMonth' } })}
              />
              <Count
                value={data.stats.pendingRequests}
                label={t('home.count.waiting')}
                tone={data.stats.pendingRequests > 0 ? 'warning' : undefined}
                onPress={() => router.push({ pathname: '/visits', params: { segment: 'upcoming' } })}
              />
              <Count
                value={data.stats.expiringProducts}
                label={t('home.count.expiring')}
                tone={data.stats.expiringProducts > 0 ? 'warning' : undefined}
                onPress={() => router.push('/products')}
              />
            </View>

            {later.length ? (
              <>
                <Text style={[type.cardTitle, styles.section]} accessibilityRole="header">
                  {t('home.upcoming')}
                </Text>
                {later.map((v) => (
                  <VisitRow key={v._id} visit={v} />
                ))}
              </>
            ) : null}
            {data.stats.upcomingVisits > data.nextVisits.length ? (
              <Button
                title={t('home.allUpcoming', { count: data.stats.upcomingVisits })}
                variant="secondary"
                onPress={() => router.push({ pathname: '/visits', params: { segment: 'upcoming' } })}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Count({ value, label, tone, onPress }: { value: number; label: string; tone?: 'warning'; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.count} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${value} ${label}`}>
      <Text style={[mono, styles.countValue, tone === 'warning' && styles.countWarning]} maxFontSizeMultiplier={1.6}>
        {value}
      </Text>
      <Text style={type.secondary}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  count: {
    flexGrow: 1,
    flexBasis: 96,
    minHeight: 72,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 4,
    gap: 2,
  },
  countValue: { fontSize: 24, fontWeight: '700', color: colors.text },
  countWarning: { color: colors.warning },
  section: { marginBottom: spacing.sm },
});
