import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useT } from '@/lib/i18n';
import { deleteProduct, expiryState, useProduct } from '@/lib/products';
import { holdingsFor, useProductDeliveries } from '@/lib/deliveries';
import { daysFromToday, formatDay } from '@/lib/format';
import { colors, radius, spacing } from '@/lib/theme';
import { Product } from '@/lib/types';
import { type } from '@/lib/typography';
import { scheduleDelete } from '@/lib/undo';
import { ErrorState } from '@/components/ErrorState';
import { HoldingsChart } from '@/components/HoldingsChart';
import { ThinProgress } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { expiryWords, PRODUCT_STATUS_LABEL, productIcon } from '@/components/ProductCards';
import { Button, LoadingView, screenStyles, useBottomPadding } from '@/components/ui';

/** Days the hero's shelf-life meter spans, as on the catalog rows: a year; longer reads as full. */
const METER_DAYS = 365;

/**
 * One product: who makes it and how long it lasts (navy hero), the sheet a doctor asks about,
 * where it was delivered (bars per clinic, confirmed vs waiting), then Edit and Delete.
 */
export default function ProductDetailScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: product, loading, refreshing, error, offline, stale, updatedAt, refresh } = useProduct(id);
  const paddingBottom = useBottomPadding();
  const deliveries = useProductDeliveries(id);

  if (!product) {
    if (loading) return <LoadingView />;
    return <ErrorState message={error ?? t('common.failedToLoad')} onRetry={refresh} />;
  }

  function remove() {
    if (!product) return;
    scheduleDelete({
      id: product._id,
      message: t('products.deleted'),
      commit: () => deleteProduct(product._id),
      topics: ['products', 'dashboard'],
    });
    router.back();
  }

  const facts: [string, string | undefined][] = [
    [t('products.form.category'), product.category],
    [t('products.form.dosage'), product.dosage],
    [t('products.form.packaging'), product.packaging],
    [t('products.form.packSize'), product.packSize ? t('products.packOf', { count: product.packSize.count, unit: product.packSize.unit }) : undefined],
  ];
  const holdings = deliveries.data ? holdingsFor(product._id, deliveries.data) : null;

  return (
    <ScrollView
      style={screenStyles.container}
      contentContainerStyle={[screenStyles.content, { paddingBottom }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            refresh();
            deliveries.refresh();
          }}
          tintColor={colors.primary}
        />
      }
    >
      {stale || offline ? (
        <View style={styles.status}>
          <ThinProgress active={stale && !offline} />
          <OfflineBanner offline={offline} updatedAt={updatedAt} subject={t('products.offlineSubjectOne')} />
        </View>
      ) : null}

      <ProductHero product={product} />

      <View style={styles.card}>
        <Text style={type.cardTitle} accessibilityRole="header">
          {t('products.detail.sheet')}
        </Text>
        {product.description ? <Text style={[type.body, styles.description]}>{product.description}</Text> : null}
        {facts
          .filter(([, v]) => !!v)
          .map(([label, value]) => (
            <View key={label} style={styles.fact} accessible>
              <Text style={type.secondary}>{label}</Text>
              <Text style={[type.body, styles.factValue]}>{value}</Text>
            </View>
          ))}
      </View>

      {holdings && holdings.length ? <HoldingsChart rows={holdings} /> : null}
      {holdings && !holdings.length ? (
        <View style={styles.card}>
          <Text style={type.cardTitle} accessibilityRole="header">
            {t('deliveries.where.title')}
          </Text>
          <Text style={[type.secondary, styles.description]}>{t('deliveries.where.empty')}</Text>
        </View>
      ) : null}
      {!holdings && deliveries.error && !deliveries.loading ? (
        <TouchableOpacity style={[styles.card, styles.failed]} onPress={deliveries.refresh} accessibilityRole="button">
          <Ionicons name="refresh" size={18} color={colors.primaryOnSoft} />
          <Text style={[type.secondary, styles.flex]}>
            {t('deliveries.where.loadFailed')} <Text style={styles.link}>{t('common.tryAgain')}</Text>
          </Text>
        </TouchableOpacity>
      ) : null}

      <Button title={t('products.edit')} icon="create-outline" variant="secondary" onPress={() => router.push(`/products/${product._id}/edit`)} />
      <Button title={t('products.delete')} icon="trash-outline" variant="dangerOutline" onPress={remove} disabled={offline} />
      {offline ? <Text style={[type.secondary, styles.center]}>{t('common.needsConnection')}</Text> : null}
    </ScrollView>
  );
}

