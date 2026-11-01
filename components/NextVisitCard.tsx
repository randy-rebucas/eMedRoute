import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { daysFromToday, formatDay } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { openDirections } from '@/lib/maps';
import { colors, radius, spacing } from '@/lib/theme';
import { Dashboard } from '@/lib/types';
import { mono, type } from '@/lib/typography';
import { nextStep, visitDay, visitState } from '@/lib/visits';
import { StatusPill } from './StatusPill';
import { nextStepText, visitA11yLabel } from './VisitRow';

type NextVisit = Dashboard['nextVisits'][number];

/**
 * Home's hero: the next scheduled visit on the rep app's navy, with clinic, day and time, address,
 * status, the next step, Directions and Details. (There is no Call: the API has no clinic phone
 * number.) Solid fill, no shadow, per the design rules.
 */
export function NextVisitCard({ visit }: { visit: NextVisit }) {
  const t = useT();
  const day = visitDay(visit);
  const days = daysFromToday(day);
  const when =
    days === 0 ? t('home.today') : days === 1 ? t('home.tomorrow') : formatDay(day, { weekday: 'long', month: 'short', day: 'numeric' });
  const line = nextStepText(t, nextStep(visit));
  const open = () => router.push(`/visits/${visit._id}`);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${t('home.nextVisit')}: ${visitA11yLabel(t, visit)}`}
        accessibilityHint={line ?? undefined}
      >
        <View style={styles.top}>
          <Text style={styles.eyebrow}>{t('home.nextVisit')}</Text>
          <StatusPill state={visitState(visit)} onDark />
        </View>
        <Text style={styles.clinic}>{visit.clinicName}</Text>

        <View style={styles.whenRow}>
          <View style={styles.whenBox}>
            <Ionicons name="calendar-outline" size={18} color={colors.onNavyMuted} />
            <Text style={styles.when}>{when}</Text>
          </View>
          <View style={styles.whenBox}>
            <Ionicons name="time-outline" size={18} color={colors.onNavyMuted} />
            <Text style={[mono, styles.time]}>{visit.time}</Text>
            {visit.duration ? <Text style={styles.muted}>· {t('visits.minutes', { minutes: visit.duration })}</Text> : null}
          </View>
        </View>

        {visit.clinicLocation ? (
          <View style={styles.place}>
            <Ionicons name="location-outline" size={18} color={colors.onNavyMuted} />
            <Text style={[styles.muted, styles.placeText]}>{visit.clinicLocation}</Text>
          </View>
        ) : null}

        {line ? (
          <View style={styles.next}>
            <Ionicons name="arrow-forward-circle-outline" size={20} color={colors.accent} />
            <Text style={styles.nextText}>{line}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <View style={styles.actions}>
        {visit.clinicLocation ? (
          <TouchableOpacity
            style={[styles.action, styles.actionPrimary]}
            onPress={() => openDirections(`${visit.clinicName}, ${visit.clinicLocation}`).catch(() => {})}
            accessibilityRole="button"
            accessibilityLabel={t('home.directionsA11y', { clinic: visit.clinicName })}
          >
            <Ionicons name="navigate-outline" size={20} color={colors.primaryText} />
            <Text style={styles.actionText}>{t('home.directions')}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[styles.action, styles.actionGhost]} onPress={open} accessibilityRole="button" accessibilityLabel={t('home.details')}>
          <Ionicons name="document-text-outline" size={20} color={colors.primaryText} />
          <Text style={styles.actionText}>{t('home.details')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: spacing.md + 4,
    marginBottom: spacing.md,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  eyebrow: { ...type.pill, color: colors.onNavyMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  clinic: { fontSize: 22, fontWeight: '700', color: colors.primaryText, letterSpacing: -0.2, marginTop: spacing.sm },
  whenRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xs, marginTop: spacing.sm + 4 },
  whenBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  when: { fontSize: 15, fontWeight: '600', color: colors.primaryText },
  time: { fontSize: 17, fontWeight: '700', color: colors.primaryText },
  muted: { fontSize: 13, lineHeight: 18, color: colors.onNavyMuted },
  place: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs + 2, marginTop: spacing.sm },
  placeText: { flex: 1, fontSize: 14, lineHeight: 20 },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md - 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.navyLine,
  },
  nextText: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.primaryText },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  action: {
    flexGrow: 1,
    flexBasis: 128,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  actionPrimary: { backgroundColor: colors.primary },
  actionGhost: { borderWidth: 1, borderColor: colors.navyLine },
  actionText: { fontSize: 15, fontWeight: '600', color: colors.primaryText },
});
