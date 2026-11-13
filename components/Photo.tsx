import { ReactNode, useId } from 'react';
import { ImageBackground, ImageSourcePropType, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '@/lib/theme';

/**
 * The bundled stock photos (Unsplash licence: free to use, no attribution required; sources in
 * assets/photos/CREDITS.md). Small JPEGs, already cropped and toned down to sit with the teal/navy.
 */
export const photos = {
  clinicLobby: require('@/assets/photos/clinic-lobby.jpg') as ImageSourcePropType,
  doctorMeeting: require('@/assets/photos/doctor-meeting.jpg') as ImageSourcePropType,
  visitNotes: require('@/assets/photos/visit-notes.jpg') as ImageSourcePropType,
  handshake: require('@/assets/photos/handshake.jpg') as ImageSourcePropType,
  onTheRoad: require('@/assets/photos/on-the-road.jpg') as ImageSourcePropType,
  clinicSign: require('@/assets/photos/clinic-sign.jpg') as ImageSourcePropType,
  blisterPack: require('@/assets/photos/blister-pack.jpg') as ImageSourcePropType,
  requestSent: require('@/assets/photos/request-sent.jpg') as ImageSourcePropType,
  teamBriefing: require('@/assets/photos/team-briefing.jpg') as ImageSourcePropType,
};

/**
 * A photo under a navy scrim that deepens toward the bottom, so white text there always reads
 * (the scrim's foot is near-solid navy: the text contrast is navy's, not the photo's). Decorative:
 * the photo is hidden from screen readers; the children carry the meaning.
 */
export function ScrimPhoto({
  source,
  children,
  style,
  top = 0.15,
  bottom = 0.92,
}: {
  source: ImageSourcePropType;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scrim opacity at the top edge and at the bottom edge. */
  top?: number;
  bottom?: number;
}) {
  const id = `scrim${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <ImageBackground
      source={source}
      resizeMode="cover"
      style={[styles.frame, style]}
      accessibilityIgnoresInvertColors
      imageStyle={styles.image}
    >
      <Svg style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.navy} stopOpacity={top} />
            <Stop offset="0.45" stopColor={colors.navy} stopOpacity={(top + bottom) / 2} />
            <Stop offset="1" stopColor={colors.navy} stopOpacity={bottom} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      <View style={styles.content}>{children}</View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: colors.navy },
  image: { opacity: 1 },
  content: { flex: 1 },
});
