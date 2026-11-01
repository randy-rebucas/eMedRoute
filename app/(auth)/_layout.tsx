import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

/** Signed-out screens plus the notification step right after sign-in. */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="two-step" />
      <Stack.Screen name="enable-notifications" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
