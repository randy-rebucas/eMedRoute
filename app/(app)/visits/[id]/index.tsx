import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, errorMessage } from '@/lib/api';
import { cancelVisit, useClinic } from '@/lib/clinics';
import { emitRefresh } from '@/lib/events';
import { clinicTodayYmd, formatDay } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { openDirections } from '@/lib/maps';
import { bookingBlocked, useSubscription } from '@/lib/plan';
import { useActiveProducts } from '@/lib/products';
import { colors, radius, spacing } from '@/lib/theme';
import { Visit } from '@/lib/types';
import { type } from '@/lib/typography';
import { scheduleDelete } from '@/lib/undo';
import {
  deleteVisit,
  isOpenBooking,
  isOwnLog,
  LOG_STATUS_LABEL,
  nextStep,
  saveVisitNotes,
  useVisit,
  visitDay,
  visitProgress,
  visitState,
} from '@/lib/visits';
import { ErrorState } from '@/components/ErrorState';
import { ThinProgress } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { productLabel } from '@/components/ProductPicker';
import { StatusPill } from '@/components/StatusPill';
import { Banner, Button, LoadingView, screenStyles, SectionHeader, useBottomPadding } from '@/components/ui';
import { DeliveryCard } from '@/components/DeliveryCard';
import { VisitProgress } from '@/components/VisitProgress';
import { canDeliver, cancelDelivery, useVisitDeliveries } from '@/lib/deliveries';
import { isNetworkError } from '@/lib/useApiData';
import { nextStepText, visitA11yLabel } from '@/components/VisitRow';

const MAX_NOTES = 2000;

/**
 * One visit, in the order a rep needs it in the field: the navy card (clinic, when, where, what
 * happens next, Directions and Move), the clinic's own words, where the booking stands, the
 * rep's private notes (writable after the visit, bookings included), what was delivered, then
 * the rarer actions (edit, cancel, delete) at the foot.
 */
