import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/lib/auth';
import { initI18n } from '@/lib/i18n';

// The native splash stays up until the language and the stored session are read, so no blank
// frame shows between it and the first screen.
SplashScreen.preventAutoHideAsync().catch(() => {});

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
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
