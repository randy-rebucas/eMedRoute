import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, errorMessage } from '@/lib/api';
import { cancelVisit, useClinic } from '@/lib/clinics';
import { emitRefresh } from '@/lib/events';
import { formatDay } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { openDirections } from '@/lib/maps';
import { useActiveProducts } from '@/lib/products';
import { colors, radius, spacing } from '@/lib/theme';
import { mono, type } from '@/lib/typography';
import { scheduleDelete } from '@/lib/undo';
import { deleteVisit, isOpenBooking, isOwnLog, LOG_STATUS_LABEL, nextStep, useVisit, visitDay, visitState } from '@/lib/visits';
import { ErrorState } from '@/components/ErrorState';
import { ThinProgress } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { productLabel } from '@/components/ProductPicker';
import { StatusPill } from '@/components/StatusPill';
import { Banner, Button, IconName, LoadingView, screenStyles, SectionHeader, useBottomPadding } from '@/components/ui';
import { DeliveryCard } from '@/components/DeliveryCard';
import { canDeliver, cancelDelivery, useVisitDeliveries } from '@/lib/deliveries';
import { isNetworkError } from '@/lib/useApiData';
import { nextStepText, visitA11yLabel } from '@/components/VisitRow';

/** One visit: status and who acts next, the clinic's words, the details, and what the rep can do. */
export default function VisitDetailScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: visit, loading, refreshing, error, offline, stale, updatedAt, refresh } = useVisit(id);
  const { data: activeProducts } = useActiveProducts();
  const { data: deliveries } = useVisitDeliveries(id);
  const [cancellingDelivery, setCancellingDelivery] = useState<string | null>(null);
  const paddingBottom = useBottomPadding();
  // The clinic's booking instructions go with an approved visit ("Arrive by 15:00" + where to go).
  const { clinic } = useClinic(visit?.status === 'scheduled' && !visit.checkedInAt ? visit.clinicId : null);
  const [cancelling, setCancelling] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!visit) {
    if (loading) return <LoadingView />;
    return <ErrorState message={error ?? t('common.failedToLoad')} onRetry={refresh} />;
  }

  const state = visitState(visit);
  const own = isOwnLog(visit);
  const open = isOpenBooking(visit);
  const day = visitDay(visit);
  const line = nextStepText(t, nextStep(visit));
  const products = (visit.productIds ?? []).map((pid) => activeProducts?.find((p) => p._id === pid));
  const known = products.filter((p) => !!p);
  const unknownCount = products.length - known.length;
  const upcoming = state === 'approved' || state === 'waiting' || (own && visit.status === 'scheduled');

  function remove() {
    if (!visit) return;
    scheduleDelete({
      id: visit._id,
      message: t('visits.deleted'),
      commit: () => deleteVisit(visit._id),
      topics: ['visits', 'dashboard'],
    });
    router.back();
  }

  function confirmCancelDelivery(deliveryId: string) {
    if (!visit) return;
    // The clinic was asked to confirm it, so cancelling is confirmed first.
    Alert.alert(t('deliveries.cancelConfirmTitle'), t('deliveries.cancelConfirmBody', { clinic: visit.clinicName }), [
      { text: t('deliveries.keep'), style: 'cancel' },
      {
        text: t('deliveries.cancel'),
        style: 'destructive',
        onPress: async () => {
          setCancellingDelivery(deliveryId);
          setProblem(null);
          try {
            await cancelDelivery(deliveryId);
          } catch (err) {
            if (isNetworkError(err)) setProblem(t('common.needsConnection'));
            else if (err instanceof ApiError && err.code === 'DELIVERY_CLOSED') setProblem(t('deliveries.error.closed'));
            else setProblem(errorMessage(err));
          } finally {
            setCancellingDelivery(null);
          }
        },
      },
    ]);
  }

  function confirmCancel() {
    if (!visit) return;
    // The clinic sees a cancellation, so it is confirmed first.
    Alert.alert(t('booking.cancelConfirmTitle'), t('booking.cancelConfirmBody', { clinic: visit.clinicName }), [
      { text: t('booking.keep'), style: 'cancel' },
      { text: t('booking.cancelVisit'), style: 'destructive', onPress: () => doCancel(visit._id) },
    ]);
  }

  async function doCancel(visitId: string) {
    setCancelling(true);
    setProblem(null);
    try {
      await cancelVisit(visitId);
    } catch (err) {
      if (isNetworkError(err)) setProblem(t('common.needsConnection'));
      else if (err instanceof ApiError && err.code === 'VISIT_CHANGED') {
        // The clinic answered at the same moment: show what it did, then the rep decides again.
        emitRefresh('visits');
        setProblem(t('booking.visitChanged'));
      } else if (err instanceof ApiError && err.code === 'VISIT_CLOSED') {
        emitRefresh('visits');
        setProblem(t('booking.closedCantMove'));
      } else setProblem(errorMessage(err));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <ScrollView
      style={screenStyles.container}
      contentContainerStyle={[screenStyles.content, { paddingBottom }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <Stack.Screen options={{ title: own ? t('visits.title.log') : t('visits.title.booking') }} />
      <ThinProgress active={stale && !offline} />
      <OfflineBanner offline={offline} updatedAt={updatedAt} subject={t('visits.offlineSubjectOne')} />

      <View style={styles.head} accessible accessibilityLabel={visitA11yLabel(t, visit)}>
        <Text style={[type.screenTitle, state === 'cancelled' && styles.struck]}>{visit.clinicName}</Text>
        <Text style={type.body}>
          {formatDay(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} ·{' '}
          <Text style={[mono, styles.strong]}>{visit.time}</Text>
        </Text>
        <View style={styles.pillRow}>
          <StatusPill state={state} />
          {own && LOG_STATUS_LABEL[visit.status] ? <Text style={type.secondary}>{t(LOG_STATUS_LABEL[visit.status])}</Text> : null}
        </View>
      </View>

      {line && !(state === 'declined' && visit.clinicNote) ? (
        <View style={styles.next}>
          <Text style={[type.body, styles.strong]}>{line}</Text>
          {state === 'waiting' ? <Text style={type.secondary}>{t('visits.whoNext.clinic')}</Text> : null}
          {state === 'approved' ? <Text style={type.secondary}>{t('visits.whoNext.you')}</Text> : null}
          {state === 'approved' && clinic?.instructions ? (
            <View style={styles.quote}>
              <Text style={type.label}>{t('booking.fromClinic', { clinic: visit.clinicName })}</Text>
              <Text style={type.body}>{clinic.instructions}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {visit.clinicNote ? (
        <View style={styles.quote} accessible accessibilityLabel={`${t('visits.clinicWrote', { clinic: visit.clinicName })}: ${visit.clinicNote}`}>
          <Text style={type.label}>{t('visits.clinicWrote', { clinic: visit.clinicName })}</Text>
          <Text style={[type.body, styles.quoteText]}>“{visit.clinicNote}”</Text>
        </View>
      ) : null}

      <View style={styles.facts}>
        <Fact icon="location-outline" label={t('visits.detail.place')}>
          <Text style={type.body}>{visit.clinicLocation}</Text>
        </Fact>
        <Fact icon="time-outline" label={t('visits.detail.length')}>
          <Text style={[type.body, mono]}>{t('visits.minutes', { minutes: visit.duration })}</Text>
        </Fact>
        <Fact icon="flag-outline" label={own ? t('visits.form.purpose') : t('visits.form.purposeShared')}>
          <Text style={type.body}>{visit.purpose}</Text>
        </Fact>
        {products.length ? (
          <Fact icon="medkit-outline" label={t('visits.form.products')}>
            {known.map((p) => (
              <Text key={p!._id} style={type.body} onPress={() => router.push(`/products/${p!._id}`)} accessibilityRole="link">
                {productLabel(p!)}
              </Text>
            ))}
            {unknownCount ? <Text style={type.secondary}>{t('visits.detail.productsInactive', { count: unknownCount })}</Text> : null}
          </Fact>
        ) : null}
        <Fact icon="document-text-outline" label={t('visits.form.notes')} hint={t('visits.form.notesHint')} last>
          <Text style={[type.body, !visit.notes && styles.muted]}>{visit.notes || t('visits.detail.noNotes')}</Text>
        </Fact>
      </View>

      {deliveries?.length || canDeliver(visit) || (own && visit.status !== 'cancelled') ? (
        <View style={styles.deliveries}>
          <SectionHeader title={t('deliveries.section')} />
          {(deliveries ?? []).map((d) => (
            <DeliveryCard
              key={d._id}
              delivery={d}
              cancelling={cancellingDelivery === d._id}
              onCancel={offline ? undefined : () => confirmCancelDelivery(d._id)}
            />
          ))}
          {canDeliver(visit) ? (
            <>
              {!deliveries?.length ? <Text style={type.secondary}>{t('deliveries.recordHint')}</Text> : null}
              <Button
                title={t('deliveries.record')}
                icon="cube-outline"
                variant="secondary"
                onPress={() => router.push(`/visits/${visit._id}/deliver`)}
                disabled={offline}
              />
            </>
          ) : own && !visit.linkedClinicId ? (
            <Text style={type.secondary}>{t('deliveries.linkToDeliver')}</Text>
          ) : null}
        </View>
      ) : null}

      {upcoming && visit.clinicLocation ? (
        <Button
          title={t('home.directions')}
          icon="navigate-outline"
          variant="secondary"
          onPress={() => openDirections(`${visit.clinicName}, ${visit.clinicLocation}`).catch(() => {})}
        />
      ) : null}
      {problem ? <Banner message={problem} /> : null}
      {open ? (
        <>
          <Button title={t('booking.move')} icon="swap-horizontal-outline" variant="secondary" onPress={() => router.push(`/visits/${visit._id}/move`)} disabled={offline} />
          <Button title={t('booking.cancelVisit')} icon="close-circle-outline" variant="dangerOutline" onPress={confirmCancel} loading={cancelling} disabled={offline} />
        </>
      ) : null}
      {own ? (
        <Button title={t('visits.edit')} icon="create-outline" variant="secondary" onPress={() => router.push(`/visits/${visit._id}/edit`)} />
      ) : null}
      {!open ? (
        <Button title={t('visits.delete')} icon="trash-outline" variant="dangerOutline" onPress={remove} disabled={offline} />
      ) : null}
    </ScrollView>
  );
}

function Fact({
  icon,
  label,
  hint,
  last = false,
  children,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.fact, last && styles.factLast]}>
      <Ionicons name={icon} size={20} color={colors.slate} style={styles.factIcon} />
      <View style={styles.factBody}>
        <Text style={type.secondary}>
          {label}
          {hint ? (
            <Text>
              {' · '}
              <Ionicons name="lock-closed-outline" size={12} color={colors.textMuted} /> {hint}
            </Text>
          ) : null}
        </Text>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    gap: spacing.xs,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  strong: { fontWeight: '600' },
  struck: { textDecorationLine: 'line-through', color: colors.textMuted },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  next: { marginBottom: spacing.md, gap: 2 },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.slate,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm + 4,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  quoteText: { fontStyle: 'italic' },
  facts: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  fact: {
    flexDirection: 'row',
    gap: spacing.sm + 4,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  factIcon: { marginTop: 1 },
  factBody: { flex: 1, gap: 2 },
  factLast: { borderBottomWidth: 0 },
  muted: { color: colors.textMuted },
  deliveries: { marginTop: spacing.md, marginBottom: spacing.sm, gap: spacing.xs },
});
