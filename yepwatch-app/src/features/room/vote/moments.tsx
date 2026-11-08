/**
 * The match moment: a Yep that makes a match shows MATCH in the look of the card that made it, for
 * about a second. `a` runs 0 → 1 (in) → 2 (out).
 */
import { Animated, Image, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fitTo, EM, type Geo } from './geometry';
import { At, Over, bigSize } from './fx-looks';
import { BackLayer, FrontLayer } from './layers';
import { Glow, PosterCopy } from './shapes';
import { Word } from './Word';
import { amber, fill, hidden, ink, same, textGlow, webStyle, type LayerProps } from './paint';
import type { Look } from './looks';

export interface MomentProps {
  look: Look;
  g: Geo;
  posterUrl: string | null;
  a: Animated.Value;
  loop: Animated.Value;
  reduced: boolean;
}

function Poster({ uri }: { uri: string | null }) {
  return uri ? <Image source={{ uri }} accessible={false} resizeMode="cover" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }} /> : <View style={[fill, { backgroundColor: '#1a1610' }]} />;
}

export function Moment(props: MomentProps) {
  return <View {...hidden} style={fill}>{['wash', 'filter', 'giant', 'split', 'neon'].includes(props.look) ? <ClassicMoment {...props} /> : <FxMoment {...props} />}</View>;
}

