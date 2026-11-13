import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '@/lib/i18n';
import { colors, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { IconName } from './ui';

/**
 * What push carries to a rep, as ruled rows for a `RowGroup`: the six kinds the server sends
 * (lib/rep-visits, rep-deliveries, medrep-reminders, rep-access, team invites, clinic-sponsorship).
 * Shared by Settings and the sign-in "turn on notifications" step, so the two never disagree.
 * `muted`: push is off, so the rows read as what the rep is missing.
 */
export function PushBringsRows({ muted = false }: { muted?: boolean }) {
  const t = useT();
  const rows: { icon: IconName; title: string; hint: string }[] = [
    { icon: 'checkmark-done-outline', title: t('settings.brings.answers'), hint: t('settings.brings.answersHint') },
    { icon: 'alarm-outline', title: t('settings.brings.reminders'), hint: t('settings.brings.remindersHint') },
    { icon: 'cube-outline', title: t('settings.brings.deliveries'), hint: t('settings.brings.deliveriesHint') },
    { icon: 'hourglass-outline', title: t('settings.brings.expiring'), hint: t('settings.brings.expiringHint') },
    { icon: 'business-outline', title: t('settings.brings.access'), hint: t('settings.brings.accessHint') },
    { icon: 'ribbon-outline', title: t('settings.brings.sponsor'), hint: t('settings.brings.sponsorHint') },
  ];
  return (
    <>
      {rows.map((item, i) => (
        <View key={item.icon} style={[styles.row, i < rows.length - 1 && styles.rule]} accessible>
          <Ionicons name={item.icon} size={20} color={muted ? colors.textMuted : colors.slate} />
          <View style={styles.text}>
            <Text style={[styles.title, muted && { color: colors.textMuted }]}>{item.title}</Text>
            <Text style={type.secondary}>{item.hint}</Text>
          </View>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, minHeight: 56, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.text },
});
