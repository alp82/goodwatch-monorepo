/**
 * The couch setup's console: "What are you in the mood for?" (a friend reads "Got a wish?") with the
 * describe field and one rotating Try example under it, Movies / Shows / Both, Streaming, a poster
 * preview, and Ideas with one row per person. Every piece has one size in every state: nothing moves when
 * an example rotates, an idea is added, replaced or switched, a wish arrives, or the field takes focus.
 * Wide windows lay it out as one card with two panes; phones stack it, with Ideas as a tray in the dock.
 */
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Animated, Easing, Image, ScrollView, TextInput, View, type TextStyle } from 'react-native';
import type { Candidate } from '@goodwatch/yepwatch-contracts/proposal';
import { useReducedMotion } from '../../components/ui';
import { GText, glow, native } from '../glow/theme';
import { HoverPress, useHovered } from '../shell/hover';
import { useLayout } from '../shell/layout';
import { R, warm } from '../shell/tokens';
import { IDEA_LIMITS, type IdeaView, type Kind } from './model';
import { TRY_EXAMPLES } from './MoodComposer';
import { useIdeaSave } from './idea-save';
import { webField } from './parts';
import { roomPart } from './RoomProvider';
import { Face } from './invite';
import { namesLine, servicesIn } from './services';
import { Glyph, Logos, useServices } from './ui';

// ————— Motion (transform and opacity only) —————

/** A value that eases to `target` whenever it changes. */
function useTo(target: number, duration = 220) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(target));
  useEffect(() => {
    const a = Animated.timing(v, { toValue: target, duration: reduced ? 0 : duration, easing: Easing.out(Easing.cubic), useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [v, target, duration, reduced]);
  return v;
}

/** Rises in once on mount (opacity and a few pixels). */
function Rise({ children, rise = 6, delay = 0 }: { children: ReactNode; rise?: number; delay?: number }) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    if (reduced) return;
    const a = Animated.timing(v, { toValue: 1, duration: 320, delay, easing: Easing.out(Easing.cubic), useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [v, reduced, delay]);
  return <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) }] }}>{children}</Animated.View>;
}

/** GoodWatch's example swap: half a second, opacity with a 4 px shift. */
const SWAP_MS = 500;
function Swap({ out = false, onDone, children }: { out?: boolean; onDone?: () => void; children: ReactNode }) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });
  useEffect(() => {
    const a = Animated.timing(v, { toValue: 1, duration: reduced ? 0 : SWAP_MS, easing: Easing.out(Easing.quad), useNativeDriver: native });
    a.start(({ finished }) => { if (finished) done.current?.(); });
    return () => a.stop();
  }, [v, reduced]);
  const shift = reduced ? 0 : 4;
  return (
    <Animated.View pointerEvents={out ? 'none' : 'box-none'} aria-hidden={out || undefined}
      style={[out ? { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } : { flex: 1 }, { justifyContent: 'center', opacity: v.interpolate({ inputRange: [0, 1], outputRange: out ? [1, 0] : [0, 1] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: out ? [0, shift] : [shift, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** One spot that shows one thing at a time: when `k` changes, the old content fades out as the new one fades in. */
export function Crossfade({ k, height, render }: { k: string; height: number; render: (k: string, leaving: boolean) => ReactNode }) {
  const [st, setSt] = useState<{ cur: string; prev: string | null }>({ cur: k, prev: null });
  if (st.cur !== k) setSt({ cur: k, prev: st.cur });
  return (
    <View style={{ height }}>
      {st.prev !== null && st.prev !== k ? <Swap key={`out-${st.prev}`} out onDone={() => setSt((c) => ({ ...c, prev: null }))}>{render(st.prev, true)}</Swap> : null}
      <Swap key={`in-${k}`}>{render(k, false)}</Swap>
    </View>
  );
}

/** An amber wash that flashes once when `text` changes (opacity only): a replaced idea reads as the same row updated. */
function ChangeGlow({ text, radius }: { text: string; radius: number }) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduced) return;
    v.setValue(0);
    const a = Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: native }),
      Animated.timing(v, { toValue: 0, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: native }),
    ]);
    a.start();
    return () => a.stop();
  }, [text, v, reduced]);
  return <Animated.View testID="idea-glow" pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: radius, backgroundColor: '#fbbf2426', borderWidth: 1, borderColor: warm.amberLine, opacity: v }} />;
}

