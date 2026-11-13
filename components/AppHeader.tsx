import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { useUnreadCount } from '@/lib/inbox';
import { useT } from '@/lib/i18n';
import { colors, spacing } from '@/lib/theme';
import { Avatar, initialsOf } from './Avatar';
import { BrandLogo } from './BrandLogo';

// Kept importable from here for older callers; it lives with Avatar now.
export { initialsOf } from './Avatar';

/** Logo, the notifications bell (with its unread count) and the profile avatar, for the top of Home. */
export function AppHeader() {
  const { rep } = useAuth();
  const pathname = usePathname();
  const t = useT();
  const initials = initialsOf(rep?.name);
  const unread = useUnreadCount();

  return (
    <View style={styles.bar}>
      <BrandLogo size="sm" align="left" />
      <View style={styles.end}>
        {/* Only once the server answers: an older server has no inbox to open. */}
        {unread.available ? (
          <TouchableOpacity
            style={styles.bell}
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel={unread.count > 0 ? t('notifications.bellUnread', { count: unread.count }) : t('notifications.bell')}
          >
            <Ionicons name={unread.count > 0 ? 'notifications' : 'notifications-outline'} size={24} color={colors.text} />
            {unread.count > 0 ? (
              <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Text style={styles.badgeText} maxFontSizeMultiplier={1.2}>
                  {unread.count > 99 ? '99+' : unread.count}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.avatar}
          onPress={() => {
            if (pathname !== '/profile') router.push('/profile');
          }}
          accessibilityRole="button"
          accessibilityLabel={t('common.header.yourProfile')}
        >
          {rep?.profileImage || initials ? (
            <Avatar name={rep?.name} image={rep?.profileImage} size={48} />
          ) : (
            <Ionicons name="person-outline" size={22} color={colors.primaryOnSoft} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  end: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bell: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  // The count on teal: "something here for you", the same signal as an unread row's dot.
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 12, lineHeight: 14, fontWeight: '700', color: colors.primaryText, fontVariant: ['tabular-nums'] },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
