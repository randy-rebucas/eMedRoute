import { ReactNode, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, errorMessage } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { TFunction, useT } from '@/lib/i18n';
import {
  offerSponsorship,
  paidAmount,
  paySponsorship,
  sponsorCover,
  sponsorshipGroups,
  sponsorshipSummary,
  updateSponsorship,
  useSponsorships,
} from '@/lib/sponsorships';
import { colors, radius, spacing } from '@/lib/theme';
import { Sponsorship, SponsorshipQuote, SponsorshipsState, SponsorTerm } from '@/lib/types';
import { type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { ErrorState } from '@/components/ErrorState';
import { Field } from '@/components/forms';
import { ThinProgress } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { photos, ScrimPhoto } from '@/components/Photo';
import { Badge, Banner, Button, LoadingView, screenStyles, useBottomPadding } from '@/components/ui';

const shortDate = (iso: string | null) => formatDate(iso, { month: 'short', day: 'numeric', year: 'numeric' });

/** A sponsorship action's failure in words: needs a connection, a known code, or the server's message. */
function useActionError() {
  const t = useT();
  return (err: unknown): string => {
    if (isNetworkError(err)) return t('common.needsConnection');
    if (err instanceof ApiError) {
      switch (err.code) {
        case 'NOT_LINKED':
          return t('sponsorships.error.notLinked');
        case 'ALREADY_OPEN':
          return t('sponsorships.error.alreadyOpen');
        case 'NOT_ACCEPTED':
          return t('sponsorships.error.notAccepted');
        case 'PAYMENT_UNAVAILABLE':
          return t('sponsorships.pay.unavailable');
      }
      return err.message;
    }
    return errorMessage(err);
  };
}

/**
 * Clinic sponsorships: the rep pays for a clinic's MyClinicSoft plan. Leads with what the rep pays
 * for and which clinic runs out next (or, with none yet, what sponsoring is), then clinics waiting
 * on the rep, the rep's sponsorships with what needs paying first and a days-left meter on each,
 * prices, the offer form, and earlier ones as short rows. Paying happens on PayMongo's web page.
 */
export default function SponsorshipsScreen() {
  const t = useT();
  const { data, loading, refreshing, error, offline, stale, updatedAt, refresh } = useSponsorships();
  const paddingBottom = useBottomPadding();

  if (!data) {
    if (loading) return <LoadingView />;
    return <ErrorState message={error ?? t('common.failedToLoad')} onRetry={refresh} />;
  }

  const { waiting, current, past } = sponsorshipGroups(data.sponsorships);

  return (
    <KeyboardAvoidingView style={screenStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={96}>
      <ScrollView
        contentContainerStyle={[screenStyles.content, { paddingBottom }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {stale || offline ? (
          <View style={styles.status}>
            <ThinProgress active={stale && !offline} />
            <OfflineBanner offline={offline} updatedAt={updatedAt} subject={t('sponsorships.offlineSubject')} />
          </View>
        ) : null}

        <Hero list={data.sponsorships} />

        {waiting.length ? (
          <Section title={t('sponsorships.section.waiting')}>
            {waiting.map((s) => (
              <SponsorshipCard key={s.id} s={s} prices={data.prices} />
            ))}
          </Section>
        ) : null}

        {current.length ? (
          <Section title={t('sponsorships.section.current')}>
            {current.map((s) => (
              <SponsorshipCard key={s.id} s={s} prices={data.prices} />
            ))}
          </Section>
        ) : null}

        <Prices quotes={data.prices.quotes} />

        <OfferForm clinics={data.clinics} />

        {past.length ? <Earlier list={past} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Navy summary of what the rep pays for; with no sponsorship at all, a photo saying what it is. */
function Hero({ list }: { list: Sponsorship[] }) {
  const t = useT();
  if (!list.length) {
    return (
      <ScrimPhoto source={photos.handshake} style={styles.photo} top={0.35} bottom={0.96}>
        <View style={styles.photoBody}>
          <Text style={styles.heroTitle} accessibilityRole="header">
            {t('sponsorships.hero.emptyTitle')}
          </Text>
          <Text style={styles.heroMuted}>{t('sponsorships.intro')}</Text>
        </View>
      </ScrimPhoto>
    );
  }

  const sum = sponsorshipSummary(list);
  return (
    <View style={styles.hero}>
      <Text style={styles.heroTitle} accessibilityRole="header">
        {sum.paying ? t('sponsorships.hero.paying', { count: sum.paying }) : t('sponsorships.hero.none')}
      </Text>
      {sum.next ? (
        <Text style={[styles.heroMuted, styles.figures]}>
          {t('sponsorships.hero.next', { clinic: sum.next.clinic.name, date: shortDate(sum.next.paidThrough) })}
        </Text>
      ) : null}
      {sum.totalPaid > 0 ? (
        <Text style={[styles.heroMuted, styles.figures]}>{t('sponsorships.hero.totalPaid', { amount: formatMoney(sum.totalPaid) })}</Text>
      ) : null}
      {sum.waiting || sum.toPay ? (
        <View style={styles.chips}>
          {sum.waiting ? <WarnChip label={t('sponsorships.hero.waiting', { count: sum.waiting })} /> : null}
          {sum.toPay ? <WarnChip label={t('sponsorships.hero.toPay', { count: sum.toPay })} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function WarnChip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Ionicons name="alert-circle" size={14} color={colors.warning} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.list}>{children}</View>
    </View>
  );
}

function termLabel(t: TFunction, months: number) {
  return months === 12 ? t('sponsorships.term.12') : months === 6 ? t('sponsorships.term.6') : months === 3 ? t('sponsorships.term.3') : t('sponsorships.term.1');
}

/** One ruled card: term, what it comes to a month (or the discount), the total. */
function Prices({ quotes }: { quotes: SponsorshipQuote[] }) {
  const t = useT();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t('sponsorships.pricesTitle')}
      </Text>
      <View style={styles.panel}>
        {quotes.map((q, i) => (
          <View
            key={q.months}
            style={[styles.priceRow, i < quotes.length - 1 && styles.rule]}
            accessible
            accessibilityLabel={`${termLabel(t, q.months)}, ${formatMoney(q.amount)}${q.percentOff > 0 ? `, ${t('sponsorships.percentOff', { percent: q.percentOff })}` : ''}`}
          >
            <View style={styles.flex}>
              <Text style={type.body}>{termLabel(t, q.months)}</Text>
              {q.months > 1 ? <Text style={[type.secondary, styles.figures]}>{t('sponsorships.perMonthEach', { price: formatMoney(q.perMonth) })}</Text> : null}
            </View>
            {q.percentOff > 0 ? <Badge label={t('sponsorships.percentOff', { percent: q.percentOff })} tone="primary" /> : null}
            <Text style={styles.amount}>{formatMoney(q.amount)}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.note}>{t('sponsorships.prices.note')}</Text>
    </View>
  );
}

function statusLine(t: TFunction, s: Sponsorship): { text: string; tone: 'neutral' | 'primary' | 'warning' | 'danger' } {
  switch (s.status) {
    case 'pending':
      return s.awaitingYou
        ? { text: t('sponsorships.status.askedYou', { clinic: s.clinic.name }), tone: 'warning' }
        : { text: t('sponsorships.status.youOffered', { clinic: s.clinic.name }), tone: 'neutral' };
    case 'accepted':
      if (s.active) return { text: t('sponsorships.status.active', { date: shortDate(s.paidThrough) }), tone: 'primary' };
      if (s.paidThrough) return { text: t('sponsorships.status.lapsed', { date: shortDate(s.paidThrough) }), tone: 'warning' };
      return { text: t('sponsorships.status.unpaid'), tone: 'warning' };
    case 'declined':
      return { text: t('sponsorships.status.declined'), tone: 'neutral' };
    case 'cancelled':
      return { text: t('sponsorships.status.cancelled'), tone: 'neutral' };
    default:
      return { text: t('sponsorships.status.ended'), tone: 'neutral' };
  }
}

/** "2 payments · ₱7,000 · 1 refunded" (refunded money isn't counted). */
function paymentsLine(t: TFunction, s: Sponsorship): string | null {
  if (!s.payments.length) return null;
  const refunded = s.payments.filter((p) => p.refunded).length;
  const line = t('sponsorships.paidTotal', { count: s.payments.length, amount: formatMoney(paidAmount(s)) });
  return refunded ? `${line} · ${t('sponsorships.refunded', { count: refunded })}` : line;
}

/** Days left on the clinic's paid plan: teal, amber inside the renewal-reminder window. */
function CoverMeter({ s }: { s: Sponsorship }) {
  const t = useT();
  const cover = sponsorCover(s);
  if (!cover) return null;
  const label = t('sponsorships.cover.left', { count: cover.left });
  return (
    <View style={styles.meter} accessible accessibilityLabel={label}>
      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${Math.max(2, Math.round(cover.share * 100))}%`, backgroundColor: cover.soon ? colors.warning : colors.accent }]}
        />
      </View>
      <Text style={[styles.meterLabel, cover.soon && styles.meterSoon]}>{label}</Text>
      {cover.soon ? <Text style={styles.soon}>{t('sponsorships.cover.soon')}</Text> : null}
    </View>
  );
}

function SponsorshipCard({ s, prices }: { s: Sponsorship; prices: SponsorshipsState['prices'] }) {
  const t = useT();
  const describe = useActionError();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const status = statusLine(t, s);
  const payments = paymentsLine(t, s);
  const asksYou = s.status === 'pending' && s.awaitingYou;
  const cover = sponsorCover(s);
  // Renewing is the main action only when the clinic's plan needs it: unpaid, ran out, or ending soon.
  const payUrgent = s.status === 'accepted' && (!cover || cover.soon);

  // The term picker can't be used once payment goes unavailable (e.g. after a refresh).
  useEffect(() => {
    if (!prices.payable) setChoosing(false);
  }, [prices.payable]);

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setProblem(null);
    setNote(null);
    try {
      await action();
      return true;
    } catch (err) {
      setProblem(describe(err));
      return false;
    } finally {
      setBusy(null);
    }
  }

  function confirmEnd() {
    if (s.status === 'pending') {
      void run('cancel', () => updateSponsorship(s.id, 'cancel'));
      return;
    }
    Alert.alert(t('sponsorships.end.title'), t('sponsorships.end.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('sponsorships.end'), style: 'destructive', onPress: () => void run('cancel', () => updateSponsorship(s.id, 'cancel')) },
    ]);
  }

  // The clinic is told at once: one stray tap shouldn't turn down a clinic.
  function confirmDecline() {
    Alert.alert(t('sponsorships.decline.title', { clinic: s.clinic.name }), t('sponsorships.decline.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('sponsorships.decline'), style: 'destructive', onPress: () => void run('decline', () => updateSponsorship(s.id, 'decline')) },
    ]);
  }

  // Stays busy until the rep is back from PayMongo's page, so a second checkout can't start.
  async function pay(months: SponsorTerm) {
    const ok = await run(`pay-${months}`, () => paySponsorship(s.id, months));
    if (ok) {
      setChoosing(false);
      setNote(t('sponsorships.pay.done'));
    }
  }

  return (
    <View style={[styles.card, asksYou && styles.cardAsks]}>
      <View style={styles.cardHead}>
        <View style={styles.monogram} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="business" size={18} color={colors.primaryText} />
        </View>
        <View style={styles.flex}>
          <Text style={type.cardTitle}>{s.clinic.name}</Text>
          {payments ? <Text style={[type.secondary, styles.figures]}>{payments}</Text> : null}
        </View>
      </View>
      <View style={styles.badgeRow}>
        <Badge label={status.text} tone={status.tone} />
      </View>
      <CoverMeter s={s} />
      {s.message ? (
        <View style={styles.quote}>
          <Text style={type.body}>“{s.message}”</Text>
        </View>
      ) : null}
      {problem ? <Banner message={problem} /> : null}
      {note ? <Banner message={note} tone="primary" /> : null}

      {asksYou ? (
        <View style={styles.actions}>
          <Button title={t('sponsorships.accept')} onPress={() => void run('accept', () => updateSponsorship(s.id, 'accept'))} loading={busy === 'accept'} disabled={!!busy} />
          <Button title={t('sponsorships.decline')} variant="secondary" onPress={confirmDecline} loading={busy === 'decline'} disabled={!!busy} />
        </View>
      ) : null}

      {s.status === 'accepted' ? (
        choosing ? (
          <View style={styles.terms}>
            <Text style={type.label}>{t('sponsorships.pay.title')}</Text>
            <Text style={type.secondary}>{t('sponsorships.pay.body')}</Text>
            <View style={styles.panel}>
              {prices.quotes.map((q, i) => (
                <TouchableOpacity
                  key={q.months}
                  style={[styles.term, i < prices.quotes.length - 1 && styles.rule]}
                  onPress={() => void pay(q.months)}
                  disabled={!!busy}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !!busy, busy: busy === `pay-${q.months}` }}
                  accessibilityLabel={`${termLabel(t, q.months)}, ${formatMoney(q.amount)}`}
                >
                  <Text style={[type.body, styles.flex]}>{termLabel(t, q.months)}</Text>
                  {q.percentOff > 0 ? <Badge label={t('sponsorships.percentOff', { percent: q.percentOff })} tone="primary" /> : null}
                  <Text style={styles.termAmount}>{formatMoney(q.amount)}</Text>
                  <Ionicons name={busy === `pay-${q.months}` ? 'hourglass-outline' : 'chevron-forward'} size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
            <Button title={t('common.cancel')} variant="secondary" onPress={() => setChoosing(false)} disabled={!!busy} />
          </View>
        ) : (
          <Button
            title={s.payments.length ? t('sponsorships.renew') : t('sponsorships.pay')}
            icon="card-outline"
            variant={payUrgent ? 'primary' : 'secondary'}
            onPress={() => setChoosing(true)}
            disabled={!prices.payable || !!busy}
          />
        )
      ) : null}
      {s.status === 'accepted' && !prices.payable ? <Text style={type.secondary}>{t('sponsorships.pay.unavailable')}</Text> : null}

      {s.status === 'accepted' || (s.status === 'pending' && !s.awaitingYou) ? (
        <TouchableOpacity
          style={styles.endAction}
          onPress={confirmEnd}
          disabled={!!busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!busy, busy: busy === 'cancel' }}
        >
          <Text style={[styles.endText, !!busy && styles.endBusy]}>
            {s.status === 'pending' ? t('sponsorships.withdraw') : t('sponsorships.end')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Finished sponsorships as short ruled rows: no actions are left on them. */
function Earlier({ list }: { list: Sponsorship[] }) {
  const t = useT();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t('sponsorships.section.past')}
      </Text>
      <View style={styles.panel}>
        {list.map((s, i) => {
          const when = shortDate(s.endedAt ?? s.respondedAt ?? s.createdAt);
          const payments = paymentsLine(t, s);
          const line = [statusLine(t, s).text, when, payments].filter(Boolean).join(' · ');
          return (
            <View key={s.id} style={[styles.pastRow, i < list.length - 1 && styles.rule]} accessible accessibilityLabel={`${s.clinic.name}, ${line}`}>
              <Text style={type.body}>{s.clinic.name}</Text>
              <Text style={[type.secondary, styles.figures]}>{line}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function OfferForm({ clinics }: { clinics: SponsorshipsState['clinics'] }) {
  const t = useT();
  const describe = useActionError();
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function send() {
    const clinic = clinics.find((c) => c.id === clinicId);
    if (!clinic || sending) return;
    setSending(true);
    setProblem(null);
    setSent(null);
    try {
      await offerSponsorship(clinic.id, message);
      setSent(t('sponsorships.offer.sent', { clinic: clinic.name }));
      setClinicId(null);
      setMessage('');
    } catch (err) {
      setProblem(describe(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t('sponsorships.offer.title')}
      </Text>
      <Text style={[type.secondary, styles.p, styles.inset]}>{t('sponsorships.offer.body')}</Text>
      {sent ? <Banner message={sent} tone="primary" /> : null}
      {clinics.length === 0 ? (
        <View style={[styles.panel, styles.none]}>
          <Text style={type.secondary}>{t('sponsorships.offer.none')}</Text>
        </View>
      ) : (
        <>
          <Text style={[type.label, styles.h]}>{t('sponsorships.offer.pick')}</Text>
          <View style={[styles.panel, styles.p]} accessibilityRole="radiogroup">
            {clinics.map((c, i) => {
              const on = c.id === clinicId;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.choice, i < clinics.length - 1 && styles.rule, on && styles.choiceOn]}
                  onPress={() => setClinicId(on ? null : c.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                >
                  <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? colors.primary : colors.textMuted} />
                  <Text style={[type.body, styles.flex]}>{c.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Field label={t('sponsorships.offer.message')} optional value={message} onChangeText={setMessage} maxLength={500} multiline />
          {problem ? <Banner message={problem} /> : null}
          <Button title={t('sponsorships.offer.send')} icon="send-outline" onPress={send} loading={sending} disabled={!clinicId} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  status: { gap: spacing.sm, marginBottom: spacing.md },
  p: { marginBottom: spacing.md },
  h: { marginBottom: spacing.sm },
  flex: { flex: 1 },
  inset: { marginHorizontal: spacing.xs },
  figures: { fontVariant: ['tabular-nums'] },
  // What the rep pays for, on the app's navy (as Home's next visit): solid, no shadow.
  hero: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.md + 4, gap: spacing.xs + 2, marginBottom: spacing.lg },
  heroTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.primaryText, letterSpacing: -0.2 },
  heroMuted: { fontSize: 14, lineHeight: 20, color: colors.onNavyMuted },
  photo: { borderRadius: radius.lg, minHeight: 220, marginBottom: spacing.lg },
  photoBody: { flex: 1, justifyContent: 'flex-end', padding: spacing.md + 4, gap: spacing.xs + 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.warningSoft,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.warning },
  section: { marginBottom: spacing.lg },
  sectionTitle: { ...type.secondary, fontWeight: '600', marginBottom: spacing.sm, marginLeft: spacing.xs },
  list: { gap: spacing.sm },
  panel: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  amount: { fontSize: 16, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  note: { ...type.secondary, marginTop: spacing.sm, marginHorizontal: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  // A clinic asking the rep: the one card that needs an answer.
  cardAsks: { borderColor: colors.warning },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4 },
  monogram: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  badgeRow: { flexDirection: 'row' },
  meter: { gap: 4 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.slateSoft, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  meterLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  meterSoon: { color: colors.warning },
  soon: { fontSize: 13, lineHeight: 18, color: colors.warning },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.border, paddingLeft: spacing.sm + 4, paddingVertical: 2 },
  actions: { gap: spacing.sm },
  terms: { gap: spacing.sm, marginTop: spacing.xs },
  term: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.md },
  termAmount: { fontSize: 15, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  // Destructive but rarely wanted: red words, not a second full-width button on every card.
  endAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  endText: { fontSize: 15, fontWeight: '600', color: colors.danger },
  endBusy: { opacity: 0.5 },
  pastRow: { minHeight: 56, justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 2 },
  none: { padding: spacing.md },
  choice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, minHeight: 52, paddingHorizontal: spacing.md },
  choiceOn: { backgroundColor: colors.primarySoft },
});
