import { useSyncExternalStore } from 'react';
import { emitRefresh, RefreshTopic } from './events';
import { errorMessage } from './api';

/**
 * Deletes that wait a few seconds behind an "Undo" snackbar instead of a confirm dialog (the
 * design confirms only actions the clinic sees). The item disappears from lists at once; the
 * DELETE goes out when the snackbar times out, or straight away when another delete replaces it.
 */
export const UNDO_MS = 6000;

export interface PendingDelete {
  id: string;
  /** "Visit deleted", "Product deleted" — already translated. */
  message: string;
  commit: () => Promise<void>;
  /** Refetched when the delete fails, so the item comes back. */
  topics: RefreshTopic[];
}

type Snack = { kind: 'undo'; item: PendingDelete } | { kind: 'error'; message: string };

let pendingIds = new Set<string>();
let current: Snack | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setPending(next: Set<string>) {
  pendingIds = next;
  notify();
}

function show(snack: Snack | null, ms = UNDO_MS) {
  if (timer) clearTimeout(timer);
  timer = null;
  current = snack;
  notify();
  if (snack?.kind === 'error') timer = setTimeout(() => show(null), ms);
  if (snack?.kind === 'undo') timer = setTimeout(() => commitCurrent(), ms);
}

async function commit(item: PendingDelete) {
  try {
    await item.commit();
  } catch (err) {
    // The server refused or couldn't be reached: the item comes back, with the reason.
    emitRefresh(...item.topics);
    show({ kind: 'error', message: errorMessage(err) });
  } finally {
    const next = new Set(pendingIds);
    next.delete(item.id);
    setPending(next);
  }
}

function commitCurrent() {
  if (current?.kind !== 'undo') return;
  const item = current.item;
  show(null);
  commit(item);
}

/** Hide `item` everywhere and offer Undo; the delete is sent when the snackbar goes. */
export function scheduleDelete(item: PendingDelete): void {
  commitCurrent();
  setPending(new Set(pendingIds).add(item.id));
  show({ kind: 'undo', item });
}

/** Undo the delete on screen. */
export function undoDelete(): void {
  if (current?.kind !== 'undo') return;
  const next = new Set(pendingIds);
  next.delete(current.item.id);
  show(null);
  setPending(next);
}

/** Close the snackbar now (the pending delete goes out). */
export function dismissSnack(): void {
  if (current?.kind === 'undo') commitCurrent();
  else show(null);
}

/** Ids hidden while their delete waits. */
export function usePendingDeletes(): Set<string> {
  return useSyncExternalStore(subscribe, () => pendingIds, () => pendingIds);
}

export function useSnack(): Snack | null {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
