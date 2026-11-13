import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Ionicons } from '@expo/vector-icons';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { updateProfile, useRepProfile } from '@/lib/profile';
import { colors, radius, spacing } from '@/lib/theme';
import { RepProfile } from '@/lib/types';
import { type } from '@/lib/typography';
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

const REQUIRED: (keyof Form)[] = ['firstName', 'lastName', 'phone', 'company'];

/**
 * Edit name, contact, work and bio. Email is the sign-in and can't change here (shown locked).
 * Starts from the server's copy, never the phone's saved one: the save sends every field, so a
 * stale copy would undo changes made since. Warns before a verified number is replaced (the
 * server then stops texting sign-in codes), and before typed changes are dropped.
 */
export default function EditProfileScreen() {
  const t = useT();
  const navigation = useNavigation();
  const { setRepFromProfile } = useAuth();
  const { data: profile, loading, error, offline, stale, refresh } = useRepProfile();
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const paddingBottom = useBottomPadding();

  // Fill the form once, from the server's copy; later refetches never overwrite typing.
  useEffect(() => {
    if (profile && !stale && !form) setForm(formFrom(profile));
  }, [profile, stale, form]);

  const start = profile ? formFrom(profile) : null;
  const dirty = !!form && !!start && (Object.keys(form) as (keyof Form)[]).some((k) => form[k] !== start[k]);
  // Off while saving: a successful save leaves the screen on its own.
  usePreventRemove(dirty && !saving, ({ data }) => {
    Alert.alert(t('profile.edit.discardTitle'), t('profile.edit.discardBody'), [
      { text: t('profile.edit.keepEditing'), style: 'cancel' },
      { text: t('profile.edit.discard'), style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  if (!form || !profile) {
    if (loading || (stale && !offline && !error)) return <LoadingView />;
    return <ErrorState message={offline ? t('common.editNeedsConnection') : (error ?? t('common.failedToLoad'))} onRetry={refresh} />;
  }

  const set = (key: keyof Form) => (value: string) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setSaveError(null);
  };

  // The server ignores blank required fields, so say so instead of saving nothing.
  const incomplete = REQUIRED.some((key) => !form[key].trim());
  const blank = (key: keyof Form) => (submitted && !form[key].trim() ? t('profile.required') : null);
  const verified = !!profile.phoneVerifiedAt;
  const phoneChanged = form.phone.trim() !== (profile.phone ?? '').trim();

  async function save() {
    if (!form || saving) return;
    setSubmitted(true);
    if (incomplete) return;
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

  return (
    <KeyboardAvoidingView style={screenStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={96}>
      <ScrollView contentContainerStyle={[screenStyles.content, { paddingBottom }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.section} accessibilityRole="header">
          {t('profile.edit.name')}
        </Text>
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
              error={blank('firstName')}
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
              error={blank('lastName')}
            />
          </View>
        </View>

        <Text style={styles.section} accessibilityRole="header">
          {t('profile.edit.contact')}
        </Text>
        <Field
          label={t('profile.phone')}
          value={form.phone}
          onChangeText={set('phone')}
          maxLength={MAX.phone}
          keyboardType="phone-pad"
          autoComplete="tel"
          error={blank('phone')}
          hint={verified && !phoneChanged ? t('profile.edit.phoneVerified') : undefined}
        />
        {verified && phoneChanged ? (
          <View style={styles.warn} accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle" size={16} color={colors.warning} />
            <Text style={styles.warnText}>{t('profile.edit.phoneChanged')}</Text>
          </View>
        ) : null}
        {/* Email is the sign-in: shown so the rep stops looking for it, locked with the reason. */}
        <View style={styles.locked}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
          <View style={styles.lockedText}>
            <Text style={type.label}>{t('profile.email')}</Text>
            <Text style={type.body} selectable>
              {profile.email}
            </Text>
            <Text style={type.secondary}>{t('profile.emailNote')}</Text>
          </View>
        </View>

        <Text style={styles.section} accessibilityRole="header">
          {t('profile.edit.work')}
        </Text>
        <Field label={t('profile.company')} value={form.company} onChangeText={set('company')} maxLength={MAX.company} error={blank('company')} />
        <Field
          label={t('profile.territory')}
          hint={t('profile.territoryHint')}
          optional
          value={form.territory}
          onChangeText={set('territory')}
          maxLength={MAX.territory}
        />
        <Field label={t('profile.bio')} optional value={form.bio} onChangeText={set('bio')} maxLength={MAX.bio} multiline />

        {/* Next to Save, where the rep is looking: the top of the form is off screen by now. */}
        {saveError ? <Banner message={saveError} /> : null}
        {submitted && incomplete ? (
          <Text style={[type.secondary, styles.fixAbove]} accessibilityLiveRegion="polite">
            {t('profile.edit.fixAbove')}
          </Text>
        ) : null}
        <Button title={t('common.save')} onPress={save} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  section: { ...type.secondary, fontWeight: '600', marginBottom: spacing.sm, marginTop: spacing.sm, marginLeft: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  half: { flexGrow: 1, flexBasis: 140 },
  warn: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    padding: spacing.sm + 4,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
  },
  warnText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.warning },
  locked: {
    flexDirection: 'row',
    gap: spacing.sm + 4,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  lockedText: { flex: 1, gap: 2 },
  fixAbove: { color: colors.danger, marginBottom: spacing.sm },
});
