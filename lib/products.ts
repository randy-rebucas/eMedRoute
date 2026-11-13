import { useMemo } from 'react';
import { apiRequest, query } from './api';
import { emitRefresh } from './events';
import { daysFromToday } from './format';
import { usePendingDeletes } from './undo';
import { Product, ProductExpiry, ProductInput, ProductStatus } from './types';
import { useApiData } from './useApiData';
import { usePaginatedList } from './usePaginatedList';

const PRODUCTS_PATH = '/api/medical-representatives/products';

/** Same window as the server's "expiring soon" count and push. */
export const EXPIRY_WINDOW_DAYS = 30;

export type ExpiryState = 'expired' | 'soon' | 'ok';

/** Expired, expiring within 30 days, or fine. Only active products are flagged. */
export function expiryState(product: Pick<Product, 'expiryDate' | 'status'>): ExpiryState {
  if (product.status !== 'active') return 'ok';
  const days = daysFromToday(product.expiryDate);
  if (days < 0) return 'expired';
  return days <= EXPIRY_WINDOW_DAYS ? 'soon' : 'ok';
}

/** The Products tab's filter: a status, every status, or active stock expired / expiring in 30 days. */
export type ProductFilter = ProductStatus | 'all' | 'expiring';

/**
 * The catalog A–Z (expiring: soonest expiry first), optionally searched by name, manufacturer or
 * category. `expiry` (from the first page) counts every active product by days left, whatever
 * the filter; null from an older server.
 */
export function useProducts(filter: ProductFilter, search = '') {
  const path =
    PRODUCTS_PATH +
    query({
      status: filter === 'all' || filter === 'expiring' ? undefined : filter,
      expiring: filter === 'expiring' ? '1' : undefined,
      sort: filter === 'expiring' ? 'expiry' : 'name',
      search: search.trim() || undefined,
      summary: '1',
    });
  const list = usePaginatedList<Product, { expiry?: ProductExpiry }>(path, { limit: 50, refreshOn: ['products'], offline: true });
  const pending = usePendingDeletes();
  const items = useMemo(() => list.items.filter((p) => !pending.has(p._id)), [list.items, pending]);
  return { ...list, items, expiry: list.extra?.expiry ?? null };
}

/** Every active product of the rep's, for picking (the server allows up to 10 per visit). */
export function useActiveProducts() {
  const result = useApiData<Product[]>(PRODUCTS_PATH + query({ status: 'active' }), { refreshOn: ['products'], offline: true, allPages: true });
  // A product waiting behind Undo (or deleted since) isn't offered.
  const pending = usePendingDeletes();
  const data = useMemo(() => (result.data ? result.data.filter((p) => !pending.has(p._id)) : result.data), [result.data, pending]);
  return { ...result, data };
}

export function useProduct(id: string | undefined) {
  return useApiData<Product>(id ? `${PRODUCTS_PATH}/${encodeURIComponent(id)}` : null, { refreshOn: ['products'], offline: true });
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const product = await apiRequest<Product>(PRODUCTS_PATH, { method: 'POST', body: input });
  emitRefresh('products', 'dashboard');
  return product;
}

/** PUT takes the full object. */
export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  const product = await apiRequest<Product>(`${PRODUCTS_PATH}/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
  emitRefresh('products', 'dashboard');
  return product;
}

export async function deleteProduct(id: string): Promise<void> {
  await apiRequest(`${PRODUCTS_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  emitRefresh('products', 'dashboard');
}
