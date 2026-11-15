/** The Taste answers' marks: a heart (Loved it), a quiet thumb down (Not for me), an eye with a slash (Haven't seen). */
import Svg, { Path } from 'react-native-svg';
import { glow } from '../glow/theme';
import type { CardAnswer } from './answers';

export function Heart({ size = 18, color = glow.ink, filled = false }: { size?: number; color?: string; filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={2} strokeLinejoin="round" accessible={false}>
      <Path d="M12 20s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" />
    </Svg>
  );
}
/** Not Tonight's red cross: Not for me is a quiet no. */
export function ThumbDown({ size = 18, color = glow.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
      <Path d="M17 14V3M7 10l3.6 10.2A1.8 1.8 0 0 0 14 19.5V15h4.6a2 2 0 0 0 2-2.3l-1.2-7.4A2 2 0 0 0 17.4 3.6H7" transform="translate(-1 0)" />
      <Path d="M3 3.6h3v10H3z" />
    </Svg>
  );
}
export function Unseen({ size = 18, color = glow.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
      <Path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
      <Path d="M4 4l16 16" />
    </Svg>
  );
}
export function AnswerIcon({ a, size, color }: { a: CardAnswer; size: number; color: string }) {
  return a === 'loved' ? <Heart size={size} color={color} filled /> : a === 'not_for_me' ? <ThumbDown size={size} color={color} /> : <Unseen size={size} color={color} />;
}
