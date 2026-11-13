import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Ionicons } from '@expo/vector-icons';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PlainKey, useT } from '@/lib/i18n';
import { createSupportRequest, takeSupportDraft } from '@/lib/support';
import { colors, radius, spacing } from '@/lib/theme';
import { SUPPORT_CATEGORIES, SupportCategory } from '@/lib/types';
import { type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { Field } from '@/components/forms';
import { ChoiceChips } from '@/components/pickers';
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
 * A new support request. What the rep typed stays on screen until it is sent, and leaving with
 * unsent changes asks first. Plan and Team open it prefilled (openSupportDraft) to ask for a
 * payment link; an untouched prefill leaves without asking.
 */
export default function NewSupportRequestScreen() {
  const t = useT();
  const navigation = useNavigation();
  const { rep } = useAuth();
  const [prefill] = useState(takeSupportDraft);
  const [start] = useState(() => ({
    category: prefill?.category ?? ('general' as SupportCategory),
    subject: prefill?.subject ?? '',
    message: prefill?.message ?? '',
  }));
  const [category, setCategory] = useState<SupportCategory>(start.category);
  const [subject, setSubject] = useState(start.subject);
  const [message, setMessage] = useState(start.message);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const paddingBottom = useBottomPadding();
  const email = rep?.email ?? '';

  const changed = category !== start.category || subject !== start.subject || message !== start.message;
  const typed = !!(subject.trim() || message.trim());
  // Back or swipe-down shouldn't silently drop a typed request. Off once sent, and while sending.
  usePreventRemove(changed && typed && !reference && !sending, ({ data }) => {
    Alert.alert(t('support.discardTitle'), t('support.discardBody'), [
      { text: t('support.keepEditing'), style: 'cancel' },
      { text: t('support.discard'), style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const incomplete = !subject.trim() || !message.trim();

  async function send() {
    if (sending) return;
    setSubmitted(true);
    setError(null);
    if (incomplete) return;
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
        <View style={styles.sent}>
          <View style={styles.sentIcon}>
            <Ionicons name="checkmark" size={28} color={colors.primaryText} />
          </View>
          <Text style={type.cardTitle} accessibilityRole="header">
            {t('support.sentTitle')}
          </Text>
          <Text style={[type.body, styles.center]}>{t('support.sentBody', { email })}</Text>
          <Text style={[type.secondary, styles.nums]} selectable>
            {t('support.reference', { reference })}
          </Text>
        </View>
        <Button title={t('common.done')} onPress={() => router.back()} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={screenStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={96}>
      <ScrollView contentContainerStyle={[screenStyles.content, { paddingBottom }]} keyboardShouldPersistTaps="handled">
        <ChoiceChips
          label={t('support.categoryLabel')}
          options={SUPPORT_CATEGORIES.map((c) => ({ value: c, label: t(CATEGORY_LABEL[c]) }))}
          value={category}
          onChange={setCategory}
        />
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
          hint={t('support.replyTo', { email })}
        />
        {/* Next to Send, where the rep is looking: the top of a long message is off screen. */}
        {error ? <Banner message={error} /> : null}
        {submitted && incomplete ? (
          <Text style={[type.secondary, styles.fixAbove]} accessibilityLiveRegion="polite">
            {t('support.fixAbove')}
          </Text>
        ) : null}
        <Button title={t('support.send')} icon="send-outline" onPress={send} loading={sending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fixAbove: { color: colors.danger, marginBottom: spacing.sm },
  sent: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sentIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  nums: { fontVariant: ['tabular-nums'], textAlign: 'center' },
});
