/**
 * Voting: the matches chip, the faces and Undo over the stage, the card with its YEP / NOPE look,
 * Nope / Yep under it (pinned on phones). The room itself is in the header's pill. No idea label,
 * no card count: the deck refills in the background, and an empty deck shows "Finding more…",
 * never an end.
 */
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { fixturesEnabled } from '../../core/config';
import { useReducedMotion } from '../../components/ui';
import { BootPhase } from '../home/boot-phase';
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
import { useBackAction } from '../shell/sheet-back';
import { useSheetEntry } from '../shell/Sheet';
import { useSheetOpen } from '../shell/sheet-stack';
import { warm } from '../shell/tokens';
import { openPage, toRooms } from './nav';
import { useRoom } from './RoomProvider';
import { RoomNotes } from './RoomStatus';
import { servicesIn } from './services';
import { TitleDetails } from './TitleDetails';
import { FindingMore, Logos, Screen, useServices } from './ui';
import { stageGeometry } from './vote/geometry';
import { LookDealer, pinnedLookFrom } from './vote/looks';
import { answerYep, matchKey, nextCandidate, settleYeps, undoYeps, yepRecord, type YepRecord } from './vote/match';
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
    <Press label={yes ? 'Yep' : 'Nope'} disabled={disabled} onPress={onPress} repeatable
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
      visual={{ height: z(36), paddingHorizontal: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: lit ? warm.amberSoft : warm.faint, borderWidth: 1, borderColor: proposal ? glow.amber : lit ? warm.amberLine : warm.line }}>
      <Icon name="tickets" size={z(15)} color={lit ? glow.amber : glow.muted} />
      <GText bold size={z(14)} color={lit ? glow.amber : glow.muted}>{label}</GText>
      {proposal ? <View accessible={false} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: glow.amber }} /> : null}
    </Press>
  );
}

/** A full-screen page over the voting screen (the card underneath keeps its place); `page` uses the whole container. */
function Sheet({ close, children, testID, page = false }: { close: () => void; children: React.ReactNode; testID: string; page?: boolean }) {
  // On the sheet stack: browser Back, Android back, Escape and the header's Back close it, never the room.
  useSheetEntry(close);
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 60 }}>
      <Screen testID={testID} back={close} {...(page ? { width: 'page' as const, gap: 0 } : {})}>{children}</Screen>
    </View>
  );
}

