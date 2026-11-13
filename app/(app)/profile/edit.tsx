import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { updateProfile, useRepProfile } from '@/lib/profile';
import { spacing } from '@/lib/theme';
import { RepProfile } from '@/lib/types';
import { isNetworkError } from '@/lib/useApiData';
import { ErrorState } from '@/components/ErrorState';
import { Field } from '@/components/forms';
import { Banner, Button, LoadingView, screenStyles, useBottomPadding } from '@/components/ui';

// Server limits (app/api/medical-representatives/profile/route.ts).
const MAX = { firstName: 100, lastName: 100, phone: 30, company: 200, territory: 200, title: 20, bio: 2000 } as const;

type Form = Record<keyof typeof MAX, string>;

function formFrom(p: RepProfile): Form {
  return {
    firstName: p.firstName ?? '',
    lastName: p.lastName ?? '',
    phone: p.phone ?? '',
    company: p.company ?? '',
    territory: p.territory ?? '',
    title: p.title ?? '',
    bio: p.bio ?? '',
  };
}

/** Edit name, contact, company and bio. Email is the sign-in and can't change here. */
export default function EditProfileScreen() {
  const t = useT();
  const { setRepFromProfile } = useAuth();
  const { data: profile, loading, error, refresh } = useRepProfile();
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const paddingBottom = useBottomPadding();

  // Fill the form once, from the first profile that loads; later refetches never overwrite typing.
  useEffect(() => {
    if (profile && !form) setForm(formFrom(profile));
  }, [profile, form]);

  if (!form) {
    if (loading) return <LoadingView />;
    return <ErrorState message={error ?? t('common.failedToLoad')} onRetry={refresh} />;
  }

  const set = (key: keyof Form) => (value: string) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setSaveError(null);
  };

  // The server ignores blank required fields, so say so instead of saving nothing.
  const required: (keyof Form)[] = ['firstName', 'lastName', 'phone', 'company'];
  const blank = (key: keyof Form) => missing && !form[key].trim();

  async function save() {
    if (!form || saving) return;
    if (required.some((key) => !form[key].trim())) {
      setMissing(true);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await updateProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        company: form.company.trim(),
        territory: form.territory.trim(),
        title: form.title.trim(),
        bio: form.bio.trim(),
      });
      setRepFromProfile(saved);
      router.back();
    } catch (err) {
      setSaveError(isNetworkError(err) ? t('common.needsConnection') : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const requiredError = t('profile.required');

  return (
    <KeyboardAvoidingView style={screenStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={96}>
      <ScrollView contentContainerStyle={[screenStyles.content, { paddingBottom }]} keyboardShouldPersistTaps="handled">
        {saveError ? <Banner message={saveError} /> : null}
        <Field
          label={t('profile.title')}
          hint={t('profile.titleHint')}
          optional
          value={form.title}
          onChangeText={set('title')}
          maxLength={MAX.title}
          autoCapitalize="words"
        />
        <View style={styles.row}>
          <View style={styles.half}>
            <Field
              label={t('profile.firstName')}
              value={form.firstName}
              onChangeText={set('firstName')}
              maxLength={MAX.firstName}
              autoCapitalize="words"
              autoComplete="given-name"
              error={blank('firstName') ? requiredError : null}
            />
          </View>
          <View style={styles.half}>
            <Field
              label={t('profile.lastName')}
              value={form.lastName}
              onChangeText={set('lastName')}
              maxLength={MAX.lastName}
              autoCapitalize="words"
              autoComplete="family-name"
              error={blank('lastName') ? requiredError : null}
            />
          </View>
        </View>
        <Field
          label={t('profile.phone')}
          value={form.phone}
          onChangeText={set('phone')}
          maxLength={MAX.phone}
          keyboardType="phone-pad"
          autoComplete="tel"
          error={blank('phone') ? requiredError : null}
        />
        <Field
          label={t('profile.company')}
          value={form.company}
          onChangeText={set('company')}
          maxLength={MAX.company}
          error={blank('company') ? requiredError : null}
        />
        <Field
          label={t('profile.territory')}
          hint={t('profile.territoryHint')}
          optional
          value={form.territory}
          onChangeText={set('territory')}
          maxLength={MAX.territory}
        />
        <Field label={t('profile.bio')} optional value={form.bio} onChangeText={set('bio')} maxLength={MAX.bio} multiline />
        <Button title={t('common.save')} onPress={save} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  half: { flexGrow: 1, flexBasis: 140 },
});
