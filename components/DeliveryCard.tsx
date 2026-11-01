import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DELIVERY_STATUS_LABEL } from '@/lib/deliveries';
import { formatDate, formatDay } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { Delivery, DeliveryStatus } from '@/lib/types';
import { mono, type } from '@/lib/typography';
import { productLabel } from './ProductPicker';
import { IconName } from './ui';

const LOOK: Record<DeliveryStatus, { icon: IconName; bg: string; fg: string; border?: string }> = {
  pending: { icon: 'hourglass-outline', bg: colors.warningSoft, fg: colors.warning },
  received: { icon: 'checkmark-done-outline', bg: colors.primarySoft, fg: colors.primaryOnSoft },
  rejected: { icon: 'close-circle-outline', bg: colors.dangerSoft, fg: colors.danger },
  cancelled: { icon: 'ban-outline', bg: colors.background, fg: colors.textMuted, border: colors.border },
};

/**
 * One delivery on a visit: kind, status (word + icon + colour), each product with quantity, what
 * the clinic counted if different, lot and batch expiry, and the clinic's note. A pending one
 * can be cancelled.
 */
export function DeliveryCard({ delivery, onCancel, cancelling }: { delivery: Delivery; onCancel?: () => void; cancelling?: boolean }) {
  const t = useT();
  const look = LOOK[delivery.status];
  const answeredOn = delivery.respondedAt ? formatDate(delivery.respondedAt, { month: 'short', day: 'numeric' }) : null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={type.label}>{t(delivery.kind === 'sample' ? 'deliveries.kind.sample' : 'deliveries.kind.delivery')}</Text>
        <View style={[styles.pill, { backgroundColor: look.bg }, look.border ? { borderWidth: 1, borderColor: look.border } : null]}>
          <Ionicons name={look.icon} size={14} color={look.fg} />
          <Text style={[type.pill, { color: look.fg }]} maxFontSizeMultiplier={1.6}>
            {t(DELIVERY_STATUS_LABEL[delivery.status])}
          </Text>
        </View>
      </View>

      {delivery.lines.map((line, i) => {
        const counted = delivery.status === 'received' && line.receivedQuantity !== undefined && line.receivedQuantity !== line.quantity;
        return (
          <View key={i} style={styles.line} accessible>
            <View style={styles.lineTop}>
              <Text style={[type.body, styles.flex]}>{productLabel({ name: line.productName, strength: line.strength })}</Text>
              <Text style={[type.body, mono, styles.qty, counted && styles.struck]}>
                {line.quantity} <Text style={styles.unit}>{line.unit}</Text>
              </Text>
            </View>
            {counted || line.lotNumber || line.expiryDate || line.inventoryItemId ? (
              <Text style={type.secondary}>
                {[
                  counted ? t('deliveries.counted', { count: line.receivedQuantity! }) : null,
                  line.lotNumber ? t('deliveries.lot', { lot: line.lotNumber }) : null,
                  line.expiryDate ? t('deliveries.expires', { date: formatDay(line.expiryDate, { month: 'short', year: 'numeric' }) }) : null,
                  line.inventoryItemId ? (line.stockQuantity ? t('deliveries.inStockCount', { count: line.stockQuantity }) : t('deliveries.inStock')) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            ) : null}
          </View>
        );
      })}

      {answeredOn && (delivery.status === 'received' || delivery.status === 'rejected') ? (
        <Text style={[type.secondary, styles.meta]}>
          {t(delivery.status === 'received' ? 'deliveries.receivedOn' : 'deliveries.rejectedOn', { clinic: delivery.clinicName, date: answeredOn })}
        </Text>
      ) : null}
      {delivery.clinicNote ? (
        <View style={styles.quote}>
          <Text style={type.label}>{t('deliveries.clinicWrote', { clinic: delivery.clinicName })}</Text>
          <Text style={[type.body, styles.italic]}>“{delivery.clinicNote}”</Text>
        </View>
      ) : null}

      {onCancel && delivery.status === 'pending' ? (
        <TouchableOpacity style={styles.cancel} onPress={onCancel} disabled={cancelling} accessibilityRole="button">
          <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.cancelText}>{t('deliveries.cancel')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.xs, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  line: { paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: 2 },
  lineTop: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  flex: { flex: 1 },
  qty: { fontWeight: '600' },
  unit: { fontFamily: undefined, fontWeight: '400', color: colors.textMuted },
  struck: { textDecorationLine: 'line-through', color: colors.textMuted },
  meta: { marginTop: spacing.xs },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.slate,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    padding: spacing.sm + 4,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  italic: { fontStyle: 'italic' },
  cancel: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, minHeight: 48, marginTop: spacing.xs, alignSelf: 'flex-start' },
  cancelText: { fontSize: 15, fontWeight: '600', color: colors.danger },
});
