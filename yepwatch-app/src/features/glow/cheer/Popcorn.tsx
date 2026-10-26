/**
 * Selected cheer, always on: popcorn kernels pop up across the poster and fall through, past its
 * lower edge. A tap (or the first hold frame of an episode) bursts 2–3 kernels from that episode's
 * seed, so every device draws the same burst; while someone holds, their seeded sequence keeps
 * emitting a kernel or two every 250 ms. One Animated.Value per kernel, hard cap, no timers at rest.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { mulberry32, type Rng } from './random';
import { kernelPath, type KernelPath, type PosterRect } from './popcorn-path';
import { CHEER_TIMING } from './timing';

export interface CheerEventInput { id: string; participantId: string; kind: 'tap' | 'hold'; seed: number; at: number; self: boolean }
export const POPCORN_CAP = 36;
const CREAM = '#fff6dc';
const BUTTER = '#fbd36b';
const native = Platform.OS !== 'web';
type Live = { id: number; color: string; path: KernelPath };

function Kernel({ k, reduced, done }: { k: Live; reduced: boolean; done: (id: number) => void }) {
  const [t] = useState(() => new Animated.Value(0));
  const { path } = k;
  const finish = useRef(done);
  useEffect(() => { finish.current = done; });
  // A motion preference change cancels the running flight and restarts the kernel in the new mode.
  useEffect(() => {
    if (reduced) {
      const timer = setTimeout(() => finish.current(k.id), 1200);
      return () => clearTimeout(timer);
    }
    t.setValue(0);
    const a = Animated.timing(t, { toValue: 1, duration: path.duration, easing: Easing.linear, useNativeDriver: native });
    a.start(({ finished }) => { if (finished) finish.current(k.id); });
    return () => a.stop();
  }, [reduced, k.id, t, path.duration]);
  const input = path.frames.map((f) => f.t);
  const range = (pick: (f: KernelPath['frames'][number]) => number) => t.interpolate({ inputRange: input, outputRange: path.frames.map(pick) });
  // Reduced motion: one still kernel on its arc, shown briefly, then gone. No movement.
  const still = path.frames[4];
  const style = reduced
    ? { opacity: 1, transform: [{ translateX: still.x }, { translateY: still.y }, { rotate: `${still.rotate}deg` }] }
    : {
        opacity: range((f) => f.opacity),
        transform: [
          { translateX: range((f) => f.x) },
          { translateY: range((f) => f.y) },
          { rotate: t.interpolate({ inputRange: input, outputRange: path.frames.map((f) => `${f.rotate}deg`) }) },
          { scale: range((f) => f.scale) },
        ],
      };
  return (
    <Animated.View testID="cheer-kernel" pointerEvents="none" style={[{ position: 'absolute', left: path.x0, top: path.y0, width: path.size, height: path.size }, style]}>
      {path.puffs.map((p, i) => (
        <View key={i} style={{ position: 'absolute', left: p.x, top: p.y, width: p.size, height: p.size, borderRadius: p.size / 2, backgroundColor: p.light > 0.55 ? CREAM : BUTTER, borderWidth: 0.5, borderColor: '#00000014' }} />
      ))}
      <View style={{ position: 'absolute', left: path.fleck.x, top: path.fleck.y, width: path.size * 0.22, height: path.size * 0.22, borderRadius: path.size * 0.11, backgroundColor: k.color }} />
    </Animated.View>
  );
}

export function PopcornLayer({ poster, events, holders, reduced, colorOf, onBurst }: {
  /** Poster frame in this layer's coordinate space (the layer fills its parent). */
  poster: PosterRect;
  /** Recent cheer events (local and peers); each id spawns at most one burst. */
  events: readonly CheerEventInput[];
  /** People holding right now: participantId -> episode seed. Renewals keep the same seed. */
  holders: ReadonlyMap<string, number>;
  reduced: boolean;
  colorOf: (participantId: string) => string;
  /** Called once per new burst (for a gentle poster spring nudge). */
  onBurst?: () => void;
}) {
  const [kernels, setKernels] = useState<Live[]>([]);
  const seen = useRef(new Set<string>());
  const streams = useRef(new Map<string, Rng>());
  const seq = useRef(0);
  const live = useRef(0);
  const latest = useRef({ poster, colorOf, onBurst });
  useEffect(() => { latest.current = { poster, colorOf, onBurst }; });
  const stream = (participantId: string, seed: number) => {
    const key = `${participantId}:${seed}`;
    let rng = streams.current.get(key);
    const fresh = !rng;
    if (!rng) {
      rng = mulberry32(seed);
      streams.current.set(key, rng);
      if (streams.current.size > 64) streams.current.delete(streams.current.keys().next().value!);
    }
    return { rng, fresh };
  };
  const spawn = (participantId: string, rng: Rng, count: number, opts?: { spread?: number }) => {
    const add: Live[] = [];
    for (let i = 0; i < count && live.current + add.length < POPCORN_CAP; i++)
      add.push({ id: ++seq.current, color: latest.current.colorOf(participantId), path: kernelPath(rng, latest.current.poster, opts) });
    if (!add.length) return;
    live.current += add.length;
    setKernels((old) => [...old, ...add]);
  };
  useEffect(() => {
    for (const e of events) {
      if (seen.current.has(e.id)) continue;
      seen.current.add(e.id);
      const { rng, fresh } = stream(e.participantId, e.seed);
      // A tap always bursts; a hold bursts only for the first frame of its episode (renewals never restart it).
      if (e.kind === 'tap' || fresh) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- bursts follow incoming cheer events
        spawn(e.participantId, rng, 2 + Math.round(rng()));
        latest.current.onBurst?.();
      }
    }
    if (seen.current.size > 400) seen.current = new Set([...seen.current].slice(-200));
  }, [events]);
  const holdKey = [...holders].map(([p, s]) => `${p}:${s}`).sort().join('|');
  useEffect(() => {
    if (!holders.size) return;
    const timer = setInterval(() => {
      for (const [p, s] of holders) {
        const { rng } = stream(p, s);
        spawn(p, rng, rng() < 0.5 ? 1 : 2, { spread: 1.2 });
      }
    }, CHEER_TIMING.holdEmitMs);
    return () => clearInterval(timer);
  }, [holdKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = (id: number) => {
    live.current = Math.max(0, live.current - 1);
    setKernels((old) => old.filter((k) => k.id !== id));
  };
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      {kernels.map((k) => <Kernel key={k.id} k={k} reduced={reduced} done={done} />)}
    </View>
  );
}
