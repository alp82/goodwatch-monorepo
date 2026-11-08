/**
 * Voting: the matches chip, the faces and Undo over the stage, the card with its YEP / NOPE look,
 * Nope / Yep under it (pinned on phones). The room itself is in the header's pill. No idea label,
 * no card count: the deck refills in the background, and an empty deck shows "Finding more…",
 * never an end.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { fixturesEnabled } from '../../core/config';
import { useReducedMotion } from '../../components/ui';
import { playFeedback } from '../feedback/sounds';
import { useRoomFeedback } from '../feedback/RoomFeedback';
import { groupActivity } from '../../core/continuous/activity';
import { latestRetainedVote, ownCard } from '../../core/continuous/state';
import { titlePresentation } from '../glow/adapter';
import { LiveFaces } from '../glow/Peers';
import { Trailer } from '../glow/Trailer';
import { useActiveTime } from '../glow/useActiveTime';
import { GText, Icon, Press, glow } from '../glow/theme';
import { useLayout } from '../shell/layout';
import { warm } from '../shell/tokens';
import { openPage, toRooms } from './nav';
import { useRoom } from './RoomProvider';
import { RoomNotes } from './RoomStatus';
import { servicesIn } from './services';
import { TitleDetails } from './TitleDetails';
import { FindingMore, Logos, Screen, useServices } from './ui';
import { stageGeometry } from './vote/geometry';
import { LookDealer, pinnedLookFrom } from './vote/looks';
import { madeMatch, nextCandidate, yepRecord, type YepRecord } from './vote/match';
import { VoteStage, type MatchMoment, type VoteStageControls } from './vote/VoteStage';

/** Service ids a candidate is offered on among the room's switched-on services. */
export function offeredOn(c: { availability: { offers: { serviceId: number }[] }[] }, enabled: number[]) {
  return [...new Set(c.availability.flatMap((a) => a.offers.map((o) => o.serviceId)))].filter((id) => enabled.includes(id));
}

type Reaction = { at: number; gesture?: 'reach' | 'handle' | 'release'; answer?: boolean };
/** Your own face reacts at once (friends see it through activity). */
const reaction = (r: Omit<Reaction, 'at'>): Reaction => ({ at: Date.now(), ...r });

/** In a fixture build, `?look=<name>` pins one look for every card. */
const pinnedLook = () => (fixturesEnabled && Platform.OS === 'web' && typeof window !== 'undefined' ? pinnedLookFrom(window.location.search) : null);

/** Nope (a slight red hint) and Yep (amber). */
function VoteKey({ yes, disabled, onPress }: { yes: boolean; disabled: boolean; onPress: () => void }) {
  const { z } = useLayout();
  return (
    <Press label={yes ? 'Yep' : 'Nope'} disabled={disabled} onPress={onPress}
      style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: z(54), borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', gap: 9, backgroundColor: yes ? glow.amber : '#ef44440f', borderWidth: 1, borderColor: yes ? glow.amber : '#ef444440' }}>
      <Icon name={yes ? 'check' : 'close'} size={18} color={yes ? warm.ink : '#f87171'} />
      <GText bold size={z(17)} color={yes ? warm.ink : glow.ink} lines={1}>{yes ? 'Yep' : 'Nope'}</GText>
    </Press>
  );
}

