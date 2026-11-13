import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, ApiError, errorMessage, Pagination } from './api';
import { RefreshTopic, useRefreshOn } from './events';
import {
  offlineCacheEpoch,
  offlineCacheKey,
  readOffline,
  removeOffline,
  shouldDropCacheOnStatus,
  writeOffline,
} from './offlineCache';
import { sessionGeneration } from './storage';
import { t } from './i18n';
import { isNetworkError } from './useApiData';

interface Options {
  /** Page size sent as `limit`. */
  limit?: number;
  /** Refetch the first page silently when any of these topics is emitted. */
  refreshOn?: RefreshTopic[];
  /**
   * Keep an encrypted copy of the first page on the device and show it
   * straight away on the next visit, then refetch. When the network is down the copy stays on
   * screen with `offline: true` and `updatedAt` = when it was saved.
   */
  offline?: boolean;
  /**
   * What the offline copy is saved under, instead of the request URL. For lists whose URL carries
   * today's date: the copy must still be found offline tomorrow (the screen filters it again).
   */
  cacheKey?: string;
}

type Envelope<T> = { data?: T[]; pagination?: Pagination } & Record<string, unknown>;

const keyOf = (item: { _id?: string; id?: string }) => item._id ?? item.id;

/**
 * Put a fresh first page in place of the loaded one, keeping later pages the user scrolled
 * through. What page 1 used to hold and no longer does was deleted or no longer matches the
 * filter (a product made inactive under "Active"), so it goes; a later-page item that moved up
 * into page 1 isn't shown twice.
 */
export function mergeFirstPage<T extends { _id?: string; id?: string }>(prev: T[], fresh: T[], pageSize: number): T[] {
  const freshKeys = new Set(fresh.map(keyOf));
  const later = prev.slice(pageSize).filter((item) => {
    const k = keyOf(item);
    return k === undefined || !freshKeys.has(k);
  });
  return [...fresh, ...later];
}

/** Add a fetched page after the loaded items, skipping any already there (records shift between pages). */
export function appendPage<T extends { _id?: string; id?: string }>(prev: T[], next: T[]): T[] {
  const seen = new Set(prev.map(keyOf));
  return [...prev, ...next.filter((item) => !seen.has(keyOf(item)))];
}

/**
 * Paginated list endpoint (`?page=&limit=` → `{ data, pagination }`).
 * `extra` is the first page's envelope, for side fields like `summary` or `unreadCount`.
 * `basePath` may already carry a query string (filters); `page`/`limit` are appended.
 */
