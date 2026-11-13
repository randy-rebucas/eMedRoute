import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Polyline, Stop } from 'react-native-svg';
import { colors } from '@/lib/theme';

/**
 * Heart-with-pulse MyClinicSoft mark (clinic-management lib/brand-mark.ts). Its gradient is
 * brand identity, the one gradient the design allows.
 */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Defs>
        <LinearGradient id="heart" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.accent} />
          <Stop offset="1" stopColor={colors.primary} />
        </LinearGradient>
      </Defs>
      <Path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill="url(#heart)"
      />
      <Polyline
        points="3.5,11.5 8,11.5 9.5,8.5 11.5,15 13.5,7 15,11.5 20.5,11.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Mark + "eMedRoute" wordmark + "by MyClinicSoft", as on the sign-in screen and the tab headers. */
export function BrandLogo({
  size = 'md',
  align = 'center',
  tone = 'default',
}: {
  size?: 'sm' | 'md';
  align?: 'center' | 'left';
  /** `onNavy`: over the sign-in photo bands (white word, bright teal accent). */
  tone?: 'default' | 'onNavy';
}) {
  const s = SIZES[size];
  const onNavy = tone === 'onNavy';
  return (
    <View style={[styles.row, align === 'left' && styles.left]} accessible accessibilityRole="header" accessibilityLabel="eMedRoute">
      <BrandMark size={s.mark} />
      <View>
        <Text style={[styles.word, onNavy && styles.wordOnNavy, { fontSize: s.word, lineHeight: s.word * 1.1 }]}>
          eMed<Text style={[styles.wordAccent, onNavy && styles.wordAccentOnNavy]}>Route</Text>
        </Text>
        <Text style={[styles.sub, onNavy && styles.subOnNavy, { fontSize: s.sub }]}>by MyClinicSoft</Text>
      </View>
    </View>
  );
}

const SIZES = {
  sm: { mark: 32, word: 20, sub: 12 },
  md: { mark: 44, word: 28, sub: 13 },
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center' },
  left: { alignSelf: 'flex-start' },
  word: { fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  wordAccent: { color: colors.primary },
  sub: { color: colors.textMuted, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  wordOnNavy: { color: colors.primaryText },
  wordAccentOnNavy: { color: colors.accent },
  subOnNavy: { color: colors.onNavyMuted },
});
