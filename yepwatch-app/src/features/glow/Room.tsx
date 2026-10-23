import { shareInvitation } from '../../core/share-invitation';
import { useEffect, useRef, useState } from 'react';
import { Linking, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useContinuousRoom } from '../../core/continuous/useRoom';
import { latestRetainedVote, ownCard } from '../../core/continuous/state';
import { groupActivity } from '../../core/continuous/activity';
import { useQuery } from '@tanstack/react-query';
import { loadInvite, type StoredInvite } from '../../core/continuous/invite-store';
import { appInviteUrl } from '../../core/invites';
import { developmentNotice, guestOnly } from '../../core/config';
import { RoomFailure } from '../../core/continuous/api';
import { beginMember } from '../../core/continuous/member';
import { titlePresentation } from './adapter';
import { boundedMatch, presentationSize, type GlowView } from './model';
import { GText, Icon, Pill, Press, VoteButton, Wordmark, Score, glow, s } from './theme';
import { Faces, PeerStage } from './Peers';
import { Backdrop } from './Backdrop';
import { PointerSurface } from './PointerSurface';
import { Poster } from './Poster';
import { Drawer } from './Drawer';
import { Trailer } from './Trailer';
import { Done } from './Done';
import { DecisionRoom } from './DecisionRoom';
import { titleYear } from './decision-model';
import { useActiveTime } from './useActiveTime';
import { Lobby } from './Lobby';
import { useLobbyEntry } from './useLobbyEntry';
export function GlowRoom({ id, signin: initialSignin = false }: { id: string; signin?: boolean }) {
  const state = useContinuousRoom(id);
  const entry = useLobbyEntry(state);
  const invitation = useQuery<StoredInvite | null>({
    queryKey: ['continuous-invite', id],
    queryFn: () => loadInvite(id),
  });
  const snapshot = state.room.data;
  const { width, height } = useWindowDimensions();
  const wide = width >= 900;
  const [view, setView] = useState<GlowView>('voting');
  const [active, setActive] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<'room' | 'details' | 'trailer' | null>(null);
  const [notice, setNotice] = useState('');
  const [shareNotice, setShareNotice] = useState('');
  const [memberBusy, setMemberBusy] = useState(false);
  const [localReaction, setLocalReaction] = useState<{
    at: number;
    gesture?: 'reach' | 'handle' | 'release';
    answer?: boolean;
  }>({ at: 0 });
  const pointerAt = useRef(0);
  const [optimistic, setOptimistic] = useState<string>();
  const [stage, setStage] = useState({
    width: Math.min(width, 560),
    height: Math.max(100, height - 260),
  });
  const refilled = useRef(new Set<string>());
  const signinStarted = useRef(false);
  const send = state.send;
  useEffect(() => {
    if (snapshot?.own.left) router.replace('/');
  }, [snapshot?.own.left]);
  useEffect(() => {
    if (!guestOnly && initialSignin && state.access && state.room.data && !signinStarted.current) {
      signinStarted.current = true;
      void signin();
    }
  });
  const setActivityView = state.setView;
  useEffect(() => {
    setActivityView(
      drawer === 'trailer' ? 'trailer' : snapshot?.shared.phase === 'decided' ? 'away' : view
    );
  }, [drawer, view, snapshot?.shared.phase, setActivityView]);
  // A confirmed server restart discards the previous generation’s local navigation.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView('voting');
    setActive(null);
    setOptimistic(undefined);
  }, [snapshot?.shared.generation]);
  useEffect(() => {
    if (
      !snapshot ||
      snapshot.shared.phase !== 'choosing' ||
      !snapshot.shared.participants.find((p) => p.participantId === snapshot.own.participantId)
        ?.screenId ||
      state.busy ||
      entry.required ||
      state.pending ||
      state.privateError ||
      state.terminal
    )
      return;
    const unanswered = snapshot.shared.candidates.filter(
      (c) => !snapshot.own.votes.some((v) => v.candidateId === c.id && v.value !== null)
    ).length;
    const key = `${snapshot.shared.generation}:${snapshot.shared.stream.version}`;
    if (unanswered <= 2 && snapshot.shared.stream.state === 'ready' && !refilled.current.has(key)) {
      refilled.current.add(key);
      void send({
        type: 'refill',
        generation: snapshot.shared.generation,
        expectedStreamVersion: snapshot.shared.stream.version,
      });
    }
  }, [
    snapshot,
    state.busy,
    state.pending,
    state.privateError,
    state.terminal,
    entry.required,
    send,
  ]);
  const observedCard = snapshot ? ownCard(snapshot, optimistic) : null;
  const observedVote = snapshot?.own.votes.find((v) => v.candidateId === observedCard?.id);
  const exposureKey =
    snapshot && observedCard
      ? `${snapshot.shared.generation}:${observedCard.id}:${observedVote?.revision ?? 0}`
      : null;
  const activeTime = useActiveTime(
    id,
    exposureKey,
    Boolean(observedCard) &&
      view === 'voting' &&
      !drawer &&
      !entry.working &&
      !entry.required &&
      !state.busy &&
      !state.pending &&
      !state.privateError &&
      !state.terminal &&
      snapshot?.shared.phase === 'choosing'
  );
  const terminalText =
    state.terminal === 'expired' ? 'This room has expired' : 'Your room access ended';
  if (state.terminal || state.access === null)
    return (
      <SafeAreaView style={s.statusPage}>
        <View style={s.statusContent}>
          <Wordmark />
          <GText size={34} bold>
            {state.access === null ? 'Reopen your invitation' : terminalText}
          </GText>
          <GText color={glow.muted}>
            Use your invitation to restore your place, or create a new room.
          </GText>
          <Pill label="Go to entrance" gold onPress={() => router.replace('/')}>
            Back to YepWatch
          </Pill>
        </View>
      </SafeAreaView>
    );
  if (!snapshot)
    return (
      <SafeAreaView style={s.statusPage}>
        <View style={s.statusContent}>
          <Wordmark />
          <GText size={28} bold>
            {state.room.error ? 'Couldn’t load the room' : 'Getting the room ready…'}
          </GText>
          {state.room.error && (
            <Pill label="Retry room" onPress={() => void state.refetch().catch(() => undefined)}>
              Retry
            </Pill>
          )}
        </View>
      </SafeAreaView>
    );
  const { shared, own } = snapshot;
  const decided = shared.phase === 'decided';
  const matches = shared.matches
    .map((m) => ({ ...m, candidate: shared.candidates.find((c) => c.id === m.candidateId) }))
    .filter((m) => m.candidate);
  const pickId = shared.proposal?.candidateId ?? null;
  const activeId = boundedMatch(
    matches.map((m) => m.candidateId),
    active,
    pickId
  );
  const card = decided
    ? shared.candidates.find((c) => c.id === shared.decision?.candidateId)
    : view === 'matches'
    ? shared.candidates.find((c) => c.id === activeId)
    : ownCard(snapshot, optimistic);
  const title = card ? titlePresentation(card) : null;
  const dimensions = presentationSize(stage.width, stage.height, wide);
  const disabled =
    state.busy || Boolean(state.pending) || state.privateError || entry.working || entry.required;
  const people = shared.participants.map((p) => ({
    id: p.participantId,
    nickname: p.nickname,
    dropped: p.dropped,
    self: p.participantId === own.participantId,
  }));
  const activity =
    state.connection === 'live'
      ? groupActivity(
          new Map(
            [...state.activities].filter(([, a]) =>
              shared.participants.some(
                (p) => p.participantId === a.frame.participantId && !p.dropped
              )
            )
          ),
          state.activityNow()
        )
      : new Map();
  const invite = invitation.data;
  const undoTarget = latestRetainedVote(snapshot);
  const decisionItems = shared.candidates
    .filter(
      (c) =>
        shared.matches.some((m) => m.candidateId === c.id) || shared.proposal?.candidateId === c.id
    )
    .map((c) => ({
      title: titlePresentation(c),
      averageYepMs: shared.matches.find((m) => m.candidateId === c.id)?.averageYepMs ?? null,
    }));
  const previousProposal = shared.candidates.find(
    (c) => c.id === shared.proposal?.previousCandidateId
  );
  const inspectionCues = [...activity.values()].flatMap((a) => {
    const pulse = a.pulse;
    if (a.frame.view !== 'matches' || pulse?.view !== 'matches' || !pulse.inspection) return [];
    if (
      pulse.inspection.kind === 'poster' &&
      !shared.matches.some(
        (m) =>
          m.candidateId ===
          (pulse.inspection?.kind === 'poster' ? pulse.inspection.candidateId : null)
      )
    )
      return [];
    return [
      {
        participantId: pulse.participantId,
        key: `${pulse.sessionId}:${pulse.sequence}`,
        ...pulse.inspection,
      },
    ];
  });
  async function vote(yes: boolean) {
    if (!card || disabled) return;
    const current = own.votes.find((v) => v.candidateId === card.id);
    setOptimistic(card.id);
    setLocalReaction({ at: Date.now(), answer: yes });
    state.activity(undefined, 'answer');
    await send({
      type: 'vote',
      generation: shared.generation,
      candidateId: card.id,
      expectedVoteRevision: current?.revision ?? 0,
      value: yes ? 'watch' : 'pass',
      activeExposureMs: yes ? activeTime() : null,
    });
    setOptimistic(undefined);
  }
  async function undoVote() {
    if (!undoTarget || disabled) return;
    await send({
      type: 'vote',
      generation: shared.generation,
      candidateId: undoTarget.candidateId,
      expectedVoteRevision: undoTarget.revision,
      value: null,
    });
  }
  async function propose(candidateId: string) {
    if (disabled) return;
    await send({
      type: 'propose',
      generation: shared.generation,
      expectedRosterVersion: shared.rosterVersion,
      expectedProposalVersion: shared.proposalVersion,
      candidateId,
    });
  }
  async function agree(agreed: boolean) {
    if (!shared.proposal || disabled) return;
    await send({
      type: 'agree',
      generation: shared.generation,
      expectedRosterVersion: shared.rosterVersion,
      expectedProposalVersion: shared.proposalVersion,
      candidateId: shared.proposal.candidateId,
      expectedOwnAgreementRevision: own.agreement.revision,
      agreed,
    });
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
          : e instanceof Error
          ? e.message
          : 'Sign-in could not start.'
      );
    } finally {
      setMemberBusy(false);
    }
  }
  const bottom = (
    <View
      style={{
        paddingHorizontal: wide ? 14 : 16,
        paddingTop: wide ? 14 : 0,
        paddingBottom: wide ? 14 : 8,
        gap: 12,
        backgroundColor: wide ? '#0c0c0ce6' : 'transparent',
        borderWidth: wide ? 1 : 0,
        borderColor: '#ffffff14',
        borderRadius: 28,
      }}
    >
      {
        <>
          <Press
            label={
              matches.length
                ? `Inspect ${matches.length} matches`
                : shared.proposal
                ? 'Inspect proposal'
                : 'Matches will appear here'
            }
            onPress={() => {
              if (matches.length || shared.proposal) {
                setView('matches');
              }
            }}
            disabled={!matches.length && !shared.proposal}
            style={{
              flexDirection: 'row',
              gap: 12,
              backgroundColor: '#ffffff08',
              borderWidth: 1,
              borderColor: '#ffffff12',
              borderRadius: 18,
              height: 64,
              paddingHorizontal: 14,
            }}
          >
            <Icon name="tickets" color={matches.length ? glow.amber : glow.muted} />
            <View style={{ flex: 1 }}>
              <GText size={16} bold>
                {matches.length
                  ? `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`
                  : 'Matches'}
              </GText>
              <GText size={12} color={glow.muted}>
                {shared.proposal
                  ? 'A proposal is waiting. Inspect together.'
                  : matches.length
                  ? 'Tap to reveal together'
                  : 'Keep choosing. Matches appear here.'}
              </GText>
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {matches.slice(0, 3).map((m) => (
                <View
                  key={m.candidateId}
                  style={{
                    width: 25,
                    height: 36,
                    borderRadius: 5,
                    backgroundColor: '#303030',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="tickets" size={13} color="#818181" />
                </View>
              ))}
            </View>
            <Icon name="right" size={17} />
          </Press>
          <View
            style={[
              s.row,
              {
                height: wide ? 72 : 82,
                paddingHorizontal: wide ? 0 : 5,
                backgroundColor: '#0e0e0ef5',
                borderRadius: 24,
              },
            ]}
          >
            <Press
              label="Undo last choice"
              disabled={disabled || !undoTarget}
              onPress={() => void undoVote()}
              style={{ width: 44 }}
            >
              <Icon name="undo" size={24} color={glow.muted} />
            </Press>
            <VoteButton
              yes={false}
              disabled={disabled || !card}
              big={wide}
              onPress={() => void vote(false)}
            />
            <VoteButton
              yes
              disabled={disabled || !card}
              big={wide}
              onPress={() => void vote(true)}
            />
          </View>
        </>
      }
    </View>
  );
  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: glow.bg, overflow: 'hidden' }}
    >
      {title?.backdropUrl && <Backdrop url={title.backdropUrl} />}
      <View
        style={{
          height: 60,
          flexShrink: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: wide ? 40 : 20,
        }}
      >
        <Press label="Open room" onPress={() => setDrawer('room')}>
          <Wordmark size={24} />
        </Press>
        <Faces
          localReaction={localReaction}
          people={people}
          activity={activity}
          open={() => setDrawer('room')}
        />
      </View>
      {developmentNotice && (
        <GText size={11} color={glow.muted} style={{ textAlign: 'center', paddingHorizontal: 12 }}>
          {developmentNotice}
        </GText>
      )}
      {(state.error ||
        state.privateError ||
        entry.error ||
        state.pending ||
        state.connection !== 'live' ||
        notice) && (
        <View
          style={{
            paddingHorizontal: 20,
            paddingVertical: 5,
            backgroundColor: '#201c13',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <GText size={12} lines={2} style={{ flex: 1 }}>
            {state.retrySeconds > 0
              ? `Try again in ${state.retrySeconds}s. Your action is saved.`
              : notice ||
                entry.error ||
                (state.privateError
                  ? 'Private state needs a refresh before choosing.'
                  : state.pending
                  ? 'Your choice is awaiting confirmation.'
                  : state.error ||
                    (state.connection === 'background'
                      ? 'Updates paused while away.'
                      : 'Connecting to the room…'))}
          </GText>
          <Press
            label={
              state.pending
                ? 'Retry pending action'
                : entry.error
                ? 'Retry connection'
                : 'Refresh room'
            }
            onPress={() => {
              setNotice('');
              if (state.pending) void send();
              else if (entry.error) void entry.retry();
              else {
                void state.refetch().catch(() => undefined);
                state.reconnect();
              }
            }}
            disabled={state.busy || state.retrySeconds > 0}
          >
            <GText size={12} bold>
              {state.retrySeconds > 0
                ? `Retry in ${state.retrySeconds}s`
                : state.pending
                ? 'Retry'
                : entry.error
                ? 'Retry connection'
                : 'Refresh'}
            </GText>
          </Press>
        </View>
      )}
      {shared.phase === 'setup' ||
      (!decided &&
        !shared.participants.find((p) => p.participantId === own.participantId)?.screenId) ? (
        <Lobby
          snapshot={snapshot}
          disabled={disabled}
          send={send}
          invite={() => setDrawer('room')}
        />
      ) : decided && title ? (
        <Done
          title={title}
          width={width}
          height={height}
          canRestart={own.canHost}
          disabled={disabled}
          where={() => setDrawer('details')}
          restart={() => void send({ type: 'restart', expectedRevision: shared.revision })}
        />
      ) : view === 'matches' ? (
        <DecisionRoom
          items={decisionItems}
          proposal={
            shared.proposal
              ? {
                  candidateId: shared.proposal.candidateId,
                  version: shared.proposal.version,
                  count: shared.proposal.agreeCount,
                  ownAgreed:
                    own.agreement.proposalVersion === shared.proposalVersion &&
                    own.agreement.agreed,
                  isOwn:
                    own.agreement.proposalVersion === shared.proposalVersion &&
                    own.agreement.isProposer,
                  previousTitle: previousProposal
                    ? titleYear(titlePresentation(previousProposal))
                    : null,
                }
              : null
          }
          total={
            shared.proposal?.requiredCount ?? shared.participants.filter((p) => !p.dropped).length
          }
          matchCount={shared.matches.length}
          checking={shared.agreement.state === 'checking'}
          unavailable={shared.agreement.state === 'unavailable'}
          disabled={disabled}
          wide={wide}
          focus={active}
          setFocus={setActive}
          keepVoting={() => setView('voting')}
          propose={(id) => void propose(id)}
          agree={() => void agree(true)}
          withdraw={() => void agree(false)}
          retry={() =>
            void send({
              type: 'retry_agreement',
              generation: shared.generation,
              expectedAgreementVersion: shared.agreement.version,
              expectedProposalVersion: shared.proposalVersion,
            })
          }
          inspect={(kind, candidateId) => {
            if (kind === 'poster') {
              if (candidateId && shared.matches.some((m) => m.candidateId === candidateId))
                state.inspect({ kind, candidateId });
            } else state.inspect({ kind });
          }}
          cues={inspectionCues}
          people={people}
        />
      ) : (
        <View
          style={{
            flex: 1,
            flexDirection: wide ? 'row' : 'column',
            justifyContent: 'center',
            width: '100%',
            maxWidth: 1220,
            alignSelf: 'center',
            paddingHorizontal: wide ? 40 : 0,
          }}
        >
          {wide && (
            <View style={{ flex: 1, justifyContent: 'center', paddingRight: 44, gap: 22 }}>
              <GText size={14} bold color={glow.amber}>
                {decided ? 'IT’S A YEP' : title?.genres.join(' · ').toUpperCase() ?? ''}
              </GText>
              <GText size={58} bold lines={3} style={{ letterSpacing: -2 }}>
                {title?.title ?? 'Something good is out there.'}
              </GText>
              {title && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {title.score !== null && <Score value={title.score} size={46} />}
                  <View>
                    {title.score !== null && (
                      <GText color={glow.soft} size={14}>
                        GoodWatch score
                      </GText>
                    )}
                    <GText color={glow.muted} size={15}>
                      {[
                        title.year,
                        title.runtimeMinutes ? `${title.runtimeMinutes} min` : null,
                        title.episodeLabel,
                        title.kind === 'movie' ? 'Movie' : 'Series',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </GText>
                  </View>
                </View>
              )}
              <GText color={glow.soft} size={18} lines={5}>
                {title?.overview ??
                  'Choose independently. Discover your matches, then propose what to watch together.'}
              </GText>
            </View>
          )}
          <View
            style={{
              flex: wide ? undefined : 1,
              width: wide ? 540 : '100%',
              height: wide ? '100%' : undefined,
              maxHeight: wide ? 800 : undefined,
              alignSelf: 'center',
            }}
          >
            <View
              onLayout={(e) =>
                setStage({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
              }
              style={{
                flex: 1,
                minHeight: 80,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'visible',
              }}
            >
              {title ? (
                <>
                  <PeerStage
                    layer="back"
                    activity={activity}
                    width={dimensions.width}
                    height={dimensions.height}
                    desktop={wide}
                  />
                  <PointerSurface
                    width={dimensions.width}
                    height={dimensions.height}
                    onPointer={(pointer) => {
                      state.pointer(pointer);
                      if (pointer && Date.now() - pointerAt.current > 280) {
                        pointerAt.current = Date.now();
                        setLocalReaction({
                          at: Date.now(),
                          gesture: pointer.pressed ? 'reach' : 'handle',
                        });
                      }
                    }}
                  >
                    <Poster
                      showText={!wide}
                      title={title}
                      width={dimensions.width}
                      height={dimensions.height}
                      mode="voting"
                      disabled={disabled}
                      onVote={(yes) => void vote(yes)}
                      onBrowse={() => undefined}
                      onDetails={() => setDrawer('details')}
                      onTrailer={() => setDrawer('trailer')}
                      onGesture={(gesture) => {
                        setLocalReaction({ at: Date.now(), gesture });
                        state.activity(gesture);
                      }}
                    />
                  </PointerSurface>
                  <PeerStage
                    layer="front"
                    activity={activity}
                    width={dimensions.width}
                    height={dimensions.height}
                    desktop={wide}
                  />
                </>
              ) : (
                <View style={{ padding: 30, gap: 18, alignItems: 'center' }}>
                  <Icon name="tickets" size={46} color={glow.amber} />
                  <GText size={24} bold style={{ textAlign: 'center' }}>
                    {shared.stream.reason === 'awaiting_answers'
                      ? 'You’re caught up'
                      : shared.stream.state === 'unavailable'
                      ? 'Suggestions couldn’t load'
                      : shared.stream.state === 'capacity'
                      ? 'This room reached its suggestion limit'
                      : 'No more suggestions right now'}
                  </GText>
                  <GText size={14} color={glow.muted} style={{ textAlign: 'center' }}>
                    {shared.stream.reason === 'awaiting_answers'
                      ? 'Keep this room open while friends choose. Your screen will update when more suggestions are available.'
                      : 'Availability may be incomplete. Retry, inspect your matches, or ask the host to review the services.'}
                  </GText>
                  {
                    <Pill
                      label="Try more suggestions"
                      disabled={disabled}
                      onPress={() =>
                        void send({
                          type: 'refill',
                          generation: shared.generation,
                          expectedStreamVersion: shared.stream.version,
                        })
                      }
                    >
                      Try again
                    </Pill>
                  }
                </View>
              )}
            </View>
            {bottom}
          </View>
        </View>
      )}
      {drawer === 'room' && (
        <Drawer title="Our room" close={() => setDrawer(null)}>
          {shared.description && (
            <View style={{ gap: 10 }}>
              <GText bold size={20}>
                What we’re looking for
              </GText>
              <GText>{shared.description.prompt}</GText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {shared.description.attributes.map((a, i) => (
                  <View
                    key={i}
                    style={{
                      borderRadius: 18,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      backgroundColor: '#fbbf2418',
                    }}
                  >
                    <GText color={glow.amber} size={12}>
                      {a.text}
                    </GText>
                  </View>
                ))}
              </View>
            </View>
          )}
          {people.map((p) => (
            <GText key={p.id}>
              {p.nickname}
              {p.self ? ' · You' : ''}
              {p.dropped ? ' · Dropped' : ''}
            </GText>
          ))}
          {invite ? (
            <>
              <GText size={14} color={glow.muted}>
                Invite friends to join in their browser.
              </GText>
              <GText size={14} selectable>{appInviteUrl(invite.path)}</GText>
              <Pill
                label="Share invitation"
                icon="people"
                onPress={() =>
                  void shareInvitation(appInviteUrl(invite.path)).then((result) =>
                    setShareNotice(result === 'copied' ? 'Invitation copied.' : result === 'manual'
                      ? 'Select and copy the invitation link above.' : '')
                  )
                }
              >
                Share invitation
              </Pill>
              {shareNotice ? <GText size={14} color={glow.soft}>{shareNotice}</GText> : null}
            </>
          ) : (
            <GText color={glow.muted}>Reopen the original invitation to share its link.</GText>
          )}
          {!guestOnly &&
            (own.member.state === 'linked' ? (
              <GText bold>Signed in with GoodWatch</GText>
            ) : (
              <Pill
                label="Sign in with GoodWatch"
                disabled={memberBusy || disabled}
                onPress={() => void signin()}
              >
                {memberBusy ? 'Signing in with GoodWatch…' : 'Sign in with GoodWatch'}
              </Pill>
            ))}
          {notice && (
            <GText size={14} color="#fca5a5">
              {notice}
            </GText>
          )}
          <GText color={glow.muted} size={13}>
            Individual answers are private. Shared results can still reveal preferences in small
            groups.
          </GText>
          <Pill
            label="Leave room"
            disabled={disabled}
            onPress={() => {
              void send({ type: 'leave' }).then((ok) => {
                if (ok) router.replace('/');
              });
            }}
          >
            Leave room
          </Pill>
          <GText size={12} color={glow.muted}>
            Your place and answers stay saved. You’ll be marked Dropped and won’t be needed for
            matches or agreement. Reopen this invitation on this device to return. If you host,
            someone still here takes over.
          </GText>
          <Pill label="Refresh room" onPress={() => void state.refetch().catch(() => undefined)}>
            Refresh room
          </Pill>
          {own.canHost && shared.phase !== 'setup' && (
            <Pill
              label="Return to setup"
              onPress={() => {
                void send({ type: 'restart', expectedRevision: shared.revision }).then((ok) => {
                  if (ok) setDrawer(null);
                });
              }}
              disabled={disabled}
            >
              Start over with this group
            </Pill>
          )}
        </Drawer>
      )}
      {drawer === 'details' && title && (
        <Drawer title={title.title} close={() => setDrawer(null)}>
          <GText color={glow.muted}>
            {[title.year, title.episodeLabel, title.genres.join(' · ')].filter(Boolean).join(' · ')}
          </GText>
          <GText>{title.overview ?? 'No synopsis is available.'}</GText>
          {(decided ? shared.decision?.availability : card?.availability)?.map((a) => (
            <View key={a.screenId} style={{ gap: 12 }}>
              <GText bold>{'Available for our room'}</GText>
              <GText size={13} color={glow.muted}>
                {a.state === 'watchable'
                  ? a.scope === 'title'
                    ? title.kind === 'movie'
                      ? 'Availability checked for this title.'
                      : 'Series availability checked. The specific episode has not been verified.'
                    : 'Episode availability checked.'
                  : 'Availability is not confirmed for this screen.'}
              </GText>
              {a.offers.map((o, index) => (
                <Pill
                  key={`${o.serviceId}:${index}`}
                  label={`${
                    o.kind === 'search'
                      ? 'Search'
                      : o.kind === 'where_to_watch'
                      ? 'Where to watch on'
                      : 'Open'
                  } ${o.name}`}
                  icon="external"
                  disabled={!o.url}
                  onPress={() => {
                    if (o.url && /^https:\/\//.test(o.url))
                      void Linking.openURL(o.url).catch(() =>
                        setNotice('The provider could not open.')
                      );
                  }}
                >
                  {o.kind === 'search'
                    ? `Search ${o.name}`
                    : o.kind === 'where_to_watch'
                    ? `Where to watch · ${o.name}`
                    : o.name}
                </Pill>
              ))}
            </View>
          ))}
        </Drawer>
      )}
      {drawer === 'trailer' && title?.trailerUrl && (
        <Drawer title="Trailer" close={() => setDrawer(null)}>
          <Trailer key={title.id} url={title.trailerUrl} />
        </Drawer>
      )}
    </SafeAreaView>
  );
}
