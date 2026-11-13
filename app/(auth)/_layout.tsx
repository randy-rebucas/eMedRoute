import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

/** Signed-out screens (sign-in, two-step, sign-up) plus the notification step right after sign-in. */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="two-step" />
      {/* Back is handled in the screen: later steps ask before throwing the sign-up away. */}
      <Stack.Screen name="register" options={{ gestureEnabled: false }} />
      {/* Waits for the activation payment; PayMongo's page returns here (emedroute://activation). */}
      <Stack.Screen name="activation" options={{ gestureEnabled: false }} />
      <Stack.Screen name="enable-notifications" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
