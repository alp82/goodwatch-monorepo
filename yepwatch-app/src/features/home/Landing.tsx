/**
 * The start page (rethink.md screens 1 and 2). First visit: the centered headline, the intro film, the one statement
 * tile that starts setup, "or", then Continue with GoodWatch ("Brings your taste and services"). Set up: the tall New
 * couch tile and the inline Join field. Desktop browsers add the install QR cards, phone browsers the store buttons;
 * the installed app shows no install section.
 */
import { useContext, type ReactNode } from 'react';
import { View } from 'react-native';
import { BootPhase } from './boot-phase';
import { JoinCodeField, NewTile, Or, StartPage, StatementTile } from './start-parts';
import { GText, Icon, Press, glow, grow } from '../glow/theme';
import { HoverPress, Nudge } from '../shell/hover';
import { GoodWatchG } from '../shell/marks';
import { useLayout } from '../shell/layout';
import { R } from '../shell/tokens';

export const CONTINUE_WITH_GOODWATCH = 'Continue with GoodWatch';
export const RECONNECT_GOODWATCH = 'Reconnect GoodWatch';

/**
 * The approved Sign in with GoodWatch look (dark surface, GoodWatch mark), worded Continue with
 * GoodWatch (Reconnect GoodWatch once a session has run out). `detail` is one short line under the
 * words saying what it brings here; every place words its own. The accessible name stays the label,
 * the line is its hint.
 */
export function GoodWatchButton({ onPress, detail, label = CONTINUE_WITH_GOODWATCH, disabled, quiet, height = 50 }: {
  onPress: () => void; detail: string; label?: typeof CONTINUE_WITH_GOODWATCH | typeof RECONNECT_GOODWATCH; disabled?: boolean; quiet?: boolean; height?: number;
}) {
  // Scales with the button, so a tall button beside big tiles doesn't carry small words.
  const mark = Math.max(24, Math.round(height * 0.42));
  const words = Math.max(16, Math.round(height * 0.3));
  return (
    <HoverPress label={label} hint={detail} onPress={onPress} disabled={disabled} quiet={quiet}
      style={{ alignSelf: 'stretch', minHeight: height + 16, paddingVertical: 8, paddingLeft: 14, paddingRight: 16, borderRadius: R.control, flexDirection: 'row', gap: 12, backgroundColor: '#242424', borderWidth: 1, borderColor: glow.line }}>
      <GoodWatchG size={mark} />
      <View style={{ flexShrink: 1, flexGrow: 1 }}>
        <GText bold size={words} lines={1}>{label}</GText>
        <GText size={Math.max(13, Math.round(words * 0.78))} color={glow.muted} lines={2}>{detail}</GText>
      </View>
      <Nudge><Icon name="right" size={Math.round(words * 0.95)} color={glow.muted} /></Nudge>
    </HoverPress>
  );
}

/**
 * A lapsed member on the start page: the GoodWatch mark with the small amber Reconnect GoodWatch, and
 * the line saying what it brings back under it (not the big guest button: the name stays).
 */
export function ReconnectPrompt({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <View testID="start-reconnect" style={{ alignItems: 'center', gap: 2, paddingTop: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <GoodWatchG size={18} />
        <Press label={RECONNECT_GOODWATCH} hint={RECONNECTED_DETAIL} onPress={onPress} disabled={disabled} style={{ ...grow(40), paddingHorizontal: 8 }}>
          <GText size={14} bold color={glow.amber}>{RECONNECT_GOODWATCH}</GText>
        </Press>
      </View>
      <GText size={13} color={glow.muted}>{RECONNECTED_DETAIL}</GText>
    </View>
  );
}
/** What reconnecting brings back, wherever a lapsed member sees Reconnect GoodWatch. */
export const RECONNECTED_DETAIL = 'Brings your streaming services back';

export interface StartActions {
  newRoom: () => void;
  /** Joins with a typed code or a pasted link (the start page's own field). */
  joinCode: (code: string) => void;
  /** Starts setup (first visit). */
  setUp: () => void;
  signIn?: () => void;
  /** A GoodWatch sign-in is already starting: the button waits. */
  signingIn?: boolean;
  /** The session ran out: `signIn` reconnects, as the small Reconnect GoodWatch. */
  lapsed?: boolean;
  disabled?: boolean;
  /** A room is opening: the controls rest without dimming. */
  quiet?: boolean;
}

/** The start page's GoodWatch prompt: Continue with GoodWatch, or Reconnect for a lapsed member. */
export function StartSignIn({ signIn, signingIn, lapsed, disabled, quiet, height, detail = 'Brings your streaming services' }: { signIn: () => void; signingIn?: boolean; lapsed?: boolean; disabled?: boolean; quiet?: boolean; height: number; detail?: string }) {
  return lapsed
    ? <ReconnectPrompt onPress={signIn} disabled={disabled || signingIn} />
    : <GoodWatchButton height={height} detail={detail} onPress={signIn} disabled={disabled || signingIn} quiet={quiet && !signingIn} />;
}

/** First visit: the statement tile that starts setup, or Continue with GoodWatch. */
export function Landing(actions: StartActions & { top?: ReactNode }) {
  const phase = useContext(BootPhase);
  const { z } = useLayout();
  const prompt = actions.signIn ? (
    <View style={{ gap: z(16) }}>
      {actions.lapsed ? null : <Or />}
      <StartSignIn height={z(54)} detail="Brings your taste and services" signIn={actions.signIn} signingIn={actions.signingIn} lapsed={actions.lapsed} disabled={actions.disabled} quiet={actions.quiet} />
    </View>
  ) : null;
  return <StartPage testID="landing" obscured={phase === 'boot'} top={actions.top}
    actions={<StatementTile onPress={actions.setUp} disabled={actions.disabled} quiet={actions.quiet} />} prompt={prompt} />;
}

/** Set up: New couch and the Join field; a lapsed member's Reconnect GoodWatch under them. */
export function SetUpStart(actions: StartActions & { me: string | null; joining?: boolean; top?: ReactNode; code?: string }) {
  const phase = useContext(BootPhase);
  const { phone, z } = useLayout();
  const prompt = actions.signIn && actions.lapsed ? <StartSignIn height={z(54)} signIn={actions.signIn} signingIn={actions.signingIn} lapsed disabled={actions.disabled} quiet={actions.quiet} /> : null;
  return <StartPage testID="home-start" obscured={phase === 'boot'} top={actions.top} prompt={prompt}
    actions={(
      <View style={{ gap: phone ? 12 : z(16) }}>
        <NewTile onPress={actions.newRoom} disabled={actions.disabled} quiet={actions.quiet} />
        <JoinCodeField onJoin={actions.joinCode} me={actions.me} busy={actions.joining} disabled={actions.disabled} initial={actions.code} />
      </View>
    )} />;
}
