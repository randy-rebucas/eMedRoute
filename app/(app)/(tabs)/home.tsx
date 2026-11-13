import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { useDashboard } from '@/lib/dashboard';
import { clinicHhmm, clinicTodayYmd, formatDate } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { bookingBlocked, useSubscription } from '@/lib/plan';
import { todaysStops } from '@/lib/route';
import { useTeam } from '@/lib/team';
import { colors, radius, spacing } from '@/lib/theme';
import { DashboardVisit } from '@/lib/types';
import { type } from '@/lib/typography';
import { usePendingDeletes } from '@/lib/undo';
import { visitDay } from '@/lib/visits';
import { AppHeader } from '@/components/AppHeader';
import { ErrorState } from '@/components/ErrorState';
import { SkeletonRows, ThinProgress } from '@/components/Loading';
import { MonthLedger } from '@/components/MonthLedger';
import { NextVisitCard } from '@/components/NextVisitCard';
import { OfflineBanner } from '@/components/OfflineBanner';
import { photos, ScrimPhoto } from '@/components/Photo';
import { TodayRoute } from '@/components/TodayRoute';
import { IconName, screenStyles, SectionHeader } from '@/components/ui';
import { VisitRow } from '@/components/VisitRow';
import { WeeklyVisitsChart } from '@/components/WeeklyVisitsChart';

/** Morning until noon, afternoon until six, then evening, on the clinic's clock. */
function partOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = Number(clinicHhmm(Date.now()).slice(0, 2));
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}

/**
 * Home, top to bottom: the day (greeting over a clinic photo, with today's stop count), the next
 * visit, today's route, the two shortcuts, this month's progress and what needs the rep, the last
 * eight weeks of visits, and the rest of what's coming up.
 */
