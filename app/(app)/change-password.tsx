import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { apiFetch, ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { spacing } from '@/lib/theme';
import { ChangePasswordResponse } from '@/lib/types';
import { type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { Field } from '@/components/forms';
import { Banner, Button, screenStyles, useBottomPadding } from '@/components/ui';

/** Server minimum (clinic-management lib/user-invite.ts PASSWORD_MIN_LENGTH). The rest of the policy is checked there. */
const MIN_LENGTH = 12;

/**
 * Change password. The server signs out every other device and returns a new token pair for
 * this one, which is stored before anything else happens.
 */
export default function ChangePasswordScreen() {
  const t = useT();
  const { applyRotatedTokens } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wrongCurrent, setWrongCurrent] = useState(false);
  const [done, setDone] = useState(false);
  const paddingBottom = useBottomPadding();

  const tooShort = [...next].length < MIN_LENGTH;
  const mismatch = next !== confirm;

  async function save() {
    if (saving) return;
    setSubmitted(true);
    setError(null);
    setWrongCurrent(false);
    if (!current || tooShort || mismatch) return;
    setSaving(true);
    try {
      const result = await apiFetch<ChangePasswordResponse>('/api/medical-representatives/change-password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      await applyRotatedTokens(result);
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
    } catch (err) {
      // 400, never 401: the session is fine, so this is not a sign-out.
      if (err instanceof ApiError && err.code === 'WRONG_CURRENT_PASSWORD') setWrongCurrent(true);
      else if (err instanceof ApiError && err.status === 429) setError(t('common.tooManyAttempts'));
      else setError(isNetworkError(err) ? t('common.needsConnection') : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <ScrollView style={screenStyles.container} contentContainerStyle={screenStyles.content}>
        <Banner tone="primary" message={t('password.changed')} />
        <Button title={t('common.done')} onPress={() => router.back()} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={screenStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={96}>
      <ScrollView contentContainerStyle={[screenStyles.content, { paddingBottom }]} keyboardShouldPersistTaps="handled">
        <Text style={[type.secondary, styles.intro]}>{t('password.intro')}</Text>
        {error ? <Banner message={error} /> : null}
        <Field
          label={t('password.current')}
          value={current}
          onChangeText={(v) => {
            setCurrent(v);
            setWrongCurrent(false);
          }}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          error={wrongCurrent ? t('password.wrongCurrent') : submitted && !current ? t('password.currentRequired') : null}
        />
        <Field
          label={t('password.new')}
          value={next}
          onChangeText={setNext}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          hint={t('password.rules', { min: MIN_LENGTH })}
          error={submitted && tooShort ? t('password.tooShort', { min: MIN_LENGTH }) : null}
        />
        <Field
          label={t('password.confirm')}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={save}
          error={submitted && !tooShort && mismatch ? t('password.mismatch') : null}
        />
        <Button title={t('password.save')} onPress={save} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: spacing.md },
});
