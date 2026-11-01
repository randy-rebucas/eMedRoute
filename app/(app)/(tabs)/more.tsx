import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { initialsOf } from '@/components/AppHeader';
import { NavRow, RowGroup } from '@/components/forms';
import { screenStyles } from '@/components/ui';

/** More: Team and Plan, the rep's account (Profile, Settings, Support) and sign out. */
export default function MoreScreen() {
  const { rep, signOut } = useAuth();
  const t = useT();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      // Signed out on this device regardless; the sign-in screen takes over.
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <SafeAreaView style={screenStyles.container} edges={['top']}>
      <ScrollView contentContainerStyle={screenStyles.content}>
        <Text style={[type.screenTitle, styles.title]} accessibilityRole="header">
          {t('nav.more')}
        </Text>
        {rep ? (
          <TouchableOpacity
            style={styles.who}
            onPress={() => router.push('/profile')}
            accessibilityRole="button"
            accessibilityLabel={`${rep.name}, ${t('more.profile')}`}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText} maxFontSizeMultiplier={1.3}>
                {initialsOf(rep.name)}
              </Text>
            </View>
            <View style={styles.whoText}>
              <Text style={type.cardTitle}>{rep.name}</Text>
              <Text style={type.secondary}>{[rep.company, rep.email].filter(Boolean).join(' · ')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}

        <RowGroup title={t('more.work')}>
          <NavRow icon="people-outline" label={t('more.team')} onPress={() => router.push('/team')} />
          <NavRow icon="card-outline" label={t('more.plan')} onPress={() => router.push('/plan')} last />
        </RowGroup>

        <RowGroup title={t('more.account')}>
          <NavRow icon="person-outline" label={t('more.profile')} onPress={() => router.push('/profile')} />
          <NavRow icon="settings-outline" label={t('more.settings')} onPress={() => router.push('/settings')} />
          <NavRow icon="help-buoy-outline" label={t('more.support')} onPress={() => router.push('/support')} last />
        </RowGroup>

        <RowGroup>
          <NavRow
            icon="log-out-outline"
            label={signingOut ? t('more.signingOut') : t('common.signOut')}
            onPress={() => {
              if (signingOut) return;
              handleSignOut().catch(() => Alert.alert(t('common.somethingWrong')));
            }}
            chevron={false}
            last
          />
        </RowGroup>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: spacing.sm, marginBottom: spacing.md },
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '700', color: colors.primaryText },
  whoText: { flex: 1, gap: 2 },
});
