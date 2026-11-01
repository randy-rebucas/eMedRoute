import { Linking, Platform } from 'react-native';

/**
 * Open the phone's maps app on an address (no in-app map). Falls back to Google Maps in the
 * browser when no maps app answers.
 */
export async function openDirections(address: string): Promise<void> {
  const q = encodeURIComponent(address.trim());
  if (!q) return;
  const native = Platform.select({ ios: `http://maps.apple.com/?daddr=${q}`, android: `geo:0,0?q=${q}` });
  const web = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  // openURL straight away: Android 11+ answers canOpenURL "false" for geo: without a manifest query.
  try {
    if (native) {
      await Linking.openURL(native);
      return;
    }
  } catch {
    // fall through to the browser
  }
  await Linking.openURL(web);
}
