/**
 * The stage looks wall, burst, stamp, bleed, echo and glitch. Each has a back layer (behind the
 * card, clipped to the stage, window edge to edge) and/or a front layer (the word, above the card so
 * it stays legible on a phone where the card fills the width). Transform and opacity only; colors
 * and filters sit on static copies.
 */
import type { ReactNode } from 'react';
import { Animated, Easing, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fitTo, wordW, type Geo, type VoteWord } from './geometry';
import { Outline } from './Outline';
import { Glow, PosterCopy, Rays } from './shapes';
import { StampInk } from './StampInk';
import { Word } from './Word';
import { amber, cream, ease, fill, ink, jitter, pal, range, red, span, textGlow, web, webStyle, type LayerProps, type Node } from './paint';

/** The stage's word size: stage-wide on a phone, about two cards wide on desktop. */
export const bigSize = (g: Geo, text: VoteWord, f = 1) => Math.min(fitTo(text, (g.phone ? g.aw - 24 : Math.min(g.vw * 0.7, g.w * 2.1)) * f), g.h * 0.5);

const FADE = 'linear-gradient(to bottom, transparent 0, #000 6%, #000 94%, transparent 100%)';
/** Clipped, window-wide stage box with soft top and bottom edges on the web (back layers). */
export function Clip({ g, opacity, children }: { g: Geo; opacity?: Node; children: ReactNode }) {
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: -g.ext, top: 0, width: g.vw, height: g.stageH, overflow: 'hidden' }, webStyle({ WebkitMaskImage: FADE, maskImage: FADE }), opacity ? { opacity } : null]}>
      {children}
    </Animated.View>
  );
}
/** Window-wide, unclipped box for front words. */
export function Over({ g, children }: { g: Geo; children: ReactNode }) {
  return <View pointerEvents="none" style={{ position: 'absolute', left: -g.ext, top: 0, width: g.vw, height: g.stageH }}>{children}</View>;
}
/** A word box centered on the card in the Over box. */
export function At({ g, size, text, style, children }: { g: Geo; size: number; text: VoteWord; style?: object; children: ReactNode }) {
  const ww = wordW(text, size) * 1.04;
  return <Animated.View style={[{ position: 'absolute', left: g.vw / 2 - ww / 2, top: g.cy - size / 2, width: ww, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>{children}</Animated.View>;
}

// ————— wall —————
export function WallBack({ g, kind, p, loop, reduced }: LayerProps) {
  const P = pal(kind);
  const size = g.phone ? 50 : g.z(86);
  const rowH = size * 1.06;
  const rows = Math.ceil(g.stageH / rowH) + 1;
  const itemW = wordW(P.text, size) + size * 0.5;
  const count = Math.ceil(g.vw / itemW) + 4;
  const top0 = (g.stageH - rows * rowH) / 2 + size * 0.03;
  return (
    <Clip g={g} opacity={ease(p)}>
      <Animated.View style={[fill, { transform: [{ scale: range(p, 1.18, 1, Easing.out(Easing.quad)) }] }]}>
        {Array.from({ length: rows }, (_, r) => {
          const dir = r % 2 ? 1 : -1;
          const phase = ((r * 0.37) % 1) * itemW;
          const run = reduced ? -phase - itemW : loop.interpolate({ inputRange: [0, 1], outputRange: dir < 0 ? [-phase - itemW, -phase - 2 * itemW] : [-phase - 2 * itemW, -phase - itemW] });
          const slide = range(p, dir * itemW * 0.9, 0, Easing.out(Easing.cubic));
          return (
            <Animated.View key={r} style={{ position: 'absolute', left: 0, top: top0 + r * rowH, width: count * itemW, height: size, flexDirection: 'row', transform: [{ translateX: Animated.add(run, slide) }] }}>
              {r % 2
                ? <Outline text={P.text} size={size} color={P.main} width={g.phone ? 1.5 : 2.5} repeat={count} step={itemW} />
                : Array.from({ length: count }, (__, k) => <View key={k} style={{ width: itemW, flexShrink: 0, alignItems: 'center' }}><Word text={P.text} size={size} color={P.main} /></View>)}
            </Animated.View>
          );
        })}
      </Animated.View>
    </Clip>
  );
}

// ————— burst —————
export function BurstBack({ g, kind, p, loop, reduced }: LayerProps) {
  const D = Math.hypot(g.vw, g.stageH) * 1.25;
  const nope = kind === 'nope';
  const spin = reduced ? '0deg' : loop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '22.5deg'] });
  const back = reduced ? '0deg' : loop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-22.5deg'] });
  // Yep fans out and grows; Nope flashes a few cold rays that collapse to nothing.
  const opacity = nope ? p.interpolate({ inputRange: [0, 0.25, 0.9], outputRange: [0, 0.5, 0], extrapolate: 'clamp' }) : ease(p);
  const scale = nope ? range(p, 1, 0.04, Easing.in(Easing.quad)) : range(p, 0.3, 1, Easing.out(Easing.cubic));
  const box = { position: 'absolute', left: g.vw / 2 - D / 2, top: g.cy - D / 2, width: D, height: D } as const;
  return (
    <Clip g={g}>
      {nope ? (
        <Animated.View style={[box, { opacity, transform: [{ scale }, { rotate: spin }] }]}><Rays size={D} color="#a8a29e" widthDeg={5} /></Animated.View>
      ) : (
        <>
          <Animated.View style={[box, { opacity, transform: [{ scale }, { rotate: back }] }]}><Rays size={D} color="#f59e0b" opacity={0.4} from={11.25} widthDeg={4} /></Animated.View>
          <Animated.View style={[box, { opacity, transform: [{ scale }, { rotate: spin }] }]}><Rays size={D} color={amber} widthDeg={8} /></Animated.View>
          <Animated.View style={{ position: 'absolute', left: g.vw / 2 - D * 0.3, top: g.cy - D * 0.3, opacity: ease(p), transform: [{ scale: range(p, 0.4, 1) }] }}>
            <Glow width={D * 0.6} height={D * 0.6} color="#fde68a" opacity={0.8} />
          </Animated.View>
        </>
      )}
    </Clip>
  );
}
export function BurstFront({ g, kind, p, punch }: LayerProps) {
  const P = pal(kind);
  const size = bigSize(g, P.text, kind === 'nope' ? 1 : 0.92);
  const drop = Math.round(size * 0.06);
  if (kind === 'nope') {
    // A heavy drop from above, squashing on commit.
    return (
      <Over g={g}>
        <At g={g} size={size} text={P.text} style={{ opacity: span(p, 0.08, 0.4, 0, 1),
          transform: [{ translateY: span(p, 0.08, 1, -g.stageH * 0.5, 0, Easing.in(Easing.quad)) },
            { scaleY: punch.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] }) }, { scaleX: punch.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }}>
          <Word text={P.text} size={size} color="#f3f1ef" style={textGlow(`0 ${drop}px 0 ${P.deep}, 0 18px 50px #000000c0`, { color: P.deep, radius: 0, dy: drop })} />
        </At>
      </Over>
    );
  }
  return (
    <Over g={g}>
      <At g={g} size={size} text={P.text} style={{ opacity: span(p, 0, 0.3, 0, 1),
        transform: [{ scale: Animated.add(range(p, 0.25, 1, Easing.out(Easing.back(2.2))), punch.interpolate({ inputRange: [0, 1], outputRange: [0, 0.07] })) }, { rotate: '-5deg' }] }}>
        <Word text={P.text} size={size} color={P.hi} style={textGlow(`0 ${drop}px 0 ${P.deep}, 0 0 ${Math.round(size * 0.5)}px #fbbf2480, 0 14px 40px #00000099`, { color: P.deep, radius: 0, dy: drop })} />
      </At>
    </Over>
  );
}

