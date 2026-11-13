import { defineStrings } from '../types';

// Area "notifications": lib/push.ts (Android channel name), app/(app)/notifications.tsx, the bell
// in AppHeader, components/InboxRow.tsx.
export default defineStrings({
  en: {
    channelDefault: 'Visits and reminders',
    title: 'Notifications',
    unread: { one: '{count} unread', other: '{count} unread' },
    caughtUp: 'All caught up',
    markAllRead: 'Mark all read',
    markingAllRead: 'Marking…',
    'empty.title': 'No notifications yet',
    'empty.hint': 'Clinic answers, reminders, deliveries and support replies land here, even when push is off.',
    offlineSubject: 'your notifications as last loaded',
    bell: 'Notifications',
    bellUnread: { one: 'Notifications, {count} unread', other: 'Notifications, {count} unread' },
    unreadMark: 'Unread',
    markFailed: 'Couldn’t mark them read. Try again.',
  },
  fil: {
    channelDefault: 'Pagbisita at paalala',
    title: 'Notifications',
    unread: '{count} hindi pa nababasa',
    caughtUp: 'Nabasa mo na lahat',
    markAllRead: 'Markahang nabasa lahat',
    markingAllRead: 'Minamarkahan…',
    'empty.title': 'Wala pang notification',
    'empty.hint': 'Dito lalabas ang sagot ng clinic, mga paalala, deliveries at sagot ng support, kahit naka-off ang push.',
    offlineSubject: 'notifications mo gaya ng huling na-load',
    bell: 'Notifications',
    bellUnread: 'Notifications, {count} hindi pa nababasa',
    unreadMark: 'Hindi pa nababasa',
    markFailed: 'Hindi ito namarkahan. Subukan ulit.',
  },
});
