import { useEffect } from 'react';
import { router } from 'expo-router';
import { emitRefresh } from '@/lib/events';
import { markInboxRead } from '@/lib/inbox';
import { Notifications as MaybeNotifications } from '@/lib/notifications';
import { routeForNotification } from '@/lib/push';

// Survives remounts (sign out → sign in) so one tap is never handled twice.
const handled = new Set<string>();

/**
 * Mounted inside the signed-in area. A push that arrives in the foreground
 * refreshes the matching data (no banner); a tapped push (including the one that launched
 * the app) also opens the matching screen.
 */
export function NotificationResponder() {
  return MaybeNotifications ? <Responder Notifications={MaybeNotifications} /> : null;
}

function Responder({ Notifications }: { Notifications: NonNullable<typeof MaybeNotifications> }) {
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!lastResponse || lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = lastResponse.notification.request.identifier;
    if (handled.has(id)) return;
    handled.add(id);
    Notifications.clearLastNotificationResponse();

    const data = lastResponse.notification.request.content.data ?? undefined;
    const route = routeForNotification(data);
    // Opened from the push: it's read in the inbox too (that also refreshes the bell).
    const notificationId = typeof data?.notificationId === 'string' ? data.notificationId : null;
    if (notificationId) markInboxRead({ ids: [notificationId] }).catch(() => emitRefresh('inbox'));
    else emitRefresh('inbox');
    emitRefresh(...route.topics);
    if (route.href) router.push(route.href as never);
  }, [Notifications, lastResponse]);

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const route = routeForNotification(notification.request.content.data ?? undefined);
      // A new one is in the inbox: the bell's count and the list.
      emitRefresh(...route.topics, 'inbox');
    });
    return () => subscription.remove();
  }, [Notifications]);

  return null;
}
