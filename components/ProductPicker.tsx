import { useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '@/lib/i18n';
import { useActiveProducts } from '@/lib/products';
import { colors, radius, spacing } from '@/lib/theme';
import { Product } from '@/lib/types';
import { mono, type } from '@/lib/typography';
import { Button, LoadingView } from './ui';

/** Most products one visit can carry (server: MAX_VISIT_PRODUCTS). */
export const MAX_VISIT_PRODUCTS = 10;

/** Name and strength, e.g. "Amlodipine 5 mg". */
export const productLabel = (p: Pick<Product, 'name' | 'strength'>) => [p.name, p.strength].filter(Boolean).join(' ');

/**
 * "Products (optional)": the chosen products as chips, and a full-screen list of the rep's
 * active products to choose up to 10 from.
 */
export function ProductPickerField({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { data: products, loading, error } = useActiveProducts();
  const byId = new Map((products ?? []).map((p) => [p._id, p]));

  return (
    <View style={styles.field}>
      <Text style={type.label}>
        {t('visits.form.products')} <Text style={styles.optional}>{t('common.optional')}</Text>
      </Text>
      {value.length ? (
        <View style={styles.chips}>
          {value.map((id) => {
            const p = byId.get(id);
            const name = p ? productLabel(p) : t('visits.form.productUnavailable');
            return (
              <TouchableOpacity
                key={id}
                style={styles.chip}
                onPress={() => onChange(value.filter((v) => v !== id))}
                accessibilityRole="button"
                accessibilityLabel={t('visits.form.removeProduct', { name })}
              >
                <Text style={styles.chipText}>{name}</Text>
                <Ionicons name="close-outline" size={18} color={colors.primaryOnSoft} />
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
      <TouchableOpacity style={styles.add} onPress={() => setOpen(true)} accessibilityRole="button">
        <Ionicons name="add-outline" size={20} color={colors.primary} />
        <Text style={styles.addText}>{value.length ? t('visits.form.changeProducts') : t('visits.form.addProducts')}</Text>
      </TouchableOpacity>
      <Text style={type.secondary}>{t('visits.form.productsHint', { max: MAX_VISIT_PRODUCTS })}</Text>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <View style={styles.modalHead}>
            <Text style={type.cardTitle} accessibilityRole="header">
              {t('visits.form.chooseProducts')}
            </Text>
            <Text style={[type.secondary, mono]}>
              {value.length}/{MAX_VISIT_PRODUCTS}
            </Text>
          </View>
          {loading && !products ? (
            <LoadingView />
          ) : (
            <FlatList
              data={products ?? []}
              keyExtractor={(p) => p._id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={<Text style={type.secondary}>{error ?? t('visits.form.noActiveProducts')}</Text>}
              renderItem={({ item }) => {
                const selected = value.includes(item._id);
                const full = !selected && value.length >= MAX_VISIT_PRODUCTS;
                return (
                  <TouchableOpacity
                    style={[styles.option, selected && styles.optionSelected, full && styles.optionDisabled]}
                    disabled={full}
                    onPress={() => onChange(selected ? value.filter((v) => v !== item._id) : [...value, item._id])}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected, disabled: full }}
                  >
                    <Ionicons name={selected ? 'checkbox-outline' : 'square-outline'} size={22} color={selected ? colors.primary : colors.textMuted} />
                    <View style={styles.optionText}>
                      <Text style={type.body}>{productLabel(item)}</Text>
                      <Text style={type.secondary}>{[item.category, item.manufacturer].filter(Boolean).join(' · ')}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
          <View style={styles.footer}>
            <Button title={t('common.done')} onPress={() => setOpen(false)} />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md, gap: spacing.xs + 2 },
  optional: { fontWeight: '400', color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 48,
    paddingHorizontal: spacing.sm + 4,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
  },
  chipText: { fontSize: 15, color: colors.primaryOnSoft, fontWeight: '600' },
  add: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 48, alignSelf: 'flex-start' },
  addText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  modal: { flex: 1, backgroundColor: colors.background },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    padding: spacing.sm + 4,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary },
  optionDisabled: { opacity: 0.5 },
  optionText: { flex: 1, gap: 2 },
  footer: { paddingHorizontal: spacing.md },
});
