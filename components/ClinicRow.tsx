import { useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DUE_AFTER_DAYS, nextHours, parseHours, weekdayOf } from '@/lib/clinics';
import { clinicTodayYmd, daysFromToday, formatDay } from '@/lib/format';
import { TFunction, useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { Clinic } from '@/lib/types';
import { type } from '@/lib/typography';
import { Button, IconName } from './ui';

/** A Sunday, so weekday names come from the locale (2023-01-01 was a Sunday). */
const weekdayName = (dow: number, style: 'short' | 'long' | 'narrow' = 'short') => formatDay(`2023-01-0${1 + dow}`, { weekday: style });

/** The rep's week, Monday first. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

/** "Today", "Tomorrow", else "Tue, Nov 18". */
function dayWord(t: TFunction, day: string): string {
  const n = daysFromToday(day);
  return n === 0 ? t('visits.day.today') : n === 1 ? t('visits.day.tomorrow') : formatDay(day, { weekday: 'short', month: 'short', day: 'numeric' });
}

type History = { text: string; tone: 'booked' | 'due' | 'plain'; icon: IconName } | null;

/** What the rep's own record with this clinic says: booked next, overdue, or last seen. */
export function clinicHistory(t: TFunction, clinic: Clinic): History {
  if (clinic.lastVisit === undefined && clinic.nextVisit === undefined) return null; // older server
  if (clinic.nextVisit) {
    return { text: t('clinics.history.booked', { when: dayWord(t, clinic.nextVisit.date), time: clinic.nextVisit.time }), tone: 'booked', icon: 'calendar' };
  }
  // Never been: only a clinic that added the rep is waiting on a first visit; open ones aren't owed one.
  if (!clinic.lastVisit) return { text: t('clinics.history.never'), tone: clinic.linked ? 'due' : 'plain', icon: 'flag-outline' };
  const ago = -daysFromToday(clinic.lastVisit);
  if (ago <= 0) return { text: t('clinics.history.lastToday'), tone: 'plain', icon: 'checkmark-done-outline' };
  if (ago > DUE_AFTER_DAYS) return { text: t('clinics.history.due', { count: ago }), tone: 'due', icon: 'alert-circle-outline' };
  return { text: t('clinics.history.last', { count: ago }), tone: 'plain', icon: 'checkmark-done-outline' };
}

export function clinicA11yLabel(t: TFunction, clinic: Clinic): string {
  const access = clinic.canBook === false ? t(clinic.access === 'requested' ? 'clinics.access.requested' : 'clinics.access.closed') : null;
  return [clinic.name, clinic.location, clinic.linked ? t('clinics.linked') : null, access, clinicHistory(t, clinic)?.text]
    .filter(Boolean)
    .join(', ');
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
 * The clinic's rep hours as a week, Monday first: days with hours filled, today ringed. The line
 * under it reads the next window ("Next rep hours · Today 15:00–17:00"); tapping a day reads that
 * day's windows instead, and tapping it again goes back.
 */
function HoursWeek({ clinic }: { clinic: Clinic }) {
  const t = useT();
  const [picked, setPicked] = useState<number | null>(null);
  const windows = parseHours(clinic.hours);
  // Lines the app can't read: show them as the server wrote them, as before.
  if (windows.length !== clinic.hours.length || !windows.length) {
    return (
      <View style={styles.hoursFallback}>
        <Ionicons name="time-outline" size={16} color={colors.textMuted} />
        <View style={styles.flex}>
          {clinic.hours.length ? (
            clinic.hours.map((line) => (
              <Text key={line} style={[type.secondary, styles.tabular]}>
                {line}
              </Text>
            ))
          ) : (
            <Text style={type.secondary}>{t('clinics.hours.none')}</Text>
          )}
        </View>
      </View>
    );
  }
  const todayDow = weekdayOf(clinicTodayYmd());
  const byDay = (dow: number) => windows.filter((w) => w.dayOfWeek === dow).sort((a, b) => a.start.localeCompare(b.start));
  const span = (dow: number) => byDay(dow).map((w) => `${w.start}–${w.end}`).join(' · ');
  const next = nextHours(clinic.hours);

  let readout: { lead: string; value: string };
  if (picked !== null) {
    const s = span(picked);
    readout = s
      ? { lead: weekdayName(picked, 'long'), value: s }
      : { lead: weekdayName(picked, 'long'), value: t('clinics.hours.closedDay') };
  } else if (next) {
    readout = { lead: t('clinics.hours.next'), value: `${dayWord(t, next.day)} ${next.start}–${next.end}` };
  } else {
    readout = { lead: t('clinics.hours.next'), value: t('clinics.hours.none') };
  }

  return (
    <View style={styles.week}>
      <View style={styles.weekCells}>
        {WEEK.map((dow) => {
          const open = byDay(dow).length > 0;
          const isPicked = picked === dow;
          const isToday = dow === todayDow;
          return (
            <Pressable
              key={dow}
              onPress={() => setPicked(isPicked ? null : dow)}
              style={[styles.cell, open && styles.cellOpen, isToday && styles.cellToday, isPicked && styles.cellPicked]}
              hitSlop={{ top: 8, bottom: 8 }}
              accessibilityRole="button"
              accessibilityState={{ selected: isPicked }}
              accessibilityLabel={`${weekdayName(dow, 'long')}: ${open ? span(dow) : t('clinics.hours.closedDay')}`}
            >
              <Text style={[styles.cellText, open && styles.cellTextOpen, isPicked && styles.cellTextPicked]} maxFontSizeMultiplier={1.3}>
                {weekdayName(dow, 'narrow')}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.readout} accessibilityLiveRegion="polite">
        <Text style={styles.readoutLead}>{readout.lead} · </Text>
        <Text style={styles.tabular}>{readout.value}</Text>
      </Text>
    </View>
  );
}

/**
 * A clinic in the directory: monogram, name, place, linked badge, the rep's own record with it
 * (booked next / last seen / due a visit), rep hours as a week, instructions, and Book. A clinic
 * that hasn't accepted the rep (the "All clinics" list) shows Request access, or the waiting
 * request with Withdraw, instead of hours and Book.
 */
export function ClinicRow({
  clinic,
  onBook,
  onRequest,
  onWithdraw,
  onLeave,
  busy = false,
}: {
  clinic: Clinic;
  onBook: () => void;
  onRequest?: () => void;
  onWithdraw?: () => void;
  /** Linked clinics only: take it off the rep's list. */
  onLeave?: () => void;
  busy?: boolean;
}) {
  const t = useT();
  const closed = clinic.canBook === false;
  const requested = clinic.access === 'requested';
  const history = closed ? null : clinicHistory(t, clinic);
  return (
    <View style={styles.card}>
      <View accessible accessibilityLabel={clinicA11yLabel(t, clinic)}>
        <View style={styles.top}>
          <View style={[styles.mark, clinic.linked && styles.markLinked]}>
            <Text style={[styles.markText, clinic.linked && styles.markTextLinked]} maxFontSizeMultiplier={1.3}>
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
                <Text style={[type.secondary, styles.flex]}>{clinic.location}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {history ? (
          <View style={[styles.history, history.tone === 'due' && styles.historyDue, history.tone === 'booked' && styles.historyBooked]}>
            <Ionicons
              name={history.icon}
              size={16}
              color={history.tone === 'booked' ? colors.primaryOnSoft : history.tone === 'due' ? colors.warning : colors.slate}
            />
            <Text
              style={[
                styles.historyText,
                history.tone === 'booked' && { color: colors.primaryOnSoft },
                history.tone === 'due' && { color: colors.warning },
              ]}
            >
              {history.text}
            </Text>
          </View>
        ) : null}
      </View>

      {closed ? (
        <View style={[styles.access, requested && styles.waiting]}>
          <Ionicons name={requested ? 'hourglass-outline' : 'lock-closed-outline'} size={16} color={requested ? colors.warning : colors.textMuted} />
          <View style={styles.flex}>
            <Text style={[type.label, requested && { color: colors.warning }]}>{t(requested ? 'clinics.access.requested' : 'clinics.access.closed')}</Text>
            <Text style={type.secondary}>{t(requested ? 'clinics.access.waiting' : 'clinics.access.hint')}</Text>
          </View>
        </View>
      ) : (
        <HoursWeek clinic={clinic} />
      )}

      {clinic.instructions ? (
        <View style={styles.instructions}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
          <Text style={[type.secondary, styles.flex]} numberOfLines={2}>
            {clinic.instructions}
          </Text>
        </View>
      ) : null}

      {!closed ? (
        <View style={styles.actions}>
          <Button title={t('clinics.book')} icon="calendar-outline" onPress={onBook} style={styles.book} />
          {clinic.linked && onLeave ? (
            <TouchableOpacity style={styles.quiet} onPress={onLeave} disabled={busy} accessibilityRole="button" accessibilityLabel={`${t('clinics.leave')}, ${clinic.name}`}>
              <Ionicons name="exit-outline" size={18} color={colors.textMuted} />
              <Text style={styles.quietText}>{t('clinics.leave')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : requested ? (
        <TouchableOpacity style={styles.quiet} onPress={onWithdraw} disabled={busy || !onWithdraw} accessibilityRole="button">
          <Ionicons name="close-circle-outline" size={18} color={colors.textMuted} />
          <Text style={styles.quietText}>{t('clinics.access.withdraw')}</Text>
        </TouchableOpacity>
      ) : (
        <Button title={t('clinics.access.request')} icon="hand-right-outline" variant="secondary" onPress={onRequest ?? (() => {})} loading={busy} style={styles.requestButton} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm + 4,
  },
  top: { flexDirection: 'row', gap: spacing.sm + 4 },
  mark: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.slateSoft, alignItems: 'center', justifyContent: 'center' },
  // A clinic that added the rep wears the rep app's navy; the rest stay slate.
  markLinked: { backgroundColor: colors.navy },
  markText: { fontSize: 17, fontWeight: '700', color: colors.slate },
  markTextLinked: { color: colors.primaryText },
  titleBox: { flex: 1, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, flexWrap: 'wrap' },
  place: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
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
  history: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.sm + 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.slateSoft,
  },
  historyDue: { backgroundColor: colors.warningSoft },
  historyBooked: { backgroundColor: colors.primarySoft },
  historyText: { fontSize: 13, fontWeight: '600', color: colors.slate, flexShrink: 1 },
  week: {
    marginTop: spacing.sm + 4,
    paddingTop: spacing.sm + 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  weekCells: { flexDirection: 'row', gap: 6 },
  cell: {
    flex: 1,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cellOpen: { backgroundColor: colors.primarySoft },
  cellToday: { borderColor: colors.navy, borderWidth: 1.5 },
  cellPicked: { backgroundColor: colors.primary },
  cellText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  cellTextOpen: { color: colors.primaryOnSoft, fontWeight: '700' },
  cellTextPicked: { color: colors.primaryText },
  readout: { fontSize: 13, lineHeight: 18, color: colors.text, marginTop: spacing.sm },
  readoutLead: { color: colors.textMuted, fontWeight: '600' },
  hoursFallback: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm + 4,
    paddingTop: spacing.sm + 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  access: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm + 4,
    padding: spacing.sm + 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  waiting: { backgroundColor: colors.warningSoft, borderColor: colors.warningSoft },
  instructions: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  book: { flexGrow: 1, flexBasis: 160 },
  requestButton: { marginTop: spacing.md },
  quiet: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, minHeight: 48, marginTop: spacing.sm, alignSelf: 'flex-start' },
  quietText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
});
