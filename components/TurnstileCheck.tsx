import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { API_BASE_URL } from '@/lib/config';

/**
 * What the check reports:
 * - `token`: solved; send it with the request (it works once, so remount after each attempt).
 * - `null`: not solved yet, or the token expired.
 * - `off`: Turnstile isn't set up on the server, so no token is needed.
 * - `failed`: the page didn't load; let the request go and let the server decide.
 */
export type TurnstileState = { status: 'token'; token: string } | { status: 'pending' | 'off' | 'failed' };

const PAGE_URL = `${API_BASE_URL}/turnstile/app`;

/**
 * Cloudflare Turnstile for the app. There's no native widget, so this shows our own page
 * (backend app/turnstile/app) in a WebView, which posts the token back. Change `key` to get a new one.
 */
export function TurnstileCheck({ onChange }: { onChange: (state: TurnstileState) => void }) {
  const origin = useMemo(() => new URL(API_BASE_URL).origin, []);

  const onMessage = (event: WebViewMessageEvent) => {
    // Only our page may answer; the widget's own frames can't reach this bridge.
    if (!event.nativeEvent.url.startsWith(`${origin}/`)) return;
    let message: { type?: unknown; token?: unknown };
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (message.type === 'turnstile' && typeof message.token === 'string' && message.token) {
      onChange({ status: 'token', token: message.token });
    } else if (message.type === 'turnstile-expired') {
      onChange({ status: 'pending' });
    } else if (message.type === 'turnstile-off') {
      onChange({ status: 'off' });
    }
  };

  return (
    <View style={styles.box}>
      <WebView
        source={{ uri: PAGE_URL }}
        originWhitelist={[origin, 'https://challenges.cloudflare.com']}
        onMessage={onMessage}
        onError={() => onChange({ status: 'failed' })}
        onHttpError={() => onChange({ status: 'failed' })}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        style={styles.webview}
        accessibilityLabel="Security check"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // The managed widget is 300×65.
  box: { height: 72, marginBottom: 12, overflow: 'hidden' },
  webview: { backgroundColor: 'transparent' },
});
