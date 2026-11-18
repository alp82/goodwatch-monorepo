/**
 * Setup from the first visit's statement tile (rethink.md screen 1): your name, then about ten Taste cards ("What do
 * you like?"), then back to the start page, set up. It never creates a couch. "That's enough" (after five answers) or
 * "Skip for now" ends the cards early; every answer given is kept.
 *
 * Keyboard (spec item 8): the name field is the real input with nothing over or around it that moves, so a tap opens
 * the keyboard on phones; nothing focuses it from code on mobile web (a focus without a tap opens no keyboard there).
 * Continue is the frame's pinned action, which the root layout keeps above the keyboard (visual-viewport.web.ts).
 */
import { useEffect, useState } from 'react';
import { Platform, TextInput, View, type TextStyle } from 'react-native';
import { tasteProfile } from '../../core/continuous/taste-profile';
import { ErrorText, GText, Icon, glow } from '../glow/theme';
import { NAME_MAX } from '../room/model';
import { fieldStyleFor } from '../room/parts';
import { AppFrame } from '../shell/Frame';
import type { HeaderMe } from '../shell/Header';
import { HoverPress, Nudge } from '../shell/hover';
import { useLayout } from '../shell/layout';
import { R, warm } from '../shell/tokens';
import { ENOUGH_ANSWERS, FIRST_RUN_CARDS, TASTE_ANSWERS } from '../taste/answers';
import { StrengthMeter } from '../taste/StrengthMeter';
import { LiveDeck, useTasteCards, type DrawCard } from '../taste/TasteDeck';
import { TasteCard } from '../taste/TasteCard';
import { TextAction } from '../taste/TasteMode';

type Step = 'name' | 'taste';
const STEPS = ['Name', 'Taste'] as const;

function Heading({ title, sub }: { title: string; sub: string }) {
  const { phone, z } = useLayout();
  const size = phone ? 32 : z(44);
  return (
    <View style={{ gap: 6 }}>
      <GText bold size={size} style={{ letterSpacing: -0.8, lineHeight: size * 1.08 }}>{title}</GText>
      <GText size={z(16)} color={glow.soft}>{sub}</GText>
    </View>
  );
}

function StepDots({ step }: { step: number }) {
  const { z } = useLayout();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Step ${step + 1} of ${STEPS.length}, ${STEPS[step]}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {STEPS.map((name, k) => {
        const done = k < step;
        const on = k === step;
        return (
          <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: z(22), height: z(22), borderRadius: z(11), alignItems: 'center', justifyContent: 'center', backgroundColor: done ? glow.amber : on ? warm.amberSoft : 'transparent', borderWidth: 1, borderColor: done || on ? glow.amber : warm.lineStrong }}>
              {done ? <Icon name="check" size={z(12)} color={warm.ink} /> : <GText bold size={z(12)} color={on ? glow.amber : glow.muted}>{String(k + 1)}</GText>}
            </View>
            <GText bold={on} size={z(13)} color={on ? glow.ink : glow.muted}>{name}</GText>
            {k < STEPS.length - 1 ? <View style={{ width: z(18), height: 1, backgroundColor: warm.lineStrong }} /> : null}
          </View>
        );
      })}
    </View>
  );
}

/** The frame's main action: amber, or the outlined secondary. */
function MainAction({ label, onPress, disabled, secondary, arrow }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; arrow?: boolean }) {
  const { z } = useLayout();
  return (
    <HoverPress label={label} onPress={onPress} disabled={disabled}
      style={{ alignSelf: 'stretch', minHeight: z(54), borderRadius: R.control, paddingHorizontal: 18, flexDirection: 'row', gap: 9, backgroundColor: secondary ? warm.faint : glow.amber, borderWidth: 1, borderColor: secondary ? warm.lineStrong : glow.amber }}>
      <GText bold size={z(17)} color={secondary ? glow.ink : warm.ink}>{label}</GText>
      {arrow ? <Nudge><Icon name="right" size={18} color={warm.ink} /></Nudge> : null}
    </HoverPress>
  );
}

function drawWithCount(count: string): DrawCard {
  return function drawCard(t, o) {
    return <TasteCard t={t} w={o.w} answers={TASTE_ANSWERS} onAnswer={o.onAnswer} disabled={o.disabled} dragPicture={!o.disabled} count={o.disabled ? undefined : count} />;
  };
}

