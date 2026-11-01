import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { registerForPushNotifications, shouldAskForNotifications } from '@/lib/push';
import { colors, radius, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { Button, IconName, LoadingView } from '@/components/ui';
import { AuthHeader, AuthScreen, TextLink, useBlockHardwareBack } from '@/components/auth';
import { useT } from '@/lib/i18n';

const BENEFITS: { icon: IconName; key: 'auth.notify.answers' | 'auth.notify.visitDay' | 'auth.notify.reminders' | 'auth.notify.team' }[] = [
  { icon: 'checkmark-circle-outline', key: 'auth.notify.answers' },
  { icon: 'log-in-outline', key: 'auth.notify.visitDay' },
  { icon: 'alarm-outline', key: 'auth.notify.reminders' },
  { icon: 'people-outline', key: 'auth.notify.team' },
];

/**
 * Says what the rep will receive before the OS permission dialog. Every fresh sign-in passes
 * through here; it skips straight to Home once the OS has been asked.
 */
export default function EnableNotificationsScreen() {
  const { signedIn } = useAuth();
  const t = useT();
  const [needed, setNeeded] = useState<boolean | null>(null);
  const [asking, setAsking] = useState(false);
  // Back would reach the sign-in screen, which only redirects here again.
  useBlockHardwareBack();

  useEffect(() => {
    shouldAskForNotifications()
      .then(setNeeded)
      .catch(() => setNeeded(false));
  }, []);

  if (!signedIn) return <Redirect href="/login" />;
  if (needed === null) return <LoadingView />;
  if (!needed) return <Redirect href="/home" />;

  const done = () => router.replace('/home');

  async function allow() {
    setAsking(true);
    try {
      await registerForPushNotifications();
    } catch {
      // Registration failures aren't worth blocking the rep over; launch registers again.
    } finally {
      setAsking(false);
      done();
    }
  }

  return (
    <AuthScreen
      footer={
        <>
          <Button title={t('auth.notify.allow')} icon="notifications-outline" onPress={allow} loading={asking} />
          <TextLink title={t('auth.notify.notNow')} onPress={done} disabled={asking} style={styles.notNow} />
        </>
      }
    >
      <AuthHeader title={t('auth.notify.title')} subtitle={t('auth.notify.subtitle')} />
      <View style={styles.list}>
        {BENEFITS.map((b) => (
          <View key={b.key} style={styles.item}>
            <View style={styles.icon}>
              <Ionicons name={b.icon} size={22} color={colors.primaryOnSoft} />
            </View>
            <Text style={[type.body, styles.itemText]}>{t(b.key)}</Text>
          </View>
        ))}
      </View>
      <Text style={type.secondary}>{t('auth.notify.later')}</Text>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, marginBottom: spacing.lg },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { flex: 1 },
  notNow: { alignSelf: 'center' },
});
