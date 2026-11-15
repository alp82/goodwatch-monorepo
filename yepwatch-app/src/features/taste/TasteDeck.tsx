/**
 * Exactly one live Taste card. An answered card leaves as a ghost (transform and opacity only) in its answer's
 * direction (answers.ts EXIT): the same for a drag and a tap. Haven't seen falls and fades out within about 170 ms.
 * The next card rises into place; Undo brings the card back with a zoom and fade in place (scale 0.92 to 1), never
 * along its exit path, and the undone answer's ghost doesn't replay.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, PanResponder, View, type ViewStyle } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { TasteAnswer, TasteCard as WireCard } from '@goodwatch/yepwatch-contracts/proposal';
import { useReducedMotion } from '../../components/ui';
import { continuousApi } from '../../core/continuous/api';
import { tasteProfile } from '../../core/continuous/taste-profile';
import { native } from '../glow/theme';
import { useLayout } from '../shell/layout';
import { EXIT, cardMeta, type CardAnswer } from './answers';
import { Stamp, type CardTitle } from './TasteCard';

interface Offset { x: number; y: number }
const REST: Offset = { x: 0, y: 0 };
/** Web only: no text selection or native image drag while a card is dragged. */
const webDrag = (native ? {} : { userSelect: 'none', cursor: 'grab' }) as ViewStyle;
const cover = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' } as const;

export const toCardTitle = (c: WireCard): CardTitle => ({ key: c.key, title: c.title, posterUrl: c.posterUrl, meta: cardMeta(c), overview: c.overview });

/** A card drawn by the deck: `live` (dragged and answered) or a ghost (`disabled`). */
export type DrawCard = (t: CardTitle, o: { w: number; disabled: boolean; onAnswer: (a: CardAnswer) => void }) => ReactNode;

/** The answered card on its way out, its answer stamped on top. Unmounts itself when done. */
function Leaving({ t, a, w, from, draw }: { t: CardTitle; a: CardAnswer; w: number; from: Offset; draw: DrawCard }) {
  const { height } = useLayout();
  const [v] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));
  const [gone, setGone] = useState(false);
  const exit = EXIT[a];
  useEffect(() => {
    const move = Animated.timing(v, { toValue: 1, duration: exit === 'down' ? 420 : 380, easing: exit === 'down' ? Easing.in(Easing.quad) : Easing.bezier(0.3, 0.1, 0.7, 1), useNativeDriver: native });
    const anim = exit === 'down' ? Animated.parallel([move, Animated.timing(fade, { toValue: 0, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: native })]) : move;
    anim.start(() => setGone(true));
    return () => anim.stop();
  }, [v, fade, exit]);
  if (gone) return null;
  const tilt = (from.x / Math.max(1, w)) * 10;
  const side = exit === 'right' ? 1 : -1;
  const transform = exit === 'down'
    ? [
      { translateX: from.x },
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from.y, from.y + height * 0.9] }) },
      { rotate: v.interpolate({ inputRange: [0, 1], outputRange: [`${tilt}deg`, `${tilt + 4}deg`] }) },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }) },
    ]
    : [
      { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [from.x, side * w * 1.25] }) },
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from.y, from.y - 24] }) },
      { rotate: v.interpolate({ inputRange: [0, 1], outputRange: [`${tilt}deg`, `${side * 14}deg`] }) },
    ];
  const opacity = exit === 'down' ? fade : v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0.8, 0] });
  return (
    <Animated.View pointerEvents="none" aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: w, zIndex: 2, opacity, transform }}>
      {draw(t, { w, disabled: true, onAnswer: () => undefined })}
      <View style={cover}><Stamp a={a} /></View>
    </Animated.View>
  );
}

/** The next card rising into place, or (`undo`) the undone card zooming back in. */
function Entering({ children, undo = false }: { children: ReactNode; undo?: boolean }) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    if (reduced) return;
    const a = Animated.timing(v, undo
      ? { toValue: 1, duration: 260, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: native }
      : { toValue: 1, duration: 300, delay: 90, easing: Easing.out(Easing.cubic), useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [v, undo, reduced]);
  const rise = reduced || undo ? 0 : 20;
  const from = reduced ? 1 : undo ? 0.92 : 0.97;
  return <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [from, 1] }) }] }}>{children}</Animated.View>;
}

/**
 * Drag for the live card: right is the right answer, left the left one, down the drop. Taps still reach the picture
 * and the answer tiles: the drag claims a touch only once it moves.
 */
function useCardDrag(w: number, enabled: boolean, answers: { right: CardAnswer; left: CardAnswer; down: CardAnswer }, onDrop: (a: CardAnswer, at: Offset) => void) {
  const [pos] = useState(() => new Animated.ValueXY(REST));
  const live = useRef({ w, enabled, answers, onDrop });
  useLayoutEffect(() => { live.current = { w, enabled, answers, onDrop }; });
  const back = () => Animated.spring(pos, { toValue: REST, friction: 7, tension: 80, useNativeDriver: native }).start();
  // PanResponder calls these closures only for events; it never reads the ref while it's built.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => live.current.enabled && Math.abs(g.dx) + Math.abs(g.dy) > 8,
    onMoveShouldSetPanResponderCapture: (_, g) => live.current.enabled && Math.abs(g.dx) + Math.abs(g.dy) > 8,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => pos.stopAnimation(),
    onPanResponderMove: (_, g) => pos.setValue({ x: g.dx, y: g.dy > 0 ? g.dy : g.dy * 0.3 }),
    onPanResponderRelease: (_, g) => {
      const { w: cw, onDrop: drop, answers: to } = live.current;
      const at = { x: g.dx, y: g.dy > 0 ? g.dy : g.dy * 0.3 };
      const sideways = Math.abs(g.dx) >= g.dy;
      const a: CardAnswer | null = !sideways && (g.dy > 110 || g.vy > 0.8) ? to.down
        : sideways && (g.dx > cw * 0.28 || g.vx > 0.7) ? to.right
        : sideways && (g.dx < -cw * 0.28 || g.vx < -0.7) ? to.left
        : null;
      if (!a) { back(); return; }
      drop(a, at);
      pos.setValue(REST);
    },
    onPanResponderTerminate: back,
  }));
  return { pos, handlers: pan.panHandlers };
}

