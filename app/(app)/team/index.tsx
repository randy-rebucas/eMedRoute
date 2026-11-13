import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatMoney } from '@/lib/format';
import { emitRefresh } from '@/lib/events';
import { useT } from '@/lib/i18n';
import { openSupportDraft } from '@/lib/support';
import { useSubscription } from '@/lib/plan';
import { answerInvite, inviteRep, leaveTeam, removeMember, renameTeam, startTeam, useTeam, withdrawInvite } from '@/lib/team';
import { colors, radius, spacing } from '@/lib/theme';
import { Team, TeamInvite, TeamMember } from '@/lib/types';
import { type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { ErrorState } from '@/components/ErrorState';
import { Field, NavRow, RowGroup } from '@/components/forms';
import { ThinProgress } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { photos, ScrimPhoto } from '@/components/Photo';
import { Meter } from '@/components/PlanCard';
import { TeamMonthChart } from '@/components/TeamMonthChart';
import { Banner, Button, IconName, LoadingView, screenStyles, useBottomPadding } from '@/components/ui';

/** A team action's failure in words: needs a connection, a known code, or the server's message. */
function useActionError() {
  const t = useT();
  return (err: unknown): string => {
    if (isNetworkError(err)) return t('common.needsConnection');
    if (err instanceof ApiError) {
      switch (err.code) {
        case 'TEAM_FULL':
          return t('team.error.full');
        case 'TEAM_HAS_MEMBERS':
          return t('team.error.hasMembers');
        case 'INVITE_CHANGED':
        case 'NO_INVITE':
          // The invite on screen is out of date: load the one there is now (or none).
          emitRefresh('team');
          return t('team.error.inviteChanged');
      }
      return err.message;
    }
    return errorMessage(err);
  };
}

const longDate = (value: string) => formatDate(value, { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * Team. A manager lands on who is out seeing clinics this month and who has gone quiet (one bar
 * per member), with the team's seats on navy above. A member sees their team and exactly what its
 * managers can see. Without a team: the invite (if any) leads, else a photo band, what a team
 * gives, and the form to start one.
 */
export default function TeamScreen() {
  const t = useT();
  const { data, loading, refreshing, error, offline, stale, updatedAt, refresh } = useTeam();
  const paddingBottom = useBottomPadding();

  if (!data) {
    if (loading) return <LoadingView />;
    return <ErrorState message={error ?? t('common.failedToLoad')} onRetry={refresh} />;
  }

  return (
    <KeyboardAvoidingView style={screenStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={96}>
      <ScrollView
        contentContainerStyle={[screenStyles.content, { paddingBottom }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {stale || offline ? (
          <View style={styles.status}>
            <ThinProgress active={stale && !offline} />
            <OfflineBanner offline={offline} updatedAt={updatedAt} subject={t('team.offlineSubject')} />
          </View>
        ) : null}
        {data.team ? (
          data.team.role === 'manager' ? (
            <ManagerView team={data.team} />
          ) : (
            <MemberView team={data.team} />
          )
        ) : (
          <>
            {data.invite ? <InviteCard invite={data.invite} /> : null}
            <StartTeam withPhoto={!data.invite} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Ruled rows of plain facts, each with its icon (nothing to tap). */
function InfoRows({ title, rows }: { title: string; rows: { icon: IconName; text: string }[] }) {
  return (
    <RowGroup title={title}>
      {rows.map((r, i) => (
        <View key={r.icon} style={[styles.info, i < rows.length - 1 && styles.rule]} accessible>
          <Ionicons name={r.icon} size={20} color={colors.slate} />
          <Text style={[type.body, styles.flex]}>{r.text}</Text>
        </View>
      ))}
    </RowGroup>
  );
}

function Chip({ label, tone = 'good' }: { label: string; tone?: 'good' | 'warning' }) {
  const warn = tone === 'warning';
  return (
    <View style={[styles.chip, warn && styles.chipWarn]}>
      <Ionicons name={warn ? 'alert-circle' : 'mail-open-outline'} size={14} color={warn ? colors.warning : colors.primaryText} />
      <Text style={[styles.chipText, warn && { color: colors.warning }]}>{label}</Text>
    </View>
  );
}

/** The team on navy: name, who runs it, and its plan (dates in tabular figures, a seats meter). */
function TeamHero({ team, onRename }: { team: Team; onRename?: () => void }) {
  const t = useT();
  const s = team.subscription;
  const manager = team.role === 'manager';
  const hasPlan = !!(s.expiresAt || s.seats);
  const overFull = s.active && s.members > s.seats;
  const invites = team.pendingInvites?.length ?? 0;

  return (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <Text style={[styles.heroTitle, styles.flex]} accessibilityRole="header">
          {team.name}
        </Text>
        {onRename ? (
          <TouchableOpacity style={styles.heroIcon} onPress={onRename} accessibilityRole="button" accessibilityLabel={t('team.rename.a11y')}>
            <Ionicons name="create-outline" size={22} color={colors.primaryText} />
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.heroMuted}>
        {manager
          ? t('team.hero.manage', { count: team.memberCount })
          : t('team.hero.managedBy', { names: team.managers.join(', '), count: team.memberCount })}
      </Text>
      {hasPlan ? (
        <>
          {s.expiresAt ? (
            <Text style={[styles.heroMuted, styles.figures]}>
              {s.active ? t('team.hero.until', { date: longDate(s.expiresAt) }) : t('team.hero.ended', { date: longDate(s.expiresAt) })}
            </Text>
          ) : null}
          {s.active && s.seats ? (
            <Meter share={Math.min(1, s.members / s.seats)} tone={overFull ? 'warning' : 'accent'} label={t('plan.seatsTaken', { members: s.members, seats: s.seats })} />
          ) : null}
        </>
      ) : (
        <Text style={styles.heroMuted}>{t('team.plan.none')}</Text>
      )}
      {overFull ? (
        <View style={styles.heroWarn}>
          <Chip label={t('team.hero.overFull')} tone="warning" />
          <Text style={styles.heroWarnText}>{t('team.hero.overFullBody', { members: s.members })}</Text>
        </View>
      ) : null}
      {manager && invites ? <Text style={styles.heroMuted}>{t('team.hero.invitesOut', { count: invites })}</Text> : null}
    </View>
  );
}

function InviteCard({ invite }: { invite: TeamInvite }) {
  const t = useT();
  const describe = useActionError();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function answer(accept: boolean) {
    setBusy(accept ? 'accept' : 'decline');
    setProblem(null);
    try {
      await answerInvite(accept);
    } catch (err) {
      setProblem(describe(err));
    } finally {
      setBusy(null);
    }
  }

  // The manager is told at once, and only a new invite undoes it.
  function confirmDecline() {
    Alert.alert(t('team.invite.declineTitle', { team: invite.teamName }), t('team.invite.declineBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('team.invite.decline'), style: 'destructive', onPress: () => void answer(false) },
    ]);
  }

  return (
    <>
      <View style={styles.hero}>
        <Chip label={t('team.invite.chip')} />
        <Text style={styles.heroTitle} accessibilityRole="header">
          {t('team.invite.title', { team: invite.teamName })}
        </Text>
        <Text style={styles.heroMuted}>
          {invite.invitedBy ? t('team.invite.from', { name: invite.invitedBy }) : t('team.invite.fromUnknown')}
        </Text>
        <View style={styles.heroPrivacy}>
          <Ionicons name="eye-outline" size={18} color={colors.onNavyMuted} />
          <Text style={[styles.heroMuted, styles.flex]}>{t('team.invite.privacy')}</Text>
        </View>
        <Button title={t('team.invite.accept')} icon="people-outline" onPress={() => answer(true)} loading={busy === 'accept'} disabled={!!busy} />
        <Button title={t('team.invite.decline')} variant="secondary" onPress={confirmDecline} loading={busy === 'decline'} disabled={!!busy} />
      </View>
      {problem ? <Banner message={problem} /> : null}
    </>
  );
}

function StartTeam({ withPhoto }: { withPhoto: boolean }) {
  const t = useT();
  const describe = useActionError();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function start() {
    if (saving) return;
    if (name.trim().length < 2) {
      setProblem(t('team.start.nameRequired'));
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      await startTeam(name.trim());
    } catch (err) {
      setProblem(describe(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {withPhoto ? (
        <ScrimPhoto source={photos.teamBriefing} style={styles.photo} top={0.45} bottom={0.95}>
          <View style={styles.photoBody}>
            <Text style={styles.heroTitle} accessibilityRole="header">
              {t('team.start.photoTitle')}
            </Text>
            <Text style={styles.heroMuted}>{t('team.start.photoBody')}</Text>
          </View>
        </ScrimPhoto>
      ) : null}

      <InfoRows
        title={t('team.gives.title')}
        rows={[
          { icon: 'calendar-outline', text: t('team.gives.see') },
          { icon: 'lock-closed-outline', text: t('team.gives.notes') },
          { icon: 'card-outline', text: t('team.gives.seats') },
          { icon: 'mail-outline', text: t('team.gives.invite') },
        ]}
      />

      <View style={styles.card}>
        <Text style={type.cardTitle} accessibilityRole="header">
          {t('team.start.title')}
        </Text>
        <Field label={t('team.start.name')} hint={t('team.start.nameHint')} value={name} onChangeText={setName} maxLength={200} />
        {problem ? <Banner message={problem} /> : null}
        <Button title={t('team.start.button')} icon="people-outline" onPress={start} loading={saving} />
      </View>
    </>
  );
}

/** Leave the team, as a red row at the foot; confirmed first. */
function LeaveRow() {
  const t = useT();
  const describe = useActionError();
  const [leaving, setLeaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function confirm() {
    if (leaving) return;
    Alert.alert(t('team.leave.title'), t('team.leave.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('team.leave.button'), style: 'destructive', onPress: () => void leave() },
    ]);
  }

  async function leave() {
    setLeaving(true);
    setProblem(null);
    try {
      await leaveTeam();
    } catch (err) {
      setProblem(describe(err));
    } finally {
      setLeaving(false);
    }
  }

  return (
    <>
      {problem ? <Banner message={problem} /> : null}
      <RowGroup>
        <NavRow icon="exit-outline" label={t('team.leave.button')} tone="danger" chevron={false} onPress={confirm} last />
      </RowGroup>
    </>
  );
}

function MemberView({ team }: { team: Team }) {
  const t = useT();
  return (
    <>
      <TeamHero team={team} />
      <InfoRows
        title={t('team.sees.title')}
        rows={[
          { icon: 'eye-outline', text: t('team.sees.visits') },
          { icon: 'lock-closed-outline', text: t('team.sees.notes') },
        ]}
      />
      <LeaveRow />
    </>
  );
}

function ManagerView({ team }: { team: Team }) {
  const t = useT();
  const { rep } = useAuth();
  const { data: sub } = useSubscription();
  const describe = useActionError();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(team.name);
  const [email, setEmail] = useState('');
  const [inviteNote, setInviteNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // State lags a frame: two taps in one frame must not run an action twice.
  const busyRef = useRef(false);

  async function run(key: string, action: () => Promise<unknown>, after?: () => void) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(key);
    setProblem(null);
    try {
      await action();
      after?.();
    } catch (err) {
      setProblem(describe(err));
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  function startRename() {
    setName(team.name);
    setProblem(null);
    setRenaming(true);
  }

  function invite() {
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setProblem(t('team.invite.badEmail'));
      return;
    }
    setInviteNote(null);
    // The API answers the same whether or not the email has an account, and so does the app.
    run('invite', () => inviteRep(value), () => {
      setEmail('');
      setInviteNote(t('team.invite.sent'));
    });
  }

  function confirmRemove(m: TeamMember) {
    Alert.alert(t('team.removeTitle', { name: m.name }), t('team.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('team.remove'), style: 'destructive', onPress: () => run(`remove-${m.id}`, () => removeMember(m.id)) },
    ]);
  }

  const members = team.members ?? [];
  const pending = team.pendingInvites ?? [];

  return (
    <>
      <TeamHero team={team} onRename={renaming ? undefined : startRename} />

      {renaming ? (
        <View style={styles.card}>
          <Field label={t('team.rename.label')} value={name} onChangeText={setName} maxLength={200} />
          <Button
            title={t('common.save')}
            onPress={() => run('rename', () => renameTeam(name.trim()), () => setRenaming(false))}
            loading={busy === 'rename'}
            disabled={name.trim().length < 2 || (!!busy && busy !== 'rename')}
          />
          <Button title={t('common.cancel')} variant="secondary" onPress={() => setRenaming(false)} disabled={busy === 'rename'} />
        </View>
      ) : null}
      {problem ? <Banner message={problem} /> : null}

      <TeamMonthChart
        members={members}
        youId={rep?.id}
        onVisits={(m) => router.push({ pathname: '/team/visits', params: { memberId: m.id } })}
        // Another manager can't be removed, and you leave instead of removing yourself.
        canRemove={(m) => m.role !== 'manager' && m.id !== rep?.id}
        onRemove={confirmRemove}
      />

      <RowGroup>
        <NavRow icon="calendar-outline" label={t('team.allVisits')} value={t('team.visitsRow.hint')} onPress={() => router.push('/team/visits')} last />
      </RowGroup>

      <View style={styles.card}>
        <Text style={type.cardTitle} accessibilityRole="header">
          {t('team.invite.sectionTitle')}
        </Text>
        <Field
          label={t('team.invite.email')}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setInviteNote(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          maxLength={254}
        />
        {inviteNote ? <Banner tone="primary" message={inviteNote} /> : null}
        <Button title={t('team.invite.send')} icon="paper-plane-outline" onPress={invite} loading={busy === 'invite'} />
      </View>

      {pending.length ? (
        <RowGroup title={t('team.invite.pending')}>
          {pending.map((p, i) => (
            <View key={p.id} style={[styles.pendingRow, i < pending.length - 1 && styles.rule]}>
              <View style={styles.flex}>
                <Text style={type.body}>{p.name}</Text>
                <Text style={[type.secondary, styles.figures]}>
                  {p.email} · {formatDate(p.invitedAt, { month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.withdraw}
                onPress={() => run(`withdraw-${p.id}`, () => withdrawInvite(p.id))}
                disabled={!!busy}
                accessibilityRole="button"
                accessibilityLabel={t('team.invite.withdrawA11y', { name: p.name })}
                accessibilityState={{ disabled: !!busy, busy: busy === `withdraw-${p.id}` }}
              >
                {busy === `withdraw-${p.id}` ? (
                  <ActivityIndicator color={colors.danger} />
                ) : (
                  <Text style={[styles.withdrawText, !!busy && styles.dimmed]}>{t('team.invite.withdraw')}</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </RowGroup>
      ) : null}

      {sub && !sub.free ? (
        <View style={styles.card}>
          <Text style={type.cardTitle} accessibilityRole="header">
            {t('team.seats.title')}
          </Text>
          <Text style={[type.body, styles.figures]}>
            {t('team.plan.seatPrice', { monthly: formatMoney(sub.prices.seatMonthly), yearly: formatMoney(sub.prices.seatYearly) })}
          </Text>
          <Text style={type.secondary}>{t('team.plan.seatsRule', { members: team.memberCount })}</Text>
          <Button
            title={t('team.plan.ask')}
            icon="mail-outline"
            variant="secondary"
            onPress={() =>
              openSupportDraft({
                category: 'billing',
                subject: t('team.plan.askSubject', { team: team.name }),
                message: t('team.plan.askMessage', { members: team.memberCount }),
              })
            }
          />
        </View>
      ) : null}

      <LeaveRow />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  figures: { fontVariant: ['tabular-nums'] },
  status: { gap: spacing.sm, marginBottom: spacing.md },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  // The team on the app's navy (as Home's next visit): solid, no shadow.
  hero: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.md + 4, gap: spacing.sm, marginBottom: spacing.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.primaryText, letterSpacing: -0.2 },
  heroIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -spacing.sm },
  heroMuted: { fontSize: 14, lineHeight: 20, color: colors.onNavyMuted },
  heroWarn: { gap: spacing.xs, marginTop: spacing.xs },
  heroWarnText: { fontSize: 13, lineHeight: 18, color: colors.warningSoft },
  heroPrivacy: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginBottom: spacing.xs },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  chipWarn: { backgroundColor: colors.warningSoft },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.primaryText },
  photo: { borderRadius: radius.lg, minHeight: 200, marginBottom: spacing.lg },
  photoBody: { flex: 1, justifyContent: 'flex-end', padding: spacing.md + 4, gap: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  info: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  withdraw: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm },
  withdrawText: { fontSize: 15, fontWeight: '600', color: colors.danger },
  dimmed: { opacity: 0.5 },
});
