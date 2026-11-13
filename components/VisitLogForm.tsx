import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { errorMessage } from '@/lib/api';
import { clinicTodayYmd } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { spacing } from '@/lib/theme';
import { LogEntryInput, PersonalVisitStatus, Visit } from '@/lib/types';
import { type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { visitDay } from '@/lib/visits';
import { ClinicLinkField, LinkedClinic } from './ClinicLinkField';
import { Field } from './forms';
import { ChoiceChips, DateField, TimeField } from './pickers';
import { ProductPickerField } from './ProductPicker';
import { Banner, Button, screenStyles, useBottomPadding } from './ui';

// Server limits (app/api/medical-representatives/visits/route.ts).
const MAX = { clinicName: 200, clinicLocation: 300, purpose: 500, notes: 2000 } as const;
const DURATIONS = [15, 30, 45, 60, 90, 120];

/** The chips, plus a saved length that isn't one of them (e.g. 20 min), so one is always selected. */
export function durationsWith(current: number): number[] {
  return DURATIONS.includes(current) || !current ? DURATIONS : [...DURATIONS, current].sort((a, b) => a - b);
}

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
  linked: LinkedClinic | null;
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
      linked: null,
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
    linked: visit.linkedClinicId ? { id: visit.linkedClinicId, name: visit.clinicName, location: visit.clinicLocation } : null,
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
  // State lags a frame: two taps in one frame must not save twice.
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const paddingBottom = useBottomPadding();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };
  const required = (key: 'clinicName' | 'clinicLocation' | 'purpose' | 'date' | 'time') =>
    submitted && !String(form[key]).trim() ? t('profile.required') : null;

  async function save() {
    if (savingRef.current) return;
    setSubmitted(true);
    const name = form.linked ? form.linked.name : form.clinicName.trim();
    const location = form.linked ? form.linked.location || form.clinicLocation.trim() || form.linked.name : form.clinicLocation.trim();
    if (!name || !location || !form.purpose.trim() || !form.date || !form.time) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        clinicName: name,
        clinicLocation: location,
        linkedClinicId: form.linked ? form.linked.id : null,
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
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={screenStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={96}>
      <ScrollView contentContainerStyle={[screenStyles.content, { paddingBottom }]} keyboardShouldPersistTaps="handled">
        {!visit ? <Text style={[type.secondary, styles.intro]}>{t('visits.form.logIntro')}</Text> : null}

        <ClinicLinkField
          value={form.linked}
          onChange={(clinic) => {
            set('linked', clinic);
            // Unlinking leaves the clinic's details in the fields, to keep or change.
            if (!clinic && form.linked) setForm((f) => ({ ...f, linked: null, clinicName: form.linked!.name, clinicLocation: form.linked!.location }));
          }}
        />
        {/* A linked clinic names the visit; the typed fields are for a clinic not on MyClinicSoft. */}
        {!form.linked ? (
          <>
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
          </>
        ) : null}
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
          options={durationsWith(form.duration).map((m) => ({ value: m, label: t('visits.minutes', { minutes: m }) }))}
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
        {/* Next to Save, where the rep's eyes are when it fails (it was at the top, off screen). */}
        {error ? <Banner message={error} /> : null}
        <Button title={submitLabel} onPress={save} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: spacing.md },
});
