import * as Haptics from 'expo-haptics';

// The only two haptics in the app (design rule): a light tap when a slot is picked and a
// success tap when a request is sent. Failures (no motor, web) are ignored.

export function tapSlot(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function sentRequest(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
