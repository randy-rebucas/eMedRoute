import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDate, formatTime } from '@/lib/format';
import { TFunction, useT } from '@/lib/i18n';
import { colors, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { ProgressStep, ProgressStepId } from '@/lib/visits';

function stepLabel(t: TFunction, id: ProgressStepId): string {
  switch (id) {
    case 'requested':
      return t('visits.progress.requested');
    case 'answer':
      return t('visits.progress.answer');
    case 'approved':
      return t('visits.progress.approved');
    case 'declined':
      return t('visits.progress.declined');
    case 'checkIn':
      return t('visits.progress.checkIn');
    case 'checkedIn':
      return t('visits.progress.checkedIn');
    case 'finish':
      return t('visits.progress.finish');
    case 'done':
      return t('visits.progress.done');
    case 'missed':
      return t('visits.progress.missed');
    case 'cancelledByYou':
      return t('visits.next.cancelledByYou');
    case 'cancelledByClinic':
      return t('visits.next.cancelledByClinic');
  }
}

/** "Nov 12, 9:41 AM" for when a step happened. */
const stepTime = (at: string) => `${formatDate(at, { month: 'short', day: 'numeric' })}, ${formatTime(at)}`;

/**
 * A booking's path as a vertical line of steps: filled teal for what happened (with its time),
 * a ring for where it is now, hollow for what's to come, a slate cross where it ended early.
 * Answers "who has it, and since when?" without reading the status words.
 */
export function VisitProgress({ steps }: { steps: ProgressStep[] }) {
  const t = useT();
  if (!steps.length) return null;
  return (
    <View style={styles.card}>
      {steps.map((step, i) => {
        const label = stepLabel(t, step.id);
        const last = i === steps.length - 1;
        const when = step.at ? stepTime(step.at) : step.mark === 'now' ? t('visits.progress.now') : null;
        return (
          <View key={step.id} style={styles.row} accessible accessibilityLabel={[label, when].filter(Boolean).join(', ')}>
            <View style={styles.rail}>
              <Mark mark={step.mark} />
              {!last ? <View style={[styles.line, step.mark === 'done' && styles.lineDone]} /> : null}
            </View>
            <View style={[styles.text, !last && styles.textGap]}>
              <Text style={[type.body, step.mark === 'todo' ? styles.todo : styles.strong]}>{label}</Text>
              {when ? <Text style={[type.secondary, styles.when, step.mark === 'now' && styles.now]}>{when}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Mark({ mark }: { mark: ProgressStep['mark'] }) {
  switch (mark) {
    case 'done':
      return (
        <View style={[styles.dot, styles.dotDone]}>
          <Ionicons name="checkmark" size={14} color={colors.primaryText} />
        </View>
      );
    case 'now':
      return (
        <View style={[styles.dot, styles.dotNow]}>
          <View style={styles.dotNowCore} />
        </View>
      );
    case 'stopped':
      return (
        <View style={[styles.dot, styles.dotStopped]}>
          <Ionicons name="close" size={14} color={colors.primaryText} />
        </View>
      );
    case 'todo':
      return <View style={[styles.dot, styles.dotTodo]} />;
  }
}

const DOT = 22;

const styles = StyleSheet.create({
  card: { paddingVertical: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm + 4 },
  rail: { width: DOT, alignItems: 'center' },
  line: { flex: 1, width: 2, minHeight: spacing.md, backgroundColor: colors.border, marginVertical: 2 },
  lineDone: { backgroundColor: colors.accent },
  text: { flex: 1, minHeight: DOT, gap: 2 },
  textGap: { paddingBottom: spacing.md },
  strong: { fontWeight: '600' },
  todo: { color: colors.textMuted },
  when: { fontVariant: ['tabular-nums'] },
  now: { color: colors.primaryOnSoft, fontWeight: '600' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.accent },
  dotNow: { borderWidth: 2, borderColor: colors.accent, backgroundColor: colors.surface },
  dotNowCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  dotStopped: { backgroundColor: colors.slate },
  dotTodo: { borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
});
