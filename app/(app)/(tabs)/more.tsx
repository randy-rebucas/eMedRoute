import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useDashboard } from '@/lib/dashboard';
import { formatDate } from '@/lib/format';
import { languageChoiceLabel, TFunction, useLanguage, useT } from '@/lib/i18n';
import { useSubscription } from '@/lib/plan';
import { useSponsorships } from '@/lib/sponsorships';
import { useTeam } from '@/lib/team';
import { colors, radius, spacing } from '@/lib/theme';
import { SponsorshipsState, Subscription, TeamState } from '@/lib/types';
import { type } from '@/lib/typography';
import { Avatar } from '@/components/Avatar';
import { NavRow, RowGroup } from '@/components/forms';
import { screenStyles } from '@/components/ui';

type Line = { value: string; tone?: 'warning' | 'good' } | null;

/** The Team row's line: a waiting invite first, then the team, else not on one. */
function teamLine(t: TFunction, team: TeamState | null): Line {
  if (!team) return null;
  if (team.invite && !team.team) return { value: t('more.team.invite', { team: team.invite.teamName }), tone: 'warning' };
  if (!team.team) return { value: t('more.team.none') };
  const { name, memberCount, role } = team.team;
  return { value: role === 'manager' ? t('more.team.manager', { team: name, count: memberCount }) : t('more.team.member', { team: name, count: memberCount }) };
}

/** The Plan row's line: what covers booking with clinics, or that nothing does. */
function planLine(t: TFunction, sub: Subscription | null): Line {
  if (!sub) return null;
  if (!sub.canBookClinics) return { value: t('more.plan.blocked'), tone: 'warning' };
  if (sub.free || sub.coveredBy === 'free') return { value: t('more.plan.free'), tone: 'good' };
  if (sub.coveredBy === 'team') return { value: t('more.plan.team'), tone: 'good' };
  if (sub.coveredBy === 'individual' && sub.individual) {
    return { value: t('more.plan.own', { date: formatDate(sub.individual.expiresAt, { month: 'short', day: 'numeric', year: 'numeric' }) }), tone: 'good' };
  }
  return null;
}

/** The Sponsorships row's line: clinics waiting on the rep first, then how many are paid for. */
function sponsorLine(t: TFunction, state: SponsorshipsState | null): Line {
  if (!state) return null;
  const waiting = state.sponsorships.filter((s) => s.status === 'pending' && s.awaitingYou).length;
  if (waiting) return { value: t('more.sponsor.waiting', { count: waiting }), tone: 'warning' };
  const active = state.sponsorships.filter((s) => s.active).length;
  return active ? { value: t('more.sponsor.active', { count: active }), tone: 'good' } : { value: t('more.sponsor.none') };
}

/**
 * More: who's signed in (navy card, with whether booking is covered), then Work (Team, Plan,
 * sponsorships, referral) and Account (Settings, Support), each row saying where it stands so the
 * rep only opens the one that needs them. Sign out asks first.
 */
