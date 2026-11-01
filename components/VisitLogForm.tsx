import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { errorMessage } from '@/lib/api';
import { clinicTodayYmd } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { spacing } from '@/lib/theme';
import { LogEntryInput, PersonalVisitStatus, Visit } from '@/lib/types';
import { type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { visitDay } from '@/lib/visits';
import { Field } from './forms';
import { ChoiceChips, DateField, TimeField } from './pickers';
import { ProductPickerField } from './ProductPicker';
import { Banner, Button, screenStyles, useBottomPadding } from './ui';

// Server limits (app/api/medical-representatives/visits/route.ts).
const MAX = { clinicName: 200, clinicLocation: 300, purpose: 500, notes: 2000 } as const;
const DURATIONS = [15, 30, 45, 60, 90, 120];

interface FormState {
  clinicName: string;
  clinicLocation: string;
  purpose: string;
  date: string;
  time: string;
  duration: number;
  status: PersonalVisitStatus;
  notes: string;
  productIds: string[];
}

function initial(visit?: Visit): FormState {
  if (!visit) {
    return {
      clinicName: '',
      clinicLocation: '',
      purpose: '',
      date: clinicTodayYmd(),
      time: '',
      duration: 30,
      status: 'scheduled',
      notes: '',
      productIds: [],
    };
  }
  return {
    clinicName: visit.clinicName,
    clinicLocation: visit.clinicLocation,
    purpose: visit.purpose,
    date: visitDay(visit),
    time: visit.time,
    duration: visit.duration,
    status: (['scheduled', 'completed', 'cancelled'] as const).includes(visit.status as PersonalVisitStatus)
      ? (visit.status as PersonalVisitStatus)
      : 'scheduled',
    notes: visit.notes ?? '',
    productIds: visit.productIds ?? [],
  };
}

/**
 * The rep's own log entry: a visit to a clinic that isn't booked through MyClinicSoft. Every
 * field stays as typed if saving fails (offline included).
 */
export function VisitLogForm({
  visit,
  submitLabel,
  onSubmit,
}: {
  visit?: Visit;
  submitLabel: string;
  onSubmit: (input: LogEntryInput) => Promise<void>;
}) {
  const t = useT();
  const [form, setForm] = useState<FormState>(() => initial(visit));
  // Until the rep picks a status, a past day defaults to Done and today or later to Planned.
  const [statusTouched, setStatusTouched] = useState(!!visit);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paddingBottom = useBottomPadding();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };
  const required = (key: 'clinicName' | 'clinicLocation' | 'purpose' | 'date' | 'time') =>
    submitted && !String(form[key]).trim() ? t('profile.required') : null;

  async function save() {
    if (saving) return;
    setSubmitted(true);
    if (!form.clinicName.trim() || !form.clinicLocation.trim() || !form.purpose.trim() || !form.date || !form.time) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        clinicName: form.clinicName.trim(),
        clinicLocation: form.clinicLocation.trim(),
        purpose: form.purpose.trim(),
        date: form.date,
        time: form.time,
        duration: form.duration,
        status: form.status,
        notes: form.notes.trim(),
        productIds: form.productIds,
      });
    } catch (err) {
      setError(isNetworkError(err) ? t('common.needsConnection') : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={screenStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={96}>
      <ScrollView contentContainerStyle={[screenStyles.content, { paddingBottom }]} keyboardShouldPersistTaps="handled">
        {!visit ? <Text style={[type.secondary, styles.intro]}>{t('visits.form.logIntro')}</Text> : null}
        {error ? <Banner message={error} /> : null}

        <Field
          label={t('visits.form.clinicName')}
          value={form.clinicName}
          onChangeText={(v) => set('clinicName', v)}
          maxLength={MAX.clinicName}
          error={required('clinicName')}
        />
        <Field
          label={t('visits.form.clinicLocation')}
          value={form.clinicLocation}
          onChangeText={(v) => set('clinicLocation', v)}
          maxLength={MAX.clinicLocation}
          hint={t('visits.form.clinicLocationHint')}
          error={required('clinicLocation')}
        />
        <DateField
          label={t('visits.form.date')}
          value={form.date}
          onChange={(day) => {
            set('date', day);
            if (!statusTouched) set('status', day < clinicTodayYmd() ? 'completed' : 'scheduled');
          }}
          error={required('date')}
        />
        <TimeField label={t('visits.form.time')} value={form.time} onChange={(v) => set('time', v)} error={required('time')} />
        <ChoiceChips
          label={t('visits.form.length')}
          options={DURATIONS.map((m) => ({ value: m, label: t('visits.minutes', { minutes: m }) }))}
          value={form.duration}
          onChange={(v) => set('duration', v)}
        />
        <ChoiceChips
          label={t('visits.form.status')}
          options={[
            { value: 'scheduled', label: t('visits.logStatus.scheduled') },
            { value: 'completed', label: t('visits.logStatus.completed') },
            { value: 'cancelled', label: t('visits.logStatus.cancelled') },
          ]}
          value={form.status}
          onChange={(v) => {
            setStatusTouched(true);
            set('status', v);
          }}
        />
        <Field
          label={t('visits.form.purpose')}
          value={form.purpose}
          onChangeText={(v) => set('purpose', v)}
          maxLength={MAX.purpose}
          hint={t('visits.form.purposeHint')}
          error={required('purpose')}
          multiline
        />
        <ProductPickerField value={form.productIds} onChange={(ids) => set('productIds', ids)} />
        <Field
          label={t('visits.form.notes')}
          optional
          value={form.notes}
          onChangeText={(v) => set('notes', v)}
          maxLength={MAX.notes}
          hint={t('visits.form.notesHint')}
          multiline
        />
        <Button title={submitLabel} onPress={save} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: spacing.md },
});
