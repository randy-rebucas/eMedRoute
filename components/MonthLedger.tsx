import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { formatDate } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { mono, type } from '@/lib/typography';
import { IconName } from './ui';

const RING = 76;
const STROKE = 8;

/**
 * Home's month card: a ring for how much of this month's visits are done, then a short ledger of
 * the two counts that may need the rep (bookings waiting on a clinic, products about to expire).
 * Each part opens the list behind it.
 */
export function MonthLedger({
  visits,
  completed,
  waiting,
  expiring,
  onVisits,
  onWaiting,
  onExpiring,
}: {
  visits: number;
  completed: number;
  waiting: number;
  expiring: number;
  onVisits: () => void;
  onWaiting: () => void;
  onExpiring: () => void;
}) {
  const t = useT();
  const month = formatDate(Date.now(), { month: 'long' });
  const share = visits > 0 ? Math.min(1, completed / visits) : 0;
  const pct = Math.round(share * 100);
  const r = (RING - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const progressText = t('home.count.completed', { done: completed, total: visits });

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.top}
        onPress={onVisits}
        accessibilityRole="button"
        accessibilityLabel={visits > 0 ? `${t('home.month.title', { month })}: ${progressText}` : t('home.month.noneYet')}
      >
        <View style={styles.ring} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Svg width={RING} height={RING}>
            <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={colors.slateSoft} strokeWidth={STROKE} fill="none" />
            {share > 0 ? (
              <Circle
                cx={RING / 2}
                cy={RING / 2}
                r={r}
                stroke={colors.primary}
                strokeWidth={STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${c * share} ${c}`}
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              />
            ) : null}
          </Svg>
          <View style={styles.ringCenter}>
            <Text style={[mono, styles.pct]} maxFontSizeMultiplier={1.2}>
              {visits > 0 ? (
                <>
                  {pct}
                  <Text style={styles.pctSign}>%</Text>
                </>
              ) : (
                '–'
              )}
            </Text>
          </View>
        </View>
        <View style={styles.topText}>
          <Text style={styles.eyebrow}>{t('home.month.title', { month })}</Text>
          {visits > 0 ? (
            <>
              <Text style={styles.figure} maxFontSizeMultiplier={1.4}>
                <Text style={mono}>{completed}</Text>
                <Text style={styles.figureOf}> / </Text>
                <Text style={mono}>{visits}</Text>
              </Text>
              <Text style={type.secondary}>{t('home.month.completedLine')}</Text>
            </>
          ) : (
            <Text style={[type.body, styles.none]}>{t('home.month.noneYet')}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>

      <Row icon="hourglass-outline" label={t('home.month.waiting')} value={waiting} onPress={onWaiting} />
      <Row icon="time-outline" label={t('home.month.expiring')} value={expiring} onPress={onExpiring} />
    </View>
  );
}

function Row({ icon, label, value, onPress }: { icon: IconName; label: string; value: number; onPress: () => void }) {
  const flagged = value > 0;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}>
      <Ionicons name={icon} size={20} color={flagged ? colors.warning : colors.textMuted} />
      <Text style={[type.body, styles.rowLabel]}>{label}</Text>
      <View style={[styles.badge, flagged && styles.badgeFlagged]}>
        <Text style={[mono, styles.badgeText, flagged && styles.badgeTextFlagged]}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  ring: { width: RING, height: RING },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  pct: { fontSize: 18, fontWeight: '700', color: colors.text },
  pctSign: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  topText: { flex: 1 },
  eyebrow: { ...type.pill, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  figure: { fontSize: 28, fontWeight: '700', color: colors.text, marginTop: 2 },
  figureOf: { color: colors.textMuted, fontWeight: '400' },
  none: { marginTop: spacing.xs, color: colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    minHeight: 52,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowLabel: { flex: 1 },
  badge: { minWidth: 32, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: colors.slateSoft, alignItems: 'center' },
  badgeFlagged: { backgroundColor: colors.warningSoft },
  badgeText: { fontSize: 14, fontWeight: '700', color: colors.slate },
  badgeTextFlagged: { color: colors.warning },
});