// ————— Section heads —————

export function SectionHead({ id, title, meta }: { id: string; title: string; meta?: string }) {
  const { phone, z } = useLayout();
  return (
    <View testID={`head-${id}`} style={{ height: phone ? 24 : z(24), flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <GText bold size={phone ? 16 : z(16)} lines={1} style={{ flex: 1 }}>{title}</GText>
      {meta ? <GText size={phone ? 13 : z(13)} color={glow.muted} lines={1}>{meta}</GText> : null}
    </View>
  );
}

// ————— The describe field and its Try line —————

/** GoodWatch's pace for its rotating examples. */
const TRY_MS = 3200;
const TRY_HOVER = '#fcd34d';
const pickAny = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/**
 * One example at a time: starts at a random place, moves on every 3.2 s, holds still while `paused` (the
 * field has words), while the pointer is over it, and with reduced motion. Examples already in the ideas
 * (`skip`) are passed over.
 */
function useTry(skip: readonly string[], paused: boolean) {
  const reduced = useReducedMotion();
  const [text, setText] = useState(() => pickAny(TRY_EXAMPLES.filter((m) => !skip.includes(m))) ?? TRY_EXAMPLES[0]);
  const [over, setOver] = useState(false);
  const latest = useRef(skip);
  useEffect(() => { latest.current = skip; });
  const after = (cur: string, hide: readonly string[]) => {
    const i = TRY_EXAMPLES.indexOf(cur);
    for (let k = 1; k <= TRY_EXAMPLES.length; k++) { const m = TRY_EXAMPLES[(i + k) % TRY_EXAMPLES.length]; if (!hide.includes(m)) return m; }
    return cur;
  };
  if (skip.includes(text)) { const next = after(text, skip); if (next !== text) setText(next); }
  const still = paused || over || reduced;
  useEffect(() => {
    if (still) return;
    const t = setInterval(() => setText((cur) => after(cur, latest.current)), TRY_MS);
    return () => clearInterval(t);
  }, [still]);
  const hold = (native ? {} : { onMouseEnter: () => setOver(true), onMouseLeave: () => setOver(false) }) as object;
  return { text, hold };
}

function TryWords({ text }: { text: string }) {
  const { phone, z } = useLayout();
  const hovered = useHovered();
  const color = hovered ? TRY_HOVER : glow.muted;
  return (
    <>
      <View style={{ width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: hovered ? TRY_HOVER : '#ffffff40' }}>
        <Glyph name="up" size={11} color={color} />
      </View>
      <GText bold size={phone ? 14 : z(14)} color={color} lines={1} style={{ flexShrink: 1 }}>{`Try “${text}”`}</GText>
    </>
  );
}

type Input = ComponentRef<typeof TextInput>;
/** The describe field's name: distinct from the Mood page's "Mood" (Playwright's getByLabel matches parts of names). */
export const IDEA_FIELD = 'Describe what you want to watch';

/**
 * The field with its action inside it on the right (a keyboard never covers it), and under it one line of
 * fixed height: the rotating Try example while the field is empty (a tap writes it into the field with the
 * cursor at its end and sends nothing), what pressing the action does while it has words, or an error.
 */
function DescribeField({ value, onChange, onSubmit, ready, action, placeholder, hint, error, skip, locked }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; ready: boolean; action: string; placeholder: string; hint: string; error?: string; skip: readonly string[]; locked: boolean;
}) {
  const { phone, z } = useLayout();
  const input = useRef<Input>(null);
  const [focus, setFocus] = useState(false);
  const filled = value.length > 0;
  const t = useTry(skip, filled || Boolean(error));
  const h = phone ? 56 : z(60);
  const tryH = Math.max(48, z(34));
  const showTry = !filled && !error;
  const tryFade = useTo(showTry ? 1 : 0, 150);
  const lineFade = useTo(showTry ? 0 : 1, 150);
  const row = { height: tryH, minWidth: 0, maxWidth: '100%', alignSelf: 'flex-start', paddingHorizontal: 6, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8 } as const;
  const fill = (text: string) => {
    onChange(text);
    const el = input.current as (Input & { setSelectionRange?: (a: number, b: number) => void }) | null;
    el?.focus();
    setTimeout(() => { if (el?.setSelectionRange) el.setSelectionRange(text.length, text.length); else el?.setSelection?.(text.length, text.length); }, 0);
  };
  return (
    <View>
      <View style={{ height: h, borderRadius: 18, paddingLeft: phone ? 16 : z(20), paddingRight: 6, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: focus ? '#ffffff12' : '#ffffff0b', borderWidth: 1, borderColor: focus ? glow.amber : warm.lineStrong, opacity: locked ? 0.6 : 1 }}>
        <TextInput ref={input} accessibilityLabel={IDEA_FIELD} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={warm.placeholder}
          editable={!locked} maxLength={IDEA_LIMITS.max} autoCorrect={false} spellCheck={false} returnKeyType="done" submitBehavior="submit" onSubmitEditing={onSubmit} selectionColor={glow.amber} cursorColor={glow.amber}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{ flex: 1, minWidth: 0, height: h - 2, padding: 0, borderWidth: 0, backgroundColor: 'transparent', color: glow.ink, fontFamily: 'Gabarito', fontSize: phone ? 17 : z(18), ...webField } as TextStyle} />
        <HoverPress label={action} hover="lighten" repeatable disabled={!ready} onPress={onSubmit}
          style={{ width: phone ? 92 : z(100), height: h - 14, minHeight: 0, borderRadius: 12, backgroundColor: ready ? glow.amber : warm.faint, borderWidth: 1, borderColor: ready ? glow.amber : warm.lineStrong }}>
          <GText bold size={phone ? 16 : z(16)} color={ready ? warm.ink : glow.ink}>{action}</GText>
        </HoverPress>
      </View>
      <View testID="try" style={{ height: tryH }}>
        <Animated.View {...t.hold} pointerEvents={showTry ? 'auto' : 'none'} aria-hidden={!showTry || undefined} style={{ height: tryH, opacity: tryFade }}>
          <Crossfade k={t.text} height={tryH} render={(text, leaving) => (leaving ? <View style={row}><TryWords text={text} /></View> : (
            <HoverPress label={`Try ${text}`} hint="Writes this into the field" hover="none" repeatable disabled={locked} onPress={() => fill(text)} style={row}><TryWords text={text} /></HoverPress>
          ))} />
        </Animated.View>
        <Animated.View testID="field-line" pointerEvents="none" aria-hidden={showTry || undefined} accessibilityLiveRegion={error ? 'polite' : 'none'}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: tryH, opacity: lineFade }}>
          <View style={row}><GText size={phone ? 14 : z(14)} color={error ? '#fca5a5' : glow.muted} lines={1} style={{ flexShrink: 1 }}>{error ?? hint}</GText></View>
        </Animated.View>
      </View>
    </View>
  );
}

