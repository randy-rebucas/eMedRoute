import { useEffect, useState } from 'react';
import { AccessibilityInfo, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, errorMessage } from '@/lib/api';
import { requestClinicAccess, useClinics, withdrawClinicAccess } from '@/lib/clinics';
import { useT } from '@/lib/i18n';
import { bookingBlocked, useSubscription } from '@/lib/plan';
import { colors, radius, spacing } from '@/lib/theme';
import { Clinic } from '@/lib/types';
import { type } from '@/lib/typography';
import { isNetworkError } from '@/lib/useApiData';
import { ClinicRow } from '@/components/ClinicRow';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Field } from '@/components/forms';
import { SkeletonRows } from '@/components/Loading';
import { FilterChips } from '@/components/pickers';
import { Banner, Button, ListFooter, screenStyles } from '@/components/ui';

/** Waits until typing pauses, so a search doesn't fire per keystroke. */
function useDebounced(value: string, ms = 350): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

type Scope = 'bookable' | 'all';

/**
 * Clinics the rep can book, searchable by name or city. "All clinics" adds the ones that take
 * only reps they've added, to ask for access.
 */
export default function ClinicsScreen() {
  const t = useT();
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<Scope>('bookable');
  const query = useDebounced(search);
  const list = useClinics(query, scope === 'all');
  // Book stays visible when booking isn't covered; it opens Plan instead of the sheet.
  const { data: sub } = useSubscription();
  const { items, loading, refreshing, loadingMore, error, loadMoreError, hasMore } = list;
  const [asking, setAsking] = useState<Clinic | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function confirmWithdraw(clinic: Clinic) {
    // The clinic sees the request, so taking it back is confirmed.
    Alert.alert(t('clinics.access.withdraw'), clinic.name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('clinics.access.withdraw'),
        style: 'destructive',
        onPress: async () => {
          setBusyId(clinic.id);
          try {
            await withdrawClinicAccess(clinic.id);
            // The row itself changes back to Request access; say so for screen readers.
            AccessibilityInfo.announceForAccessibility(t('clinics.access.withdrawn'));
          } catch (err) {
            Alert.alert(isNetworkError(err) ? t('common.needsConnection') : errorMessage(err));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={screenStyles.container} edges={['top']}>
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        contentContainerStyle={screenStyles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={list.refresh} tintColor={colors.primary} />}
        onEndReached={hasMore ? list.loadMore : undefined}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[type.screenTitle, styles.title]} accessibilityRole="header">
              {t('nav.clinics')}
            </Text>
            <Text style={type.secondary}>{t('clinics.intro')}</Text>
            <View style={styles.search}>
              <Ionicons name="search-outline" size={20} color={colors.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('clinics.search')}
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                accessibilityLabel={t('clinics.search')}
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
            <FilterChips
              label={t('clinics.scope.label')}
              options={[
                { value: 'bookable', label: t('clinics.scope.bookable'), icon: 'calendar-outline' },
                { value: 'all', label: t('clinics.scope.all'), icon: 'business-outline' },
              ]}
              value={scope}
              onChange={setScope}
            />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonRows />
          ) : error ? (
            <ErrorState message={error} onRetry={list.reload} />
          ) : (
            <EmptyState
              art={query.trim() ? 'search' : 'clinic'}
              title={query.trim() ? t('clinics.noMatch') : scope === 'all' ? t('clinics.emptyAll') : t('clinics.empty')}
              action={!query.trim() && scope === 'bookable' ? { title: t('clinics.scope.all'), icon: 'business-outline', onPress: () => setScope('all') } : undefined}
            />
          )
        }
        ListFooterComponent={<ListFooter loadingMore={loadingMore} error={loadMoreError} onRetry={list.loadMore} />}
        renderItem={({ item }) => (
          <ClinicRow
            clinic={item}
            busy={busyId === item.id}
            onBook={() => router.push(bookingBlocked(sub) ? '/plan' : `/clinics/${item.id}/book`)}
            onRequest={() => setAsking(item)}
            onWithdraw={() => confirmWithdraw(item)}
          />
        )}
      />
      <AccessRequestSheet clinic={asking} onClose={() => setAsking(null)} />
    </SafeAreaView>
  );
}

/** Ask a clinic to add the rep, with an optional message; keeps the message if sending fails. */
function AccessRequestSheet({ clinic, onClose }: { clinic: Clinic | null; onClose: () => void }) {
  const t = useT();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (clinic) {
      setMessage('');
      setProblem(null);
    }
  }, [clinic]);

  async function send() {
    if (!clinic || sending) return;
    setSending(true);
    setProblem(null);
    try {
      await requestClinicAccess(clinic.id, message);
      // The row turns to "Request sent" as the list refreshes.
      AccessibilityInfo.announceForAccessibility(t('clinics.access.sent', { clinic: clinic.name }));
      onClose();
    } catch (err) {
      if (isNetworkError(err)) setProblem(t('common.needsConnection'));
      else if (err instanceof ApiError && err.code === 'RECENTLY_DECLINED') setProblem(t('clinics.access.declinedRecently'));
      else setProblem(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={!!clinic} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.sheetHead}>
            <Text style={[type.cardTitle, styles.flex]} accessibilityRole="header">
              {clinic ? t('clinics.access.title', { clinic: clinic.name }) : ''}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.cancel')}>
              <Ionicons name="close-outline" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={[type.secondary, styles.intro]}>{t('clinics.access.intro')}</Text>
          <Field
            label={t('clinics.access.message')}
            optional
            value={message}
            onChangeText={setMessage}
            maxLength={500}
            hint={t('clinics.access.messageHint')}
            multiline
          />
          {problem ? <Banner message={problem} /> : null}
          <Button title={t('clinics.access.send')} icon="send-outline" onPress={send} loading={sending} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { gap: spacing.sm, marginBottom: spacing.md },
  title: { marginTop: spacing.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md - 4,
    marginTop: spacing.xs,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: spacing.sm },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11, 33, 54, 0.4)' },
  // A sheet may cast one soft shadow (design rules).
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  intro: { marginBottom: spacing.md },
});
