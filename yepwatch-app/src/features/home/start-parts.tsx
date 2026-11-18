/**
 * The start page's pieces (rethink.md screens 1 and 2): the centered headline, the first visit's statement tile, the
 * set-up page's tall New couch tile and its inline Join field, and the page layout around them. Wide windows put the
 * headline and actions left, the intro film and install codes right (spread so the codes' bottom edge meets the left
 * column's last control); narrower ones stack headline, film, actions, install.
 */
import { useState, type ReactNode } from 'react';
import { Platform, TextInput, View, type TextStyle } from 'react-native';
import { parseInvite } from '../../core/invites';
import { GText, Icon, glow } from '../glow/theme';
import { AMBER_LIFT, HoverPress, Nudge, useHovered, webOnly } from '../shell/hover';
import { useLayout } from '../shell/layout';
import { noun } from '../shell/noun';
import { R, warm } from '../shell/tokens';
import { IntroFilm } from './IntroFilm';
import { QrCard, StoreButton, installable, stores } from './install';

export function Headline({ size }: { size: number }) {
  return (
    <GText bold size={size} style={{ textAlign: 'center', letterSpacing: -size * 0.03, lineHeight: size * 1.08 }}>
      Choose something to watch, <GText bold size={size} color={glow.amber}>together.</GText>
    </GText>
  );
}

export function Or() {
  const { z } = useLayout();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: warm.line }} /><GText size={z(13)} color={glow.muted}>or</GText><View style={{ flex: 1, height: 1, backgroundColor: warm.line }} />
    </View>
  );
}

/** The ink circle with an amber arrow that slides forward on hover. */
function ArrowDot({ size }: { size: number }) {
  return (
    <Nudge dx={5} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: warm.ink, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="right" size={size * 0.42} color={glow.amber} />
    </Nudge>
  );
}

/** First visit: the one big amber statement that starts setup (name, then a few Taste cards). */
export function StatementTile({ onPress, disabled, quiet }: { onPress: () => void; disabled?: boolean; quiet?: boolean }) {
  const { phone, wide, z } = useLayout();
  const box = phone ? 44 : z(56);
  const word = phone ? 34 : z(wide ? 46 : 52);
  const line = { size: z(16), color: warm.ink, style: { opacity: 0.8 } } as const;
  return (
    <HoverPress label="Start with you" hint="Your name and what you like. About a minute." onPress={onPress} disabled={disabled} quiet={quiet} hover="lift" shadow={AMBER_LIFT}
      style={{ alignSelf: 'stretch', minHeight: phone ? 230 : z(300), alignItems: 'stretch', justifyContent: 'space-between', gap: phone ? 18 : z(24), padding: phone ? 20 : z(30), borderRadius: R.card, backgroundColor: glow.amber }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: box, height: box, borderRadius: 12, backgroundColor: '#20140014', alignItems: 'center', justifyContent: 'center' }}><Icon name="heartFilled" size={box * 0.5} color={warm.ink} /></View>
        <GText bold size={z(14)} color={warm.ink} style={{ opacity: 0.7 }}>About a minute</GText>
      </View>
      <View style={{ gap: phone ? 8 : z(10) }}>
        <GText bold size={word} color={warm.ink} style={{ letterSpacing: -word * 0.03, lineHeight: word * 1.04 }}>Start with you</GText>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <GText {...line}>Your name and what you like.</GText>
            <GText {...line}>Then pick with friends any time.</GText>
          </View>
          <ArrowDot size={box} />
        </View>
      </View>
    </HoverPress>
  );
}

const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
/** A web transition on transform and opacity with its own length and curve. */
const motion = (ms: number, ease = 'cubic-bezier(0.22, 1, 0.36, 1)') => webOnly({ transitionProperty: 'transform, opacity', transitionDuration: `${ms}ms`, transitionTimingFunction: ease });

