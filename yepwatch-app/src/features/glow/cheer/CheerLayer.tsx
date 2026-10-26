/**
 * Production cheer for the final poster: Popcorn always; the Marquee bonus only while every active
 * (non-dropped) room member holds at once, after a 350 ms dwell. No counts or text on stage.
 * Mount it absolutely over the container that holds the poster; `poster` is in that container's
 * coordinates. It never takes touches.
 */
import { View } from 'react-native';
import { glow } from '../theme';
import { peerColor } from '../model';
import { useAllHoldBonus } from './hooks';
import { MarqueeLayer } from './Marquee';
import { PopcornLayer, type CheerEventInput } from './Popcorn';
import type { PosterRect } from './popcorn-path';

export type { CheerEventInput } from './Popcorn';
export type { PosterRect } from './popcorn-path';
export { usePosterCheer, usePosterSpring, useAllHoldBonus } from './hooks';
export { newCheerSeed } from './random';

export const colorForParticipant = (id: string, selfId: string) => (id === selfId ? glow.amber : peerColor(id));

export function CheerLayer({ poster, events, holders, allHold, reduced, selfId, onBurst }: {
  poster: PosterRect;
  events: readonly CheerEventInput[];
  /** Everyone holding right now (including you): participantId -> episode seed. */
  holders: ReadonlyMap<string, number>;
  /** True while every active room member holds (computed from the roster by the caller). */
  allHold: boolean;
  reduced: boolean;
  selfId: string;
  onBurst?: () => void;
}) {
  const bonus = useAllHoldBonus(allHold);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      <MarqueeLayer poster={poster} active={bonus} reduced={reduced} />
      <PopcornLayer poster={poster} events={events} holders={holders} reduced={reduced} colorOf={(id) => colorForParticipant(id, selfId)} onBurst={onBurst} />
    </View>
  );
}
