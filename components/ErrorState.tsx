import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, spacing } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { Illustration } from './Illustration';
import { useAnnounce } from './ui';
import { textSize } from '@/lib/typography';

/** `actionLabel`: the button's words when it doesn't retry (e.g. "Go back"); default "Try again". */
export function ErrorState({ message, onRetry, actionLabel }: { message: string; onRetry: () => void; actionLabel?: string }) {
  const t = useT();
  const label = actionLabel ?? t('common.tryAgain');
  useAnnounce(message);
  return (
    <View style={styles.container}>
      <Illustration name="error" size={120} />
      <Text style={styles.text} accessibilityRole="alert" accessibilityLiveRegion="polite">
        {message}
      </Text>
      <TouchableOpacity style={styles.button} onPress={onRetry} accessibilityRole="button" accessibilityLabel={label}>
        <Text style={styles.buttonText}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  text: { color: colors.textMuted, fontSize: textSize.base, lineHeight: 21, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.md, maxWidth: 320 },
  button: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonText: { color: colors.primary, fontWeight: '600' },
});

/**
 * A record that no longer exists (deleted, or an old link or push). Retrying can't help, so the
 * only way on is back (or Home when there's nothing to go back to).
 */
export function NotFoundState() {
  const t = useT();
  return (
    <ErrorState
      message={t('common.notFound.body')}
      actionLabel={router.canGoBack() ? t('common.goBack') : t('common.notFound.home')}
      onRetry={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}
