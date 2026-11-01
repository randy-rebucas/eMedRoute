import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { dismissSnack, undoDelete, useSnack } from '@/lib/undo';
import { useAnnounce } from './ui';

/**
 * The one snackbar, above the tab bar: "Visit deleted · Undo", or why a delete failed. Mounted
 * once in the signed-in layout. No animation, so it also suits Reduce Motion.
 */
export function SnackbarHost() {
  const snack = useSnack();
  const t = useT();
  const insets = useSafeAreaInsets();
  const message = snack ? (snack.kind === 'undo' ? snack.item.message : snack.message) : null;
  useAnnounce(message);
  if (!snack || !message) return null;

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 64 }]} pointerEvents="box-none">
      <View style={styles.bar} accessibilityLiveRegion="polite">
        <Text style={styles.text}>{message}</Text>
        {snack.kind === 'undo' ? (
          <TouchableOpacity onPress={undoDelete} style={styles.action} accessibilityRole="button" accessibilityLabel={t('common.undo')}>
            <Text style={styles.actionText}>{t('common.undo')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={dismissSnack} style={styles.action} accessibilityRole="button" accessibilityLabel={t('common.dismiss')}>
            <Text style={styles.actionText}>{t('common.ok')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingLeft: spacing.md,
    minHeight: 48,
    // A floating bar may cast the one soft shadow.
    shadowColor: colors.text,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  text: { ...type.body, flex: 1, color: colors.surface, paddingVertical: spacing.sm },
  action: { minHeight: 48, minWidth: 64, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 15, fontWeight: '700', color: '#7FE0DE' },
});
