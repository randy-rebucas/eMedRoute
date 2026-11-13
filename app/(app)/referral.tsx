import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { newReferralCode, useReferral } from '@/lib/referral';
import { colors, radius, spacing } from '@/lib/theme';
import { mono, type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { ErrorState } from '@/components/ErrorState';
import { ThinProgress } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Banner, Button, LoadingView, screenStyles, useBottomPadding } from '@/components/ui';

/**
 * Refer a clinic: the rep's referral code and signup link to share, and the clinics that joined
 * with it. A clinic that uses the code adds the rep to its representatives (needed before either
 * side can set up a sponsorship).
 */
export default function ReferralScreen() {
  const t = useT();
  const { data, loading, refreshing, error, offline, stale, updatedAt, refresh } = useReferral();
  const paddingBottom = useBottomPadding();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!data) {
    if (loading) return <LoadingView />;
    return <ErrorState message={error ?? t('common.failedToLoad')} onRetry={refresh} />;
  }

  const share = () =>
    Share.share({ message: t('referral.shareMessage', { code: data.code, link: data.link }), url: data.link }).catch(() => {});

  const confirmNewCode = () =>
    Alert.alert(t('referral.newCodeTitle'), t('referral.newCodeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('referral.newCodeConfirm'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setActionError(null);
          try {
            await newReferralCode();
          } catch (err) {
            setActionError(isNetworkError(err) ? t('common.needsConnection') : errorMessage(err));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  return (
    <ScrollView
      style={screenStyles.container}
      contentContainerStyle={[screenStyles.content, { paddingBottom }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <ThinProgress active={stale && !offline} />
      <OfflineBanner offline={offline} updatedAt={updatedAt} subject={t('referral.offlineSubject')} />
      <Text style={[type.body, styles.p]}>{t('referral.intro')}</Text>

      <View style={styles.codeCard} accessible accessibilityLabel={t('referral.codeA11y', { code: data.code.split('').join(' ') })}>
        <Text style={[type.label, styles.codeLabel]}>{t('referral.codeLabel')}</Text>
        <Text style={[mono, styles.code]} selectable maxFontSizeMultiplier={1.4}>
          {data.code}
        </Text>
        <Text style={[type.secondary, styles.link]} selectable numberOfLines={2}>
          {data.link}
        </Text>
      </View>

      {actionError ? <Banner message={actionError} /> : null}

      <View style={styles.actions}>
        <Button title={t('referral.share')} icon="share-social-outline" onPress={share} disabled={offline} />
        <Button title={t('referral.newCode')} variant="secondary" onPress={confirmNewCode} loading={busy} disabled={offline} />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={type.cardTitle} accessibilityRole="header">
            {t('referral.clinicsTitle')}
          </Text>
          {data.total > 0 ? <Text style={type.secondary}>{t('referral.clinicsCount', { count: data.total })}</Text> : null}
        </View>
        {data.clinics.length ? (
          <View style={styles.list}>
            {data.clinics.map((c, i) => (
              <View key={`${c.name}-${c.joinedOn}-${i}`} style={[styles.row, i === data.clinics.length - 1 && styles.rowLast]}>
                <Text style={type.body}>{c.name}</Text>
                <Text style={type.secondary}>
                  {t('referral.clinicJoined', { date: formatDate(c.joinedOn, { month: 'short', day: 'numeric', year: 'numeric' }) })}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={type.secondary}>{t('referral.empty')}</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  p: { marginBottom: spacing.md },
  codeCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  codeLabel: { color: colors.primaryOnSoft },
  code: { fontSize: 32, fontWeight: '700', letterSpacing: 2, color: colors.primaryOnSoft },
  link: { textAlign: 'center' },
  actions: { gap: spacing.sm, marginBottom: spacing.lg },
  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  list: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  row: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: 2 },
  rowLast: { borderBottomWidth: 0 },
});
