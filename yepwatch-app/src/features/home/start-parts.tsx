/**
 * The start page's pieces (rethink.md screens 1 and 2): the centered headline, the first visit's statement tile, the
 * set-up page's tall New couch tile and its inline Join field, and the page layout around them. Wide windows put the
 * headline and actions left, the intro film and install codes right (spread so the codes' bottom edge meets the left
 * column's last control); narrower ones stack headline, film, actions, install.
 */
import { useState, type ReactNode } from 'react';
import { Platform, TextInput, View, type TextStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { parseInvite } from '../../core/invites';
import { GText, Icon, glow } from '../glow/theme';
import { AMBER_LIFT, HoverPress, Nudge } from '../shell/hover';
import { useLayout } from '../shell/layout';
import { noun } from '../shell/noun';
import { R, warm } from '../shell/tokens';
import { Heart } from '../taste/icons';
import { IntroFilm } from './IntroFilm';
import { QrCard, StoreButton, installable, stores } from './install';

export function Headline({ size }: { size: number }) {
  return (
    <GText bold size={size} style={{ textAlign: 'center', letterSpacing: -size * 0.03, lineHeight: size * 1.08 }}>
      Choose something to watch, <GText bold size={size} color={glow.amber}>together.</GText>
    </GText>
  );
}

function Glyph({ d, size, color, weight = 2 }: { d: string; size: number; color: string; weight?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" accessible={false}><Path d={d} /></Svg>;
}
const PLUS = 'M12 5v14M5 12h14';
const DOOR = 'M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H3';

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
        <View style={{ width: box, height: box, borderRadius: 12, backgroundColor: '#20140014', alignItems: 'center', justifyContent: 'center' }}><Heart size={box * 0.5} color={warm.ink} filled /></View>
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

/** What New does, in three beats: a list on phones and wide windows, a row in between. */
function ThreeBeats({ vertical }: { vertical: boolean }) {
  const { z } = useLayout();
  const beats = [
    { word: 'Invite friends', icon: <Icon name="people" size={z(16)} color={warm.ink} /> },
    { word: 'Everyone swipes', icon: <Heart size={z(15)} color={warm.ink} /> },
    { word: 'Get a match', icon: <Icon name="check" size={z(16)} color={warm.ink} /> },
  ];
  return (
    <View style={{ flexDirection: vertical ? 'column' : 'row', alignItems: vertical ? 'flex-start' : 'center', gap: vertical ? 8 : z(10), flexWrap: 'wrap' }}>
      {beats.map((b, k) => (
        <View key={b.word} style={{ flexDirection: 'row', alignItems: 'center', gap: z(10) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: z(34), paddingLeft: 8, paddingRight: 12, borderRadius: 10, backgroundColor: '#2014001a' }}>
            <View style={{ width: z(22), height: z(22), borderRadius: z(11), backgroundColor: '#20140014', alignItems: 'center', justifyContent: 'center' }}>{b.icon}</View>
            <GText bold size={z(15)} color={warm.ink}>{b.word}</GText>
          </View>
          {!vertical && k < beats.length - 1 ? <Icon name="right" size={z(14)} color={warm.ink} /> : null}
        </View>
      ))}
    </View>
  );
}

/** Set up: the tall amber New couch tile with the three beats inside. */
export function NewTile({ onPress, disabled, quiet }: { onPress: () => void; disabled?: boolean; quiet?: boolean }) {
  const { phone, wide, z } = useLayout();
  const box = phone ? 40 : z(48);
  const word = (phone ? 28 : z(38)) * 1.1;
  return (
    <HoverPress label={noun.create} hint="Invite friends, everyone swipes, get a match" onPress={onPress} disabled={disabled} quiet={quiet} hover="lift" shadow={AMBER_LIFT}
      style={{ alignSelf: 'stretch', height: phone ? 270 : z(wide ? 320 : 280), alignItems: 'stretch', justifyContent: 'space-between', gap: phone ? 12 : z(16), padding: phone ? 18 : z(26), borderRadius: R.card, backgroundColor: glow.amber, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: box, height: box, borderRadius: 12, backgroundColor: '#20140014', alignItems: 'center', justifyContent: 'center' }}><Glyph d={PLUS} size={box * 0.58} color={warm.ink} weight={2.4} /></View>
        <ArrowDot size={box} />
      </View>
      <View style={{ flex: 1, minHeight: 0, justifyContent: 'center' }}><ThreeBeats vertical={phone || wide} /></View>
      <GText bold size={word} color={warm.ink} lines={2} style={{ letterSpacing: -word * 0.03, lineHeight: word * 1.05 }}>{noun.create}</GText>
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
        <View style={{ width: phone ? 34 : z(40), height: phone ? 34 : z(40), borderRadius: 12, backgroundColor: warm.amberSoft, alignItems: 'center', justifyContent: 'center' }}><Glyph d={DOOR} size={(phone ? 34 : z(40)) * 0.54} color={glow.amber} /></View>
        <View style={{ flex: 1 }}>
          <GText bold size={phone ? 17 : z(19)}>{noun.joinAny}</GText>
          <GText size={z(13)} color={glow.muted}>Type the code from the invite, or paste the link.</GText>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput accessibilityLabel="Code or invitation link" value={code} onChangeText={setCode} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onSubmitEditing={go}
          autoCapitalize="characters" autoCorrect={false} autoComplete="off" placeholder="Code or link" placeholderTextColor={warm.placeholder} returnKeyType="go" enterKeyHint="go" selectionColor={glow.amber} submitBehavior="blurAndSubmit"
          style={{ flex: 1, minWidth: 0, height: z(52), borderRadius: 12, paddingHorizontal: 16, backgroundColor: warm.faint, borderWidth: 1, borderColor: focus ? glow.amber : warm.lineStrong, color: glow.ink, fontFamily: 'GabaritoBold', fontSize: z(17), letterSpacing: code ? 3 : 0, ...webField } as TextStyle} />
        <HoverPress label={busy ? 'Joining…' : me ? `Join as ${me}` : 'Join'} disabled={!ok || disabled} quiet={busy} onPress={go}
          style={{ height: z(52), minWidth: z(92), paddingHorizontal: phone ? 16 : z(20), borderRadius: 12, flexDirection: 'row', gap: 6, backgroundColor: glow.amber }}>
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
