import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useDashboard } from '@/lib/dashboard';
import { bookingBlocked, useSubscription } from '@/lib/plan';
import { useTeam } from '@/lib/team';
import { useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { IconName } from '@/components/ui';
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
  const { data: team } = useTeam();
  const { data: sub } = useSubscription();
  const invite = team && !team.team ? team.invite : null;

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
        {invite ? (
          <Notice
            icon="people-outline"
            text={t('home.banner.invite', { team: invite.teamName })}
            action={t('home.banner.inviteAction')}
            onPress={() => router.push('/team')}
          />
        ) : null}
        {bookingBlocked(sub) ? (
          <Notice icon="card-outline" text={t('home.banner.plan')} action={t('home.banner.planAction')} onPress={() => router.push('/plan')} />
        ) : null}

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

/** A banner that asks for something: a team invite, or booking that needs a plan. */
function Notice({ icon, text, action, onPress }: { icon: IconName; text: string; action: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.notice} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${text}. ${action}`}>
      <Ionicons name={icon} size={22} color={colors.warning} />
      <Text style={[type.body, styles.noticeText]}>{text}</Text>
      <Text style={styles.noticeAction}>{action}</Text>
    </TouchableOpacity>
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
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    marginTop: spacing.sm,
  },
  noticeText: { flex: 1 },
  noticeAction: { fontSize: 15, fontWeight: '700', color: colors.primaryOnSoft },
});