// ————— stamp —————
export function StampFront({ g, kind, p }: LayerProps) {
  const P = pal(kind);
  const width = g.phone ? g.aw - 70 : Math.min(g.vw * 0.6, g.w * 1.8);
  const size = Math.min(fitTo(P.text, width * 0.74), g.h * 0.34);
  const border = Math.max(7, Math.round(size * 0.11));
  const boxW = wordW(P.text, size) + size * 0.26 * 2 + border * 2;
  const boxH = size + size * 0.2 * 2 + border * 2;
  const deg = kind === 'nope' ? 8 : -9;
  const color = kind === 'nope' ? red : P.main;
  return (
    <Over g={g}>
      {/* Mostly see-through while it flies in, solid as it lands. */}
      <Animated.View style={{ position: 'absolute', left: g.vw / 2 - boxW / 2, top: g.cy - boxH / 2, width: boxW, height: boxH,
        opacity: p.interpolate({ inputRange: [0, 0.5, 0.88, 1], outputRange: [0, 0.14, 0.32, 1], extrapolate: 'clamp' }),
        transform: [{ scale: range(p, 3, 1, Easing.in(Easing.quad)) }, { rotate: p.interpolate({ inputRange: [0, 1], outputRange: [`${deg * 2.2}deg`, `${deg}deg`], extrapolate: 'clamp' }) }] }}>
        {/* The stamp's shadow on the stage. */}
        <View style={{ position: 'absolute', left: -size * 0.2, top: -size * 0.14, transform: [{ translateY: size * 0.06 }] }}>
          <Glow width={boxW + size * 0.4} height={boxH + size * 0.28} color="#000" opacity={0.4} />
        </View>
        <StampInk text={P.text} size={size} color={color} border={border} width={boxW} height={boxH} />
      </Animated.View>
    </Over>
  );
}

