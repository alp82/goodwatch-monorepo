/** The rubber stamp's ink on the web: frame and word under a static SVG turbulence mask (worn holes, rough edges). */
import { View } from 'react-native';
import { Word } from './Word';
import { fill, webStyle } from './paint';
import type { StampInkProps } from './StampInk';

const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='600' height='300'><filter id='f' x='0' y='0'><feTurbulence type='fractalNoise' baseFrequency='0.045 0.06' numOctaves='3' seed='7'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -11 0 0 0 7.6'/></filter><rect width='600' height='300' filter='url(#f)'/></svg>")}")`;

export function StampInk({ text, size, color, border }: StampInkProps) {
  return (
    <View style={[fill, { alignItems: 'center', justifyContent: 'center' }, webStyle({ WebkitMaskImage: GRAIN, WebkitMaskSize: '100% 100%', maskImage: GRAIN, maskSize: '100% 100%' })]}>
      <View style={{ ...fill, borderRadius: size * 0.16, borderWidth: border, borderColor: color }} />
      <View style={{ position: 'absolute', left: border * 1.7, top: border * 1.7, right: border * 1.7, bottom: border * 1.7, borderRadius: size * 0.08, borderWidth: Math.max(2, border * 0.38), borderColor: color }} />
      <Word text={text} size={size} color={color} style={{ letterSpacing: size * 0.01 }} />
    </View>
  );
}
