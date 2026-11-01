import { RefreshControl, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useT } from '@/lib/i18n';
import { deleteProduct, useProduct } from '@/lib/products';
import { colors } from '@/lib/theme';
import { scheduleDelete } from '@/lib/undo';
import { ErrorState } from '@/components/ErrorState';
import { ThinProgress } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ProductSheetCard } from '@/components/ProductCards';
import { Button, LoadingView, screenStyles, useBottomPadding } from '@/components/ui';

/** One product's sheet, as shown to a doctor, with Edit and Delete. */
export default function ProductDetailScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: product, loading, refreshing, error, offline, stale, updatedAt, refresh } = useProduct(id);
  const paddingBottom = useBottomPadding();

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
      <Button title={t('products.edit')} icon="create-outline" variant="secondary" onPress={() => router.push(`/products/${product._id}/edit`)} />
      <Button title={t('products.delete')} icon="trash-outline" variant="dangerOutline" onPress={remove} disabled={offline} />
    </ScrollView>
  );
}
