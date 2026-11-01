import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { VISIT_STATE_LABEL, VisitState } from '@/lib/visits';
import { IconName } from './ui';

const LOOK: Record<VisitState, { icon: IconName; box: ViewStyle; text: TextStyle }> = {
  waiting: { icon: 'hourglass-outline', box: { backgroundColor: colors.warningSoft }, text: { color: colors.warning } },
  approved: { icon: 'checkmark-circle-outline', box: { backgroundColor: colors.primarySoft }, text: { color: colors.primaryOnSoft } },
  checkedIn: { icon: 'enter-outline', box: { backgroundColor: colors.primary }, text: { color: colors.primaryText } },
  done: { icon: 'checkmark-done-outline', box: { backgroundColor: colors.slateSoft }, text: { color: colors.slate } },
  declined: { icon: 'close-circle-outline', box: { backgroundColor: colors.dangerSoft }, text: { color: colors.danger } },
  missed: { icon: 'alert-circle-outline', box: { backgroundColor: colors.dangerSoft }, text: { color: colors.danger } },
  cancelled: {
    icon: 'ban-outline',
    box: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
    text: { color: colors.textMuted, textDecorationLine: 'line-through' },
  },
  log: {
    icon: 'book-outline',
    box: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.slate },
    text: { color: colors.slate },
  },
};

/**
 * A visit's status as word + icon + colour, the same everywhere. Screen readers get the word
 * from the row's own label, so the pill itself is hidden from them.
 */
export function StatusPill({ state }: { state: VisitState }) {
  const t = useT();
  const look = LOOK[state];
  return (
    <View style={[styles.pill, look.box]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Ionicons name={look.icon} size={14} color={look.text.color as string} />
      <Text style={[type.pill, look.text]} maxFontSizeMultiplier={1.6}>
        {t(VISIT_STATE_LABEL[state])}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
});
