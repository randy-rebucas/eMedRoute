import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, clinicTodayYmd, formatDay } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { Visit } from '@/lib/types';
import { mono, type } from '@/lib/typography';
import { visitDay } from '@/lib/visits';

/** Same validated pair as Home's chart: confirmed in brand teal, waiting in slate. */
const SERIES = { confirmed: colors.accent, waiting: colors.slate };
const DAYS = 7;
const BLOCK_AREA = 54;
/** Up to this many visits a day are drawn one block each; past it the blocks shrink to fit. */
const ROOMY = 5;

type Day = { day: string; confirmed: number; waiting: number };

/** Each of the next seven days (today first) with its confirmed and waiting visits. */
export function weekLoad(visits: Pick<Visit, 'date' | 'status'>[]): Day[] {
  const today = clinicTodayYmd();
  const days = Array.from({ length: DAYS }, (_, i) => ({ day: addDays(today, i), confirmed: 0, waiting: 0 }));
  for (const v of visits) {
    const d = days.find((x) => x.day === visitDay(v));
    if (!d) continue;
    if (v.status === 'requested') d.waiting += 1;
    else d.confirmed += 1;
  }
  return days;
}

/**
 * Upcoming's "Next 7 days": one column per day, a block per visit (confirmed under waiting), so
 * the rep sees at a glance which days are full and which are open for another call. Tapping a day
 * shows only that day below; tapping it again shows everything.
 */
export function WeekStrip({
  visits,
  picked,
  onPick,
}: {
  visits: Pick<Visit, 'date' | 'status'>[];
  picked: string | null;
  onPick: (day: string | null) => void;
}) {
  const t = useT();
  const days = weekLoad(visits);
  const inWeek = days.reduce((n, d) => n + d.confirmed + d.waiting, 0);
  const later = visits.length - inWeek;
  const most = Math.max(ROOMY, ...days.map((d) => d.confirmed + d.waiting));
  const block = (BLOCK_AREA - (most - 1) * 2) / most;
  const sel = picked ? days.find((d) => d.day === picked) : null;

  const dayName = (d: Day, i: number) =>
    i === 0 ? t('visits.week.today') : i === 1 ? t('visits.week.tomorrow') : formatDay(d.day, { weekday: 'short', day: 'numeric', month: 'short' });
  const counts = (d: Day) => t('visits.week.counts', { confirmed: d.confirmed, waiting: d.waiting });

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={type.cardTitle} accessibilityRole="header">
          {t('visits.week.title')}
        </Text>
        <Text style={[type.secondary, styles.total]}>{t('visits.week.total', { count: inWeek })}</Text>
      </View>

      <View style={styles.readout} accessibilityLiveRegion="polite">
        {sel ? (
          <>
            <Text style={styles.readoutDay}>{dayName(sel, days.indexOf(sel))}</Text>
            <Text style={[type.secondary, styles.tabular]}>{counts(sel)}</Text>
          </>
        ) : (
          <Text style={type.secondary}>{later > 0 ? t('visits.week.hintLater', { count: later }) : t('visits.week.hint')}</Text>
        )}
      </View>

      <View style={styles.columns}>
        {days.map((d, i) => {
          const isPicked = d.day === picked;
          const isToday = i === 0;
          const n = d.confirmed + d.waiting;
          return (
            <Pressable
              key={d.day}
              style={[styles.column, isPicked && styles.columnPicked]}
              onPress={() => onPick(isPicked ? null : d.day)}
              accessibilityRole="button"
              accessibilityState={{ selected: isPicked }}
              accessibilityLabel={`${formatDay(d.day, { weekday: 'long', day: 'numeric', month: 'long' })}: ${counts(d)}`}
              accessibilityHint={isPicked ? t('visits.week.a11yShowAll') : t('visits.week.a11yShowDay')}
            >
              <View style={styles.blocks}>
                {Array.from({ length: d.waiting }, (_, k) => (
                  <View key={`w${k}`} style={[styles.block, { height: block, backgroundColor: SERIES.waiting }]} />
                ))}
                {Array.from({ length: d.confirmed }, (_, k) => (
                  <View key={`c${k}`} style={[styles.block, { height: block, backgroundColor: SERIES.confirmed }]} />
                ))}
                {n === 0 ? <View style={styles.free} /> : null}
              </View>
              <Text style={[styles.weekday, isPicked && styles.textPicked]} maxFontSizeMultiplier={1.2}>
                {formatDay(d.day, { weekday: 'narrow' })}
              </Text>
              <View style={[styles.date, isToday && styles.dateToday]}>
                <Text style={[mono, styles.dateText, isToday && styles.dateTextToday]} maxFontSizeMultiplier={1.2}>
                  {d.day.slice(8, 10)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legend}>
        <Legend color={SERIES.confirmed} label={t('visits.week.confirmed')} />
        <Legend color={SERIES.waiting} label={t('visits.week.waiting')} />
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
  },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  total: { fontVariant: ['tabular-nums'] },
  readout: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: spacing.sm, minHeight: 20, marginTop: spacing.xs, marginBottom: spacing.sm + 4 },
  readoutDay: { fontSize: 13, fontWeight: '700', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.4 },
  tabular: { fontVariant: ['tabular-nums'] },
  columns: { flexDirection: 'row', gap: 4 },
  column: { flex: 1, alignItems: 'center', paddingTop: spacing.xs, paddingBottom: spacing.xs + 2, borderRadius: radius.sm, minHeight: 48 },
  columnPicked: { backgroundColor: colors.primarySoft },
  blocks: { height: BLOCK_AREA, width: '62%', maxWidth: 28, justifyContent: 'flex-end', gap: 2 },
  block: { width: '100%', borderRadius: 3 },
  // An open day: a dashed outline where visits would stack, so "free" reads as a slot, not a gap.
  free: { height: 14, width: '100%', borderRadius: 3, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  weekday: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: spacing.xs + 2, textTransform: 'uppercase' },
  textPicked: { color: colors.primaryOnSoft },
  date: { minWidth: 26, paddingHorizontal: 2, paddingVertical: 1, borderRadius: 6, alignItems: 'center', marginTop: 2 },
  dateToday: { backgroundColor: colors.navy },
  dateText: { fontSize: 14, fontWeight: '700', color: colors.text },
  dateTextToday: { color: colors.primaryText },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xs, marginTop: spacing.sm + 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
});
