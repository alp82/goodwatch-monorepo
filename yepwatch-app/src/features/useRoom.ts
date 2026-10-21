import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import type { CommandEnvelope, RoomCommand, RoomSnapshot } from '@goodwatch/yepwatch-contracts';
import { api, ApiFailure } from '../core/api';
import { loadAccess, type RoomAccess } from '../core/credentials';
import { queryClient, roomKey } from '../core/providers';
import { CommandQueue, mergeShared, mergeSnapshot } from '../core/room-state';
import { RoomRealtime, type Connection } from '../core/realtime';
import { realtimeUrl } from '../core/config';

export function useRoom(roomId: string) {
  const [access, setAccess] = useState<RoomAccess | null>(); const [connection, setConnection] = useState<Connection>('connecting');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [pendingId, setPendingId] = useState<string>();
  const [privateError, setPrivateError] = useState(false);
  const [pending, setPending] = useState<CommandEnvelope | null>(null);
  const queue = useRef(new CommandQueue(() => Crypto.randomUUID())); const realtime = useRef<RoomRealtime | null>(null);
  const apply = useCallback((snapshot: RoomSnapshot) => queryClient.setQueryData<RoomSnapshot>(roomKey(roomId), old => mergeSnapshot(old, snapshot)), [roomId]);
  const refetch = useCallback(async () => {
    if (!access) return;
    try { const value = await api.snapshot(access); apply(value); setPrivateError(false); return value; }
    catch (error) { setPrivateError(true); throw error; }
  }, [access, apply]);
  const room = useQuery({ queryKey: roomKey(roomId), enabled: Boolean(access), queryFn: async () => {
    const incoming = await api.snapshot(access!);
    return mergeSnapshot(queryClient.getQueryData(roomKey(roomId)), incoming);
  } });
  useEffect(() => { let active = true; loadAccess(roomId).then(a => { if (active) setAccess(a); }).catch(() => { if (active) { setAccess(null); setError('The room credential could not be loaded. Reopen your invitation.'); } }); return () => { active = false; }; }, [roomId]);
  useEffect(() => {
    if (!access) return;
    const channel = new RoomRealtime({ roomId, ticket: () => api.ticket(access), socket: path => new WebSocket(realtimeUrl(path)), status: setConnection,
      revision: () => queryClient.getQueryData<RoomSnapshot>(roomKey(roomId))?.shared.revision ?? null,
      snapshot: shared => { queryClient.setQueryData<RoomSnapshot>(roomKey(roomId), old => mergeShared(old, shared)); }, refetchPrivate: refetch });
    realtime.current = channel;
    if (AppState.currentState === 'active') channel.start(); else channel.pause();
    const sub = AppState.addEventListener('change', state => { if (state === 'active') { void refetch().catch(() => setError('Could not restore your private room state. Retry when connected.')); channel.start(); } else channel.pause(); });
    return () => { channel.stop(); sub.remove(); realtime.current = null; };
  }, [access, roomId, refetch]);
  async function send(command?: RoomCommand) {
    const snapshot = queryClient.getQueryData<RoomSnapshot>(roomKey(roomId));
    if (!snapshot || !access || queue.current.busy) return;
    setBusy(true); setError('');
    if (command?.type === 'vote' && command.value !== null) setPendingId(command.candidateId);
    try { const value = await queue.current.send(command, snapshot, body => api.command(access, body)); apply(value); setPendingId(undefined); }
    catch (e) {
      if (e instanceof ApiFailure && e.snapshot) apply(e.snapshot);
      setError(e instanceof Error ? e.message : 'This action could not be confirmed.');
      if (!queue.current.pending) { setPendingId(undefined); void refetch().catch(() => undefined); }
    } finally { setPending(queue.current.pending); setBusy(false); }
  }
  return { room, access, connection, error, privateError, busy, pendingId, pending, send, refetch, reconnect: () => realtime.current?.start() };
}
