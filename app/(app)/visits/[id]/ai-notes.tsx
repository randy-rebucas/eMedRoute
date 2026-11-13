import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { errorMessage } from '@/lib/api';
import { draftVisitNote, isAllowanceUsedUp, MAX_AI_NOTE_INPUT, useAiStatus } from '@/lib/ai';
import { formatDay } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { AiVisitNote } from '@/lib/types';
import { type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { saveVisitNotes, useVisit } from '@/lib/visits';
import { ErrorState } from '@/components/ErrorState';
import { Banner, Button, LoadingView, screenStyles, useBottomPadding } from '@/components/ui';

/** The visit's notes field holds this much (the server's limit). */
const MAX_NOTES = 2000;

/**
 * Draft a visit's notes with AI: the rep says or types how it went (the keyboard's mic does the
 * speech, so no recording leaves the phone), the server drafts tidy notes, and the rep edits them
 * before saving like any notes. A draft is added below notes already written, never over them.
 */
export default function AiNotesScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: visit, loading, error, refresh } = useVisit(id);
  const { data: ai } = useAiStatus();
  const paddingBottom = useBottomPadding();
  const [text, setText] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<AiVisitNote | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [usedUp, setUsedUp] = useState<string | null>(null);

  if (!visit) {
    if (loading) return <LoadingView />;
    return <ErrorState message={error ?? t('common.failedToLoad')} onRetry={refresh} />;
  }
  const existing = visit.notes?.trim() ?? '';
  const outOfActions = !!ai && ai.remaining === 0;

  async function makeDraft() {
    if (!visit || drafting) return;
    setDrafting(true);
    setProblem(null);
    try {
      const result = await draftVisitNote(visit._id, text.trim());
      setDraft(result);
      setNotes((existing ? `${existing}\n\n${result.notes}` : result.notes).slice(0, MAX_NOTES));
    } catch (err) {
      if (isAllowanceUsedUp(err)) setUsedUp(err.message);
      else setProblem(isNetworkError(err) ? t('common.needsConnection') : errorMessage(err));
    } finally {
      setDrafting(false);
    }
  }

  async function save() {
    if (!visit || saving) return;
    setSaving(true);
    setProblem(null);
    try {
      await saveVisitNotes(visit, notes.trim());
      router.back();
    } catch (err) {
      setProblem(isNetworkError(err) ? t('common.needsConnection') : errorMessage(err));
      setSaving(false);
    }
  }

  const usedUpBlock =
    usedUp || (outOfActions && !draft) ? (
      <View style={styles.usedUp}>
        <Text style={type.cardTitle}>{t('ai.usedUpTitle')}</Text>
        <Text style={type.body}>{usedUp ?? t('ai.resetsOn', { date: formatDay(ai!.resetsOn, { month: 'long', day: 'numeric' }) })}</Text>
        {ai?.plan === 'standard' && ai.proMonthly > 0 ? (
          <Button title={t('ai.seePro')} icon="sparkles-outline" variant="secondary" onPress={() => router.push('/plan')} />
        ) : null}
      </View>
    ) : null;

  return (
    <KeyboardAvoidingView style={screenStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[screenStyles.content, { paddingBottom }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.clinic}>{visit.clinicName}</Text>

        {!draft ? (
          <>
            <Text style={[type.body, styles.gap]}>{t('ai.notes.intro')}</Text>
            <TextInput
              value={text}
              onChangeText={(v) => {
                setText(v);
                setProblem(null);
              }}
              multiline
              autoFocus={!outOfActions}
              maxLength={MAX_AI_NOTE_INPUT}
              style={styles.input}
              placeholder={t('ai.notes.placeholder')}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={t('ai.notes.inputLabel')}
              editable={!drafting}
            />
            <View style={styles.privacy}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.textMuted} />
              <Text style={[type.secondary, styles.flex]}>{t('ai.notes.privacy')}</Text>
            </View>
            {problem ? <Banner message={problem} /> : null}
            {usedUpBlock ?? (
              <>
                <Button
                  title={t('ai.notes.draft')}
                  icon="sparkles-outline"
                  onPress={makeDraft}
                  loading={drafting}
                  disabled={text.trim().length < 15}
                />
                {ai ? <Text style={[type.secondary, styles.center]}>{t('ai.left', { count: ai.remaining })}</Text> : null}
              </>
            )}
          </>
        ) : (
          <>
            <Text style={type.cardTitle}>{t('ai.notes.review')}</Text>
            <Text style={[type.secondary, styles.gap]}>{existing ? `${t('ai.notes.reviewHint')} ${t('ai.notes.appended')}` : t('ai.notes.reviewHint')}</Text>
            {draft.warnings.length ? (
              <View style={styles.check} accessible>
                <Text style={styles.checkTitle}>{t('ai.notes.check')}</Text>
                {draft.warnings.map((w, i) => (
                  <Text key={i} style={type.body}>
                    • {w}
                  </Text>
                ))}
              </View>
            ) : null}
            <TextInput
              value={notes}
              onChangeText={(v) => {
                setNotes(v);
                setProblem(null);
              }}
              multiline
              maxLength={MAX_NOTES}
              style={[styles.input, styles.notes]}
              accessibilityLabel={t('visits.form.notes')}
            />
            <Text style={[type.secondary, styles.gap]}>{t('ai.disclaimer')}</Text>
            {problem ? <Banner message={problem} /> : null}
            <Button title={t('ai.notes.save')} icon="checkmark" onPress={save} loading={saving} disabled={!notes.trim()} />
            <Button
              title={t('ai.notes.startOver')}
              variant="secondary"
              onPress={() => {
                setDraft(null);
                setProblem(null);
              }}
              disabled={saving}
              style={styles.top}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  clinic: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  gap: { marginBottom: spacing.md },
  top: { marginTop: spacing.sm },
  center: { textAlign: 'center', marginTop: spacing.sm },
  input: {
    minHeight: 180,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md - 4,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
    textAlignVertical: 'top',
  },
  notes: { minHeight: 240, borderColor: colors.primary, marginBottom: spacing.sm },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs + 2, marginTop: spacing.sm, marginBottom: spacing.md },
  check: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  checkTitle: { fontSize: 14, fontWeight: '700', color: colors.warning },
  usedUp: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
});
