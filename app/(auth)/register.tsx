import { useCallback, useRef, useState } from 'react';
import { Alert, BackHandler, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/config';
import { formatMoney } from '@/lib/format';
import { useT } from '@/lib/i18n';
import {
  activationCheckout,
  beginActivation,
  CodeChannel,
  CompletedSignup,
  completeSignup,
  isSignupExpired,
  looksLikeMobile,
  resendSignupCode,
  SignupDetails,
  startSignup,
  verifySignupCode,
} from '@/lib/onboarding';
import { colors, spacing } from '@/lib/theme';
import { useCooldown } from '@/lib/useCooldown';
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
  OtpInput,
  StatusScreen,
  TextLink,
} from '@/components/auth';

/** Server minimum (clinic-management lib/user-invite.ts PASSWORD_MIN_LENGTH). The rest is checked there. */
const MIN_PASSWORD = 12;
const TOTAL_STEPS = 4;
const EMAIL_FORMAT = /^\S+@\S+\.\S+$/;

type Step = 'details' | 'email' | 'phone' | 'password' | 'done';
type Done = CompletedSignup;

const EMPTY: SignupDetails = { firstName: '', lastName: '', email: '', phone: '', company: '', territory: '' };

/**
 * Sign up as a medical rep: details → email code → mobile code → password → activation fee.
 * The signup id and password live only in this screen's memory; leaving starts over.
 */
