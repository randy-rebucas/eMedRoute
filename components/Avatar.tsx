import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/lib/theme';

/** "Ana Reyes" → "AR", for avatars. */
export function initialsOf(name: string | null | undefined): string {
  return name
    ? name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase()
    : '';
}

/**
 * The rep's picture, or their initials when there's none. `tone`: `soft` (teal tint, for light
 * screens), `teal` (filled, for the navy cards). Decorative: the name beside it carries the meaning.
 */
export function Avatar({
  name,
  image,
  size = 48,
  tone = 'soft',
}: {
  name: string | null | undefined;
  image?: string | null;
  size?: number;
  tone?: 'soft' | 'teal';
}) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (image) {
    return (
      <Image
        source={{ uri: image }}
        style={[box, styles.image]}
        accessibilityIgnoresInvertColors
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }
  const initials = initialsOf(name);
  return (
    <View
      style={[box, styles.initials, { backgroundColor: tone === 'teal' ? colors.primary : colors.primarySoft }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        style={{ fontSize: Math.round(size * 0.36), fontWeight: '700', color: tone === 'teal' ? colors.primaryText : colors.primaryOnSoft }}
        maxFontSizeMultiplier={1.3}
      >
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.slateSoft },
  initials: { alignItems: 'center', justifyContent: 'center' },
});
