import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import type { CommandEnvelope, RoomCommand, RoomSnapshot } from '@goodwatch/yepwatch-contracts';
import { api, ApiFailure } from '../core/api';
import { isRoomExpired } from '../core/errors';
import { loadAccess, type RoomAccess } from '../core/credentials';
import { queryClient, roomKey } from '../core/providers';
import { CommandQueue, mergeShared, mergeSnapshot } from '../core/room-state';
import { RoomRealtime, type Connection } from '../core/realtime';
import { realtimeUrl } from '../core/config';

export function useRoom(roomId: string) {
  const [access, setAccess] = useState<RoomAccess | null>(); const [connection, setConnection] = useState<Connection>('connecting');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [pendingId, setPendingId] = useState<string>();
  const [privateError, setPrivateError] = useState(false); const [expired, setExpired] = useState(false);
  const terminal = useRef(false);
  const [pending, setPending] = useState<CommandEnvelope | null>(null);
  const queue = useRef(new CommandQueue(() => Crypto.randomUUID())); const realtime = useRef<RoomRealtime | null>(null);
  const expire = useCallback(() => {
    terminal.current = true; realtime.current?.stop(); setExpired(true); setConnection('expired');
    setPending(null); setPendingId(undefined);
    queryClient.setQueryData<RoomSnapshot>(roomKey(roomId), old => old ? { ...old, shared: { ...old.shared, phase: 'expired' } } : old);
  }, [roomId]);
  const checkExpiry = useCallback((failure?: unknown) => {
    const shared = queryClient.getQueryData<RoomSnapshot>(roomKey(roomId))?.shared;
    if (terminal.current || isRoomExpired(failure) || shared?.phase === 'expired' || (shared && shared.expiresAt <= Date.now())) { expire(); return true; }
    return false;
  }, [roomId, expire]);
  const apply = useCallback((snapshot: RoomSnapshot) => {
    if (snapshot.shared.phase === 'expired' || snapshot.shared.expiresAt <= Date.now()) { expire(); return; }
    if (!checkExpiry()) queryClient.setQueryData<RoomSnapshot>(roomKey(roomId), old => mergeSnapshot(old, snapshot));
  }, [roomId, checkExpiry, expire]);
  const refetch = useCallback(async () => {
    if (!access || checkExpiry()) return;
    try { const value = await api.snapshot(access); apply(value); if (!terminal.current) setPrivateError(false); return value; }
    catch (error) { if (!checkExpiry(error)) setPrivateError(true); throw error; }
  }, [access, apply, checkExpiry]);
  const room = useQuery({ queryKey: roomKey(roomId), enabled: Boolean(access) && !expired, queryFn: async () => {
    try {
      if (checkExpiry()) throw new ApiFailure('expired', 'This room has expired.');
      const incoming = await api.snapshot(access!);
      if (incoming.shared.phase === 'expired' || incoming.shared.expiresAt <= Date.now()) expire();
      if (checkExpiry()) {
        const cached = queryClient.getQueryData<RoomSnapshot>(roomKey(roomId));
        if (cached) return cached;
        throw new ApiFailure('expired', 'This room has expired.');
      }
      setPrivateError(false);
      return mergeSnapshot(queryClient.getQueryData(roomKey(roomId)), incoming);
    } catch (error) { checkExpiry(error); throw error; }
  } });
  useEffect(() => { let active = true; loadAccess(roomId).then(a => { if (active) setAccess(a); }).catch(() => { if (active) { setAccess(null); setError('The room credential could not be loaded. Reopen your invitation.'); } }); return () => { active = false; }; }, [roomId]);
  useEffect(() => {
    if (!access || terminal.current) return;
    const channel = new RoomRealtime({ roomId, ticket: async () => { try { return await api.ticket(access); } catch (error) { checkExpiry(error); throw error; } }, socket: path => new WebSocket(realtimeUrl(path)), status: value => { if (value === 'expired') expire(); else if (!terminal.current) setConnection(value); },
      roomExpiresAt: () => queryClient.getQueryData<RoomSnapshot>(roomKey(roomId))?.shared.expiresAt ?? null,
      revision: () => queryClient.getQueryData<RoomSnapshot>(roomKey(roomId))?.shared.revision ?? null,
      snapshot: shared => { if (shared.phase === 'expired') { expire(); return; } if (checkExpiry()) return; queryClient.setQueryData<RoomSnapshot>(roomKey(roomId), old => mergeShared(old, shared)); }, refetchPrivate: refetch });
    realtime.current = channel;
    if (AppState.currentState === 'active') channel.start(); else channel.pause();
    const sub = AppState.addEventListener('change', state => { if (state === 'active' && !checkExpiry()) { void refetch().catch(() => setError('Could not restore your private room state. Retry when connected.')); channel.start(); } else channel.pause(); });
    return () => { channel.stop(); sub.remove(); realtime.current = null; };
  }, [access, roomId, refetch, checkExpiry, expire]);
  async function send(command?: RoomCommand) {
    const snapshot = queryClient.getQueryData<RoomSnapshot>(roomKey(roomId));
    if (checkExpiry() || !snapshot || !access || queue.current.busy || privateError) return;
    setBusy(true); setError('');
    if (command?.type === 'vote' && command.value !== null) setPendingId(command.candidateId);
    try { const value = await queue.current.send(command, snapshot, body => api.command(access, body)); apply(value); setPendingId(undefined); }
    catch (e) {
      if (checkExpiry(e)) return;
      if (e instanceof ApiFailure && e.snapshot) apply(e.snapshot);
      setError(e instanceof Error ? e.message : 'This action could not be confirmed.');
      if (!queue.current.pending) { setPendingId(undefined); void refetch().catch(() => undefined); }
    } finally { setPending(terminal.current ? null : queue.current.pending); setBusy(false); }
  }
  return { room, access, expired, connection, error, privateError, busy, pendingId, pending, send, refetch, reconnect: () => { if (!checkExpiry()) realtime.current?.start(); } };
}