/** wash, filter, giant, split and neon. */
function ClassicMoment({ look, g, posterUrl, a, reduced }: MomentProps) {
  const inOut = a.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] });
  const scale = reduced ? 1 : a.interpolate({ inputRange: [0, 1, 2], outputRange: [0.7, 1, 1.08] });
  const full = g.vw;
  const size = fitTo('MATCH', look === 'giant' ? full - (g.phone ? 20 : g.z(80)) : Math.min(full - 24, g.phone ? full : g.w * 1.5));
  const s = Math.min(size, g.h * 0.42);
  const posterW = g.w * 0.62;
  const left = -g.ext;
  if (look === 'wash' || look === 'filter') {
    const pw = look === 'wash' ? g.w * 0.9 : posterW;
    const ms = fitTo('MATCH', pw * 0.86);
    return (
      <Animated.View style={{ position: 'absolute', left, width: full, top: 0, height: g.stageH, alignItems: 'center', opacity: inOut }}>
        <Animated.View style={{ position: 'absolute', top: g.cardTop + (g.h - pw * 1.5) / 2, width: pw, height: pw * 1.5, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1a1610', transform: [{ scale }, { rotate: look === 'wash' ? '0deg' : '-4deg' }] }}>
          {look === 'wash' ? (
            <>
              <PosterCopy uri={posterUrl} css="grayscale(1) contrast(1.25) brightness(1.1)" tints={[{ color: '#140c00', opacity: 0.3 }, { color: amber, opacity: 0.5 }]} />
              <View style={[fill, webStyle({ backgroundColor: amber, mixBlendMode: 'multiply' })]} />
              <LinearGradient colors={['#fbbf2400', '#fbbf24dd', '#fbbf24f5', '#fbbf24dd', '#fbbf2400']} locations={[0.2, 0.37, 0.5, 0.63, 0.8]} style={fill} />
              <View style={{ position: 'absolute', left: 0, right: 0, top: pw * 0.75 - ms / 2, alignItems: 'center' }}><Word text="MATCH" size={ms} color={ink} /></View>
            </>
          ) : <PosterCopy uri={posterUrl} css="saturate(1.8) brightness(1.12) sepia(0.28)" tints={[{ color: '#ff9f1a', opacity: 0.2 }]} />}
        </Animated.View>
        {look === 'filter' ? (
          <Animated.View style={{ position: 'absolute', top: g.cy - s * 0.75, left: -full * 0.1, width: full * 1.2, height: s * 1.5, backgroundColor: amber, alignItems: 'center', justifyContent: 'center',
            transform: [{ rotate: '-8deg' }, { translateX: reduced ? 0 : a.interpolate({ inputRange: [0, 1, 2], outputRange: [-full * 0.6, 0, full * 0.3] }) }] }}>
            <Word text="MATCH" size={s} color={ink} />
          </Animated.View>
        ) : null}
      </Animated.View>
    );
  }
  if (look === 'giant') return (
    <Animated.View style={{ position: 'absolute', left, width: full, top: g.cy - s / 2, height: s, alignItems: 'center', opacity: inOut, transform: [{ scale }] }}>
      <Word text="MATCH" size={s} color={amber} style={textGlow('0 0 80px #fbbf2466, 0 10px 40px #000000c0', { color: '#fbbf2466', radius: 40 })} />
    </Animated.View>
  );
  if (look === 'split') {
    // The whole stage lights amber, the poster sits low, MATCH above it.
    const room = g.cardTop + g.h - posterW * 1.5;
    const ms = Math.min(fitTo('MATCH', g.phone ? g.aw - 32 : Math.min(full * 0.6, g.w * 1.6)), room * 0.62);
    return (
      <Animated.View style={{ position: 'absolute', left, width: full, top: 0, height: g.stageH, alignItems: 'center', opacity: inOut }}>
        <LinearGradient colors={[amber, '#f59e0b', '#b45309']} locations={[0, 0.55, 1]} style={fill} />
        <Animated.View style={{ position: 'absolute', top: g.cardTop + g.h - posterW * 1.5, width: posterW, height: posterW * 1.5, borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 60px #00000080', transform: [{ scale }] }}><Poster uri={posterUrl} /></Animated.View>
        <Animated.View style={{ position: 'absolute', top: g.cardTop + room / 2 - ms / 2, transform: [{ scale }] }}><Word text="MATCH" size={ms} color={ink} /></Animated.View>
      </Animated.View>
    );
  }
  // neon: the poster, and a MATCH sign over its top.
  const ns = Math.min(fitTo('MATCH', g.phone ? g.aw * 0.8 : Math.min(g.w * 1.5, full * 0.55)), g.h * 0.24);
  const flick = a.interpolate({ inputRange: [0, 0.15, 0.3, 0.45, 1, 1.8, 2], outputRange: [0, 1, 0.3, 1, 1, 1, 0] });
  const sw = EM.MATCH * ns * 1.1;
  return (
    <Animated.View style={{ position: 'absolute', left, width: full, top: 0, height: g.stageH, alignItems: 'center' }}>
      <Animated.View style={{ position: 'absolute', top: g.cy - posterW * 0.75, width: posterW, height: posterW * 1.5, borderRadius: 14, overflow: 'hidden', opacity: inOut, boxShadow: '0 0 60px #fbbf2455, 0 20px 60px #00000080', transform: [{ scale }] }}><Poster uri={posterUrl} /></Animated.View>
      <Animated.View style={{ position: 'absolute', top: g.cardTop + g.h * 0.2 - ns / 2, height: ns, width: sw, alignItems: 'center', justifyContent: 'center', opacity: flick }}>
        <View style={{ position: 'absolute', left: -ns * 0.6, top: -ns * 0.6 }}><Glow width={sw + ns * 1.2} height={ns * 2.2} color="#0b0806" opacity={0.85} /></View>
        <View style={{ position: 'absolute', left: -ns * 0.3, top: -ns * 0.35 }}><Glow width={sw + ns * 0.6} height={ns * 1.7} color={amber} opacity={0.5} /></View>
        <Word text="MATCH" size={ns} color="#fff8e6" style={textGlow(`0 0 ${ns * 0.04}px #fff, 0 0 ${ns * 0.1}px ${amber}, 0 0 ${ns * 0.22}px ${amber}, 0 0 ${ns * 0.45}px ${amber}`, { color: amber, radius: Math.round(ns * 0.18) })} />
      </Animated.View>
    </Animated.View>
  );
}

/** wall, burst, stamp, bleed, echo and glitch: the look's back layer, the matched poster, the look's MATCH. */
function FxMoment({ look, g, posterUrl, a, loop, reduced }: MomentProps) {
  const p = a.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] });
  const zero = a.interpolate({ inputRange: [0, 1], outputRange: [0, 0] });
  const pw = g.w * 0.62;
  const fx: LayerProps = { look, g, kind: 'match', p, loop, punch: zero, lit: zero, x: a, posterUrl, reduced };
  const grow = reduced ? 1 : a.interpolate({ inputRange: [0, 1, 2], outputRange: [0.7, 1, 1.06] });
  const ms = bigSize(g, 'MATCH', 0.9);
  return (
    <>
      <Animated.View style={{ position: 'absolute', left: -g.ext, top: 0, width: g.vw, height: g.stageH, backgroundColor: '#070707', opacity: Animated.multiply(p, 0.82) }} />
      <BackLayer {...fx} />
      <Animated.View style={{ position: 'absolute', left: (g.aw - pw) / 2, top: g.cy - pw * 0.75, width: pw, height: pw * 1.5, borderRadius: 14, overflow: 'hidden', opacity: p, boxShadow: '0 24px 70px #000000a0', transform: [{ scale: grow }] }}>
        <Poster uri={posterUrl} />
      </Animated.View>
      {look === 'wall' ? (
        <Over g={g}>
          <At g={g} size={ms} text="MATCH" style={{ opacity: same(p), transform: [{ scale: reduced ? 1 : a.interpolate({ inputRange: [0, 1, 2], outputRange: [0.7, 1, 1.05] }) }] }}>
            <View style={{ backgroundColor: amber, paddingHorizontal: 18, borderRadius: 12 }}><Word text="MATCH" size={ms} color={ink} /></View>
          </At>
        </Over>
      ) : <FrontLayer {...fx} />}
    </>
  );
}
