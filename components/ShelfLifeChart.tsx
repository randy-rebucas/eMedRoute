import { useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PlainKey, TFunction, useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { ProductExpiry } from '@/lib/types';
import { mono, type } from '@/lib/typography';
import { IconName } from './ui';

type Bucket = keyof ProductExpiry;

/**
 * Columns in time order. Each column is named on the axis, so colour only adds emphasis: expired
 * in the danger red and ≤30 days in amber (the same as the row badges, and their labels carry an
 * icon too), the rest in slate. Red and amber are close for deuteranopia; the labels carry it.
 */
const BUCKETS: { key: Bucket; color: string; tick: PlainKey; icon?: IconName }[] = [
  { key: 'expired', color: colors.danger, tick: 'products.shelf.expired', icon: 'alert-circle' },
  { key: 'soon', color: colors.warning, tick: 'products.shelf.soon', icon: 'time' },
  { key: 'quarter', color: colors.slate, tick: 'products.shelf.quarter' },
  { key: 'half', color: colors.slate, tick: 'products.shelf.half' },
  { key: 'later', color: colors.slate, tick: 'products.shelf.later' },
];
const PLOT = 64;

/** "3 products expire within 30 days", per column (plural messages need their literal key). */
function words(t: TFunction, key: Bucket, count: number): string {
  switch (key) {
    case 'expired':
      return t('products.shelf.expiredWords', { count });
    case 'soon':
      return t('products.shelf.soonWords', { count });
    case 'quarter':
      return t('products.shelf.quarterWords', { count });
    case 'half':
      return t('products.shelf.halfWords', { count });
    case 'later':
      return t('products.shelf.laterWords', { count });
  }
}

/**
 * Products' "Shelf life": the rep's active products by days left, so they can see what to use up
 * or hand out first. Tap a column to read it; for expired and ≤30 days the readout offers to list
 * them (the Expiring filter).
 */
export function ShelfLifeChart({ expiry, onShowExpiring }: { expiry: ProductExpiry; onShowExpiring: () => void }) {
  const t = useT();
  const total = BUCKETS.reduce((n, b) => n + expiry[b.key], 0);
  const urgent = expiry.expired + expiry.soon;
  const [picked, setPicked] = useState<Bucket | null>(null);
  if (total === 0) return null;
  const max = Math.max(...BUCKETS.map((b) => expiry[b.key]), 1);
  const sel = BUCKETS.find((b) => b.key === picked) ?? null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text style={type.cardTitle} accessibilityRole="header">
            {t('products.shelf.title')}
          </Text>
          <Text style={type.secondary}>{t('products.shelf.sub', { count: total })}</Text>
        </View>
        {urgent > 0 ? (
          <View style={styles.urgent}>
            <Text style={[mono, styles.urgentValue]}>{urgent}</Text>
            <Text style={styles.urgentLabel}>{t('products.shelf.needAttention')}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.readout} accessibilityLiveRegion="polite">
        {sel ? (
          <>
            <Text style={[type.secondary, styles.readoutText]}>{words(t, sel.key, expiry[sel.key])}</Text>
            {(sel.key === 'expired' || sel.key === 'soon') && expiry[sel.key] > 0 ? (
              <TouchableOpacity onPress={onShowExpiring} hitSlop={10} accessibilityRole="button">
                <Text style={styles.readoutAction}>{t('products.shelf.show')}</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <Text style={type.secondary}>{t('products.shelf.hint')}</Text>
        )}
      </View>

      <View style={styles.plot}>
        {BUCKETS.map((b) => {
          const n = expiry[b.key];
          const isPicked = picked === b.key;
          return (
            <Pressable
              key={b.key}
              style={[styles.column, isPicked && styles.columnPicked]}
              onPress={() => setPicked(isPicked ? null : b.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isPicked }}
              accessibilityLabel={`${t(b.tick)}: ${words(t, b.key, n)}`}
            >
              <Text style={[mono, styles.value]} maxFontSizeMultiplier={1.3}>
                {n}
              </Text>
              <View style={styles.barArea}>
                <View
                  style={[
                    styles.bar,
                    { height: n === 0 ? 2 : Math.max(4, (n / max) * PLOT), backgroundColor: n === 0 ? colors.border : b.color },
                    picked && !isPicked && styles.dim,
                  ]}
                />
              </View>
              <View style={styles.tick}>
                {b.icon ? <Ionicons name={b.icon} size={12} color={n > 0 ? b.color : colors.textMuted} /> : null}
                <Text style={[styles.tickText, isPicked && styles.tickPicked]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                  {t(b.tick)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  urgent: { alignItems: 'flex-end' },
  urgentValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  urgentLabel: { fontSize: 12, color: colors.textMuted },
  readout: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: spacing.sm, minHeight: 20, marginTop: spacing.sm, marginBottom: spacing.sm },
  readoutText: { color: colors.text },
  readoutAction: { fontSize: 13, fontWeight: '700', color: colors.primaryOnSoft },
  plot: { flexDirection: 'row', gap: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm },
  column: { flex: 1, alignItems: 'center', borderRadius: radius.sm, paddingVertical: spacing.xs, minHeight: 48 },
  columnPicked: { backgroundColor: colors.surfaceMuted },
  value: { fontSize: 14, fontWeight: '700', color: colors.text },
  barArea: { height: PLOT, justifyContent: 'flex-end', width: '56%', maxWidth: 30, marginTop: 4 },
  bar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  dim: { opacity: 0.35 },
  tick: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: spacing.xs + 2, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 4, alignSelf: 'stretch', justifyContent: 'center' },
  tickText: { fontSize: 12, color: colors.textMuted },
  tickPicked: { color: colors.text, fontWeight: '700' },
});