function NameStep({ name, setName, next }: { name: string; setName: (v: string) => void; next: () => void }) {
  const { phone, z } = useLayout();
  const [focus, setFocus] = useState(false);
  const webField = Platform.OS === 'web' ? { caretColor: glow.amber } : {};
  return (
    <>
      <Heading title="What should we call you?" sub="Friends see this name when you pick together." />
      <TextInput accessibilityLabel="Your name" value={name} onChangeText={setName} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onSubmitEditing={next}
        autoFocus={!(Platform.OS === 'web' && phone)} maxLength={NAME_MAX} autoCapitalize="words" autoComplete="nickname" inputMode="text" enterKeyHint="next" returnKeyType="next" submitBehavior="submit"
        placeholder="Your name" placeholderTextColor={warm.placeholder} selectionColor={glow.amber} style={{ ...fieldStyleFor(z, focus), height: z(56), ...webField } as TextStyle} />
    </>
  );
}

export function FirstRun({ initialName, me, saveName, back, done }: {
  initialName: string;
  me: HeaderMe;
  /** Saves the name for this device (it's set up from then on). */
  saveName: (name: string) => Promise<void>;
  /** Back from the first step: the start page as it was. */
  back: () => void;
  /** Setup is over: the start page, set up. */
  done: () => void;
}) {
  const { phone, z } = useLayout();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const deck = useTasteCards(FIRST_RUN_CARDS);
  const n = deck.answered.length;
  const finish = () => { void tasteProfile.flush(); done(); };
  // The last card answered: its exit plays, the end card shows a moment, then the start page.
  useEffect(() => {
    if (step !== 'taste' || !deck.done || !n) return;
    const t = setTimeout(finish, 900);
    return () => clearTimeout(t);
  }, [step, deck.done, n]); // eslint-disable-line react-hooks/exhaustive-deps
  const trimmed = name.trim();
  const next = () => {
    if (!trimmed || saving) return;
    setSaving(true);
    void saveName(trimmed).then(() => setStep('taste'), () => undefined).finally(() => setSaving(false));
  };
  const goal = deck.total || FIRST_RUN_CARDS;
  const count = `${Math.min(deck.index + 1, goal)} of ${goal}`;
  let body;
  let footer;
  if (step === 'name') {
    body = <NameStep name={name} setName={setName} next={next} />;
    footer = <MainAction label="Continue" arrow disabled={!trimmed} onPress={next} />;
  } else {
    body = (
      <>
        <Heading title="What do you like?" sub="A few quick cards so later picks fit you better." />
        <StrengthMeter rated={n} goal={goal} compact />
        {deck.loading ? <View style={{ minHeight: phone ? 400 : z(560) }} /> : deck.failed ? (
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 40 }}>
            <ErrorText bold size={z(18)}>Cards didn’t load</ErrorText>
            <TextAction label="Try again" color={glow.amber} onPress={deck.retry} />
          </View>
        ) : (
          <LiveDeck current={deck.current} index={deck.index} answered={deck.answered} onAnswer={deck.answer} draw={drawWithCount(count)}
            end={(
              <View style={{ alignItems: 'center', gap: 10, paddingVertical: z(40) }}>
                <Icon name="check" size={z(30)} color={glow.amber} />
                <GText bold size={z(20)}>{n ? 'Profile ready' : 'No cards right now'}</GText>
                <GText size={z(15)} color={glow.muted}>{n ? `${n} ${n === 1 ? 'answer' : 'answers'}. You can add more any time.` : 'You can tune your taste any time from your profile.'}</GText>
              </View>
            )} />
        )}
        <View style={{ height: 48, alignItems: 'center' }}>{n && !deck.done ? <TextAction label="Undo" onPress={deck.undo} /> : null}</View>
      </>
    );
    // The last answer moves on by itself; an empty deck keeps the way out.
    footer = deck.done && n ? null : <MainAction secondary label={n >= ENOUGH_ANSWERS ? 'That’s enough' : 'Skip for now'} onPress={finish} />;
  }
  return (
    <AppFrame testID="first-run" header={{ back: step === 'name' ? back : () => setStep('name'), me }} width={z(step === 'taste' ? 760 : 620)} gap={phone ? 22 : z(26)} footer={footer}>
      <StepDots step={step === 'name' ? 0 : 1} />
      {body}
    </AppFrame>
  );
}