/** New couch's ink dot: it swells a little (springy) and its arrow slides while the tile is hovered. */
function SwellDot({ size }: { size: number }) {
  const on = useHovered();
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: warm.ink, alignItems: 'center', justifyContent: 'center' }, motion(320, SPRING), { transform: [{ scale: on ? 1.14 : 1 }] }]}>
      <View style={[motion(260), { transform: [{ translateX: on ? 2 : 0 }] }]}><Icon name="right" size={size * 0.42} color={glow.amber} /></View>
    </View>
  );
}

/** A soft amber rim and glow around New couch, fading in on hover (its own layer: only opacity animates). */
function Halo() {
  const on = useHovered();
  return <View pointerEvents="none" aria-hidden style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: R.card, opacity: on ? 1 : 0 }, motion(on ? 280 : 420), webOnly({ boxShadow: '0 0 0 1px rgba(253,230,138,0.6), 0 12px 32px rgba(251,191,36,0.18)' })]} />;
}

/** What New does, in one line of three steps (short words on phones, so the line never wraps). */
function Steps({ short, size }: { short: boolean; size: number }) {
  const color = '#201400b3';
  const steps = [
    { word: short ? 'Invite' : 'Invite friends', icon: <Icon name="people" size={size} color={color} /> },
    { word: short ? 'Swipe' : 'Everyone swipes', icon: <Icon name="heart" size={size * 0.94} color={color} /> },
    { word: short ? 'Match' : 'Get a match', icon: <Icon name="check" size={size} color={color} /> },
  ];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, rowGap: 4 }}>
      {steps.map((st, k) => (
        <View key={st.word} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>{st.icon}<GText bold size={size} color={color}>{st.word}</GText></View>
          {k < steps.length - 1 ? <Icon name="right" size={size * 0.8} color={color} /> : null}
        </View>
      ))}
    </View>
  );
}

