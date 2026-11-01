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
 * Home's first card: the next scheduled visit with clinic, day and time, address, status, the
 * next step and Directions. (There is no Call: the API has no clinic phone number.)
 */
export function NextVisitCard({ visit }: { visit: NextVisit }) {
  const t = useT();
  const day = visitDay(visit);
  const days = daysFromToday(day);
  const when =
    days === 0 ? t('home.today') : days === 1 ? t('home.tomorrow') : formatDay(day, { weekday: 'long', month: 'short', day: 'numeric' });
  const line = nextStepText(t, nextStep(visit));

  return (
    <View style={styles.card}>
      <TouchableOpacity
        onPress={() => router.push(`/visits/${visit._id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${t('home.nextVisit')}: ${visitA11yLabel(t, visit)}`}
        accessibilityHint={line ?? undefined}
      >
        <Text style={styles.eyebrow}>{t('home.nextVisit')}</Text>
        <Text style={type.cardTitle}>{visit.clinicName}</Text>
        <Text style={[type.body, styles.when]}>
          {when} · <Text style={[mono, styles.time]}>{visit.time}</Text>
        </Text>
        {visit.clinicLocation ? <Text style={type.secondary}>{visit.clinicLocation}</Text> : null}
        <View style={styles.status}>
          <StatusPill state={visitState(visit)} />
        </View>
        {line ? <Text style={[type.body, styles.line]}>{line}</Text> : null}
      </TouchableOpacity>
      {visit.clinicLocation ? (
        <TouchableOpacity
          style={styles.action}
          onPress={() => openDirections(`${visit.clinicName}, ${visit.clinicLocation}`).catch(() => {})}
          accessibilityRole="button"
          accessibilityLabel={t('home.directionsA11y', { clinic: visit.clinicName })}
        >
          <Ionicons name="navigate-outline" size={20} color={colors.primary} />
          <Text style={styles.actionText}>{t('home.directions')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  eyebrow: { ...type.pill, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.xs },
  when: { marginTop: spacing.xs },
  time: { fontWeight: '600' },
  status: { marginTop: spacing.sm },
  line: { marginTop: spacing.sm },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: { fontSize: 15, fontWeight: '600', color: colors.primary },
});
