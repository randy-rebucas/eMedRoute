import { useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { ApiError } from '@/lib/api';
import { SignInResult, useAuth } from '@/lib/auth';
import { activationCheckout, beginActivation, looksLikeMobile } from '@/lib/onboarding';
import { useCooldown } from '@/lib/useCooldown';
import { useT } from '@/lib/i18n';
import { colors, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { photos } from '@/components/Photo';
import { Banner, Button } from '@/components/ui';
import {
  AuthBand,
  AuthHeader,
  AuthScreen,
  classifyAuthError,
  IconBadge,
  IconField,
  InlineError,
  MaintenanceScreen,
  OfflineScreen,
  OtpInput,
  StatusScreen,
  TextLink,
} from '@/components/auth';

export const SUPPORT_EMAIL = 'support@myclinicsoft.solutions';

type Failure =
  | { kind: 'offline' }
  | { kind: 'maintenance' }
  | { kind: 'setupRequired' }
  /** `activationToken`: from a code sign-in, which has no password to pay with. */
  | { kind: 'inactive'; note?: string; activationToken?: string }
  /** `from`: which half of the form it came from, so it shows next to that button (not off screen at the top). */
  | { kind: 'message'; message: string; from?: 'code' | 'password' };

/**
 * Sign-in. First choice: a code texted to the rep's verified mobile (numbers proven at sign-up).
 * Below it, email and password, for accounts made by a clinic or on the web, whose numbers were
 * never verified. Both lead to the same places (two-step, notifications, refusal screens).
 */
export default function LoginScreen() {
  const auth = useAuth();
  const t = useT();
  const [phone, setPhone] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Which button shows the spinner.
  const [busy, setBusy] = useState<'code' | 'password' | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [cooldown, startCooldown] = useCooldown();
  // Keyboard "Go", the button and the sixth digit can all fire before `submitting` re-renders.
  const inFlight = useRef(false);
  // What the offline / maintenance screens' "Try again" repeats.
  const lastAttempt = useRef<() => void>(() => {});

  // A fresh sign-in continues through the notification step (which skips itself if not needed).
  if (auth.signedIn) return <Redirect href="/enable-notifications" />;

  function clear() {
    setFailure(null);
    setInfo(null);
    auth.clearNotice();
  }

  /** One request at a time; refusals become a full screen or a banner. */
  async function attempt(
    which: 'code' | 'password',
    task: () => Promise<void>,
    retry: () => void,
    onRefusal?: (err: unknown) => boolean
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    lastAttempt.current = retry;
    clear();
    setBusy(which);
    setSubmitting(true);
    try {
      await task();
    } catch (err) {
      if (!onRefusal?.(err)) {
        const f = refusal(err);
        setFailure(f.kind === 'message' ? { ...f, from: which } : f);
      }
    } finally {
      inFlight.current = false;
      setBusy(null);
      setSubmitting(false);
    }
  }

  function afterSignIn(result: SignInResult) {
    // Signed in: the redirect above takes over. Two-step: the authenticator code is next.
    if (result.kind === 'twoFactor') {
      setPassword('');
      setCode('');
      router.push('/two-step');
    }
  }

  // ── Mobile code ──────────────────────────────────────────────────────────
  function sendCode() {
    if (!looksLikeMobile(phone)) {
      setFailure({ kind: 'message', message: t('auth.login.badPhone'), from: 'code' });
      return;
    }
    attempt('code', async () => {
      await auth.requestLoginCode(phone);
      setCode('');
      setCodeError(null);
      setCodeSent(true);
      startCooldown();
    }, sendCode);
  }

  function resendCode() {
    if (cooldown > 0) return;
    attempt(
      'code',
      async () => {
        await auth.requestLoginCode(phone);
        setCode('');
        setCodeError(null);
        startCooldown();
        setInfo(t('onboarding.code.resent'));
      },
      resendCode
    );
  }

  function verifyCode(value: string) {
    if (value.length !== 6) return;
    attempt(
      'code',
      async () => afterSignIn(await auth.loginWithCode(phone, value)),
      () => verifyCode(value),
      (err) => {
        if (!(err instanceof ApiError)) return false;
        if (err.code === 'CODE_INVALID' || err.code === 'CODE_EXPIRED' || err.code === 'CODE_LOCKED') {
          setCode('');
          setCodeError(err.message);
          return true;
        }
        if (err.code === 'MULTIPLE_ACCOUNTS') {
          // The code can't say which account: back to the form, pointing at email and password.
          setCodeSent(false);
          setCode('');
          setFailure({ kind: 'message', message: err.message, from: 'code' });
          return true;
        }
        return false;
      }
    );
  }

  function changeNumber() {
    if (submitting) return;
    setCodeSent(false);
    setCode('');
    setCodeError(null);
    clear();
  }

  // ── Email and password ───────────────────────────────────────────────────
  function signInWithPassword() {
    const id = email.trim();
    if (!id || !password) {
      setFailure({ kind: 'message', message: t('auth.login.missingFields'), from: 'password' });
      return;
    }
    attempt('password', async () => afterSignIn(await auth.loginWithPassword(id, password)), signInWithPassword);
  }

  /**
   * Signed-up-but-unpaid: a fresh activation checkout (with the pass from a code sign-in, or the
   * email and password typed here), then the /activation screen opens PayMongo's page, waits for
   * the payment and signs in. PayMongo's success page brings the browser back to the app.
   */
  async function payActivation() {
    if (inFlight.current || failure?.kind !== 'inactive') return;
    const token = failure.activationToken;
    if (!token && (!email.trim() || !password)) {
      setFailure({ ...failure, note: t('auth.inactive.usePassword') });
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    try {
      const checkout = await activationCheckout(token ? { activationToken: token } : { email, password });
      await beginActivation(checkout, checkout.checkoutUrl);
      setPassword('');
      setFailure(null);
      router.push('/activation');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ALREADY_ACTIVE') {
        inFlight.current = false;
        setSubmitting(false);
        if (password) signInWithPassword();
        else setFailure(null);
        return;
      }
      const note =
        err instanceof ApiError && err.code === 'ACTIVATION_BY_TEAM'
          ? t('onboarding.pay.byTeam')
          : err instanceof ApiError && err.code === 'ACTIVATION_EXPIRED'
            ? t('auth.inactive.usePassword')
            : err instanceof ApiError && err.code === 'NETWORK'
              ? t('common.network')
              : err instanceof Error
                ? err.message
                : t('common.somethingWrong');
      setFailure({ kind: 'inactive', note, activationToken: err instanceof ApiError && err.code === 'ACTIVATION_EXPIRED' ? undefined : token });
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  function refusal(err: unknown): Failure {
    if (err instanceof ApiError) {
      if (err.code === 'PASSWORD_SETUP_REQUIRED') return { kind: 'setupRequired' };
      if (err.code === 'MEDREP_INACTIVE') {
        const pass = (err.body as { activationToken?: unknown } | undefined)?.activationToken;
        return { kind: 'inactive', activationToken: typeof pass === 'string' ? pass : undefined };
      }
      if (err.status === 429) return { kind: 'message', message: err.message || t('common.tooManyAttempts') };
      // USER_INACTIVE, CODES_UNAVAILABLE and wrong email or password: the server's own words.
      if (err.code === 'CODES_UNAVAILABLE') return { kind: 'message', message: err.message };
    }
    const f = classifyAuthError(err);
    return f.kind === 'message' ? { kind: 'message', message: f.message } : f;
  }

  const retry = () => lastAttempt.current();
  if (failure?.kind === 'offline') return <OfflineScreen onRetry={retry} onBack={clear} retrying={submitting} />;
  if (failure?.kind === 'maintenance') return <MaintenanceScreen onRetry={retry} onBack={clear} retrying={submitting} />;
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
        action={{ title: t('onboarding.pay.button'), onPress: payActivation, loading: submitting }}
        link={{
          title: t('auth.inactive.support'),
          onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {}),
        }}
      >
        {failure.note ? <Text style={[type.secondary, styles.note]}>{failure.note}</Text> : null}
      </StatusScreen>
    );
  }

  const inlineError = failure?.kind === 'message' ? failure.message : null;
  const passwordError = failure?.kind === 'message' && failure.from === 'password' ? failure.message : null;
  const codeFormError = failure?.kind === 'message' && failure.from !== 'password' ? failure.message : null;

  // Step two of the code sign-in: the six digits.
  if (codeSent) {
    return (
      <AuthScreen back={changeNumber}>
        <AuthHeader title={t('auth.code.title')} subtitle={t('auth.code.subtitle', { phone: phone.trim() })} />
        {info ? <Banner message={info} tone="primary" /> : null}
        {inlineError ? <Banner message={inlineError} /> : null}
        <OtpInput
          value={code}
          error={!!codeError}
          onChange={(value) => {
            setCode(value);
            if (codeError) setCodeError(null);
            if (value.length === 6) verifyCode(value);
          }}
        />
        {codeError ? <InlineError message={codeError} style={styles.codeError} /> : null}
        <Button title={t('auth.code.signIn')} onPress={() => verifyCode(code)} loading={busy === 'code'} disabled={code.length !== 6} />
        <TextLink
          title={cooldown > 0 ? t('onboarding.code.resendIn', { seconds: cooldown }) : t('onboarding.code.resend')}
          onPress={resendCode}
          disabled={submitting || cooldown > 0}
          style={styles.centerLink}
        />
        <TextLink title={t('auth.code.changeNumber')} onPress={changeNumber} disabled={submitting} style={styles.centerLink} />
        <Text style={[type.secondary, styles.noText]}>{t('auth.code.noText')}</Text>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      {/* First impression: a rep with a doctor, the wordmark on the scrim's navy. */}
      <AuthBand source={photos.doctorMeeting} line={t('auth.band.login')} />
      <AuthHeader title={t('auth.login.title')} subtitle={t('auth.login.subtitle')} />

      {auth.notice ? <Banner message={auth.notice} tone="warning" /> : null}

      {/* First choice: a texted code. */}
      <IconField
        icon="call-outline"
        label={t('auth.login.phone')}
        value={phone}
        onChangeText={(v) => {
          setPhone(v);
          if (failure) clear();
        }}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        returnKeyType="go"
        onSubmitEditing={sendCode}
        maxLength={20}
      />
      <Text style={[type.secondary, styles.hint]}>{t('auth.login.phoneHint')}</Text>
      {codeFormError ? <Banner message={codeFormError} /> : null}
      <Button title={t('auth.login.sendCode')} icon="chatbubble-ellipses-outline" onPress={sendCode} loading={busy === 'code'} disabled={submitting} />

      <View style={styles.divider} accessibilityRole="text">
        <View style={styles.rule} />
        <Text style={[type.secondary, styles.dividerText]}>{t('auth.login.or')}</Text>
        <View style={styles.rule} />
      </View>

      {/* Then email and password. */}
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
        onSubmitEditing={signInWithPassword}
      />
      {passwordError ? <Banner message={passwordError} /> : null}
      <Button
        title={t('auth.login.signInPassword')}
        variant="secondary"
        onPress={signInWithPassword}
        loading={busy === 'password'}
        disabled={submitting}
      />

      <View style={styles.footer}>
        <Text style={type.secondary}>{t('auth.login.newRep')}</Text>
        <TextLink title={t('auth.login.register')} onPress={() => router.push('/register')} disabled={submitting} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  hint: { marginTop: -spacing.xs, marginBottom: spacing.md },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.lg },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { textAlign: 'center' },
  note: { textAlign: 'center', marginTop: spacing.md },
  codeError: { color: colors.danger, fontSize: 14, textAlign: 'center', marginTop: -spacing.sm, marginBottom: spacing.sm },
  centerLink: { alignSelf: 'center', marginTop: spacing.md },
  noText: { textAlign: 'center', marginTop: spacing.lg },
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: spacing.xl,
  },
});
