import { Linking, Platform } from 'react-native';

/**
 * Open the phone's maps app with directions to an address (no in-app map). On Android the Google
 * Maps directions link opens the Maps app straight into directions, which has a back arrow to the
 * app; a bare geo: link lands on Explore with no way back but the system gesture. Falls back to
 * Google Maps in the browser when no maps app answers.
 */
export async function openDirections(address: string): Promise<void> {
  const q = encodeURIComponent(address.trim());
  if (!q) return;
  const web = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  const native = Platform.select({ ios: `http://maps.apple.com/?daddr=${q}`, android: web });
  // openURL straight away: Android 11+ answers canOpenURL "false" without a manifest query.
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