/**
 * Your idea for the couch (a friend's is a wish): one each. With none yet the action reads Add; with one it
 * reads Replace and sends edit_idea for yours, which also switches it back on.
 */
export const IdeaField = roomPart('IdeaField', (r) => ({
  view: r.view, cmd: r.cmd, disabled: r.disabled, latest: r.latest,
  pending: r.state.pending, send: r.state.send, privateError: r.state.privateError, retrySeconds: r.state.retrySeconds, errorCode: r.state.errorCode,
}), function IdeaField({ view, cmd, disabled, latest, pending, send, privateError, retrySeconds, errorCode }) {
  const { phone, wide } = useLayout();
  const [text, setText] = useState('');
  const sent = useRef('');
  const ideaSave = useIdeaSave({
    view, cmd, disabled, latest, state: { pending, send, privateError, retrySeconds, errorCode },
    // Saved: the words leave the field (unless more were typed meanwhile).
    onSaved: () => setText((t) => (t.trim() === sent.current ? '' : t)),
  });
  if (!view) return null;
  const host = view.isHost;
  const word = host ? 'idea' : 'wish';
  const mine = view.myIdea;
  const clean = text.trim();
  const full = !mine && !view.canAddIdea;
  const ready = clean.length >= IDEA_LIMITS.min && !ideaSave.blocked && !full && !(mine && mine.text === clean && mine.on);
  const submit = () => { if (!ready) return; sent.current = clean; ideaSave.save(clean); };
  const placeholder = mine ? `Replace your ${word}` : phone || wide ? 'Describe a mood or a plot' : 'Describe a mood, a theme, or a plot';
  const hint = full ? `Up to ${IDEA_LIMITS.perRoom} ideas on a couch.` : mine ? `Replaces your ${word}, “${mine.text}”.` : `One ${word} each. You can replace yours later.`;
  return (
    <View style={{ gap: 8 }}>
      <SectionHead id="mood" title={host ? 'What are you in the mood for?' : 'Got a wish?'} />
      <DescribeField value={text} onChange={setText} onSubmit={submit} ready={ready} action={mine ? 'Replace' : 'Add'} placeholder={placeholder}
        hint={hint} error={ideaSave.error} skip={view.ideas.map((i) => i.text)} locked={ideaSave.saving} />
    </View>
  );
});

