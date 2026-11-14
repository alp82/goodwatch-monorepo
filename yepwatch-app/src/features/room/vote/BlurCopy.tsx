import { PosterCopy } from './shapes';

export interface BlurCopyProps {
  uri: string | null;
  /** The box the copy fills (px). */
  width: number;
  height: number;
  /** CSS blur radius (px), then the other filter functions (e.g. `grayscale(1) brightness(1.1)`). */
  blur: number;
  rest: string;
  /** Native blur radius. */
  nativeBlur: number;
  tints: readonly { color: string; opacity: number }[];
}

/** A heavily blurred copy of the poster (bleed's backdrop). Native: the poster copy with its native blur. */
export function BlurCopy({ uri, blur, rest, nativeBlur, tints }: BlurCopyProps) {
  return <PosterCopy uri={uri} css={`blur(${blur}px) ${rest}`} blur={nativeBlur} tints={tints} />;
}
