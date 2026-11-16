/**
 * The match moment: whenever the room gets a new match, every phone in it shows MATCH for about a second, the same
 * way: the matched poster tilted on the stage, warmed up, and an amber MATCH band sweeping across it.
 * `a` runs 0 → 1 (in) → 2 (out).
 */
import { FxView } from './fx-view';
import { Animated, View } from 'react-native';
import { fitTo, type Geo } from './geometry';
import { PosterCopy } from './shapes';
import { Word } from './Word';
import { amber, fill, hidden, ink } from './paint';

export interface MomentProps {
  g: Geo;
  posterUrl: string | null;
  a: Animated.Value;
  reduced: boolean;
  /** Off for a moment built ahead and still waiting (its seat carries the test id once it plays). */
  testID?: string;
}

export function Moment({ testID = 'match-moment', g, posterUrl, a, reduced }: MomentProps) {
  const inOut = a.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] });
  const scale = reduced ? 1 : a.interpolate({ inputRange: [0, 1, 2], outputRange: [0.7, 1, 1.08] });
  const full = g.vw;
  // The word stays on screen and clear of the question column (`words`, the window width when the stage is centered).
  const s = Math.min(fitTo('MATCH', Math.min(full - 24, g.phone ? full : g.w * 1.5, g.words)), g.h * 0.42);
  const pw = g.w * 0.62;
  return (
    <View {...hidden} testID={testID || undefined} style={fill}>
      <FxView style={{ position: 'absolute', left: -g.ext, width: full, top: 0, height: g.stageH, alignItems: 'center', opacity: inOut }}>
        <FxView style={{ position: 'absolute', top: g.cardTop + (g.h - pw * 1.5) / 2, width: pw, height: pw * 1.5, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1a1610', transform: [{ scale }, { rotate: '-4deg' }] }}>
          <PosterCopy uri={posterUrl} css="saturate(1.8) brightness(1.12) sepia(0.28)" tints={[{ color: '#ff9f1a', opacity: 0.2 }]} />
        </FxView>
        <FxView style={{ position: 'absolute', top: g.cy - s * 0.75, left: -full * 0.1, width: full * 1.2, height: s * 1.5, backgroundColor: amber, alignItems: 'center', justifyContent: 'center',
          transform: [{ rotate: '-8deg' }, { translateX: reduced ? 0 : a.interpolate({ inputRange: [0, 1, 2], outputRange: [-full * 0.6, 0, full * 0.3] }) }] }}>
          <Word text="MATCH" size={s} color={ink} />
        </FxView>
      </FxView>
    </View>
  );
}
