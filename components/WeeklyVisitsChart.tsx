import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDay } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { WeeklyVisits } from '@/lib/types';
import { mono, type } from '@/lib/typography';

/**
 * Chart series colours, checked with the dataviz palette validator against the card surface:
 * brand teal and slate are 15.6 ΔE apart for deuteranopia and 17.9 for normal vision. The legend
 * and the summary line name them too, so colour is never the only cue.
 */
const SERIES = { completed: colors.accent, open: colors.slate };
const PLOT_HEIGHT = 112;
const GAP = 2;

/**
 * Home's "Visits by week": the last eight Monday-start weeks as stacked bars (completed under
 * booked), this week last. Tap a week to read its numbers in the line above the bars; this week is
 * picked to begin with. A dashed rule marks the weekly average of the weeks before this one.
 */
export function WeeklyVisitsChart({ weeks }: { weeks: WeeklyVisits[] }) {
  const t = useT();
  const [picked, setPicked] = useState(weeks.length - 1);
  const totals = weeks.map((w) => w.completed + w.open);
  const max = Math.max(...totals, 1);
  // A rounder top for the scale: 4 → 4, 7 → 8, 13 → 15.
  const top = max <= 4 ? max : max <= 10 ? Math.ceil(max / 2) * 2 : Math.ceil(max / 5) * 5;
  const past = totals.slice(0, -1);
  const average = past.length ? past.reduce((a, b) => a + b, 0) / past.length : 0;
  const avgText = average >= 10 ? Math.round(average).toString() : average.toFixed(1).replace(/\.0$/, '');

  const label = (i: number) =>
    i === weeks.length - 1 ? t('home.trend.thisWeek') : t('home.trend.weekOf', { date: formatDay(weeks[i].week, { month: 'short', day: 'numeric' }) });
  const sel = weeks[picked] ?? weeks[weeks.length - 1];
  const summary = t('home.trend.summary', { completed: sel.completed, open: sel.open });

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={type.cardTitle} accessibilityRole="header">
            {t('home.trend.title')}
          </Text>
          <Text style={type.secondary}>{t('home.trend.sub')}</Text>
        </View>
        {average > 0 ? (
          <View style={styles.avgBox}>
            <Text style={[styles.tabular, styles.avgValue]}>{avgText}</Text>
            <Text style={styles.avgLabel}>{t('home.trend.average')}</Text>
          </View>
        ) : null}
      </View>

      {/* The readout: whichever week is picked. Announced politely when it changes. */}
      <View style={styles.readout} accessibilityLiveRegion="polite">
        <Text style={styles.readoutWeek}>{label(picked)}</Text>
        <Text style={[styles.tabular, styles.readoutValue]}>{summary}</Text>
      </View>

      <View style={styles.plot}>
        {/* Recessive scale: the top value and a hairline baseline. */}
        <View style={[styles.gridLine, { top: 0 }]} />
        <Text style={[mono, styles.scale]}>{top}</Text>
        {average > 0 ? (
          <View style={[styles.avgLine, { bottom: (average / top) * PLOT_HEIGHT }]} accessibilityElementsHidden importantForAccessibility="no" />
        ) : null}
        <View style={styles.bars}>
          {weeks.map((w, i) => {
            const isPicked = i === picked;
            const completedH = (w.completed / top) * PLOT_HEIGHT;
            const openH = (w.open / top) * PLOT_HEIGHT;
            const dim = !isPicked && { opacity: 0.45 };
            return (
              <Pressable
                key={w.week}
                style={styles.column}
                onPress={() => setPicked(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: isPicked }}
                accessibilityLabel={`${label(i)}: ${t('home.trend.summary', { completed: w.completed, open: w.open })}`}
                hitSlop={{ top: 8, bottom: 8 }}
              >
                <View style={styles.stack}>
                  {w.open > 0 ? (
                    <View style={[styles.segment, styles.segTop, { height: Math.max(openH, 3), backgroundColor: SERIES.open }, dim]} />
                  ) : null}
                  {w.open > 0 && w.completed > 0 ? <View style={{ height: GAP }} /> : null}
                  {w.completed > 0 ? (
                    <View
                      style={[
                        styles.segment,
                        w.open === 0 && styles.segTop,
                        { height: Math.max(completedH, 3), backgroundColor: SERIES.completed },
                        dim,
                      ]}
                    />
                  ) : null}
                  {w.open === 0 && w.completed === 0 ? <View style={styles.zero} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.axis}>
        {weeks.map((w, i) => (
          <Text key={w.week} style={[styles.tick, i === picked && styles.tickPicked]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {i === weeks.length - 1 ? t('home.trend.now') : i % 2 === 0 ? formatDay(w.week, { day: 'numeric', month: 'numeric' }) : ''}
          </Text>
        ))}
      </View>

      <View style={styles.legend}>
        <Legend color={SERIES.completed} label={t('home.trend.completed')} />
        <Legend color={SERIES.open} label={t('home.trend.open')} />
        {average > 0 ? (
          <View style={styles.legendItem}>
            <View style={styles.legendDash} />
            <Text style={type.secondary}>{t('home.trend.averageLegend')}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={type.secondary}>{label}</Text>
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
    marginBottom: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headText: { flex: 1 },
  avgBox: { alignItems: 'flex-end' },
  tabular: { fontVariant: ['tabular-nums'] },
  avgValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  avgLabel: { fontSize: 12, color: colors.textMuted },
  readout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm + 4,
  },
  readoutWeek: { fontSize: 13, fontWeight: '700', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.4 },
  readoutValue: { fontSize: 13, color: colors.textMuted },
  plot: { height: PLOT_HEIGHT, justifyContent: 'flex-end', borderBottomWidth: 1, borderBottomColor: colors.border },
  gridLine: { position: 'absolute', left: 0, right: 24, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  scale: { position: 'absolute', right: 0, top: -7, fontSize: 12, color: colors.textMuted },
  avgLine: {
    position: 'absolute',
    left: 0,
    right: 24,
    height: 0,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.textMuted,
  },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: PLOT_HEIGHT, marginRight: 24 },
  column: { flex: 1, height: PLOT_HEIGHT, justifyContent: 'flex-end', alignItems: 'center' },
  stack: { width: '58%', maxWidth: 26, justifyContent: 'flex-end' },
  segment: { width: '100%' },
  // Rounded data-end on the top of the stack only; the base sits square on the axis.
  segTop: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  zero: { height: 2, width: '100%', backgroundColor: colors.border, borderRadius: 1 },
  axis: { flexDirection: 'row', marginTop: spacing.xs + 2, marginRight: 24 },
  tick: { flex: 1, textAlign: 'center', fontSize: 12, color: colors.textMuted },
  tickPicked: { color: colors.text, fontWeight: '700' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xs, marginTop: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendDash: { width: 14, height: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: colors.textMuted },
});
