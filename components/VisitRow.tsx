import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { daysFromToday, formatDay, formatTime } from '@/lib/format';
import { TFunction, useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { Visit } from '@/lib/types';
import { mono, type } from '@/lib/typography';
import { isOwnLog, LOG_STATUS_LABEL, nextStep, NextStep, VISIT_STATE_LABEL, visitDay, visitState } from '@/lib/visits';
import { StatusPill } from './StatusPill';

type VisitLike = Pick<Visit, '_id' | 'clinicId' | 'clinicName' | 'clinicLocation' | 'date' | 'time' | 'status' | 'checkedInAt'> &
  Partial<Pick<Visit, 'cancelledBy' | 'clinicNote'>>;

/** The next-step line in words; null for own log entries. */
export function nextStepText(t: TFunction, step: NextStep): string | null {
  if (!step) return null;
  switch (step.key) {
    case 'visits.next.arriveBy':
      return t('visits.next.arriveBy', { time: step.time });
    case 'visits.next.checkedIn':
      return t('visits.next.checkedIn', { time: step.time });
    default:
      return t(step.key);
  }
}

/** The status as a spoken word: "approved", "waiting for the clinic", … */
export function statusWord(t: TFunction, visit: VisitLike): string {
  const state = visitState(visit);
  if (state === 'log') {
    const word = LOG_STATUS_LABEL[visit.status];
    return word ? `${t('visits.state.log')}, ${t(word)}` : t('visits.state.log');
  }
  return t(VISIT_STATE_LABEL[state]);
}

/** "Sunrise Clinic, Tuesday 4 November, 3:00 PM, approved". Times are read in words, not as "15:00". */
export function visitA11yLabel(t: TFunction, visit: VisitLike): string {
  const day = formatDay(visitDay(visit), { weekday: 'long', day: 'numeric', month: 'long' });
  return [visit.clinicName, day, formatTime(visit.time), statusWord(t, visit)].join(', ');
}

/**
 * One visit in a list: day, clinic, time and place, status pill and who acts next. A team
 * member's visit (`member`) is read-only: it isn't the rep's own, so it opens nothing.
 */
export function VisitRow({ visit, member }: { visit: VisitLike; member?: string }) {
  const t = useT();
  const day = visitDay(visit);
  const state = visitState(visit);
  // The clinic's note on a decline replaces the generic line, quoted in the detail screen.
  const line = state === 'declined' && visit.clinicNote ? null : nextStepText(t, nextStep({ ...visit, cancelledBy: visit.cancelledBy }));
  const logWord = isOwnLog(visit) ? LOG_STATUS_LABEL[visit.status] : null;
  const today = daysFromToday(day) === 0;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/visits/${visit._id}`)}
      disabled={!!member}
      accessibilityRole={member ? undefined : 'button'}
      accessibilityLabel={member ? `${member}, ${visitA11yLabel(t, visit)}` : visitA11yLabel(t, visit)}
      accessibilityHint={line ?? undefined}
    >
      <View style={[styles.day, today && styles.dayToday]}>
        <Text style={[type.secondary, styles.dayWeek, today && styles.onNavyMuted]} maxFontSizeMultiplier={1.4}>
          {formatDay(day, { weekday: 'short' })}
        </Text>
        <Text style={[mono, styles.dayNumber, today && styles.onNavy]} maxFontSizeMultiplier={1.4}>
          {day.slice(8, 10)}
        </Text>
        <Text style={[type.secondary, styles.dayWeek, today && styles.onNavyMuted]} maxFontSizeMultiplier={1.4}>
          {formatDay(day, { month: 'short' })}
        </Text>
      </View>
      <View style={styles.body}>
        {member ? <Text style={[type.label, styles.member]}>{member}</Text> : null}
        <Text style={[type.cardTitle, state === 'cancelled' && styles.struck]} numberOfLines={2}>
          {visit.clinicName}
        </Text>
        <Text style={type.secondary} numberOfLines={1}>
          <Text style={[mono, styles.time]}>{visit.time}</Text>
          {visit.clinicLocation ? ` · ${visit.clinicLocation}` : ''}
        </Text>
        <View style={styles.status}>
          <StatusPill state={state} />
          {logWord ? <Text style={type.secondary}>{t(logWord)}</Text> : null}
        </View>
        {line ? <Text style={[type.secondary, styles.line]}>{line}</Text> : null}
      </View>
      {member ? null : <Ionicons name="chevron-forward" size={20} color={colors.textMuted} style={styles.chevron} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  // The date as a tile; today's is navy, the rep app's own colour (not teal, which means "act").
  day: { width: 56, alignItems: 'center', alignSelf: 'flex-start', borderRadius: radius.sm + 2, backgroundColor: colors.slateSoft, paddingVertical: spacing.sm },
  dayToday: { backgroundColor: colors.navy },
  dayWeek: { textTransform: 'uppercase', fontSize: 12, fontWeight: '600' },
  dayNumber: { fontSize: 22, lineHeight: 26, fontWeight: '700', color: colors.text },
  onNavy: { color: colors.primaryText },
  onNavyMuted: { color: colors.onNavyMuted },
  chevron: { alignSelf: 'center' },
  body: { flex: 1, gap: 2 },
  time: { color: colors.text, fontWeight: '600' },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs, flexWrap: 'wrap' },
  line: { marginTop: 2 },
  member: { color: colors.slate },
  struck: { textDecorationLine: 'line-through', color: colors.textMuted },
});
