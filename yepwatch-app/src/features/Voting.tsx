import { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, Image, PanResponder, View } from 'react-native';
import type { Candidate, RoomCommand, RoomSnapshot, VoteValue } from '@goodwatch/yepwatch-contracts';
import { Button, Heading, Notice, Panel, Row, Words, colors, useReducedMotion } from '../components/ui';
import { nextCandidate } from '../core/room-state';
import { episodeLabel } from './ShowProgress';

export function TitleCard({ candidate }: { candidate: Candidate }) {
  return <Panel>{candidate.posterUrl && <Image source={{ uri: candidate.posterUrl }} accessibilityLabel={`${candidate.title} poster`} resizeMode="contain" style={{ width: '100%', height: 250, backgroundColor: '#101010', borderRadius: 10 }} />}
    <Words muted style={{ fontSize: 13 }}>{candidate.identity.kind === 'movie' ? 'MOVIE' : candidate.identity.kind === 'show_start' ? 'SHOW TO START' : 'SHOW TO CONTINUE'}{candidate.year ? ` · ${candidate.year}` : ''}{candidate.runtimeMinutes ? ` · ${candidate.runtimeMinutes} min` : ''}</Words>
    <Heading>{candidate.title}</Heading>
    {candidate.identity.kind !== 'movie' && <Words>{episodeLabel(candidate.identity.episode)}</Words>}
    {candidate.overview && <Words muted>{candidate.overview}</Words>}
    <Words muted style={{ fontSize: 13 }}>{candidate.availability.every(a => a.state === 'watchable') && candidate.availability.length > 0 ? 'Offers found for every screen' : 'Availability needs checking'}{candidate.identity.kind !== 'movie' && candidate.availability.some(a => a.scope === 'title') ? ' · Title offers do not confirm this episode’s entitlement' : ''}</Words>
  </Panel>;
}
export function Voting({ snapshot, disabled, pendingId, send }: { snapshot: RoomSnapshot; disabled: boolean; pendingId?: string; send: (c: RoomCommand) => void }) {
  const reduced = useReducedMotion(); const [translation] = useState(() => new Animated.Value(0));
  const [undoId, setUndoId] = useState<string>();
  const candidate = nextCandidate(snapshot, pendingId); const round = snapshot.shared.round!;
  const votedCount = snapshot.own.votes.filter(v => v.value !== null).length;
  const vote = useCallback((value: VoteValue) => {
    if (disabled || !candidate) return;
    setUndoId(candidate.id);
    send({ type: 'vote', roundVersion: round.version, candidateId: candidate.id, expectedVoteRevision: snapshot.own.votes.find(v => v.candidateId === candidate.id)?.revision ?? 0, value });
  }, [disabled, candidate, send, round.version, snapshot.own.votes]);
  const handlers = useMemo(() => PanResponder.create({ onMoveShouldSetPanResponder: (_, g) => !disabled && Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5, onPanResponderMove: (_, g) => translation.setValue(reduced ? 0 : g.dx), onPanResponderRelease: (_, g) => { translation.setValue(0); if (Math.abs(g.dx) > 90) vote(g.dx > 0 ? 'watch' : 'pass'); }, onPanResponderTerminate: () => translation.setValue(0) }), [disabled, reduced, translation, vote]);
  useEffect(() => { translation.setValue(0); }, [pendingId, translation]);
  function undo() { const id = undoId ?? [...snapshot.own.votes].reverse().find(v => v.value !== null)?.candidateId; const vote = snapshot.own.votes.find(v => v.candidateId === id); if (id && vote) send({ type: 'vote', roundVersion: round.version, candidateId: id, expectedVoteRevision: vote.revision, value: null }); }
  const completed = snapshot.shared.participants.find(p => p.participantId === snapshot.own.participantId)?.participation === 'waiting';
  if (completed) return <><Heading>You’re in for the next round</Heading><Words muted>This round’s group and screens are fixed. Your vote will count when a new round starts.</Words></>;
  if (snapshot.own.roundCompleted) return <><Heading>Your round is finished</Heading><Notice>Waiting for everyone to finish. The shared shortlist will arrive when all required rounds are confirmed.</Notice></>;
  return <><Heading>Would you watch this?</Heading><Words muted>Your round · {votedCount} of {round.candidateCount} confirmed. The shortlist comes after everyone finishes.</Words>
    <View accessibilityRole="progressbar" accessibilityLabel="Your confirmed votes" accessibilityValue={{ min: 0, max: round.candidateCount, now: votedCount }} style={{ height: 5, backgroundColor: colors.raised, borderRadius: 3 }}><View style={{ height: 5, backgroundColor: colors.amber, width: `${round.candidateCount ? Math.min(100, votedCount / round.candidateCount * 100) : 0}%` }} /></View>
    {candidate ? <><Animated.View {...handlers.panHandlers} style={{ transform: [{ translateX: translation }] }}><TitleCard candidate={candidate} /></Animated.View><Row><Button secondary disabled={disabled} onPress={() => vote('pass')}>Pass tonight</Button><Button disabled={disabled} onPress={() => vote('watch')}>Would watch</Button><Button secondary disabled={disabled} onPress={() => vote('veto')}>Not okay tonight</Button></Row></> : <Panel><Words>You’ve reached the end of this deck.</Words><Button disabled={disabled || votedCount < round.candidateCount} onPress={() => send({ type: 'complete_round', roundVersion: round.version })}>Finish my round</Button><Words muted>We’ll wait for everyone’s confirmed round, then show the shared shortlist.</Words></Panel>}
    {(votedCount > 0 || pendingId) && <Button secondary disabled={disabled} onPress={undo}>Undo my last choice</Button>}
    {pendingId && <Notice>Your latest choice is pending confirmation.</Notice>}
    <Words muted>Swipe left to pass or right to watch. The buttons do the same thing. “Not okay tonight” is a room veto. None of these actions changes your GoodWatch history.</Words>
  </>;
}
