/**
 * Where to go after signing in again when a session expired mid-task. In memory only: a relaunch
 * starts at Home. Tied to the rep who was signed in, so a different rep signing in on the same
 * phone never lands on the last rep's screen.
 */
let lastRepId: string | null = null;
let pending: { path: string; repId: string } | null = null;

/** Paths that are already where sign-in leads, or that only make sense once. */
const SKIP = new Set(['/', '/home', '/login', '/enable-notifications']);

/** Called while signed in, so the redirect knows whose screen it was. */
export function noteSignedInRep(repId: string | null | undefined): void {
  if (repId) lastRepId = repId;
}

let skipNext = false;

/** A sign-out on purpose: the next redirect isn't a lost session, so sign-in starts at Home. */
export function skipNextReturnPath(): void {
  skipNext = true;
  pending = null;
}

/** The signed-in area lost its session on `path`: remember it for that rep. */
export function rememberReturnPath(path: string): void {
  if (skipNext) {
    skipNext = false;
    return;
  }
  if (!lastRepId || SKIP.has(path)) return;
  pending = { path, repId: lastRepId };
}

/** The remembered path, once, if it belongs to `repId`; else null. */
export function takeReturnPath(repId: string | null | undefined): string | null {
  const p = pending;
  pending = null;
  return p && repId && p.repId === repId ? p.path : null;
}