export default function MoreScreen() {
  const { rep, signOut } = useAuth();
  const t = useT();
  const { preference } = useLanguage();
  const [signingOut, setSigningOut] = useState(false);
  // All cached on the phone, so the lines still read offline. The referral code isn't loaded
  // here: the server makes one the first time it's asked for, so only its own screen asks.
  const { data: team } = useTeam();
  const { data: sub } = useSubscription();
  const { data: sponsorships } = useSponsorships();
  const { data: dashboard } = useDashboard();
  const profile = dashboard?.profile;
  const openSupport = dashboard?.stats.openSupportRequests ?? 0;

  const teamRow = teamLine(t, team);
  const planRow = planLine(t, sub);
  const sponsorRow = sponsorLine(t, sponsorships);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      // Signed out on this device regardless; the sign-in screen takes over.
    } finally {
      setSigningOut(false);
    }
  }

  function confirmSignOut() {
    if (signingOut) return;
    Alert.alert(t('more.signOutTitle'), t('more.signOutBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.signOut'),
        style: 'destructive',
        onPress: () => handleSignOut().catch(() => Alert.alert(t('common.somethingWrong'))),
      },
    ]);
  }

  // `title` is an honorific (Mr., Ms., Dr.): it goes before the name, not beside the company.
  const role = rep?.company ?? profile?.company ?? '';
  const shownName = [profile?.title, rep?.name].filter(Boolean).join(' ');

  return (
    <SafeAreaView style={screenStyles.container} edges={['top']}>
      <ScrollView contentContainerStyle={screenStyles.content}>
        <Text style={[type.screenTitle, styles.title]} accessibilityRole="header">
          {t('nav.more')}
        </Text>

        {rep ? (
          <TouchableOpacity
            style={styles.hero}
            onPress={() => router.push('/profile')}
            accessibilityRole="button"
            accessibilityLabel={[shownName, role, profile?.territory, t('more.viewProfile')].filter(Boolean).join(', ')}
            activeOpacity={0.85}
          >
            <View style={styles.heroTop}>
              <Avatar name={rep.name} image={rep.profileImage} size={60} tone="teal" />
              <View style={styles.heroText}>
                <Text style={styles.name}>{shownName}</Text>
                {role ? <Text style={styles.muted}>{role}</Text> : null}
                {profile?.territory ? (
                  <View style={styles.territory}>
                    <Ionicons name="location-outline" size={14} color={colors.onNavyMuted} />
                    <Text style={styles.muted}>{profile.territory}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.heroFoot}>
              {sub ? (
                <View style={[styles.cover, !sub.canBookClinics && styles.coverWarn]}>
                  <Ionicons
                    name={sub.canBookClinics ? 'checkmark-circle' : 'alert-circle'}
                    size={14}
                    color={sub.canBookClinics ? colors.primaryText : colors.warning}
                  />
                  <Text style={[styles.coverText, !sub.canBookClinics && { color: colors.warning }]}>
                    {sub.canBookClinics ? t('more.hero.covered') : t('more.hero.needsPlan')}
                  </Text>
                </View>
              ) : (
                <View />
              )}
              <View style={styles.view}>
                <Text style={styles.viewText}>{t('more.viewProfile')}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primaryText} />
              </View>
            </View>
          </TouchableOpacity>
        ) : null}

        <RowGroup title={t('more.work')}>
          <NavRow icon="people-outline" label={t('more.team')} value={teamRow?.value} valueTone={teamRow?.tone} onPress={() => router.push('/team')} />
          <NavRow icon="card-outline" label={t('more.plan')} value={planRow?.value} valueTone={planRow?.tone} onPress={() => router.push('/plan')} />
          <NavRow
            icon="ribbon-outline"
            label={t('more.sponsorships')}
            value={sponsorRow?.value}
            valueTone={sponsorRow?.tone}
            onPress={() => router.push('/sponsorships')}
          />
          <NavRow icon="share-social-outline" label={t('more.referral')} value={t('more.referral.hint')} onPress={() => router.push('/referral')} last />
        </RowGroup>

        <RowGroup title={t('more.account')}>
          <NavRow
            icon="settings-outline"
            label={t('more.settings')}
            value={t('more.settings.language', { language: languageChoiceLabel(preference) })}
            onPress={() => router.push('/settings')}
          />
          <NavRow
            icon="help-buoy-outline"
            label={t('more.support')}
            value={openSupport > 0 ? t('more.support.open', { count: openSupport }) : t('more.support.none')}
            valueTone={openSupport > 0 ? 'warning' : undefined}
            onPress={() => router.push('/support')}
            last
          />
        </RowGroup>

        <RowGroup>
          <NavRow icon="log-out-outline" label={signingOut ? t('more.signingOut') : t('common.signOut')} onPress={confirmSignOut} chevron={false} last />
        </RowGroup>

        <Text style={styles.version}>{t('more.version', { version: Constants.expoConfig?.version ?? '' })}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: spacing.sm, marginBottom: spacing.md },
  // The signed-in rep on the app's own navy (as Home's next visit): the one thing this tab is about.
  hero: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.md + 4, marginBottom: spacing.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroText: { flex: 1, gap: 2 },
  name: { fontSize: 20, fontWeight: '700', color: colors.primaryText, letterSpacing: -0.2 },
  muted: { fontSize: 13, lineHeight: 18, color: colors.onNavyMuted, flexShrink: 1 },
  territory: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: spacing.md,
    paddingTop: spacing.sm + 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.navyLine,
  },
  cover: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: colors.primary },
  coverWarn: { backgroundColor: colors.warningSoft },
  coverText: { fontSize: 12, fontWeight: '700', color: colors.primaryText },
  view: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  viewText: { fontSize: 14, fontWeight: '600', color: colors.primaryText },
  version: { ...type.secondary, textAlign: 'center', marginTop: spacing.sm, fontVariant: ['tabular-nums'] },
});
