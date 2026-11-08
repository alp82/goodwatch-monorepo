/**
 * The rubber stamp's ink on native: frame and word drawn in react-native-svg under a mask with
 * worn specks cut out (native has no CSS mask or turbulence filter). The specks are fixed, so the
 * stamp looks the same every time.
 */
import { useId, useMemo } from 'react';
import Svg, { Circle, Defs, G, Mask, Rect, Text as SvgText } from 'react-native-svg';
import { BASELINE } from './geometry';

export interface StampInkProps {
  text: string;
  size: number;
  color: string;
  /** The outer frame's width. */
  border: number;
  /** The stamp box. */
  width: number;
  height: number;
}

function specks(width: number, height: number, size: number) {
  let s = 7;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  return Array.from({ length: 70 }, () => ({ cx: r() * width, cy: r() * height, r: size * (0.006 + r() * (r() < 0.12 ? 0.05 : 0.018)) }));
}

export function StampInk({ text, size, color, border, width, height }: StampInkProps) {
  const id = `yw-stamp-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const holes = useMemo(() => specks(width, height, size), [width, height, size]);
  const inset = border * 1.7;
  const inner = Math.max(2, border * 0.38);
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }} accessible={false} pointerEvents="none">
      <Defs>
        <Mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
          <Rect x={0} y={0} width={width} height={height} fill="#fff" />
          {holes.map((h, k) => <Circle key={k} cx={h.cx} cy={h.cy} r={h.r} fill="#000" />)}
        </Mask>
      </Defs>
      <G mask={`url(#${id})`}>
        <Rect x={border / 2} y={border / 2} width={width - border} height={height - border} rx={size * 0.16} fill="none" stroke={color} strokeWidth={border} />
        <Rect x={inset + inner / 2} y={inset + inner / 2} width={width - inset * 2 - inner} height={height - inset * 2 - inner} rx={size * 0.08} fill="none" stroke={color} strokeWidth={inner} />
        <SvgText x={width / 2} y={(height - size) / 2 + size * BASELINE} textAnchor="middle" fontFamily="GabaritoBold" fontSize={size} letterSpacing={size * 0.01} fill={color}>{text}</SvgText>
      </G>
    </Svg>
  );
}
