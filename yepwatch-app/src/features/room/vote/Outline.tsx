/**
 * The word's single outer outline on native: the same idea as the web's SVG filter (grow the word,
 * cut the word out) drawn with react-native-svg. A mask lets the stroked word (stroke and fill)
 * through and cuts the filled word back out, so only the outer ring of the stroke stays; the lines
 * inside overlapping glyph parts fall inside the cut and never show.
 */
import { useId } from 'react';
import Svg, { Defs, Mask, Rect, Text as SvgText } from 'react-native-svg';
import { BASELINE, TRACK, wordW, type VoteWord } from './geometry';

export interface OutlineProps {
  text: VoteWord;
  size: number;
  color: string;
  /** The outline's width in px. */
  width?: number;
  /** Several copies side by side, `step` apart (the wall's rows). */
  repeat?: number;
  step?: number;
}

export function Outline({ text, size, color, width = 2, repeat = 1, step = 0 }: OutlineProps) {
  const id = `yw-outline-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const cell = repeat > 1 ? step : wordW(text, size) * 1.04 + width * 2;
  const w = cell * Math.max(1, repeat);
  const h = size + width * 2;
  const words = (paint: { fill: string; stroke?: string }) =>
    Array.from({ length: Math.max(1, repeat) }, (_, k) => (
      <SvgText key={k} x={cell * k + cell / 2} y={width + size * BASELINE} textAnchor="middle" fontFamily="GabaritoBold" fontSize={size} letterSpacing={TRACK * size}
        fill={paint.fill} stroke={paint.stroke} strokeWidth={paint.stroke ? width * 2 : 0} strokeLinejoin="round">
        {text}
      </SvgText>
    ));
  return (
    <Svg width={w} height={h} style={{ marginVertical: -width }} accessible={false} pointerEvents="none">
      <Defs>
        <Mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
          {words({ fill: '#fff', stroke: '#fff' })}
          {words({ fill: '#000' })}
        </Mask>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill={color} mask={`url(#${id})`} />
    </Svg>
  );
}
