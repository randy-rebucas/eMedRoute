import type { ReactNode } from 'react';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { colors } from '@/lib/theme';

export type IllustrationName = 'calendar' | 'clinic' | 'products' | 'search' | 'error' | 'team';

/**
 * Flat spot illustrations for empty and error states, drawn from the theme tokens (no gradients,
 * no raster assets). Decorative only: the text beside them carries the meaning.
 */
export function Illustration({ name, size = 144 }: { name: IllustrationName; size?: number }) {
  return (
    <Svg
      width={size}
      height={(size * 3) / 4}
      viewBox="0 0 160 120"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Ground: a soft disc and a shadow line, the same under every scene. */}
      <Circle cx={80} cy={60} r={52} fill={colors.primarySoft} />
      <Path d="M30 106h100" stroke={colors.border} strokeWidth={2} strokeLinecap="round" />
      {SCENES[name]}
    </Svg>
  );
}

const stroke = { stroke: colors.slate, strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const SCENES: Record<IllustrationName, ReactNode> = {
  calendar: (
    <G>
      <Rect x={44} y={30} width={72} height={70} rx={10} fill={colors.surface} {...stroke} />
      <Path d="M44 50h72" {...stroke} />
      <Rect x={45.25} y={31.25} width={69.5} height={17.5} rx={9} fill={colors.slateSoft} />
      <Line x1={62} y1={24} x2={62} y2={36} {...stroke} />
      <Line x1={98} y1={24} x2={98} y2={36} {...stroke} />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <Rect key={`${r}${c}`} x={54 + c * 14} y={58 + r * 12} width={8} height={6} rx={2} fill={colors.border} />
        ))
      )}
      <Circle cx={112} cy={92} r={14} fill={colors.primary} />
      <Path d="M105 92l5 5 9-10" stroke={colors.primaryText} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </G>
  ),
  clinic: (
    <G>
      <Rect x={50} y={40} width={60} height={64} rx={6} fill={colors.surface} {...stroke} />
      <Path d="M44 44l36-20 36 20" fill="none" {...stroke} />
      <Rect x={70} y={78} width={20} height={26} rx={3} fill={colors.slateSoft} {...stroke} />
      <Rect x={58} y={52} width={12} height={10} rx={2} fill={colors.slateSoft} />
      <Rect x={90} y={52} width={12} height={10} rx={2} fill={colors.slateSoft} />
      <Circle cx={80} cy={58} r={9} fill={colors.primary} />
      <Path d="M80 53v10M75 58h10" stroke={colors.primaryText} strokeWidth={2.5} strokeLinecap="round" />
    </G>
  ),
  products: (
    <G>
      <Rect x={48} y={46} width={44} height={58} rx={8} fill={colors.surface} {...stroke} />
      <Rect x={54} y={34} width={32} height={14} rx={4} fill={colors.slateSoft} {...stroke} />
      <Rect x={56} y={62} width={28} height={18} rx={3} fill={colors.primarySoft} />
      <Path d="M62 71h16" stroke={colors.primary} strokeWidth={2.5} strokeLinecap="round" />
      <G transform="rotate(-35 112 82)">
        <Rect x={96} y={72} width={34} height={18} rx={9} fill={colors.surface} {...stroke} />
        <Path d="M113 72.5v17" {...stroke} />
        <Path d="M113.5 73.25h7a7.75 7.75 0 0 1 0 15.5h-7z" fill={colors.primary} />
      </G>
    </G>
  ),
  search: (
    <G>
      <Rect x={44} y={28} width={56} height={72} rx={8} fill={colors.surface} {...stroke} />
      <Path d="M56 46h32M56 58h24M56 70h28" stroke={colors.border} strokeWidth={4} strokeLinecap="round" />
      <Circle cx={100} cy={74} r={16} fill={colors.surface} {...stroke} />
      <Path d="M112 86l12 12" stroke={colors.primary} strokeWidth={5} strokeLinecap="round" />
    </G>
  ),
  error: (
    <G>
      <Rect x={44} y={30} width={72} height={70} rx={10} fill={colors.surface} {...stroke} />
      <Path d="M80 46l20 36H60z" fill={colors.warningSoft} stroke={colors.warning} strokeWidth={2.5} strokeLinejoin="round" />
      <Path d="M80 58v10" stroke={colors.warning} strokeWidth={3} strokeLinecap="round" />
      <Circle cx={80} cy={75} r={1.8} fill={colors.warning} />
    </G>
  ),
  team: (
    <G>
      <Circle cx={60} cy={56} r={12} fill={colors.slateSoft} {...stroke} />
      <Path d="M38 100a22 22 0 0 1 44 0z" fill={colors.slateSoft} {...stroke} />
      <Circle cx={100} cy={52} r={14} fill={colors.surface} {...stroke} />
      <Path d="M74 100a26 26 0 0 1 52 0z" fill={colors.surface} {...stroke} />
      <Circle cx={118} cy={34} r={10} fill={colors.primary} />
      <Path d="M118 29v10M113 34h10" stroke={colors.primaryText} strokeWidth={2.5} strokeLinecap="round" />
    </G>
  ),
};
