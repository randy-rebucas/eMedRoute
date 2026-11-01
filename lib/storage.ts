import * as SecureStore from 'expo-secure-store';
import { clearOfflineCache } from './offlineCache';

/**
 * Session credentials live in SecureStore only — never AsyncStorage. They are
 * equivalent to a password for as long as they're valid.
 *
 * - access token: 7-day Bearer JWT sent on every authenticated request
 * - refresh token: opaque, 60-day, single use; rotated on every refresh
 * - accessExpiresAt: epoch ms derived from `expiresIn`, so the api wrapper can
 *   refresh proactively instead of waiting for a 401
 *
 * Every key starts with `rep_`. A rep can also be a patient with eMCR on the same phone; the two
 * apps must never read each other's keys, even where the platform would allow it.
 */
export interface StoredSession {
  accessToken: string;
  refreshToken: string | null;
  accessExpiresAt: number | null;
}

const KEYS = {
  access: 'rep_session_access_token',
  refresh: 'rep_session_refresh_token',
  accessExpiresAt: 'rep_session_access_expires_at',
  deviceId: 'rep_device_id',
  language: 'rep_app_language',
} as const;

// In-memory mirror so every request doesn't hit the keychain. `undefined` = not loaded yet.
let cache: StoredSession | null | undefined;

/**
 * Bumped whenever the session is replaced or cleared. A token refresh captures it before its
 * request and only stores the result if it is unchanged, so a refresh that finishes after
 * sign-out (or after a new sign-in) can't write the old session back.
 */
let generation = 0;

export function sessionGeneration(): number {
  return generation;
}

export async function getSession(): Promise<StoredSession | null> {
  if (cache !== undefined) return cache;

  const [accessToken, refreshToken, expiresAt] = await Promise.all([
    SecureStore.getItemAsync(KEYS.access),
    SecureStore.getItemAsync(KEYS.refresh),
    SecureStore.getItemAsync(KEYS.accessExpiresAt),
  ]);

  cache = accessToken
    ? { accessToken, refreshToken, accessExpiresAt: expiresAt ? Number(expiresAt) || null : null }
    : null;
  return cache;
}

/**
 * Store a session. With `ifGeneration` (token refresh), nothing is written and false is
 * returned when the session was replaced or cleared since that generation was read.
 */
export async function setSession(session: StoredSession, options: { ifGeneration?: number } = {}): Promise<boolean> {
  if (options.ifGeneration === undefined) generation++;
  else if (options.ifGeneration !== generation) return false;
  cache = session;
  await Promise.all([
    SecureStore.setItemAsync(KEYS.access, session.accessToken),
    session.refreshToken
      ? SecureStore.setItemAsync(KEYS.refresh, session.refreshToken)
      : SecureStore.deleteItemAsync(KEYS.refresh),
    session.accessExpiresAt
      ? SecureStore.setItemAsync(KEYS.accessExpiresAt, String(session.accessExpiresAt))
      : SecureStore.deleteItemAsync(KEYS.accessExpiresAt),
  ]);
  return true;
}

/** Sign-out on this device, whatever the path: the session and every offline copy go. */
export async function clearSession(): Promise<void> {
  generation++;
  cache = null;
  await Promise.all([
    clearOfflineCache(),
    SecureStore.deleteItemAsync(KEYS.access),
    SecureStore.deleteItemAsync(KEYS.refresh),
    SecureStore.deleteItemAsync(KEYS.accessExpiresAt),
  ]);
}

/** The app language the rep picked ('en' | 'fil'); null = same as the phone. */
export async function getLanguagePreference(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.language);
}

export async function setLanguagePreference(language: string | null): Promise<void> {
  if (language) await SecureStore.setItemAsync(KEYS.language, language);
  else await SecureStore.deleteItemAsync(KEYS.language);
}

/**
 * Stable per-install identifier sent as `deviceId` to the devices and session
 * endpoints. Expo has no persistent hardware id, so one is generated once.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(KEYS.deviceId);
  if (!id) {
    const rand = () => Math.random().toString(36).slice(2, 10);
    id = `rep-${Date.now().toString(36)}-${rand()}-${rand()}`;
    await SecureStore.setItemAsync(KEYS.deviceId, id);
  }
  return id;
}
