import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Stack, usePathname, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/lib/auth';
import { initI18n, useT } from '@/lib/i18n';
import { IconBadge, StatusScreen } from '@/components/auth';
import { UpdateGate } from '@/components/UpdateGate';
import { installCrashHandler, reportCrash, setCrashScreen } from '@/lib/crashReport';
import { colors, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';

// The native splash stays up until the language and the stored session are read, so no blank
// frame shows between it and the first screen.
SplashScreen.preventAutoHideAsync().catch(() => {});
installCrashHandler();

/** Keeps crash reports pointed at the screen the rep is on. */
function TrackCrashScreen() {
  const pathname = usePathname();
  useEffect(() => {
    setCrashScreen(pathname);
  }, [pathname]);
  return null;
}

function HideSplashWhenReady() {
  const { loading } = useAuth();
  useEffect(() => {
    if (!loading) SplashScreen.hide();
  }, [loading]);
  return null;
}

export default function RootLayout() {
  // The saved language is read before the first screen, so nothing flashes in the wrong language.
  const [languageReady, setLanguageReady] = useState(false);
  useEffect(() => {
    initI18n().finally(() => setLanguageReady(true));
  }, []);

  if (!languageReady) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <HideSplashWhenReady />
        <TrackCrashScreen />
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
        <UpdateGate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/**
 * Whole-app fallback when a screen throws while rendering: a calm message and Try again, never a
 * red screen or a blank app. The error text shows in development only.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const t = useT();
  useEffect(() => {
    // The throw may come before the first screen: the splash must not hide this.
    SplashScreen.hide();
    console.error('[ErrorBoundary]', error);
    reportCrash(error);
  }, [error]);
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <StatusScreen
        art={<IconBadge icon="alert-circle-outline" tone="slate" />}
        title={t('common.crash.title')}
        message={t('common.crash.body')}
        action={{ title: t('common.tryAgainTitle'), onPress: () => retry().catch(() => {}) }}
      >
        {__DEV__ ? <Text style={styles.devError}>{String(error?.message ?? error)}</Text> : null}
      </StatusScreen>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  devError: { ...type.secondary, color: colors.danger, textAlign: 'center', marginTop: spacing.md },
});
