import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ClinicHolding, holdingShares, holdingTotals } from '@/lib/deliveries';
import { formatDate } from '@/lib/format';
import { TFunction, useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';

// Received is the primary series (the validated teal), waiting the secondary (slate).
const RECEIVED = colors.accent;
const WAITING = colors.slate;

/** "Mercy Clinic: 24 boxes received, 6 boxes waiting for the clinic · Last Nov 3". */
function rowWords(t: TFunction, r: ClinicHolding): string {
  const parts = [
    r.received ? t('deliveries.where.rowReceived', { count: r.received, unit: r.unit }) : null,
    r.pending ? t('deliveries.where.rowWaiting', { count: r.pending, unit: r.unit }) : null,
  ].filter(Boolean);
  return `${r.clinicName}: ${parts.join(', ')} · ${t('deliveries.where.last', { date: formatDate(r.lastAt, { month: 'short', day: 'numeric' }) })}`;
}

/**
 * "Where it is": one bar per clinic (and unit), split into what the clinic confirmed and what is
 * still waiting on it, so the rep sees where the stock went and which clinic to chase. Bars
 * compare within a unit only. Tap a row to read it.
 */
export function HoldingsChart({ rows }: { rows: ClinicHolding[] }) {
  const t = useT();
  const [picked, setPicked] = useState<string | null>(null);
  const shares = holdingShares(rows);
  const totals = holdingTotals(rows);
  const clinics = new Set(rows.map((r) => r.clinicId)).size;
  const anyWaiting = rows.some((r) => r.pending > 0);
  const sel = rows.find((r) => `${r.clinicId}|${r.unit}` === picked) ?? null;

  return (
    <View style={styles.card}>
      <Text style={type.cardTitle} accessibilityRole="header">
        {t('deliveries.where.title')}
      </Text>
      <Text style={[type.secondary, styles.tabular]}>
        {[t('deliveries.where.atClinics', { count: clinics }), totals ? t('deliveries.where.totals', { received: totals.received, waiting: totals.waiting, unit: totals.unit }) : null]
          .filter(Boolean)
          .join(' · ')}
      </Text>

      <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Key color={RECEIVED} label={t('deliveries.where.legendReceived')} />
        {anyWaiting ? <Key color={WAITING} label={t('deliveries.where.legendWaiting')} /> : null}
      </View>

      <Text style={[type.secondary, styles.readout, sel && styles.readoutOn]} accessibilityLiveRegion="polite">
        {sel ? rowWords(t, sel) : t('deliveries.where.hint')}
      </Text>

      <View style={styles.rows}>
        {rows.map((r, i) => {
          const key = `${r.clinicId}|${r.unit}`;
          const isPicked = picked === key;
          const total = r.received + r.pending;
          return (
            <Pressable
              key={key}
              style={[styles.row, i > 0 && styles.rule, isPicked && styles.rowPicked]}
              onPress={() => setPicked(isPicked ? null : key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isPicked }}
              accessibilityLabel={rowWords(t, r)}
            >
              <View style={styles.rowHead}>
                <Text style={[type.body, styles.clinic]} numberOfLines={1}>
                  {r.clinicName}
                </Text>
                <Text style={[styles.figure, styles.tabular]}>
                  {total} {r.unit}
                </Text>
              </View>
              <View style={[styles.track, picked && !isPicked && styles.dim]}>
                <View style={[styles.bar, { width: `${shares[i] * 100}%` }]}>
                  {r.received ? <View style={{ flex: r.received, backgroundColor: RECEIVED }} /> : null}
                  {r.pending ? <View style={{ flex: r.pending, backgroundColor: WAITING }} /> : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.key}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.keyText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md, gap: 2 },
  tabular: { fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xs, marginTop: spacing.sm },
  key: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  keyText: { fontSize: 12, color: colors.textMuted },
  readout: { minHeight: 36, marginTop: spacing.sm, fontVariant: ['tabular-nums'] },
  readoutOn: { color: colors.text },
  rows: { marginTop: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  row: { minHeight: 56, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.xs, gap: 6, borderRadius: radius.sm },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowPicked: { backgroundColor: colors.surfaceMuted },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  clinic: { flex: 1 },
  figure: { fontSize: 14, fontWeight: '700', color: colors.text },
  // The one axis: every bar starts at zero on the left.
  track: { height: 8, borderRadius: 4, backgroundColor: colors.slateSoft, overflow: 'hidden' },
  bar: { flexDirection: 'row', height: 8, minWidth: 4, gap: 2 },
  dim: { opacity: 0.35 },
});
