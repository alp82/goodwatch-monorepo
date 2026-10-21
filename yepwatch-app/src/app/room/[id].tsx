import { useState } from 'react';
import { Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Heading, Notice, Page, Panel, Row, Words } from '../../components/ui';
import { useRoom } from '../../features/useRoom';
import { Participants, Setup } from '../../features/Lobby';
import { Voting } from '../../features/Voting';
import { LegacyRound } from '../../features/LegacyRound';
import { needsSavedProgressRestart } from '../../core/lobby';
import { Shortlist } from '../../features/Shortlist';
import { Decision } from '../../features/Decision';
import { queryClient } from '../../core/providers';
import { appInviteUrl } from '../../core/invites';
import type { Connection } from '../../core/realtime';

const statusLabels: Record<Connection, string> = { connecting: 'Connecting to live room…', live: 'Live room connected', reconnecting: 'Reconnecting — shared updates paused', background: 'Updates paused while away', unavailable: 'Live connection unavailable — use Refresh to check the room', expired: 'This room has expired' };
export default function Room() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RoomContent key={id} id={id} />;
}
function RoomContent({ id }: { id: string }) {
  const state = useRoom(id);
  const [shareError, setShareError] = useState(''); const [inviteOpen, setInviteOpen] = useState(false); const snapshot = state.room.data;
  const invite = queryClient.getQueryData<{ code: string; path: string }>(['invite', id]);
  async function share() { if (!invite) return; try { await Share.share({ message: `Join my YepWatch room: ${appInviteUrl(invite.path)}`, url: appInviteUrl(invite.path) }); } catch { setShareError('Sharing could not open. Copy or reopen the invitation link shown above.'); } }
  if (state.expired || snapshot?.shared.phase === 'expired') return <Page><Heading>This room has expired</Heading><Words muted>Start a new evening together. Old choices will not be replayed.</Words><Button onPress={() => router.replace('/')}>Create another room</Button></Page>;
  if (state.access === null) return <Page><Heading>Reopen your invitation</Heading><Notice>Your room credential is not available in this app or browser. Use the original link or room code to join.</Notice><Button onPress={() => router.replace('/')}>Go to join</Button></Page>;
  if (!snapshot) return <Page><Heading>Your room</Heading><Notice error={Boolean(state.room.error)}>{state.room.error ? 'The room could not load. Check your connection and retry.' : 'Loading your room…'}</Notice><Button secondary onPress={() => void state.room.refetch()}>Retry</Button></Page>;
  const disabled = state.busy || Boolean(state.pending) || state.privateError;
  const legacyRound = needsSavedProgressRestart(snapshot);
  return <Page eyebrow={snapshot.shared.phase === 'setup' ? undefined : snapshot.shared.phase === 'voting' ? 'Your private round' : 'Choose together'}>
    <Row><Words muted style={{ fontSize: 13 }}>{statusLabels[state.connection]}</Words>{state.connection !== 'live' && <Button secondary onPress={() => { state.reconnect(); }}>Reconnect</Button>}<Button secondary disabled={state.busy} onPress={() => { setShareError(''); void state.refetch().catch(() => undefined); }}>Refresh room</Button></Row>
    {state.privateError && <Notice error>Your private room state could not refresh. Refresh the room before choosing again. Shared updates may still be connected.</Notice>}
    {(state.error || shareError) && <Notice error>{state.error || shareError}</Notice>}
    {state.pending && <Panel><Words>Your last action is awaiting confirmation. Other choices are paused to keep the order safe.</Words><Button disabled={state.busy} onPress={() => void state.send()}>Retry pending action</Button></Panel>}
    {snapshot.shared.phase === 'setup' && <Setup snapshot={snapshot} disabled={disabled} send={state.send} />}
    {invite && snapshot.shared.phase === 'setup' && <Panel><Button secondary onPress={() => setInviteOpen(v => !v)}>{inviteOpen ? 'Hide invitation' : 'Invite friends'}</Button>{inviteOpen && <><Words>Room code: {invite.code}</Words><Words muted>{appInviteUrl(invite.path)}</Words><Button secondary onPress={() => void share()}>Share invitation</Button><Words muted>Friends can join in a browser without installing.</Words></>}</Panel>}
    <Participants snapshot={snapshot} live={state.connection === 'live'} />
    {legacyRound && <LegacyRound snapshot={snapshot} disabled={disabled} send={c => void state.send(c)} />}
    {!legacyRound && snapshot.shared.phase === 'voting' && <Voting snapshot={snapshot} disabled={disabled} pendingId={state.pendingId} send={c => void state.send(c)} />}
    {!legacyRound && snapshot.shared.phase === 'shortlist' && <Shortlist snapshot={snapshot} disabled={disabled} send={c => void state.send(c)} />}
    {snapshot.shared.phase === 'decided' && <Decision snapshot={snapshot} />}
    <Words muted>Room ends {new Date(snapshot.shared.expiresAt).toLocaleString()}. Individual votes are private, but shared results can allow inference.</Words>
  </Page>;
}
