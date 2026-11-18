/**
 * The matches peek: a drawer edge under Nope and Yep from the first card, so people learn where matches
 * land before there are any ("Matches land here"). Each match drops its poster onto the edge in a small
 * overlapping stack and the line turns into "2 matches" with "Open to see them" (desktop) or "Pull up to see
 * them" (phones, which also get a handle and the pull-up gesture). Opening it shows Matches, where people
 * say which ones they're in for, without waiting for the deck to end.
 *
 * Fixed height whatever it holds: a match arriving moves nothing. Its accessible name is the count
 * ("2 matches"), as the matches chip's was.
 */
import { memo, useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Image, PanResponder, View } from 'react-native';
import type { Candidate } from '@goodwatch/yepwatch-contracts/proposal';
import { useReducedMotion } from '../../components/ui';
import { playFeedback } from '../feedback/sounds';
import { GText, Icon, glow, native } from '../glow/theme';
import { HoverPress, Nudge } from '../shell/hover';
import { useLayout } from '../shell/layout';
import { useStableCallback } from '../shell/steady';
import { R, warm } from '../shell/tokens';
import { openPage } from './nav';

/** Each poster of the stack shows this share of the one under it. */
const FAN = 0.22;
const sized = (url: string | null) => (url ? url.replace('/w500/', '/w185/') : null);
export const matchCount = (n: number) => `${n} ${n === 1 ? 'match' : 'matches'}`;

/** One poster dropping onto the edge (opacity and a short fall), once, as its match arrives. */
function Drop({ children, x, z, entering }: { children: React.ReactNode; x: number; z: number; entering: boolean }) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(entering && !reduced ? 0 : 1));
  useEffect(() => {
    if (!entering || reduced) return;
    const run = Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: native });
    run.start();
    return () => run.stop();
  }, [v, entering, reduced]);
  return <Animated.View style={{ position: 'absolute', left: 0, top: 0, zIndex: z, opacity: v, transform: [{ translateX: x }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }}>{children}</Animated.View>;
}

export const MatchesPeek = memo(function MatchesPeek({ roomId, matches, proposal }: { roomId: string; matches: Candidate[]; proposal: boolean }) {
  const { phone, z } = useLayout();
  const n = matches.length;
  const lit = n > 0 || proposal;
  const open = useStableCallback(() => { if (!lit) return; playFeedback('matches'); openPage(roomId, 'matches'); });
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy < -6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderRelease: (_, g) => { if (g.dy < -24) open(); },
  }), [open]);
  // Posters that were already here when the screen opened don't fall again.
  const [known] = useState(() => new Set(matches.map((m) => m.id)));
  const pw = phone ? 24 : z(28);
  const shown = matches.slice(-4);
  const label = n ? matchCount(n) : 'Matches';
  return (
    <View testID="matches-peek" {...(phone ? pan.panHandlers : null)}>
      <HoverPress label={label} hint={lit ? 'Opens your matches' : undefined} disabled={!lit} dim={false} onPress={open}
        style={{ alignItems: 'stretch' }}
        visual={{ borderRadius: R.control, borderWidth: 1, borderColor: proposal ? glow.amber : n ? warm.amberLine : warm.line, backgroundColor: n ? '#fbbf240d' : 'transparent', paddingHorizontal: 12, paddingTop: phone ? 6 : 10, paddingBottom: phone ? 8 : 10 }}>
          <View style={{ gap: 6 }}>
            {phone ? <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: n ? '#fbbf2477' : '#ffffff2a' }} /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {/* As wide for one poster as for four: a match arriving moves nothing beside the stack. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', height: pw * 1.5, width: pw * (1 + FAN * 3) }}>
                {n ? shown.map((m, k) => {
                  const uri = sized(m.posterUrl);
                  return (
                    <Drop key={m.id} x={k * pw * FAN} z={k} entering={!known.has(m.id)}>
                      <View style={{ width: pw, height: pw * 1.5, borderRadius: 4, borderWidth: 1.5, borderColor: '#14110d', backgroundColor: warm.well, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                        {uri ? <Image source={{ uri }} accessible={false} style={{ width: '100%', height: '100%' }} /> : <Icon name="tickets" size={pw * 0.55} color={glow.amber} />}
                      </View>
                    </Drop>
                  );
                }) : (
                  <View style={{ width: pw, height: pw * 1.5, borderRadius: 4, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#ffffff33', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="tickets" size={pw * 0.55} color={glow.muted} />
                  </View>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <GText bold size={z(15)} lines={1} color={n ? glow.amber : glow.soft}>{n ? matchCount(n) : 'Matches land here'}</GText>
                <GText size={z(12)} lines={1} color={glow.muted}>{lit ? (phone ? 'Pull up to see them' : 'Open to see them') : 'When everyone says Yep'}</GText>
              </View>
              {lit ? <Nudge dx={0} dy={-2}><View style={{ transform: [{ rotate: '-90deg' }] }}><Icon name="right" size={z(16)} color={glow.amber} /></View></Nudge> : null}
            </View>
          </View>
      </HoverPress>
    </View>
  );
});
