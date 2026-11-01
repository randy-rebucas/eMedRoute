import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { updateNotificationSettings, useRepProfile } from '@/lib/profile';
import { getPushPermission, PushPermission, registerForPushNotifications } from '@/lib/push';
import { colors, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { NavRow, RowGroup, SwitchRow } from '@/components/forms';
import { LanguagePicker, useLanguageSummary } from '@/components/LanguagePicker';
import { Banner, screenStyles, useBottomPadding } from '@/components/ui';

type Toggle = 'notificationsEnabled' | 'emailNotifications';

/** Push and email switches, language, password and sign-out. */
export default function SettingsScreen() {
  const t = useT();
  const { signOut } = useAuth();
  const { data: profile, setData: setProfile } = useRepProfile();
  const languageSummary = useLanguageSummary();
  const paddingBottom = useBottomPadding();
  const [languageOpen, setLanguageOpen] = useState(false);
  // Optimistic values while a save is in flight; null = show the server's.
  const [pending, setPending] = useState<Partial<Record<Toggle, boolean>>>({});
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<PushPermission | null>(null);
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

  const value = (key: Toggle) => pending[key] ?? profile?.[key] ?? true;

  async function toggle(key: Toggle, next: boolean) {
    setError(null);
    setPending((p) => ({ ...p, [key]: next }));
    try {
      // Show the saved value straight away, so the switch doesn't flick back before the refetch.
      setProfile(await updateNotificationSettings({ [key]: next }));
      // Turning push on on a phone that hasn't been asked yet: ask now, and register the token.
      if (key === 'notificationsEnabled' && next && permission === 'undetermined') {
        await registerForPushNotifications().catch(() => {});
        readPermission();
      }
    } catch (err) {
      setError(isNetworkError(err) ? t('common.needsConnection') : errorMessage(err));
    } finally {
      setPending((p) => {
        const { [key]: _done, ...rest } = p;
        return rest;
      });
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

  const pushOn = value('notificationsEnabled');

  return (
    <ScrollView style={screenStyles.container} contentContainerStyle={[screenStyles.content, { paddingBottom }]}>
      {error ? <Banner message={error} /> : null}

      <RowGroup title={t('settings.notifications')}>
        <SwitchRow
          label={t('settings.push')}
          hint={t('settings.pushHint')}
          value={pushOn}
          onValueChange={(next) => toggle('notificationsEnabled', next)}
          disabled={!profile || pending.notificationsEnabled !== undefined}
        >
          {pushOn && permission === 'denied' ? (
            <TouchableOpacity onPress={() => Linking.openSettings().catch(() => {})} accessibilityRole="button" style={styles.osLine}>
              <Text style={styles.osText}>
                {t('settings.pushBlocked')} <Text style={styles.osLink}>{t('settings.openPhoneSettings')}</Text>
              </Text>
            </TouchableOpacity>
          ) : null}
          {pushOn && permission === 'unavailable' ? <Text style={type.secondary}>{t('settings.pushUnavailable')}</Text> : null}
        </SwitchRow>
        <SwitchRow
          label={t('settings.email')}
          hint={t('settings.emailHint')}
          value={value('emailNotifications')}
          onValueChange={(next) => toggle('emailNotifications', next)}
          disabled={!profile || pending.emailNotifications !== undefined}
          last
        />
      </RowGroup>

      <RowGroup title={t('settings.app')}>
        <NavRow icon="language-outline" label={t('common.language.title')} value={languageSummary} onPress={() => setLanguageOpen(true)} last />
      </RowGroup>

      <RowGroup title={t('settings.signIn')}>
        <NavRow icon="key-outline" label={t('settings.changePassword')} onPress={() => router.push('/change-password')} />
        <NavRow
          icon="log-out-outline"
          label={signingOut === 'here' ? t('more.signingOut') : t('settings.signOutHere')}
          onPress={() => handleSignOut(false)}
          chevron={false}
        />
        <NavRow
          icon="phone-portrait-outline"
          label={signingOut === 'everywhere' ? t('more.signingOut') : t('settings.signOutEverywhere')}
          value={t('settings.signOutEverywhereHint')}
          onPress={() => handleSignOut(true)}
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
  osLine: { minHeight: 48, justifyContent: 'center' },
  osText: { fontSize: 13, lineHeight: 18, color: colors.warning },
  osLink: { fontWeight: '700', color: colors.primary },
});
