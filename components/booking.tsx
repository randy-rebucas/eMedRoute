import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { BookingDay } from '@/lib/clinics';
import { formatDay } from '@/lib/format';
import { tapSlot } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { Slot } from '@/lib/types';
import { mono, type } from '@/lib/typography';

// The booking sheet's date strip and slot grid, shared by Book and Move.

/** Days from today to the clinic's booking horizon. Days without rep hours are greyed, not hidden. */
export function DateStrip({ days, value, onChange }: { days: BookingDay[]; value: string | null; onChange: (day: string) => void }) {
  const t = useT();
  const scroller = useRef<ScrollView>(null);
  const CHIP = 64 + spacing.sm;

  // Bring the chosen day into view when the sheet opens on a later day.
  useEffect(() => {
    const i = days.findIndex((d) => d.day === value);
    if (i > 2) scroller.current?.scrollTo({ x: (i - 1) * CHIP, animated: false });
    // Once, when the sheet opens: later picks scroll themselves into view by tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} accessibilityRole="tablist">
      {days.map((d, i) => {
        const selected = d.day === value;
        const showMonth = i === 0 || d.day.endsWith('-01');
        const label = formatDay(d.day, { weekday: 'long', day: 'numeric', month: 'long' });
        return (
          <TouchableOpacity
            key={d.day}
            style={[styles.dayChip, selected && styles.dayChipSelected, !d.open && styles.dayChipClosed]}
            disabled={!d.open}
            onPress={() => onChange(d.day)}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled: !d.open }}
            accessibilityLabel={d.open ? label : `${label}, ${t('booking.noHours')}`}
          >
            <Text style={[styles.dayWeek, selected && styles.onPrimary, !d.open && styles.closedText]} maxFontSizeMultiplier={1.4}>
              {formatDay(d.day, { weekday: 'short' })}
            </Text>
            <Text style={[mono, styles.dayNumber, selected && styles.onPrimary, !d.open && styles.closedText]} maxFontSizeMultiplier={1.4}>
              {d.day.slice(8, 10)}
            </Text>
            <Text style={[styles.dayWeek, selected && styles.onPrimary, !d.open && styles.closedText]} maxFontSizeMultiplier={1.4}>
              {showMonth ? formatDay(d.day, { month: 'short' }) : ' '}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/** Slots in 3 columns (2 at large text sizes), with seats left; full slots are disabled. */
export function SlotGrid({ slots, value, onChange }: { slots: Slot[]; value: string | null; onChange: (time: string) => void }) {
  const t = useT();
  const { fontScale } = useWindowDimensions();
  const columns = fontScale > 1.3 ? 2 : 3;

  return (
    <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={t('booking.time')}>
      {slots.map((s) => {
        const full = s.remaining <= 0;
        const selected = s.time === value;
        const seats = full ? t('booking.full') : t('booking.seatsLeft', { count: s.remaining });
        return (
          <View key={s.time} style={{ width: `${100 / columns}%`, padding: spacing.xs }}>
            <TouchableOpacity
              style={[styles.slot, selected && styles.slotSelected, full && styles.slotFull]}
              disabled={full}
              onPress={() => {
                tapSlot();
                onChange(s.time);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: full }}
              accessibilityLabel={`${s.time}, ${full ? t('booking.full') : t('booking.seatsLeftA11y', { count: s.remaining })}`}
            >
              <Text style={[mono, styles.slotTime, selected && styles.onPrimary, full && styles.closedText]}>{s.time}</Text>
              <Text style={[styles.slotSeats, selected && styles.onPrimary, full && styles.closedText]}>{seats}</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: spacing.sm, paddingVertical: spacing.xs },
  dayChip: {
    width: 64,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xs,
  },
  dayChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayChipClosed: { backgroundColor: colors.background, borderStyle: 'dashed' },
  dayWeek: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase' },
  dayNumber: { fontSize: 20, fontWeight: '700', color: colors.text },
  closedText: { color: colors.textMuted, opacity: 0.7 },
  onPrimary: { color: colors.primaryText },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  slot: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xs,
  },
  slotSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotFull: { backgroundColor: colors.background },
  slotTime: { fontSize: 17, fontWeight: '700', color: colors.text },
  slotSeats: { ...type.pill, color: colors.textMuted },
});
