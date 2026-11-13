import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { joinedThisMonth, newReferralCode, useReferral } from '@/lib/referral';
import { colors, radius, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { ErrorState } from '@/components/ErrorState';
import { NavRow, RowGroup } from '@/components/forms';
import { ThinProgress } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { photos, ScrimPhoto } from '@/components/Photo';
import { Banner, Button, IconTile, LoadingView, screenStyles, useBottomPadding } from '@/components/ui';

/**
 * Refer a clinic. The rep comes here to hand a clinic their code, so the code leads, on navy, with
 * Share right under it (it works offline too: the saved code is still the rep's code). Then how a
 * clinic uses it, the clinics that joined (photo empty state), and, last and confirmed, a new code.
 * The GET makes a code on first use, so only this screen loads it.
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

  const confirmNewCode = () => {
    if (busy) return;
    if (offline) {
      setActionError(t('common.needsConnection'));
      return;
    }
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
  };

  const steps = [t('referral.how.join'), t('referral.how.linked'), t('referral.how.sponsor')];
  const thisMonth = joinedThisMonth(data.clinics);
  const date = (iso: string) => formatDate(iso, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <ScrollView
      style={screenStyles.container}
      contentContainerStyle={[screenStyles.content, { paddingBottom }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      {stale || offline ? (
        <View style={styles.status}>
          <ThinProgress active={stale && !offline} />
          <OfflineBanner offline={offline} updatedAt={updatedAt} subject={t('referral.offlineSubject')} />
        </View>
      ) : null}

      <View style={styles.hero}>
        <View accessible accessibilityLabel={t('referral.codeA11y', { code: data.code.split('').join(' ') })}>
          <Text style={styles.heroLabel}>{t('referral.codeLabel')}</Text>
          <Text style={styles.code} selectable maxFontSizeMultiplier={1.4}>
            {data.code}
          </Text>
        </View>
        <Text style={styles.link} selectable numberOfLines={2}>
          {data.link}
        </Text>
        <Button title={t('referral.share')} icon="share-social-outline" onPress={share} style={styles.shareButton} />
        <Text style={styles.heroHint}>{t('referral.holdToCopy')}</Text>
      </View>

      <RowGroup title={t('referral.how')}>
        {steps.map((step, i) => (
          <View key={i} style={[styles.step, i < steps.length - 1 && styles.rule]}>
            <View style={styles.stepNumber} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text style={styles.stepNumberText}>{i + 1}</Text>
            </View>
            <Text style={[type.body, styles.flex]}>{step}</Text>
          </View>
        ))}
      </RowGroup>

      <View style={styles.sectionHead}>
        <Text style={styles.groupTitle} accessibilityRole="header">
          {t('referral.clinicsTitle')}
        </Text>
        {data.total > 0 ? (
          <Text style={styles.count}>
            {t('referral.clinicsCount', { count: data.total })}
            {thisMonth > 0 ? ` · ${t('referral.thisMonth', { count: thisMonth })}` : ''}
          </Text>
        ) : null}
      </View>
      {data.clinics.length ? (
        <>
          <View style={styles.panel}>
            {data.clinics.map((c, i) => (
              <View key={`${c.name}-${c.joinedOn}-${i}`} style={[styles.clinic, i < data.clinics.length - 1 && styles.rule]}>
                <IconTile icon="business-outline" tone="slate" size={36} />
                <View style={styles.flex}>
                  <Text style={type.body}>{c.name}</Text>
                  <Text style={type.secondary}>{t('referral.clinicJoined', { date: date(c.joinedOn) })}</Text>
                </View>
              </View>
            ))}
          </View>
          {data.total > data.clinics.length ? (
            <Text style={styles.note}>{t('referral.newestShown', { shown: data.clinics.length, total: data.total })}</Text>
          ) : null}
        </>
      ) : (
        <ScrimPhoto source={photos.clinicSign} style={styles.empty} top={0.6} bottom={0.97}>
          <View style={styles.emptyText}>
            <Ionicons name="storefront-outline" size={22} color={colors.primaryText} />
            <Text style={styles.emptyTitle}>{t('referral.empty.title')}</Text>
            <Text style={styles.emptyBody}>{t('referral.empty.body')}</Text>
          </View>
        </ScrimPhoto>
      )}

      {actionError ? (
        <View style={styles.errorWrap}>
          <Banner message={actionError} />
        </View>
      ) : null}
      <View style={styles.newCode}>
        <RowGroup>
          <NavRow
            icon="refresh-outline"
            label={busy ? t('referral.newCodeBusy') : t('referral.newCode')}
            value={t('referral.newCodeHint')}
            onPress={confirmNewCode}
            tone="danger"
            chevron={false}
            last
          />
        </RowGroup>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  status: { gap: spacing.sm, marginBottom: spacing.md },
  // The code is what the rep came for: on the app's navy, solid, no shadow.
  hero: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.md + 4, marginBottom: spacing.lg, gap: spacing.sm },
  heroLabel: { fontSize: 13, fontWeight: '600', color: colors.onNavyMuted },
  // Normal face, not mono: monospace spreads the hyphen ("REP - R8MWD8"), which reads as a space.
  // The server's alphabet has no 0/O or 1/I/L, so the plain face is unambiguous.
  code: { fontSize: 36, lineHeight: 44, fontWeight: '700', letterSpacing: 1.5, color: colors.primaryText, fontVariant: ['tabular-nums'] },
  link: { fontSize: 13, lineHeight: 18, color: colors.onNavyMuted },
  shareButton: { marginTop: spacing.sm },
  heroHint: { fontSize: 12, lineHeight: 16, color: colors.onNavyMuted, textAlign: 'center' },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, minHeight: 56, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 13, fontWeight: '700', color: colors.primaryOnSoft, fontVariant: ['tabular-nums'] },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  flex: { flex: 1, gap: 2 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.sm, marginHorizontal: spacing.xs },
  groupTitle: { ...type.secondary, fontWeight: '600' },
  count: { ...type.secondary, fontVariant: ['tabular-nums'] },
  panel: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  clinic: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, minHeight: 56, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  note: { ...type.secondary, marginTop: spacing.sm, marginHorizontal: spacing.xs },
  empty: { borderRadius: radius.lg, minHeight: 190 },
  emptyText: { flex: 1, justifyContent: 'flex-end', padding: spacing.md + 4, gap: 4 },
  emptyTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: colors.primaryText },
  emptyBody: { fontSize: 13, lineHeight: 18, color: colors.onNavyMuted },
  errorWrap: { marginTop: spacing.lg },
  newCode: { marginTop: spacing.lg },
});
