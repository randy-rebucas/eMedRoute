import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { apiRequest } from './api';

/**
 * Minimum and latest app versions from the backend, so an old build that can no longer talk to the
 * API is asked to update instead of failing screen by screen. The endpoint is public and optional:
 * any failure (offline, a backend without the route answering 404) means "no requirement" and never
 * blocks the app. The screens are components/UpdateGate.tsx.
 */

export const APP_CONFIG_ENDPOINT = '/api/medical-representatives/app-config';

interface AppConfig {
  minVersion: string | null;
  latestVersion: string | null;
  iosStoreUrl: string | null;
  androidStoreUrl: string | null;
}

export type UpdateStatus =
  | { kind: 'none' }
  /** Below `minVersion`: the app can't be used until it is updated. */
  | { kind: 'required'; storeUrl: string | null }
  /** Below `latestVersion` only: a dismissible prompt, once per latest version. */
  | { kind: 'available'; latestVersion: string; storeUrl: string | null };

/** Short: this runs on launch and must never hold anything up. */
const CHECK_TIMEOUT_MS = 8000;

const ANDROID_PACKAGE = 'solutions.myclinicsoft.emedroute';

/** The latest version the soft prompt was already shown for. Not personal data. */
const SOFT_PROMPT_KEY = 'rep_update_prompt_shown_for';

/**
 * The installed version. The app ships without expo-updates, so the bundled config's version is
 * the store build's version.
 */
export function installedVersion(): string | null {
  return Constants.expoConfig?.version ?? null;
}

/** Numeric parts of "1.2.3" (anything after "-" or "+" is ignored); null if it isn't a version. */
function parts(version: string): number[] | null {
  const core = version.trim().split(/[-+]/)[0];
  if (!/^\d+(\.\d+)*$/.test(core)) return null;
  return core.split('.').map(Number);
}

/** Whether `installed` is older than `target`. Unparseable versions never count as older. */
export function isOlder(installed: string, target: string): boolean {
  const a = parts(installed);
  const b = parts(target);
  if (!a || !b) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function storeUrlFrom(config: Partial<AppConfig>): string | null {
  if (Platform.OS === 'ios') return str(config.iosStoreUrl);
  if (Platform.OS === 'android') {
    return str(config.androidStoreUrl) ?? `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
  }
  return null;
}

/** Decide from a fetched config. Exported for tests. */
export function statusFrom(installed: string, config: Partial<AppConfig> | null): UpdateStatus {
  if (!config || typeof config !== 'object') return { kind: 'none' };
  const minVersion = str(config.minVersion);
  const latestVersion = str(config.latestVersion);
  const storeUrl = storeUrlFrom(config);
  if (minVersion && isOlder(installed, minVersion)) return { kind: 'required', storeUrl };
  if (latestVersion && isOlder(installed, latestVersion)) return { kind: 'available', latestVersion, storeUrl };
  return { kind: 'none' };
}

/** Ask the backend whether this build must or may update. Never throws. */
export async function checkForUpdate(): Promise<UpdateStatus> {
  const installed = installedVersion();
  if (!installed) return { kind: 'none' };
  try {
    const config = await apiRequest<Partial<AppConfig> | null>(APP_CONFIG_ENDPOINT, {
      auth: false,
      timeoutMs: CHECK_TIMEOUT_MS,
    });
    return statusFrom(installed, config);
  } catch {
    return { kind: 'none' };
  }
}

/** Whether the soft prompt was already shown for this latest version. Unknown counts as shown. */
export async function softPromptShownFor(latestVersion: string): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(SOFT_PROMPT_KEY)) === latestVersion;
  } catch {
    return true;
  }
}

export async function noteSoftPromptShown(latestVersion: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(SOFT_PROMPT_KEY, latestVersion);
  } catch {
    // At worst the prompt shows once more on a later launch.
  }
}
