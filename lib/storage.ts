import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { File, Paths } from 'expo-file-system';
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
 *
 * Session items are THIS_DEVICE_ONLY: an iOS backup restored onto another phone doesn't carry a
 * live session with it.
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
  pendingSignOut: 'rep_pending_sign_out',
  activationPass: 'rep_activation_pass',
} as const;

const DEVICE_ONLY: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

/**
 * Write with this device's accessibility. Deleted first: an update keeps an item's old
 * accessibility, and items written by earlier versions weren't device-only.
 */
async function setDeviceOnly(key: string, value: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
  await SecureStore.setItemAsync(key, value, DEVICE_ONLY);
}

let installChecked: Promise<void> | null = null;

/**
 * iOS keeps keychain items after the app is deleted: a reinstall must not resume the previous
 * rep's session. A marker file (deleted with the app) tells a fresh install apart.
 */
function forgetPreviousInstall(): Promise<void> {
  installChecked ??= (async () => {
    try {
      const marker = new File(Paths.document, 'rep-installed');
      if (marker.exists) return;
      await Promise.all(
        [KEYS.access, KEYS.refresh, KEYS.accessExpiresAt, KEYS.deviceId, KEYS.pendingSignOut, KEYS.activationPass].map((k) => SecureStore.deleteItemAsync(k))
      );
      marker.write('1');
    } catch {
      // No file system answer: keep what is stored rather than sign the rep out on every launch.
    }
  })();
  return installChecked;
}

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
  await forgetPreviousInstall();
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
    setDeviceOnly(KEYS.access, session.accessToken),
    session.refreshToken ? setDeviceOnly(KEYS.refresh, session.refreshToken) : SecureStore.deleteItemAsync(KEYS.refresh),
    session.accessExpiresAt
      ? setDeviceOnly(KEYS.accessExpiresAt, String(session.accessExpiresAt))
      : SecureStore.deleteItemAsync(KEYS.accessExpiresAt),
  ]);
  return true;
}

/** Sign-out on this device, whatever the path: the session, any activation pass and every offline copy go. */
export async function clearSession(): Promise<void> {
  generation++;
  cache = null;
  await Promise.all([
    clearOfflineCache(),
    SecureStore.deleteItemAsync(KEYS.access),
    SecureStore.deleteItemAsync(KEYS.refresh),
    SecureStore.deleteItemAsync(KEYS.accessExpiresAt),
    SecureStore.deleteItemAsync(KEYS.activationPass),
  ]);
}

/**
 * A sign-out the server never heard about (offline): the refresh token to revoke and the device
 * to take off push, sent again on the next launch.
 */
export interface PendingSignOut {
  deviceId: string;
  refreshToken: string;
}

export async function setPendingSignOut(pending: PendingSignOut | null): Promise<void> {
  if (pending) await setDeviceOnly(KEYS.pendingSignOut, JSON.stringify(pending));
  else await SecureStore.deleteItemAsync(KEYS.pendingSignOut);
}

export async function getPendingSignOut(): Promise<PendingSignOut | null> {
  await forgetPreviousInstall();
  try {
    const raw = await SecureStore.getItemAsync(KEYS.pendingSignOut);
    const parsed = raw ? (JSON.parse(raw) as Partial<PendingSignOut>) : null;
    return parsed?.deviceId && parsed.refreshToken ? { deviceId: parsed.deviceId, refreshToken: parsed.refreshToken } : null;
  } catch {
    return null;
  }
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
  await forgetPreviousInstall();
  let id = await SecureStore.getItemAsync(KEYS.deviceId);
  if (!id) {
    // Unguessable: the server drops other accounts' registrations of the same deviceId.
    id = `rep-${Crypto.randomUUID()}`;
    await setDeviceOnly(KEYS.deviceId, id);
  }
  return id;
}

/**
 * An unpaid account's activation pass (lib/onboarding.ts): kept on disk so a payment finished
 * after the app was closed still signs the rep in when the payment page sends them back.
 */
export interface ActivationPass {
  token: string;
  /** ISO time the server stops accepting it. */
  expiresAt: string;
}

export async function setActivationPass(pass: ActivationPass | null): Promise<void> {
  if (pass) await setDeviceOnly(KEYS.activationPass, JSON.stringify(pass));
  else await SecureStore.deleteItemAsync(KEYS.activationPass);
}

export async function getActivationPass(): Promise<ActivationPass | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEYS.activationPass);
    if (!raw) return null;
    const pass = JSON.parse(raw) as ActivationPass;
    if (typeof pass?.token !== 'string' || !(Date.parse(pass.expiresAt) > Date.now())) {
      await SecureStore.deleteItemAsync(KEYS.activationPass);
      return null;
    }
    return pass;
  } catch {
    return null;
  }
}
