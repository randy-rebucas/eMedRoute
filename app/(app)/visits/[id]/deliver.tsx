import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, errorMessage } from '@/lib/api';
import { canDeliver, createDelivery, MAX_DELIVERY_LINES, MAX_DELIVERY_UNIT } from '@/lib/deliveries';
import { emitRefresh } from '@/lib/events';
import { useT } from '@/lib/i18n';
import { useActiveProducts } from '@/lib/products';
import { colors, radius, spacing } from '@/lib/theme';
import { DeliveryKind, Product } from '@/lib/types';
import { type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { useVisit } from '@/lib/visits';
import { ErrorState } from '@/components/ErrorState';
import { Field } from '@/components/forms';
import { ChoiceChips, DateField, FilterChips } from '@/components/pickers';
import { productLabel } from '@/components/ProductPicker';
import { productIcon } from '@/components/ProductCards';
import { Banner, Button, IconTile, LoadingView, screenStyles, useBottomPadding } from '@/components/ui';

/**
 * Common units. The word is what the clinic reads (and stays English); the chip shows it in the
 * rep's language. A product with a pack size also offers its loose unit ("tablets"), so loose
 * units aren't recorded as "pieces" and multiplied by the pack size at the clinic.
 */
const UNITS = ['boxes', 'packs', 'bottles', 'vials', 'pieces'] as const;
const UNIT_LABEL = {
  boxes: 'deliveries.unit.boxes',
  packs: 'deliveries.unit.packs',
  bottles: 'deliveries.unit.bottles',
  vials: 'deliveries.unit.vials',
  pieces: 'deliveries.unit.pieces',
} as const;

function unitsFor(product: Product, current: string): string[] {
  const units: string[] = [...UNITS];
  const loose = product.packSize?.unit?.trim();
  if (loose && loose.length <= MAX_DELIVERY_UNIT && !units.some((u) => u.toLowerCase() === loose.toLowerCase())) units.push(loose);
  if (current && !units.includes(current)) units.unshift(current);
  return units;
}

type Line = { key: number; product: Product; quantity: string; unit: string; lot: string; expiry: string };

/**
 * Record what the rep left at a visit's clinic: samples or a delivery, one line per product with
 * quantity, unit, and optionally the lot and batch expiry. The clinic confirms what arrived.
 */
export default function RecordDeliveryScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: visit, loading, error: loadError, refresh } = useVisit(id);
  const { data: products, loading: productsLoading } = useActiveProducts();
  const paddingBottom = useBottomPadding();
  const [kind, setKind] = useState<DeliveryKind>('sample');
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState('');
  const [picking, setPicking] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  // State lags a frame: two taps in one frame must not record the delivery twice.
  const sending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [nextKey, setNextKey] = useState(1);

  if (!visit) {
    if (loading) return <LoadingView />;
    return <ErrorState message={loadError ?? t('common.failedToLoad')} onRetry={refresh} />;
  }

  const update = (key: number, patch: Partial<Line>) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    setError(null);
  };
  const badQuantity = (l: Line) => !/^\d+$/.test(l.quantity.trim()) || Number(l.quantity) < 1 || Number(l.quantity) > 100000;

  function add(product: Product) {
    setLines((ls) => [...ls, { key: nextKey, product, quantity: '', unit: UNITS[0], lot: '', expiry: '' }]);
    setNextKey((k) => k + 1);
    setPicking(false);
    setError(null);
  }

  async function send() {
    if (sending.current || !visit) return;
    setSubmitted(true);
    if (!lines.length) {
      setError(t('deliveries.form.needLine'));
      return;
    }
    if (lines.some(badQuantity) || lines.some((l) => !l.unit.trim() || l.unit.trim().length > MAX_DELIVERY_UNIT)) return;
    sending.current = true;
    setSaving(true);
    setError(null);
    try {
      await createDelivery({
        visitId: visit._id,
        kind,
        note: note.trim() || undefined,
        lines: lines.map((l) => ({
          productId: l.product._id,
          quantity: Number(l.quantity),
          unit: l.unit.trim().slice(0, MAX_DELIVERY_UNIT),
          lotNumber: l.lot.trim() || undefined,
          expiryDate: l.expiry || undefined,
        })),
      });
      router.back();
    } catch (err) {
      if (isNetworkError(err)) setError(t('common.needsConnection'));
      else if (err instanceof ApiError && err.code === 'VISIT_CANT_DELIVER') {
        setError(t('deliveries.error.cantDeliver'));
        // The visit or the clinic changed: show it as it is now.
        emitRefresh('visits', 'clinics');
      } else if (err instanceof ApiError && err.code === 'SUBSCRIPTION_REQUIRED') {
        // Plan opens on top, so the lines are still here when the rep comes back.
        emitRefresh('subscription');
        router.push('/plan');
        setError(t('deliveries.error.needsPlan'));
      } else setError(errorMessage(err));
    } finally {
      sending.current = false;
      setSaving(false);
    }
  }

  const usedIds = new Set(lines.map((l) => l.product._id));
  const choices = (products ?? []).filter((p) => !usedIds.has(p._id));

  return (
    <KeyboardAvoidingView style={screenStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={96}>
      <ScrollView contentContainerStyle={[screenStyles.content, { paddingBottom }]} keyboardShouldPersistTaps="handled">
        <Text style={[type.secondary, styles.intro]}>{t('deliveries.form.intro', { clinic: visit.clinicName })}</Text>
        {!canDeliver(visit) ? <Banner message={t('deliveries.error.cantDeliver')} tone="warning" /> : null}

        <ChoiceChips
          label={t('deliveries.form.kind')}
          options={[
            { value: 'sample', label: t('deliveries.kind.sample') },
            { value: 'delivery', label: t('deliveries.kind.delivery') },
          ]}
          value={kind}
          onChange={setKind}
        />

        <Text style={[type.label, styles.linesLabel]} accessibilityRole="header">
          {t('deliveries.form.lines')}
        </Text>
        {lines.map((l) => (
          <View key={l.key} style={styles.line}>
            <View style={styles.lineHead}>
              <IconTile icon={productIcon(l.product)} tone="slate" size={36} />
              <Text style={[type.cardTitle, styles.flex]}>{productLabel(l.product)}</Text>
              <TouchableOpacity
                onPress={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                hitSlop={12}
                style={styles.remove}
                accessibilityRole="button"
                accessibilityLabel={t('deliveries.form.removeLine', { name: productLabel(l.product) })}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </TouchableOpacity>
            </View>
            <Field
              label={t('deliveries.form.quantity')}
              value={l.quantity}
              onChangeText={(v) => update(l.key, { quantity: v.replace(/[^\d]/g, '') })}
              keyboardType="number-pad"
              maxLength={6}
              error={submitted && badQuantity(l) ? t('deliveries.form.needQuantity') : null}
            />
            <Text style={type.label}>{t('deliveries.form.unit')}</Text>
            <FilterChips
              label={t('deliveries.form.unit')}
              options={unitsFor(l.product, l.unit).map((u) => ({
                value: u,
                label: u in UNIT_LABEL ? t(UNIT_LABEL[u as keyof typeof UNIT_LABEL]) : u,
              }))}
              value={l.unit}
              onChange={(u) => update(l.key, { unit: u })}
            />
            {l.product.packSize ? (
              <Text style={[type.secondary, styles.hint]}>
                {t('deliveries.form.packHint', { count: l.product.packSize.count, unit: l.product.packSize.unit })}
              </Text>
            ) : null}
            <Field label={t('deliveries.form.lot')} optional value={l.lot} onChangeText={(v) => update(l.key, { lot: v })} maxLength={60} autoCapitalize="characters" />
            <DateField label={t('deliveries.form.expiry')} value={l.expiry} onChange={(d) => update(l.key, { expiry: d })} />
            {l.expiry ? (
              <TouchableOpacity onPress={() => update(l.key, { expiry: '' })} style={styles.clear} accessibilityRole="button">
                <Text style={styles.clearText}>{t('deliveries.form.expiryHint')}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[type.secondary, styles.hint]}>{t('deliveries.form.expiryHint')}</Text>
            )}
          </View>
        ))}

        {lines.length < MAX_DELIVERY_LINES ? (
          <TouchableOpacity style={styles.add} onPress={() => setPicking(true)} accessibilityRole="button">
            <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
            <Text style={styles.addText}>{t('deliveries.form.addLine')}</Text>
          </TouchableOpacity>
        ) : null}

        <Field label={t('deliveries.form.note')} optional value={note} onChangeText={setNote} maxLength={1000} multiline />
        {error ? <Banner message={error} /> : null}
        <Button title={t('deliveries.form.send')} icon="send-outline" onPress={send} loading={saving} disabled={!canDeliver(visit)} />
      </ScrollView>

      <Modal visible={picking} animationType="slide" onRequestClose={() => setPicking(false)}>
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <View style={styles.modalHead}>
            <Text style={type.cardTitle} accessibilityRole="header">
              {t('deliveries.form.choose')}
            </Text>
            <TouchableOpacity onPress={() => setPicking(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.cancel')}>
              <Ionicons name="close-outline" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={choices}
            keyExtractor={(p) => p._id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              // Still loading the products: a spinner, not "No products".
              products == null && productsLoading ? (
                <ActivityIndicator color={colors.primary} style={styles.loadingProducts} />
              ) : (
                <Text style={type.secondary}>{t('deliveries.form.noProducts')}</Text>
              )
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.option} onPress={() => add(item)} accessibilityRole="button">
                <IconTile icon={productIcon(item)} tone="slate" size={40} />
                <View style={styles.flex}>
                  <Text style={type.body}>{productLabel(item)}</Text>
                  <Text style={type.secondary}>{[item.category, item.packaging].filter(Boolean).join(' · ')}</Text>
                </View>
                <Ionicons name="add-outline" size={22} color={colors.primary} />
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: { marginBottom: spacing.md },
  linesLabel: { marginBottom: spacing.sm },
  line: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  lineHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, marginBottom: spacing.sm },
  remove: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  hint: { marginTop: -spacing.sm },
  clear: { minHeight: 48, justifyContent: 'center', marginTop: -spacing.sm },
  clearText: { fontSize: 14, fontWeight: '600', color: colors.primaryOnSoft },
  add: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, alignSelf: 'flex-start', marginBottom: spacing.md },
  addText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  modal: { flex: 1, backgroundColor: colors.background },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  loadingProducts: { marginTop: spacing.lg },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    minHeight: 56,
    padding: spacing.sm + 4,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
