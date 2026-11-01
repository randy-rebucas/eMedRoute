import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useT } from '@/lib/i18n';
import { useRepProfile } from '@/lib/profile';
import { colors, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { ErrorState } from '@/components/ErrorState';
import { Button, Card, DetailRow, LoadingView, screenStyles, useBottomPadding } from '@/components/ui';

/** The rep's profile as the server has it, with Edit. */
export default function ProfileScreen() {
  const t = useT();
  const { data: profile, loading, refreshing, error, refresh } = useRepProfile();
  const paddingBottom = useBottomPadding();

  if (loading && !profile) return <LoadingView />;
  if (!profile) return <ErrorState message={error ?? t('common.failedToLoad')} onRetry={refresh} />;

  const name = [profile.title, profile.firstName, profile.lastName].filter(Boolean).join(' ');

  return (
    <ScrollView
      style={screenStyles.container}
      contentContainerStyle={[screenStyles.content, { paddingBottom }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <View style={styles.head}>
        <Text style={type.screenTitle} accessibilityRole="header">
          {name}
        </Text>
        <Text style={type.secondary}>{profile.company}</Text>
      </View>

      <Card>
        <DetailRow label={t('profile.email')} value={profile.email} />
        <DetailRow label={t('profile.phone')} value={profile.phone} />
        <DetailRow label={t('profile.company')} value={profile.company} />
        <DetailRow label={t('profile.territory')} value={profile.territory} />
      </Card>

      {profile.bio ? (
        <Card>
          <Text style={[type.label, styles.bioLabel]}>{t('profile.bio')}</Text>
          <Text style={type.body}>{profile.bio}</Text>
        </Card>
      ) : null}

      <Text style={[type.secondary, styles.note]}>{t('profile.emailNote')}</Text>
      <Button title={t('profile.edit')} icon="create-outline" variant="secondary" onPress={() => router.push('/profile/edit')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { marginBottom: spacing.md, gap: 2 },
  bioLabel: { marginBottom: spacing.xs },
  note: { marginTop: spacing.sm },
});
