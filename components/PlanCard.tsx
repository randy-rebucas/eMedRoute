import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDate } from '@/lib/format';
import { TFunction, useT } from '@/lib/i18n';
import { cycleDays, daysLeft } from '@/lib/plan';
import { colors, radius, spacing } from '@/lib/theme';
import { Subscription, TeamCoverage } from '@/lib/types';
import { photos, ScrimPhoto } from './Photo';

const longDate = (iso: string | null | undefined) => formatDate(iso, { month: 'short', day: 'numeric', year: 'numeric' });

/** Cover ending within this many days is flagged amber. */
const ENDS_SOON_DAYS = 7;

/** Why booking isn't covered, in words. */
export function notCoveredReason(t: TFunction, sub: Subscription): string {
  if (sub.team && sub.team.active && sub.team.members > sub.team.seats) {
    return t('plan.reason.teamOverFull', { members: sub.team.members, seats: sub.team.seats });
  }
  if (sub.team && !sub.team.active && sub.team.expiresAt) return t('plan.reason.teamEnded', { date: longDate(sub.team.expiresAt) });
  if (sub.individual && !sub.individual.active) return t('plan.reason.ended', { date: longDate(sub.individual.expiresAt) });
  return t('plan.reason.none');
}

/** "Seats used: 5/8". */
export function seatsLine(t: TFunction, team: TeamCoverage): string {
  return t('plan.seatsUsed', { members: team.members, seats: team.seats });
}

/**
 * Plan's hero: is booking covered, through what, until when, and how much is left.
 *  - Own plan: a days-left meter on one paid period (renewals stack, so it caps at full); amber
 *    in the last week.
 *  - Team seat: a seats meter (members against seats bought).
 *  - Free: no meter.
 *  - Not covered: on a photo (the clinic meeting a plan pays for), with the reason.
 */
export function PlanHero({ sub, now = new Date() }: { sub: Subscription; now?: Date }) {
  const t = useT();
  const covered = sub.canBookClinics;

  if (!covered) {
    return (
      <ScrimPhoto source={photos.doctorMeeting} style={styles.photo} top={0.35} bottom={0.96}>
        <View style={styles.photoBody}>
          <Chip label={t('plan.hero.notCovered')} tone="warning" />
          <Text style={styles.title} accessibilityRole="header">
            {t('plan.status.notCovered')}
          </Text>
          <Text style={styles.muted}>{notCoveredReason(t, sub)}</Text>
        </View>
      </ScrimPhoto>
    );
  }

  if (sub.coveredBy === 'individual' && sub.individual) {
    const left = daysLeft(sub.individual.expiresAt, now);
    const soon = left <= ENDS_SOON_DAYS;
    const share = Math.min(1, left / cycleDays(sub.individual.billingCycle));
    const cycle = sub.individual.billingCycle === 'yearly' ? t('plan.cycle.yearly') : t('plan.cycle.monthly');
    const leftLabel = t('plan.daysLeft', { count: left });
    return (
      <View style={styles.hero}>
        <Chip label={t('plan.hero.covered')} />
        <Text style={styles.title} accessibilityRole="header">
          {t('plan.status.individual')}
        </Text>
        <Text style={[styles.muted, styles.figures]}>
          {t('plan.until', { date: longDate(sub.individual.expiresAt) })} · {cycle}
        </Text>
        <Meter share={share} tone={soon ? 'warning' : 'accent'} label={leftLabel} />
        {soon ? <Text style={styles.soon}>{t('plan.endsSoon')}</Text> : null}
      </View>
    );
  }

  if (sub.coveredBy === 'team' && sub.team) {
    const { members, seats } = sub.team;
    return (
      <View style={styles.hero}>
        <Chip label={t('plan.hero.covered')} />
        <Text style={styles.title} accessibilityRole="header">
          {t('plan.status.team')}
        </Text>
        {sub.team.expiresAt ? (
          <Text style={[styles.muted, styles.figures]}>{t('plan.until', { date: longDate(sub.team.expiresAt) })}</Text>
        ) : null}
        <Meter share={seats > 0 ? Math.min(1, members / seats) : 0} tone="accent" label={t('plan.seatsTaken', { members, seats })} />
      </View>
    );
  }

  // Free for everyone (or covered some other way the app doesn't know yet).
  return (
    <View style={styles.hero}>
      <Chip label={t('plan.hero.freeChip')} />
      <Text style={styles.title} accessibilityRole="header">
        {t('plan.status.free')}
      </Text>
      <Text style={styles.muted}>{t('plan.status.freeHint')}</Text>
    </View>
  );
}

function Chip({ label, tone = 'good' }: { label: string; tone?: 'good' | 'warning' }) {
  const warn = tone === 'warning';
  return (
    <View style={[styles.chip, warn && styles.chipWarn]}>
      <Ionicons name={warn ? 'alert-circle' : 'checkmark-circle'} size={14} color={warn ? colors.warning : colors.primaryText} />
      <Text style={[styles.chipText, warn && { color: colors.warning }]}>{label}</Text>
    </View>
  );
}

/** One slim bar on navy, with its reading always written under it (nothing to tap). */
export function Meter({ share, tone, label }: { share: number; tone: 'accent' | 'warning'; label: string }) {
  return (
    <View style={styles.meterWrap} accessible accessibilityLabel={label}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(share * 100)}%`, backgroundColor: tone === 'warning' ? colors.warningSoft : colors.accent }]} />
      </View>
      <Text style={styles.meterLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Solid navy, no shadow (as Home's next visit).
  hero: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.md + 4, gap: spacing.sm, marginBottom: spacing.lg },
  photo: { borderRadius: radius.lg, minHeight: 240, marginBottom: spacing.lg },
  photoBody: { flex: 1, justifyContent: 'flex-end', padding: spacing.md + 4, gap: spacing.sm },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.primaryText, letterSpacing: -0.2 },
  muted: { fontSize: 14, lineHeight: 20, color: colors.onNavyMuted },
  figures: { fontVariant: ['tabular-nums'] },
  soon: { fontSize: 13, lineHeight: 18, color: colors.warningSoft, fontWeight: '600' },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  chipWarn: { backgroundColor: colors.warningSoft },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.primaryText },
  meterWrap: { gap: 6, marginTop: spacing.xs },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.navyLine, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  meterLabel: { fontSize: 13, fontWeight: '600', color: colors.primaryText, fontVariant: ['tabular-nums'] },
});
