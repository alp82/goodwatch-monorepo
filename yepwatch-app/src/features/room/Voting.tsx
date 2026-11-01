/**
 * Voting: one top row (Back, the room control, Undo), the card with its swipe mechanics and the
 * friends' live pointers, the matches bar, Nope / Yep. No idea label, no card count: the deck
 * refills in the background, and an empty deck shows "Finding more…", never an end.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Platform, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { playFeedback } from '../feedback/sounds';
import { useRoomFeedback } from '../feedback/RoomFeedback';
import { groupActivity } from '../../core/continuous/activity';
import { latestRetainedVote, ownCard } from '../../core/continuous/state';
import { titlePresentation } from '../glow/adapter';
import { presentationSize } from '../glow/model';
import { LiveFaces, PeerStage } from '../glow/Peers';
import { PointerSurface } from '../glow/PointerSurface';
import { Poster } from '../glow/Poster';
import { Trailer } from '../glow/Trailer';
import { WatchLinks } from '../glow/WatchLinks';
import { useActiveTime } from '../glow/useActiveTime';
import { GText, Icon, Press, glow } from '../glow/theme';
import { stampStyle } from '../shell/tokens';
import { openPage, toRooms } from './nav';
import { RoomBar } from './parts';
import { useRoom } from './RoomProvider';
import { RoomNotes } from './RoomStatus';
import { servicesIn } from './services';
import { FindingMore, Logos, ScoreBadge, Screen, Small, card as cardStyle, useServices } from './ui';

/** Service ids a candidate is offered on among the room's switched-on services. */
export function offeredOn(c: { availability: { offers: { serviceId: number }[] }[] }, enabled: number[]) {
  return [...new Set(c.availability.flatMap((a) => a.offers.map((o) => o.serviceId)))].filter((id) => enabled.includes(id));
}

type Reaction = { at: number; gesture?: 'reach' | 'handle' | 'release'; answer?: boolean };
/** Your own face reacts at once (friends see it through activity). */
const reaction = (r: Omit<Reaction, 'at'>): Reaction => ({ at: Date.now(), ...r });

function VoteKey({ yes, disabled, onPress }: { yes: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Press label={yes ? 'Yep' : 'Nope'} disabled={disabled} onPress={onPress}
      style={{ flex: 1, height: 60, borderRadius: 10, flexDirection: 'row', gap: 8, backgroundColor: yes ? glow.amber : '#ffffff0f', borderWidth: yes ? 0 : 1, borderColor: '#ffffff1f' }}>
      <Icon name={yes ? 'check' : 'close'} size={20} color={yes ? '#201400' : '#f87171'} />
      <GText bold size={18} color={yes ? '#201400' : glow.ink}>{yes ? 'Yep' : 'Nope'}</GText>
    </Press>
  );
}

/** Matches so far; the proposal when there is one. Reopens a proposal set aside with Keep swiping. */
export function MatchesBar() {
  const { id, view, dismissedProposal, reopenProposal } = useRoom();
  if (!view) return null;
  const found = view.matches.length;
  const proposal = view.proposal;
  const sub = proposal ? `Proposed: ${proposal.candidate?.title ?? 'a match'} · ${proposal.agreeCount} of ${proposal.requiredCount} agree` : found ? 'Everyone said Yep' : 'Show up when everyone says Yep';
  const title = found ? `${found} ${found === 1 ? 'match' : 'matches'}` : 'Matches';
  return (
    <Press label={title} disabled={!found && !proposal}
      onPress={() => { playFeedback('matches'); if (proposal && dismissedProposal === proposal.version) reopenProposal(); else openPage(id, 'matches'); }}
      style={{ ...cardStyle, flexDirection: 'row', justifyContent: 'flex-start', gap: 12, height: 56, paddingHorizontal: 14, borderColor: proposal ? '#fbbf2466' : '#ffffff12' }}>
      <Icon name="tickets" size={20} color={found ? glow.amber : glow.muted} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <GText bold>{title}</GText>
        <Small color={proposal ? glow.amber : glow.muted} lines={1}>{sub}</Small>
      </View>
      <Icon name="right" size={16} color={glow.muted} />
    </Press>
  );
}

/** A full-screen page over the voting screen (the card underneath keeps its place). */
function Sheet({ close, children, testID }: { close: () => void; children: React.ReactNode; testID: string }) {
  return <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 60 }}><Screen testID={testID} back={close}>{children}</Screen></View>;
}

