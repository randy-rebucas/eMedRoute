import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatTime } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { InboxItem, InboxKind } from '@/lib/types';
import { type } from '@/lib/typography';
import { IconName, IconTile } from './ui';

const ICON: Record<InboxKind, IconName> = {
  visit: 'calendar-outline',
  delivery: 'cube-outline',
  reminder: 'alarm-outline',
  expiry: 'hourglass-outline',
  clinic: 'business-outline',
  team: 'people-outline',
  sponsorship: 'ribbon-outline',
  support: 'help-buoy-outline',
  system: 'notifications-outline',
};

/**
 * One notification in a day's ruled card: kind icon, title, the message, the time. Unread ones
 * carry a teal dot and a bold title (teal means "act"); read ones go quiet. `first`/`last` round
 * the card's ends, as the Visits tab's day cards do.
 */
export function InboxRow({
  item,
  first,
  last,
  onPress,
}: {
  item: InboxItem;
  first: boolean;
  last: boolean;
  onPress: (item: InboxItem) => void;
}) {
  const t = useT();
  const opens = !!item.screen;
  const time = formatTime(item.createdAt);
  return (
    <TouchableOpacity
      style={[styles.row, first && styles.first, last && styles.last, !first && styles.rule]}
      onPress={() => onPress(item)}
      // A read notification that opens nothing has nothing to do on a tap.
      disabled={item.read && !opens}
      accessibilityRole={opens ? 'button' : undefined}
      accessibilityLabel={[item.read ? null : t('notifications.unreadMark'), item.title, item.message, time].filter(Boolean).join(', ')}
    >
      <IconTile icon={ICON[item.kind] ?? ICON.system} tone={item.read ? 'neutral' : 'slate'} size={40} />
      <View style={styles.text}>
        <View style={styles.titleLine}>
          <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.time}>{time}</Text>
        </View>
        <Text style={type.secondary} numberOfLines={3}>
          {item.message}
        </Text>
      </View>
      <View style={styles.side}>
        {!item.read ? <View style={styles.dot} /> : opens ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 4,
    minHeight: 64,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  first: { borderTopWidth: 1, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  last: { borderBottomWidth: 1, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, marginBottom: spacing.md },
  rule: { borderTopWidth: StyleSheet.hairlineWidth },
  text: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  title: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.text },
  titleUnread: { fontWeight: '700' },
  // A clock time beside a title: tabular figures on the normal face (monospace spreads "2 : 30").
  time: { ...type.secondary, fontVariant: ['tabular-nums'] },
  side: { width: 18, alignItems: 'center', alignSelf: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
});
