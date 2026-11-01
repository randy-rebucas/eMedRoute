import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { daysFromToday, formatDay } from '@/lib/format';
import { PlainKey, TFunction, useT } from '@/lib/i18n';
import { expiryState, ExpiryState } from '@/lib/products';
import { colors, radius, spacing } from '@/lib/theme';
import { Product, ProductStatus } from '@/lib/types';
import { mono, type } from '@/lib/typography';
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

/** Expiring-soon (amber) or expired (red) badge, in words with an icon; nothing when fine. */
export function ExpiryBadge({ product }: { product: Pick<Product, 'expiryDate' | 'status'> }) {
  const t = useT();
  const state = expiryState(product);
  if (state === 'ok') return null;
  const look = EXPIRY_LOOK[state];
  return (
    <View style={[styles.badge, { backgroundColor: look.bg }]}>
      <Ionicons name={look.icon} size={14} color={look.fg} />
      <Text style={[type.pill, { color: look.fg }]} maxFontSizeMultiplier={1.6}>
        {t(look.label)}
      </Text>
    </View>
  );
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

/** One product in the catalog list. */
export function ProductRow({ product }: { product: Product }) {
  const t = useT();
  const expiry = formatDay(product.expiryDate, { month: 'short', day: 'numeric', year: 'numeric' });
  const state = expiryState(product);
  const a11y = [
    productLabel(product),
    product.category,
    t(PRODUCT_STATUS_LABEL[product.status]),
    state === 'ok' ? t('products.expiresOn', { date: expiry }) : `${t(EXPIRY_LOOK[state].label)}, ${expiryWords(t, product.expiryDate)}`,
  ].join(', ');

  return (
    <TouchableOpacity style={styles.row} onPress={() => router.push(`/products/${product._id}`)} accessibilityRole="button" accessibilityLabel={a11y}>
      <View style={styles.rowIcon}>
        <IconTile icon={productIcon(product)} tone={product.status === 'active' ? 'slate' : 'neutral'} size={44} />
      </View>
      <View style={styles.rowBody}>
        <Text style={type.cardTitle}>{productLabel(product)}</Text>
        <Text style={type.secondary} numberOfLines={1}>
          {[product.category, product.dosage, product.packaging].filter(Boolean).join(' · ')}
        </Text>
        <Text style={type.secondary}>
          {t('products.expiry')} <Text style={[mono, styles.figure]}>{expiry}</Text>
        </Text>
        <View style={styles.badges}>
          <ExpiryBadge product={product} />
          {product.status !== 'active' ? (
            <View style={[styles.badge, styles.badgeMuted]}>
              <Text style={[type.pill, { color: colors.textMuted }]}>{t(PRODUCT_STATUS_LABEL[product.status])}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

/** The product sheet as a rep shows it at a visit: every field, large and plain. */
export function ProductSheetCard({ product }: { product: Product }) {
  const t = useT();
  const rows: [string, string | undefined][] = [
    [t('products.form.category'), product.category],
    [t('products.form.manufacturer'), product.manufacturer],
    [t('products.form.dosage'), product.dosage],
    [t('products.form.strength'), product.strength],
    [t('products.form.packaging'), product.packaging],
    [t('products.form.packSize'), product.packSize ? t('products.packOf', { count: product.packSize.count, unit: product.packSize.unit }) : undefined],
  ];
  return (
    <View style={styles.sheet}>
      <View style={styles.sheetIcon}>
        <IconTile icon={productIcon(product)} tone="slate" size={56} />
      </View>
      <Text style={type.screenTitle} accessibilityRole="header">
        {product.name}
      </Text>
      {product.strength ? <Text style={[type.body, styles.strength]}>{product.strength}</Text> : null}
      <View style={styles.badges}>
        <ExpiryBadge product={product} />
        <View style={[styles.badge, product.status === 'active' ? styles.badgeActive : styles.badgeMuted]}>
          <Text style={[type.pill, { color: product.status === 'active' ? colors.primaryOnSoft : colors.textMuted }]}>
            {t(PRODUCT_STATUS_LABEL[product.status])}
          </Text>
        </View>
      </View>
      <Text style={[type.body, styles.description]}>{product.description}</Text>
      <View style={styles.facts}>
        {rows
          .filter(([, v]) => !!v)
          .map(([label, value]) => (
            <View key={label} style={styles.fact}>
              <Text style={type.secondary}>{label}</Text>
              <Text style={[type.body, styles.factValue]}>{value}</Text>
            </View>
          ))}
        <View style={[styles.fact, styles.factLast]}>
          <Text style={type.secondary}>{t('products.expiry')}</Text>
          <View style={styles.factValueBox}>
            <Text style={[type.body, mono, styles.factValue]}>{formatDay(product.expiryDate, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
            <Text style={[type.secondary, styles.factValue]}>{expiryWords(t, product.expiryDate)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowIcon: { alignSelf: 'flex-start' },
  rowBody: { flex: 1, gap: 2 },
  sheetIcon: { marginBottom: spacing.md },
  figure: { color: colors.text },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  badgeMuted: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  badgeActive: { backgroundColor: colors.primarySoft },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  strength: { color: colors.textMuted, marginTop: 2 },
  description: { marginTop: spacing.md },
  facts: { marginTop: spacing.md },
  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    flexWrap: 'wrap',
  },
  factLast: { borderBottomWidth: 0 },
  factValue: { textAlign: 'right' },
  factValueBox: { alignItems: 'flex-end', flexShrink: 1 },
});
