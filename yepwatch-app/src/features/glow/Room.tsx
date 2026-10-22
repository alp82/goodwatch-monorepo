import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Share, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useContinuousRoom } from '../../core/continuous/useRoom';
import { latestRetainedVote, ownCard } from '../../core/continuous/state';
import { groupActivity } from '../../core/continuous/activity';
import { useQuery } from '@tanstack/react-query';
import { loadInvite, type StoredInvite } from '../../core/continuous/invite-store';
import { appInviteUrl } from '../../core/invites';
import { developmentNotice } from '../../core/config';
import { RoomFailure } from '../../core/continuous/api';
import { beginMember } from '../../core/continuous/member';
import { titlePresentation } from './adapter';
import { boundedMatch, presentationSize, type GlowView } from './model';
import { GText, Icon, Pill, Press, VoteButton, Wordmark, Score, glow, s } from './theme';
import { Faces, PeerStage } from './Peers';
import { Backdrop } from './Backdrop';
import { Poster } from './Poster';
import { Drawer } from './Drawer';
import { Trailer } from './Trailer';
import { Done } from './Done';
import { Lobby } from './Lobby';
export function GlowRoom({ id, signin: initialSignin = false }: { id: string; signin?: boolean }) {
  const state = useContinuousRoom(id);
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
  const [memberBusy, setMemberBusy] = useState(false);
  const [optimistic, setOptimistic] = useState<string>();
  const [stage, setStage] = useState({
    width: Math.min(width, 560),
    height: Math.max(100, height - 260),
  });
  const refilled = useRef(new Set<string>());
  const signinStarted = useRef(false);
  const send = state.send;
  useEffect(() => {
    if (initialSignin && state.access && state.room.data && !signinStarted.current) {
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
  }, [snapshot, state.busy, state.pending, state.privateError, state.terminal, send]);
  const terminalText =
    state.terminal === 'expired' ? 'This room has expired' : 'Your room access ended';
  if (state.terminal || state.access === null)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: glow.bg,
          justifyContent: 'center',
          padding: 28,
          gap: 22,
        }}
      >
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
      </SafeAreaView>
    );
  if (!snapshot)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: glow.bg,
          justifyContent: 'center',
          padding: 28,
          gap: 20,
        }}
      >
        <Wordmark />
        <GText size={28} bold>
          {state.room.error ? 'Couldn’t load the room' : 'Getting the room ready…'}
        </GText>
        {state.room.error && (
          <Pill label="Retry room" onPress={() => void state.refetch().catch(() => undefined)}>
            Retry
          </Pill>
        )}
      </SafeAreaView>
    );
  const { shared, own } = snapshot;
  const decided = shared.phase === 'decided';
  const matches = shared.matches
    .map((m) => ({ ...m, candidate: shared.candidates.find((c) => c.id === m.candidateId) }))
    .filter((m) => m.candidate);
  const pickId = shared.matches.some((m) => m.candidateId === own.pick.candidateId)
    ? own.pick.candidateId
    : null;
  const activeId = boundedMatch(
    matches.map((m) => m.candidateId),
    active,
    pickId
  );
  const card = decided
    ? shared.candidates.find((c) => c.id === shared.decision?.candidateId)
    : view === 'matches'
    ? matches.find((m) => m.candidateId === activeId)?.candidate
    : ownCard(snapshot, optimistic);
  const title = card ? titlePresentation(card) : null;
  const dimensions = presentationSize(stage.width, stage.height, wide);
  const disabled = state.busy || Boolean(state.pending) || state.privateError;
  const people = shared.participants.map((p) => ({
    id: p.participantId,
    nickname: p.nickname,
    self: p.participantId === own.participantId,
  }));
  const activity =
    state.connection === 'live' ? groupActivity(state.activities, state.activityNow()) : new Map();
  const invite = invitation.data;
  const undoTarget = latestRetainedVote(snapshot);
  async function vote(yes: boolean) {
    if (!card || disabled) return;
    const current = own.votes.find((v) => v.candidateId === card.id);
    setOptimistic(card.id);
    state.activity(undefined, 'answer');
    await send({
      type: 'vote',
      generation: shared.generation,
      candidateId: card.id,
      expectedVoteRevision: current?.revision ?? 0,
      value: yes ? 'watch' : 'pass',
    });
    setOptimistic(undefined);
  }
  function browse(direction: number) {
    const index = matches.findIndex((m) => m.candidateId === activeId);
    if (matches.length)
      setActive(matches[Math.max(0, Math.min(matches.length - 1, index + direction))].candidateId);
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
  async function pick() {
    if (!activeId || disabled) return;
    await send({
      type: 'pick',
      generation: shared.generation,
      expectedRosterVersion: shared.rosterVersion,
      candidateId: activeId,
      expectedPickRevision: own.pick.revision,
    });
  }
  async function signin() {
    if (!state.access || memberBusy) return;
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
      {view === 'voting' && !decided ? (
        <>
          <Press
            label={
              matches.length ? `Inspect ${matches.length} matches` : 'Matches will appear here'
            }
            onPress={() => {
              if (matches.length) {
                setActive(pickId ?? matches[0].candidateId);
                setView('matches');
              }
            }}
            disabled={!matches.length}
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
                {matches.length ? 'Tap to reveal together' : 'Keep choosing. Matches appear here.'}
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
      ) : !decided ? (
        <>
          <View
            style={{
              flexDirection: 'row',
              height: 62,
              gap: 7,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {matches
              .slice(
                Math.max(0, matches.findIndex((m) => m.candidateId === activeId) - 2),
                Math.max(5, matches.findIndex((m) => m.candidateId === activeId) + 3)
              )
              .map((m) => (
                <Press
                  key={m.candidateId}
                  label={`Inspect ${m.candidate!.title}`}
                  selected={activeId === m.candidateId}
                  onPress={() => setActive(m.candidateId)}
                  style={{
                    width: 36,
                    height: 54,
                    minWidth: 36,
                    borderRadius: 7,
                    overflow: 'hidden',
                    borderWidth: activeId === m.candidateId ? 2 : 0,
                    borderColor: glow.amber,
                  }}
                >
                  {m.candidate!.posterUrl ? (
                    <Image
                      source={{ uri: m.candidate!.posterUrl! }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <Icon name="tickets" size={17} />
                  )}
                </Press>
              ))}
          </View>
          <View style={[s.row, { height: 64 }]}>
            <Pill label="Keep voting" onPress={() => setView('voting')} style={{ flex: 1 }}>
              Keep voting
            </Pill>
            <Pill
              label={pickId === activeId ? 'Picked' : 'Pick this'}
              gold
              onPress={() => void pick()}
              disabled={disabled || !activeId}
              icon="check"
              style={{ flex: 1 }}
            >
              {pickId === activeId ? 'Picked' : 'Pick this'}
            </Pill>
          </View>
        </>
      ) : (
        <Pill label="Where to watch" gold onPress={() => setDrawer('details')} icon="external">
          Where to watch
        </Pill>
      )}
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
        <Faces people={people} activity={activity} open={() => setDrawer('room')} />
      </View>
      {developmentNotice && (
        <GText size={11} color={glow.muted} style={{ textAlign: 'center', paddingHorizontal: 12 }}>
          {developmentNotice}
        </GText>
      )}
      {(state.error ||
        state.privateError ||
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
            {notice ||
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
            label={state.pending ? 'Retry pending action' : 'Refresh room'}
            onPress={() => {
              setNotice('');
              if (state.pending) void send();
              else {
                void state.refetch().catch(() => undefined);
                state.reconnect();
              }
            }}
            disabled={state.busy}
          >
            <GText size={12} bold>
              {state.pending ? 'Retry' : 'Refresh'}
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
          refresh={state.refetch}
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
      ) : (
        <View
          style={{
            flex: 1,
            flexDirection: wide ? (view === 'matches' ? 'row-reverse' : 'row') : 'column',
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
                {decided
                  ? 'IT’S A YEP'
                  : view === 'matches'
                  ? 'YOUR MATCHES'
                  : title?.genres.join(' · ').toUpperCase() ?? ''}
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
                  'Choose independently. Discover your matches, then pick together.'}
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
                  <Poster
                    showText={!wide && view === 'voting' && !decided}
                    title={title}
                    width={dimensions.width}
                    height={dimensions.height}
                    mode={decided ? 'decided' : view}
                    disabled={disabled}
                    onVote={(yes) => void vote(yes)}
                    onBrowse={browse}
                    onDetails={() => setDrawer('details')}
                    onTrailer={() => setDrawer('trailer')}
                    onGesture={state.activity}
                  />
                  <PeerStage
                    layer="front"
                    activity={activity}
                    width={dimensions.width}
                    height={dimensions.height}
                    desktop={wide}
                  />
                  {view === 'matches' && !decided && (
                    <>
                      <Press
                        label="Previous match"
                        disabled={matches.findIndex((m) => m.candidateId === activeId) <= 0}
                        onPress={() => browse(-1)}
                        style={{
                          position: 'absolute',
                          left: 8,
                          width: 44,
                          backgroundColor: '#141414aa',
                          borderRadius: 22,
                        }}
                      >
                        <Icon name="left" />
                      </Press>
                      <Press
                        label="Next match"
                        disabled={
                          matches.findIndex((m) => m.candidateId === activeId) >= matches.length - 1
                        }
                        onPress={() => browse(1)}
                        style={{
                          position: 'absolute',
                          right: 8,
                          width: 44,
                          backgroundColor: '#141414aa',
                          borderRadius: 22,
                        }}
                      >
                        <Icon name="right" />
                      </Press>
                    </>
                  )}
                </>
              ) : (
                <View style={{ padding: 30, gap: 18, alignItems: 'center' }}>
                  <Icon name="tickets" size={46} color={glow.amber} />
                  <GText size={24} bold style={{ textAlign: 'center' }}>
                    {view === 'matches'
                      ? 'The shared matches changed'
                      : shared.stream.reason === 'awaiting_answers'
                      ? 'You’re caught up'
                      : shared.stream.state === 'unavailable'
                      ? 'Suggestions couldn’t load'
                      : shared.stream.state === 'capacity'
                      ? 'This room reached its suggestion limit'
                      : 'No more suggestions right now'}
                  </GText>
                  <GText size={14} color={glow.muted} style={{ textAlign: 'center' }}>
                    {view === 'matches'
                      ? 'A new person or changed answer can change the matches. Keep voting to discover more.'
                      : shared.stream.reason === 'awaiting_answers'
                      ? 'Keep this room open while friends choose. Your screen will update when more suggestions are available.'
                      : 'Availability may be incomplete. Retry, inspect your matches, or ask the host to review the services.'}
                  </GText>
                  {view === 'voting' && (
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
                  )}
                </View>
              )}
            </View>
            {(view === 'matches' || decided) && (
              <View
                style={{
                  height: !wide ? 68 : 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  paddingHorizontal: 20,
                }}
              >
                <>
                  {!wide && title && (
                    <GText bold size={22} lines={1}>
                      {title.title}
                    </GText>
                  )}
                </>
                <GText size={14} color={decided ? glow.amber : glow.muted}>
                  {decided
                    ? `Everyone picked it. Enjoy your watch.${
                        title?.kind === 'show_continue' && title.episodeLabel
                          ? ` · ${title.episodeLabel}`
                          : ''
                      }`
                    : shared.agreement.state === 'checking'
                    ? 'Checking availability for everyone…'
                    : `${matches.find((m) => m.candidateId === activeId)?.pickCount ?? 0} ${
                        matches.find((m) => m.candidateId === activeId)?.pickCount === 1
                          ? 'pick'
                          : 'picks'
                      } · Pick when you’re ready`}
                </GText>
              </View>
            )}
            {shared.agreement.state === 'unavailable' && (
              <Press
                label="Retry availability check"
                onPress={() =>
                  void send({
                    type: 'retry_agreement',
                    generation: shared.generation,
                    expectedAgreementVersion: shared.agreement.version,
                  })
                }
                disabled={disabled}
              >
                <GText size={13} color={glow.amber}>
                  Availability needs another check · Retry
                </GText>
              </Press>
            )}
            {bottom}
          </View>
        </View>
      )}
      {drawer === 'room' && (
        <Drawer title="Our room" close={() => setDrawer(null)}>
          {people.map((p) => (
            <GText key={p.id}>
              {p.nickname}
              {p.self ? ' · You' : ''}
            </GText>
          ))}
          {invite ? (
            <>
              <GText size={14} color={glow.muted}>
                Invite friends to join in their browser.
              </GText>
              <GText size={14}>{appInviteUrl(invite.path)}</GText>
              <Pill
                label="Share invitation"
                icon="people"
                onPress={() =>
                  void Share.share({ message: appInviteUrl(invite.path) }).catch(() =>
                    setNotice('Sharing could not open. Use the displayed invitation link.')
                  )
                }
              >
                Share invitation
              </Pill>
            </>
          ) : (
            <GText color={glow.muted}>Reopen the original invitation to share its link.</GText>
          )}
          {shared.screens.length > 1 && (
            <>
              <GText bold>Your viewing screen</GText>
              {shared.screens.map((screen) => (
                <Pill
                  key={screen.id}
                  label={`Watch on ${screen.label}`}
                  gold={
                    shared.participants.find((p) => p.participantId === own.participantId)
                      ?.screenId === screen.id
                  }
                  disabled={disabled || decided}
                  onPress={() =>
                    void send({
                      type: 'assign_screen',
                      expectedContextVersion: shared.contextVersion,
                      screenId: screen.id,
                    })
                  }
                >
                  {screen.label} · {screen.country}
                </Pill>
              ))}
            </>
          )}
          {own.member.state === 'linked' ? (
            <GText bold>GoodWatch connected</GText>
          ) : (
            <Pill
              label="Sign in with GoodWatch"
              disabled={memberBusy || disabled}
              onPress={() => void signin()}
            >
              {memberBusy ? 'Connecting GoodWatch…' : 'Sign in with GoodWatch'}
            </Pill>
          )}
          {notice && (
            <GText size={14} color="#fca5a5">
              {notice}
            </GText>
          )}
          <GText color={glow.muted} size={13}>
            Individual answers are private. Shared results can still reveal preferences in small
            groups.
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
              <GText bold>
                {shared.screens.find((s) => s.id === a.screenId)?.label ?? 'Viewing screen'}
              </GText>
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
