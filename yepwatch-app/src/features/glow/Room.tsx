import { playFeedback } from '../feedback/sounds';
import { useRoomFeedback, SoundToggle } from '../feedback/RoomFeedback';
import { EdgeBack } from './EdgeBack';
import { shareInvitation } from '../../core/share-invitation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { RoomCommand } from '@goodwatch/yepwatch-contracts/proposal';
import { roomRegistry } from '../../core/continuous/room-registry';
import { continuousKey, useContinuousRoom } from '../../core/continuous/useRoom';
import { latestRetainedVote, ownCard, type CachedRoom } from '../../core/continuous/state';
import { groupActivity } from '../../core/continuous/activity';
import { useQuery } from '@tanstack/react-query';
import { loadInvite, type StoredInvite } from '../../core/continuous/invite-store';
import { appInviteUrl } from '../../core/invites';
import { developmentNotice, guestOnly } from '../../core/config';
import { queryClient } from '../../core/providers';
import { continuousApi, RoomFailure } from '../../core/continuous/api';
import { beginMember } from '../../core/continuous/member';
import { titlePresentation } from './adapter';
import { boundedMatch, presentationSize, type GlowView } from './model';
import { GText, Icon, Press, glow } from './theme';
import { Faces, PeerStage } from './Peers';
import { PointerSurface } from './PointerSurface';
import { Poster } from './Poster';
import { Feedback } from '../beta/Feedback';
import { Trailer } from './Trailer';
import { Done } from './Done';
import { WatchLinks } from './WatchLinks';
import { DecisionRoom } from './DecisionRoom';
import { titleYear } from './decision-model';
import { useActiveTime } from './useActiveTime';
import { Lobby } from './Lobby';
import { useLobbyEntry } from './useLobbyEntry';
import { ScorePill } from './ScorePill';
import { Shuffle } from './Shuffle';
import { AppFrame, SubHeader, useFrameSize, type BackTarget } from '../shell/Frame';
import { Action, Chip, Label, Panel, Thumb, CoveredBody } from '../shell/parts';
import { COLUMN, R, column, stampStyle } from '../shell/tokens';
import { roomLabel } from '../rooms/home-model';
import { RoomSettings } from '../rooms/RoomSettings';
import { GoodWatchButton } from '../home/Landing';
import { showShuffle as readiness, startAgain as runStartAgain, type RoomSettingsValue } from '../rooms/round';

type RoomPanel = 'room' | 'details' | 'trailer' | 'settings' | 'restart';

/** Back from the first room view returns to Your rooms without leaving the room. */
function toRooms() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function VoteKey({ yes, disabled, compact, onPress }: { yes: boolean; disabled: boolean; compact: boolean; onPress: () => void }) {
  return (
    <Press label={yes ? 'Yep' : 'Nope'} disabled={disabled} onPress={onPress}
      style={{ flex: 1, minHeight: compact ? 48 : 56, borderRadius: R.control, borderWidth: 1, borderColor: yes ? '#15803d' : '#b91c1c', flexDirection: 'row', gap: 8, backgroundColor: yes ? '#16a34a' : '#dc2626' }}>
      <Icon name={yes ? 'check' : 'close'} size={18} color="#fff" />
      <GText bold size={compact ? 17 : 19} color="#fff">{yes ? 'Yep' : 'Nope'}</GText>
    </Press>
  );
}

