/**
 * Prototype (Q68): the burst look now and a cheaper version side by side, playing the same Yep / Nope moment in
 * sync on one shared set of drives, with each side's frame times. Throwaway; web only.
 *
 * Both frames share one page, so one main thread and one compositor: while both play, a frame time belongs to both.
 * "Measure each alone" plays each side by itself (the other unmounted) and shows its own numbers.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BurstBack, BurstFront } from '../room/vote/fx-looks';
import { CheapBurstBack, CheapBurstFront, type Edges } from '../room/vote/burst-cheap';
import { stageGeometry, type StageGeometry } from '../room/vote/geometry';
import { clampI, fill, same, type A, type LayerProps } from '../room/vote/paint';

const POSTERS = ['https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg', 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg'];
const HEADER = 52;
const DOCK = 92;
const FLY_MS = 250;
const FADE_IN_MS = 120;
const FADE_OUT_MS = 330;
const SLOW = 5;

// The room backdrop (glow/Backdrop): a vertical gradient over the whole frame.
const BACKDROP = { colors: ['#17140e', '#0b0b0e', '#070707'] as const, locations: [0, 0.45, 1] as const };
function backdropAt(t: number) {
  const { colors, locations } = BACKDROP;
  const k = t <= locations[1] ? 0 : 1;
  const u = Math.min(1, Math.max(0, (t - locations[k]) / (locations[k + 1] - locations[k])));
  const a = parseInt(colors[k].slice(1), 16);
  const b = parseInt(colors[k + 1].slice(1), 16);
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * u);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

type Variant = 'now' | 'cheap';
type Mode = 'both' | Variant;
interface Drives { x: Animated.Value; fadeV: Animated.Value; punch: Animated.Value; loop: Animated.Value }

const sideDrive = (drive: Animated.Value, kind: 'yep' | 'nope') => drive.interpolate(kind === 'yep' ? { inputRange: [0.03, 1], outputRange: [0, 1], ...clampI } : { inputRange: [-1, -0.03], outputRange: [1, 0], ...clampI });
const sideOn = (drive: Animated.Value, kind: 'yep' | 'nope') => drive.interpolate(kind === 'yep' ? { inputRange: [0.03, 0.031], outputRange: [0, 1], ...clampI } : { inputRange: [-0.031, -0.03], outputRange: [1, 0], ...clampI });

/** One look side, invisible until its drive moves (as VoteStage's StageSide). */
const Side = memo(function Side({ layer: Layer, kind, g, d, edges }: { layer: ComponentType<LayerProps & { edges: Edges }>; kind: 'yep' | 'nope'; g: StageGeometry; d: Drives; edges: Edges }) {
  const { p, on, kick } = useMemo(() => ({ p: sideDrive(d.fadeV, kind), on: sideOn(d.fadeV, kind), kick: same(d.punch) }), [d, kind]);
  const lit: A = useMemo(() => same(d.punch), [d]);
  return (
    <Animated.View pointerEvents="none" style={[fill, { opacity: on }]}>
      <Layer look="burst" g={g} kind={kind} p={p} loop={d.loop} punch={kick} lit={lit} x={d.x} posterUrl={null} reduced={false} edges={edges} />
    </Animated.View>
  );
});

