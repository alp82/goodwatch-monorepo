/**
 * Stage layers of giant, split and neon, driven by the stage drive (which lingers a beat after a
 * commit): behind the card (giant's edge glow, split's panels) and in front of it (giant's words,
 * split's phone strip, the neon sign).
 */
import { FxView } from './fx-view';
import { Animated, Easing, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fitTo, wordW, type VoteWord } from './geometry';
import { Outline } from './Outline';
import { Glow } from './shapes';
import { Word } from './Word';
import { amber, cream, ease, fill, ink, red, span, textGlow, type LayerProps } from './paint';

/** A word turned on its side, centered on (cx, cy). */
function Vertical({ text, size, color, deg, cx, cy }: { text: VoteWord; size: number; color: string; deg: number; cx: number; cy: number }) {
  const ww = wordW(text, size) * 1.04;
  return (
    <View style={{ position: 'absolute', left: cx - ww / 2, top: cy - size / 2, width: ww, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${deg}deg` }] }}>
      <Word text={text} size={size} color={color} />
    </View>
  );
}
const yepColors = [amber, '#f59e0b', '#b45309'] as const;
const nopeColors = ['#f87171', red, '#7f1d1d'] as const;

export function GiantBack({ g, kind, p }: LayerProps) {
  const left = kind === 'nope';
  const color = left ? red : amber;
  return (
    <FxView pointerEvents="none" style={{ position: 'absolute', top: -g.cardTop - 40, height: g.stageH + 200, width: Math.max(160, g.vw * 0.22), [left ? 'left' : 'right']: -g.ext, opacity: p }}>
      <LinearGradient start={{ x: left ? 0 : 1, y: 0.5 }} end={{ x: left ? 1 : 0, y: 0.5 }} colors={[`${color}55`, `${color}14`, `${color}00`]} style={fill} />
    </FxView>
  );
}

/** The outline draws in first, then the word fills solid and grows; on a phone it spans the window. */
export function GiantFront({ g, kind, p, punch }: LayerProps) {
  const left = kind === 'nope';
  const text: VoteWord = left ? 'NOPE' : 'YEP';
  const color = left ? red : amber;
  if (g.phone) {
    const width = g.vw - 20;
    const size = fitTo(text, width);
    return (
      <FxView pointerEvents="none" style={{ position: 'absolute', left: -g.ext + 10, width, top: g.cy - size / 2, alignItems: 'center',
        transform: [{ scale: Animated.add(span(p, 0, 1, 0.86, 1), punch.interpolate({ inputRange: [0, 1], outputRange: [0, 0.06] })) }] }}>
        <FxView style={{ position: 'absolute', opacity: p.interpolate({ inputRange: [0, 0.35, 0.9, 1], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' }) }}><Outline text={text} size={size} color={color} width={2.5} /></FxView>
        <FxView style={{ opacity: span(p, 0.6, 1, 0, 1) }}>
          <Word text={text} size={size} color={color} style={textGlow('0 8px 40px #000000b0', { color: '#000000b0', radius: 24, dy: 8 })} />
        </FxView>
      </FxView>
    );
  }
  const side = (g.vw - g.w) / 2;
  const inner = g.z(36);
  const outer = g.z(28);
  const width = Math.max(0, (side - inner - outer) * 0.92);
  const size = Math.min(fitTo(text, width), g.h * 0.5);
  const x0 = left ? -g.ext + outer + width * 0.04 : g.aw / 2 + g.w / 2 + inner;
  return (
    <FxView pointerEvents="none" style={{ position: 'absolute', left: x0, width, top: g.cy - size / 2, height: size, alignItems: left ? 'flex-end' : 'flex-start', justifyContent: 'center',
      transform: [{ scale: Animated.add(span(p, 0, 1, 0.82, 1.08), punch.interpolate({ inputRange: [0, 1], outputRange: [0, 0.04] })) }] }}>
      <FxView style={{ position: 'absolute', opacity: p.interpolate({ inputRange: [0, 0.3, 0.8, 1], outputRange: [0, 0.9, 0.5, 0], extrapolate: 'clamp' }) }}><Outline text={text} size={size} color={color} width={2} /></FxView>
      <FxView style={{ opacity: span(p, 0.25, 1, 0, 1) }}>
        <Word text={text} size={size} color={color} style={textGlow(`0 0 ${Math.round(size * 0.35)}px ${left ? '#ffffff22' : '#fbbf2455'}`, { color: left ? '#ef444455' : '#fbbf2466', radius: Math.round(size * 0.2) })} />
      </FxView>
    </FxView>
  );
}

/** The stage half you drag toward slides in from its window edge and lights up. */
export function SplitBack({ g, kind, p }: LayerProps) {
  const yes = kind !== 'nope';
  const half = g.vw / 2;
  const seam = g.phone ? 3 : 5;
  const gutter = (g.vw - g.w) / 2;
  const text: VoteWord = yes ? 'YEP' : 'NOPE';
  const size = Math.min(gutter * 0.48, fitTo(text, g.stageH * 0.84));
  return (
    <FxView pointerEvents="none" style={{ position: 'absolute', top: 0, height: g.stageH, width: half - seam, left: yes ? -g.ext + half + seam : -g.ext, opacity: ease(p),
      transform: [{ translateX: span(p, 0, 1, yes ? half * 0.3 : -half * 0.3, 0, Easing.out(Easing.cubic)) }] }}>
      <View style={{ ...fill, overflow: 'hidden', [yes ? 'borderTopLeftRadius' : 'borderTopRightRadius']: 18, [yes ? 'borderBottomLeftRadius' : 'borderBottomRightRadius']: 18 }}>
        <LinearGradient start={{ x: yes ? 0 : 1, y: 0 }} end={{ x: yes ? 1 : 0, y: 1 }} colors={yes ? yepColors : nopeColors} locations={[0, 0.5, 1]} style={fill} />
      </View>
      {!g.phone && size > 40 ? <Vertical text={text} size={size} color={yes ? ink : cream} deg={yes ? 90 : -90} cx={yes ? half - seam - gutter * 0.3 : gutter * 0.3} cy={g.stageH / 2} /> : null}
    </FxView>
  );
}

/** Phone: the card fills the width, so the lit edge slides in over it as a strip with the word. */
export function SplitFront({ g, kind, p }: LayerProps) {
  if (!g.phone) return null;
  const yes = kind !== 'nope';
  const sw = 86;
  const text: VoteWord = yes ? 'YEP' : 'NOPE';
  const size = Math.min(sw * 0.86, fitTo(text, g.stageH * 0.8));
  return (
    <FxView pointerEvents="none" style={{ position: 'absolute', top: 0, height: g.stageH, width: sw, left: yes ? g.aw + g.ext - sw : -g.ext, opacity: span(p, 0, 0.25, 0, 1),
      boxShadow: '0 0 40px #00000099', transform: [{ translateX: span(p, 0, 1, yes ? sw : -sw, 0, Easing.out(Easing.cubic)) }] }}>
      <LinearGradient colors={yes ? yepColors : nopeColors} style={fill} />
      <Vertical text={text} size={size} color={yes ? ink : cream} deg={yes ? 90 : -90} cx={sw / 2} cy={g.stageH / 2} />
    </FxView>
  );
}

/** A neon sign over the top of the card: the tube warms up as you drag and flickers on at the threshold. */
export function NeonFront({ g, kind, p, lit }: LayerProps) {
  const yes = kind !== 'nope';
  const text: VoteWord = yes ? 'YEP' : 'NOPE';
  const color = yes ? amber : red;
  const core = yes ? '#fff8e6' : '#fff1ee';
  const size = Math.min(fitTo(text, g.phone ? g.aw * 0.74 : Math.min(g.w * 1.4, g.vw * 0.5)), g.h * 0.3);
  const ww = wordW(text, size) * 1.04;
  // The unlit tube warms up with the drag and goes dark the moment the sign lights.
  const tube = Animated.multiply(span(p, 0, 0.97, 0, 0.85, Easing.in(Easing.quad)), span(p, 0.97, 0.98, 1, 0));
  return (
    <FxView pointerEvents="none" style={{ position: 'absolute', left: g.aw / 2 - ww / 2, top: g.cardTop + g.h * 0.24 - size / 2, width: ww, height: size, alignItems: 'center', justifyContent: 'center',
      transform: [{ scale: span(p, 0, 1, 0.88, 1) }] }}>
      {/* A dark wall behind the tube so it reads on any poster. */}
      <FxView style={{ position: 'absolute', left: -size * 0.7, top: -size * 0.6, opacity: Animated.multiply(ease(p), 0.85) }}>
        <Glow width={ww + size * 1.4} height={size * 2.2} color="#0b0806" />
      </FxView>
      <FxView style={{ position: 'absolute', left: -size * 0.5, top: -size * 0.45, opacity: Animated.multiply(lit, 0.55) }}>
        <Glow width={ww + size} height={size * 1.9} color={color} />
      </FxView>
      <FxView style={{ position: 'absolute', opacity: tube }}><Outline text={text} size={size} color={color} width={g.phone ? 1.5 : 2.5} /></FxView>
      <FxView style={{ position: 'absolute', opacity: lit }}>
        <Word text={text} size={size} color={core}
          style={textGlow(`0 0 ${size * 0.04}px #fff, 0 0 ${size * 0.1}px ${color}, 0 0 ${size * 0.22}px ${color}, 0 0 ${size * 0.45}px ${color}`, { color, radius: Math.round(size * 0.18) })} />
      </FxView>
    </FxView>
  );
}
