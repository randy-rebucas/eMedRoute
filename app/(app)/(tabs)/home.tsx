import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useDashboard } from '@/lib/dashboard';
import { formatDate } from '@/lib/format';
import { bookingBlocked, useSubscription } from '@/lib/plan';
import { useTeam } from '@/lib/team';
import { useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { mono, type } from '@/lib/typography';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { SkeletonRows, ThinProgress } from '@/components/Loading';
import { NextVisitCard } from '@/components/NextVisitCard';
import { OfflineBanner } from '@/components/OfflineBanner';
import { IconName, IconTile, screenStyles, SectionHeader } from '@/components/ui';
import { VisitRow } from '@/components/VisitRow';

/** Home: the next visit first, then quick actions, this month's counts and the rest of the upcoming visits. */
export default function HomeScreen() {
  const { rep } = useAuth();
  const t = useT();
  const { data, loading, refreshing, error, offline, stale, updatedAt, refresh } = useDashboard();
  const firstName = data?.profile.firstName ?? rep?.name.split(/\s+/)[0];
  const [next, ...later] = data?.nextVisits ?? [];
  const { data: team } = useTeam();
  const { data: sub } = useSubscription();
  const invite = team && !team.team ? team.invite : null;
  const seeUpcoming = () => router.push({ pathname: '/visits', params: { segment: 'upcoming' } });

  return (
    <SafeAreaView style={screenStyles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={screenStyles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <AppHeader />
        <Text style={styles.date}>{formatDate(Date.now(), { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        <Text style={[type.screenTitle, styles.greeting]} accessibilityRole="header">
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
                <EmptyState art="calendar" title={t('home.noNextVisit')} hint={t('home.noNextVisitHint')} />
              </View>
            )}

            <View style={styles.quick}>
              <QuickAction icon="business-outline" label={t('home.quick.book')} onPress={() => router.push('/clinics')} />
              <QuickAction icon="create-outline" label={t('home.quick.log')} onPress={() => router.push('/visits/log')} />
            </View>

            <View style={styles.counts}>
              <Count
                icon="calendar-outline"
                value={data.stats.visitsThisMonth}
                label={t('home.count.thisMonth')}
                progress={
                  data.stats.visitsThisMonth > 0
                    ? { done: data.stats.completedThisMonth, total: data.stats.visitsThisMonth, label: t('home.count.completed', { done: data.stats.completedThisMonth, total: data.stats.visitsThisMonth }) }
                    : undefined
                }
                onPress={() => router.push({ pathname: '/visits', params: { segment: 'past', range: 'thisMonth' } })}
              />
              <Count
                icon="hourglass-outline"
                value={data.stats.pendingRequests}
                label={t('home.count.waiting')}
                tone={data.stats.pendingRequests > 0 ? 'warning' : undefined}
                onPress={seeUpcoming}
              />
              <Count
                icon="time-outline"
                value={data.stats.expiringProducts}
                label={t('home.count.expiring')}
                tone={data.stats.expiringProducts > 0 ? 'warning' : undefined}
                onPress={() => router.push('/products')}
              />
            </View>

            {later.length ? (
              <>
                <SectionHeader
                  title={t('home.upcoming')}
                  action={data.stats.upcomingVisits > data.nextVisits.length ? { title: t('home.seeAll'), onPress: seeUpcoming } : undefined}
                />
                {later.map((v) => (
                  <VisitRow key={v._id} visit={v} />
                ))}
              </>
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

/** One of Home's two shortcuts: the rep's most common jobs, one tap away. */
function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <IconTile icon={icon} tone="primary" size={36} />
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Count({
  icon,
  value,
  label,
  tone,
  progress,
  onPress,
}: {
  icon: IconName;
  value: number;
  label: string;
  tone?: 'warning';
  progress?: { done: number; total: number; label: string };
  onPress: () => void;
}) {
  const a11y = progress ? `${value} ${label}, ${progress.label}` : `${value} ${label}`;
  return (
    <TouchableOpacity style={styles.count} onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y}>
      <IconTile icon={icon} tone={tone ?? 'slate'} size={32} />
      <Text style={[mono, styles.countValue, tone === 'warning' && styles.countWarning]} maxFontSizeMultiplier={1.6}>
        {value}
      </Text>
      <Text style={type.secondary}>{label}</Text>
      {progress ? (
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${Math.min(100, Math.round((progress.done / progress.total) * 100))}%` }]} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  date: { ...type.secondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  greeting: { marginTop: 2, marginBottom: spacing.sm },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  quickAction: {
    flexGrow: 1,
    flexBasis: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    minHeight: 56,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
  },
  quickLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
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
  countValue: { fontSize: 24, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  countWarning: { color: colors.warning },
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.slateSoft, marginTop: spacing.sm, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2, backgroundColor: colors.slate },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  noticeText: { flex: 1 },
  noticeAction: { fontSize: 15, fontWeight: '700', color: colors.primaryOnSoft },
});
