import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDate } from '@/lib/format';
import { TFunction, useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { Subscription, TeamCoverage } from '@/lib/types';
import { mono, type } from '@/lib/typography';
import { IconName } from './ui';

const longDate = (iso: string | null | undefined) => formatDate(iso, { month: 'short', day: 'numeric', year: 'numeric' });

/** Why booking isn't covered, in words. */
function notCoveredReason(t: TFunction, sub: Subscription): string {
  if (sub.team && sub.team.active && sub.team.members > sub.team.seats) {
    return t('plan.reason.teamOverFull', { members: sub.team.members, seats: sub.team.seats });
  }
  if (sub.team && !sub.team.active && sub.team.expiresAt) return t('plan.reason.teamEnded', { date: longDate(sub.team.expiresAt) });
  if (sub.individual && !sub.individual.active) return t('plan.reason.ended', { date: longDate(sub.individual.expiresAt) });
  return t('plan.reason.none');
}

/** "Covers you until …" or why booking with clinics isn't covered. The one card for plan status. */
export function PlanCard({ sub }: { sub: Subscription }) {
  const t = useT();
  const covered = sub.canBookClinics;
  let icon: IconName = 'alert-circle-outline';
  let title = t('plan.status.notCovered');
  let detail: string | null = notCoveredReason(t, sub);
  let figure: string | null = null;

  if (covered && sub.coveredBy === 'free') {
    icon = 'checkmark-circle-outline';
    title = t('plan.status.free');
    detail = t('plan.status.freeHint');
  } else if (covered && sub.coveredBy === 'individual' && sub.individual) {
    icon = 'checkmark-circle-outline';
    title = t('plan.status.individual');
    detail = sub.individual.billingCycle === 'yearly' ? t('plan.cycle.yearly') : t('plan.cycle.monthly');
    figure = t('plan.until', { date: longDate(sub.individual.expiresAt) });
  } else if (covered && sub.coveredBy === 'team' && sub.team) {
    icon = 'people-outline';
    title = t('plan.status.team');
    detail = seatsLine(t, sub.team);
    figure = t('plan.until', { date: longDate(sub.team.expiresAt) });
  }

  return (
    <View style={[styles.card, covered ? styles.covered : styles.notCovered]} accessible accessibilityLabel={[title, figure, detail].filter(Boolean).join(', ')}>
      <Ionicons name={icon} size={24} color={covered ? colors.primaryOnSoft : colors.warning} />
      <View style={styles.text}>
        <Text style={[type.cardTitle, { color: covered ? colors.primaryOnSoft : colors.warning }]}>{title}</Text>
        {figure ? <Text style={[type.body, mono]}>{figure}</Text> : null}
        {detail ? <Text style={type.body}>{detail}</Text> : null}
      </View>
    </View>
  );
}

/** "5 of 8 seats used". */
export function seatsLine(t: TFunction, team: TeamCoverage): string {
  return t('plan.seatsUsed', { members: team.members, seats: team.seats });
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: spacing.sm + 4, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  covered: { backgroundColor: colors.primarySoft },
  notCovered: { backgroundColor: colors.warningSoft },
  text: { flex: 1, gap: 2 },
});
