import { router, useLocalSearchParams } from 'expo-router';
import { useT } from '@/lib/i18n';
import { updateProduct, useProduct } from '@/lib/products';
import { ErrorState, NotFoundState } from '@/components/ErrorState';
import { ProductForm } from '@/components/ProductForm';
import { LoadingView } from '@/components/ui';

/** Edit a product (PUT takes the full object). */
export default function EditProductScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: product, loading, error, offline, stale, refresh, notFound } = useProduct(id);

  // Only the server's copy is edited: a saved offline copy could save over newer changes.
  if (!product || stale) {
    if (notFound) return <NotFoundState />;
    if (loading || (stale && !offline && !error)) return <LoadingView />;
    return <ErrorState message={offline ? t('common.editNeedsConnection') : (error ?? t('common.failedToLoad'))} onRetry={refresh} />;
  }

  return (
    <ProductForm
      product={product}
      submitLabel={t('common.save')}
      onSubmit={async (input) => {
        await updateProduct(product._id, input);
        router.back();
      }}
    />
  );
}
