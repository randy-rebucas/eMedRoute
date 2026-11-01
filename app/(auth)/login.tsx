import { useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/config';
import { useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { BrandLogo, BrandMark } from '@/components/BrandLogo';
import { Banner, Button } from '@/components/ui';
import {
  AuthHeader,
  AuthScreen,
  classifyAuthError,
  IconBadge,
  IconField,
  MaintenanceScreen,
  OfflineScreen,
  StatusScreen,
  TextLink,
} from '@/components/auth';

export const SUPPORT_EMAIL = 'support@myclinicsoft.solutions';
/** Registration needs payment, so it stays on the web (MOBILE_API.md → Push, last paragraph). */
const REGISTER_PATH = '/medical-representatives/onboard';

type Failure =
  | { kind: 'offline' }
  | { kind: 'maintenance' }
  | { kind: 'setupRequired' }
  | { kind: 'inactive' }
  | { kind: 'message'; message: string };

export default function LoginScreen() {
  const auth = useAuth();
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  // Keyboard "Go" and the button can both fire before `submitting` re-renders.
  const inFlight = useRef(false);

  // A fresh sign-in continues through the notification step (which skips itself if not needed).
  if (auth.signedIn) return <Redirect href="/enable-notifications" />;

  function clear() {
    setFailure(null);
    auth.clearNotice();
  }

  async function submit() {
    if (inFlight.current) return;
    const id = email.trim();
    if (!id || !password) {
      setFailure({ kind: 'message', message: t('auth.login.missingFields') });
      return;
    }
    inFlight.current = true;
    clear();
    setSubmitting(true);
    try {
      const result = await auth.loginWithPassword(id, password);
      if (result.kind === 'twoFactor') {
        setPassword('');
        router.push('/two-step');
      }
    } catch (err) {
      setFailure(refusal(err));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  function refusal(err: unknown): Failure {
    if (err instanceof ApiError) {
      if (err.code === 'PASSWORD_SETUP_REQUIRED') return { kind: 'setupRequired' };
      if (err.code === 'MEDREP_INACTIVE') return { kind: 'inactive' };
      if (err.status === 429) return { kind: 'message', message: t('common.tooManyAttempts') };
      // USER_INACTIVE and wrong email or password: the server's own words.
    }
    const f = classifyAuthError(err);
    return f.kind === 'message' ? { kind: 'message', message: f.message } : f;
  }

  if (failure?.kind === 'offline') return <OfflineScreen onRetry={submit} onBack={clear} retrying={submitting} />;
  if (failure?.kind === 'maintenance') return <MaintenanceScreen onRetry={submit} onBack={clear} retrying={submitting} />;
  if (failure?.kind === 'setupRequired') {
    return (
      <StatusScreen
        onBack={clear}
        art={<IconBadge icon="mail-unread-outline" />}
        title={t('auth.setup.title')}
        message={t('auth.setup.message')}
        action={{ title: t('auth.backToSignIn'), onPress: clear }}
      />
    );
  }
  if (failure?.kind === 'inactive') {
    return (
      <StatusScreen
        onBack={clear}
        art={<IconBadge icon="hourglass-outline" tone="slate" />}
        title={t('auth.inactive.title')}
        message={t('auth.inactive.message')}
        action={{ title: t('auth.backToSignIn'), onPress: clear }}
        link={{
          title: t('auth.inactive.support'),
          onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {}),
        }}
      />
    );
  }

  const inlineError = failure?.kind === 'message' ? failure.message : null;

  return (
    <AuthScreen>
      <View style={styles.logo}>
        {/* The app icon's look (the mark on navy), so the sign-in screen matches what was tapped. */}
        <View style={styles.iconTile}>
          <BrandMark size={52} />
        </View>
        <BrandLogo />
      </View>
      <AuthHeader title={t('auth.login.title')} subtitle={t('auth.login.subtitle')} align="center" />

      {auth.notice ? <Banner message={auth.notice} tone="warning" /> : null}
      {inlineError ? <Banner message={inlineError} /> : null}

      <IconField
        icon="mail-outline"
        label={t('auth.login.email')}
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (failure) clear();
        }}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
        returnKeyType="next"
      />
      <IconField
        icon="lock-closed-outline"
        label={t('auth.login.password')}
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          if (failure) clear();
        }}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button title={t('auth.login.signIn')} onPress={submit} loading={submitting} />

      <View style={styles.footer}>
        <Text style={type.secondary}>{t('auth.login.newRep')}</Text>
        <TextLink
          title={t('auth.login.register')}
          onPress={() => WebBrowser.openBrowserAsync(`${API_BASE_URL}${REGISTER_PATH}`).catch(() => {})}
          disabled={submitting}
        />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  logo: { marginTop: spacing.lg, marginBottom: spacing.xl, alignItems: 'center', gap: spacing.md },
  iconTile: { width: 88, height: 88, borderRadius: radius.lg + 6, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: spacing.xl,
  },
});