export default function RegisterScreen() {
  const auth = useAuth();
  const t = useT();
  const [step, setStep] = useState<Step>('details');
  const [details, setDetails] = useState<SignupDetails>(EMPTY);
  const [signupId, setSignupId] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [phoneCodeSent, setPhoneCodeSent] = useState(true);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [cooldown, startCooldown] = useCooldown();
  // A keyboard "Go", the button and the sixth digit can all fire before `busy` re-renders.
  const inFlight = useRef(false);

  const describe = useCallback(
    (err: unknown): string => {
      if (err instanceof ApiError && err.status === 429) return err.message || t('common.tooManyAttempts');
      const f = classifyAuthError(err);
      if (f.kind === 'offline') return t('common.network');
      if (f.kind === 'maintenance') return err instanceof ApiError && err.message ? err.message : t('auth.maintenance.message');
      return f.message;
    },
    [t]
  );

  /** Run one request at a time, with the shared busy/error handling. */
  const run = useCallback(
    async (task: () => Promise<void>) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      setInfo(null);
      try {
        await task();
      } catch (err) {
        if (isSignupExpired(err)) {
          setSignupId(null);
          setCode('');
          setStep('details');
          setError(t('onboarding.expired'));
        } else {
          setError(describe(err));
        }
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [describe, t]
  );

  const confirmLeave = useCallback(() => {
    Alert.alert(t('onboarding.leaveTitle'), t('onboarding.leaveMessage'), [
      { text: t('onboarding.stay'), style: 'cancel' },
      { text: t('onboarding.leave'), style: 'destructive', onPress: () => router.back() },
    ]);
  }, [t]);

  /** Back inside the flow: the email step returns to the details; later steps ask before leaving. */
  const back = useCallback(() => {
    if (busy) return;
    if (step === 'email') {
      setCode('');
      setError(null);
      setStep('details');
    } else if (step === 'phone' || step === 'password') {
      confirmLeave();
    } else {
      router.back();
    }
  }, [busy, step, confirmLeave]);

  // Android back follows the same rules (the account exists on 'done', so back just leaves).
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        back();
        return true;
      });
      return () => sub.remove();
    }, [back])
  );

  if (auth.signedIn) return <Redirect href="/enable-notifications" />;

  const set = (key: keyof SignupDetails) => (value: string) => {
    setDetails((d) => ({ ...d, [key]: value }));
    if (error) setError(null);
  };

  // ── Step 1: details ────────────────────────────────────────────────────────
  function submitDetails() {
    setSubmitted(true);
    const d = details;
    if (!d.firstName.trim() || !d.lastName.trim() || !d.company.trim() || !d.email.trim() || !d.phone.trim()) {
      setError(t('onboarding.details.missing'));
      return;
    }
    if (!EMAIL_FORMAT.test(d.email.trim())) {
      setError(t('onboarding.details.badEmail'));
      return;
    }
    if (!looksLikeMobile(d.phone)) {
      setError(t('onboarding.details.badPhone'));
      return;
    }
    run(async () => {
      const result = await startSignup({
        firstName: d.firstName.trim(),
        lastName: d.lastName.trim(),
        company: d.company.trim(),
        territory: d.territory,
        email: d.email,
        phone: d.phone.trim(),
      });
      setSignupId(result.signupId);
      setCode('');
      setSubmitted(false);
      startCooldown();
      setStep('email');
    });
  }

  // ── Steps 2–3: codes ──────────────────────────────────────────────────────
  function verify(channel: CodeChannel, value: string) {
    if (!signupId || value.length !== 6) return;
    run(async () => {
      try {
        const result = await verifySignupCode(signupId, channel, value);
        setCode('');
        if (result.next === 'phone') {
          setMaskedPhone(result.phone ?? details.phone);
          setPhoneCodeSent(result.phoneCodeSent !== false);
          if (result.phoneCodeSent !== false) startCooldown();
          setStep('phone');
        } else {
          setSubmitted(false);
          setStep('password');
        }
      } catch (err) {
        setCode('');
        throw err;
      }
    });
  }

  function resend(channel: CodeChannel) {
    if (!signupId || cooldown > 0) return;
    run(async () => {
      await resendSignupCode(signupId, channel);
      setCode('');
      if (channel === 'phone') setPhoneCodeSent(true);
      startCooldown();
      setInfo(t('onboarding.code.resent'));
    });
  }

  // ── Step 4: password ──────────────────────────────────────────────────────
  const tooShort = password.length < MIN_PASSWORD;
  const mismatch = password !== confirm;

  function createAccount() {
    setSubmitted(true);
    if (!signupId || tooShort || mismatch) return;
    run(async () => {
      const result = await completeSignup(signupId, password);
      setSignupId(null);
      setDone(result);
      setStep('done');
      if (result.activation === 'payment' && result.activationToken && result.activationExpiresAt) {
        // /activation opens PayMongo's page, waits for the payment and signs in.
        await beginActivation(
          { activationToken: result.activationToken, activationExpiresAt: result.activationExpiresAt },
          result.checkoutUrl
        );
        router.replace('/activation');
      }
    });
  }

  // ── Done without a checkout (it couldn't be made): make one, then the same /activation screen ──
  function pay() {
    if (!done) return;
    run(async () => {
      try {
        const checkout = await activationCheckout({ email: details.email, password });
        await beginActivation(checkout, checkout.checkoutUrl);
        router.replace('/activation');
      } catch (err) {
        if (err instanceof ApiError && err.code === 'ACTIVATION_BY_TEAM') {
          setDone((d) => (d ? { ...d, activation: 'review' } : d));
          return;
        }
        if (err instanceof ApiError && err.code === 'ALREADY_ACTIVE') {
          // Paid already: sign in. With an authenticator on the account, its code is next.
          const result = await auth.loginWithPassword(details.email.trim(), password);
          if (result.kind === 'twoFactor') router.push('/two-step');
          return;
        }
        throw err;
      }
    });
  }

  if (step === 'done' && done) {
    if (done.activation === 'review') {
      return (
        <StatusScreen
          art={<IconBadge icon="checkmark-done-outline" />}
          title={t('onboarding.review.title')}
          message={t('onboarding.review.message', { reference: done.reference })}
          action={{ title: t('auth.backToSignIn'), onPress: () => router.replace('/login') }}
        />
      );
    }
    const fee = done.fee ? formatMoney(done.fee) : null;
    return (
      <StatusScreen
        art={<IconBadge icon="card-outline" />}
        title={t('onboarding.pay.title')}
        message={
          fee
            ? t('onboarding.pay.message', { fee, reference: done.reference })
            : t('onboarding.pay.messageNoFee', { reference: done.reference })
        }
        action={{ title: t('onboarding.pay.button'), onPress: pay, loading: busy }}
      >
        {error ? <InlineError message={error} style={styles.statusError} /> : null}
      </StatusScreen>
    );
  }

  const stepNumber = step === 'details' ? 1 : step === 'email' ? 2 : step === 'phone' ? 3 : 4;
  const stepLabel = t('onboarding.step', { current: stepNumber, total: TOTAL_STEPS });

  if (step === 'email' || step === 'phone') {
    const channel: CodeChannel = step;
    return (
      <AuthScreen back={back}>
        <Text style={[type.secondary, styles.step]}>{stepLabel}</Text>
        <AuthHeader
          title={t(step === 'email' ? 'onboarding.email.title' : 'onboarding.phone.title')}
          subtitle={
            step === 'email'
              ? t('onboarding.email.subtitle', { email: details.email.trim().toLowerCase() })
              : t('onboarding.phone.subtitle', { phone: maskedPhone })
          }
        />
        {step === 'phone' && !phoneCodeSent ? <Banner message={t('onboarding.phone.notSent')} tone="warning" /> : null}
        {info ? <Banner message={info} tone="primary" /> : null}
        <OtpInput
          key={step}
          value={code}
          error={!!error}
          onChange={(value) => {
            setCode(value);
            if (error) setError(null);
            if (value.length === 6) verify(channel, value);
          }}
        />
        {error ? <InlineError message={error} style={styles.error} /> : null}
        <Button title={t('onboarding.code.verify')} onPress={() => verify(channel, code)} loading={busy} disabled={code.length !== 6} />
        <TextLink
          title={cooldown > 0 ? t('onboarding.code.resendIn', { seconds: cooldown }) : t('onboarding.code.resend')}
          onPress={() => resend(channel)}
          disabled={busy || cooldown > 0}
          style={styles.centerLink}
        />
        {step === 'email' ? <TextLink title={t('onboarding.email.edit')} onPress={back} disabled={busy} style={styles.centerLink} /> : null}
      </AuthScreen>
    );
  }

  if (step === 'password') {
    return (
      <AuthScreen back={back}>
        <Text style={[type.secondary, styles.step]}>{stepLabel}</Text>
        <AuthHeader
          title={t('onboarding.password.title')}
          subtitle={t('onboarding.password.subtitle', { email: details.email.trim().toLowerCase() })}
        />
        {error ? <Banner message={error} /> : null}
        <IconField
          icon="lock-closed-outline"
          label={t('onboarding.password.new')}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (error) setError(null);
          }}
          error={submitted && tooShort}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
        />
        <IconField
          icon="lock-closed-outline"
          label={t('onboarding.password.confirm')}
          value={confirm}
          onChangeText={(v) => {
            setConfirm(v);
            if (error) setError(null);
          }}
          error={submitted && !tooShort && mismatch}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={createAccount}
        />
        <Text style={[type.secondary, submitted && (tooShort || mismatch) ? styles.hintError : null, styles.hint]}>
          {submitted && tooShort
            ? t('onboarding.password.tooShort', { min: MIN_PASSWORD })
            : submitted && mismatch
              ? t('onboarding.password.mismatch')
              : t('onboarding.password.rules', { min: MIN_PASSWORD })}
        </Text>
        <Button title={t('onboarding.password.create')} onPress={createAccount} loading={busy} />
      </AuthScreen>
    );
  }

  // Details
  const missing = (value: string | undefined) => submitted && !value?.trim();
  return (
    <AuthScreen
      back={back}
      footer={
        <View style={styles.footer}>
          <Text style={type.secondary}>{t('onboarding.details.haveAccount')}</Text>
          <TextLink title={t('onboarding.details.signIn')} onPress={() => router.back()} disabled={busy} />
        </View>
      }
    >
      <AuthBand source={photos.onTheRoad} line={t('auth.band.register')} height={160} />
      <Text style={[type.secondary, styles.step]}>{stepLabel}</Text>
      <AuthHeader title={t('onboarding.details.title')} subtitle={t('onboarding.details.subtitle')} />

      <View style={styles.row}>
        <View style={styles.half}>
          <IconField
            icon="person-outline"
            label={t('onboarding.details.firstName')}
            value={details.firstName}
            onChangeText={set('firstName')}
            error={missing(details.firstName)}
            autoComplete="given-name"
            textContentType="givenName"
            autoCapitalize="words"
            maxLength={100}
          />
        </View>
        <View style={styles.half}>
          <IconField
            icon="person-outline"
            label={t('onboarding.details.lastName')}
            value={details.lastName}
            onChangeText={set('lastName')}
            error={missing(details.lastName)}
            autoComplete="family-name"
            textContentType="familyName"
            autoCapitalize="words"
            maxLength={100}
          />
        </View>
      </View>
      <IconField
        icon="business-outline"
        label={t('onboarding.details.company')}
        value={details.company}
        onChangeText={set('company')}
        error={missing(details.company)}
        autoComplete="organization"
        textContentType="organizationName"
        autoCapitalize="words"
        maxLength={200}
      />
      <IconField
        icon="map-outline"
        label={t('onboarding.details.territory')}
        value={details.territory}
        onChangeText={set('territory')}
        autoCapitalize="words"
        maxLength={200}
      />
      <IconField
        icon="mail-outline"
        label={t('onboarding.details.email')}
        value={details.email}
        onChangeText={set('email')}
        error={missing(details.email)}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        maxLength={254}
      />
      <IconField
        icon="call-outline"
        label={t('onboarding.details.phone')}
        value={details.phone}
        onChangeText={set('phone')}
        error={missing(details.phone)}
        autoComplete="tel"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        returnKeyType="go"
        onSubmitEditing={submitDetails}
        maxLength={20}
      />
      <Text style={[type.secondary, styles.hint]}>{t('onboarding.details.phoneHint')}</Text>

      <Text style={[type.secondary, styles.agree]}>
        {t('onboarding.details.agree')}{' '}
        <Text style={styles.inlineLink} accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(`${API_BASE_URL}/terms`).catch(() => {})}>
          {t('onboarding.details.terms')}
        </Text>{' '}
        {t('onboarding.details.and')}{' '}
        <Text style={styles.inlineLink} accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(`${API_BASE_URL}/privacy`).catch(() => {})}>
          {t('onboarding.details.privacy')}
        </Text>
        .
      </Text>
      {/* Beside the button, not at the top: the form is long, and an "email in use" from the server lands here. */}
      {error ? <Banner message={error} /> : null}
      <Button title={t('onboarding.details.continue')} onPress={submitDetails} loading={busy} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  step: { marginBottom: spacing.xs, color: colors.primary, fontWeight: '600' },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  hint: { marginTop: -spacing.xs, marginBottom: spacing.md },
  hintError: { color: colors.danger },
  agree: { marginBottom: spacing.md, lineHeight: 20 },
  inlineLink: { color: colors.primary, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center', marginTop: -spacing.sm, marginBottom: spacing.sm },
  statusError: { color: colors.danger, fontSize: 14, textAlign: 'center', marginTop: spacing.md },
  centerLink: { alignSelf: 'center', marginTop: spacing.md },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
});
