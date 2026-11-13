import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ApiError, errorMessage } from '@/lib/api';
import { bookingDays, dropClinic, findOpenBooking, requestVisit, useBookingDay, useClinic, useSlots } from '@/lib/clinics';
import { emitRefresh } from '@/lib/events';
import { formatDay } from '@/lib/format';
import { sentRequest } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { Clinic, Visit } from '@/lib/types';
import { mono, type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { IconBadge, TextLink } from '@/components/auth';
import { DateStrip, SlotGrid } from '@/components/booking';
import { Field } from '@/components/forms';
import { ProductPickerField } from '@/components/ProductPicker';
import { Banner, Button, LoadingView, screenStyles } from '@/components/ui';

const MAX_PURPOSE = 500;
const MAX_NOTES = 2000;

/** Book a slot: Clinic → day and slot → purpose → Send. Opened as a full-height sheet. */
export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { clinic, loading } = useClinic(id);

  if (!clinic) {
    if (loading) return <LoadingView />;
    return <Gone />;
  }
  return <BookingSheet clinic={clinic} key={clinic.id} />;
}

function Gone({ name }: { name?: string }) {
  const t = useT();
  return (
    <View style={[screenStyles.container, styles.center]}>
      <IconBadge icon="close-circle-outline" tone="slate" size={88} />
      <Text style={[type.cardTitle, styles.centerText]}>{name ? t('booking.goneNamed', { clinic: name }) : t('booking.gone')}</Text>
      <Text style={[type.secondary, styles.centerText]}>{t('booking.goneHint')}</Text>
      <Button title={t('common.back')} variant="secondary" onPress={() => router.back()} />
    </View>
  );
}

type Problem = { message: string; existing?: Visit | null };

