import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { formatMoney } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { openSupportDraft } from '@/lib/support';
import { useSubscription } from '@/lib/plan';
import { colors, radius, spacing } from '@/lib/theme';
import { mono, type } from '@/lib/typography';
import { ErrorState } from '@/components/ErrorState';
import { ThinProgress } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PlanCard } from '@/components/PlanCard';
import { Button, LoadingView, screenStyles, useBottomPadding } from '@/components/ui';

/**
 * Plan: whether booking with clinics is covered and what a plan costs. Plans are bought on the
 * web, not in the app (store payment rules); until the web has a page for it, "Get a plan" sends
 * a billing request and support replies with a payment link.
 */
export default function PlanScreen() {
  const t = useT();
  const { data: sub, loading, refreshing, error, offline, stale, updatedAt, refresh } = useSubscription();
  const paddingBottom = useBottomPadding();

  if (!sub) {
    if (loading) return <LoadingView />;
    return <ErrorState message={error ?? t('common.failedToLoad')} onRetry={refresh} />;
  }

  const showPrices = !sub.free;
  const ownPlanRunning = sub.coveredBy === 'individual';

  return (
    <ScrollView
      style={screenStyles.container}
      contentContainerStyle={[screenStyles.content, { paddingBottom }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <ThinProgress active={stale && !offline} />
      <OfflineBanner offline={offline} updatedAt={updatedAt} subject={t('plan.offlineSubject')} />
      <PlanCard sub={sub} />

      <Text style={[type.body, styles.p]}>{t('plan.alwaysFree')}</Text>

      {showPrices ? (
        <View style={styles.prices} accessible accessibilityLabel={`${t('plan.monthly')} ${formatMoney(sub.prices.monthly)}, ${t('plan.yearly')} ${formatMoney(sub.prices.yearly)}`}>
          <Price label={t('plan.monthly')} amount={sub.prices.monthly} per={t('plan.perMonth')} />
          <Price label={t('plan.yearly')} amount={sub.prices.yearly} per={t('plan.perYear')} />
        </View>
      ) : null}

      {showPrices && !sub.canBookClinics ? (
        <>
          <Text style={[type.cardTitle, styles.h]}>{t('plan.howTitle')}</Text>
          <Text style={[type.body, styles.p]}>{sub.payable ? t('plan.howBody') : t('plan.unavailableBody')}</Text>
          <Button
            title={t('plan.ask')}
            icon="mail-outline"
            onPress={() =>
              openSupportDraft({ category: 'billing', subject: t('plan.askSubject'), message: t('plan.askMessage') })
            }
          />
        </>
      ) : null}

      {showPrices && ownPlanRunning ? (
        <>
          <Text style={[type.secondary, styles.p]}>{t('plan.renewHint')}</Text>
          <Button
            title={t('plan.askRenew')}
            icon="mail-outline"
            variant="secondary"
            onPress={() =>
              openSupportDraft({ category: 'billing', subject: t('plan.askRenewSubject'), message: t('plan.askMessage') })
            }
          />
        </>
      ) : null}

      {sub.coveredBy !== 'team' ? (
        <Button title={t('plan.teamLink')} icon="people-outline" variant="secondary" onPress={() => router.push('/team')} />
      ) : null}
    </ScrollView>
  );
}

function Price({ label, amount, per }: { label: string; amount: number; per: string }) {
  return (
    <View style={styles.price}>
      <Text style={type.secondary}>{label}</Text>
      <Text style={[mono, styles.amount]}>{formatMoney(amount)}</Text>
      <Text style={type.secondary}>{per}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  p: { marginBottom: spacing.md },
  h: { marginTop: spacing.sm, marginBottom: spacing.xs },
  prices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  price: {
    flexGrow: 1,
    flexBasis: 140,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  amount: { fontSize: 22, fontWeight: '700', color: colors.text },
});
