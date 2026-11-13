import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Redirect, router } from 'expo-router';
import { ApiError } from '@/lib/api';
import { clearPendingTwoFactor, getPendingTwoFactor, PENDING_2FA_TTL_MS, useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { colors, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { Button } from '@/components/ui';
import { AuthHeader, AuthScreen, classifyAuthError, IconBadge, InlineError, OtpInput, StatusScreen } from '@/components/auth';

/** Seconds left to finish two-step sign-in, ticking once a second. */
function useSecondsLeft(startedAt: number | null): number {
  const left = () => (startedAt === null ? 0 : Math.max(0, Math.ceil((startedAt + PENDING_2FA_TTL_MS - Date.now()) / 1000)));
  const [seconds, setSeconds] = useState(left);
  useEffect(() => {
    if (startedAt === null) return;
    const timer = setInterval(() => setSeconds(left()), 1000);
    return () => clearInterval(timer);
    // `left` is rebuilt from `startedAt` on every render; the timer restarts only when that changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt]);
  return seconds;
}

/** Step two of sign-in for accounts with an authenticator app: the 6-digit code. */
export default function TwoStepScreen() {
  const auth = useAuth();
  const t = useT();
  const [pending] = useState(getPendingTwoFactor);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const inFlight = useRef(false);
  const secondsLeft = useSecondsLeft(pending?.startedAt ?? null);

  if (auth.signedIn) return <Redirect href="/enable-notifications" />;
  if (!pending) return <Redirect href="/login" />;

  function backToSignIn() {
    clearPendingTwoFactor();
    router.replace('/login');
  }

  if (expired || secondsLeft === 0) {
    return (
      <StatusScreen
        art={<IconBadge icon="time-outline" tone="slate" />}
        title={t('auth.twoStep.expiredTitle')}
        message={t('auth.twoStep.expired')}
        action={{ title: t('auth.backToSignIn'), onPress: backToSignIn }}
      />
    );
  }

  async function verify(value: string) {
    if (inFlight.current || value.length !== 6) return;
    inFlight.current = true;
    setVerifying(true);
    setError(null);
    try {
      await auth.verifyTwoFactor(value);
      // Signed in: the redirect above takes over.
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PENDING_2FA_EXPIRED') {
        setExpired(true);
        return;
      }
      if (err instanceof ApiError && err.status === 429) {
        setError(t('common.tooManyAttempts'));
      } else {
        const f = classifyAuthError(err);
        setError(f.kind === 'offline' ? t('common.network') : f.kind === 'maintenance' ? t('auth.maintenance.message') : f.message);
      }
      setCode('');
    } finally {
      inFlight.current = false;
      setVerifying(false);
    }
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  return (
    <AuthScreen back={backToSignIn}>
      <AuthHeader title={t('auth.twoStep.title')} subtitle={t('auth.twoStep.subtitle')} />
      <OtpInput
        value={code}
        error={!!error}
        onChange={(value) => {
          setCode(value);
          if (error) setError(null);
          if (value.length === 6) verify(value);
        }}
      />
      {error ? <InlineError message={error} style={styles.error} /> : null}
      <Button title={t('auth.twoStep.verify')} onPress={() => verify(code)} loading={verifying} disabled={code.length !== 6} />
      <Text
        style={[type.secondary, styles.timer]}
        accessibilityLabel={t('auth.twoStep.expiresInA11y', { minutes, seconds: secondsLeft % 60 })}
      >
        {t('auth.twoStep.expiresIn', { time: `${minutes}:${seconds}` })}
      </Text>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 14, textAlign: 'center', marginTop: -spacing.sm, marginBottom: spacing.sm },
  // Tabular figures on the normal face: monospace spreads a clock time ("4 : 59") on Android.
  timer: { textAlign: 'center', marginTop: spacing.md, fontVariant: ['tabular-nums'] },
});