export default function HomeScreen() {
  const { rep } = useAuth();
  const t = useT();
  const { data, loading, refreshing, error, offline, stale, updatedAt, refresh } = useDashboard();
  const firstName = data?.profile.firstName ?? rep?.name.split(/\s+/)[0];
  // A saved copy from an earlier day still lists that day's visits: they aren't next any more.
  const today = clinicTodayYmd();
  // A visit waiting behind Undo (or deleted since) isn't shown either.
  const pending = usePendingDeletes();
  const shown = (visits: DashboardVisit[]) => visits.filter((v) => !pending.has(v._id));
  const [next, ...later] = shown(data?.nextVisits ?? []).filter((v) => visitDay(v) >= today);
  const todays = shown(data?.todayVisits ?? data?.nextVisits ?? [])
    .filter((v) => visitDay(v) === today)
    .sort((a, b) => a.time.localeCompare(b.time));
  const stops = todaysStops(todays);
  const { data: team } = useTeam();
  const { data: sub } = useSubscription();
  const invite = team && !team.team ? team.invite : null;
  const seeUpcoming = () => router.push({ pathname: '/visits', params: { segment: 'upcoming' } });
  const weeks = data?.weeklyVisits;
  const hasTrend = !!weeks?.length && weeks.some((w) => w.completed + w.open > 0);

  const part = partOfDay();
  const greeting = firstName
    ? part === 'morning'
      ? t('home.greeting.morning', { name: firstName })
      : part === 'afternoon'
        ? t('home.greeting.afternoon', { name: firstName })
        : t('home.greeting.evening', { name: firstName })
    : t(part === 'morning' ? 'home.greeting.morningNoName' : part === 'afternoon' ? 'home.greeting.afternoonNoName' : 'home.greeting.eveningNoName');
  const dayLine = data
    ? todays.length
      ? t('home.day.stops', { count: todays.length, time: todays[0].time })
      : t('home.day.none')
    : null;

  return (
    <SafeAreaView style={screenStyles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={screenStyles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <AppHeader />

        <ScrimPhoto source={photos.clinicLobby} style={styles.band} top={0.35} bottom={0.94}>
          <View style={styles.bandInner}>
            <View style={styles.bandTop}>
              <Text style={styles.bandDate}>{formatDate(Date.now(), { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
              {data?.profile.territory ? (
                <View style={styles.territory}>
                  <Ionicons name="location" size={12} color={colors.primaryText} />
                  <Text style={styles.territoryText} numberOfLines={1}>
                    {data.profile.territory}
                  </Text>
                </View>
              ) : null}
            </View>
            <View>
              <Text style={styles.greeting} accessibilityRole="header">
                {greeting}
              </Text>
              {dayLine ? (
                <View style={styles.dayLine}>
                  <View style={[styles.dayDot, !todays.length && styles.dayDotIdle]} />
                  <Text style={styles.dayText}>{dayLine}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </ScrimPhoto>

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
            {next ? <NextVisitCard visit={next} /> : <NoVisitCard />}

            {stops.length >= 2 ? <TodayRoute stops={stops} /> : null}

            <View style={styles.quick}>
              <PhotoAction
                photo={photos.doctorMeeting}
                icon="business-outline"
                label={t('home.quick.book')}
                hint={t('home.quick.bookHint')}
                onPress={() => router.push('/clinics')}
              />
              <PhotoAction
                photo={photos.visitNotes}
                icon="create-outline"
                label={t('home.quick.log')}
                hint={t('home.quick.logHint')}
                onPress={() => router.push('/visits/log')}
              />
            </View>

            <MonthLedger
              visits={data.stats.visitsThisMonth}
              completed={data.stats.completedThisMonth}
              waiting={data.stats.pendingRequests}
              expiring={data.stats.expiringProducts}
              onVisits={() => router.push({ pathname: '/visits', params: { segment: 'past', range: 'thisMonth', outcome: 'done' } })}
              onWaiting={seeUpcoming}
              onExpiring={() => router.push({ pathname: '/products', params: { filter: 'expiring' } })}
            />

            {hasTrend ? <WeeklyVisitsChart weeks={weeks!} /> : null}

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

/** No visit coming up: a photo card that says so (the Book a clinic shortcut sits right below it). */
function NoVisitCard() {
  const t = useT();
  return (
    <ScrimPhoto source={photos.handshake} style={styles.noVisit} top={0.35} bottom={0.96}>
      <View style={styles.noVisitInner}>
        <Text style={styles.noVisitTitle} accessibilityRole="header">
          {t('home.noNextVisit')}
        </Text>
        <Text style={styles.noVisitHint}>{t('home.noNextVisitHint')}</Text>
      </View>
    </ScrimPhoto>
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

/** One of Home's two shortcuts, on a photo of the job it starts. */
function PhotoAction({
  photo,
  icon,
  label,
  hint,
  onPress,
}: {
  photo: (typeof photos)[keyof typeof photos];
  icon: IconName;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} activeOpacity={0.85}>
      <ScrimPhoto source={photo} style={styles.quickPhoto} top={0.1} bottom={0.95}>
        <View style={styles.quickInner}>
          <View style={styles.quickIcon}>
            <Ionicons name={icon} size={18} color={colors.primaryText} />
          </View>
          <View>
            <Text style={styles.quickLabel}>{label}</Text>
            <Text style={styles.quickHint} numberOfLines={2}>
              {hint}
            </Text>
          </View>
        </View>
      </ScrimPhoto>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  band: { minHeight: 176, borderRadius: radius.lg, marginBottom: spacing.md },
  bandInner: { flex: 1, justifyContent: 'space-between', padding: spacing.md + 4, gap: spacing.lg },
  bandTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  bandDate: { ...type.pill, flexShrink: 1, color: colors.primaryText, textTransform: 'uppercase', letterSpacing: 0.8 },
  territory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '50%',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  territoryText: { fontSize: 12, fontWeight: '600', color: colors.primaryText },
  greeting: { fontSize: 26, fontWeight: '700', color: colors.primaryText, letterSpacing: -0.4 },
  dayLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs + 2 },
  dayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  dayDotIdle: { backgroundColor: colors.onNavyMuted },
  dayText: { fontSize: 13, color: colors.onNavyMuted },
  noVisit: { minHeight: 184, borderRadius: radius.lg, marginBottom: spacing.md },
  noVisitInner: { flex: 1, justifyContent: 'flex-end', padding: spacing.md + 4 },
  noVisitTitle: { fontSize: 20, fontWeight: '700', color: colors.primaryText },
  noVisitHint: { fontSize: 14, lineHeight: 20, color: colors.onNavyMuted, marginTop: spacing.xs },
  quick: { flexDirection: 'row', gap: spacing.sm + 4, marginBottom: spacing.md },
  quickAction: { flex: 1 },
  quickPhoto: { minHeight: 148, borderRadius: radius.lg },
  quickInner: { flex: 1, justifyContent: 'space-between', padding: spacing.sm + 6 },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { fontSize: 16, fontWeight: '700', color: colors.primaryText },
  quickHint: { fontSize: 12, lineHeight: 16, color: colors.onNavyMuted, marginTop: 2 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    marginBottom: spacing.sm,
  },
  noticeText: { flex: 1 },
  noticeAction: { fontSize: 15, fontWeight: '700', color: colors.primaryOnSoft },
});
