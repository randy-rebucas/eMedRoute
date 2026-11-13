import { ReactNode, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { IconName, IconTile } from './ui';

// Labelled inputs and ruled rows for the signed-in forms (profile, settings, support).

/** A label over a text input, with an optional hint, error and "(optional)" mark. */
export function Field({
  label,
  hint,
  error,
  optional = false,
  multiline,
  style,
  ...rest
}: TextInputProps & { label: string; hint?: string; error?: string | null; optional?: boolean }) {
  const t = useT();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={type.label}>
        {label}
        {optional ? <Text style={styles.optional}> {t('common.optional')}</Text> : null}
      </Text>
      <TextInput
        {...rest}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMultiline, focused && styles.inputFocused, !!error && styles.inputError, style]}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={optional ? `${label} ${t('common.optional')}` : label}
        accessibilityHint={hint}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
      />
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={type.secondary}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** A group of ruled rows in one bordered panel, with an optional heading above it. */
export function RowGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      {title ? (
        <Text style={styles.groupTitle} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <View style={styles.panel}>{children}</View>
    </View>
  );
}

/** A row that opens a screen or does something: icon, label, optional value, chevron. */
export function NavRow({
  icon,
  label,
  value,
  valueTone,
  onPress,
  tone = 'default',
  last = false,
  chevron = true,
}: {
  icon: IconName;
  label: string;
  value?: string;
  /** `warning`: the line under the label needs the rep (amber, with an icon); `good`: all set (teal). */
  valueTone?: 'warning' | 'good';
  onPress: () => void;
  tone?: 'default' | 'danger';
  last?: boolean;
  chevron?: boolean;
}) {
  const color = tone === 'danger' ? colors.danger : colors.text;
  return (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowRule]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
    >
      <IconTile icon={icon} tone={tone === 'danger' ? 'danger' : 'slate'} size={36} />
      <View style={styles.rowText}>
        <Text style={[type.body, { color }]}>{label}</Text>
        {value ? (
          <View style={styles.valueLine}>
            {valueTone === 'warning' ? <Ionicons name="alert-circle" size={14} color={colors.warning} /> : null}
            <Text
              style={[
                type.secondary,
                styles.valueText,
                valueTone === 'warning' && { color: colors.warning, fontWeight: '600' },
                valueTone === 'good' && { color: colors.primaryOnSoft },
              ]}
            >
              {value}
            </Text>
          </View>
        ) : null}
      </View>
      {chevron ? <Ionicons name="chevron-forward" size={20} color={colors.textMuted} /> : null}
    </TouchableOpacity>
  );
}

/** A switch with immediate meaning: label, one-line hint, the switch at the right. */
export function SwitchRow({
  label,
  hint,
  value,
  onValueChange,
  disabled = false,
  last = false,
  children,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  last?: boolean;
  /** Extra line under the row (e.g. the phone's own setting is off). */
  children?: ReactNode;
}) {
  return (
    <View style={[styles.switchRow, !last && styles.rowRule]}>
      <View style={styles.switchLine}>
        <View style={styles.rowText}>
          <Text style={type.body}>{label}</Text>
          {hint ? <Text style={type.secondary}>{hint}</Text> : null}
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor={colors.surface}
          ios_backgroundColor={colors.border}
          accessibilityLabel={label}
          accessibilityHint={hint}
        />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md, gap: spacing.xs + 2 },
  optional: { fontWeight: '400', color: colors.textMuted },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md - 4,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
  },
  inputMultiline: { minHeight: 112, textAlignVertical: 'top' },
  inputFocused: { borderColor: colors.primary },
  inputError: { borderColor: colors.danger },
  error: { fontSize: 13, color: colors.danger },
  group: { marginBottom: spacing.lg },
  groupTitle: { ...type.secondary, fontWeight: '600', marginBottom: spacing.sm, marginLeft: spacing.xs },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, minHeight: 56, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rowRule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowText: { flex: 1, gap: 2 },
  valueLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  valueText: { flexShrink: 1 },
  switchRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, gap: spacing.sm },
  switchLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 },
});
