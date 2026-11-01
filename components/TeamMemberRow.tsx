import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDay } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { TeamMember } from '@/lib/types';
import { mono, type } from '@/lib/typography';

/** One member for the manager: name, territory, this month's counts, last visit, and actions. */
export function TeamMemberRow({
  member,
  isYou,
  onVisits,
  onRemove,
}: {
  member: TeamMember;
  isYou: boolean;
  onVisits: () => void;
  /** Absent for managers (another manager can't be removed) and for yourself (use Leave). */
  onRemove?: () => void;
}) {
  const t = useT();
  const s = member.stats;
  const last = s.lastVisitAt ? formatDay(s.lastVisitAt, { month: 'short', day: 'numeric' }) : t('team.never');
  const counts = [
    t('team.stat.thisMonth', { count: s.visitsThisMonth }),
    t('team.stat.done', { count: s.completedThisMonth }),
    t('team.stat.upcoming', { count: s.upcoming }),
    t('team.stat.waiting', { count: s.pendingRequests }),
  ];

  return (
    <View style={styles.row}>
      <View
        accessible
        accessibilityLabel={[member.name, isYou ? t('team.you') : null, member.role === 'manager' ? t('team.manager') : null, member.territory, ...counts, t('team.lastVisit', { date: last })]
          .filter(Boolean)
          .join(', ')}
      >
        <View style={styles.head}>
          <Text style={type.cardTitle}>
            {member.name}
            {isYou ? <Text style={type.secondary}> · {t('team.you')}</Text> : null}
          </Text>
          {member.role === 'manager' ? (
            <View style={styles.badge}>
              <Text style={[type.pill, { color: colors.slate }]}>{t('team.manager')}</Text>
            </View>
          ) : null}
        </View>
        <Text style={type.secondary}>{[member.territory, member.email].filter(Boolean).join(' · ')}</Text>
        <View style={styles.stats}>
          <Stat value={s.visitsThisMonth} label={t('team.stat.thisMonthShort')} />
          <Stat value={s.completedThisMonth} label={t('team.stat.doneShort')} />
          <Stat value={s.upcoming} label={t('team.stat.upcomingShort')} />
          <Stat value={s.pendingRequests} label={t('team.stat.waitingShort')} />
        </View>
        <Text style={type.secondary}>
          {t('team.lastVisitLabel')} <Text style={mono}>{last}</Text>
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={onVisits} accessibilityRole="button" accessibilityLabel={t('team.visitsOf', { name: member.name })}>
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={styles.actionText}>{t('team.visits')}</Text>
        </TouchableOpacity>
        {onRemove ? (
          <TouchableOpacity style={styles.action} onPress={onRemove} accessibilityRole="button" accessibilityLabel={t('team.removeA11y', { name: member.name })}>
            <Ionicons name="person-remove-outline" size={18} color={colors.danger} />
            <Text style={[styles.actionText, { color: colors.danger }]}>{t('team.remove')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[mono, styles.statValue]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  badge: { borderRadius: radius.sm, borderWidth: 1, borderColor: colors.slate, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginVertical: spacing.sm },
  stat: { minWidth: 64 },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs, flexWrap: 'wrap' },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 48 },
  actionText: { fontSize: 15, fontWeight: '600', color: colors.primary },
});
