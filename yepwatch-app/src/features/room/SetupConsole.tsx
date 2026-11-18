/**
 * The couch setup's Ideas card: a fan of cards resting on its top edge, then "What are you in the mood
 * for?" (a friend reads "Got a wish?") with the describe field and one rotating Try example under it,
 * then one compact row per idea that says what it does to the cards. Movies or shows and Streaming live
 * in Settings (the dock). Nothing moves when an example rotates, an idea is replaced or switched, or the
 * field takes focus; a new idea adds a row.
 */
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Animated, Easing, Image, Platform, TextInput, View, type TextStyle } from 'react-native';
import type { Candidate } from '@goodwatch/yepwatch-contracts/proposal';
import { useReducedMotion } from '../../components/ui';
import { GText, Icon, glow, native } from '../glow/theme';
import { HoverPress, useHovered } from '../shell/hover';
import { useLayout } from '../shell/layout';
import { noun } from '../shell/noun';
import { R, warm } from '../shell/tokens';
import { IDEA_LIMITS, type IdeaView } from './model';
import { TRY_EXAMPLES } from './MoodComposer';
import { useIdeaSave } from './idea-save';
import { webField } from './parts';
import { roomPart, useRoomLive } from './RoomProvider';
import { Face } from './invite';
import { usePosterPreview } from './poster-preview';

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

