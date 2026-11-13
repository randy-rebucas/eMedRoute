import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { colors } from '@/lib/theme';
import { useForegroundRefresh } from '@/lib/useForegroundRefresh';
import { NotificationResponder } from '@/components/NotificationResponder';
import { SnackbarHost } from '@/components/Snackbar';

/** Signed-in area: tabs plus pushed screens. Only for a signed-in session. */
export default function AppLayout() {
  const { signedIn, loading } = useAuth();
  const t = useT();
  useForegroundRefresh(signedIn);

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
        <Stack.Screen name="visits/[id]/index" options={{ title: t('visits.title.visit') }} />
        <Stack.Screen name="visits/[id]/edit" options={{ title: t('visits.title.edit') }} />
        <Stack.Screen name="visits/[id]/move" options={{ title: t('booking.moveTitle'), presentation: 'modal' }} />
        <Stack.Screen name="visits/[id]/deliver" options={{ title: t('deliveries.title.record'), presentation: 'modal' }} />
        <Stack.Screen name="clinics/[id]/book" options={{ title: t('booking.title'), presentation: 'modal' }} />
        <Stack.Screen name="visits/log" options={{ title: t('visits.title.new'), presentation: 'modal' }} />
        <Stack.Screen name="products/[id]/index" options={{ title: t('products.title.product') }} />
        <Stack.Screen name="products/[id]/edit" options={{ title: t('products.title.edit') }} />
        <Stack.Screen name="products/new" options={{ title: t('products.title.new'), presentation: 'modal' }} />
        <Stack.Screen name="products/import" options={{ title: t('products.import.title'), presentation: 'modal' }} />
        <Stack.Screen name="profile/index" options={{ title: t('more.profile') }} />
        <Stack.Screen name="profile/edit" options={{ title: t('profile.editTitle') }} />
        <Stack.Screen name="notifications" options={{ title: t('notifications.title') }} />
        <Stack.Screen name="settings" options={{ title: t('more.settings') }} />
        <Stack.Screen name="change-password" options={{ title: t('settings.changePassword') }} />
        <Stack.Screen name="plan" options={{ title: t('more.plan') }} />
        <Stack.Screen name="sponsorships" options={{ title: t('more.sponsorships') }} />
        <Stack.Screen name="referral" options={{ title: t('more.referral') }} />
        <Stack.Screen name="team/index" options={{ title: t('more.team') }} />
        <Stack.Screen name="team/visits" options={{ title: t('team.visitsTitle') }} />
        <Stack.Screen name="support/index" options={{ title: t('more.support') }} />
        <Stack.Screen name="support/new" options={{ title: t('support.newTitle'), presentation: 'modal' }} />
      </Stack>
      <SnackbarHost />
    </>
  );
}
