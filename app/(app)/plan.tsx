import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { formatDate, formatMoney } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { daysLeft, openBillingRequest, useSubscription, yearlyMonthsFree } from '@/lib/plan';
import { openSupportDraft, useSupportRequests } from '@/lib/support';
import { colors, radius, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { ErrorState } from '@/components/ErrorState';
import { NavRow, RowGroup } from '@/components/forms';
import { ThinProgress } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PlanHero } from '@/components/PlanCard';
import { Button, IconName, LoadingView, screenStyles, useBottomPadding } from '@/components/ui';

/** Own plan ending within this many days: Extend becomes the main button. */
const EXTEND_SOON_DAYS = 7;

/**
 * Plan: is booking with clinics covered, until when, what needs a plan and what it costs.
 * Plans are bought on the web, not in the app (store payment rules; the user's decision): "Ask for
 * a payment link" sends a billing request and support emails a link. When such a request is already
 * open, the screen says so instead of offering to send another.
 */
export default function PlanScreen() {
  const t = useT();
  const { data: sub, loading, refreshing, error, offline, stale, updatedAt, refresh } = useSubscription();
  // Only to spot a billing request already waiting on support (the GET has no side effects).
  const { items: requests, refresh: refreshRequests } = useSupportRequests();
  const paddingBottom = useBottomPadding();

  if (!sub) {
    if (loading) return <LoadingView />;
    return <ErrorState message={error ?? t('common.failedToLoad')} onRetry={refresh} />;
  }

  const ownPlan = sub.coveredBy === 'individual' && sub.individual ? sub.individual : null;
  const needsPlan = !sub.free && !sub.canBookClinics;
  const showPrices = !sub.free && sub.coveredBy !== 'team';
  const showAction = !sub.free && (needsPlan || !!ownPlan);
  const endingSoon = !!ownPlan && daysLeft(ownPlan.expiresAt) <= EXTEND_SOON_DAYS;
  const asked = showAction ? openBillingRequest(requests) : null;
  const monthsFree = yearlyMonthsFree(sub.prices);

  // Team-covered: the hero already shows the seats, so the row needs no line.
  const teamValue =
    sub.coveredBy !== 'team' && !sub.free && sub.prices.seatMonthly > 0
      ? t('plan.teamSeatPrice', { price: formatMoney(sub.prices.seatMonthly) })
      : undefined;

  return (
    <ScrollView
      style={screenStyles.container}
      contentContainerStyle={[screenStyles.content, { paddingBottom }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            refresh();
            refreshRequests();
          }}
          tintColor={colors.primary}
        />
      }
    >
      {stale || offline ? (
        <View style={styles.status}>
          <ThinProgress active={stale && !offline} />
          <OfflineBanner offline={offline} updatedAt={updatedAt} subject={t('plan.offlineSubject')} />
        </View>
      ) : null}

      <PlanHero sub={sub} />

      {needsPlan ? (
        <>
          <RowGroup title={t('plan.what.title')}>
            <WhatRow icon="create-outline" label={t('plan.what.log')} plan={false} />
            <WhatRow icon="medkit-outline" label={t('plan.what.products')} plan={false} />
            <WhatRow icon="calendar-outline" label={t('plan.what.book')} plan />
            <WhatRow icon="cube-outline" label={t('plan.what.deliver')} plan last />
          </RowGroup>
          <Text style={styles.note}>{t('plan.what.clinicsNeverPay')}</Text>
        </>
      ) : null}

      {showPrices ? (
        <>
          <RowGroup title={t('plan.prices.title')}>
            <PriceRow label={t('plan.monthly')} amount={formatMoney(sub.prices.monthly)} per={t('plan.perMonth')} />
            <PriceRow
              label={t('plan.yearly')}
              amount={formatMoney(sub.prices.yearly)}
              per={t('plan.perYear')}
              tag={monthsFree > 0 ? t('plan.monthsFree', { count: monthsFree }) : undefined}
              last
            />
          </RowGroup>
          <Text style={styles.note}>{t('plan.card')}</Text>
        </>
      ) : null}

      {showAction ? (
        asked ? (
          <View style={styles.asked} accessible>
            <Ionicons name="mail-open-outline" size={22} color={colors.slate} />
            <View style={styles.askedText}>
              <Text style={styles.askedTitle}>
                {t('plan.asked', { date: formatDate(asked.createdAt, { month: 'short', day: 'numeric' }) })}
              </Text>
              <Text style={type.secondary}>{t('plan.askedBody', { reference: asked.reference })}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.action}>
            {needsPlan ? (
              <>
                <Text style={type.cardTitle}>{t('plan.howTitle')}</Text>
                <Text style={type.body}>{sub.payable ? t('plan.howBody') : t('plan.unavailableBody')}</Text>
                <Button
                  title={t('plan.ask')}
                  icon="mail-outline"
                  onPress={() => openSupportDraft({ category: 'billing', subject: t('plan.askSubject'), message: t('plan.askMessage') })}
                />
              </>
            ) : (
              <>
                <Text style={type.secondary}>{t('plan.renewHint')}</Text>
                <Button
                  title={t('plan.askRenew')}
                  icon="mail-outline"
                  variant={endingSoon ? 'primary' : 'secondary'}
                  onPress={() => openSupportDraft({ category: 'billing', subject: t('plan.askRenewSubject'), message: t('plan.askMessage') })}
                />
              </>
            )}
          </View>
        )
      ) : null}

      <RowGroup>
        {asked ? <NavRow icon="mail-outline" label={t('plan.seeRequests')} onPress={() => router.push('/support')} /> : null}
        <NavRow icon="people-outline" label={t('plan.teamLink')} value={teamValue} onPress={() => router.push('/team')} last />
      </RowGroup>
    </ScrollView>
  );
}

