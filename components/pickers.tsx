import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { formatDay, toYmd } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { mono, type } from '@/lib/typography';
import { IconName } from './ui';

// Date, time and choice inputs for the visit and product forms. Values are plain strings
// ("YYYY-MM-DD", "HH:mm"): the picker's Date is only a carrier for the phone's own wheel or calendar.

const pad2 = (n: number) => String(n).padStart(2, '0');

function dayToDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : new Date();
}

function timeToDate(hhmm: string): Date {
  const d = new Date();
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

/** A labelled box that opens a picker. */
function PickerBox({
  label,
  icon,
  text,
  placeholder,
  error,
  a11yValue,
  onPress,
}: {
  label: string;
  icon: IconName;
  text: string;
  placeholder: string;
  error?: string | null;
  a11yValue: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={type.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.box, !!error && styles.boxError]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${a11yValue}`}
      >
        <Text style={[text ? [type.body, mono] : [type.body, styles.placeholder], styles.boxText]}>{text || placeholder}</Text>
        <Ionicons name={icon} size={20} color={colors.textMuted} />
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/** iOS: the inline picker in a bottom sheet with Done. */
function IosSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.done')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} accessibilityViewIsModal>
        {children}
        <TouchableOpacity style={styles.done} onPress={onClose} accessibilityRole="button">
          <Text style={styles.doneText}>{t('common.done')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

export function DateField({
  label,
  value,
  onChange,
  error,
  minimumDate,
  maximumDate,
}: {
  label: string;
  /** "YYYY-MM-DD" or "" */
  value: string;
  onChange: (ymd: string) => void;
  error?: string | null;
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const shown = value ? formatDay(value, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const a11y = value ? formatDay(value, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : t('common.notSet');

  function press() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: dayToDate(value),
        mode: 'date',
        minimumDate,
        maximumDate,
        onValueChange: (_e, date) => onChange(toYmd(date)),
      });
    } else {
      // The wheel shows today (kept within the allowed days) when nothing is set: Done without
      // scrolling must save that day, not leave the field empty.
      if (!value) {
        let shownDay = new Date();
        if (minimumDate && shownDay < minimumDate) shownDay = minimumDate;
        if (maximumDate && shownDay > maximumDate) shownDay = maximumDate;
        onChange(toYmd(shownDay));
      }
      setOpen(true);
    }
  }

  return (
    <>
      <PickerBox label={label} icon="calendar-outline" text={shown} placeholder={t('common.pickDate')} error={error} a11yValue={a11y} onPress={press} />
      {Platform.OS === 'ios' ? (
        <IosSheet visible={open} onClose={() => setOpen(false)}>
          <DateTimePicker
            value={dayToDate(value)}
            mode="date"
            display="inline"
            accentColor={colors.primary}
            themeVariant="light"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onValueChange={(_e, date) => onChange(toYmd(date))}
          />
        </IosSheet>
      ) : null}
    </>
  );
}

export function TimeField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  /** "HH:mm" or "" */
  value: string;
  onChange: (hhmm: string) => void;
  error?: string | null;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const set = (date: Date) => onChange(`${pad2(date.getHours())}:${pad2(date.getMinutes())}`);

  function press() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: timeToDate(value), mode: 'time', is24Hour: true, onValueChange: (_e, date) => set(date) });
    } else {
      // The wheel shows 09:00 when nothing is set: Done without scrolling must save it.
      if (!value) set(timeToDate(''));
      setOpen(true);
    }
  }

  return (
    <>
      <PickerBox
        label={label}
        icon="time-outline"
        text={value}
        placeholder={t('common.pickTime')}
        error={error}
        a11yValue={value || t('common.notSet')}
        onPress={press}
      />
      {Platform.OS === 'ios' ? (
        <IosSheet visible={open} onClose={() => setOpen(false)}>
          <DateTimePicker
            value={timeToDate(value)}
            mode="time"
            display="spinner"
            locale="en-GB"
            minuteInterval={5}
            themeVariant="light"
            onValueChange={(_e, date) => set(date)}
          />
        </IosSheet>
      ) : null}
    </>
  );
}

/** A short closed choice as radio chips (wraps on narrow screens and large text). */
export function ChoiceChips<V extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
}) {
  return (
    <View style={styles.field}>
      {label ? <Text style={type.label}>{label}</Text> : null}
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <TouchableOpacity
              key={String(o.value)}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Pill-shaped filter tags for a list, in one row that scrolls sideways. The selected tag is
 * filled teal with a check (so it doesn't rely on colour alone). Pills look 36pt tall; the
 * touch target is 48pt through hitSlop. For choices inside a form, use ChoiceChips.
 */
export function FilterChips<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  /** What the tags filter, for screen readers ("Status"). */
  label: string;
  options: { value: V; label: string; icon?: IconName }[];
  value: V;
  onChange: (value: V) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterScroll}
      contentContainerStyle={styles.filterRow}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {options.map((o) => {
        const selected = o.value === value;
        const icon = selected ? 'checkmark' : o.icon;
        return (
          <TouchableOpacity
            key={o.value}
            style={[styles.pill, selected && styles.pillSelected]}
            onPress={() => onChange(o.value)}
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
          >
            {icon ? <Ionicons name={icon} size={16} color={selected ? colors.primaryText : colors.textMuted} /> : null}
            <Text style={[styles.pillText, selected && styles.pillTextSelected]} maxFontSizeMultiplier={1.6}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/** Segments that switch what a screen lists (Upcoming / Past / My log). */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
}) {
  return (
    <View style={styles.segments} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            style={[styles.segment, selected && styles.segmentSelected]}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]} numberOfLines={1}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md, gap: spacing.xs + 2 },
  box: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md - 4,
  },
  boxError: { borderColor: colors.danger },
  boxText: { flex: 1 },
  placeholder: { color: colors.textMuted },
  error: { fontSize: 13, color: colors.danger },
  backdrop: { flex: 1, backgroundColor: 'rgba(6, 24, 38, 0.45)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  done: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontSize: 16, fontWeight: '600', color: colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 15, color: colors.text },
  chipTextSelected: { fontWeight: '600', color: colors.primaryOnSoft },
  // Bleeds to the screen edges so tags scroll under them, not under the list padding.
  filterScroll: { marginHorizontal: -spacing.md, flexGrow: 0 },
  filterRow: { paddingHorizontal: spacing.md, paddingVertical: 6, gap: spacing.sm, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: 44,
    paddingHorizontal: spacing.sm + 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  pillText: { fontSize: 14, fontWeight: '600', color: colors.text },
  pillTextSelected: { color: colors.primaryText },
  segments: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    padding: 2,
    gap: 2,
  },
  segment: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm - 2, paddingHorizontal: spacing.xs },
  segmentSelected: { backgroundColor: colors.primary },
  segmentText: { fontSize: 15, fontWeight: '600', color: colors.text },
  segmentTextSelected: { color: colors.primaryText },
});
