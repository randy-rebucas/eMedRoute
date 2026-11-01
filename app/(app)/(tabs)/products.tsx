import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useT } from '@/lib/i18n';
import { useProducts } from '@/lib/products';
import { colors, spacing } from '@/lib/theme';
import { ProductStatus } from '@/lib/types';
import { type } from '@/lib/typography';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { SkeletonRows, ThinProgress } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { FilterChips } from '@/components/pickers';
import { ProductRow } from '@/components/ProductCards';
import { Button, ListFooter, screenStyles } from '@/components/ui';

type Filter = ProductStatus | 'all';

/** The rep's product catalog, filtered by status, with expiring-soon badges. */
export default function ProductsScreen() {
  const t = useT();
  const [filter, setFilter] = useState<Filter>('active');
  const list = useProducts(filter === 'all' ? null : filter);
  const { items, loading, refreshing, loadingMore, error, loadMoreError, offline, stale, updatedAt, hasMore } = list;

  return (
    <SafeAreaView style={screenStyles.container} edges={['top']}>
      <FlatList
        data={items}
        keyExtractor={(p) => p._id}
        contentContainerStyle={screenStyles.list}
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
            <FilterChips
              label={t('products.form.status')}
              options={[
                { value: 'active', label: t('products.status.active'), icon: 'checkmark-circle-outline' },
                { value: 'discontinued', label: t('products.status.discontinued'), icon: 'remove-circle-outline' },
                { value: 'inactive', label: t('products.status.inactive'), icon: 'pause-circle-outline' },
                { value: 'all', label: t('products.status.all'), icon: 'apps-outline' },
              ]}
              value={filter}
              onChange={setFilter}
            />
            <ThinProgress active={stale && !offline} />
            <OfflineBanner offline={offline} updatedAt={updatedAt} subject={t('products.offlineSubject')} />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonRows />
          ) : error ? (
            <ErrorState message={error} onRetry={list.reload} />
          ) : (
            <EmptyState
              art="products"
              title={filter === 'active' ? t('products.emptyActive') : t('products.empty')}
              action={filter === 'active' ? { title: t('products.import.title'), icon: 'cloud-upload-outline', onPress: () => router.push('/products/import') } : undefined}
            />
          )
        }
        ListFooterComponent={<ListFooter loadingMore={loadingMore} error={loadMoreError} onRetry={list.loadMore} />}
        renderItem={({ item }) => <ProductRow product={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  addButton: { marginTop: 0 },
});
