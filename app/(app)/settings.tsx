import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { TFunction, useT } from '@/lib/i18n';
import { updateNotificationSettings, useRepProfile } from '@/lib/profile';
import { getPushPermission, PushPermission, pushState, PushState, registerForPushNotifications } from '@/lib/push';
import { colors, radius, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { NavRow, RowGroup } from '@/components/forms';
import { ThinProgress } from '@/components/Loading';
import { LanguagePicker, useLanguageSummary } from '@/components/LanguagePicker';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PushBringsRows } from '@/components/PushBrings';
import { Banner, Button, screenStyles, useBottomPadding } from '@/components/ui';

function heroCopy(t: TFunction, state: PushState): { title: string; body: string | null } {
  switch (state) {
    case 'off':
      return { title: t('settings.hero.off'), body: t('settings.hero.offBody') };
    case 'checking':
      return { title: t('settings.hero.checking'), body: null };
    case 'on':
      return { title: t('settings.hero.on'), body: t('settings.hero.onBody') };
    case 'ask':
      return { title: t('settings.hero.ask'), body: t('settings.hero.askBody') };
    case 'blocked':
      return { title: t('settings.hero.blocked'), body: t('settings.hero.blockedBody') };
    case 'unavailable':
      return { title: t('settings.hero.unavailable'), body: t('settings.hero.unavailableBody') };
  }
}

/**
 * Settings: will clinic answers reach this phone? The navy card answers that (account switch +
 * the phone's own permission, with the one fix it needs), then what push carries, so the rep knows
 * what switching it off costs. Language, password and the two sign-outs (both confirmed) below.
 * There's no email switch: the server emails reps only about their account, never optionally.
 */
