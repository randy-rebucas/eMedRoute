import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { colors } from '@/lib/theme';
import { NotificationResponder } from '@/components/NotificationResponder';

/** Signed-in area: tabs plus pushed screens. Only for a signed-in session. */
export default function AppLayout() {
  const { signedIn, loading } = useAuth();
  const t = useT();

  if (loading) return null;
  if (!signedIn) return <Redirect href="/" />;

  return (
    <>
      <NotificationResponder />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.primary,
          headerShadowVisible: false,
          headerBackTitle: t('common.back'),
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile/index" options={{ title: t('more.profile') }} />
        <Stack.Screen name="profile/edit" options={{ title: t('profile.editTitle') }} />
        <Stack.Screen name="settings" options={{ title: t('more.settings') }} />
        <Stack.Screen name="change-password" options={{ title: t('settings.changePassword') }} />
        <Stack.Screen name="support/index" options={{ title: t('more.support') }} />
        <Stack.Screen name="support/new" options={{ title: t('support.newTitle'), presentation: 'modal' }} />
      </Stack>
    </>
  );
}
