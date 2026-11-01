import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { errorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { Product, ProductInput, ProductStatus } from '@/lib/types';
import { isNetworkError } from '@/lib/useApiData';
import { Field } from './forms';
import { ChoiceChips, DateField } from './pickers';
import { Banner, Button, screenStyles, useBottomPadding } from './ui';

// Server limits (app/api/medical-representatives/products/route.ts).
const MAX = { name: 200, category: 100, manufacturer: 200, description: 2000, packaging: 200, dosage: 200, strength: 200 } as const;

type TextKey = 'name' | 'category' | 'manufacturer' | 'description' | 'packaging' | 'dosage' | 'strength';
type FormState = Record<TextKey, string> & { expiryDate: string; status: ProductStatus };
const REQUIRED: TextKey[] = ['name', 'category', 'manufacturer', 'description', 'packaging'];

function initial(p?: Product): FormState {
  return {
    name: p?.name ?? '',
    category: p?.category ?? '',
    manufacturer: p?.manufacturer ?? '',
    description: p?.description ?? '',
    packaging: p?.packaging ?? '',
    dosage: p?.dosage ?? '',
    strength: p?.strength ?? '',
    expiryDate: p?.expiryDate.slice(0, 10) ?? '',
    status: p?.status ?? 'active',
  };
}

/** Add or edit a product. Every field stays as typed if saving fails. */
export function ProductForm({
  product,
  submitLabel,
  onSubmit,
}: {
  product?: Product;
  submitLabel: string;
  onSubmit: (input: ProductInput) => Promise<void>;
}) {
  const t = useT();
  const [form, setForm] = useState<FormState>(() => initial(product));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paddingBottom = useBottomPadding();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };
  const missing = (key: TextKey | 'expiryDate') => (submitted && !form[key].trim() ? t('profile.required') : null);

  async function save() {
    if (saving) return;
    setSubmitted(true);
    if (REQUIRED.some((k) => !form[k].trim()) || !form.expiryDate) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: form.name.trim(),
        category: form.category.trim(),
        manufacturer: form.manufacturer.trim(),
        description: form.description.trim(),
        packaging: form.packaging.trim(),
        dosage: form.dosage.trim() || undefined,
        strength: form.strength.trim() || undefined,
        expiryDate: form.expiryDate,
        status: form.status,
      });
    } catch (err) {
      setError(isNetworkError(err) ? t('common.needsConnection') : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const text = (key: TextKey, label: string, extra: { optional?: boolean; multiline?: boolean; hint?: string } = {}) => (
    <Field
      label={label}
      value={form[key]}
      onChangeText={(v) => set(key, v)}
      maxLength={MAX[key]}
      optional={extra.optional}
      multiline={extra.multiline}
      hint={extra.hint}
      error={extra.optional ? null : missing(key)}
    />
  );

  return (
    <KeyboardAvoidingView style={screenStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={96}>
      <ScrollView contentContainerStyle={[screenStyles.content, { paddingBottom }]} keyboardShouldPersistTaps="handled">
        {error ? <Banner message={error} /> : null}
        {text('name', t('products.form.name'))}
        {text('strength', t('products.form.strength'), { optional: true, hint: t('products.form.strengthHint') })}
        {text('dosage', t('products.form.dosage'), { optional: true, hint: t('products.form.dosageHint') })}
        {text('category', t('products.form.category'), { hint: t('products.form.categoryHint') })}
        {text('manufacturer', t('products.form.manufacturer'))}
        {text('packaging', t('products.form.packaging'), { hint: t('products.form.packagingHint') })}
        {text('description', t('products.form.description'), { multiline: true })}
        <DateField label={t('products.expiry')} value={form.expiryDate} onChange={(v) => set('expiryDate', v)} error={missing('expiryDate')} />
        <ChoiceChips
          label={t('products.form.status')}
          options={[
            { value: 'active', label: t('products.status.active') },
            { value: 'discontinued', label: t('products.status.discontinued') },
            { value: 'inactive', label: t('products.status.inactive') },
          ]}
          value={form.status}
          onChange={(v) => set('status', v)}
        />
        <Button title={submitLabel} onPress={save} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
