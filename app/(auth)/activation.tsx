import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import {
  activationCheckout,
  beginActivation,
  checkActivation,
  openActivationCheckout,
  takePendingCheckout,
} from '@/lib/onboarding';
import { ActivationPass, getActivationPass, setActivationPass } from '@/lib/storage';
import { colors, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { LoadingView } from '@/components/ui';
import { classifyAuthError, IconBadge, InlineError, StatusScreen } from '@/components/auth';

/** Check quickly at first (PayMongo usually confirms within seconds), then ease off. */
const FAST_POLL_MS = 4_000;
const SLOW_POLL_MS = 15_000;
const FAST_FOR_MS = 2 * 60_000;

/**
 * After "Pay activation fee": opens PayMongo's page, then waits for the payment to land and signs
 * the rep in. PayMongo's success page sends the browser back here (emedroute://activation),
 * which also relaunches the app if it was closed; the pass on disk carries on from there.
 */
export default function ActivationScreen() {
  const auth = useAuth();
  const t = useT();
  const [pass, setPass] = useState<ActivationPass | null | undefined>(undefined);
  const [expired, setExpired] = useState(false);
  const [slow, setSlow] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const checking = useRef(false);
  const browserOpen = useRef(false);

  const backToSignIn = useCallback(async () => {
    await setActivationPass(null);
    router.replace('/login');
  }, []);

  const describe = useCallback(
    (err: unknown) => {
      const f = classifyAuthError(err);
      if (f.kind === 'offline') return t('common.network');
      if (f.kind === 'maintenance') return t('auth.maintenance.message');
      return f.message;
    },
    [t]
  );

  /** One look at the payment; signs in when it has landed. */
  const check = useCallback(async () => {
    const current = await getActivationPass();
    if (!current) {
      setPass(null);
      return;
    }
    if (checking.current || browserOpen.current) return;
    checking.current = true;
    try {
      const result = await checkActivation(current.token);
      if (result.kind === 'pending') return;
      await setActivationPass(null);
      if (result.kind === 'twoFactor') {
        await auth.acceptSignIn(result);
        router.replace('/two-step');
      } else {
        // Signed in: the redirect below takes over.
        await auth.acceptSignIn({ kind: 'session', session: result.session });
      }
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'ACTIVATION_EXPIRED' || err.code === 'SIGN_IN_REQUIRED')) {
        await setActivationPass(null);
        setExpired(true);
        return;
      }
      // Offline or a server hiccup: keep waiting, the next look may get through.
    } finally {
      checking.current = false;
    }
  }, [auth]);

  const openCheckout = useCallback(
    async (url: string) => {
      browserOpen.current = true;
      try {
        await openActivationCheckout(url);
      } catch (err) {
        setError(describe(err));
      } finally {
        browserOpen.current = false;
      }
      check();
    },
    [check, describe]
  );

  /** A fresh checkout with the pass (a checkout link works once), then open it. */
  const payAgain = useCallback(async () => {
    const current = await getActivationPass();
    if (!current) {
      setPass(null);
      return;
    }
    setOpening(true);
    setError(null);
    try {
      const next = await activationCheckout({ activationToken: current.token });
      await beginActivation(next);
      setPass(await getActivationPass());
      await openCheckout(next.checkoutUrl);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ALREADY_ACTIVE') {
        check();
      } else if (err instanceof ApiError && err.code === 'ACTIVATION_EXPIRED') {
        await setActivationPass(null);
        setExpired(true);
      } else {
        setError(err instanceof ApiError && err.code === 'ACTIVATION_BY_TEAM' ? t('onboarding.pay.byTeam') : describe(err));
      }
    } finally {
      setOpening(false);
    }
  }, [check, describe, openCheckout, t]);

  // First appearance: load the pass, open the checkout the previous screen handed over, start looking.
  useEffect(() => {
    (async () => {
      const current = await getActivationPass();
      setPass(current);
      const url = takePendingCheckout();
      if (current && url) await openCheckout(url);
      else if (current) check();
    })();
  }, [check, openCheckout]);

  // Keep looking while this screen is shown, and at once when the app comes back to the front.
  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout>;
      const tick = () => {
        const fast = Date.now() - startedAt.current < FAST_FOR_MS;
        setSlow(!fast);
        timer = setTimeout(async () => {
          await check();
          tick();
        }, fast ? FAST_POLL_MS : SLOW_POLL_MS);
      };
      tick();
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') check();
      });
      return () => {
        clearTimeout(timer);
        sub.remove();
      };
    }, [check])
  );

  if (auth.signedIn) return <Redirect href="/enable-notifications" />;
  if (pass === undefined) return <LoadingView />;

  if (expired || pass === null) {
    return (
      <StatusScreen
        art={<IconBadge icon="time-outline" tone="slate" />}
        title={t('onboarding.activation.expiredTitle')}
        message={t('onboarding.activation.expired')}
        action={{ title: t('auth.backToSignIn'), onPress: backToSignIn }}
      />
    );
  }

  return (
    <StatusScreen
      art={<IconBadge icon="card-outline" />}
      title={t('onboarding.activation.title')}
      message={t('onboarding.activation.message')}
      action={{ title: t('onboarding.pay.button'), onPress: payAgain, loading: opening }}
      link={{ title: t('auth.backToSignIn'), onPress: backToSignIn }}
    >
      <View style={styles.checking} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.primary} />
        <Text style={type.secondary}>{slow ? t('onboarding.activation.slow') : t('onboarding.activation.checking')}</Text>
      </View>
      {error ? <InlineError message={error} style={styles.error} /> : null}
    </StatusScreen>
  );
}

const styles = StyleSheet.create({
  checking: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.md },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center', marginTop: spacing.md },
});
