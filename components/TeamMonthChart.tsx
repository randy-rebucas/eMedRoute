import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDay } from '@/lib/format';
import { TFunction, useT } from '@/lib/i18n';
import { byMonth, daysSinceDone, memberMonth, QUIET_DAYS, teamMonth } from '@/lib/team';
import { colors, radius, spacing } from '@/lib/theme';
import { TeamMember } from '@/lib/types';
import { mono, type } from '@/lib/typography';

// The validated pair (skill: accent = completed / primary series, slate = secondary).
const DONE = colors.accent;
const OPEN = colors.slate;

/** "Ana Cruz: 6 visits this month · 4 completed · 1 approved ahead · 1 waiting on a clinic". */
function readMember(t: TFunction, m: TeamMember): string {
  const s = m.stats;
  return `${m.name}: ${[
    t('team.stat.thisMonth', { count: s.visitsThisMonth }),
    t('team.stat.done', { count: s.completedThisMonth }),
    t('team.stat.upcoming', { count: s.upcoming }),
    t('team.stat.waiting', { count: s.pendingRequests }),
  ].join(' · ')}`;
}

/** Under the bar: when they last finished a visit, or (amber) that they haven't for a while. */
function lastDoneLine(t: TFunction, lastVisitAt: string | null): { text: string; quiet: boolean } {
  const days = daysSinceDone(lastVisitAt);
  if (days === null || !lastVisitAt) return { text: t('team.month.neverDone'), quiet: true };
  if (days >= QUIET_DAYS) return { text: t('team.month.quiet', { count: days }), quiet: true };
  return { text: t('team.month.lastDone', { date: formatDay(lastVisitAt, { month: 'short', day: 'numeric' }) }), quiet: false };
}

/**
 * The manager's question: who is out seeing clinics this month, and who has gone quiet?
 * One bar per member (busiest first): visits done (teal) and booked but not done (slate), on one
 * scale. Tap a bar to read it; the readout then carries that member's actions (their visits, and
 * Remove where allowed), so the list doesn't repeat every name.
 */
export function TeamMonthChart({
  members,
  youId,
  onVisits,
  canRemove,
  onRemove,
}: {
  members: TeamMember[];
  youId?: string;
  onVisits: (m: TeamMember) => void;
  canRemove: (m: TeamMember) => boolean;
  onRemove: (m: TeamMember) => void;
}) {
  const t = useT();
  const [picked, setPicked] = useState<string | null>(null);
  const rows = byMonth(members);
  const team = teamMonth(members);
  const max = Math.max(1, ...rows.map((m) => memberMonth(m.stats).total));
  const selected = rows.find((m) => m.id === picked) ?? null;

  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        {t('team.month.title')}
      </Text>

      <View style={styles.readout} accessibilityLiveRegion="polite">
        {selected ? (
          <>
            <Text style={[type.body, styles.figures]}>{readMember(t, selected)}</Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.action}
                onPress={() => onVisits(selected)}
                accessibilityRole="button"
                accessibilityLabel={t('team.visitsOf', { name: selected.name })}
              >
                <Text style={styles.actionText}>{t('team.visits')}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
              {canRemove(selected) ? (
                <TouchableOpacity
                  style={styles.action}
                  onPress={() => onRemove(selected)}
                  accessibilityRole="button"
                  accessibilityLabel={t('team.removeA11y', { name: selected.name })}
                >
                  <Text style={[styles.actionText, { color: colors.danger }]}>{t('team.remove')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <Text style={[type.body, styles.figures]}>
              {team.total ? t('team.month.team', { count: team.total, done: team.done }) : t('team.month.none')}
            </Text>
            <Text style={type.secondary}>{t('team.month.hint')}</Text>
          </>
        )}
      </View>

      <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Key color={DONE} label={t('team.month.legendDone')} />
        <Key color={OPEN} label={t('team.month.legendOpen')} />
      </View>

      {rows.map((m, i) => {
        const month = memberMonth(m.stats);
        const last = lastDoneLine(t, m.stats.lastVisitAt);
        const isPicked = m.id === picked;
        return (
          <TouchableOpacity
            key={m.id}
            style={[styles.row, i > 0 && styles.rule, isPicked && styles.rowPicked]}
            onPress={() => setPicked(isPicked ? null : m.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isPicked }}
            accessibilityLabel={[readMember(t, m), m.id === youId ? t('team.you') : null, m.role === 'manager' ? t('team.manager') : null, last.text]
              .filter(Boolean)
              .join(', ')}
          >
            <View style={styles.rowHead}>
              <Text style={styles.name} numberOfLines={1}>
                {m.name}
                {m.id === youId ? <Text style={type.secondary}> · {t('team.you')}</Text> : null}
              </Text>
              {m.role === 'manager' ? <Text style={styles.tag}>{t('team.manager')}</Text> : null}
              <Text style={[mono, styles.count]}>{month.total}</Text>
            </View>
            <View style={styles.track}>
              {month.done ? <View style={{ width: `${(month.done / max) * 100}%`, backgroundColor: DONE }} /> : null}
              {month.open ? <View style={{ width: `${(month.open / max) * 100}%`, backgroundColor: OPEN }} /> : null}
            </View>
            <View style={styles.lastLine}>
              {last.quiet ? <Ionicons name="alert-circle" size={14} color={colors.warning} /> : null}
              <Text style={[type.secondary, last.quiet && styles.quiet]}>{last.text}</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* The one axis: the scale every bar shares. */}
      <View style={styles.axis} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={[mono, styles.axisText]}>0</Text>
        <Text style={[mono, styles.axisText]}>{max}</Text>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    marginBottom: spacing.lg,
  },
  title: { ...type.cardTitle, paddingHorizontal: spacing.md },
  readout: { minHeight: 64, gap: 2, paddingHorizontal: spacing.md, marginTop: spacing.xs },
  figures: { fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 },
  actionText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xs, paddingHorizontal: spacing.md, marginVertical: spacing.sm },
  key: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  keyText: { fontSize: 12, color: colors.textMuted },
  row: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, gap: 6, minHeight: 64 },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowPicked: { backgroundColor: colors.surfaceMuted },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  tag: { fontSize: 12, fontWeight: '600', color: colors.slate, borderWidth: 1, borderColor: colors.slate, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 1 },
  count: { marginLeft: 'auto', fontSize: 15, fontWeight: '700', color: colors.text },
  track: { flexDirection: 'row', height: 10, borderRadius: 5, backgroundColor: colors.slateSoft, overflow: 'hidden' },
  lastLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quiet: { color: colors.warning, fontWeight: '600' },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  axisText: { fontSize: 12, color: colors.textMuted },
});