function BookingSheet({ clinic }: { clinic: Clinic }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const days = useMemo(() => bookingDays(clinic), [clinic]);
  const [day, setDay] = useBookingDay(days);
  const slots = useSlots(clinic.id, day);
  const [time, setTime] = useState<string | null>(null);
  const [purpose, setPurpose] = useState('');
  const [productIds, setProductIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  // State lags a frame: two taps in one frame must not send two requests.
  const sendingRef = useRef(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [sent, setSent] = useState<Visit | null>(null);

  if (slots.gone) return <Gone name={clinic.name} />;
  if (sent) return <Sent clinic={clinic} visit={sent} />;

  const daySlots = slots.data?.date === day ? slots.data.slots : null;
  const ready = !!day && !!time && !!purpose.trim();

  async function send() {
    if (sendingRef.current) return;
    setSubmitted(true);
    if (!ready || !day || !time) return;
    sendingRef.current = true;
    setSending(true);
    setProblem(null);
    try {
      const visit = await requestVisit({
        clinicId: clinic.id,
        purpose: purpose.trim(),
        date: day,
        time,
        notes: notes.trim() || undefined,
        productIds: productIds.length ? productIds : undefined,
      });
      sentRequest();
      setSent(visit);
    } catch (err) {
      await handleError(err);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  async function handleError(err: unknown) {
    if (isNetworkError(err)) return setProblem({ message: t('common.needsConnection') });
    if (!(err instanceof ApiError)) return setProblem({ message: errorMessage(err) });
    switch (err.code) {
      case 'SLOT_FULL':
        // Someone took the last seat: new seat counts, a fresh pick, the purpose kept.
        setTime(null);
        slots.reload();
        return setProblem({ message: t('booking.slotFull') });
      case 'SLOT_UNAVAILABLE':
        setTime(null);
        slots.reload();
        return setProblem({ message: t('booking.slotUnavailable') });
      case 'SUBSCRIPTION_REQUIRED':
        // Plan opens on top, so what the rep typed is still here when they come back.
        emitRefresh('subscription');
        router.push('/plan');
        return setProblem({ message: t('booking.needsPlan') });
      case 'DUPLICATE_REQUEST': {
        const existing = day ? await findOpenBooking(clinic.id, day).catch(() => null) : null;
        return setProblem({ message: t('booking.duplicate'), existing });
      }
      default:
        if (err.status === 404) {
          dropClinic(clinic.id);
          emitRefresh('clinics');
          return setProblem({ message: t('booking.gone') });
        }
        return setProblem({ message: err.message });
    }
  }

  const summary = day && time ? `${formatDay(day, { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}` : null;

  return (
    <KeyboardAvoidingView style={screenStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={56}>
      <Stack.Screen options={{ title: t('booking.title') }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={type.cardTitle} accessibilityRole="header">
          {clinic.name}
        </Text>
        {clinic.location ? <Text style={type.secondary}>{clinic.location}</Text> : null}
        {clinic.instructions ? (
          <View style={styles.instructions}>
            <Text style={type.label}>{t('booking.fromClinic', { clinic: clinic.name })}</Text>
            <Text style={type.body}>{clinic.instructions}</Text>
          </View>
        ) : null}

        <Text style={[type.label, styles.label]}>{t('booking.day')}</Text>
        <DateStrip
          days={days}
          value={day}
          onChange={(d) => {
            setDay(d);
            setTime(null);
            setProblem(null);
          }}
        />

        <Text style={[type.label, styles.label]}>
          {t('booking.time')} <Text style={styles.muted}>{t('booking.slotLength', { minutes: clinic.slotMinutes })}</Text>
        </Text>
        {!daySlots ? (
          slots.error ? (
            <View>
              <Text style={styles.error}>{slots.error}</Text>
              <TextLink title={t('common.tryAgain')} onPress={slots.reload} />
            </View>
          ) : (
            <ActivityIndicator color={colors.primary} style={styles.spinner} />
          )
        ) : daySlots.length === 0 ? (
          <Text style={type.secondary}>{t('booking.noSlots')}</Text>
        ) : (
          <SlotGrid
            slots={daySlots}
            value={time}
            onChange={(v) => {
              setTime(v);
              setProblem(null);
            }}
          />
        )}
        {submitted && !time ? <Text style={styles.error}>{t('booking.pickTime')}</Text> : null}

        <View style={styles.form}>
          <Field
            label={t('booking.purpose')}
            hint={t('booking.purposeHint')}
            value={purpose}
            onChangeText={setPurpose}
            maxLength={MAX_PURPOSE}
            multiline
            error={submitted && !purpose.trim() ? t('booking.purposeRequired') : null}
          />
          <ProductPickerField value={productIds} onChange={setProductIds} />
          <Field
            label={t('visits.form.notes')}
            optional
            hint={t('visits.form.notesHint')}
            value={notes}
            onChangeText={setNotes}
            maxLength={MAX_NOTES}
            multiline
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        {problem ? (
          <View>
            <Banner message={problem.message} />
            {problem.existing ? (
              <TextLink
                title={t('booking.openExisting')}
                onPress={() => router.replace(`/visits/${problem.existing!._id}`)}
                style={styles.existing}
              />
            ) : null}
          </View>
        ) : null}
        {summary ? <Text style={[type.secondary, mono, styles.summary]}>{summary}</Text> : null}
        <Button title={t('booking.send')} icon="send-outline" onPress={send} loading={sending} style={styles.send} />
      </View>
    </KeyboardAvoidingView>
  );
}

/** The success state on the sheet: what was asked for, and that the rep will be told. */
function Sent({ clinic, visit }: { clinic: Clinic; visit: Visit }) {
  const t = useT();
  const day = formatDay(visit.date, { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <View style={[screenStyles.container, styles.center]}>
      <Stack.Screen options={{ title: t('booking.sentTitle') }} />
      <IconBadge icon="paper-plane-outline" size={96} />
      <Text style={[type.screenTitle, styles.centerText]} accessibilityRole="header">
        {t('booking.sentTitle')}
      </Text>
      <Text style={[type.body, styles.centerText]}>
        {t('booking.sentBody', { clinic: clinic.name, day })} <Text style={mono}>{visit.time}</Text>.
      </Text>
      <Text style={[type.secondary, styles.centerText]}>{t('booking.sentNext')}</Text>
      <Button
        title={t('booking.seeVisit')}
        onPress={() => {
          if (router.canDismiss()) router.dismissAll();
          router.navigate({ pathname: '/visits', params: { segment: 'upcoming', open: visit._id } });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  instructions: {
    marginTop: spacing.md,
    padding: spacing.sm + 4,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.slate,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm },
  muted: { fontWeight: '400', color: colors.textMuted },
  spinner: { marginVertical: spacing.lg },
  error: { fontSize: 13, color: colors.danger, marginTop: spacing.xs },
  form: { marginTop: spacing.lg },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  existing: { alignSelf: 'flex-start', marginTop: -spacing.sm },
  summary: { textAlign: 'center' },
  send: { marginTop: spacing.xs },
  center: { flex: 1, alignItems: 'stretch', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  centerText: { textAlign: 'center' },
});
