import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { Illustration, IllustrationName } from './Illustration';
import { Button, IconName } from './ui';

/** A list with nothing in it: a spot illustration, what's missing, and the way to add one. */
export function EmptyState({
  art,
  title,
  hint,
  action,
}: {
  art: IllustrationName;
  title: string;
  hint?: string;
  action?: { title: string; icon?: IconName; onPress: () => void };
}) {
  return (
    <View style={styles.box}>
      <Illustration name={art} />
      <Text style={[type.cardTitle, styles.center]} accessibilityRole="header">
        {title}
      </Text>
      {hint ? <Text style={[type.secondary, styles.center, styles.hint]}>{hint}</Text> : null}
      {action ? <Button title={action.title} icon={action.icon} variant="secondary" onPress={action.onPress} style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.md, gap: spacing.sm },
  center: { textAlign: 'center' },
  hint: { maxWidth: 300 },
  action: { alignSelf: 'stretch', marginTop: spacing.sm },
});
