import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useClinics } from '@/lib/clinics';
import { useT } from '@/lib/i18n';
import { bookingBlocked, useSubscription } from '@/lib/plan';
import { colors, radius, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { ClinicRow } from '@/components/ClinicRow';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { SkeletonRows } from '@/components/Loading';
import { ListFooter, screenStyles } from '@/components/ui';

/** Waits until typing pauses, so a search doesn't fire per keystroke. */
function useDebounced(value: string, ms = 350): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** Clinics the rep can book, searchable by name or city. */
export default function ClinicsScreen() {
  const t = useT();
  const [search, setSearch] = useState('');
  const query = useDebounced(search);
  const list = useClinics(query);
  // Book stays visible when booking isn't covered; it opens Plan instead of the sheet.
  const { data: sub } = useSubscription();
  const { items, loading, refreshing, loadingMore, error, loadMoreError, hasMore } = list;

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
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonRows />
          ) : error ? (
            <ErrorState message={error} onRetry={list.reload} />
          ) : (
            <EmptyState art={query.trim() ? 'search' : 'clinic'} title={query.trim() ? t('clinics.noMatch') : t('clinics.empty')} />
          )
        }
        ListFooterComponent={<ListFooter loadingMore={loadingMore} error={loadMoreError} onRetry={list.loadMore} />}
        renderItem={({ item }) => (
          <ClinicRow clinic={item} onBook={() => router.push(bookingBlocked(sub) ? '/plan' : `/clinics/${item.id}/book`)} />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
});
