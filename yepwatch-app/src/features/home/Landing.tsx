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

/** The approved Sign in with GoodWatch look (dark surface, GoodWatch mark), worded Continue with GoodWatch. */
export function GoodWatchButton({ onPress, disabled, quiet, height = 50 }: { onPress: () => void; disabled?: boolean; quiet?: boolean; height?: number }) {
  return (
    <Press label="Continue with GoodWatch" onPress={onPress} disabled={disabled} quiet={quiet} style={{ minHeight: height, borderRadius: R.control, flexDirection: 'row', gap: 10, backgroundColor: '#242424', borderWidth: 1, borderColor: glow.line }}>
      <GoodWatchMark size={24} />
      <GText bold size={16}>Continue with GoodWatch</GText>
    </Press>
  );
}

export interface LandingActions extends TileActions { signIn?: () => void }

export function Landing(actions: LandingActions) {
  const phase = useContext(BootPhase);
  const { wide, phone, width, max, z } = useLayout();
  // The film starts as the page appears, not behind the boot word.
  const obscured = phase === 'boot';
  const signIn = actions.signIn ? <GoodWatchButton height={z(54)} onPress={actions.signIn} disabled={actions.disabled} quiet={actions.quiet} /> : null;
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
