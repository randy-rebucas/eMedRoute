import { router } from 'expo-router';
import { useT } from '@/lib/i18n';
import { createProduct } from '@/lib/products';
import { ProductForm } from '@/components/ProductForm';

/** Add a product. Lands on its sheet. */
export default function NewProductScreen() {
  const t = useT();
  return (
    <ProductForm
      submitLabel={t('products.form.saveNew')}
      onSubmit={async (input) => {
        const product = await createProduct(input);
        router.replace(`/products/${product._id}`);
      }}
    />
  );
}