/**
 * The product on the app's navy: status, name, strength and maker, then its expiry — the date, the
 * days left in words and a one-year shelf-life meter (amber within 30 days; empty once expired).
 */
function ProductHero({ product }: { product: Product }) {
  const t = useT();
  const active = product.status === 'active';
  const state = expiryState(product);
  const date = formatDay(product.expiryDate, { month: 'short', day: 'numeric', year: 'numeric' });
  const days = daysFromToday(product.expiryDate);
  const fill = Math.max(0, Math.min(1, days / METER_DAYS));
  const sub = [product.strength, product.manufacturer].filter(Boolean).join(' · ');

  return (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <View style={styles.heroIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name={productIcon(product)} size={24} color={colors.primaryText} />
        </View>
        <View style={[styles.chip, active ? styles.chipActive : styles.chipMuted]}>
          <Text style={[styles.chipText, !active && { color: colors.onNavyMuted }]}>{t(PRODUCT_STATUS_LABEL[product.status])}</Text>
        </View>
      </View>
      <Text style={styles.name} accessibilityRole="header">
        {product.name}
      </Text>
      {sub ? <Text style={styles.muted}>{sub}</Text> : null}

      <View style={styles.expiry} accessible accessibilityLabel={`${t('products.expiry')}: ${date}, ${expiryWords(t, product.expiryDate)}`}>
        <View style={styles.expiryHead}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>{t('products.expiry')}</Text>
            <Text style={styles.date}>{date}</Text>
          </View>
          {state === 'ok' ? (
            <Text style={[styles.muted, styles.tabular]}>{expiryWords(t, product.expiryDate)}</Text>
          ) : (
            <View style={[styles.chip, state === 'expired' ? styles.chipExpired : styles.chipSoon]}>
              <Ionicons name={state === 'expired' ? 'alert-circle' : 'time'} size={14} color={state === 'expired' ? colors.danger : colors.warning} />
              <Text style={[styles.chipText, styles.tabular, { color: state === 'expired' ? colors.danger : colors.warning }]}>
                {expiryWords(t, product.expiryDate)}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.meter}>
          <View
            style={[
              styles.meterFill,
              { width: `${fill * 100}%`, backgroundColor: !active ? colors.onNavyMuted : state === 'soon' ? colors.warningSoft : colors.accent },
            ]}
          />
        </View>
        {!active ? <Text style={styles.muted}>{t('products.detail.notOffered')}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  status: { gap: spacing.sm, marginBottom: spacing.md },
  // Solid navy, no shadow (as Home's next visit).
  hero: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.md + 4, marginBottom: spacing.md },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.navyLine, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 24, fontWeight: '700', color: colors.primaryText, letterSpacing: -0.3, marginTop: spacing.md },
  muted: { fontSize: 13, lineHeight: 18, color: colors.onNavyMuted, marginTop: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  chipActive: { backgroundColor: colors.primary },
  chipMuted: { borderWidth: 1, borderColor: colors.navyLine },
  chipSoon: { backgroundColor: colors.warningSoft },
  chipExpired: { backgroundColor: colors.dangerSoft },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.primaryText },
  expiry: { marginTop: spacing.md, paddingTop: spacing.sm + 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.navyLine, gap: spacing.sm },
  expiryHead: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' },
  eyebrow: { fontSize: 12, fontWeight: '600', color: colors.onNavyMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  date: { fontSize: 17, fontWeight: '700', color: colors.primaryText, fontVariant: ['tabular-nums'], marginTop: 2 },
  meter: { height: 6, borderRadius: 3, backgroundColor: colors.navyLine, overflow: 'hidden' },
  meterFill: { height: 6, borderRadius: 3 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  description: { marginTop: spacing.sm, marginBottom: spacing.sm },
  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    flexWrap: 'wrap',
  },
  factValue: { textAlign: 'right', flexShrink: 1 },
  failed: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  link: { fontWeight: '700', color: colors.primaryOnSoft },
});
