import { Platform, TextStyle } from 'react-native';
import { colors } from './theme';

/**
 * Every text size in the app, smallest first. Screens use these names (or the `type` styles
 * below), never a bare number, so sizes stay a short, deliberate list.
 */
export const textSize = {
  xs: 12,
  sm: 13,
  md: 14,
  base: 15,
  lg: 16,
  xl: 17,
  xxl: 18,
  h4: 20,
  h3: 22,
  h2: 24,
  h1: 26,
  title: 28,
  display: 36,
} as const;

/**
 * The rep app's type scale (docs: build prompt → Design). Nothing is set smaller than 12.
 * Colours and spacing come from lib/theme.ts, which is eMCR's, unchanged.
 */
export const type = {
  screenTitle: { fontSize: textSize.title, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  cardTitle: { fontSize: textSize.xl, fontWeight: '600', color: colors.text },
  body: { fontSize: textSize.base, lineHeight: 21, color: colors.text },
  secondary: { fontSize: textSize.sm, lineHeight: 18, color: colors.textMuted },
  pill: { fontSize: textSize.xs, fontWeight: '600' },
  label: { fontSize: textSize.sm, fontWeight: '600', color: colors.text },
} satisfies Record<string, TextStyle>;

/**
 * Times, dates, seat counts and prices: a monospaced face with tabular numerals, so figures
 * line up in lists and don't jump while counting.
 */
export const mono: TextStyle = {
  fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  fontVariant: ['tabular-nums'],
};
