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
/** A failed background delete's message, waiting until the Undo snackbar on screen settles. */
let queuedError: string | null = null;
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
    // Gone on the server: it stays hidden, as a list refresh keeps later pages it was on.
  } catch (err) {
    // The server refused or couldn't be reached: the item comes back, with the reason.
    const next = new Set(pendingIds);
    next.delete(item.id);
    setPending(next);
    emitRefresh(...item.topics);
    showError(errorMessage(err));
  }
}

/**
 * Show a failure, unless another item's Undo is on screen: replacing it would drop its timer and
 * strand that delete, so the message waits until it settles.
 */
function showError(message: string) {
  if (current?.kind === 'undo') {
    queuedError = message;
    return;
  }
  show({ kind: 'error', message });
}

/** The Undo snackbar went (sent or undone): show the failure that waited behind it, if any. */
function afterUndo() {
  const message = queuedError;
  queuedError = null;
  show(message ? { kind: 'error', message } : null);
}

/** Take the waiting delete off screen without sending it (stops its timer). */
function takeCurrent(): PendingDelete | null {
  if (current?.kind !== 'undo') return null;
  const item = current.item;
  if (timer) clearTimeout(timer);
  timer = null;
  current = null;
  return item;
}

function commitCurrent(): Promise<void> {
  const item = takeCurrent();
  if (!item) return Promise.resolve();
  afterUndo();
  return commit(item);
}

/**
 * Before this device signs out: send the delete still waiting behind Undo (while the session is
 * still there), or with `send: false` (the session already ended) drop it. Then forget every
 * hidden id: the next account starts clean.
 */
export async function settleDeletesForSignOut(options: { send: boolean }): Promise<void> {
  if (options.send) {
    await commitCurrent().catch(() => {});
  } else {
    show(null);
  }
  queuedError = null;
  setPending(new Set());
}

/** The app went to the background: send the waiting delete now, as the timer may never fire. */
export function commitPendingNow(): void {
  commitCurrent();
}

/** Hide `item` everywhere and offer Undo; the delete is sent when the snackbar goes. */
export function scheduleDelete(item: PendingDelete): void {
  // Already waiting (a double tap on Delete): one delete, one snackbar.
  if (pendingIds.has(item.id)) return;
  // The previous delete goes out now; a failure waits behind this item's Undo.
  const previous = takeCurrent();
  setPending(new Set(pendingIds).add(item.id));
  show({ kind: 'undo', item });
  if (previous) void commit(previous);
}

/** Undo the delete on screen. */
export function undoDelete(): void {
  if (current?.kind !== 'undo') return;
  const next = new Set(pendingIds);
  next.delete(current.item.id);
  takeCurrent();
  afterUndo();
  setPending(next);
}

/** Close the snackbar now (the pending delete goes out). */
export function dismissSnack(): void {
  if (current?.kind === 'undo') commitCurrent();
  else show(null);
}

/** Ids hidden while their delete waits, and those deleted since (until sign-out). */
export function usePendingDeletes(): Set<string> {
  return useSyncExternalStore(subscribe, () => pendingIds, () => pendingIds);
}

export function useSnack(): Snack | null {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
