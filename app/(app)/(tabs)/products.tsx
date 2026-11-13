import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '@/lib/i18n';
import { ProductFilter, useProducts } from '@/lib/products';
import { colors, radius, spacing } from '@/lib/theme';
import { type } from '@/lib/typography';
import { useDebounced } from '@/lib/useDebounced';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { SkeletonRows, ThinProgress } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { photos, ScrimPhoto } from '@/components/Photo';
import { FilterChips } from '@/components/pickers';
import { ProductRow } from '@/components/ProductCards';
import { ShelfLifeChart } from '@/components/ShelfLifeChart';
import { Button, ListFooter, screenStyles } from '@/components/ui';

const FILTERS: ProductFilter[] = ['active', 'expiring', 'discontinued', 'inactive', 'all'];

/**
 * The rep's product catalog A–Z: search, a status filter (plus Expiring: expired or within 30
 * days, soonest first), and the shelf life of everything active at the top.
 */
export default function ProductsScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ filter?: string }>();
  const [filter, setFilter] = useState<ProductFilter>('active');
  const [search, setSearch] = useState('');
  const query = useDebounced(search);
  const list = useProducts(filter, query);
  const { items, loading, refreshing, loadingMore, error, loadMoreError, offline, stale, updatedAt, hasMore, expiry } = list;
  const urgent = expiry ? expiry.expired + expiry.soon : 0;

  // Home's "expired or expiring" row opens the Expiring filter. Cleared once applied, so the
  // same jump works again after the rep changed filter by hand.
  useEffect(() => {
    if (!params.filter) return;
    if ((FILTERS as string[]).includes(params.filter)) setFilter(params.filter as ProductFilter);
    router.setParams({ filter: undefined });
  }, [params.filter]);

  const searching = !!query.trim();
  const empty = loading ? (
    <SkeletonRows />
  ) : error ? (
    <ErrorState message={error} onRetry={list.reload} />
  ) : searching ? (
    <EmptyState art="search" title={t('products.noMatch')} />
  ) : filter === 'active' ? (
    <ScrimPhoto source={photos.blisterPack} style={styles.photoEmpty} top={0.4} bottom={0.96}>
      <View style={styles.photoEmptyInner}>
        <Text style={styles.photoEmptyTitle} accessibilityRole="header">
          {t('products.emptyTitle')}
        </Text>
        <Text style={styles.photoEmptyHint}>{t('products.emptyActive')}</Text>
      </View>
    </ScrimPhoto>
  ) : (
    <EmptyState
      art="products"
      title={filter === 'expiring' ? t('products.emptyExpiring') : t('products.empty')}
      // The chart hides when there's nothing active, so the way back to the catalog is here.
      action={{ title: t('products.status.active'), icon: 'checkmark-circle-outline', onPress: () => setFilter('active') }}
    />
  );

  return (
    <SafeAreaView style={screenStyles.container} edges={['top']}>
      <FlatList
        data={items}
        keyExtractor={(p) => p._id}
        contentContainerStyle={screenStyles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={list.refresh} tintColor={colors.primary} />}
        onEndReached={hasMore ? list.loadMore : undefined}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={type.screenTitle} accessibilityRole="header">
                {t('nav.products')}
              </Text>
              <View style={styles.actions}>
                <Button
                  title={t('products.import.action')}
                  icon="cloud-upload-outline"
                  variant="secondary"
                  onPress={() => router.push('/products/import')}
                  style={styles.addButton}
                />
                <Button title={t('products.add')} icon="add-outline" variant="secondary" onPress={() => router.push('/products/new')} style={styles.addButton} />
              </View>
            </View>
            {expiry && !searching ? <ShelfLifeChart expiry={expiry} onShowExpiring={() => setFilter('expiring')} /> : null}
            <View style={styles.search}>
              <Ionicons name="search-outline" size={20} color={colors.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('products.search')}
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                accessibilityLabel={t('products.search')}
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
            <FilterChips
              label={t('products.form.status')}
              options={[
                { value: 'active', label: t('products.status.active'), icon: 'checkmark-circle-outline' },
                {
                  value: 'expiring',
                  label: urgent > 0 ? `${t('products.status.expiring')} · ${urgent}` : t('products.status.expiring'),
                  icon: 'time-outline',
                },
                { value: 'discontinued', label: t('products.status.discontinued'), icon: 'remove-circle-outline' },
                { value: 'inactive', label: t('products.status.inactive'), icon: 'pause-circle-outline' },
                { value: 'all', label: t('products.status.all'), icon: 'apps-outline' },
              ]}
              value={filter}
              onChange={setFilter}
            />
            {stale || offline ? (
              <View>
                <ThinProgress active={stale && !offline} />
                <OfflineBanner offline={offline} updatedAt={updatedAt} subject={t('products.offlineSubject')} />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={empty}
        ListFooterComponent={<ListFooter loadingMore={loadingMore} error={loadMoreError} onRetry={list.loadMore} />}
        renderItem={({ item, index }) => <ProductRow product={item} first={index === 0} last={index === items.length - 1} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm + 4, marginBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  addButton: { marginTop: 0 },
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
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: spacing.sm },
  photoEmpty: { minHeight: 220, borderRadius: radius.lg },
  photoEmptyInner: { flex: 1, justifyContent: 'flex-end', padding: spacing.md + 4 },
  photoEmptyTitle: { fontSize: 20, fontWeight: '700', color: colors.primaryText },
  photoEmptyHint: { fontSize: 14, lineHeight: 20, color: colors.onNavyMuted, marginTop: spacing.xs },
});
