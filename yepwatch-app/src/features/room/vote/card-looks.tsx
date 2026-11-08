/**
 * Layers on the card itself, driven by the card's own drag so the next card arrives clean:
 * the halo around it (filter, neon), the treated poster copies under the title gradient (wash,
 * filter) and the words and bands over it (wash, filter, neon).
 */
import { Animated, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fitTo } from './geometry';
import { PosterCopy } from './shapes';
import { Word } from './Word';
import { amber, clampI, cream, fill, ink, red, webStyle, type A, type Kind, type Node } from './paint';
import type { Look } from './looks';

export interface CardLayerProps {
  look: Look;
  kind: Exclude<Kind, 'match'>;
  w: number;
  h: number;
  phone: boolean;
  x: Animated.Value;
  /** 0 at rest → 1 at the threshold. */
  p: A;
  punch: A;
  lit: A;
  posterUrl: string | null;
}

/** Glow around the card: filter's amber halo on Yep, neon's sign color once lit. */
export function CardGlow({ look, kind, w, h, p, lit }: CardLayerProps) {
  if (look !== 'filter' && look !== 'neon') return null;
  if (look === 'filter' && kind === 'nope') return null;
  const color = kind === 'yep' ? amber : red;
  const radius = Math.round(w * (look === 'filter' ? 0.16 : 0.1));
  const opacity: Node = look === 'filter' ? p : Animated.multiply(lit, p);
  return (
    <Animated.View pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, borderRadius: 14, backgroundColor: color, opacity, boxShadow: `0 0 ${radius}px ${Math.round(radius * 0.35)}px ${color}` }} />
  );
}

/** The poster's treated copies, cross-faded with opacity (under the title gradient). */
export function CardUnder({ look, kind, p, posterUrl }: CardLayerProps) {
  const yes = kind === 'yep';
  if (look === 'wash') return (
    <Animated.View pointerEvents="none" style={[fill, { opacity: p }]}>
      <PosterCopy uri={posterUrl} css={yes ? 'grayscale(1) contrast(1.25) brightness(1.1)' : 'grayscale(1) contrast(1.2) brightness(0.95)'}
        tints={yes ? [{ color: '#140c00', opacity: 0.3 }, { color: amber, opacity: 0.5 }] : [{ color: '#0d0d0d', opacity: 0.5 }, { color: red, opacity: 0.42 }]} />
      <View style={[fill, webStyle({ backgroundColor: yes ? amber : red, mixBlendMode: 'multiply' })]} />
      <LinearGradient pointerEvents="none" style={fill} locations={[0.18, 0.36, 0.5, 0.64, 0.82]}
        colors={yes ? ['#fbbf2400', '#fbbf24cc', '#fbbf24ee', '#fbbf24cc', '#fbbf2400'] : ['#dc262600', '#b91c1ccc', '#991b1bee', '#b91c1ccc', '#dc262600']} />
    </Animated.View>
  );
  if (look === 'filter') return yes ? (
    <Animated.View pointerEvents="none" style={[fill, { opacity: p }]}>
      <PosterCopy uri={posterUrl} css="saturate(1.8) brightness(1.12) sepia(0.28) contrast(1.06)" tints={[{ color: '#ff9f1a', opacity: 0.2 }, { color: '#fff1d0', opacity: 0.06 }]} />
    </Animated.View>
  ) : (
    <Animated.View pointerEvents="none" style={[fill, { opacity: p, backgroundColor: '#000' }]}>
      <PosterCopy uri={posterUrl} css="grayscale(1) blur(4px) brightness(0.5)" blur={6} tints={[{ color: '#141414', opacity: 0.45 }, { color: '#000', opacity: 0.3 }]} style={{ transform: [{ scale: 1.08 }] }} />
    </Animated.View>
  );
  return null;
}

/** Words on the card (wash), the stamp band across it (filter), the neon edge line. */
export function CardOver({ look, kind, w, h, x, phone, p, punch, lit }: CardLayerProps) {
  const yes = kind === 'yep';
  const text = yes ? 'YEP' : 'NOPE';
  // The word holds still while the card leaves (counter-shift), so it stays readable on a phone.
  const shift = x.interpolate({ inputRange: [-w, w], outputRange: phone ? [w * 0.45, -w * 0.45] : [0, 0], ...clampI });
  if (look === 'wash') {
    const size = fitTo(text, w * (phone ? 0.76 : 0.86));
    return (
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: h * 0.44 - size / 2, alignItems: 'center', opacity: p,
        transform: [{ translateX: shift }, { scale: Animated.add(p.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }), punch.interpolate({ inputRange: [0, 1], outputRange: [0, 0.07] })) }] }}>
        <Word text={text} size={size} color={yes ? ink : cream} />
      </Animated.View>
    );
  }
  if (look === 'filter') {
    const bandH = h * 0.2;
    const len = Math.hypot(w, h) * 1.2;
    const deg = yes ? -14 : 14;
    const size = Math.min(((bandH * 0.86) / 0.68) * 0.8, fitTo(text, w * (phone ? 0.66 : 0.78)));
    return (
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: (w - len) / 2, top: h * 0.42 - bandH / 2, width: len, height: bandH, opacity: p,
        transform: [{ rotate: `${deg}deg` }, { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [yes ? -w * 0.5 : w * 0.5, 0] }) }, { scale: punch.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }}>
        <View style={{ ...fill, backgroundColor: yes ? amber : red, borderTopWidth: 3, borderBottomWidth: 3, borderColor: '#00000040', boxShadow: '0 10px 30px #00000080', alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={{ transform: [{ translateX: shift }] }}><Word text={text} size={size} color={yes ? ink : cream} /></Animated.View>
        </View>
      </Animated.View>
    );
  }
  if (look === 'neon') {
    return <Animated.View pointerEvents="none" style={[fill, { borderRadius: 14, borderWidth: 2, borderColor: yes ? '#ffe6a8' : '#ffd0d0', opacity: Animated.multiply(lit, p) }]} />;
  }
  return null;
}
