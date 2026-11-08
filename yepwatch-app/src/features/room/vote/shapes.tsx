/**
 * Soft shapes the looks share on every platform, drawn with react-native-svg instead of CSS blur
 * and conic gradients (which native doesn't have): a glow blob and a ray burst.
 */
import { useId } from 'react';
import { Image, View, type ImageStyle, type StyleProp } from 'react-native';
import Svg, { Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { fill, web } from './paint';

const svgId = (prefix: string, raw: string) => `${prefix}-${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`;

/** A soft blob that fades out to its edge, like a blurred pill. */
export function Glow({ width, height, color, opacity = 1, style }: { width: number; height: number; color: string; opacity?: number; style?: object }) {
  const id = svgId('yw-glow', useId());
  return (
    <Svg width={width} height={height} style={style} accessible={false} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="0.45" stopColor={color} stopOpacity={opacity * 0.75} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * Sixteen rays around the center (one every 22.5°), `widthDeg` wide, starting at `from`, fading
 * out toward the edge.
 */
export function Rays({ size, color, opacity = 1, from = 0, widthDeg }: { size: number; color: string; opacity?: number; from?: number; widthDeg: number }) {
  const id = svgId('yw-rays', useId());
  const r = size / 2;
  const point = (deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(r + r * Math.cos(a)).toFixed(2)} ${(r + r * Math.sin(a)).toFixed(2)}`;
  };
  const d = Array.from({ length: 16 }, (_, k) => {
    const a0 = from + k * 22.5;
    return `M${r} ${r}L${point(a0)}A${r} ${r} 0 0 1 ${point(a0 + widthDeg)}Z`;
  }).join('');
  return (
    <Svg width={size} height={size} accessible={false} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0.14" stopColor={color} stopOpacity={opacity} />
          <Stop offset="0.42" stopColor={color} stopOpacity={opacity * 0.8} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <G><Path d={d} fill={`url(#${id})`} /></G>
    </Svg>
  );
}

/**
 * A copy of the poster with a treatment. The web gets the CSS filter; native has none, so it gets
 * the treatment's nearest native form: an optional blur and tinted layers on top.
 */
export function PosterCopy({ uri, css, blur, tints = [], style }: {
  uri: string | null;
  /** CSS filter for the web. */
  css?: string;
  /** Native blur radius. */
  blur?: number;
  /** Native tinted layers, bottom to top. */
  tints?: readonly { color: string; opacity: number }[];
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <>
      {uri ? (
        <Image source={{ uri }} accessible={false} blurRadius={web ? undefined : blur} resizeMode="cover"
          style={[{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }, web && css ? ({ filter: css } as ImageStyle) : null, style]} />
      ) : null}
      {web ? null : tints.map((t, k) => <View key={k} style={[fill, { backgroundColor: t.color, opacity: t.opacity }]} />)}
    </>
  );
}