export default function SettingsScreen() {
  const t = useT();
  const { signOut } = useAuth();
  const { data: profile, setData: setProfile, error: loadError, offline, stale, updatedAt, refreshing, refresh } = useRepProfile();
  const languageSummary = useLanguageSummary();
  const paddingBottom = useBottomPadding();
  const [languageOpen, setLanguageOpen] = useState(false);
  // Optimistic value while a save is in flight; null = show the server's.
  const [pendingPush, setPendingPush] = useState<boolean | null>(null);
  // Only the latest tap's answer may land (two quick taps race otherwise).
  const latestTap = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [asking, setAsking] = useState(false);
  const [signingOut, setSigningOut] = useState<'here' | 'everywhere' | null>(null);

  const readPermission = useCallback(() => {
    getPushPermission()
      .then(setPermission)
      .catch(() => setPermission('unavailable'));
  }, []);

  // The rep may turn notifications on in the phone's Settings and come back.
  useEffect(() => {
    readPermission();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') readPermission();
    });
    return () => sub.remove();
  }, [readPermission]);

  const pushOn = pendingPush ?? profile?.notificationsEnabled ?? true;
  const state = pushState(pushOn, permission);
  const hero = heroCopy(t, state);

  /** Shows the OS prompt (only possible while undetermined) and registers this phone's token. */
  async function allowOnPhone() {
    if (asking) return;
    setAsking(true);
    try {
      await registerForPushNotifications();
    } catch {
      // The permission read below says where it landed.
    } finally {
      readPermission();
      setAsking(false);
    }
  }

  async function togglePush(next: boolean) {
    const tap = ++latestTap.current;
    const latest = () => latestTap.current === tap;
    setError(null);
    setPendingPush(next);
    try {
      // Show the saved value straight away, so the switch doesn't flick back before the refetch.
      const saved = await updateNotificationSettings({ notificationsEnabled: next });
      if (latest()) setProfile(saved);
      // Turning push on on a phone that hasn't been asked yet: ask now.
      if (next && permission === 'undetermined') await allowOnPhone();
    } catch (err) {
      if (latest()) setError(isNetworkError(err) ? t('common.needsConnection') : errorMessage(err));
    } finally {
      if (latest()) setPendingPush(null);
    }
  }

  async function handleSignOut(everywhere: boolean) {
    if (signingOut) return;
    setSigningOut(everywhere ? 'everywhere' : 'here');
    try {
      await signOut({ everywhere });
    } catch {
      // "Everywhere" not confirmed: the sign-in screen shows the warning.
    } finally {
      setSigningOut(null);
    }
  }

  // Same question as More's sign-out: one stray tap shouldn't drop the rep at the sign-in screen.
  function confirmSignOutHere() {
    if (signingOut) return;
    Alert.alert(t('more.signOutTitle'), t('more.signOutBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.signOut'), style: 'destructive', onPress: () => void handleSignOut(false) },
    ]);
  }

  // Signs out every phone on the account (this one too): confirmed first.
  function confirmSignOutEverywhere() {
    if (signingOut) return;
    Alert.alert(t('settings.signOutEverywhere.title'), t('settings.signOutEverywhere.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.signOutEverywhere.confirm'), style: 'destructive', onPress: () => void handleSignOut(true) },
    ]);
  }


  const phoneWarn = state === 'ask' || state === 'blocked';

  return (
    <ScrollView
      style={screenStyles.container}
      contentContainerStyle={[screenStyles.content, { paddingBottom }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      {stale || offline ? (
        <View style={styles.status}>
          <ThinProgress active={stale && !offline} />
          <OfflineBanner offline={offline} updatedAt={updatedAt} subject={t('settings.offlineSubject')} />
        </View>
      ) : null}
      {error ? <Banner message={error} /> : null}
      {/* Nothing saved and nothing loaded: say why the switch can't be used. */}
      {!profile && loadError ? <Banner message={loadError} /> : null}

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.bell} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name={pushOn ? 'notifications' : 'notifications-off'} size={22} color={colors.primaryText} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle} accessibilityRole="header">
              {hero.title}
            </Text>
            {hero.body ? <Text style={styles.heroBody}>{hero.body}</Text> : null}
          </View>
          <Switch
            value={pushOn}
            onValueChange={togglePush}
            disabled={!profile || pendingPush !== null}
            trackColor={{ true: colors.accent, false: colors.navyLine }}
            thumbColor={colors.surface}
            ios_backgroundColor={colors.navyLine}
            accessibilityLabel={t('settings.push')}
          />
        </View>

        {state === 'on' || phoneWarn ? (
          <View style={styles.heroFoot}>
            <View style={[styles.chip, phoneWarn && styles.chipWarn]}>
              <Ionicons
                name={phoneWarn ? 'alert-circle' : 'checkmark-circle'}
                size={14}
                color={phoneWarn ? colors.warning : colors.primaryText}
              />
              <Text style={[styles.chipText, phoneWarn && { color: colors.warning }]}>
                {state === 'ask' ? t('settings.phone.notYet') : state === 'blocked' ? t('settings.phone.blocked') : t('settings.phone.allowed')}
              </Text>
            </View>
            {state === 'ask' ? (
              <Button title={t('settings.allow')} icon="notifications-outline" onPress={allowOnPhone} loading={asking} style={styles.heroButton} />
            ) : null}
            {state === 'blocked' ? (
              <Button
                title={t('settings.openPhoneSettings')}
                icon="open-outline"
                onPress={() => Linking.openSettings().catch(() => {})}
                style={styles.heroButton}
              />
            ) : null}
          </View>
        ) : null}
      </View>

      <RowGroup title={pushOn ? t('settings.brings') : t('settings.brings.off')}>
        <PushBringsRows muted={!pushOn} />
      </RowGroup>
      <Text style={styles.note}>{t('settings.emailNote')}</Text>

      <RowGroup title={t('settings.app')}>
        <NavRow icon="language-outline" label={t('common.language.title')} value={languageSummary} onPress={() => setLanguageOpen(true)} last />
      </RowGroup>

      <RowGroup title={t('settings.signIn')}>
        <NavRow icon="key-outline" label={t('settings.changePassword')} onPress={() => router.push('/change-password')} />
        <NavRow
          icon="log-out-outline"
          label={signingOut === 'here' ? t('more.signingOut') : t('settings.signOutHere')}
          onPress={confirmSignOutHere}
          chevron={false}
        />
        <NavRow
          icon="phone-portrait-outline"
          label={signingOut === 'everywhere' ? t('more.signingOut') : t('settings.signOutEverywhere')}
          value={t('settings.signOutEverywhereHint')}
          onPress={confirmSignOutEverywhere}
          tone="danger"
          chevron={false}
          last
        />
      </RowGroup>

      <LanguagePicker visible={languageOpen} onClose={() => setLanguageOpen(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  status: { gap: spacing.sm, marginBottom: spacing.md },
  // The one question this screen answers, on the app's navy (as Home's next visit): solid, no shadow.
  hero: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.md + 4, marginBottom: spacing.lg },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm + 4 },
  bell: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.navyLine, alignItems: 'center', justifyContent: 'center' },
  heroText: { flex: 1, gap: 4 },
  heroTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: colors.primaryText },
  heroBody: { fontSize: 13, lineHeight: 18, color: colors.onNavyMuted },
  heroFoot: {
    gap: spacing.sm + 4,
    marginTop: spacing.md,
    paddingTop: spacing.sm + 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.navyLine,
    alignItems: 'flex-start',
  },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: colors.primary },
  chipWarn: { backgroundColor: colors.warningSoft },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.primaryText },
  heroButton: { alignSelf: 'stretch' },
  note: { ...type.secondary, marginTop: -spacing.md, marginBottom: spacing.lg, marginHorizontal: spacing.xs },
});
