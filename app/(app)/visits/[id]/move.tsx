import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiError, errorMessage } from '@/lib/api';
import { bookingDays, moveVisit, useBookingDay, useClinic, useSlots } from '@/lib/clinics';
import { emitRefresh } from '@/lib/events';
import { formatDay } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/lib/theme';
import { Clinic, Visit } from '@/lib/types';
import { type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { isOpenBooking, useVisit, visitDay } from '@/lib/visits';
import { TextLink } from '@/components/auth';
import { DateStrip, SlotGrid } from '@/components/booking';
import { ErrorState } from '@/components/ErrorState';
import { Banner, Button, LoadingView, screenStyles } from '@/components/ui';

/** Move a clinic booking to another slot. The clinic answers again, so it goes back to Waiting. */
export default function MoveVisitScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: visit, loading, error, refresh } = useVisit(id);
  const { clinic, loading: clinicLoading } = useClinic(visit?.clinicId);

  if (!visit) {
    if (loading) return <LoadingView />;
    return <ErrorState message={error ?? t('common.failedToLoad')} onRetry={refresh} />;
  }
  // Closed, or the rep is already checked in at the desk (moving would undo it): nothing to retry.
  if (!isOpenBooking(visit) || visit.checkedInAt) {
    return <ErrorState message={t('booking.closedCantMove')} onRetry={() => router.back()} actionLabel={t('common.goBack')} />;
  }
  if (!clinic) {
    if (clinicLoading) return <LoadingView />;
    return <ErrorState message={t('booking.goneCantMove')} onRetry={() => router.back()} actionLabel={t('common.goBack')} />;
  }
  return <MoveSheet visit={visit} clinic={clinic} />;
}

function MoveSheet({ visit, clinic }: { visit: Visit; clinic: Clinic }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const days = useMemo(() => bookingDays(clinic), [clinic]);
  const [day, setDay] = useBookingDay(days, visitDay(visit));
  const slots = useSlots(clinic.id, day);
  const [time, setTime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [problem, setProblem] = useState<string | null>(null);

  const daySlots = slots.data?.date === day ? slots.data.slots : null;
  const same = day === visitDay(visit) && time === visit.time;
  const dayWords = day ? formatDay(day, { weekday: 'long', month: 'long', day: 'numeric' }) : '';

  function confirm() {
    if (!day || !time || same) return;
    // The clinic sees a move, so it is confirmed first.
    Alert.alert(
      t('booking.moveConfirmTitle'),
      t('booking.moveConfirmBody', { clinic: clinic.name, day: dayWords, time }),
      [
        { text: t('booking.keep'), style: 'cancel' },
        { text: t('booking.move'), onPress: () => save(day, time) },
      ]
    );
  }

  async function save(newDay: string, newTime: string) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setProblem(null);
    try {
      await moveVisit(visit._id, newDay, newTime);
      router.back();
    } catch (err) {
      if (isNetworkError(err)) setProblem(t('common.needsConnection'));
      else if (err instanceof ApiError && (err.code === 'SLOT_FULL' || err.code === 'SLOT_UNAVAILABLE')) {
        setTime(null);
        slots.reload();
        setProblem(err.code === 'SLOT_FULL' ? t('booking.slotFull') : t('booking.slotUnavailable'));
      } else if (err instanceof ApiError && err.code === 'VISIT_CHANGED') {
        emitRefresh('visits');
        setProblem(t('booking.visitChanged'));
      } else if (err instanceof ApiError && err.code === 'VISIT_CLOSED') {
        emitRefresh('visits');
        setProblem(t('booking.closedCantMove'));
      } else if (err instanceof ApiError && err.code === 'DUPLICATE_REQUEST') {
        setTime(null);
        setProblem(t('booking.duplicate'));
      } else setProblem(errorMessage(err));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <View style={screenStyles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.current}>
          <Text style={type.cardTitle}>{clinic.name}</Text>
          <Text style={type.body}>
            {t('booking.now')} {formatDay(visitDay(visit), { weekday: 'short', month: 'short', day: 'numeric' })} ·{' '}
            <Text style={styles.time}>{visit.time}</Text>
          </Text>
          <View style={styles.noteRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
            <Text style={[type.secondary, styles.flex]}>{t('booking.moveNote')}</Text>
          </View>
        </View>

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
        <Text style={[type.label, styles.label]}>{t('booking.time')}</Text>
        {!daySlots ? (
          slots.error ? (
            <View>
              <Text style={styles.error}>{slots.error}</Text>
              <TextLink title={t('common.tryAgain')} onPress={slots.reload} />
            </View>
          ) : slots.gone ? (
            <Text style={styles.error}>{t('booking.goneCantMove')}</Text>
          ) : (
            <ActivityIndicator color={colors.primary} style={styles.spinner} />
          )
        ) : daySlots.length === 0 ? (
          <Text style={type.secondary}>{t('booking.noSlots')}</Text>
        ) : (
          <SlotGrid slots={daySlots} value={time} onChange={setTime} />
        )}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        {problem ? <Banner message={problem} /> : null}
        <Button title={t('booking.move')} icon="swap-horizontal-outline" onPress={confirm} loading={saving} disabled={!day || !time || same} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  current: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.xs },
  // A clock time: tabular figures on the normal face (monospace spreads it on Android).
  time: { fontWeight: '600', fontVariant: ['tabular-nums'] },
  noteRow: { flexDirection: 'row', gap: spacing.xs + 2, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  flex: { flex: 1 },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm },
  spinner: { marginVertical: spacing.lg },
  error: { fontSize: 13, color: colors.danger, marginTop: spacing.xs },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
});