export default function VisitDetailScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: visit, setData: setVisit, loading, refreshing, error, offline, stale, updatedAt, refresh } = useVisit(id);
  const { data: activeProducts } = useActiveProducts();
  const { data: deliveries } = useVisitDeliveries(id);
  const { data: sub } = useSubscription();
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
  // Only once the product list is in: before that every product would count as inactive.
  const unknownCount = activeProducts ? products.length - known.length : 0;
  // Directions only for a visit still ahead: an approved visit left open from last week isn't a trip.
  const ahead = (state === 'approved' || state === 'waiting' || state === 'checkedIn' || (own && visit.status === 'scheduled')) && day >= clinicTodayYmd();
  // Checked in means the rep is at the desk: moving it then would undo the check-in.
  const canMove = open && !visit.checkedInAt;
  const instructions = state === 'approved' ? clinic?.instructions : null;
  const whoNext = state === 'waiting' ? t('visits.whoNext.clinic') : state === 'approved' ? t('visits.whoNext.you') : null;

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
            else if (err instanceof ApiError && err.code === 'DELIVERY_CLOSED') {
              setProblem(t('deliveries.error.closed'));
              // The clinic answered meanwhile: show its answer instead of a Cancel that can't work.
              emitRefresh('deliveries');
            } else setProblem(errorMessage(err));
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

  const showDeliveries = !!deliveries?.length || canDeliver(visit) || (own && visit.status !== 'cancelled');

  return (
    <ScrollView
      style={screenStyles.container}
      contentContainerStyle={[screenStyles.content, { paddingBottom }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: own ? t('visits.title.log') : t('visits.title.booking') }} />
      {stale || offline ? (
        <View style={styles.status}>
          <ThinProgress active={stale && !offline} />
          <OfflineBanner offline={offline} updatedAt={updatedAt} subject={t('visits.offlineSubjectOne')} />
        </View>
      ) : null}

      {/* The visit on the app's navy: who, when, where, and what happens next. */}
      <View style={styles.hero}>
        <View accessible accessibilityLabel={[visitA11yLabel(t, visit), line, whoNext].filter(Boolean).join('. ')}>
          <View style={styles.top}>
            <StatusPill state={state} onDark />
            {own && LOG_STATUS_LABEL[visit.status] ? <Text style={styles.muted}>{t(LOG_STATUS_LABEL[visit.status])}</Text> : null}
          </View>
          <Text style={[styles.clinic, state === 'cancelled' && styles.struck]}>{visit.clinicName}</Text>
          <View style={styles.whenRow}>
            <View style={styles.whenBox}>
              <Ionicons name="calendar-outline" size={18} color={colors.onNavyMuted} />
              <Text style={styles.when}>{formatDay(day, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
            </View>
            <View style={styles.whenBox}>
              <Ionicons name="time-outline" size={18} color={colors.onNavyMuted} />
              <Text style={styles.time}>{visit.time}</Text>
              <Text style={styles.muted}>· {t('visits.minutes', { minutes: visit.duration })}</Text>
            </View>
          </View>
          {visit.clinicLocation ? (
            <View style={styles.place}>
              <Ionicons name="location-outline" size={18} color={colors.onNavyMuted} />
              <Text style={[styles.muted, styles.placeText]}>{visit.clinicLocation}</Text>
            </View>
          ) : null}
          {line && !(state === 'declined' && visit.clinicNote) ? (
            <View style={styles.next}>
              <Ionicons name="arrow-forward-circle-outline" size={20} color={colors.accent} />
              <View style={styles.flex}>
                <Text style={styles.nextText}>{line}</Text>
                {whoNext ? <Text style={styles.muted}>{whoNext}</Text> : null}
              </View>
            </View>
          ) : null}
        </View>

        {(ahead && visit.clinicLocation) || canMove ? (
          <View style={styles.actions}>
            {ahead && visit.clinicLocation ? (
              <TouchableOpacity
                style={[styles.action, styles.actionPrimary]}
                onPress={() => openDirections(`${visit.clinicName}, ${visit.clinicLocation}`).catch(() => {})}
                accessibilityRole="button"
                accessibilityLabel={t('home.directionsA11y', { clinic: visit.clinicName })}
              >
                <Ionicons name="navigate-outline" size={20} color={colors.primaryText} />
                <Text style={styles.actionText}>{t('home.directions')}</Text>
              </TouchableOpacity>
            ) : null}
            {canMove ? (
              <TouchableOpacity
                style={[styles.action, styles.actionGhost, offline && styles.disabled]}
                onPress={() => router.push(`/visits/${visit._id}/move`)}
                disabled={offline}
                accessibilityRole="button"
                accessibilityState={{ disabled: offline }}
              >
                <Ionicons name="swap-horizontal-outline" size={20} color={colors.primaryText} />
                <Text style={styles.actionText}>{t('booking.move')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>

      {problem ? <Banner message={problem} /> : null}

      {instructions ? (
        <Quote label={t('booking.fromClinic', { clinic: visit.clinicName })} text={instructions} />
      ) : null}
      {visit.clinicNote ? <Quote label={t('visits.clinicWrote', { clinic: visit.clinicName })} text={`“${visit.clinicNote}”`} italic /> : null}

      {!own ? (
        <>
          <SectionHeader title={t('visits.progress.title')} />
          <View style={[styles.card, styles.padded]}>
            <VisitProgress steps={visitProgress(visit)} />
          </View>
        </>
      ) : null}

      <SectionHeader title={t('visits.detail.about')} />
      <View style={styles.card}>
        <View style={[styles.fact, styles.rule]}>
          <Text style={type.secondary}>{own ? t('visits.form.purpose') : t('visits.form.purposeShared')}</Text>
          <Text style={type.body}>{visit.purpose}</Text>
        </View>
        {known.map((p) => (
          <TouchableOpacity
            key={p!._id}
            style={[styles.product, styles.rule]}
            onPress={() => router.push(`/products/${p!._id}`)}
            accessibilityRole="link"
            accessibilityLabel={t('visits.detail.openProduct', { name: productLabel(p!) })}
          >
            <Ionicons name="medkit-outline" size={20} color={colors.slate} />
            <Text style={[type.body, styles.flex]}>{productLabel(p!)}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
        {unknownCount ? (
          <View style={[styles.fact, styles.rule]}>
            <Text style={type.secondary}>{t('visits.detail.productsInactive', { count: unknownCount })}</Text>
          </View>
        ) : null}
        <NotesBlock visit={visit} offline={offline} onSaved={(saved) => setVisit(saved)} />
      </View>

      {showDeliveries ? (
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
              {bookingBlocked(sub) ? <Text style={type.secondary}>{t('deliveries.needsPlanHint')}</Text> : null}
              <Button
                title={t('deliveries.record')}
                icon="cube-outline"
                variant="secondary"
                // Deliveries are part of the rep plan, like booking: without one, Plan opens instead.
                onPress={() => router.push(bookingBlocked(sub) ? '/plan' : `/visits/${visit._id}/deliver`)}
                disabled={offline}
              />
            </>
          ) : own && !visit.linkedClinicId ? (
            <Text style={type.secondary}>{t('deliveries.linkToDeliver')}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.foot}>
        {own ? (
          <Button title={t('visits.edit')} icon="create-outline" variant="secondary" onPress={() => router.push(`/visits/${visit._id}/edit`)} disabled={offline} />
        ) : null}
        {open ? (
          <Button title={t('booking.cancelVisit')} icon="close-circle-outline" variant="dangerOutline" onPress={confirmCancel} loading={cancelling} disabled={offline} />
        ) : (
          <Button title={t('visits.delete')} icon="trash-outline" variant="dangerOutline" onPress={remove} disabled={offline} />
        )}
      </View>
    </ScrollView>
  );
}

function Quote({ label, text, italic = false }: { label: string; text: string; italic?: boolean }) {
  return (
    <View style={styles.quote} accessible accessibilityLabel={`${label}: ${text}`}>
      <Text style={type.label}>{label}</Text>
      <Text style={[type.body, italic && styles.italic]}>{text}</Text>
    </View>
  );
}

/**
 * The rep's private notes, written in place: after a call is when they're worth writing, and a
 * closed booking still takes notes (the server allows notes alone). Kept as typed if saving fails.
 */
function NotesBlock({ visit, offline, onSaved }: { visit: Visit; offline: boolean; onSaved: (saved: Visit) => void }) {
  const t = useT();
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const notes = visit.notes?.trim() ?? '';
  const editing = draft !== null;

  async function save() {
    if (draft === null || saving) return;
    setSaving(true);
    setProblem(null);
    try {
      const saved = await saveVisitNotes(visit, draft.trim());
      onSaved(saved);
      setDraft(null);
    } catch (err) {
      setProblem(isNetworkError(err) ? t('common.needsConnection') : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.fact}>
      <View style={styles.notesHead}>
        <Text style={type.secondary}>{t('visits.form.notes')}</Text>
        <Ionicons name="lock-closed-outline" size={12} color={colors.textMuted} />
        <Text style={type.secondary}>{t('visits.form.notesHint')}</Text>
      </View>
      {editing ? (
        <>
          <TextInput
            value={draft}
            onChangeText={(v) => {
              setDraft(v);
              setProblem(null);
            }}
            multiline
            autoFocus
            maxLength={MAX_NOTES}
            style={styles.input}
            placeholder={t('visits.notes.empty')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('visits.form.notes')}
          />
          {problem ? <Text style={styles.error}>{problem}</Text> : null}
          <View style={styles.notesActions}>
            <Button title={t('common.cancel')} variant="secondary" onPress={() => setDraft(null)} disabled={saving} style={styles.flex} />
            <Button title={t('common.save')} onPress={save} loading={saving} disabled={draft.trim() === notes} style={styles.flex} />
          </View>
        </>
      ) : (
        <>
          <Text style={[type.body, !notes && styles.mutedText]}>{notes || t('visits.notes.empty')}</Text>
          <TouchableOpacity
            style={[styles.link, offline && styles.disabled]}
            onPress={() => setDraft(visit.notes ?? '')}
            disabled={offline}
            accessibilityRole="button"
            accessibilityState={{ disabled: offline }}
          >
            <Ionicons name={notes ? 'create-outline' : 'add-circle-outline'} size={18} color={colors.primaryOnSoft} />
            <Text style={styles.linkText}>{notes ? t('visits.notes.edit') : t('visits.notes.add')}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  status: { gap: spacing.sm, marginBottom: spacing.md },
  flex: { flex: 1 },
  // Same navy as Home's next visit: solid fill, no shadow.
  hero: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.md + 4, marginBottom: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  clinic: { fontSize: 22, fontWeight: '700', color: colors.primaryText, letterSpacing: -0.2, marginTop: spacing.sm },
  struck: { textDecorationLine: 'line-through', color: colors.onNavyMuted },
  whenRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xs, marginTop: spacing.sm + 4 },
  whenBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  when: { fontSize: 15, fontWeight: '600', color: colors.primaryText },
  // A clock time: tabular figures on the normal face (monospace spreads "14 : 30" on Android).
  time: { fontSize: 17, fontWeight: '700', color: colors.primaryText, fontVariant: ['tabular-nums'] },
  muted: { fontSize: 13, lineHeight: 18, color: colors.onNavyMuted },
  place: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs + 2, marginTop: spacing.sm },
  placeText: { flex: 1, fontSize: 14, lineHeight: 20 },
  next: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md - 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.navyLine,
  },
  nextText: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.primaryText },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  action: {
    flexGrow: 1,
    flexBasis: 128,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  actionPrimary: { backgroundColor: colors.primary },
  actionGhost: { borderWidth: 1, borderColor: colors.navyLine },
  actionText: { fontSize: 15, fontWeight: '600', color: colors.primaryText },
  disabled: { opacity: 0.5 },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.slate,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm + 4,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  italic: { fontStyle: 'italic' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  padded: { padding: spacing.md },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  fact: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, gap: 2 },
  product: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, minHeight: 48, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  notesHead: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  mutedText: { color: colors.textMuted },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, minHeight: 44, alignSelf: 'flex-start' },
  linkText: { fontSize: 15, fontWeight: '600', color: colors.primaryOnSoft },
  input: {
    minHeight: 112,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md - 4,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: 'top',
    marginTop: spacing.xs,
  },
  error: { fontSize: 13, color: colors.danger, marginTop: spacing.xs },
  notesActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  deliveries: { marginBottom: spacing.sm, gap: spacing.xs },
  foot: { gap: spacing.sm, marginTop: spacing.md },
});
