import { Platform, TextStyle } from 'react-native';
import { colors } from './theme';

/**
 * The rep app's type scale (docs: build prompt → Design). Nothing is set smaller than 12.
 * Colours and spacing come from lib/theme.ts, which is eMCR's, unchanged.
 */
export const type = {
  screenTitle: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  body: { fontSize: 15, lineHeight: 21, color: colors.text },
  secondary: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  pill: { fontSize: 12, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
} satisfies Record<string, TextStyle>;

/**
 * Times, dates, seat counts and prices: a monospaced face with tabular numerals, so figures
 * line up in lists and don't jump while counting.
 */
export const mono: TextStyle = {
  fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  fontVariant: ['tabular-nums'],
};
