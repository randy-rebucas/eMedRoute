import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { takeReturnPath } from '@/lib/returnTo';
import { registerForPushNotifications, shouldAskForNotifications } from '@/lib/push';
import { spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { RowGroup } from '@/components/forms';
import { photos } from '@/components/Photo';
import { PushBringsRows } from '@/components/PushBrings';
import { Button, LoadingView } from '@/components/ui';
import { AuthBand, AuthScreen, TextLink, useBlockHardwareBack } from '@/components/auth';
import { useT } from '@/lib/i18n';

/**
 * Says what the rep will receive before the OS permission dialog: a photo band with the ask, then
 * the same list of what push carries as Settings (`PushBringsRows`). Every fresh sign-in passes
 * through here; it skips straight to Home once the OS has been asked.
 */
export default function EnableNotificationsScreen() {
  const { signedIn, rep } = useAuth();
  // Back to the screen a lost session left, when it was this rep's (lib/returnTo.ts).
  const [returnPath] = useState(() => takeReturnPath(rep?.id));
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
  if (!needed) return returnPath ? <ReturnTo path={returnPath} /> : <Redirect href="/home" />;

  // Home underneath, so Back from the returned-to screen still has somewhere to go.
  const done = () => {
    router.replace('/home');
    if (returnPath) router.push(returnPath as never);
  };

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
      <AuthBand source={photos.requestSent} title={t('auth.notify.title')} line={t('auth.notify.subtitle')} height={220} scrimTop={0.7} />
      <RowGroup title={t('settings.brings')}>
        <PushBringsRows />
      </RowGroup>
      <Text style={[type.secondary, styles.later]}>{t('auth.notify.later')}</Text>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  later: { marginTop: -spacing.sm },
  notNow: { alignSelf: 'center' },
});

/** Home, then the screen the expired session left. */
function ReturnTo({ path }: { path: string }) {
  useEffect(() => {
    router.replace('/home');
    router.push(path as never);
  }, [path]);
  return <LoadingView />;
}