/** One line of what needs a plan: the thing, then "Free" (neutral) or "Plan" (amber: it's what's missing). */
function WhatRow({ icon, label, plan, last = false }: { icon: IconName; label: string; plan: boolean; last?: boolean }) {
  const t = useT();
  const tag = plan ? t('plan.what.plan') : t('plan.what.free');
  return (
    <View style={[styles.row, !last && styles.rule]} accessible accessibilityLabel={`${label}, ${tag}`}>
      <Ionicons name={icon} size={20} color={colors.slate} />
      <Text style={[type.body, styles.rowLabel]}>{label}</Text>
      <View style={[styles.tag, plan ? styles.tagPlan : styles.tagFree]}>
        <Text style={[styles.tagText, { color: plan ? colors.warning : colors.textMuted }]}>{tag}</Text>
      </View>
    </View>
  );
}

/** A price line: label, the amount in tabular figures, and its period. */
function PriceRow({ label, amount, per, tag, last = false }: { label: string; amount: string; per: string; tag?: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rule]} accessible accessibilityLabel={[label, amount, per, tag].filter(Boolean).join(', ')}>
      <View style={styles.rowLabel}>
        <Text style={type.body}>{label}</Text>
        {tag ? <Text style={styles.save}>{tag}</Text> : null}
      </View>
      <View style={styles.amountCol}>
        <Text style={styles.amount}>{amount}</Text>
        <Text style={type.secondary}>{per}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  status: { gap: spacing.sm, marginBottom: spacing.md },
  note: { ...type.secondary, marginTop: -spacing.md, marginBottom: spacing.lg, marginHorizontal: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, minHeight: 56, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowLabel: { flex: 1, gap: 2 },
  tag: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  tagPlan: { backgroundColor: colors.warningSoft },
  tagFree: { backgroundColor: colors.slateSoft },
  tagText: { fontSize: 12, fontWeight: '700' },
  save: { fontSize: 13, fontWeight: '600', color: colors.primaryOnSoft },
  amountCol: { alignItems: 'flex-end' },
  amount: { fontSize: 18, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  action: { gap: spacing.sm + 4, marginBottom: spacing.lg },
  asked: {
    flexDirection: 'row',
    gap: spacing.sm + 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  askedText: { flex: 1, gap: 2 },
  askedTitle: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.text },
});
