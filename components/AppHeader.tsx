import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { colors, spacing } from '@/lib/theme';
import { Avatar, initialsOf } from './Avatar';
import { BrandLogo } from './BrandLogo';

// Kept importable from here for older callers; it lives with Avatar now.
export { initialsOf } from './Avatar';

/** Logo + profile avatar, for the top of tab screens. */
export function AppHeader() {
  const { rep } = useAuth();
  const pathname = usePathname();
  const t = useT();
  const initials = initialsOf(rep?.name);

  return (
    <View style={styles.bar}>
      <BrandLogo size="sm" align="left" />
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