// ————— Movies / Shows / Both —————

type Pick3 = 'movie' | 'show' | 'both';
const KIND_ORDER: [Pick3, string, string][] = [['movie', 'Movies', 'Movies'], ['show', 'Shows', 'Shows'], ['both', 'Both', 'Movies and shows']];
const pickOf = (kinds: Kind[]): Pick3 => (kinds.includes('movie') && kinds.includes('show_start') ? 'both' : kinds.includes('show_start') ? 'show' : 'movie');
const kindsOf = (p: Pick3): Kind[] => (p === 'both' ? ['movie', 'show_start'] : p === 'movie' ? ['movie'] : ['show_start']);

/** One row: the label and a three-way switch whose thumb slides under the choice. Only the host changes it. */
export const KindSwitch = roomPart('KindSwitch', (r) => ({ view: r.view, saves: r.saves }), function KindSwitch({ view, saves }) {
  const { phone, z } = useLayout();
  const h = Math.max(48, z(44));
  const width = phone ? 222 : z(246);
  const seg = (width - 8) / 3;
  const kinds = saves.drafts.kinds ?? view?.kinds ?? [];
  const value = pickOf(kinds);
  const x = useTo(KIND_ORDER.findIndex(([k]) => k === value) * seg, 220);
  if (!view) return null;
  const host = view.isHost;
  return (
    <View testID="head-kind" style={{ height: h, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <GText bold size={phone ? 16 : z(16)} lines={1} style={{ flex: 1 }}>Movies or shows</GText>
      <View accessibilityRole="radiogroup" accessibilityLabel="Movies, shows, or both" style={{ width, height: h, padding: 3, borderRadius: 12, backgroundColor: '#00000040', borderWidth: 1, borderColor: warm.line, opacity: host ? 1 : 0.7 }}>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 3, top: 3, width: seg, height: h - 8, borderRadius: 9, backgroundColor: '#ffffff16', borderWidth: 1, borderColor: warm.lineStrong, transform: [{ translateX: x }] }} />
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {KIND_ORDER.map(([k, label, name]) => (
            <HoverPress key={k} role="radio" checked={k === value} label={name} quiet={!host} hover={k === value || !host ? 'none' : 'tint'} repeatable
              onPress={() => { if (k !== value) saves.release('kinds', kindsOf(k)); }} style={{ width: seg, minWidth: 0, height: h - 8, minHeight: 0, borderRadius: 9 }}>
              <GText bold={k === value} size={phone ? 14 : z(14)} color={k === value ? glow.ink : glow.muted} lines={1}>{label}</GText>
            </HoverPress>
          ))}
        </View>
      </View>
    </View>
  );
});

// ————— Streaming —————