export function GlowRoom({ id, signin: initialSignin = false }: { id: string; signin?: boolean }) {
  const state = useContinuousRoom(id);
  const entry = useLobbyEntry(state);
  const size = useFrameSize();
  const invitation = useQuery<StoredInvite | null>({ queryKey: ['continuous-invite', id], queryFn: () => loadInvite(id) });
  const snapshot = state.room.data;
  const [reviewingDecision, setReviewingDecision] = useState(false);
  const [view, setView] = useState<GlowView>('voting');
  const [active, setActive] = useState<string | null>(null);
  const [panel, setPanel] = useState<RoomPanel | null>(null);
  const [notice, setNotice] = useState('');
  const [shareNotice, setShareNotice] = useState('');
  const [memberBusy, setMemberBusy] = useState(false);
  /** A start (or Start again) is in flight: the shuffle stands in for the first card. */
  const [starting, setStarting] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [localReaction, setLocalReaction] = useState<{ at: number; gesture?: 'reach' | 'handle' | 'release'; answer?: boolean }>({ at: 0 });
  const pointerAt = useRef(0);
  const [optimistic, setOptimistic] = useState<string>();
  const [stage, setStage] = useState({ width: 360, height: 400 });
  const [box, setBox] = useState({ width: 390, height: 600 });
  const [matchesArea, setMatchesArea] = useState(500);
  const refilled = useRef(new Set<string>());
  const signinStarted = useRef(false);
  const send = state.send;
  const latest = useCallback(() => queryClient.getQueryData<CachedRoom>(continuousKey(id)), [id]);
  const decidedPhase = snapshot?.shared.phase === 'decided';
  const back = useCallback(() => {
    if (panel) setPanel(null);
    else if (decidedPhase) setReviewingDecision((v) => !v);
    else if (view === 'matches') setView('voting');
    else toRooms();
  }, [panel, view, decidedPhase]);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => subscription.remove();
  }, [back]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setForeground(s === 'active'));
    return () => sub.remove();
  }, []);
  const nickname = snapshot?.shared.participants.find((p) => p.participantId === snapshot.own.participantId)?.nickname;
  const expiresAt = snapshot?.shared.expiresAt;
  useEffect(() => {
    if (expiresAt && nickname) void roomRegistry.remember({ roomId: id, nickname, expiresAt }).catch(() => undefined);
  }, [id, nickname, expiresAt]);
  useEffect(() => {
    if (snapshot?.own.left) router.replace('/');
  }, [snapshot?.own.left]);
  useEffect(() => {
    if (!guestOnly && initialSignin && state.access && state.room.data && !signinStarted.current) {
      signinStarted.current = true;
      router.setParams({ signin: undefined });
      if (state.room.data.own.member.state !== 'linked') void signin();
    }
  });
  const setActivityView = state.setView;
  useEffect(() => {
    // Tonight is a shared view: cheers are only accepted from the matches activity view.
    setActivityView(panel === 'trailer' ? 'trailer' : decidedPhase ? (reviewingDecision ? 'away' : 'matches') : view);
  }, [panel, view, decidedPhase, reviewingDecision, setActivityView]);
  // A confirmed server restart discards the previous generation’s local navigation.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView('voting');
    setReviewingDecision(false);
    setActive(null);
    setOptimistic(undefined);
  }, [snapshot?.shared.generation]);
  useEffect(() => {
    if (
      !snapshot ||
      snapshot.shared.phase !== 'choosing' ||
      !snapshot.shared.participants.find((p) => p.participantId === snapshot.own.participantId)?.screenId ||
      state.busy || entry.required || state.pending || state.privateError || state.terminal
    )
      return;
    const unanswered = snapshot.shared.candidates.filter((c) => !snapshot.own.votes.some((v) => v.candidateId === c.id && v.value !== null)).length;
    const key = `${snapshot.shared.generation}:${snapshot.shared.stream.version}`;
    if (unanswered <= 2 && snapshot.shared.stream.state === 'ready' && !refilled.current.has(key)) {
      refilled.current.add(key);
      void send({ type: 'refill', generation: snapshot.shared.generation, expectedStreamVersion: snapshot.shared.stream.version });
    }
  }, [snapshot, state.busy, state.pending, state.privateError, state.terminal, entry.required, send]);
  useRoomFeedback(snapshot, panel === 'trailer');
  const observedCard = snapshot ? ownCard(snapshot, optimistic) : null;
  const observedVote = snapshot?.own.votes.find((v) => v.candidateId === observedCard?.id);
  const exposureKey = snapshot && observedCard ? `${snapshot.shared.generation}:${observedCard.id}:${observedVote?.revision ?? 0}` : null;
  const activeTime = useActiveTime(
    id,
    exposureKey,
    Boolean(observedCard) && view === 'voting' && !panel && !entry.working && !entry.required && !state.busy && !state.pending && !state.privateError && !state.terminal && snapshot?.shared.phase === 'choosing'
  );
  const roomsBack: BackTarget = { label: 'Your rooms', short: 'Rooms', onPress: toRooms };
  if (state.terminal || state.access === null || !snapshot) {
    const ended = state.terminal || state.access === null;
    return (
      <AppFrame onLogo={toRooms} subheader={<SubHeader back={roomsBack} title={ended ? (state.terminal === 'expired' ? 'This room has expired' : state.access === null ? 'Reopen your invitation' : 'Your room access ended') : state.room.error ? 'Couldn’t load the room' : 'Opening the room…'} />}>
        <View style={{ ...column, flex: 1, justifyContent: 'center', gap: 14 }}>
          {ended && <GText color={glow.muted}>Use your invitation to restore your place, or create a new room.</GText>}
          {!ended && state.room.error && <Action gold label="Retry" onPress={() => void state.refetch().catch(() => undefined)} />}
          <Action gold={Boolean(ended)} label="Your rooms" onPress={() => router.replace('/')} />
        </View>
      </AppFrame>
    );
  }
  const { shared, own } = snapshot;
  const decided = shared.phase === 'decided';
  const matches = shared.matches.map((m) => ({ ...m, candidate: shared.candidates.find((c) => c.id === m.candidateId) })).filter((m) => m.candidate);
  const pickId = shared.proposal?.candidateId ?? null;
  const activeId = boundedMatch(matches.map((m) => m.candidateId), active, pickId);
  const card = decided && !reviewingDecision
    ? shared.candidates.find((c) => c.id === shared.decision?.candidateId)
    : view === 'matches' ? shared.candidates.find((c) => c.id === activeId) : ownCard(snapshot, optimistic);
  const title = card ? titlePresentation(card) : null;
  const dimensions = presentationSize(stage.width, stage.height, false);
  const disabled = state.busy || Boolean(state.pending) || state.privateError || entry.working || entry.required;
  const people = shared.participants.map((p) => ({ id: p.participantId, nickname: p.nickname, dropped: p.dropped, self: p.participantId === own.participantId }));
  const selfDropped = Boolean(shared.participants.find((p) => p.participantId === own.participantId)?.dropped);
  const activity = state.connection === 'live'
    ? groupActivity(new Map([...state.activities].filter(([, a]) => shared.participants.some((p) => p.participantId === a.frame.participantId && !p.dropped))), state.activityNow())
    : new Map();
  const invite = invitation.data;
  const undoTarget = latestRetainedVote(snapshot);
  const hostName = shared.participants.find((p) => p.participantId === shared.hostParticipantId)?.nickname ?? null;
  const decisionItems = shared.candidates
    .filter((c) => shared.matches.some((m) => m.candidateId === c.id) || shared.proposal?.candidateId === c.id || shared.decision?.candidateId === c.id)
    .map((c) => ({ title: titlePresentation(c), averageYepMs: shared.matches.find((m) => m.candidateId === c.id)?.averageYepMs ?? null }));
  const previousProposal = shared.candidates.find((c) => c.id === shared.proposal?.previousCandidateId);
  const inspectionCues = [...activity.values()].flatMap((a) => {
    const pulse = a.pulse;
    if (a.frame.view !== 'matches' || pulse?.view !== 'matches' || !pulse.inspection) return [];
    if (pulse.inspection.kind === 'poster' && !shared.matches.some((m) => m.candidateId === (pulse.inspection?.kind === 'poster' ? pulse.inspection.candidateId : null))) return [];
    return [{ participantId: pulse.participantId, key: `${pulse.sessionId}:${pulse.sequence}`, ...pulse.inspection }];
  });
  const inLobby = !starting && (shared.phase === 'setup' || (!decided && !shared.participants.find((p) => p.participantId === own.participantId)?.screenId));
  async function vote(yes: boolean) {
    if (!card || disabled) return;
    playFeedback('swipe');
    const current = own.votes.find((v) => v.candidateId === card.id);
    setOptimistic(card.id);
    setLocalReaction({ at: Date.now(), answer: yes });
    state.activity(undefined, 'answer');
    await send({ type: 'vote', generation: shared.generation, candidateId: card.id, expectedVoteRevision: current?.revision ?? 0, value: yes ? 'watch' : 'pass', activeExposureMs: yes ? activeTime() : null });
    setOptimistic(undefined);
  }
  async function undoVote() {
    if (!undoTarget || disabled) return;
    await send({ type: 'vote', generation: shared.generation, candidateId: undoTarget.candidateId, expectedVoteRevision: undoTarget.revision, value: null });
  }
  async function propose(candidateId: string) {
    if (disabled) return;
    await send({ type: 'propose', generation: shared.generation, expectedRosterVersion: shared.rosterVersion, expectedProposalVersion: shared.proposalVersion, candidateId });
  }
  async function agree(agreed: boolean) {
    if (!shared.proposal || disabled) return;
    await send({ type: 'agree', generation: shared.generation, expectedRosterVersion: shared.rosterVersion, expectedProposalVersion: shared.proposalVersion, candidateId: shared.proposal.candidateId, expectedOwnAgreementRevision: own.agreement.revision, agreed });
  }
  /** Lobby Start shows the shuffle until the first cards arrive; nothing waits on a timer. */
  async function lobbySend(command: RoomCommand) {
    if (command.type !== 'start') return send(command);
    setStarting(true);
    try { return await send(command); } finally { setStarting(false); }
  }
  async function saveSettings(v: RoomSettingsValue) {
    const s = latest();
    if (!s) return false;
    const ok = await send({ type: 'configure', expectedContextVersion: s.shared.contextVersion, country: v.country, serviceIds: v.serviceIds, constraints: v.constraints, prompt: v.prompt });
    if (ok) setPanel(null);
    return ok;
  }
  /**
   * Start again: the decision stays until this explicit confirm. Then restart (next generation),
   * save changed settings, and start, each against the latest confirmed room versions.
   */
  async function startAgain(v: RoomSettingsValue) {
    setStarting(true);
    try {
      const ok = await runStartAgain({ latest, send }, v);
      if (ok) setPanel(null);
      return ok;
    } finally {
      setStarting(false);
    }
  }
  async function signin() {
    if (guestOnly || !state.access || memberBusy) return;
    setMemberBusy(true);
    try {
      await beginMember(state.access);
      await state.refetch();
    } catch (e) {
      setNotice(
        e instanceof RoomFailure && e.code === 'not_implemented'
          ? 'GoodWatch sign-in is not connected yet. Your guest place is saved; account services and progress have not been imported.'
          : e instanceof Error ? e.message : 'Sign-in could not start.'
      );
    } finally {
      setMemberBusy(false);
    }
  }

  // Subheader: Back always names the view it returns to; panels return to the view underneath.
  const viewName = inLobby ? 'Room' : decided ? (reviewingDecision ? 'Matches' : 'Tonight') : view === 'matches' ? 'Matches' : 'Voting';
  const backTarget: BackTarget = panel
    ? { label: viewName, short: viewName, onPress: () => setPanel(null) }
    : decided
    ? reviewingDecision ? { label: 'Tonight', short: 'Tonight', onPress: back } : { label: 'Matches', short: 'Matches', onPress: back }
    : view === 'matches' && !inLobby ? { label: 'Voting', short: 'Voting', onPress: back } : roomsBack;
  const panelTitle = panel === 'room' ? 'Our room' : panel === 'settings' ? 'Mood & services' : panel === 'restart' ? 'Start again' : panel === 'trailer' ? 'Trailer' : panel === 'details' ? title?.title ?? 'Details' : null;
  const status = shared.phase === 'setup' ? 'Setting up'
    : decided ? 'Tonight'
    : shared.proposal ? `Proposal · ${shared.proposal.agreeCount} of ${shared.proposal.requiredCount} agree`
    : matches.length ? `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}` : 'Choosing';
  const undoable = !panel && !decided && !inLobby && view === 'voting';
  const subheader = (
    <SubHeader back={backTarget} title={panelTitle ?? roomLabel(snapshot)}
      subtitle={panelTitle ? null : <GText size={12} color={shared.proposal && !decided ? glow.amber : glow.muted} lines={1}>{status}</GText>}
      right={undoable ? (
        <Press label="Undo last choice" disabled={disabled || !undoTarget} onPress={() => void undoVote()} style={{ width: 44, height: 44, borderRadius: 22 }}>
          <Icon name="undo" size={20} color={glow.muted} />
        </Press>
      ) : undefined} />
  );
  const notices = (state.error || state.privateError || entry.error || state.pending || state.connection !== 'live' || notice) ? (
    <View style={{ ...column, paddingVertical: 4 }}>
      <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: R.control, backgroundColor: '#201c13', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <GText size={12} lines={2} style={{ flex: 1 }}>
          {state.retrySeconds > 0 ? `Try again in ${state.retrySeconds}s. Your action is saved.`
            : notice || entry.error || (state.privateError ? 'Private state needs a refresh before choosing.'
              : state.pending ? 'Your choice is awaiting confirmation.'
              : state.error || (state.connection === 'background' ? 'Updates paused while away.' : 'Connecting to the room…'))}
        </GText>
        <Press label={state.pending ? 'Retry pending action' : entry.error ? 'Retry connection' : 'Refresh room'}
          onPress={() => {
            setNotice('');
            if (state.pending) void send();
            else if (entry.error) void entry.retry();
            else { void state.refetch().catch(() => undefined); state.reconnect(); }
          }}
          disabled={state.busy || state.retrySeconds > 0}>
          <GText size={12} bold>{state.retrySeconds > 0 ? `Retry in ${state.retrySeconds}s` : state.pending ? 'Retry' : entry.error ? 'Retry connection' : 'Refresh'}</GText>
        </Press>
      </View>
    </View>
  ) : null;

  // Short landscape keeps a usable poster by placing the controls beside it.
  const sideControls = box.height < 380 && box.width >= 500;
  const showShuffle = readiness({ starting, phase: shared.phase, hasCard: Boolean(card), voting: view === 'voting', stream: shared.stream, failed: Boolean(state.error) });
  const voting = (
    <View onLayout={(e) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      style={{ flex: 1, minHeight: 0, flexDirection: sideControls ? 'row' : 'column', alignItems: sideControls ? 'center' : undefined, width: '100%', maxWidth: COLUMN.maxWidth, alignSelf: 'center', paddingHorizontal: sideControls ? COLUMN.inset : 0, paddingVertical: sideControls ? 8 : 0 }}>
      <View onLayout={(e) => setStage({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        style={{ flex: 1, alignSelf: sideControls ? 'stretch' : 'center', width: '100%', maxWidth: sideControls ? undefined : 560, minHeight: 80, alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
        {showShuffle ? <Shuffle width={dimensions.width} height={dimensions.height} />
          : title ? (
            <>
              <PeerStage layer="back" activity={activity} width={dimensions.width} height={dimensions.height} desktop={false} />
              <PointerSurface width={dimensions.width} height={dimensions.height}
                onPointer={(pointer) => {
                  state.pointer(pointer);
                  if (pointer && Date.now() - pointerAt.current > 280) {
                    pointerAt.current = Date.now();
                    setLocalReaction({ at: Date.now(), gesture: pointer.pressed ? 'reach' : 'handle' });
                  }
                }}>
                <Poster showText={dimensions.height >= 300} title={title} width={dimensions.width} height={dimensions.height} mode="voting" disabled={disabled}
                  onVote={(yes) => void vote(yes)} onBrowse={() => undefined} onDetails={() => setPanel('details')} onTrailer={() => setPanel('trailer')}
                  onGesture={(gesture) => { setLocalReaction({ at: Date.now(), gesture }); state.activity(gesture); }}
                  stampStyle={stampStyle} />
              </PointerSurface>
              <PeerStage layer="front" activity={activity} width={dimensions.width} height={dimensions.height} desktop={false} />
            </>
          ) : (
            <View style={{ padding: 24, gap: 14, alignItems: 'center', maxWidth: 420 }}>
              <Icon name="tickets" size={44} color={glow.amber} />
              <GText size={22} bold style={{ textAlign: 'center' }}>
                {shared.stream.reason === 'awaiting_answers' ? 'You’re caught up' : shared.stream.state === 'unavailable' ? 'Suggestions couldn’t load' : shared.stream.state === 'capacity' ? 'This room reached its suggestion limit' : 'No more suggestions right now'}
              </GText>
              <GText size={14} color={glow.muted} style={{ textAlign: 'center' }}>
                {shared.stream.reason === 'awaiting_answers'
                  ? 'Keep this room open while friends choose. Your screen will update when more suggestions are available.'
                  : 'Availability may be incomplete. Retry, inspect your matches, or ask the host to review the services.'}
              </GText>
              <Action small label="Try again" disabled={disabled} onPress={() => void send({ type: 'refill', generation: shared.generation, expectedStreamVersion: shared.stream.version })} />
            </View>
          )}
      </View>
      <View style={{ width: sideControls ? 380 : undefined, paddingHorizontal: sideControls ? 0 : COLUMN.inset, paddingBottom: 8, gap: 10 }}>
        <Press label={matches.length ? `Inspect ${matches.length} matches` : shared.proposal ? 'Inspect proposal' : 'Matches will appear here'} disabled={!matches.length && !shared.proposal}
          onPress={() => { if (matches.length || shared.proposal) { playFeedback('matches'); setView('matches'); } }}
          style={{ flexDirection: 'row', gap: 12, backgroundColor: '#ffffff08', borderWidth: 1, borderColor: shared.proposal ? '#fbbf2466' : '#ffffff12', borderRadius: R.control, height: size.compact ? 48 : 60, paddingHorizontal: 14 }}>
          <Icon name="tickets" color={matches.length ? glow.amber : glow.muted} />
          <View style={{ flex: 1 }}>
            <GText bold>{matches.length ? `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}` : 'Matches'}</GText>
            <GText size={12} color={shared.proposal ? glow.amber : glow.muted} lines={1}>
              {shared.proposal ? `Proposal · ${shared.proposal.agreeCount} of ${shared.proposal.requiredCount} agree` : matches.length ? 'Tap to reveal together' : 'Appear here'}
            </GText>
          </View>
          {/* Match posters stay hidden until the group reveals them together. */}
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {matches.slice(-3).map((m) => (
              <View key={m.candidateId} style={{ width: 24, height: 36, borderRadius: 4, backgroundColor: '#303030', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="tickets" size={12} color="#818181" />
              </View>
            ))}
          </View>
          <Icon name="right" size={17} />
        </Press>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <VoteKey yes={false} disabled={disabled || !card || showShuffle} compact={size.compact} onPress={() => void vote(false)} />
          <VoteKey yes disabled={disabled || !card || showShuffle} compact={size.compact} onPress={() => void vote(true)} />
        </View>
      </View>
    </View>
  );
  // The approved matches layout needs about 420 px; shorter bodies scroll it instead of clipping Propose/Agree.
  const shortMatches = matchesArea < 420;
  const matchesView = (
    <ScrollView onLayout={(e) => setMatchesArea(e.nativeEvent.layout.height)} scrollEnabled={shortMatches} style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <View style={{ ...column, flex: 1, height: shortMatches ? 420 : undefined, minHeight: 0 }}>
        <DecisionRoom
          key={shared.generation}
          readOnly={decided}
          items={decisionItems}
          proposal={shared.proposal ? {
            candidateId: shared.proposal.candidateId,
            version: shared.proposal.version,
            count: shared.proposal.agreeCount,
            ownAgreed: own.agreement.proposalVersion === shared.proposalVersion && own.agreement.agreed,
            isOwn: own.agreement.proposalVersion === shared.proposalVersion && own.agreement.isProposer,
            previousTitle: previousProposal ? titleYear(titlePresentation(previousProposal)) : null,
          } : null}
          total={shared.proposal?.requiredCount ?? shared.participants.filter((p) => !p.dropped).length}
          matchCount={shared.matches.length}
          checking={shared.agreement.state === 'checking'}
          unavailable={shared.agreement.state === 'unavailable'}
          disabled={disabled}
          wide={false}
          focus={active}
          setFocus={setActive}
          keepVoting={decided ? undefined : () => setView('voting')}
          propose={(cid) => void propose(cid)}
          agree={() => void agree(true)}
          withdraw={() => void agree(false)}
          retry={() => void send({ type: 'retry_agreement', generation: shared.generation, expectedAgreementVersion: shared.agreement.version, expectedProposalVersion: shared.proposalVersion })}
          inspect={(kind, candidateId) => {
            if (decided) return;
            if (kind === 'poster') {
              if (candidateId && shared.matches.some((m) => m.candidateId === candidateId)) state.inspect({ kind, candidateId });
            } else state.inspect({ kind });
          }}
          cues={inspectionCues}
          people={people}
          shape={{ control: R.control, card: R.card }}
          inset={0}
          renderBadge={(item, lens, _tiny, _best, width) => (lens === 'score' && item.title.score !== null
            ? <View pointerEvents="none" style={{ position: 'absolute', top: 4, right: 4 }}><ScorePill score={item.title.score} cardWidth={width} /></View>
            : undefined)}
        />
      </View>
    </ScrollView>
  );
  const decision = shared.decision;
  const body = inLobby ? (
    <Lobby snapshot={snapshot} disabled={disabled} send={lobbySend} invite={() => setPanel('room')} edit={() => setPanel('settings')} />
  ) : decided && title && card && decision && !reviewingDecision ? (
    <Done
      title={title}
      decisionKey={`${shared.roomId}:${shared.generation}:${decision.decidedAt}`}
      decidedAt={decision.decidedAt}
      serverNow={state.activityNow()}
      watch={{ identity: card.identity, availability: decision.availability ?? [], screens: shared.screens }}
      startAgain={own.canHost ? () => setPanel('restart') : undefined}
      ownerName={hostName}
      cheer={{
        enabled: state.connection === 'live' && foreground && !selfDropped && !panel,
        send: state.cheer,
        events: state.cheerEvents,
        peers: state.cheerHolders,
        selfId: own.participantId,
        required: shared.participants.filter((p) => !p.dropped).map((p) => p.participantId),
      }}
    />
  ) : view === 'matches' || decided ? matchesView : voting;

  return (
    <AppFrame
      onLogo={toRooms}
      people={<Faces localReaction={localReaction} people={people} activity={activity} open={() => setPanel('room')} />}
      subheader={<>{subheader}{developmentNotice ? <GText size={11} color={glow.muted} style={{ textAlign: 'center', paddingHorizontal: 12 }}>{developmentNotice}</GText> : null}{notices}</>}
    >
      {/* Panels cover the body; it stays laid out (posters keep their measured size) but is hidden from assistive tech. */}
      <CoveredBody covered={Boolean(panel)}>{body}</CoveredBody>
      {panel === 'settings' && (
        <RoomSettings snapshot={snapshot} preview={(input, signal) => continuousApi.preview(state.access!, input, signal)} disabled={disabled} action="Save" busyLabel="Saving…" submit={saveSettings} />
      )}
      {panel === 'restart' && (
        <RoomSettings snapshot={snapshot} preview={(input, signal) => continuousApi.preview(state.access!, input, signal)} disabled={disabled} action="Start again" busyLabel="Starting…" submit={startAgain}
          notice={decided ? 'Tonight’s pick stays until you start. Everyone gets new cards.' : undefined} />
      )}
      {panel === 'room' && (
        <Panel testID="room-panel">
          {shared.description && (
            <View style={{ gap: 10 }}>
              <Label>What we’re looking for</Label>
              <GText>{shared.description.prompt}</GText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {shared.description.attributes.map((a, i) => <Chip key={i} gold>{a.text}</Chip>)}
              </View>
            </View>
          )}
          <Label>People</Label>
          {people.map((p) => (
            <GText key={p.id} color={p.dropped ? glow.muted : glow.ink}>{p.nickname}{p.self ? ' · You' : ''}{p.id === shared.hostParticipantId ? ' · Host' : ''}{p.dropped ? ' · Left' : ''}</GText>
          ))}
          {invite ? (
            <>
              <GText size={14} color={glow.muted}>Invite friends to join in their browser.</GText>
              <GText size={14} selectable>{appInviteUrl(invite.path)}</GText>
              <Action gold icon="people" label="Share invitation"
                onPress={() => void shareInvitation(appInviteUrl(invite.path)).then((result) => setShareNotice(result === 'copied' ? 'Invitation copied.' : result === 'manual' ? 'Select and copy the invitation link above.' : ''))} />
              {shareNotice ? <GText size={14} color={glow.soft}>{shareNotice}</GText> : null}
            </>
          ) : (
            <GText color={glow.muted}>Reopen the original invitation to share its link.</GText>
          )}
          {!guestOnly && (own.member.state === 'linked'
            ? <GText bold>Signed in with GoodWatch</GText>
            : <GoodWatchButton disabled={memberBusy || disabled} onPress={() => void signin()} />)}
          {notice ? <GText size={14} color="#fca5a5">{notice}</GText> : null}
          <GText color={glow.muted} size={13}>Individual answers are private. Shared results can still reveal preferences in small groups.</GText>
          {own.canHost && decided && <Action label="Start again" icon="tickets" disabled={disabled} onPress={() => setPanel('restart')} />}
          <Action label="Refresh room" onPress={() => void state.refetch().catch(() => undefined)} />
          <Action label="Leave room" disabled={disabled} onPress={() => { void send({ type: 'leave' }).then(async (ok) => { if (!ok) return; await roomRegistry.markLeft(id, roomLabel(snapshot)).catch(() => undefined); router.replace('/'); }); }} />
          <GText size={12} color={glow.muted}>
            Your place and answers stay saved. You’ll be marked as left and won’t be needed for matches or agreement. Return from History on this device. If you host, someone still here takes over.
          </GText>
          <SoundToggle />
          <Feedback />
        </Panel>
      )}
      {panel === 'details' && title && (
        <Panel testID="details-panel">
          {title.posterUrl ? <Thumb uri={title.posterUrl} width={92} style={{ borderRadius: R.card }} /> : null}
          <GText color={glow.muted}>{[title.year, title.episodeLabel, title.genres.join(' · ')].filter(Boolean).join(' · ')}</GText>
          {title.score !== null && <ScorePill score={title.score} cardWidth={200} />}
          <GText>{title.overview ?? 'No synopsis is available.'}</GText>
          {card && <WatchLinks identity={card.identity} availability={decided && shared.decision?.candidateId === card.id ? shared.decision.availability : card.availability} screens={shared.screens} />}
        </Panel>
      )}
      {panel === 'trailer' && title?.trailerUrl && (
        <Panel testID="trailer-panel">
          <Trailer key={title.id} url={title.trailerUrl} />
        </Panel>
      )}
      <EdgeBack back={back} />
    </AppFrame>
  );
}
