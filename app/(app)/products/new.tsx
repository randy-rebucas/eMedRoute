import { router } from 'expo-router';
import { useT } from '@/lib/i18n';
import { createProduct } from '@/lib/products';
import { useRequestKey } from '@/lib/requestKey';
import { ProductForm } from '@/components/ProductForm';

/** Add a product. Lands on its sheet. */
export default function NewProductScreen() {
  const t = useT();
  // A resend after a timeout must not add the product twice.
  const requestKey = useRequestKey();
  return (
    <ProductForm
      submitLabel={t('products.form.saveNew')}
      onSubmit={async (input) => {
        const product = await createProduct(input, requestKey(input));
        router.replace(`/products/${product._id}`);
      }}
    />
  );
}
