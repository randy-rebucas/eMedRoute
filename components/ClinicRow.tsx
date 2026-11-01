import { StyleSheet, Text, View } from 'react-native';
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
  return [clinic.name, clinic.location, clinic.linked ? t('clinics.linked') : null, hoursLines(clinic).join('; ')].filter(Boolean).join(', ');
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

/** A clinic in the directory: monogram, name, place, linked badge, rep hours, instructions, and Book. */
export function ClinicRow({ clinic, onBook }: { clinic: Clinic; onBook: () => void }) {
  const t = useT();
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
        {clinic.instructions ? (
          <View style={styles.instructions}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
            <Text style={[type.secondary, styles.placeText]} numberOfLines={2}>
              {clinic.instructions}
            </Text>
          </View>
        ) : null}
      </View>
      <Button
        title={t('clinics.book')}
        icon="calendar-outline"
        onPress={onBook}
        style={styles.book}
      />
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
});
