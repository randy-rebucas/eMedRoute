import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PlainKey, useT } from '@/lib/i18n';
import { createSupportRequest, takeSupportDraft } from '@/lib/support';
import { colors, radius, spacing } from '@/lib/theme';
import { SUPPORT_CATEGORIES, SupportCategory } from '@/lib/types';
import { mono, type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { Field } from '@/components/forms';
import { Banner, Button, screenStyles, useBottomPadding } from '@/components/ui';

// Server limits (app/api/medical-representatives/support/route.ts).
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 5000;

const CATEGORY_LABEL: Record<SupportCategory, PlainKey> = {
  general: 'support.category.general',
  technical: 'support.category.technical',
  billing: 'support.category.billing',
  account: 'support.category.account',
  onboarding: 'support.category.onboarding',
  other: 'support.category.other',
};

/**
 * A new support request. What the rep typed stays on screen until it is sent. Plan and Team open
 * it prefilled (openSupportDraft) to ask for a payment link.
 */
export default function NewSupportRequestScreen() {
  const t = useT();
  const { rep } = useAuth();
  const [prefill] = useState(takeSupportDraft);
  const [category, setCategory] = useState<SupportCategory>(prefill?.category ?? 'general');
  const [subject, setSubject] = useState(prefill?.subject ?? '');
  const [message, setMessage] = useState(prefill?.message ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const paddingBottom = useBottomPadding();

  async function send() {
    if (sending) return;
    setSubmitted(true);
    setError(null);
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    try {
      setReference(await createSupportRequest({ subject: subject.trim(), message: message.trim(), category }));
    } catch (err) {
      setError(isNetworkError(err) ? t('common.needsConnection') : errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  if (reference) {
    return (
      <ScrollView style={screenStyles.container} contentContainerStyle={screenStyles.content}>
        <Text style={type.cardTitle} accessibilityRole="header">
          {t('support.sentTitle')}
        </Text>
        <Text style={[type.body, styles.sentBody]}>
          {t('support.sentBody', { email: rep?.email ?? '' })}
        </Text>
        <Text style={[type.secondary, mono]} selectable>
          {reference}
        </Text>
        <Button title={t('common.done')} onPress={() => router.back()} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={screenStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={96}>
      <ScrollView contentContainerStyle={[screenStyles.content, { paddingBottom }]} keyboardShouldPersistTaps="handled">
        {error ? <Banner message={error} /> : null}

        <Text style={[type.label, styles.label]}>{t('support.categoryLabel')}</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {SUPPORT_CATEGORIES.map((c) => {
            const selected = c === category;
            return (
              <TouchableOpacity
                key={c}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => setCategory(c)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{t(CATEGORY_LABEL[c])}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Field
          label={t('support.subject')}
          value={subject}
          onChangeText={setSubject}
          maxLength={MAX_SUBJECT}
          error={submitted && !subject.trim() ? t('support.subjectRequired') : null}
        />
        <Field
          label={t('support.message')}
          value={message}
          onChangeText={setMessage}
          maxLength={MAX_MESSAGE}
          multiline
          error={submitted && !message.trim() ? t('support.messageRequired') : null}
          hint={t('support.replyTo', { email: rep?.email ?? '' })}
        />
        <Button title={t('support.send')} icon="send-outline" onPress={send} loading={sending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 15, color: colors.text },
  chipTextSelected: { fontWeight: '600', color: colors.primaryOnSoft },
  sentBody: { marginVertical: spacing.sm },
});