// ————— bleed —————
export function BleedBack({ g, kind, p, posterUrl }: LayerProps) {
  const W = Math.max(g.vw, g.stageH / 1.5) * 1.2;
  const H = W * 1.5;
  const nope = kind === 'nope';
  return (
    <Clip g={g} opacity={ease(p)}>
      <Animated.View style={{ position: 'absolute', left: (g.vw - W) / 2, top: g.cy - H / 2, width: W, height: H, backgroundColor: web && posterUrl ? undefined : nope ? '#3a3a3a' : '#5c4310', transform: [{ scale: range(p, 1.14, 1, Easing.out(Easing.quad)) }] }}>
        <PosterCopy uri={posterUrl} css={nope ? 'blur(48px) grayscale(1) brightness(1.1)' : 'blur(48px) grayscale(1) contrast(0.9) brightness(1.7)'} blur={40}
          tints={nope ? [{ color: '#1a1a1a', opacity: 0.5 }, { color: red, opacity: 0.42 }] : [{ color: '#2a1c00', opacity: 0.25 }, { color: amber, opacity: 0.6 }]} />
        {web ? <View style={[fill, webStyle({ backgroundColor: nope ? red : amber, mixBlendMode: 'multiply' })]} /> : null}
        <View style={[fill, { backgroundColor: nope ? '#7f1d1d' : '#f59e0b', opacity: nope ? 0.35 : 0.28 }]} />
      </Animated.View>
      <LinearGradient colors={nope ? ['#00000080', '#00000020', '#000000a0'] : ['#20140080', '#20140000', '#201400a0']} locations={[0, 0.5, 1]} style={fill} />
    </Clip>
  );
}
export function BleedFront({ g, kind, p, punch }: LayerProps) {
  const P = pal(kind);
  const size = bigSize(g, P.text, 1.05);
  return (
    <Over g={g}>
      <At g={g} size={size} text={P.text} style={{ opacity: ease(p), transform: [{ scale: Animated.add(range(p, 0.82, 1, Easing.out(Easing.cubic)), punch.interpolate({ inputRange: [0, 1], outputRange: [0, 0.05] })) }] }}>
        <Word text={P.text} size={size} color={kind === 'nope' ? '#e9e6e3' : '#fffaf0'}
          style={kind === 'nope' ? textGlow('0 10px 50px #000000d0', { color: '#000000d0', radius: 30, dy: 10 }) : textGlow(`0 6px 0 ${ink}55, 0 10px 50px #000000b0`, { color: `${ink}88`, radius: 2, dy: 6 })} />
      </At>
    </Over>
  );
}

// ————— echo —————
const TRAIL = [0, 0.75, 0.52, 0.34, 0.2, 0.1];
export function EchoFront({ g, kind, p, punch }: LayerProps) {
  const P = pal(kind);
  const size = bigSize(g, P.text, g.phone ? 0.78 : 0.62);
  const step = wordW(P.text, size) * (g.phone ? 0.34 : 0.4);
  const out = Easing.out(Easing.cubic);
  const trail = (dir: number) => Array.from({ length: TRAIL.length - 1 }, (_, j) => {
    const k = TRAIL.length - 1 - j; // far copies first, so nearer ones paint on top
    return (
      <At key={`${dir}${k}`} g={g} size={size} text={P.text} style={{ opacity: range(p, 0, TRAIL[k]), transform: [{ translateX: range(p, 0, dir * k * step, out) }, { scale: 1 - k * 0.04 }] }}>
        {k === 1 ? <Word text={P.text} size={size} color={P.deep} /> : <Outline text={P.text} size={size} color={P.main} width={g.phone ? 1.5 : 2.5} />}
      </At>
    );
  });
  const dir = kind === 'nope' ? -1 : 1;
  return (
    <Over g={g}>
      {kind === 'match' ? <>{trail(-1)}{trail(1)}</> : trail(dir)}
      <At g={g} size={size} text={P.text} style={{ opacity: ease(p), transform: [{ translateX: range(p, 0, kind === 'match' ? 0 : -dir * step * 0.6, out) }, { scale: Animated.add(range(p, 0.8, 1), punch.interpolate({ inputRange: [0, 1], outputRange: [0, 0.06] })) }] }}>
        <Word text={P.text} size={size} color={kind === 'nope' ? cream : P.main} style={textGlow(`0 0 ${Math.round(size * 0.3)}px ${P.soft}, 0 10px 36px #000000c0`, { color: '#000000c0', radius: 20, dy: 8 })} />
      </At>
    </Over>
  );
}

