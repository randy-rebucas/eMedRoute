import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDate } from '@/lib/format';
import { PlainKey, useT } from '@/lib/i18n';
import { useSupportRequests } from '@/lib/support';
import { colors, radius, spacing } from '@/lib/theme';
import { SupportRequest, SupportStatus } from '@/lib/types';
import { mono, type } from '@/lib/typography';
import { ErrorState } from '@/components/ErrorState';
import { Badge, Button, Card, IconName, ListFooter, LoadingView, screenStyles, useBottomPadding } from '@/components/ui';

const STATUS: Record<SupportStatus, { label: PlainKey; icon: IconName; tone: 'primary' | 'warning' | 'neutral' }> = {
  open: { label: 'support.status.open', icon: 'mail-unread-outline', tone: 'warning' },
  'in-progress': { label: 'support.status.inProgress', icon: 'time-outline', tone: 'primary' },
  resolved: { label: 'support.status.resolved', icon: 'checkmark-circle-outline', tone: 'neutral' },
  closed: { label: 'support.status.closed', icon: 'archive-outline', tone: 'neutral' },
};

/** The rep's own support requests with their replies, and "New request". */
export default function SupportScreen() {
  const t = useT();
  const { items, loading, refreshing, loadingMore, error, loadMoreError, refresh, reload, loadMore } = useSupportRequests();
  const [open, setOpen] = useState<string | null>(null);
  const paddingBottom = useBottomPadding();

  if (loading && items.length === 0) return <LoadingView />;
  if (error && items.length === 0) return <ErrorState message={error} onRetry={reload} />;

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
          <Text style={type.body}>{t('support.intro')}</Text>
          <Button title={t('support.new')} icon="create-outline" onPress={() => router.push('/support/new')} />
        </View>
      }
      ListEmptyComponent={<Text style={[type.secondary, styles.empty]}>{t('support.empty')}</Text>}
      ListFooterComponent={<ListFooter loadingMore={loadingMore} error={loadMoreError} onRetry={loadMore} />}
      renderItem={({ item }) => (
        <RequestCard request={item} expanded={open === item._id} onToggle={() => setOpen(open === item._id ? null : item._id)} />
      )}
    />
  );
}

function RequestCard({ request, expanded, onToggle }: { request: SupportRequest; expanded: boolean; onToggle: () => void }) {
  const t = useT();
  const status = STATUS[request.status] ?? STATUS.open;
  const replies = request.replies ?? [];
  const fromTeam = replies.filter((r) => r.authorType === 'platform').length;

  return (
    <Card>
      <TouchableOpacity
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${request.subject}, ${t(status.label)}, ${formatDate(request.createdAt)}`}
        style={styles.cardHead}
      >
        <View style={styles.cardText}>
          <Text style={type.cardTitle}>{request.subject}</Text>
          <Text style={type.secondary}>
            <Text style={mono}>{formatDate(request.createdAt)}</Text>
            {fromTeam > 0 ? ` · ${t('support.replies', { count: fromTeam })}` : ''}
          </Text>
        </View>
        <View style={styles.pill}>
          <Ionicons name={status.icon} size={14} color={status.tone === 'warning' ? colors.warning : status.tone === 'primary' ? colors.primaryOnSoft : colors.textMuted} />
          <Badge label={t(status.label)} tone={status.tone} />
        </View>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.thread}>
          <Text style={[type.secondary, mono]} selectable>
            {request.reference}
          </Text>
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
          <Text style={type.secondary}>{t('support.replyByEmail', { email: request.email })}</Text>
        </View>
      ) : null}
    </Card>
  );
}

function Message({ who, when, text, team = false }: { who: string; when: string; text: string; team?: boolean }) {
  return (
    <View style={[styles.message, team && styles.messageTeam]}>
      <Text style={type.label}>
        {who} · <Text style={[mono, styles.when]}>{formatDate(when)}</Text>
      </Text>
      <Text style={type.body} selectable>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.md, gap: spacing.xs },
  empty: { textAlign: 'center', marginTop: spacing.lg },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, minHeight: 48 },
  cardText: { flex: 1, gap: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  thread: { marginTop: spacing.md, gap: spacing.sm },
  message: { borderRadius: radius.md, backgroundColor: colors.surfaceMuted, padding: spacing.sm + 4, gap: spacing.xs },
  messageTeam: { backgroundColor: colors.primarySoft },
  when: { fontWeight: '400', color: colors.textMuted },
});
