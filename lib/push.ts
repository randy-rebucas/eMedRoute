import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiRequest, AUTH_ENDPOINTS } from './api';
import { RefreshTopic } from './events';
import { t } from './i18n';
import { Notifications } from './notifications';
import { getOrCreateDeviceId } from './storage';

// In the foreground the visible list refreshes instead (NotificationResponder); the push still
// lands in the notification list.
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function pushSupported(): boolean {
  return !!Notifications && Device.isDevice && (Platform.OS === 'ios' || Platform.OS === 'android');
}

/**
 * True when the OS hasn't been asked for notification permission yet, so the
 * app should show its own "Stay updated" screen before triggering the prompt.
 */
export async function shouldAskForNotifications(): Promise<boolean> {
  if (!pushSupported() || !Notifications) return false;
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  return status === 'undetermined' && canAskAgain;
}

/**
 * Obtains an Expo push token when permission allows and registers this device
 * with the devices endpoint. With `prompt` (the default) it asks for permission
 * first if the OS hasn't been asked yet; `prompt: false` never shows the OS
 * dialog. Call after sign-in, on launch and whenever the push token changes. On simulators,
 * emulators and Expo Go on Android the device is still registered, without a push token.
 */
export async function registerForPushNotifications({ prompt = true }: { prompt?: boolean } = {}): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  let pushToken: string | undefined;

  if (pushSupported() && Notifications) {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: t('notifications.channelDefault'),
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted' && prompt) {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus === 'granted') {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      try {
        // Throws without an EAS projectId (run `eas init`) or when the push service is unreachable.
        pushToken = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
      } catch (error) {
        if (__DEV__) console.warn('[push] Could not get an Expo push token; registering device without one.', error);
      }
    }
  }

  // Registered even without a push token so the backend knows the device for sign-out.
  // The server only accepts ios / android.
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  await apiRequest(AUTH_ENDPOINTS.devices, {
    method: 'POST',
    body: {
      deviceId,
      platform: Platform.OS,
      pushToken,
      appVersion: Constants.expoConfig?.version,
    },
  });
}

/**
 * The OS notification permission for this app: 'unavailable' where push can't work at all
 * (Expo Go on Android, simulators, web), otherwise the OS status.
 */
export type PushPermission = 'unavailable' | 'granted' | 'denied' | 'undetermined';

export async function getPushPermission(): Promise<PushPermission> {
  if (!pushSupported() || !Notifications) return 'unavailable';
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  // Asked once and refused: only the phone's Settings app can turn it back on.
  return status === 'undetermined' && canAskAgain ? 'undetermined' : 'denied';
}

/** Re-register when the OS rotates the push token. Returns an unsubscribe function. */
export function watchPushToken(): () => void {
  if (!Notifications) return () => {};
  const subscription = Notifications.addPushTokenListener(() => {
    registerForPushNotifications({ prompt: false }).catch(() => {});
  });
  return () => subscription.remove();
}

export interface NotificationRoute {
  /** Screen to open, or null to stay where the user is. */
  href: string | null;
  /** Data to refetch. */
  topics: RefreshTopic[];
}

/**
 * Where a tapped push should take the rep. The server sends `data.screen` (`visits`,
 * `products` or `team`) and sometimes `data.id`: the detail when there is an id, else the list.
 */
export function routeForNotification(data: Record<string, unknown> | undefined): NotificationRoute {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const screen = str(data?.screen);
  const id = str(data?.id);

  switch (screen) {
    case 'visits':
      return { href: id ? `/visits/${encodeURIComponent(id)}` : '/visits', topics: ['visits', 'dashboard'] };
    case 'products':
      return { href: id ? `/products/${encodeURIComponent(id)}` : '/products', topics: ['products', 'dashboard'] };
    case 'team':
      return { href: '/team', topics: ['team'] };
    default:
      return { href: null, topics: ['visits', 'products', 'team', 'dashboard'] };
  }
}