export function SectionHead({ id, title }: { id: string; title: string }) {
  const { phone, z } = useLayout();
  return (
    <View testID={`head-${id}`} style={{ height: phone ? 24 : z(24), flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <GText bold size={phone ? 16 : z(16)} lines={1} style={{ flex: 1 }}>{title}</GText>
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
        <Icon name="up" size={11} color={color} />
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
  // The action inside keeps a 48 px target: the field is 14 px taller than it.
  const h = Math.max(62, z(62));
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
          style={{ width: phone ? 92 : z(100), height: h - 14, borderRadius: R.control, backgroundColor: ready ? glow.amber : warm.faint, borderWidth: 1, borderColor: ready ? glow.amber : warm.lineStrong }}>
          {['Add', 'Replace'].map((label) => <GText key={label} bold size={phone ? 16 : z(16)} color={ready ? warm.ink : glow.ink} style={{ position: 'absolute', width: '100%', textAlign: 'center', opacity: action === label ? 1 : 0 }} aria-hidden={action !== label}>{label}</GText>)}
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
  const hint = full ? `Up to ${IDEA_LIMITS.perRoom} ideas on ${noun.a}.` : mine ? `Replaces your ${word}, “${mine.text}”.` : `One ${word} each. You can replace yours later.`;
  return (
    <View style={{ gap: 8 }}>
      <SectionHead id="mood" title={host ? 'What are you in the mood for?' : 'Got a wish?'} />
      <DescribeField value={text} onChange={setText} onSubmit={submit} ready={ready} action={mine ? 'Replace' : 'Add'} placeholder={placeholder}
        hint={hint} error={ideaSave.error} skip={view.ideas.map((i) => i.text)} locked={ideaSave.saving} />
    </View>
  );
});

// ————— The fan —————

const FAN = 5;
const fanAt = (i: number) => (i - (FAN - 1) / 2) * 4.5;
const dropAt = (i: number) => Math.round(((i - (FAN - 1) / 2) ** 2) * 1.6);
/** Room on each side for the outer cards' tilt (a 9° card leans out about a fifth of its width). */
const fanPad = (w: number) => Math.ceil(w * 0.25);
const fanWidth = (w: number) => Math.round(w * (1 + (FAN - 1) * 0.84)) + 2 * fanPad(w);

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
      <View style={{ position: 'absolute', left: fanPad(w), top: 9, flexDirection: 'row', height: w * 1.5 }}>
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

const previewName = (deck: readonly Candidate[]) => (deck.length ? `Preview: cards like ${deck.slice(0, FAN).map((t) => t.title).join(', ')}` : 'Preview: cards get dealt when you start');

/** The fan, centered, its lower part tucked behind the top edge of the Ideas card. */
const DeckFan = roomPart('DeckFan', (r) => ({ deck: r.view?.deck, access: r.state.access }), function DeckFan({ deck: dealt = [], access }) {
  const { confirmed } = useRoomLive();
  const shared = confirmed?.shared;
  const preview = usePosterPreview(access, shared);
  const deck = dealt.length ? dealt : preview;
  const { phone, z } = useLayout();
  const w = phone ? 62 : z(70);
  const tuck = Math.round(w * 0.22);
  return (
    <View testID="preview" accessible accessibilityRole="image" accessibilityLabel={previewName(deck)} style={{ alignItems: 'center', marginBottom: -tuck, zIndex: 0 }}>
      <Fan deck={deck} w={w} show={Math.round(w * 1.05)} />
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
/** What an idea does to the cards now: what it steers them toward, or that it's off. */
const effectLine = (idea: IdeaView) => {
  if (!idea.on) return 'Off, not used for the cards';
  if (idea.unmatched) return UNMATCHED;
  return idea.reading ? `Steers the cards: ${idea.reading}` : 'Steers the cards';
};
export const countLine = (ideas: readonly IdeaView[]) => (ideas.length ? `${ideas.length} ${ideas.length === 1 ? 'idea' : 'ideas'}, ${ideas.filter((i) => i.on).length} on` : 'No ideas yet');

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

/** One idea's box: the host's flips it (the whole row is the switch, 48 px or taller); everyone else's only shows it. */
function IdeaBox({ idea, host, disabled, toggle, style, children }: { idea: IdeaView; host: boolean; disabled: boolean; toggle: (idea: IdeaView) => void; style: object; children: ReactNode }) {
  return host ? (
    <HoverPress role="switch" checked={idea.on} label={ideaName(idea)} hint={idea.on ? 'Switches it off' : 'Switches it on'} hover="tint" repeatable disabled={disabled} onPress={() => toggle(idea)} style={style}>{children}</HoverPress>
  ) : <View accessible accessibilityRole={Platform.OS === 'web' ? 'group' : undefined} accessibilityLabel={`${ideaName(idea)}. ${idea.on ? 'On' : 'Off'}`} style={style}>{children}</View>;
}

/** One idea as a compact row: face, the words, whose it is and what it does to the cards, the switch. */
function IdeaRow({ idea, host, disabled, toggle, line }: { idea: IdeaView; host: boolean; disabled: boolean; toggle: (idea: IdeaView) => void; line: boolean }) {
  const { phone, z } = useLayout();
  const s = (n: number) => (phone ? n : z(n));
  const box = { minHeight: Math.max(56, s(56)), minWidth: 0, alignSelf: 'stretch', paddingHorizontal: 4, borderRadius: R.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: s(11) } as const;
  return (
    <View testID={`idea-${idea.id}`}>
      {line ? <View style={{ height: 1, marginHorizontal: 4, backgroundColor: warm.line }} /> : null}
      <View>
        <ChangeGlow text={idea.text} radius={R.control} />
        <Rise>
          <IdeaBox idea={idea} host={host} disabled={disabled} toggle={toggle} style={box}>
            {idea.author ? <Face person={idea.author} size={s(26)} /> : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Crossfade k={idea.text} height={Math.ceil(s(15) * 1.35)} render={(text) => <GText bold size={s(15)} color={idea.on ? glow.ink : glow.muted} lines={1}>{text}</GText>} />
              <View testID={idea.unmatched ? 'idea-unmatched' : undefined}>
                <GText size={s(12)} color={idea.on && idea.unmatched ? '#d6b98a' : idea.on ? '#a39a8c' : '#7a7266'} lines={1}>{`${whose(idea)} · ${effectLine(idea)}`}</GText>
              </View>
            </View>
            <SwitchLook on={idea.on} dim={!host} />
          </IdeaBox>
        </Rise>
      </View>
    </View>
  );
}

/**
 * The couch's Ideas in one card: the fan on its top edge, the describe field, then one row per idea (the
 * host's switch them on and off). With no ideas the card is the field alone: its Try line says what to do.
 */
export const IdeasCard = roomPart('IdeasCard', (r) => ({ view: r.view, cmd: r.cmd, disabled: r.disabled }), function IdeasCard({ view, cmd, disabled }) {
  const { phone, z } = useLayout();
  if (!view) return null;
  const toggle = (idea: IdeaView) => void cmd.setIdea(idea.id, !idea.on);
  return (
    <View testID="console">
      <DeckFan />
      <View style={{ gap: 6, padding: phone ? 14 : z(18), borderRadius: R.card + 4, backgroundColor: warm.panel, borderWidth: 1, borderColor: warm.lineStrong }}>
        <IdeaField />
        {view.ideas.length ? (
          <View testID="idea-list">
            <View style={{ height: 1, marginTop: -4, backgroundColor: warm.line }} />
            {view.ideas.map((idea, i) => <IdeaRow key={idea.id} idea={idea} host={view.isHost} disabled={disabled} toggle={toggle} line={i > 0} />)}
          </View>
        ) : null}
      </View>
    </View>
  );
});
