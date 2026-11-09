/**
 * First visit (direction D): the left-aligned headline, the big New room and Join a room tiles,
 * Continue with GoodWatch for guests, and the intro film. Desktop browsers add the two install QR
 * cards, phone browsers the store buttons; the installed app shows no install section. Wide windows:
 * headline and tiles left, film and codes right.
 */
import { useContext } from 'react';
import { View } from 'react-native';
import { BootPhase } from './boot-phase';
import { BootReveal } from './BootReveal';
import { IntroFilm } from './IntroFilm';
import { QrCard, StoreButton, installable, stores } from './install';
import { Headline, Or, Tiles, type TileActions } from './start-parts';
import { GText, Press, glow } from '../glow/theme';
import { GoodWatchMark } from '../shell/marks';
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
    <Press label={label} hint={detail} onPress={onPress} disabled={disabled} quiet={quiet}
      style={{ alignSelf: 'stretch', minHeight: height + 16, paddingVertical: 8, paddingHorizontal: 12, borderRadius: R.control, flexDirection: 'row', gap: 10, backgroundColor: '#242424', borderWidth: 1, borderColor: glow.line }}>
      <GoodWatchMark size={mark + 4} />
      <View style={{ flexShrink: 1 }}>
        <GText bold size={words} lines={1}>{label}</GText>
        <GText size={Math.max(13, Math.round(words * 0.78))} color={glow.muted} lines={2}>{detail}</GText>
      </View>
    </Press>
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
        <GoodWatchMark size={18} />
        <Press label={RECONNECT_GOODWATCH} hint={RECONNECTED_DETAIL} onPress={onPress} disabled={disabled} style={{ minHeight: 40, paddingHorizontal: 8 }}>
          <GText size={14} bold color={glow.amber}>{RECONNECT_GOODWATCH}</GText>
        </Press>
      </View>
      <GText size={13} color={glow.muted}>{RECONNECTED_DETAIL}</GText>
    </View>
  );
}
/** What reconnecting brings back, wherever a lapsed member sees Reconnect GoodWatch. */
export const RECONNECTED_DETAIL = 'Brings your streaming services back';

export interface LandingActions extends TileActions {
  signIn?: () => void;
  /** A GoodWatch sign-in is already starting: the button waits. */
  signingIn?: boolean;
  /** The session ran out: `signIn` reconnects, as the small Reconnect GoodWatch. */
  lapsed?: boolean;
}

/** The start page's GoodWatch prompt: the guest button, or Reconnect for a lapsed member. */
export function StartSignIn({ signIn, signingIn, lapsed, disabled, quiet, height }: { signIn: () => void; signingIn?: boolean; lapsed?: boolean; disabled?: boolean; quiet?: boolean; height: number }) {
  return lapsed
    ? <ReconnectPrompt onPress={signIn} disabled={disabled || signingIn} />
    : <GoodWatchButton height={height} detail="Brings your streaming services" onPress={signIn} disabled={disabled || signingIn} quiet={quiet && !signingIn} />;
}

export function Landing(actions: LandingActions) {
  const phase = useContext(BootPhase);
  const { wide, phone, width, max, z } = useLayout();
  // The film starts as the page appears, not behind the boot word.
  const obscured = phase === 'boot';
  const signIn = actions.signIn ? <StartSignIn height={z(54)} signIn={actions.signIn} signingIn={actions.signingIn} lapsed={actions.lapsed} disabled={actions.disabled} quiet={actions.quiet} /> : null;
  if (wide) {
    const gap = z(64);
    const col = (max - gap) / 2;
    const qr = Math.min(z(220), (col - z(16)) / 2);
    return (
      <View testID="landing" style={{ flexDirection: 'row', gap, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: z(32), paddingTop: z(8) }}>
          <BootReveal index={0}><Headline size={z(60)} /></BootReveal>
          <BootReveal index={1}><Tiles {...actions} height={z(200)} /></BootReveal>
          {signIn ? <BootReveal index={2}>{signIn}</BootReveal> : null}
        </View>
        <View style={{ flex: 1, gap: z(28), alignItems: 'center' }}>
          <BootReveal index={1} style={{ alignSelf: 'stretch' }}><IntroFilm obscured={obscured} height={col * 0.56} width={col} /></BootReveal>
          {installable ? <BootReveal index={3} style={{ flexDirection: 'row', gap: z(16), justifyContent: 'center' }}>{stores.map((st) => <QrCard key={st.platform} store={st} width={qr} />)}</BootReveal> : null}
        </View>
      </View>
    );
  }
  return (
    <View testID="landing" style={{ gap: phone ? 20 : 28 }}>
      <BootReveal index={0}><Headline size={phone ? (width < 360 ? 30 : 36) : 52} /></BootReveal>
      <BootReveal index={1}><IntroFilm obscured={obscured} height={phone ? 200 : 300} width={max} /></BootReveal>
      <BootReveal index={2}><Tiles {...actions} height={phone ? 128 : 180} /></BootReveal>
      {signIn ? <BootReveal index={3}>{signIn}</BootReveal> : null}
      {installable && phone ? (
        <BootReveal index={4} style={{ gap: 20 }}>
          <Or />
          <View style={{ flexDirection: 'row', gap: 10 }}>{stores.map((st) => <StoreButton key={st.platform} store={st} />)}</View>
        </BootReveal>
      ) : installable ? (
        <BootReveal index={4} style={{ flexDirection: 'row', gap: 16, justifyContent: 'center' }}>{stores.map((st) => <QrCard key={st.platform} store={st} width={Math.min(220, (max - 16) / 2)} />)}</BootReveal>
      ) : null}
    </View>
  );
}
