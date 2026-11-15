/**
 * The tiebreak: everyone's in for two or more titles. Everyone taps a favorite; most favorites wins; when
 * favorites tie too, a fair spin among the most-picked lands on the server's outcome, the same title on every
 * phone. A bottom sheet on phones, a centered panel on bigger windows. Counts only, never who.
 *
 * Matches opens it by itself when the room reports a tiebreak (`shared.tiebreak`); the server settles the
 * outcome and decides the winner like any title everyone's in for (Tonight).
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import type { Candidate } from '@goodwatch/yepwatch-contracts/proposal';
import { useReducedMotion } from '../../components/ui';
import { GText, Icon, glow } from '../glow/theme';
import { useLayout } from '../shell/layout';
import { Sheet } from '../shell/Sheet';
import { R, warm } from '../shell/tokens';
import { Poster } from './Decide';
import { useOn, useHover } from './matches-motion';
import { SPIN_STEPS, spinPath, type TieOutcome } from './matches-in';

export interface TiebreakProps {
  tied: Candidate[];
  /** Favorites per title so far (counts only). */
  favorites: Readonly<Record<string, number>>;
  /** Your favorite, once picked. */
  mine: string | null;
  /** People who pick (everyone in the round). */
  required: number;
  /** The server's outcome once every favorite is in; the spin lands on its winner. */
  outcome: TieOutcome | null;
  onPick: (id: string) => void;
  /** The winner is showing (the spin has landed, or there was none); may return a cleanup. */
  onLanded?: () => void | (() => void);
  onClose: () => void;
}

/** The spin's light on one title at a time, landing on the winner; reduced motion lands at once. */
function useSpin(among: string[] | null, winner: string | null) {
  const reduced = useReducedMotion();
  const key = among && winner ? `${among.join(',')}>${winner}` : '';
  const [at, setAt] = useState<{ key: string; lit: string | null; done: boolean }>({ key: '', lit: null, done: false });
  useEffect(() => {
    if (!key || !among || !winner || reduced) return;
    const path = spinPath(among, winner);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let t = 0;
    path.forEach((id, i) => {
      t += SPIN_STEPS[i];
      timers.push(setTimeout(() => setAt({ key, lit: id, done: i === path.length - 1 }), t));
    });
    return () => timers.forEach(clearTimeout);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (key && reduced) return { key, lit: winner, done: true };
  return at.key === key ? at : { key, lit: null, done: false };
}

function TieTile({ c, width, lit, picked, dim, count, choosing, onPick }: { c: Candidate; width: number; lit: boolean; picked: boolean; dim: boolean; count: number | null; choosing: boolean; onPick: () => void }) {
  const { z } = useLayout();
  const h = useHover();
  const frame = useOn(lit, 120);
  const faded = useOn(dim, 260);
  const mine = useOn(picked, 200);
  return (
    <Pressable accessibilityRole="radio" accessibilityLabel={`${c.title}, my favorite`} accessibilityState={{ checked: picked, disabled: !choosing }} aria-checked={picked} disabled={!choosing}
      onPress={onPick} {...h.handlers} style={({ pressed }) => [{ width }, pressed && { opacity: 0.85 }]}>
      <Animated.View style={{ gap: 8, opacity: faded.interpolate({ inputRange: [0, 1], outputRange: [1, 0.38] }), transform: [{ translateY: h.v.interpolate({ inputRange: [0, 1], outputRange: [0, choosing ? -2 : 0] }) }, { scale: frame.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }] }}>
        <View>
          <Poster c={c} width={width} radius={R.control} label={false} />
          <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -3, right: -3, top: -3, bottom: -3, borderRadius: R.control + 3, borderWidth: 3, borderColor: glow.amber, opacity: frame }} />
          <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 6, top: 6, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: glow.amber, opacity: mine, transform: [{ scale: mine.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.4, 1.12, 1] }) }] }}>
            <Icon name="check" size={12} color={warm.ink} />
            <GText bold size={11} color={warm.ink}>Your pick</GText>
          </Animated.View>
        </View>
        <GText bold size={z(14)} lines={2} style={{ textAlign: 'center' }}>{c.title}</GText>
        <GText size={z(12)} color={glow.amber} style={{ textAlign: 'center', opacity: count === null ? 0 : 1 }}>{count === 1 ? '1 pick' : `${count ?? 0} picks`}</GText>
      </Animated.View>
    </Pressable>
  );
}

export function Tiebreak({ tied, favorites, mine, required, outcome, onPick, onLanded, onClose }: TiebreakProps) {
  const { phone, z, width: windowWidth } = useLayout();
  const spin = useSpin(outcome?.spun ? outcome.among : null, outcome?.spun ? outcome.winner : null);
  const done = outcome ? (!outcome.spun || spin.done) : false;
  const picked = Object.values(favorites).reduce((n, v) => n + v, 0);
  const waitingFor = Math.max(0, required - picked);
  const phase = outcome ? (done ? 'done' : 'spinning') : !mine ? 'choose' : 'waiting';
  const landedRef = useRef(onLanded);
  useEffect(() => { landedRef.current = onLanded; });
  useEffect(() => (done ? landedRef.current?.() ?? undefined : undefined), [done]);
  const winner = done && outcome ? tied.find((c) => c.id === outcome.winner) ?? null : null;
  const status = phase === 'choose' ? 'Tap your favorite. Most picks wins. If picks tie too, a fair spin decides.'
    : phase === 'waiting' ? `Waiting for ${waitingFor} more ${waitingFor === 1 ? 'pick' : 'picks'}`
      : phase === 'spinning' ? 'Picks tied. Spinning'
        : outcome?.spun ? `The spin picked ${winner?.title ?? ''}` : `${favorites[outcome?.winner ?? ''] ?? 0} of ${required} picked ${winner?.title ?? ''}`;
  const inner = (phone ? windowWidth - 40 : z(560));
  const gap = phone ? 10 : z(16);
  const tileW = Math.min(phone ? 130 : z(160), Math.floor((inner - gap * (tied.length - 1)) / tied.length));
  return (
    <Sheet testID="tiebreak" title={`Everyone’s in for ${tied.length}`} onClose={onClose} width={620}
      actions={<View style={{ minHeight: z(54) }} />}>
      <View style={{ gap: 6 }}>
        <GText bold size={phone ? 24 : z(30)} style={{ letterSpacing: -0.8 }}>{winner ? winner.title : 'Which one first?'}</GText>
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 }}>
          {phase === 'spinning' || (phase === 'done' && outcome?.spun) ? <Icon name="dice" size={16} color={glow.amber} /> : null}
          <GText size={z(14)} color={phase === 'done' ? glow.amber : glow.soft} style={{ flex: 1 }}>{status}</GText>
        </View>
      </View>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', justifyContent: 'center', gap }}>
        {tied.map((c) => (
          <TieTile key={c.id} c={c} width={tileW} choosing={phase === 'choose'} picked={mine === c.id}
            lit={spin.lit === c.id || (done && outcome?.winner === c.id) || (phase === 'waiting' && mine === c.id)}
            dim={done && outcome?.winner !== c.id} count={phase === 'done' || phase === 'spinning' ? favorites[c.id] ?? 0 : null}
            onPick={() => onPick(c.id)} />
        ))}
      </View>
    </Sheet>
  );
}
