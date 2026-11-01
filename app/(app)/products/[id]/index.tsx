import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useT } from '@/lib/i18n';
import { deleteProduct, useProduct } from '@/lib/products';
import { holdingsFor, useProductDeliveries } from '@/lib/deliveries';
import { formatDate } from '@/lib/format';
import { colors, radius, spacing } from '@/lib/theme';
import { mono, type } from '@/lib/typography';
import { scheduleDelete } from '@/lib/undo';
import { ErrorState } from '@/components/ErrorState';
import { ThinProgress } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ProductSheetCard } from '@/components/ProductCards';
import { Button, IconTile, LoadingView, screenStyles, SectionHeader, useBottomPadding } from '@/components/ui';

/** One product's sheet, as shown to a doctor, where it has been delivered, and Edit and Delete. */
export default function ProductDetailScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: product, loading, refreshing, error, offline, stale, updatedAt, refresh } = useProduct(id);
  const paddingBottom = useBottomPadding();
  const { data: deliveries } = useProductDeliveries(id);

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

  return (
    <ScrollView
      style={screenStyles.container}
      contentContainerStyle={[screenStyles.content, { paddingBottom }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <ThinProgress active={stale && !offline} />
      <OfflineBanner offline={offline} updatedAt={updatedAt} subject={t('products.offlineSubjectOne')} />
      <ProductSheetCard product={product} />
      <WhereItIs productId={product._id} deliveries={deliveries} />
      <Button title={t('products.edit')} icon="create-outline" variant="secondary" onPress={() => router.push(`/products/${product._id}/edit`)} />
      <Button title={t('products.delete')} icon="trash-outline" variant="dangerOutline" onPress={remove} disabled={offline} />
    </ScrollView>
  );
}

/** The clinics this product went to: units each confirmed, units still waiting, the last date. */
function WhereItIs({ productId, deliveries }: { productId: string; deliveries: Parameters<typeof holdingsFor>[1] | null }) {
  const t = useT();
  if (!deliveries) return null;
  const rows = holdingsFor(productId, deliveries);
  return (
    <View style={styles.where}>
      <SectionHeader title={t('deliveries.where.title')} />
      {!rows.length ? <Text style={type.secondary}>{t('deliveries.where.empty')}</Text> : null}
      {rows.length ? (
        <View style={styles.panel}>
          {rows.map((r, i) => (
            <View key={`${r.clinicId}|${r.unit}`} style={[styles.row, i > 0 && styles.rowRule]} accessible>
              <IconTile icon="business-outline" tone="slate" size={36} />
              <View style={styles.rowText}>
                <Text style={type.body}>{r.clinicName}</Text>
                {r.received ? (
                  <Text style={[type.secondary, styles.received]}>
                    <Text style={mono}>{r.received}</Text> {t('deliveries.where.received', { unit: r.unit })}
                  </Text>
                ) : null}
                {r.pending ? (
                  <Text style={[type.secondary, styles.pending]}>
                    <Text style={mono}>{r.pending}</Text> {t('deliveries.where.pending', { unit: r.unit })}
                  </Text>
                ) : null}
              </View>
              <Text style={type.secondary}>{t('deliveries.where.last', { date: formatDate(r.lastAt, { month: 'short', day: 'numeric' }) })}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  where: { marginBottom: spacing.md, gap: spacing.xs },
  panel: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, padding: spacing.sm + 4, minHeight: 56 },
  rowRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowText: { flex: 1, gap: 2 },
  received: { color: colors.text },
  pending: { color: colors.warning },
});