// ————— glitch —————
export function GlitchBack({ g, kind, p, loop, reduced }: LayerProps) {
  const P = pal(kind);
  const bands = [[0.12, 0.05, P.main, 0.55], [0.24, 0.018, '#ffffff', 0.5], [0.4, 0.09, P.deep, 0.5], [0.58, 0.03, red, 0.6], [0.7, 0.012, '#ffffff', 0.7], [0.83, 0.06, P.main, 0.4]] as const;
  return (
    <Clip g={g} opacity={ease(p)}>
      {bands.map(([y, hh, color, o], k) => (
        <Animated.View key={k} style={{ position: 'absolute', left: -g.vw * 0.2, width: g.vw * 1.4, top: y * g.stageH, height: Math.max(3, hh * g.stageH), opacity: o,
          transform: [{ translateX: jitter(loop, p, reduced, 11 + k * 7, g.vw * 0.25, 0.3) }, { scaleX: range(p, 0.2, 1) }] }}>
          <LinearGradient start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} colors={[`${color}00`, color, color, `${color}00`]} locations={[0, 0.3, 0.7, 1]} style={fill} />
        </Animated.View>
      ))}
    </Clip>
  );
}
export function GlitchFront({ g, kind, p, loop, reduced, punch }: LayerProps) {
  const P = pal(kind);
  const size = bigSize(g, P.text, 0.9);
  const main = kind === 'nope' ? cream : P.main;
  const [c1, c2] = kind === 'nope' ? [red, amber] : [red, '#ffffff'];
  const d = size * 0.045;
  const ww = wordW(P.text, size) * 1.04;
  const j = (seed: number, amp: number, sparse = 0) => jitter(loop, p, reduced, seed, amp, sparse);
  // The split copies add light on the web (screen blend); native has no blend, so they sit a little dimmer.
  const copy = (color: string, dx: number, seed: number) => (
    <Animated.View style={[fill, { alignItems: 'center', justifyContent: 'center', opacity: web ? 0.9 : 0.75, transform: [{ translateX: Animated.add(range(p, 0, dx), j(seed, d * 0.8)) }, { translateY: j(seed + 1, d * 0.4) }] }, webStyle({ mixBlendMode: 'screen' })]}>
      <Word text={P.text} size={size} color={color} />
    </Animated.View>
  );
  // Two slices of the word that tear sideways now and then.
  const slice = (y0: number, y1: number, seed: number) => (
    <Animated.View style={{ position: 'absolute', left: 0, width: ww, top: y0 * size, height: (y1 - y0) * size, overflow: 'hidden', transform: [{ translateX: j(seed, size * 0.16, 0.55) }] }}>
      <View style={{ position: 'absolute', left: 0, width: ww, top: -y0 * size, height: size, alignItems: 'center', justifyContent: 'center' }}><Word text={P.text} size={size} color={main} /></View>
    </Animated.View>
  );
  return (
    <Over g={g}>
      <At g={g} size={size} text={P.text} style={{ opacity: ease(p), transform: [{ scale: Animated.add(range(p, 0.9, 1), punch.interpolate({ inputRange: [0, 1], outputRange: [0, 0.05] })) }] }}>
        <View style={{ position: 'absolute', left: -size * 0.3, top: -size * 0.1 }}><Glow width={ww + size * 0.6} height={size * 1.2} color="#000" opacity={0.5} /></View>
        {copy(c1, -d, 3)}
        {copy(c2, d, 5)}
        <Animated.View style={[fill, { alignItems: 'center', justifyContent: 'center', transform: [{ translateX: j(9, d * 0.3) }] }]}><Word text={P.text} size={size} color={main} /></Animated.View>
        {slice(0.18, 0.34, 21)}
        {slice(0.6, 0.72, 27)}
      </At>
    </Over>
  );
}