export function Voting() {
  const room = useRoom();
  const { id, state, snapshot, view, cmd, entry } = room;
  const [panel, setPanel] = useState<'details' | 'trailer' | null>(null);
  const [optimistic, setOptimistic] = useState<string>();
  const [stage, setStage] = useState({ width: 360, height: 400 });
  const [focused, setFocused] = useState(true);
  const [localReaction, setLocalReaction] = useState<Reaction>({ at: 0 });
  const pointerAt = useRef(0);
  const { all } = useServices(view?.country);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    const sub = Platform.OS === 'android' ? BackHandler.addEventListener('hardwareBackPress', () => { if (panel) setPanel(null); else toRooms(); return true; }) : null;
    return () => { setFocused(false); sub?.remove(); };
  }, [panel]));
  const setActivityView = room.setActivityView;
  useEffect(() => { if (focused) setActivityView(panel === 'trailer' ? 'trailer' : 'voting'); }, [focused, panel, setActivityView]);
  // A confirmed restart discards the previous round's local state.
  const generation = snapshot?.shared.generation;
  useEffect(() => { setOptimistic(undefined); setPanel(null); }, [generation]); // eslint-disable-line react-hooks/set-state-in-effect
  useRoomFeedback(snapshot, panel === 'trailer');
  const card = snapshot ? ownCard(snapshot, optimistic) : undefined;
  const vote = card ? snapshot?.own.votes.find((v) => v.candidateId === card.id) : undefined;
  const disabled = room.disabled || entry.required;
  const activeTime = useActiveTime(id, snapshot && card ? `${snapshot.shared.generation}:${card.id}:${vote?.revision ?? 0}` : null,
    Boolean(card) && focused && !panel && !disabled && !state.terminal && snapshot?.shared.phase === 'choosing');
  if (!snapshot || !view) return null;
  const { shared } = snapshot;
  const title = card ? titlePresentation(card) : null;
  const size = presentationSize(stage.width, stage.height, false);
  const activity = state.connection === 'live'
    ? groupActivity(new Map([...state.activities].filter(([, a]) => shared.participants.some((p) => p.participantId === a.frame.participantId && !p.dropped))), state.activityNow())
    : new Map();
  const undoTarget = latestRetainedVote(snapshot);
  async function choose(yes: boolean) {
    if (!card || disabled) return;
    playFeedback('swipe');
    setOptimistic(card.id);
    setLocalReaction(reaction({ answer: yes }));
    state.activity(undefined, 'answer');
    await cmd.vote(card.id, yes, activeTime());
    setOptimistic(undefined);
  }
  const offered = card ? servicesIn(all, offeredOn(card, view.enabledServiceIds)) : [];
  return (
    <Screen testID="voting" scroll={false} back={toRooms} covered={Boolean(panel)}
      right={<>
        <RoomBar faces={<LiveFaces people={view.people.map((p) => ({ id: p.id, nickname: p.nickname || '?', self: p.self }))} activity={activity} localReaction={localReaction} size={24} max={4} />} />
        <Press label="Undo" disabled={disabled || !undoTarget} onPress={() => { if (undoTarget) void cmd.undo(undoTarget); }} style={{ width: 40, height: 44, borderRadius: 10, backgroundColor: '#ffffff0a' }}>
          <Icon name="undo" size={18} color={glow.soft} />
        </Press>
      </>}
      footer={<>
        <MatchesBar />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <VoteKey yes={false} disabled={disabled || !card} onPress={() => void choose(false)} />
          <VoteKey yes disabled={disabled || !card} onPress={() => void choose(true)} />
        </View>
      </>}
      overlay={<>
        {panel === 'details' && title && card && (
          <Sheet testID="details-panel" close={() => setPanel(null)}>
            <GText bold size={28} style={{ letterSpacing: -0.8 }}>{title.title}</GText>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              {title.posterUrl ? <Image source={{ uri: title.posterUrl.replace('/w500/', '/w185/') }} accessible={false} style={{ width: 92, height: 138, borderRadius: 10 }} /> : null}
              <View style={{ flex: 1, gap: 8 }}>
                <Small>{[title.year, title.episodeLabel, title.runtimeMinutes ? `${title.runtimeMinutes} min` : null].filter(Boolean).join(' · ')}</Small>
                {title.genres.length ? <Small>{title.genres.join(' · ')}</Small> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Logos services={offered} size={20} />{title.score !== null ? <ScoreBadge score={title.score} /> : null}</View>
              </View>
            </View>
            <GText color={glow.soft}>{title.overview ?? 'No synopsis'}</GText>
            <WatchLinks identity={card.identity} availability={card.availability} screens={shared.screens} />
          </Sheet>
        )}
        {panel === 'trailer' && title?.trailerUrl && (
          <Sheet testID="trailer-panel" close={() => setPanel(null)}><Trailer key={title.id} url={title.trailerUrl} /></Sheet>
        )}
      </>}>
      <RoomNotes />
      {/* A page on top hides this one (zero size on the web): keep the last real size. */}
      <View onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (width > 0 && height > 0) setStage({ width, height }); }}
        style={{ flex: 1, minHeight: 80, alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
        {title && card ? (
          <>
            <PeerStage layer="back" activity={activity} width={size.width} height={size.height} desktop={false} />
            <PointerSurface width={size.width} height={size.height} onPointer={(pointer) => {
              state.pointer(pointer);
              if (pointer && Date.now() - pointerAt.current > 280) {
                pointerAt.current = Date.now();
                setLocalReaction(reaction({ gesture: pointer.pressed ? 'reach' : 'handle' }));
              }
            }}>
              <Poster showText={size.height >= 300} title={title} width={size.width} height={size.height} mode="voting" disabled={disabled}
                services={offered.length ? <Logos services={offered} size={20} /> : undefined}
                onVote={(yes) => void choose(yes)} onBrowse={() => undefined} onDetails={() => setPanel('details')} onTrailer={() => setPanel('trailer')}
                onGesture={(gesture) => { setLocalReaction(reaction({ gesture })); state.activity(gesture); }} stampStyle={stampStyle} />
            </PointerSurface>
            <PeerStage layer="front" activity={activity} width={size.width} height={size.height} desktop={false} />
          </>
        ) : <FindingMore style={{ width: size.width, height: size.height }} />}
      </View>
    </Screen>
  );
}
