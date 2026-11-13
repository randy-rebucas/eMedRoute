import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, errorMessage } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { offerSponsorship, paySponsorship, updateSponsorship, useSponsorships } from '@/lib/sponsorships';
import { colors, radius, spacing } from '@/lib/theme';
import { Sponsorship, SponsorshipQuote, SponsorshipsState, SponsorTerm } from '@/lib/types';
import { mono, type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { ErrorState } from '@/components/ErrorState';
import { Field } from '@/components/forms';
import { ThinProgress } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
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
 * Clinic sponsorships: pay for a clinic's MyClinicSoft plan. Answer a clinic's request, offer to
 * sponsor a linked clinic, and pay or renew for 1, 3, 6 or 12 months on PayMongo's web page.
 */
export default function SponsorshipsScreen() {
  const t = useT();
  const { data, loading, refreshing, error, offline, stale, updatedAt, refresh } = useSponsorships();
  const paddingBottom = useBottomPadding();

  if (!data) {
    if (loading) return <LoadingView />;
    return <ErrorState message={error ?? t('common.failedToLoad')} onRetry={refresh} />;
  }

  const waiting = data.sponsorships.filter((s) => s.status === 'pending' && s.awaitingYou);
  const current = data.sponsorships.filter((s) => (s.status === 'pending' && !s.awaitingYou) || s.status === 'accepted');
  const past = data.sponsorships.filter((s) => s.status !== 'pending' && s.status !== 'accepted');

  return (
    <KeyboardAvoidingView style={screenStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={96}>
      <ScrollView
        contentContainerStyle={[screenStyles.content, { paddingBottom }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <ThinProgress active={stale && !offline} />
        <OfflineBanner offline={offline} updatedAt={updatedAt} subject={t('sponsorships.offlineSubject')} />
        <Text style={[type.body, styles.p]}>{t('sponsorships.intro')}</Text>
        <Prices quotes={data.prices.quotes} />

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

        <OfferForm clinics={data.clinics} />

        {past.length ? (
          <Section title={t('sponsorships.section.past')}>
            {past.map((s) => (
              <SponsorshipCard key={s.id} s={s} prices={data.prices} />
            ))}
          </Section>
        ) : null}

        {!data.sponsorships.length ? <Text style={[type.secondary, styles.p]}>{t('sponsorships.empty')}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[type.cardTitle, styles.h]} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.list}>{children}</View>
    </View>
  );
}

function termLabel(t: ReturnType<typeof useT>, months: number) {
  return months === 12 ? t('sponsorships.term.12') : months === 6 ? t('sponsorships.term.6') : months === 3 ? t('sponsorships.term.3') : t('sponsorships.term.1');
}

function Prices({ quotes }: { quotes: SponsorshipQuote[] }) {
  const t = useT();
  return (
    <View style={styles.section}>
      <Text style={[type.label, styles.h]}>{t('sponsorships.pricesTitle')}</Text>
      <View style={styles.prices}>
        {quotes.map((q) => (
          <View key={q.months} style={styles.price} accessible accessibilityLabel={`${termLabel(t, q.months)}, ${formatMoney(q.amount)}`}>
            <Text style={type.secondary}>{termLabel(t, q.months)}</Text>
            <Text style={[mono, styles.amount]}>{formatMoney(q.amount)}</Text>
            <Text style={type.secondary}>
              {q.percentOff > 0 ? t('sponsorships.percentOff', { percent: q.percentOff }) : t('sponsorships.perMonthEach', { price: formatMoney(q.perMonth) })}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function statusLine(t: ReturnType<typeof useT>, s: Sponsorship): { text: string; tone: 'neutral' | 'primary' | 'warning' | 'danger' } {
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

function SponsorshipCard({ s, prices }: { s: Sponsorship; prices: SponsorshipsState['prices'] }) {
  const t = useT();
  const describe = useActionError();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const status = statusLine(t, s);

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

  // Stays busy until the rep is back from PayMongo's page, so a second checkout can't start.
  async function pay(months: SponsorTerm) {
    const ok = await run(`pay-${months}`, () => paySponsorship(s.id, months));
    if (ok) {
      setChoosing(false);
      setNote(t('sponsorships.pay.done'));
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Ionicons name="business-outline" size={20} color={colors.slate} />
        <Text style={[type.cardTitle, styles.flex]}>{s.clinic.name}</Text>
      </View>
      <View style={styles.badgeRow}>
        <Badge label={status.text} tone={status.tone} />
      </View>
      {s.message ? <Text style={[type.secondary, styles.italic]}>“{s.message}”</Text> : null}
      {s.payments.length ? (
        <Text style={type.secondary}>
          {t('sponsorships.payments', { count: s.payments.length })}: {s.payments.map((p) => (p.refunded ? t('sponsorships.refundedTerm', { term: termLabel(t, p.months) }) : termLabel(t, p.months))).join(', ')}
        </Text>
      ) : null}
      {problem ? <Banner message={problem} /> : null}
      {note ? <Banner message={note} tone="primary" /> : null}

      {s.status === 'pending' && s.awaitingYou ? (
        <View style={styles.actions}>
          <Button title={t('sponsorships.accept')} onPress={() => void run('accept', () => updateSponsorship(s.id, 'accept'))} loading={busy === 'accept'} disabled={!!busy} />
          <Button title={t('sponsorships.decline')} variant="secondary" onPress={() => void run('decline', () => updateSponsorship(s.id, 'decline'))} loading={busy === 'decline'} disabled={!!busy} />
        </View>
      ) : null}

      {s.status === 'accepted' ? (
        choosing ? (
          <View style={styles.terms}>
            <Text style={type.label}>{t('sponsorships.pay.title')}</Text>
            <Text style={type.secondary}>{t('sponsorships.pay.body')}</Text>
            {prices.quotes.map((q) => (
              <TouchableOpacity
                key={q.months}
                style={styles.term}
                onPress={() => void pay(q.months)}
                disabled={!!busy}
                accessibilityRole="button"
                accessibilityState={{ disabled: !!busy, busy: busy === `pay-${q.months}` }}
                accessibilityLabel={`${termLabel(t, q.months)}, ${formatMoney(q.amount)}`}
              >
                <Text style={[type.body, styles.flex]}>{termLabel(t, q.months)}</Text>
                {q.percentOff > 0 ? <Badge label={t('sponsorships.percentOff', { percent: q.percentOff })} tone="primary" /> : null}
                <Text style={[mono, styles.termAmount]}>{formatMoney(q.amount)}</Text>
                <Ionicons name={busy === `pay-${q.months}` ? 'hourglass-outline' : 'chevron-forward'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
            <Button title={t('common.cancel')} variant="secondary" onPress={() => setChoosing(false)} disabled={!!busy} />
          </View>
        ) : (
          <Button
            title={s.payments.length ? t('sponsorships.renew') : t('sponsorships.pay')}
            icon="card-outline"
            onPress={() => setChoosing(true)}
            disabled={!prices.payable || !!busy}
          />
        )
      ) : null}
      {s.status === 'accepted' && !prices.payable ? <Text style={type.secondary}>{t('sponsorships.pay.unavailable')}</Text> : null}

      {s.status === 'accepted' || (s.status === 'pending' && !s.awaitingYou) ? (
        <Button
          title={s.status === 'pending' ? t('sponsorships.withdraw') : t('sponsorships.end')}
          variant="dangerOutline"
          onPress={confirmEnd}
          loading={busy === 'cancel'}
          disabled={!!busy}
        />
      ) : null}
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
      <Text style={[type.cardTitle, styles.h]} accessibilityRole="header">
        {t('sponsorships.offer.title')}
      </Text>
      <Text style={[type.secondary, styles.p]}>{t('sponsorships.offer.body')}</Text>
      {sent ? <Banner message={sent} tone="primary" /> : null}
      {clinics.length === 0 ? (
        <Text style={type.secondary}>{t('sponsorships.offer.none')}</Text>
      ) : (
        <>
          <Text style={[type.label, styles.h]}>{t('sponsorships.offer.pick')}</Text>
          <View style={[styles.list, styles.p]} accessibilityRole="radiogroup">
            {clinics.map((c) => {
              const on = c.id === clinicId;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.choice, on && styles.choiceOn]}
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
  p: { marginBottom: spacing.md },
  h: { marginBottom: spacing.sm },
  flex: { flex: 1 },
  italic: { fontStyle: 'italic' },
  section: { marginBottom: spacing.lg },
  list: { gap: spacing.sm },
  prices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  amount: { fontSize: 20, fontWeight: '700', color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badgeRow: { flexDirection: 'row' },
  actions: { gap: spacing.sm },
  terms: { gap: spacing.sm, marginTop: spacing.xs },
  term: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  termAmount: { fontSize: 15, fontWeight: '600', color: colors.text },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choiceOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
});
