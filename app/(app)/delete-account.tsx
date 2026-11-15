import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { errorMessage } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';
import { formatDate } from '@/lib/format';
import { PlainKey, useT } from '@/lib/i18n';
import { DELETION_REASON_MAX, DeletionRequest, DeletionStatus, getDeletionRequest, requestDeletion } from '@/lib/support';
import { colors, radius, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { ErrorState } from '@/components/ErrorState';
import { Field } from '@/components/forms';
import { Banner, Button, IconName, LoadingView, screenStyles, useBottomPadding } from '@/components/ui';

const STATUS_LABEL: Record<DeletionStatus, PlainKey> = {
  open: 'settings.delete.status.open',
  'in-progress': 'settings.delete.status.inProgress',
  resolved: 'settings.delete.status.resolved',
  closed: 'settings.delete.status.closed',
};

const DELETED: PlainKey[] = ['settings.delete.deleted.account', 'settings.delete.deleted.work', 'settings.delete.deleted.links'];
const KEPT: PlainKey[] = ['settings.delete.kept.billing', 'settings.delete.kept.audit', 'settings.delete.kept.backups'];
const PROCESS: PlainKey[] = ['settings.delete.process.confirm', 'settings.delete.process.days'];

/**
 * Ask for the rep's account to be deleted, from inside the app (App Store 5.1.1(v)). The request
 * lands in the platform support queue; a person confirms it's the account holder and finishes it
 * within 30 days (the same promise as the web /delete-account page).
 */
export default function DeleteAccountScreen() {
  const t = useT();
  const paddingBottom = useBottomPadding();
  const [request, setRequest] = useState<DeletionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  // State lags a frame: a double tap must not send two requests.
  const sendingRef = useRef(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setRequest(await getDeletionRequest());
    } catch (err) {
      setLoadError(isNetworkError(err) ? t('common.network') : errorMessage(err, t('settings.delete.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function send() {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setProblem(null);
    try {
      setRequest(await requestDeletion(reason));
      setJustSent(true);
    } catch (err) {
      setProblem(isNetworkError(err) ? t('common.needsConnection') : errorMessage(err));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  function confirm() {
    Alert.alert(t('settings.delete.confirmTitle'), t('settings.delete.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.delete.confirmAction'), style: 'destructive', onPress: () => void send() },
    ]);
  }

  if (loading && !request) return <LoadingView />;
  if (loadError && !request) return <ErrorState message={loadError} onRetry={load} />;

  // A closed request (withdrawn, or it couldn't be confirmed) can be followed by a new one.
  const canAsk = !request || request.status === 'closed';

  return (
    <KeyboardAvoidingView style={screenStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[screenStyles.content, { paddingBottom }]} keyboardShouldPersistTaps="handled">
        <Text style={type.body}>{t('settings.delete.intro')}</Text>

        {request ? <StatusCard request={request} justSent={justSent} /> : null}

        {canAsk ? (
          <>
            <Section title={t('settings.delete.deletedTitle')} icon="trash-outline" danger items={DELETED} />
            <Section title={t('settings.delete.keptTitle')} icon="archive-outline" items={KEPT} />
            <Section title={t('settings.delete.processTitle')} icon="time-outline" items={PROCESS} />

            <View style={styles.reason}>
              <Field
                label={t('settings.delete.reasonLabel')}
                optional
                value={reason}
                onChangeText={setReason}
                placeholder={t('settings.delete.reasonPlaceholder')}
                multiline
                maxLength={DELETION_REASON_MAX}
                editable={!sending}
              />
            </View>
            {problem ? <Banner message={problem} /> : null}
            <Button title={t('settings.delete.action')} icon="trash-outline" variant="danger" onPress={confirm} loading={sending} />
          </>
        ) : null}

        <TouchableOpacity
          style={styles.link}
          onPress={() => WebBrowser.openBrowserAsync(`${API_BASE_URL}/delete-account`).catch(() => {})}
          accessibilityRole="link"
        >
          <Ionicons name="open-outline" size={18} color={colors.primary} />
          <Text style={styles.linkText}>{t('settings.delete.webPage')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StatusCard({ request, justSent }: { request: DeletionRequest; justSent: boolean }) {
  const t = useT();
  const date = formatDate(request.requestedAt, { month: 'long', day: 'numeric', year: 'numeric' });
  const done = request.status === 'resolved' || request.status === 'closed';
  return (
    <View style={styles.hero} accessibilityLiveRegion="polite">
      <View style={styles.heroChip}>
        <Ionicons name={done ? 'checkmark-circle' : 'time-outline'} size={14} color={colors.onNavyAction} />
        <Text style={styles.heroChipText}>{t(STATUS_LABEL[request.status] ?? 'settings.delete.status.open')}</Text>
      </View>
      <Text style={styles.heroTitle} accessibilityRole="header">
        {justSent ? t('settings.delete.sentTitle') : t('settings.delete.existingTitle')}
      </Text>
      <Text style={styles.heroBody}>{t('settings.delete.requestedOn', { date })}</Text>
      <Text style={styles.heroBody} selectable>
        {t('settings.delete.reference', { reference: request.reference })}
      </Text>
      {!done ? <Text style={[styles.heroBody, styles.heroNext]}>{t('settings.delete.next')}</Text> : null}
    </View>
  );
}

function Section({ title, icon, items, danger }: { title: string; icon: IconName; items: PlainKey[]; danger?: boolean }) {
  const t = useT();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, danger && styles.sectionIconDanger]}>
          <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.primaryOnSoft} />
        </View>
        <Text style={type.cardTitle} accessibilityRole="header">
          {title}
        </Text>
      </View>
      <View style={styles.card}>
        {items.map((key) => (
          <View key={key} style={styles.item}>
            <Text style={[type.body, styles.bullet]}>{'•'}</Text>
            <Text style={[type.body, styles.itemText]}>{t(key)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sectionIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  sectionIconDanger: { backgroundColor: colors.dangerSoft },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  item: { flexDirection: 'row', gap: spacing.sm },
  bullet: { color: colors.textMuted },
  itemText: { flex: 1 },
  reason: { marginTop: spacing.lg },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, minHeight: 44 },
  linkText: { ...type.label, color: colors.primary },
  hero: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.md + 4, marginTop: spacing.lg, gap: spacing.xs },
  heroChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.navyLine,
    borderRadius: 999,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  heroChipText: { ...type.pill, color: colors.primaryText },
  heroTitle: { ...type.cardTitle, color: colors.primaryText, marginTop: spacing.sm },
  heroBody: { ...type.body, color: colors.onNavyMuted },
  heroNext: { marginTop: spacing.sm },
});
