import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatTime } from '@/lib/format';
import { TFunction, useT } from '@/lib/i18n';
import { lastActivity, replyToSupportRequest, RequestState, requestState, useSupportRequests } from '@/lib/support';
import { colors, radius, spacing } from '@/lib/theme';
import { SupportRequest } from '@/lib/types';
import { type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { ErrorState } from '@/components/ErrorState';
import { Field } from '@/components/forms';
import { Banner, Button, IconName, IconTile, ListFooter, LoadingView, screenStyles, useAnnounce, useBottomPadding } from '@/components/ui';

const STATE: Record<RequestState, { icon: IconName; fg: string; bg: string }> = {
  // Amber: the rep has something to read. Everything else is just where it stands.
  replied: { icon: 'chatbubble-ellipses', fg: colors.warning, bg: colors.warningSoft },
  waiting: { icon: 'time-outline', fg: colors.slate, bg: colors.slateSoft },
  resolved: { icon: 'checkmark-circle', fg: colors.primaryOnSoft, bg: colors.primarySoft },
  closed: { icon: 'archive-outline', fg: colors.textMuted, bg: colors.slateSoft },
};

function stateLabel(t: TFunction, state: RequestState): string {
  switch (state) {
    case 'replied':
      return t('support.state.replied');
    case 'waiting':
      return t('support.state.waiting');
    case 'resolved':
      return t('support.state.resolved');
    case 'closed':
      return t('support.state.closed');
  }
}

const day = (value: string) => formatDate(value, { month: 'short', day: 'numeric' });

/**
 * Support: the rep's requests as one ruled list, each saying from the rep's side where it stands
 * ("Support replied" in amber when there's something to read). Open one for the thread and to
 * answer support in the app, which the reply email asks for.
 */
export default function SupportScreen() {
  const t = useT();
  const { rep } = useAuth();
  const { items, loading, refreshing, loadingMore, error, loadMoreError, refresh, reload, loadMore } = useSupportRequests();
  const [open, setOpen] = useState<string | null>(null);
  const paddingBottom = useBottomPadding();

  if (loading && items.length === 0) return <LoadingView />;
  if (error && items.length === 0) return <ErrorState message={error} onRetry={reload} />;

  const replied = items.filter((r) => requestState(r) === 'replied').length;
  const email = rep?.email ?? '';

  return (
    <FlatList
      style={screenStyles.container}
      contentContainerStyle={[screenStyles.list, { paddingBottom }]}
      data={items}
      keyExtractor={(item) => item._id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={type.secondary}>{t('support.intro')}</Text>
          <Button title={t('support.new')} icon="create-outline" onPress={() => router.push('/support/new')} />
          {replied > 0 ? (
            <View style={styles.replied} accessibilityLiveRegion="polite">
              <Ionicons name="chatbubble-ellipses" size={16} color={colors.warning} />
              <Text style={styles.repliedText}>{t('support.repliedCount', { count: replied })}</Text>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <IconTile icon="help-buoy-outline" tone="slate" size={48} />
          <Text style={type.cardTitle} accessibilityRole="header">
            {t('support.empty.title')}
          </Text>
          <Text style={[type.secondary, styles.center]}>{t('support.empty.body', { email })}</Text>
        </View>
      }
      ListFooterComponent={<ListFooter loadingMore={loadingMore} error={loadMoreError} onRetry={loadMore} />}
      renderItem={({ item, index }) => (
        <RequestRow
          request={item}
          first={index === 0}
          last={index === items.length - 1}
          expanded={open === item._id}
          onToggle={() => setOpen(open === item._id ? null : item._id)}
        />
      )}
    />
  );
}

function RequestRow({
  request,
  first,
  last,
  expanded,
  onToggle,
}: {
  request: SupportRequest;
  first: boolean;
  last: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const state = requestState(request);
  const tone = STATE[state];
  const label = stateLabel(t, state);
  const replies = request.replies ?? [];
  const fromTeam = replies.filter((r) => r.authorType === 'platform').length;
  const when = replies.length ? t('support.lastOn', { date: day(lastActivity(request)) }) : t('support.sentOn', { date: day(request.createdAt) });
  const meta = [when, fromTeam > 0 ? t('support.replies', { count: fromTeam }) : null].filter(Boolean).join(' · ');

  return (
    <View style={[styles.row, first && styles.rowFirst, last && styles.rowLast]}>
      <TouchableOpacity
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${request.subject}, ${label}, ${meta}`}
        style={styles.head}
      >
        <View style={styles.headText}>
          <Text style={[styles.subject, state === 'replied' && styles.subjectStrong]} numberOfLines={expanded ? undefined : 2}>
            {request.subject}
          </Text>
          <Text style={[type.secondary, styles.nums]}>{meta}</Text>
          <View style={[styles.chip, { backgroundColor: tone.bg }]}>
            <Ionicons name={tone.icon} size={13} color={tone.fg} />
            <Text style={[styles.chipText, { color: tone.fg }]}>{label}</Text>
          </View>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
      </TouchableOpacity>

      {expanded ? <Thread request={request} state={state} /> : null}
      {/* A line inside the row, not a bottom border: a hairline border notches the side borders. */}
      {!last ? <View style={styles.rule} /> : null}
    </View>
  );
}

function Thread({ request, state }: { request: SupportRequest; state: RequestState }) {
  const t = useT();
  const replies = request.replies ?? [];
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  useAnnounce(sent ? t('support.replySent') : null);

  async function send() {
    if (sending) return;
    setError(null);
    setSent(false);
    if (!reply.trim()) {
      setMissing(true);
      return;
    }
    setSending(true);
    try {
      await replyToSupportRequest(request._id, reply.trim());
      setReply('');
      setSent(true);
    } catch (err) {
      setError(isNetworkError(err) ? t('common.needsConnection') : errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.thread}>
      <Message who={t('support.you')} when={request.createdAt} text={request.message} />
      {replies.map((r) => (
        <Message
          key={r._id}
          who={r.authorType === 'platform' ? t('support.team') : t('support.you')}
          when={r.createdAt}
          text={r.message}
          team={r.authorType === 'platform'}
        />
      ))}
      <Text style={[type.secondary, styles.nums]} selectable>
        {t('support.reference', { reference: request.reference })} · {t('support.replyByEmail', { email: request.email })}
      </Text>

      <View style={styles.compose}>
        <Field
          label={t('support.reply')}
          value={reply}
          onChangeText={(v) => {
            setReply(v);
            setMissing(false);
            setSent(false);
          }}
          multiline
          maxLength={10000}
          hint={state === 'resolved' || state === 'closed' ? t('support.replyReopens') : undefined}
          error={missing ? t('support.replyRequired') : null}
        />
        {error ? <Banner message={error} /> : null}
        {sent ? <Banner tone="primary" message={t('support.replySent')} /> : null}
        <Button title={t('support.replySend')} icon="send-outline" variant="secondary" onPress={send} loading={sending} />
      </View>
    </View>
  );
}

function Message({ who, when, text, team = false }: { who: string; when: string; text: string; team?: boolean }) {
  return (
    <View style={[styles.message, team && styles.messageTeam]}>
      <Text style={[type.label, team && { color: colors.primaryOnSoft }]}>
        {who} <Text style={[styles.when, styles.nums]}>· {`${day(when)}, ${formatTime(when)}`}</Text>
      </Text>
      <Text style={type.body} selectable>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.md, gap: spacing.sm + 4 },
  replied: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
  },
  repliedText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.warning },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  center: { textAlign: 'center' },
  // One ruled card across the list: the first row rounds the top, the last the bottom.
  // borderRadius 1 on every row: Android draws a rounded view's border on another path, so square
  // middle rows sat 1px off the rounded first and last ones.
  row: { backgroundColor: colors.surface, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border, borderRadius: 1, paddingHorizontal: spacing.md },
  rowFirst: { borderTopWidth: 1, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  rowLast: { borderBottomWidth: 1, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: -spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56, paddingVertical: spacing.sm + 4 },
  headText: { flex: 1, gap: 4, alignItems: 'flex-start' },
  subject: { fontSize: 15, lineHeight: 21, fontWeight: '500', color: colors.text },
  subjectStrong: { fontWeight: '700' },
  nums: { fontVariant: ['tabular-nums'] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  chipText: { fontSize: 12, fontWeight: '700' },
  thread: { gap: spacing.sm, paddingBottom: spacing.md },
  message: { borderRadius: radius.md, backgroundColor: colors.surfaceMuted, padding: spacing.sm + 4, gap: spacing.xs },
  messageTeam: { backgroundColor: colors.primarySoft },
  when: { fontWeight: '400', color: colors.textMuted },
  compose: { marginTop: spacing.sm, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
