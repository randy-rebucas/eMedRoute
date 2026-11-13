import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { ApiError, errorMessage } from '@/lib/api';
import { bookingDays, dropClinic, findOpenBooking, hoursOn, nextHours, requestVisit, useBookingDay, useClinic, useSlots } from '@/lib/clinics';
import { emitRefresh } from '@/lib/events';
import { formatDay } from '@/lib/format';
import { sentRequest } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useSubscription } from '@/lib/plan';
import { useRepProfile } from '@/lib/profile';
import { getPushPermission, PushPermission, pushState } from '@/lib/push';
import { colors, radius, spacing } from '@/lib/theme';
import { Clinic, Visit } from '@/lib/types';
import { type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { visitProgress } from '@/lib/visits';
import { IconBadge, TextLink } from '@/components/auth';
import { DateStrip, SlotGrid } from '@/components/booking';
import { clinicHistory } from '@/components/ClinicRow';
import { Field } from '@/components/forms';
import { photos, ScrimPhoto } from '@/components/Photo';
import { ProductPickerField } from '@/components/ProductPicker';
import { Banner, Button, LoadingView, screenStyles, useBottomPadding } from '@/components/ui';
import { VisitProgress } from '@/components/VisitProgress';

const MAX_PURPOSE = 500;
const MAX_NOTES = 2000;

/**
 * Book a slot, opened as a full-height sheet: the clinic on navy (with the rep's record there),
 * what the clinic asks of reps, then three numbered steps (day, time, purpose) and Send. Says up
 * front when no plan covers booking, or when the rep is already booked there that day, instead of
 * only after Send. Leaving with something typed asks first.
 */
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

/** "Tue, Nov 18" */
const shortDay = (day: string) => formatDay(day, { weekday: 'short', month: 'short', day: 'numeric' });

function BookingSheet({ clinic }: { clinic: Clinic }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const days = useMemo(() => bookingDays(clinic), [clinic]);
  // Open on the next day whose rep hours haven't ended: after today's close, that's not today.
  const firstDay = useMemo(() => nextHours(clinic.hours)?.day, [clinic.hours]);
  const [day, setDay] = useBookingDay(days, firstDay);
  const slots = useSlots(clinic.id, day);
  const { data: sub } = useSubscription();
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

  // A swipe down or Back shouldn't silently drop a purpose the rep spent a minute on.
  const dirty = !!(purpose.trim() || notes.trim() || productIds.length) && !sent && !slots.gone;
  usePreventRemove(dirty, ({ data }) => {
    Alert.alert(t('booking.discardTitle'), t('booking.discardBody', { clinic: clinic.name }), [
      { text: t('booking.keepEditing'), style: 'cancel' },
      { text: t('booking.discard'), style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  if (slots.gone) return <Gone name={clinic.name} />;
  if (sent) return <Sent clinic={clinic} visit={sent} />;

  const daySlots = slots.data?.date === day ? slots.data.slots : null;
  const ready = !!day && !!time && !!purpose.trim();
  const dayHours = day ? hoursOn(clinic.hours, day) : '';
  // The server takes one open booking per clinic per day; `nextVisit` is the soonest one.
  const bookedThatDay = day && clinic.nextVisit?.date.slice(0, 10) === day ? clinic.nextVisit.time : null;
  const needsPlan = sub ? !sub.canBookClinics : false;
  const history = clinicHistory(t, clinic);

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

  const summary = day && time ? `${shortDay(day)} · ${time} · ${clinic.slotMinutes} min` : null;

  return (
    <KeyboardAvoidingView style={screenStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={56}>
      <Stack.Screen options={{ title: t('booking.title') }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.heroName} accessibilityRole="header">
            {clinic.name}
          </Text>
          {clinic.location ? (
            <View style={styles.heroLine}>
              <Ionicons name="location-outline" size={14} color={colors.onNavyMuted} />
              <Text style={styles.heroMuted}>{clinic.location}</Text>
            </View>
          ) : null}
          {history ? (
            <View style={[styles.chip, history.tone === 'booked' && styles.chipBooked, history.tone === 'due' && styles.chipDue]}>
              <Ionicons
                name={history.icon}
                size={14}
                color={history.tone === 'due' ? colors.warning : history.tone === 'booked' ? colors.primaryText : colors.onNavyMuted}
              />
              <Text style={[styles.chipText, history.tone === 'due' && { color: colors.warning }, history.tone === 'booked' && { color: colors.primaryText }]}>
                {history.text}
              </Text>
            </View>
          ) : null}
        </View>

        {clinic.instructions ? (
          <View style={styles.quote} accessible accessibilityLabel={`${t('booking.fromClinic', { clinic: clinic.name })}: ${clinic.instructions}`}>
            <Text style={type.label}>{t('booking.fromClinic', { clinic: clinic.name })}</Text>
            <Text style={type.body}>{clinic.instructions}</Text>
          </View>
        ) : null}

        {needsPlan ? (
          <View style={styles.plan}>
            <View style={styles.planHead}>
              <Ionicons name="alert-circle" size={18} color={colors.warning} />
              <Text style={styles.planTitle}>{t('booking.planTitle')}</Text>
            </View>
            <Text style={styles.planBody}>{t('booking.planBody')}</Text>
            <Button title={t('booking.seePlans')} variant="secondary" icon="card-outline" onPress={() => router.push('/plan')} />
          </View>
        ) : null}

        <Step n={1} title={t('booking.step.day')} done={!!day}>
          <DateStrip
            days={days}
            value={day}
            onChange={(d) => {
              setDay(d);
              setTime(null);
              setProblem(null);
            }}
          />
          {bookedThatDay ? (
            <View style={styles.warnLine}>
              <Ionicons name="alert-circle" size={16} color={colors.warning} />
              <Text style={styles.warnText}>{t('booking.alreadyBooked', { time: bookedThatDay })}</Text>
            </View>
          ) : null}
        </Step>

        <Step
          n={2}
          title={t('booking.step.time')}
          done={!!time}
          caption={dayHours ? t('booking.hoursThatDay', { hours: dayHours, minutes: clinic.slotMinutes }) : null}
        >
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
        </Step>

        <Step n={3} title={t('booking.step.purpose')} done={!!purpose.trim()} last>
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
        </Step>
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
        {summary ? <Text style={styles.summary}>{summary}</Text> : null}
        <Button title={t('booking.send')} icon="send-outline" onPress={send} loading={sending} style={styles.send} />
      </View>
    </KeyboardAvoidingView>
  );
}

/** A numbered step: the number turns into a teal tick once the step has an answer. */
function Step({
  n,
  title,
  done,
  caption,
  last = false,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  caption?: string | null;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={[styles.step, last && styles.stepLast]}>
      <View style={styles.stepHead}>
        <View style={[styles.stepMark, done && styles.stepMarkDone]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {done ? <Ionicons name="checkmark" size={16} color={colors.primaryText} /> : <Text style={styles.stepNumber}>{n}</Text>}
        </View>
        <View style={styles.stepText}>
          <Text style={type.cardTitle} accessibilityRole="header">
            {title}
          </Text>
          {caption ? <Text style={[type.secondary, styles.tabular]}>{caption}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

/**
 * The success state: the request on a photo band, where it stands now (the same progress line as
 * the visit's own screen), and whether the clinic's answer will reach this phone.
 */
function Sent({ clinic, visit }: { clinic: Clinic; visit: Visit }) {
  const t = useT();
  const paddingBottom = useBottomPadding();
  const { data: profile } = useRepProfile();
  const [permission, setPermission] = useState<PushPermission | null>(null);
  useEffect(() => {
    getPushPermission()
      .then(setPermission)
      .catch(() => setPermission('unavailable'));
  }, []);
  const push = pushState(profile?.notificationsEnabled ?? true, permission);
  const quiet = push !== 'on' && push !== 'checking';
  const day = formatDay(visit.date, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <ScrollView style={screenStyles.container} contentContainerStyle={[styles.content, { paddingBottom }]}>
      <Stack.Screen options={{ title: t('booking.sentTitle') }} />
      <ScrimPhoto source={photos.requestSent} style={styles.sentBand} top={0.25} bottom={0.95}>
        <View style={styles.sentFoot}>
          <Text style={styles.sentTitle} accessibilityRole="header">
            {t('booking.sentTitle')}
          </Text>
          <Text style={styles.sentBody}>{t('booking.sentFor', { clinic: clinic.name, day, time: visit.time })}</Text>
        </View>
      </ScrimPhoto>

      <View style={styles.card}>
        <VisitProgress steps={visitProgress(visit)} />
      </View>

      {quiet ? (
        <View style={styles.warnLine}>
          <Ionicons name="notifications-off-outline" size={16} color={colors.warning} />
          <Text style={[styles.warnText, styles.flex]}>{t('booking.sentQuiet')}</Text>
        </View>
      ) : (
        <Text style={[type.secondary, styles.sentNext]}>{t('booking.sentNext')}</Text>
      )}

      <Button
        title={t('booking.seeVisit')}
        onPress={() => {
          if (router.canDismiss()) router.dismissAll();
          router.navigate({ pathname: '/visits', params: { segment: 'upcoming', open: visit._id } });
        }}
        style={styles.sentButton}
      />
      <Button title={t('common.done')} variant="secondary" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  // The clinic being booked, on the app's navy: solid, no shadow.
  hero: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.md + 4, gap: spacing.xs + 2, marginBottom: spacing.md },
  heroName: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.primaryText, letterSpacing: -0.2 },
  heroLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroMuted: { fontSize: 13, lineHeight: 18, color: colors.onNavyMuted, flexShrink: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.navyLine,
  },
  chipBooked: { backgroundColor: colors.primary },
  chipDue: { backgroundColor: colors.warningSoft },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.onNavyMuted, fontVariant: ['tabular-nums'] },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.slate,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm + 4,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  plan: { backgroundColor: colors.warningSoft, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  planTitle: { fontSize: 15, fontWeight: '700', color: colors.warning, flexShrink: 1 },
  planBody: { fontSize: 13, lineHeight: 18, color: colors.text },
  step: { paddingTop: spacing.md, paddingBottom: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: spacing.sm + 4 },
  stepLast: { borderBottomWidth: 0, paddingBottom: 0 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4 },
  stepMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.slate,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepMarkDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepNumber: { fontSize: 13, fontWeight: '700', color: colors.slate },
  stepText: { flex: 1, gap: 2 },
  tabular: { fontVariant: ['tabular-nums'] },
  warnLine: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs + 2 },
  warnText: { fontSize: 13, lineHeight: 18, color: colors.warning, fontWeight: '600', flexShrink: 1 },
  flex: { flex: 1 },
  spinner: { marginVertical: spacing.lg },
  error: { fontSize: 13, color: colors.danger, marginTop: spacing.xs },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  existing: { alignSelf: 'flex-start', marginTop: -spacing.sm },
  summary: { ...type.secondary, color: colors.text, fontWeight: '600', textAlign: 'center', fontVariant: ['tabular-nums'] },
  send: { marginTop: spacing.xs },
  center: { flex: 1, alignItems: 'stretch', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  centerText: { textAlign: 'center' },
  sentBand: { height: 260, borderRadius: radius.lg, marginBottom: spacing.md },
  sentFoot: { flex: 1, justifyContent: 'flex-end', padding: spacing.md + 4, gap: spacing.xs },
  sentTitle: { fontSize: 24, fontWeight: '700', color: colors.primaryText, letterSpacing: -0.3 },
  sentBody: { fontSize: 15, lineHeight: 21, color: colors.primaryText, fontVariant: ['tabular-nums'] },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sentNext: { marginBottom: spacing.sm },
  sentButton: { marginTop: spacing.md, marginBottom: spacing.sm },
});
