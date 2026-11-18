/**
 * Your Yeps: a button in the voting bar (a check, the count and your newest three posters) and on Tonight
 * ("Your 6 Yeps"), opening a sheet with every title you said Yep to this round (own-yeps.ts), newest
 * first. Matches carry a Match tag, the decided title a Tonight tag. While the round runs, a Yep the room
 * still holds can become a Nope (and back) from its row; the rows stay put while the sheet is open, a
 * changed one struck through. Only you see it: friends' answers never show.
 */
import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { GText, Icon, glow } from '../glow/theme';
import { ScorePill } from '../glow/scores';
import { HoverPress } from '../shell/hover';
import { useLayout } from '../shell/layout';
import { Sheet } from '../shell/Sheet';
import { R, warm } from '../shell/tokens';
import { Poster, meta } from './Decide';
import { useOwnYeps, type OwnYep } from './own-yeps';
import { useRoom, useRoomLive } from './RoomProvider';

export const yepCount = (n: number) => `${n} ${n === 1 ? 'Yep' : 'Yeps'}`;

/**
 * The voting bar's button, `width` wide whatever it holds (a Yep arriving moves nothing); `compact` (narrow
 * phones at large font scales) drops the posters. On Tonight (`tonight`) it reads "Your 6 Yeps".
 */
export function YepsButton({ onPress, width, compact = false, tonight = false }: { onPress: () => void; width?: number; compact?: boolean; tonight?: boolean }) {
  const yeps = useOwnYeps(useRoomLive().snapshot);
  const { z } = useLayout();
  const { fontScale } = useWindowDimensions();
  const countWidth = Math.ceil(z(15) * Math.max(1, fontScale) * 0.56 * 2);
  const n = yeps.length;
  const pw = tonight ? 20 : 16;
  return (
    <HoverPress testID="yeps-button" label={`Your Yeps, ${n}`} hint="Shows every title you said Yep to" hover="lighten" repeatable onPress={onPress}
      visual={{ width, height: tonight ? z(48) : z(36), paddingHorizontal: 10, borderRadius: R.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 7, backgroundColor: '#fbbf2414', borderWidth: 1, borderColor: warm.amberLine }}>
      <Icon name="check" size={z(15)} color={glow.amber} />
      <GText bold size={z(15)} color={glow.amber} lines={1} style={tonight ? undefined : { width: countWidth, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{tonight ? `Your ${yepCount(n)}` : String(n)}</GText>
      {!compact && n ? (
        <View accessible={false} style={{ position: 'relative', width: pw * 1.9 + 3, height: pw * 1.5 + 3 }}>
          {yeps.slice(0, 3).map((y, k) => (
            <View key={y.id} style={{ position: 'absolute', left: 0, top: 0, transform: [{ translateX: k * pw * 0.45 }], zIndex: 3 - k, borderRadius: 3, borderWidth: 1.5, borderColor: '#14110d' }}>
              <Poster c={y} width={pw} radius={2} label={false} />
            </View>
          ))}
        </View>
      ) : null}
    </HoverPress>
  );
}

/** A small amber tag: Match, or Tonight on the decided title. */
function Tag({ tonight }: { tonight: boolean }) {
  return (
    <View style={{ paddingHorizontal: 7, height: 20, borderRadius: 10, backgroundColor: tonight ? glow.amber : '#fbbf2422', borderWidth: 1, borderColor: glow.amber, justifyContent: 'center' }}>
      <GText bold size={11} color={tonight ? warm.ink : glow.amber}>{tonight ? 'Tonight' : 'Match'}</GText>
    </View>
  );
}

export function YepsSheet({ onClose }: { onClose: () => void }) {
  const { snapshot } = useRoomLive();
  const { cmd, disabled } = useRoom();
  const yeps = useOwnYeps(snapshot);
  const { z } = useLayout();
  // The rows as they were when the sheet opened: one changed to Nope stays (struck), so nothing jumps.
  const [rows] = useState<OwnYep[]>(() => yeps);
  if (!snapshot) return null;
  const voting = snapshot.shared.phase === 'choosing';
  const held = new Set(snapshot.shared.candidates.map((c) => c.id));
  // Still a Yep: in your Yeps now (a row changed to Nope stays out even after the room retires its card).
  const now = new Set(yeps.map((y) => y.id));
  const yes = (y: OwnYep) => now.has(y.id);
  const matches = new Set(snapshot.shared.matches.map((m) => m.candidateId));
  const decided = snapshot.shared.decision?.candidateId ?? null;
  const n = rows.filter(yes).length;
  const matched = rows.filter((y) => yes(y) && matches.has(y.id)).length;
  const intro = !rows.length ? 'Every title you say Yep to shows up here.'
    : `${matched ? `${matched} of them ${matched === 1 ? 'is a match' : 'are matches'}. ` : ''}Only you see this list.`;
  return (
    <Sheet title={rows.length ? `Your ${yepCount(n)}` : 'Your Yeps'} onClose={onClose} testID="yeps-sheet" width={560}>
      <GText size={z(14)} color={glow.soft}>{intro}</GText>
      {rows.length ? (
        <View>
          {rows.map((y, k) => {
            const on = yes(y);
            // Only a card the room still holds can change, and only while the round runs.
            const flips = voting && held.has(y.id);
            const tonight = y.id === decided;
            return (
              <View key={y.id} testID={`yep-${y.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: k ? 1 : 0, borderTopColor: warm.line }}>
                <View style={{ opacity: on ? 1 : 0.45 }}><Poster c={y} width={z(44)} radius={5} label={false} /></View>
                <View style={{ flex: 1, minWidth: 0, gap: 3, opacity: on ? 1 : 0.6 }}>
                  <GText bold size={z(15)} lines={1} style={on ? undefined : { textDecorationLine: 'line-through' }}>{y.title}</GText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ScorePill score={y.goodwatchScore} size="S" />
                    <GText size={z(12)} color={glow.muted} lines={1} style={{ flexShrink: 1 }}>{meta(y)}</GText>
                  </View>
                </View>
                {on && (tonight || matches.has(y.id)) ? <Tag tonight={tonight} /> : null}
                {flips ? (
                  <HoverPress label={on ? `Nope instead for ${y.title}` : `Yep again for ${y.title}`} hover="tint" repeatable disabled={disabled}
                    onPress={() => void cmd.vote(y.id, !on, null)}
                    visual={{ width: z(78), height: z(36), borderRadius: R.control, borderWidth: 1, borderColor: on ? '#ef444440' : warm.amberLine, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    <Icon name={on ? 'close' : 'check'} size={13} color={on ? '#f87171' : glow.amber} />
                    <GText bold size={z(13)} color={on ? glow.soft : glow.amber}>{on ? 'Nope' : 'Yep'}</GText>
                  </HoverPress>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </Sheet>
  );
}