export function usePaginatedList<T extends { _id?: string; id?: string }, X = Record<string, unknown>>(
  basePath: string | null,
  options: Options = {}
) {
  const { limit = 20, refreshOn, offline: keepOffline = false, cacheKey: offlineKey } = options;
  const [items, setItems] = useState<T[]>([]);
  const [extra, setExtra] = useState<X | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(basePath !== null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  /** When the first page last loaded (epoch ms); for a saved offline copy, when it was saved. */
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  /** The last first-page load couldn't reach the server, and `items` is an older copy. */
  const [offline, setOffline] = useState(false);
  /** `items` is the saved offline copy; the server hasn't confirmed it yet this visit. */
  const [stale, setStale] = useState(false);
  const fromCache = useRef(false);
  const itemCount = useRef(0);
  const mounted = useRef(true);
  // Ignore responses from a superseded request (filter changed, pulled to refresh).
  // Silent polls don't bump it, so they never discard an in-flight loadMore.
  const generation = useRef(0);
  // First-page requests still running; a silent poll never stacks on (or races) one.
  const firstPageInFlight = useRef(0);
  // Synchronous guard: two onEndReached calls in one frame must not fetch the same page twice.
  const loadingMoreRef = useRef(false);
  // Set when page 1 was merged silently or items were removed: records moved up across page
  // boundaries, so the next loadMore fetches the current last page again before the next one
  // (otherwise the items that slid into it are never shown).
  const resync = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const urlFor = useCallback(
    (p: number) => {
      if (!basePath) return null;
      const sep = basePath.includes('?') ? '&' : '?';
      return `${basePath}${sep}page=${p}&limit=${limit}`;
    },
    [basePath, limit]
  );

  const loadFirst = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent') => {
      const url = urlFor(1);
      if (!url) return;
      if (mode === 'silent' && firstPageInFlight.current > 0) return;
      const gen = mode === 'silent' ? generation.current : ++generation.current;
      const current = () => mounted.current && gen === generation.current;
      const cacheKey = keepOffline ? offlineCacheKey(offlineKey ?? url, 'list') : null;
      // Read before the request: a response that lands after sign-out must not be saved.
      const cacheEpoch = offlineCacheEpoch();
      const sessionGen = sessionGeneration();
      let outcome: 'pending' | 'ok' | 'network' | 'failed' = 'pending';
      firstPageInFlight.current++;
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode !== 'silent') setError(null);

      // Stale-while-revalidate: show the saved first page while the request runs (or after it failed offline).
      // Not over a list already on screen (Retry): an older copy would replace fresher data.
      if (cacheKey && mode === 'initial' && itemCount.current === 0) {
        readOffline<Envelope<T>>(cacheKey).then((hit) => {
          if (!hit || !current() || outcome === 'ok' || outcome === 'failed') return;
          fromCache.current = true;
          setItems(hit.data.data ?? []);
          setExtra(hit.data as unknown as X);
          setPage(1);
          // No "load more" from a saved copy: later pages wait for the fresh first page.
          setTotalPages(1);
          setUpdatedAt(hit.savedAt);
          setStale(true);
          setLoading(false);
          if (outcome === 'network') setOffline(true);
        });
      }

      try {
        const json = await apiFetch<Envelope<T>>(url);
        outcome = 'ok';
        if (cacheKey && sessionGen === sessionGeneration()) writeOffline(cacheKey, json, cacheEpoch);
        if (!current()) return;
        fromCache.current = false;
        setUpdatedAt(Date.now());
        setOffline(false);
        setStale(false);
        const total = json.pagination?.totalPages ?? 1;
        if (mode === 'silent') {
          // Keep what the user has scrolled through; just refresh the top.
          setItems((prev) => mergeFirstPage(prev, json.data ?? [], limit));
          setTotalPages((prev) => Math.max(prev, total));
          resync.current = true;
        } else {
          resync.current = false;
          setItems(json.data ?? []);
          setPage(1);
          setTotalPages(total);
          setLoadMoreError(null);
        }
        setExtra(json as unknown as X);
        setError(null);
      } catch (err) {
        const network = isNetworkError(err);
        outcome = network ? 'network' : 'failed';
        // Signed out, no access, or gone: the saved copy must not be shown again.
        const drop = !network && err instanceof ApiError && shouldDropCacheOnStatus(err.status);
        if (cacheKey && drop) removeOffline(cacheKey);
        if (!current()) return;
        if (drop && fromCache.current) {
          fromCache.current = false;
          setItems([]);
          setExtra(null);
          setUpdatedAt(null);
          setStale(false);
        }
        setOffline(network && (itemCount.current > 0 || fromCache.current));
        setError(errorMessage(err, t('common.failedToLoad')));
      } finally {
        firstPageInFlight.current--;
        if (current()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [urlFor, keepOffline, offlineKey, limit]
  );

  useEffect(() => {
    if (basePath === null) {
      setLoading(false);
      return;
    }
    setItems([]);
    itemCount.current = 0;
    fromCache.current = false;
    setOffline(false);
    setStale(false);
    loadFirst('initial');
  }, [loadFirst, basePath]);

  itemCount.current = items.length;
  const hasMore = page < totalPages;

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current || loading || refreshing) return;
    const url = urlFor(page + 1);
    const againUrl = urlFor(page);
    if (!url || !againUrl) return;
    const gen = generation.current;
    // Taken now: a silent refresh landing mid-request sets it again for the next loadMore.
    const again = resync.current && page > 1;
    resync.current = false;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const refetched = again ? await apiFetch<Envelope<T>>(againUrl) : null;
      if (!mounted.current || gen !== generation.current) return;
      const json = await apiFetch<Envelope<T>>(url);
      if (!mounted.current || gen !== generation.current) return;
      // Records created or deleted since page 1 shift later pages; drop duplicates.
      setItems((prev) => appendPage(refetched ? appendPage(prev, refetched.data ?? []) : prev, json.data ?? []));
      setPage(page + 1);
      setTotalPages(json.pagination?.totalPages ?? page + 1);
    } catch (err) {
      if (again) resync.current = true;
      if (mounted.current && gen === generation.current) setLoadMoreError(errorMessage(err, t('common.loadMoreFailed')));
    } finally {
      loadingMoreRef.current = false;
      if (mounted.current) setLoadingMore(false);
    }
  }, [hasMore, loading, refreshing, urlFor, page]);

  const refresh = useCallback(() => loadFirst('refresh'), [loadFirst]);
  const reload = useCallback(() => loadFirst('initial'), [loadFirst]);
  const poll = useCallback(() => loadFirst('silent'), [loadFirst]);

  useRefreshOn(refreshOn, poll);

  // Items taken out by the screen shift later pages too.
  const replaceItems = useCallback((next: T[] | ((prev: T[]) => T[])) => {
    resync.current = true;
    setItems(next);
  }, []);

  return {
    items,
    setItems: replaceItems,
    extra,
    loading,
    refreshing,
    loadingMore,
    error,
    loadMoreError,
    hasMore,
    refresh,
    reload,
    poll,
    loadMore,
    updatedAt,
    offline,
    stale,
  };
}
