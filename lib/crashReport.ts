import { Platform } from 'react-native';
import { apiFetch } from './api';
import { installedVersion } from './appVersion';

/**
 * Release crashes, sent to the server log (POST /api/medical-representatives/client-errors) so
 * they aren't invisible. Only the error, the screen path and the app version go: no account data,
 * no screen contents. Never throws, never waits on the network for long.
 */
const ENDPOINT = '/api/medical-representatives/client-errors';
const MAX_PER_RUN = 10;
let sent = 0;
let currentScreen: string | null = null;

/** The root layout keeps this up to date, so a report says where the crash happened. */
export function setCrashScreen(path: string | null): void {
  currentScreen = path;
}

export function reportCrash(error: unknown, fatal = false): void {
  if (__DEV__ || sent >= MAX_PER_RUN) return;
  sent++;
  const err = error instanceof Error ? error : new Error(String(error));
  apiFetch(ENDPOINT, {
    method: 'POST',
    auth: false,
    timeoutMs: 8000,
    body: {
      message: `${err.name}: ${err.message}`.slice(0, 500),
      stack: err.stack?.slice(0, 4000),
      screen: currentScreen ?? undefined,
      appVersion: installedVersion() ?? undefined,
      platform: `${Platform.OS} ${String(Platform.Version)}`,
      fatal,
    },
  }).catch(() => {});
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
interface ErrorUtilsShape {
  getGlobalHandler(): GlobalHandler;
  setGlobalHandler(handler: GlobalHandler): void;
}

let installed = false;

/**
 * Report errors no screen caught (an event handler, a timer) and then let React Native's own
 * handler run as before. Render errors go through the root ErrorBoundary instead.
 */
export function installCrashHandler(): void {
  if (installed) return;
  installed = true;
  const utils = (globalThis as { ErrorUtils?: ErrorUtilsShape }).ErrorUtils;
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    reportCrash(error, !!isFatal);
    previous(error, isFatal);
  });
}