/** `entering`: the round just started, so the first card rises in; `onEntered` once the stage has played that. */
export function Voting({ entering = false, onEntered }: { entering?: boolean; onEntered?: () => void }) {
  const room = useRoom();
  const { id, state, snapshot, view, cmd, entry } = room;
  const layout = useLayout();
  const { phone, z } = layout;
  /** The row over the stage holds the 48 × 48 touch targets of the matches chip and Undo. */
  const barHeight = Math.max(48, z(44));
  const reduced = useReducedMotion();
  const [panel, setPanel] = useState<'details' | 'trailer' | null>(null);
  /** The trailer playing inside the details' hero. */
  const [detailsTrailer, setDetailsTrailer] = useState(false);
  const trailerOpen = panel === 'trailer' || (panel === 'details' && detailsTrailer);
  // The card is placed from the stage's measured size; it isn't drawn before that (a guess would move it).
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const stageBox = useRef<React.ComponentRef<typeof View>>(null);
  const ready = Boolean(snapshot && view);
  // The web measures before the first paint, so the first card is drawn where it stays.
  useLayoutEffect(() => {
    const el = stageBox.current as unknown as HTMLElement | null;
    if (Platform.OS !== 'web' || !el || typeof el.offsetWidth !== 'number') return;
    if (el.offsetWidth > 0 && el.offsetHeight > 0) setArea((a) => (a && a.width === el.offsetWidth && a.height === el.offsetHeight ? a : { width: el.offsetWidth, height: el.offsetHeight }));
  }, [ready]);
  const [focused, setFocused] = useState(true);
  const [localReaction, setLocalReaction] = useState<Reaction>({ at: 0 });
  const [dealer] = useState(() => new LookDealer(Math.random, pinnedLook()));
  /** Your Yeps the room hasn't confirmed yet. */
  const [yeps, setYeps] = useState<readonly YepRecord[]>([]);
  const yepSerial = useRef(0);
  const [moment, setMoment] = useState<MatchMoment | null>(null);
  const controls = useRef<VoteStageControls>(null);
  const pointerAt = useRef(0);
  const { all } = useServices(view?.country);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  useBackAction(() => { if (panel) setPanel(null); else toRooms(); });
  const setActivityView = room.setActivityView;
  useEffect(() => { if (focused) setActivityView(trailerOpen ? 'trailer' : 'voting'); }, [focused, trailerOpen, setActivityView]);
  useEffect(() => { if (panel !== 'details') setDetailsTrailer(false); }, [panel]); // eslint-disable-line react-hooks/set-state-in-effect
  // A confirmed restart discards the previous round's local state.
  const generation = snapshot?.shared.generation;
  useEffect(() => { setPanel(null); }, [generation]); // eslint-disable-line react-hooks/set-state-in-effect
  useRoomFeedback(snapshot, trailerOpen);
  const card = snapshot ? ownCard(snapshot) : undefined;
  const vote = card ? snapshot?.own.votes.find((v) => v.candidateId === card.id) : undefined;
  // Answers queue behind commands still on their way (the Start that dealt this card, the previous vote,
  // a saved one waiting for the network): the card is live the moment it shows. Only a room that can't
  // be read or an entry still running holds the answers.
  const disabled = state.privateError || entry.working || entry.required;
  // A sheet over the card (the room's or the header's Your rooms): no answers, and the time doesn't count as seeing the title.
  const covered = useSheetOpen();
  const answering = !disabled && !covered;
  // Under the startup cover the page is built but unseen: its time doesn't count as seeing a card, and the
  // arrow keys (window-wide, so the cover's inert and pointer blocking don't stop them) wait until the
  // page takes input like taps do.
  const boot = useContext(BootPhase);
  const activeTime = useActiveTime(id, snapshot && card ? `${snapshot.shared.generation}:${card.id}:${vote?.revision ?? 0}` : null,
    Boolean(card) && focused && !panel && answering && boot !== 'boot' && !state.terminal && snapshot?.shared.phase === 'choosing');
  const endMoment = useCallback((key: string) => setMoment((m) => (m?.key === key ? null : m)), []);
  if (!snapshot || !view) return null;
  const { shared } = snapshot;
  const title = card ? titlePresentation(card) : null;
  const look = card ? dealer.lookFor(`${shared.generation}:${card.id}`) : null;
  // A Yep of yours made a match once the confirmed room lists it: MATCH plays in that card's look.
  const settled = state.confirmed && yeps.length ? settleYeps(yeps, state.confirmed) : null;
  if (settled?.changed) {
    setYeps(settled.pending);
    const made = settled.matched[0];
    const matched = made ? shared.candidates.find((c) => c.id === made.candidateId) : undefined;
    if (made && matched && view.people.length > 1) setMoment({ key: matchKey(made), title: titlePresentation(matched), look: made.look });
  }
  const nextCard = nextCandidate(snapshot, card?.id);
  const geo = area ? stageGeometry({ aw: area.width, stageH: area.height, vw: layout.width, phone, z }) : null;
  const rowWidth = area && geo ? Math.min(area.width, Math.max(geo.w, 320)) : phone ? layout.width - 32 : layout.max;
  const activity = state.connection === 'live'
    ? groupActivity(new Map([...state.activities].filter(([, a]) => shared.participants.some((p) => p.participantId === a.frame.participantId && !p.dropped))), state.activityNow())
    : new Map();
  const undoTarget = latestRetainedVote(snapshot);
  /** Sent the moment it's pressed, for the card it was aimed at; the fly-off plays meanwhile. */
  function choose(yes: boolean, key: string): Promise<boolean> {
    if (!card || !answering || !look || !snapshot || key !== `${snapshot.shared.generation}:${card.id}`) return Promise.resolve(false);
    setLocalReaction(reaction({ answer: yes }));
    state.activity(undefined, 'answer');
    const sent = cmd.vote(card.id, yes, activeTime());
    if (!yes) return sent;
    // Remembered until the room confirms it; a refused one is forgotten.
    const record = yepRecord(++yepSerial.current, snapshot, card.id, look);
    setYeps((list) => [...list, record]);
    void sent.then((ok) => setYeps((list) => answerYep(list, record.serial, ok, room.latest())));
    return sent;
  }
  const offered = card ? servicesIn(all, offeredOn(card, view.enabledServiceIds)) : [];
  const people = view.people.map((p) => ({ id: p.id, nickname: p.nickname || '?', self: p.self }));
  return (
    <Screen testID="voting" scroll={false} back={toRooms} covered={Boolean(panel)} width="page" noteTop={(phone ? 12 : z(24)) + barHeight + 8}
      footer={
        <View style={{ flexDirection: 'row', gap: 12, width: phone ? '100%' : rowWidth, alignSelf: 'center' }}>
          <VoteKey yes={false} disabled={!answering || !card} onPress={() => controls.current?.commit(false)} />
          <VoteKey yes disabled={!answering || !card} onPress={() => controls.current?.commit(true)} />
        </View>
      }
      overlay={<>
        {panel === 'details' && title && card && (
          <Sheet testID="details-panel" page close={() => setPanel(null)}>
            <TitleDetails key={card.id} c={card} trailer={detailsTrailer} onTrailer={setDetailsTrailer} />
          </Sheet>
        )}
        {panel === 'trailer' && title?.trailerUrl && (
          <Sheet testID="trailer-panel" close={() => setPanel(null)}><Trailer key={title.id} url={title.trailerUrl} /></Sheet>
        )}
      </>}>
      <RoomNotes />
      <View testID="voting-bar" style={{ height: barHeight, flexDirection: 'row', alignItems: 'center', gap: 10, width: rowWidth, alignSelf: 'center', zIndex: 3 }}>
        <MatchesChip />
        <View style={{ flex: 1 }} />
        {people.length > 1 ? <LiveFaces people={people} activity={activity} localReaction={localReaction} size={z(26)} max={4} /> : null}
        <Press label="Undo" disabled={disabled || !undoTarget} onPress={() => { if (!undoTarget) return; setYeps((list) => undoYeps(list, undoTarget.candidateId)); void cmd.undo(undoTarget.candidateId); }}
          visual={{ width: z(40), height: z(36), borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff0a' }}>
          <Icon name="undo" size={z(17)} color={glow.soft} />
        </Press>
      </View>
      {/* A page on top hides this one (zero size on the web): keep the last real size. */}
      <View ref={stageBox} onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (width > 0 && height > 0) setArea((a) => (a && a.width === width && a.height === height ? a : { width, height })); }}
        style={{ flex: 1, minHeight: 80, zIndex: 2 }}>
        {geo ? <VoteStage geo={geo} controls={controls} reduced={reduced} enter={entering} onEntered={onEntered} disabled={!answering} keys={focused && !panel && answering && boot === 'ready'}
          card={card && title && look ? { key: `${shared.generation}:${card.id}`, title, look } : null}
          next={nextCard ? titlePresentation(nextCard) : null}
          empty={<FindingMore style={{ flex: 1 }} />}
          activity={activity}
          services={offered.length ? <Logos services={offered} size={z(22)} /> : undefined}
          moment={view.people.length > 1 ? moment : null} onMomentEnd={endMoment}
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
          }} /> : null}
      </View>
    </Screen>
  );
}
