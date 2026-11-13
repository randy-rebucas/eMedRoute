import { useMemo } from 'react';
import { apiRequest, query } from './api';
import { emitRefresh } from './events';
import { daysFromToday } from './format';
import { usePendingDeletes } from './undo';
import { Product, ProductInput, ProductStatus } from './types';
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

/** The catalog, newest first. `status` null = every status. */
export function useProducts(status: ProductStatus | null) {
  const list = usePaginatedList<Product>(PRODUCTS_PATH + query({ status }), { limit: 50, refreshOn: ['products'], offline: true });
  const pending = usePendingDeletes();
  const items = useMemo(() => list.items.filter((p) => !pending.has(p._id)), [list.items, pending]);
  return { ...list, items };
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
