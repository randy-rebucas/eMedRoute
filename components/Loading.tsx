import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';

/** True while the phone asks for reduced motion. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/**
 * A thin bar over cached content while fresh data loads. Slides when motion is allowed; a still
 * partial bar under Reduce Motion.
 */
export function ThinProgress({ active }: { active: boolean }) {
  const reduce = useReduceMotion();
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active || reduce) return;
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
    );
    loop.start();
    return () => {
      loop.stop();
      x.setValue(0);
    };
  }, [active, reduce, x]);

  if (!active) return <View style={styles.track} />;
  return (
    <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {reduce ? (
        <View style={[styles.bar, styles.still]} />
      ) : (
        <Animated.View
          style={[styles.bar, { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-120, 420] }) }] }]}
        />
      )}
    </View>
  );
}

/** Grey placeholder rows, only for a first-ever load (nothing cached yet). */
export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={[styles.block, { width: '55%' }]} />
          <View style={[styles.block, styles.blockThin, { width: '80%' }]} />
          <View style={[styles.block, styles.blockThin, { width: '35%' }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 3, overflow: 'hidden', marginBottom: spacing.sm },
  bar: { height: 3, width: 120, borderRadius: 2, backgroundColor: colors.primary },
  still: { width: '40%' },
  skeletonRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  block: { height: 16, borderRadius: 4, backgroundColor: colors.slateSoft },
  blockThin: { height: 12 },
});
