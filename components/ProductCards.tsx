import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { daysFromToday, formatDay } from '@/lib/format';
import { PlainKey, TFunction, useT } from '@/lib/i18n';
import { expiryState, ExpiryState } from '@/lib/products';
import { colors, radius, spacing } from '@/lib/theme';
import { Product, ProductStatus } from '@/lib/types';
import { type } from '@/lib/typography';
import { productLabel } from './ProductPicker';
import { IconName, IconTile } from './ui';

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, PlainKey> = {
  active: 'products.status.active',
  discontinued: 'products.status.discontinued',
  inactive: 'products.status.inactive',
};

const EXPIRY_LOOK: Record<Exclude<ExpiryState, 'ok'>, { icon: IconName; bg: string; fg: string; label: PlainKey }> = {
  soon: { icon: 'time-outline', bg: colors.warningSoft, fg: colors.warning, label: 'products.expiringSoon' },
  expired: { icon: 'alert-circle-outline', bg: colors.dangerSoft, fg: colors.danger, label: 'products.expired' },
};

/** "Expires in 12 days" / "Expired 3 days ago" / "Expires today". */
export function expiryWords(t: TFunction, expiryDate: string): string {
  const days = daysFromToday(expiryDate);
  if (days === 0) return t('products.expiresToday');
  return days > 0 ? t('products.expiresIn', { count: days }) : t('products.expiredAgo', { count: -days });
}

/** An icon for the product's dosage form, read from the free-text dosage and packaging fields. */
export function productIcon(product: Pick<Product, 'dosage' | 'packaging' | 'category'>): IconName {
  const text = [product.dosage, product.packaging, product.category].filter(Boolean).join(' ').toLowerCase();
  if (/inject|vial|ampul|syringe|\b(iv|im)\b/.test(text)) return 'medical-outline';
  if (/drop|ophthal|\b(eye|ear)\b/.test(text)) return 'eyedrop-outline';
  if (/syrup|suspension|solution|liquid|bottle|oral sol|elixir/.test(text)) return 'flask-outline';
  if (/cream|ointment|gel|lotion|topical|patch/.test(text)) return 'bandage-outline';
  if (/inhal|spray|nebul|aerosol/.test(text)) return 'cloud-outline';
  if (/tablet|capsule|caplet|pill|\b(tabs?|caps?)\b/.test(text)) return 'medkit-outline';
  return 'cube-outline';
}

/** Days of shelf life the row meter spans: a year; longer reads as full. */
const METER_DAYS = 365;

/**
 * One product in the catalog list. Rows join into one ruled card (`first`/`last` round its ends).
 * Under the name, a slim meter shows the shelf life left on a one-year scale, in the expiry
 * badge's colour, with the date and the days in words beside it.
 */
export function ProductRow({ product, first = true, last = true }: { product: Product; first?: boolean; last?: boolean }) {
  const t = useT();
  const expiry = formatDay(product.expiryDate, { month: 'short', day: 'numeric', year: 'numeric' });
  const state = expiryState(product);
  const daysLeft = daysFromToday(product.expiryDate);
  const meterColor = product.status !== 'active' ? colors.border : state === 'expired' ? colors.danger : state === 'soon' ? colors.warning : colors.slate;
  const fill = Math.max(0, Math.min(1, daysLeft / METER_DAYS));
  const a11y = [
    productLabel(product),
    product.category,
    t(PRODUCT_STATUS_LABEL[product.status]),
    state === 'ok' ? t('products.expiresOn', { date: expiry }) : `${t(EXPIRY_LOOK[state].label)}, ${expiryWords(t, product.expiryDate)}`,
  ].join(', ');

  return (
    <TouchableOpacity
      style={[styles.row, !first && styles.rowRule, first && styles.rowFirst, last && styles.rowLast]}
      onPress={() => router.push(`/products/${product._id}`)} accessibilityRole="button" accessibilityLabel={a11y}>
      <View style={styles.rowIcon}>
        <IconTile icon={productIcon(product)} tone={product.status === 'active' ? 'slate' : 'neutral'} size={44} />
      </View>
      <View style={styles.rowBody}>
        <Text style={type.cardTitle}>{productLabel(product)}</Text>
        <Text style={type.secondary} numberOfLines={1}>
          {[product.category, product.dosage, product.packaging].filter(Boolean).join(' · ')}
        </Text>
        <View style={styles.meterRow}>
          <View style={styles.meter} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={[styles.meterFill, { width: `${fill * 100}%`, backgroundColor: meterColor }]} />
          </View>
          {/* Words for active stock ("Expires in 16 days"), the date for the rest; both are in the label. */}
          <Text
            style={[
              type.secondary,
              styles.meterText,
              state === 'expired' && styles.textExpired,
              state === 'soon' && styles.textSoon,
            ]}
            numberOfLines={1}
          >
            {state === 'expired' ? <Ionicons name="alert-circle" size={13} color={colors.danger} /> : null}
            {state === 'soon' ? <Ionicons name="time" size={13} color={colors.warning} /> : null}
            {state === 'ok' ? '' : ' '}
            {product.status === 'active' ? expiryWords(t, product.expiryDate) : t('products.expiresOnLine', { date: expiry })}
          </Text>
        </View>
        {product.status !== 'active' ? (
          <View style={styles.badges}>
            <View style={[styles.badge, styles.badgeMuted]}>
              <Text style={[type.pill, { color: colors.textMuted }]}>{t(PRODUCT_STATUS_LABEL[product.status])}</Text>
            </View>
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Rows of one ruled card: side borders always, top/bottom ends only at the first/last row.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  rowRule: { borderTopWidth: StyleSheet.hairlineWidth },
  rowFirst: { borderTopWidth: 1, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  rowLast: { borderBottomWidth: 1, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, marginBottom: spacing.md },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs + 2 },
  meter: { width: 56, height: 4, borderRadius: 2, backgroundColor: colors.slateSoft, overflow: 'hidden' },
  meterFill: { height: 4, borderRadius: 2 },
  meterText: { flex: 1, fontVariant: ['tabular-nums'] },
  tabular: { fontVariant: ['tabular-nums'] },
  textExpired: { color: colors.danger, fontWeight: '600' },
  textSoon: { color: colors.warning, fontWeight: '600' },
  rowIcon: { alignSelf: 'flex-start' },
  rowBody: { flex: 1, gap: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  badgeMuted: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
});
