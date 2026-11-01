import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
import { Button, LoadingView, screenStyles, useBottomPadding } from '@/components/ui';
import { nextStepText, visitA11yLabel } from '@/components/VisitRow';

/** One visit: status and who acts next, the clinic's words, the details, and what the rep can do. */
export default function VisitDetailScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: visit, loading, refreshing, error, offline, stale, updatedAt, refresh } = useVisit(id);
  const { data: activeProducts } = useActiveProducts();
  const paddingBottom = useBottomPadding();

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
        </View>
      ) : null}

      {visit.clinicNote ? (
        <View style={styles.quote} accessible accessibilityLabel={`${t('visits.clinicWrote', { clinic: visit.clinicName })}: ${visit.clinicNote}`}>
          <Text style={type.label}>{t('visits.clinicWrote', { clinic: visit.clinicName })}</Text>
          <Text style={[type.body, styles.quoteText]}>“{visit.clinicNote}”</Text>
        </View>
      ) : null}

      <View style={styles.facts}>
        <Fact label={t('visits.detail.place')}>
          <Text style={type.body}>{visit.clinicLocation}</Text>
        </Fact>
        <Fact label={t('visits.detail.length')}>
          <Text style={[type.body, mono]}>{t('visits.minutes', { minutes: visit.duration })}</Text>
        </Fact>
        <Fact label={own ? t('visits.form.purpose') : t('visits.form.purposeShared')}>
          <Text style={type.body}>{visit.purpose}</Text>
        </Fact>
        {products.length ? (
          <Fact label={t('visits.form.products')}>
            {known.map((p) => (
              <Text key={p!._id} style={type.body} onPress={() => router.push(`/products/${p!._id}`)} accessibilityRole="link">
                {productLabel(p!)}
              </Text>
            ))}
            {unknownCount ? <Text style={type.secondary}>{t('visits.detail.productsInactive', { count: unknownCount })}</Text> : null}
          </Fact>
        ) : null}
        <Fact label={t('visits.form.notes')} hint={t('visits.form.notesHint')} last>
          <Text style={[type.body, !visit.notes && styles.muted]}>{visit.notes || t('visits.detail.noNotes')}</Text>
        </Fact>
      </View>

      {upcoming && visit.clinicLocation ? (
        <Button
          title={t('home.directions')}
          icon="navigate-outline"
          variant="secondary"
          onPress={() => openDirections(`${visit.clinicName}, ${visit.clinicLocation}`).catch(() => {})}
        />
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

function Fact({ label, hint, last = false, children }: { label: string; hint?: string; last?: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.fact, last && styles.factLast]}>
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
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs, marginBottom: spacing.md },
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
  fact: { paddingVertical: spacing.sm + 4, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  factLast: { borderBottomWidth: 0 },
  muted: { color: colors.textMuted },
});