function Card({ uri, g, style }: { uri: string; g: StageGeometry; style?: object }) {
  return (
    <Animated.View style={[{ position: 'absolute', left: (g.aw - g.w) / 2, top: g.cardTop, width: g.w, height: g.h, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1a1610' }, style]}>
      <Image source={{ uri }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
      <LinearGradient colors={['#00000000', '#000000cc']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: g.h * 0.3 }} />
    </Animated.View>
  );
}

/** One phone frame: backdrop, header, the stage (look behind, next card, the answered card flying, look in front), dock. */
const Phone = memo(function Phone({ variant, W, H, d, run, onVote }: { variant: Variant; W: number; H: number; d: Drives; run: { id: number; answer: boolean } | null; onVote: (yes: boolean) => void }) {
  const stageH = H - HEADER - DOCK;
  const g = useMemo(() => stageGeometry({ aw: W, stageH, vw: W, phone: true, z: (n) => n }), [W, stageH]);
  const edges = useMemo(() => ({ top: backdropAt(HEADER / H), bottom: backdropAt((HEADER + stageH) / H) }), [H, stageH]);
  const Back = (variant === 'now' ? BurstBack : CheapBurstBack) as ComponentType<LayerProps & { edges: Edges }>;
  const Front = (variant === 'now' ? BurstFront : CheapBurstFront) as ComponentType<LayerProps & { edges: Edges }>;
  const fly = useMemo(() => ({ transform: [{ translateX: d.x }, { rotate: d.x.interpolate({ inputRange: [-W * 2, 0, W * 2], outputRange: ['-24deg', '0deg', '24deg'] }) }], willChange: 'transform' }), [d.x, W]);
  // A fresh set of look layers for every play, as the stage builds one per card: each press shows layers that
  // were never shown before (their first-show raster is part of what the press costs).
  const key = run?.id ?? 0;
  return (
    <View style={{ width: W, height: H, borderRadius: 28, overflow: 'hidden', backgroundColor: '#070707', borderWidth: 1, borderColor: '#ffffff1f' }}>
      <LinearGradient colors={[...BACKDROP.colors]} locations={[...BACKDROP.locations]} style={fill} />
      <View style={{ height: HEADER, borderBottomWidth: 1, borderBottomColor: '#ffffff14', backgroundColor: 'rgba(10,9,8,0.86)', justifyContent: 'center', paddingHorizontal: 16, zIndex: 2 }}>
        <Text style={{ fontFamily: 'GabaritoBold', color: '#f5efe6', fontSize: 16 }}>Friday night</Text>
      </View>
      <View style={{ width: W, height: stageH }}>
        <View key={`b${key}`} style={fill} pointerEvents="none">
          <Side layer={Back} kind="nope" g={g} d={d} edges={edges} />
          <Side layer={Back} kind="yep" g={g} d={d} edges={edges} />
        </View>
        <Card uri={POSTERS[1]} g={g} />
        <Card uri={POSTERS[0]} g={g} style={fly} />
        <View key={`f${key}`} style={fill} pointerEvents="none">
          <Side layer={Front} kind="nope" g={g} d={d} edges={edges} />
          <Side layer={Front} kind="yep" g={g} d={d} edges={edges} />
        </View>
      </View>
      <View style={{ height: DOCK, flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#ffffff14', backgroundColor: 'rgba(10,9,8,0.9)' }}>
        {[false, true].map((yes) => (
          <Pressable key={String(yes)} onPress={() => onVote(yes)} style={{ flex: 1, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: yes ? '#fbbf24' : '#ef44440f', borderWidth: 1, borderColor: yes ? '#fbbf24' : '#ef444440' }}>
            <Text style={{ fontFamily: 'GabaritoBold', fontSize: 17, color: yes ? '#201400' : '#fca5a5' }}>{yes ? 'Yep' : 'Nope'}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
});

interface Stat { p95: number; worst: number; n: number }
const stat = (gaps: number[]): Stat | null => {
  if (!gaps.length) return null;
  const s = [...gaps].sort((a, b) => a - b);
  return { p95: s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)], worst: s[s.length - 1], n: s.length };
};
const fmt = (s: Stat | null) => (s ? `p95 ${s.p95.toFixed(1)} ms · worst ${s.worst.toFixed(1)} ms · ${s.n} frames` : '—');

declare global {
  interface Window { __burst?: { results: Record<string, number[]>; play: (yes: boolean) => Promise<void>; setMode: (m: Mode) => void; setSlow: (s: boolean) => void; setLoop: (l: boolean) => void; busy: () => boolean; pose: (v: number, loop: number) => void } }
}

function Chip({ label, active, onPress, disabled = false }: { label: string; active: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 10, justifyContent: 'center', backgroundColor: active ? '#fbbf24' : '#ffffff0f', borderWidth: 1, borderColor: active ? '#fbbf24' : '#ffffff1f', opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ fontFamily: 'GabaritoBold', fontSize: 15, color: active ? '#201400' : '#f5efe6' }}>{label}</Text>
    </Pressable>
  );
}

export function BurstCompare() {
  const { width, height } = useWindowDimensions();
  const [d] = useState<Drives>(() => ({ x: new Animated.Value(0), fadeV: new Animated.Value(0), punch: new Animated.Value(0), loop: new Animated.Value(0) }));
  const [run, setRun] = useState<{ id: number; answer: boolean } | null>(null);
  const [mode, setMode] = useState<Mode>('both');
  const [slow, setSlow] = useState(false);
  const [looping, setLooping] = useState(true);
  const [measuring, setMeasuring] = useState<string | null>(null);
  /** Checks only: a still frame at a drive value (the loop stopped). */
  const [frozen, setFrozen] = useState(false);
  // Frame gaps per bucket: `now`/`cheap` alone (all runs), `both` together; `last:<bucket>` is the latest run.
  const results = useRef<Record<string, number[]>>({});
  /** What the stats lines show: a copy of `results`, refreshed every few frames. */
  const [snap, setSnap] = useState<Record<string, number[]>>({});
  const bump = useCallback(() => setSnap(Object.fromEntries(Object.entries(results.current).map(([k, v]) => [k, [...v]]))), []);
  const busy = useRef(false);
  const modeRef = useRef(mode);
  const slowRef = useRef(slow);
  useEffect(() => { modeRef.current = mode; slowRef.current = slow; }, [mode, slow]);

  // The shared slow loop (burst's ray spin), 5 s per turn as in the stage.
  useEffect(() => {
    if (frozen) return;
    d.loop.setValue(0);
    const l = Animated.loop(Animated.timing(d.loop, { toValue: 1, duration: 5000 * (slow ? SLOW : 1), easing: Easing.linear, useNativeDriver: false }));
    l.start();
    return () => l.stop();
  }, [d, slow, frozen]);

  const play = useCallback(async (yes: boolean) => {
    if (busy.current) return;
    busy.current = true;
    const f = slowRef.current ? SLOW : 1;
    const bucket = modeRef.current;
    d.x.setValue(0); d.fadeV.setValue(0); d.punch.setValue(0);
    setRun((r) => ({ id: (r?.id ?? 0) + 1, answer: yes }));
    // The new layers mount and draw (the stage builds them in the background before the press).
    await new Promise((r) => setTimeout(r, 400));
    const gaps: number[] = [];
    results.current[`last:${bucket}`] = gaps;
    let last = performance.now();
    let on = true;
    let tick = 0;
    const frame = (t: number) => {
      if (!on) return;
      gaps.push(t - last);
      last = t;
      if (++tick % 6 === 0) bump();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
    const off = (W: number) => (yes ? 1 : -1) * W * 2;
    await new Promise<void>((resolve) => Animated.parallel([
      Animated.timing(d.x, { toValue: off(400), duration: FLY_MS * f, easing: Easing.in(Easing.quad), useNativeDriver: false }),
      Animated.sequence([
        Animated.timing(d.fadeV, { toValue: yes ? 1 : -1, duration: FADE_IN_MS * f, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(d.fadeV, { toValue: 0, duration: FADE_OUT_MS * f, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      ]),
      Animated.sequence([
        Animated.delay(40 * f),
        Animated.timing(d.punch, { toValue: 1, duration: 130 * f, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(d.punch, { toValue: 0, duration: 300 * f, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ]),
    ]).start(() => resolve()));
    on = false;
    (results.current[bucket] ??= []).push(...gaps.slice(1));
    gaps.shift();
    bump();
    await new Promise((r) => setTimeout(r, 500 * f));
    d.x.setValue(0);
    busy.current = false;
  }, [d, bump]);

  // Plays Yep and Nope in turn while Loop is on.
  useEffect(() => {
    if (!looping || measuring) return;
    let live = true;
    let yes = true;
    (async () => {
      while (live) {
        await play(yes);
        yes = !yes;
        await new Promise((r) => setTimeout(r, 700));
      }
    })();
    return () => { live = false; };
  }, [looping, measuring, play]);

  const measure = useCallback(async () => {
    setLooping(false);
    while (busy.current) await new Promise((r) => setTimeout(r, 50));
    for (const side of ['now', 'cheap'] as const) {
      setMeasuring(side);
      setMode(side);
      modeRef.current = side;
      results.current[side] = [];
      await new Promise((r) => setTimeout(r, 300));
      for (let k = 0; k < 6; k++) await play(k % 2 === 0);
    }
    setMode('both');
    modeRef.current = 'both';
    setMeasuring(null);
  }, [play]);

  useEffect(() => {
    window.__burst = { results: results.current, play, setMode: (m) => { setMode(m); modeRef.current = m; }, setSlow, setLoop: setLooping, busy: () => busy.current,
      pose: (v, loop) => { setLooping(false); setFrozen(true); setTimeout(() => { d.loop.setValue(loop); d.fadeV.setValue(v); d.punch.setValue(0); d.x.setValue(0); }, 50); } };
  }, [play, d]);

  const stacked = width < 2 * 360 + 64;
  const W = stacked ? Math.min(360, width - 32) : 360;
  const H = Math.round(stacked ? Math.min(W * 1.9, Math.max(560, height * 0.82)) : Math.min(740, Math.max(600, height - 210)));
  const side = (variant: Variant) => {
    const shown = mode === 'both' || mode === variant;
    return (
      <View key={variant} style={{ alignItems: 'center', gap: 8 }}>
        <Text style={{ fontFamily: 'GabaritoBold', fontSize: 22, color: '#f5efe6' }}>{variant === 'now' ? 'Now' : 'Cheaper'}</Text>
        {shown ? <Phone variant={variant} W={W} H={H} d={d} run={run} onVote={(yes) => { setLooping(false); void play(yes); }} />
          : <View style={{ width: W, height: H, borderRadius: 28, borderWidth: 1, borderColor: '#ffffff1f', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#a8a29e', fontSize: 15 }}>Paused while the other side is measured alone</Text></View>}
        <View testID={`stats-${variant}`} style={{ width: W, gap: 2 }}>
          <Text style={{ color: '#f5efe6', fontSize: 14, fontVariant: ['tabular-nums'] }}>Alone: {fmt(stat(snap[variant] ?? []))}</Text>
          <Text style={{ color: '#a8a29e', fontSize: 13, fontVariant: ['tabular-nums'] }}>Last play{mode === 'both' ? ' (both playing)' : ''}: {fmt(stat(snap[`last:${mode === 'both' ? 'both' : variant}`] ?? []))}</Text>
        </View>
      </View>
    );
  };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#070707' }} contentContainerStyle={{ padding: 16, gap: 14, alignItems: 'center' }}>
      <Text style={{ fontFamily: 'GabaritoBold', fontSize: 26, color: '#f5efe6' }}>Burst: now vs cheaper</Text>
      <Text style={{ color: '#a8a29e', fontSize: 14, maxWidth: 720, textAlign: 'center' }}>Same Yep / Nope moment, same drives, in sync. Frame time is the gap between animation frames (16.7 ms = 60 fps). Both sides share one page, so together they share frame times; Measure plays each alone.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        <Chip label={'Replay Yep'} active={false} onPress={() => { setLooping(false); void play(true); }} disabled={Boolean(measuring)} />
        <Chip label={'Replay Nope'} active={false} onPress={() => { setLooping(false); void play(false); }} disabled={Boolean(measuring)} />
        <Chip label={'Loop'} active={looping} onPress={() => setLooping((l) => !l)} disabled={Boolean(measuring)} />
        <Chip label={'Slow motion ×5'} active={slow} onPress={() => setSlow((s) => !s)} disabled={Boolean(measuring)} />
        <Chip label={measuring ? `Measuring ${measuring === 'now' ? 'Now' : 'Cheaper'}…` : 'Measure each alone'} active={Boolean(measuring)} onPress={() => void measure()} disabled={Boolean(measuring)} />
      </View>
      <View style={{ flexDirection: stacked ? 'column' : 'row', gap: stacked ? 24 : 32, alignItems: 'center' }}>
        {/* Measured alone, the playing side comes first, so it is on screen on a phone too (off-screen frames aren't drawn). */}
        {mode === 'cheap' ? [side('cheap'), side('now')] : [side('now'), side('cheap')]}
      </View>
    </ScrollView>
  );
}