export interface DeckEntry { t: CardTitle; a: CardAnswer }

/**
 * The live card at the column's full width (at most `maxWidth`). `answered` is the answers given so far (the last one
 * leaves as the ghost); `end` replaces the card when there's none left.
 */
export function LiveDeck({ current, index, answered, onAnswer, end, draw, maxWidth, drag = { right: 'loved', left: 'not_for_me', down: 'unseen' } }: {
  current: CardTitle | null;
  /** The live card's place in the deck (its key prefix stays apart from the ghosts'). */
  index: number;
  answered: readonly DeckEntry[];
  onAnswer: (a: CardAnswer) => void;
  end: ReactNode;
  draw: DrawCard;
  maxWidth?: number;
  drag?: { right: CardAnswer; left: CardAnswer; down: CardAnswer };
}) {
  const [w, setW] = useState(0);
  const reduced = useReducedMotion();
  const last = answered[answered.length - 1];
  const cw = maxWidth ? Math.min(w, maxWidth) : w;
  const n = answered.length;
  /** The last change was an Undo: the card zooms back and no ghost leaves. */
  const [seen, setSeen] = useState({ n, undone: false });
  if (seen.n !== n) setSeen({ n, undone: n < seen.n });
  const undone = seen.n !== n ? n < seen.n : seen.undone;
  /** Where the latest answered card was let go (a tap answer leaves from rest). */
  const [drop, setDrop] = useState<{ n: number; at: Offset } | null>(null);
  const tap = (a: CardAnswer) => { setDrop(null); onAnswer(a); };
  const dragging = useCardDrag(cw, Boolean(current), drag, (a, at) => { setDrop({ n: n + 1, at }); onAnswer(a); });
  const range = Math.max(1, cw);
  const lean = (inputRange: number[], outputRange: number[], axis: Animated.Value) => axis.interpolate({ inputRange, outputRange, extrapolate: 'clamp' });
  return (
    <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} style={{ alignSelf: 'stretch' }}>
      {cw > 0 ? (
        <View style={{ width: cw, alignSelf: 'center' }}>
          {current ? (
            // Prefixed keys: the live card and the ghosts count from different numbers, so they never share a key.
            <Entering key={`live-${index}-${current.key}-${undone ? 'undo' : 'next'}`} undo={undone}>
              <Animated.View {...dragging.handlers}
                style={[webDrag, { transform: [{ translateX: dragging.pos.x }, { translateY: dragging.pos.y }, { rotate: dragging.pos.x.interpolate({ inputRange: [-range, 0, range], outputRange: ['-10deg', '0deg', '10deg'] }) }] }]}>
                {draw(current, { w: cw, disabled: false, onAnswer: tap })}
                <Animated.View pointerEvents="none" style={[cover, { opacity: lean([cw * 0.08, cw * 0.28], [0, 1], dragging.pos.x) }]}><Stamp a={drag.right} /></Animated.View>
                <Animated.View pointerEvents="none" style={[cover, { opacity: lean([-cw * 0.28, -cw * 0.08], [1, 0], dragging.pos.x) }]}><Stamp a={drag.left} /></Animated.View>
                <Animated.View pointerEvents="none" style={[cover, { opacity: lean([30, 110], [0, 1], dragging.pos.y) }]}><Stamp a={drag.down} /></Animated.View>
              </Animated.View>
            </Entering>
          ) : end}
          {last && !reduced && !undone ? <Leaving key={`gone-${n}-${last.t.key}`} t={last.t} a={last.a} w={cw} from={drop?.n === n ? drop.at : REST} draw={draw} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * A calibration deck from GET /profile/taste-deck (fresh for every opening), with its answers going to the profile
 * as they're given (taste-profile.ts sends them in batches). Undo takes back the last answer.
 */
export function useTasteCards(count = 10) {
  const [opening] = useState(() => Date.now());
  const deck = useQuery({ queryKey: ['taste-deck', count, opening], queryFn: () => continuousApi.tasteDeck(count), staleTime: Infinity, gcTime: 0, retry: 1 });
  const cards = deck.data?.cards.map(toCardTitle) ?? [];
  const [answered, setAnswered] = useState<{ t: CardTitle; a: TasteAnswer }[]>([]);
  const current = cards[answered.length] ?? null;
  return {
    loading: deck.isPending,
    failed: deck.isError,
    retry: () => void deck.refetch(),
    total: cards.length,
    current,
    index: answered.length,
    answered: answered as readonly DeckEntry[],
    done: deck.isSuccess && !current,
    answer: (a: CardAnswer) => {
      if (!current || a === 'did_not_watch') return;
      tasteProfile.answer(current.key, a);
      setAnswered((x) => [...x, { t: current, a }]);
    },
    undo: () => {
      const last = answered[answered.length - 1];
      if (!last) return;
      tasteProfile.answer(last.t.key, null, last.a);
      setAnswered((x) => x.slice(0, -1));
    },
  };
}