/** Matches so far; amber while there's a proposal. Opens Matches, where a proposal set aside with Keep swiping waits as a card. */
function MatchesChip() {
  const { id, view } = useRoom();
  const { z } = useLayout();
  if (!view) return null;
  const found = view.matches.length;
  const proposal = view.proposal;
  const label = found ? `${found} ${found === 1 ? 'match' : 'matches'}` : 'Matches';
  const lit = Boolean(found || proposal);
  return (
    <Press label={label} disabled={!lit}
      onPress={() => { playFeedback('matches'); openPage(id, 'matches'); }}
      style={{ height: z(36), paddingHorizontal: 12, borderRadius: 10, flexDirection: 'row', gap: 6, backgroundColor: lit ? warm.amberSoft : warm.faint, borderWidth: 1, borderColor: proposal ? glow.amber : lit ? warm.amberLine : warm.line }}>
      <Icon name="tickets" size={z(15)} color={lit ? glow.amber : glow.muted} />
      <GText bold size={z(14)} color={lit ? glow.amber : glow.muted}>{label}</GText>
      {proposal ? <View accessible={false} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: glow.amber }} /> : null}
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
  const layout = useLayout();
  const { phone, z } = layout;
  const reduced = useReducedMotion();
  const [panel, setPanel] = useState<'details' | 'trailer' | null>(null);
  // First paint before the stage is measured: a close guess from the window.
  const [area, setArea] = useState(() => ({ width: phone ? layout.width - 32 : layout.max, height: Math.max(200, layout.height - layout.header - (phone ? 180 : z(190))) }));
  const [focused, setFocused] = useState(true);
  const [localReaction, setLocalReaction] = useState<Reaction>({ at: 0 });
  const [dealer] = useState(() => new LookDealer(Math.random, pinnedLook()));
  const [yep, setYep] = useState<YepRecord | null>(null);
  const [moment, setMoment] = useState<MatchMoment | null>(null);
  const [celebrated, setCelebrated] = useState<string | null>(null);
  const controls = useRef<VoteStageControls>(null);
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
  useEffect(() => { setPanel(null); }, [generation]); // eslint-disable-line react-hooks/set-state-in-effect
  useRoomFeedback(snapshot, panel === 'trailer');
  const card = snapshot ? ownCard(snapshot) : undefined;
  const vote = card ? snapshot?.own.votes.find((v) => v.candidateId === card.id) : undefined;
  const disabled = room.disabled || entry.required;
  const activeTime = useActiveTime(id, snapshot && card ? `${snapshot.shared.generation}:${card.id}:${vote?.revision ?? 0}` : null,
    Boolean(card) && focused && !panel && !disabled && !state.terminal && snapshot?.shared.phase === 'choosing');
  const endMoment = useCallback((key: string) => setMoment((m) => (m?.key === key ? null : m)), []);
  if (!snapshot || !view) return null;
  const { shared } = snapshot;
  const title = card ? titlePresentation(card) : null;
  const look = card ? dealer.lookFor(`${shared.generation}:${card.id}`) : null;
  // Your Yep made a match once the room lists it: MATCH plays in that card's look.
  const matchKey = madeMatch(yep, shared);
  if (matchKey && yep && matchKey !== celebrated) {
    const matched = shared.candidates.find((c) => c.id === yep.candidateId);
    setCelebrated(matchKey);
    if (matched) setMoment({ key: matchKey, title: titlePresentation(matched), look: yep.look });
  }
  const nextCard = nextCandidate(snapshot, card?.id);
  const geo = stageGeometry({ aw: area.width, stageH: area.height, vw: layout.width, phone, z });
  const rowWidth = Math.min(area.width, Math.max(geo.w, 320));
  const activity = state.connection === 'live'
    ? groupActivity(new Map([...state.activities].filter(([, a]) => shared.participants.some((p) => p.participantId === a.frame.participantId && !p.dropped))), state.activityNow())
    : new Map();
  const undoTarget = latestRetainedVote(snapshot);
  function choose(yes: boolean): Promise<boolean> {
    if (!card || disabled || !look) return Promise.resolve(false);
    setLocalReaction(reaction({ answer: yes }));
    state.activity(undefined, 'answer');
    if (yes) setYep(yepRecord((yep?.serial ?? 0) + 1, shared, card.id, look));
    return cmd.vote(card.id, yes, activeTime());
  }
  const offered = card ? servicesIn(all, offeredOn(card, view.enabledServiceIds)) : [];
  const people = view.people.map((p) => ({ id: p.id, nickname: p.nickname || '?', self: p.self }));
  return (
    <Screen testID="voting" scroll={false} back={toRooms} covered={Boolean(panel)} width="page"
      footer={
        <View style={{ flexDirection: 'row', gap: 12, width: phone ? '100%' : rowWidth, alignSelf: 'center' }}>
          <VoteKey yes={false} disabled={disabled || !card} onPress={() => controls.current?.commit(false)} />
          <VoteKey yes disabled={disabled || !card} onPress={() => controls.current?.commit(true)} />
        </View>
      }
      overlay={<>
        {panel === 'details' && title && card && (
          <Sheet testID="details-panel" close={() => setPanel(null)}>
            <TitleDetails c={card} offered={offered} screens={shared.screens} />
          </Sheet>
        )}
        {panel === 'trailer' && title?.trailerUrl && (
          <Sheet testID="trailer-panel" close={() => setPanel(null)}><Trailer key={title.id} url={title.trailerUrl} /></Sheet>
        )}
      </>}>
      <RoomNotes />
      <View testID="voting-bar" style={{ height: z(44), flexDirection: 'row', alignItems: 'center', gap: 10, width: rowWidth, alignSelf: 'center', zIndex: 3 }}>
        <MatchesChip />
        <View style={{ flex: 1 }} />
        {people.length > 1 ? <LiveFaces people={people} activity={activity} localReaction={localReaction} size={z(26)} max={4} /> : null}
        <Press label="Undo" disabled={disabled || !undoTarget} onPress={() => { if (undoTarget) void cmd.undo(undoTarget.candidateId); }}
          style={{ width: z(40), height: z(36), borderRadius: 10, backgroundColor: '#ffffff0a' }}>
          <Icon name="undo" size={z(17)} color={glow.soft} />
        </Press>
      </View>
      {/* A page on top hides this one (zero size on the web): keep the last real size. */}
      <View onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (width > 0 && height > 0) setArea({ width, height }); }}
        style={{ flex: 1, minHeight: 80, zIndex: 2 }}>
        <VoteStage geo={geo} controls={controls} reduced={reduced} disabled={disabled} keys={focused && !panel && !disabled}
          card={card && title && look ? { key: `${shared.generation}:${card.id}`, title, look } : null}
          next={nextCard ? titlePresentation(nextCard) : null}
          empty={<FindingMore style={{ flex: 1 }} />}
          activity={activity}
          services={offered.length ? <Logos services={offered} size={z(22)} /> : undefined}
          moment={moment} onMomentEnd={endMoment}
          onVote={choose}
          onDetails={() => setPanel('details')}
          onTrailer={() => setPanel('trailer')}
          onGesture={(gesture) => { setLocalReaction(reaction({ gesture })); state.activity(gesture); }}
          onPointer={(pointer) => {
            state.pointer(pointer);
            if (pointer && Date.now() - pointerAt.current > 280) {
              pointerAt.current = Date.now();
              setLocalReaction(reaction({ gesture: pointer.pressed ? 'reach' : 'handle' }));
            }
          }} />
      </View>
    </Screen>
  );
}