/** Set up: the amber New couch tile. Its name and arrow on top, the three steps under; hover swells the arrow's dot and fades in a halo. */
export function NewTile({ onPress, disabled, quiet }: { onPress: () => void; disabled?: boolean; quiet?: boolean }) {
  const { phone, z } = useLayout();
  const word = phone ? 34 : z(44);
  const dot = phone ? 44 : z(52);
  const pad = phone ? 20 : z(28);
  return (
    <HoverPress label={noun.create} hint="Invite friends, everyone swipes, get a match" onPress={onPress} disabled={disabled} quiet={quiet} hover="none"
      style={{ alignSelf: 'stretch', alignItems: 'stretch', borderRadius: R.card }}>
      <Halo />
      <View style={{ alignSelf: 'stretch', minHeight: phone ? 168 : z(200), justifyContent: 'space-between', gap: pad / 2, padding: pad, borderRadius: R.card, backgroundColor: glow.amber }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <GText bold size={word} color={warm.ink} lines={1} style={{ flexShrink: 1, letterSpacing: -word * 0.03, lineHeight: word * 1.05 }}>{noun.create}</GText>
          <SwellDot size={dot} />
        </View>
        <Steps short={phone} size={phone ? 15 : z(15)} />
      </View>
    </HoverPress>
  );
}

const webField = (Platform.OS === 'web' ? { outlineStyle: 'none', caretColor: glow.amber } : {}) as TextStyle;
/** A code is complete enough to send: a typed code, or a YepWatch invitation link. */
export const joinableCode = (code: string) => parseInvite(code).length >= 4;

/** Join right on the start page: a code or a pasted invitation link, with Join beside the field (never under a keyboard). */
export function JoinCodeField({ onJoin, me, busy, disabled, initial = '' }: { onJoin: (code: string) => void; me: string | null; busy?: boolean; disabled?: boolean; initial?: string }) {
  const { phone, z } = useLayout();
  const [code, setCode] = useState(initial);
  const [focus, setFocus] = useState(false);
  const ok = joinableCode(code);
  const go = () => { if (ok && !busy && !disabled) onJoin(code.trim()); };
  return (
    <View testID="join-code" style={{ gap: 10, padding: phone ? 14 : z(18), borderRadius: R.card, backgroundColor: warm.raised, borderWidth: 1, borderColor: warm.lineStrong }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: phone ? 34 : z(40), height: phone ? 34 : z(40), borderRadius: 12, backgroundColor: warm.amberSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="door" size={(phone ? 34 : z(40)) * 0.54} color={glow.amber} /></View>
        <View style={{ flex: 1 }}>
          <GText bold size={phone ? 17 : z(19)}>{noun.joinAny}</GText>
          <GText size={z(13)} color={glow.muted}>Type the code from the invite, or paste the link.</GText>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput accessibilityLabel="Code or invitation link" value={code} onChangeText={setCode} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onSubmitEditing={go}
          autoCapitalize="characters" autoCorrect={false} autoComplete="off" placeholder="Code or link" placeholderTextColor={warm.placeholder} returnKeyType="go" enterKeyHint="go" selectionColor={glow.amber} submitBehavior="blurAndSubmit"
          style={{ flex: 1, minWidth: 0, height: z(52), borderRadius: R.control, paddingHorizontal: 16, backgroundColor: warm.faint, borderWidth: 1, borderColor: focus ? glow.amber : warm.lineStrong, color: glow.ink, fontFamily: 'GabaritoBold', fontSize: z(17), letterSpacing: code ? 3 : 0, ...webField } as TextStyle} />
        <HoverPress label={busy ? 'Joining…' : me ? `Join as ${me}` : 'Join'} disabled={!ok || disabled} quiet={busy} onPress={go}
          style={{ height: z(52), minWidth: z(92), paddingHorizontal: phone ? 16 : z(20), borderRadius: R.control, flexDirection: 'row', gap: 6, backgroundColor: glow.amber }}>
          <GText bold size={z(16)} color={warm.ink}>{busy ? 'Joining…' : 'Join'}</GText>
          {busy ? null : <Nudge><Icon name="right" size={z(16)} color={warm.ink} /></Nudge>}
        </HoverPress>
      </View>
    </View>
  );
}

/**
 * The start page body: `top` over the headline (the next-day question), `actions` under it (the statement tile, or
 * New couch and Join), `prompt` under those (or + GoodWatch). `obscured`: the film waits behind the startup cover.
 */
export function StartPage({ actions, prompt, top, obscured, testID }: { actions: ReactNode; prompt?: ReactNode; top?: ReactNode; obscured: boolean; testID: string }) {
  const { wide, phone, width, max, z } = useLayout();
  if (wide) {
    const gap = z(64);
    const col = (max - gap) / 2;
    const qr = Math.min(z(220), (col - z(16)) / 2);
    return (
      <View testID={testID} style={{ gap: z(32) }}>
        {top}
        <View style={{ flexDirection: 'row', gap, alignItems: 'stretch' }}>
          <View style={{ flex: 1, gap: z(32), paddingTop: z(8) }}>
            <Headline size={z(60)} />
            {actions}
            {prompt}
          </View>
          <View style={{ flex: 1, gap: z(28), paddingTop: z(24), alignItems: 'center', justifyContent: installable ? 'space-between' : 'flex-start' }}>
            <View style={{ alignSelf: 'stretch' }}><IntroFilm obscured={obscured} height={col * 0.56} width={col} /></View>
            {installable ? <View style={{ flexDirection: 'row', gap: z(16), justifyContent: 'center' }}>{stores.map((st) => <QrCard key={st.platform} store={st} width={qr} />)}</View> : null}
          </View>
        </View>
      </View>
    );
  }
  return (
    <View testID={testID} style={{ gap: phone ? 20 : 28 }}>
      {top}
      <Headline size={phone ? (width < 360 ? 30 : 36) : 52} />
      <IntroFilm obscured={obscured} height={phone ? 200 : 300} width={max} />
      {actions}
      {prompt}
      {installable && phone ? (
        <View style={{ gap: 20 }}>
          <Or />
          <View style={{ flexDirection: 'row', gap: 10 }}>{stores.map((st) => <StoreButton key={st.platform} store={st} />)}</View>
        </View>
      ) : installable ? (
        <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center' }}>{stores.map((st) => <QrCard key={st.platform} store={st} width={Math.min(220, (max - 16) / 2)} />)}</View>
      ) : null}
    </View>
  );
}
