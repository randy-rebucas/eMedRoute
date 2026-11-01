import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { parseHours } from '@/lib/clinics';
import { formatDay } from '@/lib/format';
import { TFunction, useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { Clinic } from '@/lib/types';
import { mono, type } from '@/lib/typography';
import { Button } from './ui';

/** A Sunday, so weekday names come from the locale (2023-01-01 was a Sunday). */
const weekdayName = (dow: number) => formatDay(`2023-01-0${1 + dow}`, { weekday: 'short' });

/** The clinic's rep hours as lines in the rep's language: "Tue 15:00–17:00". */
export function hoursLines(clinic: Pick<Clinic, 'hours'>): string[] {
  const windows = parseHours(clinic.hours);
  // A line the app can't read is shown as the server wrote it.
  if (windows.length !== clinic.hours.length) return clinic.hours;
  return windows.map((w) => `${weekdayName(w.dayOfWeek)} ${w.start}–${w.end}`);
}

export function clinicA11yLabel(t: TFunction, clinic: Clinic): string {
  const access = clinic.canBook === false ? t(clinic.access === 'requested' ? 'clinics.access.requested' : 'clinics.access.closed') : null;
  return [clinic.name, clinic.location, clinic.linked ? t('clinics.linked') : null, access, hoursLines(clinic).join('; ')].filter(Boolean).join(', ');
}

/** "Sunrise Medical Clinic" → "SM": the clinic's monogram tile, since clinics have no logo in the API. */
function monogram(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w));
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/**
 * A clinic in the directory: monogram, name, place, linked badge, rep hours, instructions, and
 * Book. A clinic that hasn't accepted the rep (the "All clinics" list) shows Request access, or
 * the waiting request with Withdraw, instead of hours and Book.
 */
export function ClinicRow({
  clinic,
  onBook,
  onRequest,
  onWithdraw,
  busy = false,
}: {
  clinic: Clinic;
  onBook: () => void;
  onRequest?: () => void;
  onWithdraw?: () => void;
  busy?: boolean;
}) {
  const t = useT();
  const closed = clinic.canBook === false;
  const requested = clinic.access === 'requested';
  return (
    <View style={styles.card}>
      <View accessible accessibilityLabel={clinicA11yLabel(t, clinic)}>
        <View style={styles.top}>
          <View style={styles.mark}>
            <Text style={styles.markText} maxFontSizeMultiplier={1.3}>
              {monogram(clinic.name)}
            </Text>
          </View>
          <View style={styles.titleBox}>
            <View style={styles.head}>
              <Text style={[type.cardTitle, styles.name]}>{clinic.name}</Text>
              {clinic.linked ? (
                <View style={styles.linked}>
                  <Ionicons name="link-outline" size={14} color={colors.primaryOnSoft} />
                  <Text style={[type.pill, { color: colors.primaryOnSoft }]}>{t('clinics.linked')}</Text>
                </View>
              ) : null}
            </View>
            {clinic.location ? (
              <View style={styles.place}>
                <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                <Text style={[type.secondary, styles.placeText]}>{clinic.location}</Text>
              </View>
            ) : null}
          </View>
        </View>
        {closed ? (
          <View style={[styles.hours, requested && styles.waiting]}>
            <Ionicons name={requested ? 'hourglass-outline' : 'lock-closed-outline'} size={16} color={requested ? colors.warning : colors.textMuted} />
            <View style={styles.hoursLines}>
              <Text style={[type.label, requested && { color: colors.warning }]}>{t(requested ? 'clinics.access.requested' : 'clinics.access.closed')}</Text>
              <Text style={type.secondary}>{t(requested ? 'clinics.access.waiting' : 'clinics.access.hint')}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.hours}>
            <Ionicons name="time-outline" size={16} color={colors.textMuted} />
            <View style={styles.hoursLines}>
              {hoursLines(clinic).map((line) => (
                <Text key={line} style={[type.secondary, mono]}>
                  {line}
                </Text>
              ))}
            </View>
          </View>
        )}
        {clinic.instructions ? (
          <View style={styles.instructions}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
            <Text style={[type.secondary, styles.placeText]} numberOfLines={2}>
              {clinic.instructions}
            </Text>
          </View>
        ) : null}
      </View>
      {!closed ? (
        <Button title={t('clinics.book')} icon="calendar-outline" onPress={onBook} style={styles.book} />
      ) : requested ? (
        <TouchableOpacity style={styles.withdraw} onPress={onWithdraw} disabled={busy || !onWithdraw} accessibilityRole="button">
          <Ionicons name="close-circle-outline" size={18} color={colors.textMuted} />
          <Text style={styles.withdrawText}>{t('clinics.access.withdraw')}</Text>
        </TouchableOpacity>
      ) : (
        <Button title={t('clinics.access.request')} icon="hand-right-outline" variant="secondary" onPress={onRequest ?? (() => {})} loading={busy} style={styles.book} />
      )}
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
    marginBottom: spacing.sm,
  },
  top: { flexDirection: 'row', gap: spacing.sm + 4 },
  mark: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.slateSoft, alignItems: 'center', justifyContent: 'center' },
  markText: { fontSize: 17, fontWeight: '700', color: colors.slate },
  titleBox: { flex: 1, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, flexWrap: 'wrap' },
  place: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  placeText: { flex: 1 },
  name: { flexShrink: 1 },
  linked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.primarySoft,
  },
  hours: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm + 4,
    padding: spacing.sm + 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  hoursLines: { gap: 2 },
  instructions: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm },
  book: { marginTop: spacing.md },
  waiting: { backgroundColor: colors.warningSoft, borderColor: colors.warningSoft },
  withdraw: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, minHeight: 48, marginTop: spacing.sm, alignSelf: 'flex-start' },
  withdrawText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
});
