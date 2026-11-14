/**
 * Prototype (Q68): a cheaper burst look, for a side-by-side check against fx-looks' BurstBack / BurstFront.
 * Not wired into the voting stage.
 *
 * What makes burst expensive on the web: its back layer is the window-wide Clip box with a CSS mask (the soft top
 * and bottom edges). A mask over animated content makes the compositor draw the rotating rays and the glow into an
 * offscreen surface on every frame and then draw that surface through the mask: a second render pass per frame for
 * the whole stage (the frames' trace shows 1.9 render passes per frame with it, 1.0 without).
 *
 * The cheaper back layer has no mask. The same soft edges come from two static strips painted in the backdrop's
 * own colors, fading to clear, on top of the rays. Over a backdrop that matches the strips this is the same picture
 * (backdrop + (look - backdrop) x edge fade, either way), and nothing is drawn offscreen. Everything else is
 * unchanged: the same SVG rays and glow, transforms and opacity curves; the front layer (the word) is BurstFront.
 *
 * Tried and dropped: the rays and glow drawn once into canvases (as bleed's blur, 5de73e4e8). Each canvas is a
 * layer of its own under its animated box, and the compositor added render passes for them (2.3 per frame, 3.0
 * with the mask), more than the mask cost.
 */
import type { ReactNode } from 'react';
import { Easing, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BurstFront } from './fx-looks';
import { FxView } from './fx-view';
import type { Geo } from './geometry';
import { amber, ease, range, type LayerProps } from './paint';
import { Glow, Rays } from './shapes';

/** The backdrop's color at the stage's top and bottom edges (the strips that stand in for the mask). */
export interface Edges { top: string; bottom: string }

const clear = (hex: string) => `${hex.slice(0, 7)}00`;

/** The clipped, window-wide stage box, with the soft edges painted over its content instead of masked. */
function Clip({ g, edges, children }: { g: Geo; edges: Edges; children: ReactNode }) {
  const fade = g.stageH * 0.06;
  return (
    <FxView pointerEvents="none" style={{ position: 'absolute', left: -g.ext, top: 0, width: g.vw, height: g.stageH, overflow: 'hidden' }}>
      {children}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: fade }}>
        <LinearGradient colors={[edges.top, clear(edges.top)]} style={{ flex: 1 }} />
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: fade }}>
        <LinearGradient colors={[clear(edges.bottom), edges.bottom]} style={{ flex: 1 }} />
      </View>
    </FxView>
  );
}

export function CheapBurstBack({ g, kind, p, loop, reduced, edges }: LayerProps & { edges: Edges }) {
  const D = Math.hypot(g.vw, g.stageH) * 1.25;
  const nope = kind === 'nope';
  const spin = reduced ? '0deg' : loop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '22.5deg'] });
  const back = reduced ? '0deg' : loop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-22.5deg'] });
  const opacity = nope ? p.interpolate({ inputRange: [0, 0.25, 0.9], outputRange: [0, 0.5, 0], extrapolate: 'clamp' }) : ease(p);
  const scale = nope ? range(p, 1, 0.04, Easing.in(Easing.quad)) : range(p, 0.3, 1, Easing.out(Easing.cubic));
  const box = { position: 'absolute', left: g.vw / 2 - D / 2, top: g.cy - D / 2, width: D, height: D } as const;
  return (
    <Clip g={g} edges={edges}>
      {nope ? (
        <FxView style={[box, { opacity, transform: [{ scale }, { rotate: spin }] }]}><Rays size={D} color="#a8a29e" widthDeg={5} /></FxView>
      ) : (
        <>
          <FxView style={[box, { opacity, transform: [{ scale }, { rotate: back }] }]}><Rays size={D} color="#f59e0b" opacity={0.4} from={11.25} widthDeg={4} /></FxView>
          <FxView style={[box, { opacity, transform: [{ scale }, { rotate: spin }] }]}><Rays size={D} color={amber} widthDeg={8} /></FxView>
          <FxView style={{ position: 'absolute', left: g.vw / 2 - D * 0.3, top: g.cy - D * 0.3, opacity: ease(p), transform: [{ scale: range(p, 0.4, 1) }] }}>
            <Glow width={D * 0.6} height={D * 0.6} color="#fde68a" opacity={0.8} />
          </FxView>
        </>
      )}
    </Clip>
  );
}

export const CheapBurstFront = BurstFront;
