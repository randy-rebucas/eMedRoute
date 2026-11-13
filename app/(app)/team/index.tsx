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
import { Team, TeamInvite } from '@/lib/types';
import { mono, type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { ErrorState } from '@/components/ErrorState';
import { Field } from '@/components/forms';
import { ThinProgress } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { seatsLine } from '@/components/PlanCard';
import { TeamMemberRow } from '@/components/TeamMemberRow';
import { Banner, Button, LoadingView, screenStyles, useBottomPadding } from '@/components/ui';

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

/** Team: answer an invite, start a team, or (member / manager) see and run it. */
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
        <ThinProgress active={stale && !offline} />
        <OfflineBanner offline={offline} updatedAt={updatedAt} subject={t('team.offlineSubject')} />
        {data.team ? (
          data.team.role === 'manager' ? (
            <ManagerView team={data.team} />
          ) : (
            <MemberView team={data.team} />
          )
        ) : (
          <>
            {data.invite ? <InviteCard invite={data.invite} /> : null}
            <StartTeam />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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

  return (
    <View style={styles.card}>
      <Text style={type.cardTitle} accessibilityRole="header">
        {t('team.invite.title', { team: invite.teamName })}
      </Text>
      <Text style={type.body}>
        {invite.invitedBy ? t('team.invite.from', { name: invite.invitedBy }) : t('team.invite.fromUnknown')}
      </Text>
      <View style={styles.privacy}>
        <Ionicons name="eye-outline" size={18} color={colors.slate} />
        <Text style={[type.body, styles.flex]}>{t('team.invite.privacy')}</Text>
      </View>
      {problem ? <Banner message={problem} /> : null}
      <Button title={t('team.invite.accept')} onPress={() => answer(true)} loading={busy === 'accept'} disabled={!!busy} />
      <Button title={t('team.invite.decline')} variant="secondary" onPress={() => answer(false)} loading={busy === 'decline'} disabled={!!busy} />
    </View>
  );
}

function StartTeam() {
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
    <View style={styles.section}>
      <Text style={type.cardTitle} accessibilityRole="header">
        {t('team.start.title')}
      </Text>
      <Text style={[type.body, styles.p]}>{t('team.start.body')}</Text>
      {problem ? <Banner message={problem} /> : null}
      <Field label={t('team.start.name')} hint={t('team.start.nameHint')} value={name} onChangeText={setName} maxLength={200} />
      <Button title={t('team.start.button')} icon="people-outline" onPress={start} loading={saving} />
    </View>
  );
}

function CoverageLine({ team }: { team: Team }) {
  const t = useT();
  const s = team.subscription;
  if (!s.expiresAt && !s.seats) return <Text style={type.secondary}>{t('team.plan.none')}</Text>;
  return (
    <Text style={type.secondary}>
      {s.active ? t('team.plan.active') : t('team.plan.ended')}{' '}
      <Text style={mono}>{formatDate(s.expiresAt, { month: 'short', day: 'numeric', year: 'numeric' })}</Text> · {seatsLine(t, s)}
    </Text>
  );
}

function LeaveButton({ onLeft }: { onLeft?: () => void }) {
  const t = useT();
  const describe = useActionError();
  const [leaving, setLeaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function confirm() {
    Alert.alert(t('team.leave.title'), t('team.leave.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('team.leave.button'), style: 'destructive', onPress: leave },
    ]);
  }

  async function leave() {
    setLeaving(true);
    setProblem(null);
    try {
      await leaveTeam();
      onLeft?.();
    } catch (err) {
      setProblem(describe(err));
    } finally {
      setLeaving(false);
    }
  }

  return (
    <>
      {problem ? <Banner message={problem} /> : null}
      <Button title={t('team.leave.button')} icon="exit-outline" variant="dangerOutline" onPress={confirm} loading={leaving} />
    </>
  );
}

function MemberView({ team }: { team: Team }) {
  const t = useT();
  return (
    <>
      <Text style={type.screenTitle} accessibilityRole="header">
        {team.name}
      </Text>
      <View style={styles.card}>
        <Text style={type.body}>{t('team.managedBy', { names: team.managers.join(', ') })}</Text>
        <Text style={type.body}>
          <Text style={mono}>{team.memberCount}</Text> {t('team.membersWord', { count: team.memberCount })}
        </Text>
        <CoverageLine team={team} />
        <View style={styles.privacy}>
          <Ionicons name="eye-outline" size={18} color={colors.slate} />
          <Text style={[type.secondary, styles.flex]}>{t('team.invite.privacy')}</Text>
        </View>
      </View>
      <LeaveButton />
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

  function confirmRemove(id: string, memberName: string) {
    Alert.alert(t('team.removeTitle', { name: memberName }), t('team.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('team.remove'), style: 'destructive', onPress: () => run(`remove-${id}`, () => removeMember(id)) },
    ]);
  }

  const members = team.members ?? [];
  const pending = team.pendingInvites ?? [];
  const s = team.subscription;

  return (
    <>
      {renaming ? (
        <View style={styles.section}>
          <Field label={t('team.rename.label')} value={name} onChangeText={setName} maxLength={200} />
          <Button
            title={t('common.save')}
            onPress={() => run('rename', () => renameTeam(name.trim()), () => setRenaming(false))}
            loading={busy === 'rename'}
            disabled={name.trim().length < 2 || (!!busy && busy !== 'rename')}
          />
          <Button title={t('common.cancel')} variant="secondary" onPress={() => setRenaming(false)} disabled={busy === 'rename'} />
        </View>
      ) : (
        <View style={styles.titleRow}>
          <Text style={[type.screenTitle, styles.flex]} accessibilityRole="header">
            {team.name}
          </Text>
          <TouchableOpacity style={styles.iconButton} onPress={startRename} accessibilityRole="button" accessibilityLabel={t('team.rename.a11y')}>
            <Ionicons name="create-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}
      {problem ? <Banner message={problem} /> : null}

      <View style={styles.card}>
        <Text style={type.label}>{t('team.plan.title')}</Text>
        <CoverageLine team={team} />
        {s.active && s.members > s.seats ? <Text style={styles.warn}>{t('team.plan.overFull', { members: s.members, seats: s.seats })}</Text> : null}
        {sub && !sub.free ? (
          <>
            <Text style={type.secondary}>{t('team.plan.seatPrice', { monthly: formatMoney(sub.prices.seatMonthly), yearly: formatMoney(sub.prices.seatYearly) })}</Text>
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
          </>
        ) : null}
      </View>

      <Button title={t('team.allVisits')} icon="calendar-outline" variant="secondary" onPress={() => router.push('/team/visits')} />

      <Text style={[type.cardTitle, styles.h]} accessibilityRole="header">
        {t('team.members', { count: members.length })}
      </Text>
      {members.map((m) => (
        <TeamMemberRow
          key={m.id}
          member={m}
          isYou={m.id === rep?.id}
          onVisits={() => router.push({ pathname: '/team/visits', params: { memberId: m.id } })}
          onRemove={m.role === 'manager' || m.id === rep?.id ? undefined : () => confirmRemove(m.id, m.name)}
        />
      ))}

      <Text style={[type.cardTitle, styles.h]} accessibilityRole="header">
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
      {pending.length ? (
        <View style={styles.pending}>
          <Text style={type.label}>{t('team.invite.pending')}</Text>
          {pending.map((p) => (
            <View key={p.id} style={styles.pendingRow}>
              <View style={styles.flex}>
                <Text style={type.body}>{p.name}</Text>
                <Text style={type.secondary}>
                  {p.email} · <Text style={mono}>{formatDate(p.invitedAt, { month: 'short', day: 'numeric' })}</Text>
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
        </View>
      ) : null}

      <View style={styles.leave}>
        <LeaveButton />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  p: { marginBottom: spacing.sm },
  h: { marginTop: spacing.lg, marginBottom: spacing.sm },
  section: { marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginVertical: spacing.sm,
    gap: spacing.xs,
  },
  privacy: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginTop: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  warn: { fontSize: 13, color: colors.warning },
  pending: { marginTop: spacing.md, gap: spacing.xs },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56 },
  withdraw: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm },
  withdrawText: { fontSize: 15, fontWeight: '600', color: colors.danger },
  dimmed: { opacity: 0.5 },
  leave: { marginTop: spacing.lg },
});
