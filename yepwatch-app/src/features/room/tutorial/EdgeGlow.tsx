/**
 * The first-round how-to's feedback on the card (while it runs the random looks are off): it sits on the
 * card, moves and tilts with it, and is driven by the card's x only. Layers mounted once that only fade
 * and move (transform and opacity, nothing resized or blurred per frame): a glow rises from the edge the
 * card leans to, the card's rim lights, the word slides in from that side letter by letter, and a
 * "Swipe right" / "Drag right" hint shows under it.
 */
import { useMemo } from 'react';
import { Animated, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GText, Icon, glow } from '../../glow/theme';
import { wordW } from '../vote/geometry';
import { Word } from '../vote/Word';

const clamp = { extrapolate: 'clamp' } as const;
const fill = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const;
const RED = '#ef4444';
const RED_TEXT = '#f87171';
const DIM = '#0a0806';

/** One side's strength, 0 to 1, from `a` to `b` thresholds of the card's lean that way. */
export function ramp(x: Animated.Value, T: number, yes: boolean, a: number, b: number) {
  return yes
    ? x.interpolate({ inputRange: [T * a, T * b], outputRange: [0, 1], ...clamp })
    : x.interpolate({ inputRange: [-T * b, -T * a], outputRange: [1, 0], ...clamp });
}
/**
 * The content holds still against the card's move (most on touch, where the card leaves the screen), but
 * only up to `room`: the slack between the word's row and the poster's inner edge. Past that it rides with
 * the card, so the row never crosses the poster's clip.
 */
function counter(x: Animated.Value, yes: boolean, room: number, touch: boolean) {
  const k = touch ? 0.5 : 0.22;
  const at = Math.max(1, room / k);
  return yes
    ? x.interpolate({ inputRange: [0, at], outputRange: [0, -room], ...clamp })
    : x.interpolate({ inputRange: [-at, 0], outputRange: [room, 0], ...clamp });
}

const wordOf = (yes: boolean) => (yes ? 'YEP' : 'NOPE');
/** The word row's width in font sizes: the word, the gap (0.08) and the arrow (0.45). */
const rowEm = (yes: boolean) => wordW(wordOf(yes), 1) + 0.08 + 0.45;
/** How much of the poster's inner width the widest row (NOPE) fills at rest; the rest is counter travel. */
const FILL = 0.76;

/** The gesture under the word: "Swipe right" (touch) or "Drag right". */
function Hint({ yes, touch, size }: { yes: boolean; touch: boolean; size: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(10,9,8,0.72)', borderWidth: 1, borderColor: '#ffffff2e' }}>
      {yes ? null : <Icon name="left" size={size} color={glow.ink} />}
      <GText bold size={size} color={glow.ink}>{`${touch ? 'Swipe' : 'Drag'} ${yes ? 'right' : 'left'}`}</GText>
      {yes ? <Icon name="right" size={size} color={glow.ink} /> : null}
    </View>
  );
}

/** `T`: the answer threshold (px); `w`, `h`: the card; `touch`: say Swipe instead of Drag. */
export function EdgeGlow({ x, T, w, h, touch }: { x: Animated.Value; T: number; w: number; h: number; touch: boolean }) {
  // Sized from the poster: NOPE's whole row (word, gap, arrow) fills FILL of the width inside the padding,
  // so it fits with margin and leaves slack for the counter-move (YEP is narrower and gets more).
  const pad = Math.max(14, w * 0.06);
  const inner = Math.max(0, w - 2 * pad);
  const word = Math.min(96, (inner * FILL) / rowEm(false));
  const hintSize = Math.min(15, Math.max(12, w * 0.045));
  const layers = useMemo(() => {
    const side = (yes: boolean) => {
      const shift = counter(x, yes, Math.max(0, (inner - rowEm(yes) * word) / 2), touch);
      const color = yes ? glow.amber : RED;
      const glowO = ramp(x, T, yes, 0.04, 1);
      const rim = ramp(x, T, yes, 0.45, 1);
      const from = (yes ? 1 : -1) * w * 0.6;
      const letters = wordOf(yes).split('');
      return (
        <View key={yes ? 'edge-yep' : 'edge-nope'} pointerEvents="none" style={fill}>
          <Animated.View style={[fill, { opacity: glowO }]}>
            <LinearGradient pointerEvents="none" style={fill} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} locations={[0, 0.3, 0.72, 1]}
              colors={yes ? ['#fbbf2400', '#fbbf2400', '#fbbf2452', '#fbbf24d6'] : ['#ef4444d6', '#ef444452', '#ef444400', '#ef444400']} />
          </Animated.View>
          <Animated.View style={[fill, { borderRadius: 14, borderWidth: 3, borderColor: color, opacity: rim }]} />
          <Animated.View style={[fill, { alignItems: 'center', justifyContent: 'center', gap: 12, transform: [{ translateX: shift }, { translateY: -h * 0.05 }] }]}>
            <View style={{ flexDirection: yes ? 'row' : 'row-reverse', alignItems: 'center', gap: word * 0.08 }}>
              <View style={{ flexDirection: 'row' }}>
                {letters.map((ch, i) => {
                  // The word slides in from the lean edge like a train: the letter farthest from that edge leads
                  // and the rest follow a beat later each, never crossing; every letter is home by 0.68 of the
                  // threshold, before a release would answer.
                  const k = yes ? i : letters.length - 1 - i;
                  const a = 0.06 + k * 0.07;
                  const p = ramp(x, T, yes, a, a + 0.41);
                  return (
                    <Animated.View key={`${yes ? 'y' : 'n'}-${i}`} style={{ opacity: p, transform: [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }}>
                      <Word text={ch} size={word} color={yes ? glow.amber : RED_TEXT} />
                    </Animated.View>
                  );
                })}
              </View>
              <Animated.View style={{ opacity: rim, transform: [{ translateX: rim.interpolate({ inputRange: [0, 1], outputRange: [(yes ? 1 : -1) * 24, 0] }) }] }}>
                <Icon name={yes ? 'right' : 'left'} size={word * 0.45} color={yes ? glow.amber : RED_TEXT} />
              </Animated.View>
            </View>
            <Animated.View style={{ opacity: ramp(x, T, yes, 0.4, 0.8) }}><Hint yes={yes} touch={touch} size={hintSize} /></Animated.View>
          </Animated.View>
        </View>
      );
    };
    return { nope: side(false), yep: side(true) };
  }, [x, T, w, h, touch, word, inner, hintSize]);
  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden style={fill}>
      <Animated.View style={[fill, { backgroundColor: DIM, opacity: x.interpolate({ inputRange: [-T, -8, 8, T], outputRange: [0.5, 0, 0, 0.5], ...clamp }) }]} />
      {layers.nope}
      {layers.yep}
    </View>
  );
}
