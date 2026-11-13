import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PlainKey, useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { VisitOutcomes } from '@/lib/types';
import { mono, type } from '@/lib/typography';
import { Outcome } from '@/lib/visits';

type Bucket = keyof VisitOutcomes;

/**
 * Validated with the dataviz palette check (all pairs): CVD ΔE ≥ 10.4, normal vision ≥ 16.3.
 * "Never closed" is a light slate on purpose: it's the recessive, nothing-happened bucket. Every
 * segment also has its word and count in the rows below, so colour is never the only cue.
 */
const BUCKETS: { key: Bucket; color: string; label: PlainKey; hint: PlainKey }[] = [
  { key: 'done', color: colors.accent, label: 'visits.outcome.done', hint: 'visits.outcome.doneHint' },
  { key: 'notSeen', color: colors.warning, label: 'visits.outcome.notSeen', hint: 'visits.outcome.notSeenHint' },
  { key: 'cancelled', color: colors.slate, label: 'visits.outcome.cancelled', hint: 'visits.outcome.cancelledHint' },
  { key: 'open', color: colors.onNavyMuted, label: 'visits.outcome.open', hint: 'visits.outcome.openHint' },
];

/**
 * Past's "How they went": the period's visits as one bar split by outcome, with a row per outcome
 * underneath. The bar and the rows are the filter: tap one to list only those visits, tap it again
 * (or All) to list everything.
 */
export function OutcomeBar({ summary, value, onChange }: { summary: VisitOutcomes; value: Outcome; onChange: (o: Outcome) => void }) {
  const t = useT();
  const total = BUCKETS.reduce((n, b) => n + summary[b.key], 0);
  if (total === 0) return null;
  const pick = (key: Bucket) => onChange(value === key ? 'all' : key);
  const shown = BUCKETS.filter((b) => summary[b.key] > 0 || value === b.key);
  const donePct = Math.round((summary.done / total) * 100);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={type.cardTitle} accessibilityRole="header">
            {t('visits.outcome.title')}
          </Text>
          <Text style={type.secondary}>{t('visits.outcome.total', { count: total })}</Text>
        </View>
        <View style={styles.rate}>
          <Text style={[mono, styles.rateValue]} maxFontSizeMultiplier={1.3}>
            {donePct}
            <Text style={styles.rateSign}>%</Text>
          </Text>
          <Text style={styles.rateLabel}>{t('visits.outcome.rate')}</Text>
        </View>
      </View>

      <View style={styles.bar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {BUCKETS.filter((b) => summary[b.key] > 0).map((b) => (
          <Pressable
            key={b.key}
            onPress={() => pick(b.key)}
            style={[styles.segment, { flex: summary[b.key], backgroundColor: b.color }, value !== 'all' && value !== b.key && styles.dim]}
          />
        ))}
      </View>

      <View style={styles.rows} accessibilityRole="radiogroup" accessibilityLabel={t('visits.outcome.title')}>
        {shown.map((b) => {
          const selected = value === b.key;
          return (
            <TouchableOpacity
              key={b.key}
              style={[styles.row, selected && styles.rowSelected]}
              onPress={() => pick(b.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${t(b.label)}: ${summary[b.key]}. ${t(b.hint)}`}
            >
              <View style={[styles.swatch, { backgroundColor: b.color }]} />
              <View style={styles.rowText}>
                <Text style={[type.body, selected && styles.selectedText]}>{t(b.label)}</Text>
                <Text style={type.secondary} numberOfLines={1}>
                  {t(b.hint)}
                </Text>
              </View>
              <Text style={[mono, styles.count]}>{summary[b.key]}</Text>
              <Ionicons
                name={selected ? 'close-circle' : 'filter-outline'}
                size={18}
                color={selected ? colors.primaryOnSoft : colors.textMuted}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headText: { flex: 1 },
  rate: { alignItems: 'flex-end' },
  rateValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  rateSign: { fontSize: 13, color: colors.textMuted },
  rateLabel: { fontSize: 12, color: colors.textMuted },
  bar: { flexDirection: 'row', height: 14, gap: 2, borderRadius: 4, overflow: 'hidden', marginTop: spacing.md, marginBottom: spacing.sm },
  segment: { height: '100%', minWidth: 4 },
  dim: { opacity: 0.3 },
  rows: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    minHeight: 52,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
    borderRadius: radius.sm,
  },
  rowSelected: { backgroundColor: colors.primarySoft },
  selectedText: { fontWeight: '700', color: colors.primaryOnSoft },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  rowText: { flex: 1 },
  count: { fontSize: 15, fontWeight: '700', color: colors.text, minWidth: 28, textAlign: 'right' },
});