/** The couch's services in one row: the host's opens Streaming (Your services while there are none, amber), a friend's opens Your services. */
export const StreamingRow = roomPart('StreamingRow', (r) => ({ view: r.view, openSheet: r.openSheet }), function StreamingRow({ view, openSheet }) {
  const { phone, z } = useLayout();
  const { all } = useServices(view?.country);
  if (!view) return null;
  const on = servicesIn(all, view.enabledServiceIds);
  const h = Math.max(48, z(44));
  // The catalog is still loading: the row stays blank instead of saying "none" and then changing its words.
  const loading = !all.length && view.enabledServiceIds.length > 0;
  const missing = !loading && !on.length && view.isHost;
  const names = on.length ? namesLine(on) : missing ? 'Add your services' : loading ? '' : 'Nobody’s yet';
  // The host decides the couch's services (Streaming); a friend brings their own (Your services).
  const sheet = missing || !view.isHost ? 'services' : 'streaming';
  return (
    <View style={{ height: h, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <GText bold size={phone ? 16 : z(16)} lines={1}>Streaming</GText>
      <HoverPress label={missing ? 'Streaming services, add' : `${on.length ? names : 'Streaming'}, change`} hover="lighten" repeatable onPress={() => openSheet(sheet)}
        style={{ flex: 1, minWidth: 0, height: h, paddingLeft: 12, paddingRight: 10, borderRadius: 12, flexDirection: 'row', justifyContent: 'flex-start', gap: 8, backgroundColor: missing ? warm.amberSoft : 'transparent', borderWidth: 1, borderColor: missing ? warm.amberLine : warm.line }}>
        {on.length ? <Logos services={on} size={z(22)} /> : missing ? <Glyph name="plus" size={z(16)} color={glow.amber} /> : null}
        <GText size={phone ? 14 : z(14)} bold={missing} color={missing ? glow.amber : glow.soft} lines={1} style={{ flex: 1 }}>{names}</GText>
        <GText bold size={z(13)} color={missing ? glow.amber : glow.muted}>{missing ? 'Add' : 'Change'}</GText>
      </HoverPress>
    </View>
  );
});

// ————— Preview —————

const FAN = 5;
const fanAt = (i: number) => (i - (FAN - 1) / 2) * 4.5;
const dropAt = (i: number) => Math.round(((i - (FAN - 1) / 2) ** 2) * 1.6);
const fanWidth = (w: number) => Math.round(w * (1 + (FAN - 1) * 0.84)) + 14;

/** A small poster (or a card back while the couch has no cards yet). */
function MiniCard({ title, w }: { title: Candidate | null; w: number }) {
  return (
    <View style={{ width: w, height: w * 1.5, borderRadius: Math.max(4, w * 0.08), overflow: 'hidden', backgroundColor: warm.well, borderWidth: 1, borderColor: '#ffffff24', alignItems: 'center', justifyContent: 'center' }}>
      {title?.posterUrl ? <Image source={{ uri: title.posterUrl }} accessible={false} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
        : <View style={{ width: w * 0.5, height: w * 0.5, borderRadius: w * 0.25, borderWidth: 1.5, borderColor: '#ffffff26' }} />}
    </View>
  );
}

/** Five cards in a fan, peeking up from the bottom of a box of `show` height. A card that changes rises in. */
function Fan({ deck, w, show }: { deck: readonly Candidate[]; w: number; show: number }) {
  const cards = Array.from({ length: FAN }, (_, i) => deck[i] ?? null);
  return (
    <View pointerEvents="none" style={{ width: fanWidth(w), height: show, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 7, top: 9, flexDirection: 'row', height: w * 1.5 }}>
        {cards.map((t, i) => (
          <View key={`fan-${i}-${t?.id ?? 'back'}`} style={{ marginLeft: i ? -w * 0.16 : 0 }}>
            <Rise rise={16} delay={i * 30}>
              <View style={{ transform: [{ translateY: dropAt(i) }, { rotate: `${fanAt(i)}deg` }] }}><MiniCard title={t} w={w} /></View>
            </Rise>
          </View>
        ))}
      </View>
    </View>
  );
}

const previewWords = (deck: readonly Candidate[]) => (deck.length ? 'Cards like these get dealt' : 'Cards get dealt when you start');
const previewName = (deck: readonly Candidate[]) => (deck.length ? `Preview: cards like ${deck.slice(0, FAN).map((t) => t.title).join(', ')}` : 'Preview: cards get dealt when you start');

/** The preview in the console's left pane (wide windows): a box that fills the rest of the pane. */
export const DeckPreview = roomPart('DeckPreview', (r) => ({ deck: r.view?.deck }), function DeckPreview({ deck = [] }) {
  const { z } = useLayout();
  const w = z(96);
  return (
    <View testID="preview" accessible accessibilityRole="image" accessibilityLabel={previewName(deck)} style={{ height: z(38) + w * 1.5 + 18, borderRadius: 14, overflow: 'hidden', backgroundColor: '#00000038', borderWidth: 1, borderColor: warm.line }}>
      <View style={{ height: z(38), paddingHorizontal: z(14), flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <GText bold size={z(13)} color={glow.soft}>Preview</GText>
        <GText size={z(13)} color={glow.muted} lines={1} style={{ flex: 1 }}>{previewWords(deck)}</GText>
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, top: z(40), alignItems: 'center' }}>
        <Fan deck={deck} w={w} show={w * 1.5 + 16} />
      </View>
    </View>
  );
});

/** The preview as one labeled strip (phones): what it is on the left, the fan on the right. */
export const DeckStrip = roomPart('DeckStrip', (r) => ({ deck: r.view?.deck }), function DeckStrip({ deck = [] }) {
  const height = 80;
  return (
    <View testID="preview" accessible accessibilityRole="image" accessibilityLabel={previewName(deck)} style={{ height, flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden', paddingLeft: 14, borderRadius: 14, backgroundColor: '#00000038', borderWidth: 1, borderColor: warm.line }}>
      <View style={{ flex: 1, minWidth: 0, justifyContent: 'center', gap: 1 }}>
        <GText bold size={13} color={glow.soft} lines={1}>Preview</GText>
        <GText size={13} color={glow.muted} lines={2}>{previewWords(deck)}</GText>
      </View>
      <View style={{ justifyContent: 'flex-end' }}><Fan deck={deck} w={46} show={height - 2} /></View>
    </View>
  );
});

// ————— Ideas —————

/** "Mia’s wish": the host's ideas are ideas, everyone else's are wishes. */
export const whose = (idea: IdeaView) =>
  idea.mine ? (idea.author?.host ? 'Your idea' : 'Your wish') : `${idea.author?.nickname || 'Someone'}’s ${idea.author?.host ? 'idea' : 'wish'}`;
const UNMATCHED = 'Mood matching is unavailable for now';
/** Under the words: what the server understood, or that it couldn't read it. */
const readingLine = (idea: IdeaView) => (idea.unmatched ? UNMATCHED : idea.reading);
const ideaName = (idea: IdeaView) => [idea.text, whose(idea), readingLine(idea)].filter(Boolean).join('. ');
export const countLine = (ideas: readonly IdeaView[]) => (ideas.length ? `${ideas.length} ${ideas.length === 1 ? 'idea' : 'ideas'}, ${ideas.filter((i) => i.on).length} on` : 'No ideas yet');
export const EMPTY_IDEAS = 'Leave it empty for well-liked picks, or add an idea to steer the cards.';

/** A switch's look. The thumb slides (transform), amber fades in (opacity). `dim`: shown, but not yours to flip. */
function SwitchLook({ on, dim }: { on: boolean; dim: boolean }) {
  const x = useTo(on ? 16 : 0, 160);
  const fill = useTo(on ? 1 : 0, 160);
  return (
    <View style={{ width: 40, height: 24, borderRadius: 12, backgroundColor: '#ffffff1a', borderWidth: 1, borderColor: warm.lineStrong, opacity: dim ? 0.5 : 1 }}>
      <Animated.View style={{ position: 'absolute', left: -1, top: -1, right: -1, bottom: -1, borderRadius: 12, backgroundColor: glow.amber, opacity: fill }} />
      <Animated.View style={{ position: 'absolute', left: 2, top: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: on ? warm.ink : '#d4d4d4', transform: [{ translateX: x }] }} />
    </View>
  );
}

/** One idea's box: the host's flips it (the whole box is the switch, 48 px or taller); everyone else's only shows it. */
function IdeaBox({ idea, host, disabled, toggle, style, children }: { idea: IdeaView; host: boolean; disabled: boolean; toggle: (idea: IdeaView) => void; style: object; children: ReactNode }) {
  return host ? (
    <HoverPress role="switch" checked={idea.on} label={ideaName(idea)} hint={idea.on ? 'Switches it off' : 'Switches it on'} hover="tint" repeatable disabled={disabled} onPress={() => toggle(idea)} style={style}>{children}</HoverPress>
  ) : <View accessible accessibilityRole="group" accessibilityLabel={`${ideaName(idea)}. ${idea.on ? 'On' : 'Off'}`} style={style}>{children}</View>;
}

/** An idea as a full-width row (wide windows): face, words, whose and the reading, the switch. */
function IdeaRow({ idea, host, disabled, toggle, height, line }: { idea: IdeaView; host: boolean; disabled: boolean; toggle: (idea: IdeaView) => void; height: number; line: boolean }) {
  const { z } = useLayout();
  const reading = readingLine(idea);
  const box = { height, minWidth: 0, alignSelf: 'stretch', paddingHorizontal: z(12), borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: z(12) } as const;
  return (
    <View testID={`idea-${idea.id}`} style={{ height }}>
      {line ? <View style={{ position: 'absolute', left: z(12), right: z(12), top: 0, height: 1, backgroundColor: warm.line }} /> : null}
      <ChangeGlow text={idea.text} radius={11} />
      <Rise>
        <IdeaBox idea={idea} host={host} disabled={disabled} toggle={toggle} style={box}>
          {idea.author ? <Face person={idea.author} size={z(28)} /> : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Crossfade k={idea.text} height={z(20)} render={(text) => <GText bold size={z(15)} color={idea.on ? glow.ink : glow.muted} lines={1}>{text}</GText>} />
            <GText size={z(12)} color={glow.muted} lines={1}>{whose(idea)}</GText>
            <View testID={idea.unmatched ? 'idea-unmatched' : undefined}><GText size={z(12)} color={idea.unmatched ? '#d6b98a' : '#8c8478'} lines={1}>{reading || ' '}</GText></View>
          </View>
          <SwitchLook on={idea.on} dim={!host} />
        </IdeaBox>
      </Rise>
    </View>
  );
}

const TILE_W = 184;
const TILE_H = 100;
const TILE_GAP = 8;

/** An idea as a tile (phones): face, whose and the switch on top, the words, the reading under them. */
function IdeaTile({ idea, host, disabled, toggle }: { idea: IdeaView; host: boolean; disabled: boolean; toggle: (idea: IdeaView) => void }) {
  const reading = readingLine(idea);
  const box = { width: TILE_W, height: TILE_H, minWidth: 0, minHeight: 0, padding: 10, borderRadius: 14, alignItems: 'stretch', justifyContent: 'flex-start', gap: 4, backgroundColor: '#ffffff0d', borderWidth: 1, borderColor: idea.on ? warm.amberLine : warm.lineStrong } as const;
  return (
    <Rise>
      <View testID={`idea-${idea.id}`} style={{ width: TILE_W, height: TILE_H }}>
        <IdeaBox idea={idea} host={host} disabled={disabled} toggle={toggle} style={box}>
          <View style={{ height: 24, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            {idea.author ? <Face person={idea.author} size={22} /> : null}
            <GText size={12} color={glow.muted} lines={1} style={{ flex: 1 }}>{whose(idea)}</GText>
            <SwitchLook on={idea.on} dim={!host} />
          </View>
          <Crossfade k={idea.text} height={18} render={(text) => <GText bold size={14} color={idea.on ? glow.ink : glow.muted} lines={1}>{text}</GText>} />
          <View testID={idea.unmatched ? 'idea-unmatched' : undefined}><GText size={12} color={idea.unmatched ? '#d6b98a' : '#8c8478'} lines={2} style={{ lineHeight: 15 }}>{reading}</GText></View>
        </IdeaBox>
        <ChangeGlow text={idea.text} radius={14} />
      </View>
    </Rise>
  );
}

function EmptyIdeas({ dashed = false }: { dashed?: boolean }) {
  const { phone, z } = useLayout();
  const size = phone ? 14 : z(15);
  return (
    <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: phone ? 20 : z(28) }, dashed ? { borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#ffffff24' } : null]}>
      <GText size={size} color={glow.muted} style={{ textAlign: 'center', lineHeight: size * 1.4 }}>{EMPTY_IDEAS}</GText>
    </View>
  );
}

/** Rows the wide panel shows before it scrolls inside itself. */
const PANEL_ROWS = 6;
export const panelRowHeight = (z: (n: number) => number) => z(62);

function useToggle(cmd: { setIdea: (id: string, on: boolean) => Promise<boolean> }) {
  return (idea: IdeaView) => void cmd.setIdea(idea.id, !idea.on);
}

/** Ideas on wide windows: a box of fixed height inside the console, one row per person. */
export const IdeasPanel = roomPart('IdeasPanel', (r) => ({ view: r.view, cmd: r.cmd, disabled: r.disabled }), function IdeasPanel({ view, cmd, disabled }) {
  const { z } = useLayout();
  const toggle = useToggle(cmd);
  if (!view) return null;
  const rowH = panelRowHeight(z);
  return (
    <View testID="idea-list" style={{ flex: 1, minHeight: PANEL_ROWS * rowH, gap: 8 }}>
      <SectionHead id="ideas" title="Ideas" meta={countLine(view.ideas)} />
      <View style={{ flex: 1, minHeight: 0 }}>
        {view.ideas.length ? (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {view.ideas.map((idea, i) => <IdeaRow key={idea.id} idea={idea} host={view.isHost} disabled={disabled} toggle={toggle} height={rowH} line={i > 0} />)}
          </ScrollView>
        ) : <EmptyIdeas />}
      </View>
    </View>
  );
});

/** Ideas on phones: a tray of fixed height in the dock, tiles in one line. A new or replaced idea scrolls into view. */
export const IdeasTray = roomPart('IdeasTray', (r) => ({ view: r.view, cmd: r.cmd, disabled: r.disabled }), function IdeasTray({ view, cmd, disabled }) {
  const toggle = useToggle(cmd);
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const seen = useRef<Record<string, string>>({});
  const ideas = view?.ideas ?? [];
  const sig = ideas.map((i) => `${i.id}:${i.text}`).join('|');
  useEffect(() => {
    const at = ideas.findIndex((i) => seen.current[i.id] !== i.text);
    const first = !Object.keys(seen.current).length;
    seen.current = Object.fromEntries(ideas.map((i) => [i.id, i.text]));
    if (!first && at >= 0 && ideas.length > 1) ref.current?.scrollTo({ x: Math.max(0, at * (TILE_W + TILE_GAP) - TILE_GAP), animated: true });
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!view) return null;
  return (
    <View testID="idea-list" style={{ gap: 6 }}>
      <SectionHead id="ideas" title="Ideas" meta={countLine(ideas)} />
      <View style={{ height: TILE_H }}>
        {ideas.length ? (
          <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: TILE_GAP }}>
            {ideas.map((idea) => <IdeaTile key={idea.id} idea={idea} host={view.isHost} disabled={disabled} toggle={toggle} />)}
          </ScrollView>
        ) : <EmptyIdeas dashed />}
      </View>
    </View>
  );
});

/** The two-pane console card (wide windows). `foot` closes the right pane (Start, or a friend's waiting line). */
export function ConsoleCard({ left, right, foot }: { left: ReactNode; right: ReactNode; foot?: ReactNode }) {
  const { z } = useLayout();
  const pad = z(18);
  return (
    <View testID="console" style={{ flexDirection: 'row', borderRadius: R.card + 4, backgroundColor: warm.panel, borderWidth: 1, borderColor: warm.lineStrong, overflow: 'hidden' }}>
      <View style={{ flex: 1, minWidth: 0, padding: pad, gap: z(14) }}>{left}</View>
      <View style={{ width: z(340), padding: pad, gap: z(16), borderLeftWidth: 1, borderLeftColor: warm.line, backgroundColor: '#00000030' }}>
        {right}
        {foot}
      </View>
    </View>
  );
}

