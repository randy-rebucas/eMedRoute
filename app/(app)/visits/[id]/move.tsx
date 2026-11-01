import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiError, errorMessage } from '@/lib/api';
import { bookingDays, moveVisit, useBookingDay, useClinic, useSlots } from '@/lib/clinics';
import { emitRefresh } from '@/lib/events';
import { formatDay } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, spacing } from '@/lib/theme';
import { Clinic, Visit } from '@/lib/types';
import { mono, type } from '@/lib/typography';
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
  if (!isOpenBooking(visit)) return <ErrorState message={t('booking.closedCantMove')} onRetry={() => router.back()} />;
  if (!clinic) {
    if (clinicLoading) return <LoadingView />;
    return <ErrorState message={t('booking.goneCantMove')} onRetry={() => router.back()} />;
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
      } else setProblem(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={screenStyles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={type.cardTitle}>{clinic.name}</Text>
        <Text style={type.secondary}>
          {t('booking.now')} {formatDay(visitDay(visit), { weekday: 'short', month: 'short', day: 'numeric' })} ·{' '}
          <Text style={mono}>{visit.time}</Text>
        </Text>
        <Text style={[type.secondary, styles.note]}>{t('booking.moveNote')}</Text>

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
  note: { marginTop: spacing.sm },
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
