import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import type {
  ActivityGesture,
  MatchInspection,
  ActivityView,
  CommandEnvelope,
  RoomCommand,
  RoomSnapshot,
} from '@goodwatch/yepwatch-contracts/proposal';
import { continuousApi as api, RoomFailure } from './api';
import { loadAccess, nativeClient, saveAccess, type RoomAccess } from '../credentials';
import { queryClient } from '../providers';
import { publicFailureMessage } from '../recovery';
import { continuousRealtimeUrl } from '../config';
import type { Connection } from '../realtime';
import { mergeRoom, mergePublic, PersistentCommands, type CachedRoom } from './state';
import { readPending, writePending } from './storage';
import { ContinuousRealtime } from './realtime';
import { applyActivity, pruneActivity, type PeerActivity } from './activity';
export const continuousKey = (id: string) => ['proposal-room', id] as const;
export function useContinuousRoom(roomId: string) {
  const [access, setAccess] = useState<RoomAccess | null>();
  const [connection, setConnection] = useState<Connection>('connecting');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [privateError, setPrivateError] = useState(false);
  const [terminal, setTerminal] = useState<'expired' | 'access' | null>(null);
  const terminalRef = useRef<typeof terminal>(null);
  const [pending, setPending] = useState<CommandEnvelope | null>(null);
  const [activities, setActivities] = useState(new Map<string, PeerActivity>());
  const clock = useRef(0);
  const channel = useRef<ContinuousRealtime | null>(null);
  const queue = useRef(
    new PersistentCommands(() => Crypto.randomUUID(), { write: (e) => writePending(roomId, e) })
  );
  const cached = useCallback(
    () => queryClient.getQueryData<CachedRoom>(continuousKey(roomId)),
    [roomId]
  );
  const end = useCallback((why: 'expired' | 'access') => {
    terminalRef.current = why;
    setTerminal(why);
    channel.current?.stop();
    setActivities(new Map());
    setPending(null);
    if (why === 'expired') setConnection('expired');
  }, []);
  const expired = useCallback(
    (e?: unknown) => {
      if (terminalRef.current) return true;
      const shared = cached()?.shared;
      if (
        (e instanceof RoomFailure && (e.status === 410 || e.code === 'expired')) ||
        shared?.phase === 'expired' ||
        (shared && shared.expiresAt <= Date.now())
      ) {
        end('expired');
        return true;
      }
      return false;
    },
    [cached, end]
  );
  const authority = useCallback(
    (e: unknown) => {
      if (expired(e)) return;
      if (e instanceof RoomFailure && ['unauthorized', 'forbidden', 'not_found'].includes(e.code))
        end('access');
    },
    [end, expired]
  );
  const apply = useCallback(
    (incoming: RoomSnapshot) => {
      if (expired()) return;
      if (incoming.shared.phase === 'expired' || incoming.shared.expiresAt <= Date.now()) {
        end('expired');
        return;
      }
      queryClient.setQueryData<CachedRoom>(continuousKey(roomId), (old) =>
        mergeRoom(old, incoming)
      );
    },
    [roomId, expired, end]
  );
  const refetch = useCallback(async () => {
    if (!access || expired()) return;
    try {
      const incoming = await api.snapshot(access);
      apply(incoming);
      if (!terminalRef.current) setPrivateError(false);
      return incoming;
    } catch (e) {
      authority(e);
      if (!terminalRef.current) setPrivateError(true);
      throw e;
    }
  }, [access, expired, apply, authority]);
  const room = useQuery<CachedRoom>({
    queryKey: continuousKey(roomId),
    enabled: Boolean(access) && !terminal,
    queryFn: async () => {
      try {
        if (expired()) throw new RoomFailure('expired', 'This room has expired.');
        const value = await api.snapshot(access!);
        apply(value);
        if (terminalRef.current)
          throw new RoomFailure(
            terminalRef.current === 'expired' ? 'expired' : 'unauthorized',
            'Room access ended.'
          );
        setPrivateError(false);
        return mergeRoom(cached(), value);
      } catch (e) {
        authority(e);
        throw e;
      }
    },
  });
  useEffect(() => {
    let active = true;
    void Promise.all([loadAccess(roomId), readPending(roomId)])
      .then(([stored, envelope]) => {
        if (!active) return;
        if (
          envelope &&
          typeof envelope.commandId === 'string' &&
          Number.isInteger(envelope.sequence) &&
          envelope.command?.type
        ) {
          queue.current.pending = envelope;
          setPending(envelope);
        }
        setAccess(
          stored ?? (nativeClient ? null : { roomId, participantId: '', token: '', expiresAt: 0 })
        );
      })
      .catch(() => {
        if (active) {
          setAccess(null);
          setError('Your room could not be restored. Reopen the invitation.');
        }
      });
    return () => {
      active = false;
    };
  }, [roomId]);
  useEffect(() => {
    if (!access || !room.data || access.participantId === room.data.own.participantId) return;
    const updated = {
      ...access,
      participantId: room.data.own.participantId,
      expiresAt: room.data.shared.expiresAt,
    };
    void saveAccess(updated)
      .then(() => {
        if (!terminalRef.current) setAccess(updated);
      })
      .catch(() => setError('Room storage is unavailable. Keep this tab open.'));
  }, [access, room.data]);
  useEffect(() => {
    if (!access || terminalRef.current) return;
    const realtime = new ContinuousRealtime({
      roomId,
      ticket: () => api.ticket(access),
      socket: (path) => new WebSocket(continuousRealtimeUrl(path)),
      revision: () => cached()?.shared.revision ?? null,
      expiresAt: () => cached()?.shared.expiresAt ?? null,
      snapshot: (shared) => {
        if (shared.phase === 'expired') {
          end('expired');
          return;
        }
        if (!expired())
          queryClient.setQueryData<CachedRoom>(continuousKey(roomId), (old) =>
            mergePublic(old, shared)
          );
      },
      privateRead: refetch,
      authorityError: authority,
      serverClock: (offset) => {
        clock.current = offset;
      },
      status: (state) => {
        if (state === 'expired') end('expired');
        else if (!terminalRef.current) setConnection(state);
      },
      clearActivity: () => setActivities(new Map()),
      activity: (frame) => {
        if (
          frame.inspection?.kind === 'poster' &&
          !cached()?.shared.matches.some(
            (m) =>
              m.candidateId ===
              (frame.inspection?.kind === 'poster' ? frame.inspection.candidateId : null)
          )
        )
          return;
        setActivities((old) =>
          applyActivity(old, frame, cached()?.own.participantId ?? '', Date.now() + clock.current)
        );
      },
    });
    channel.current = realtime;
    if (AppState.currentState === 'active') realtime.start();
    else realtime.pause();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !expired()) {
        void refetch().catch(() => undefined);
        realtime.start();
      } else realtime.pause();
    });
    return () => {
      sub.remove();
      realtime.stop();
      channel.current = null;
    };
  }, [access, roomId, cached, end, expired, refetch, authority]);
  useEffect(() => {
    if (!activities.size) return;
    const next = Math.min(
      ...[...activities.values()].flatMap((a) => [
        a.frame.expiresAt,
        ...(a.pulse ? [a.pulse.serverTime + 1500] : []),
      ])
    );
    const timer = setTimeout(
      () => setActivities((old) => pruneActivity(old, Date.now() + clock.current)),
      Math.max(1, next - Date.now() - clock.current)
    );
    return () => clearTimeout(timer);
  }, [activities]);
  useEffect(() => {
    const deadline = room.data?.shared.expiresAt;
    if (!deadline || terminal) return;
    const timer = setTimeout(() => expired(), Math.max(1, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [room.data?.shared.expiresAt, terminal, expired]);
  async function send(command?: RoomCommand) {
    const snapshot = cached();
    if (!access || !snapshot || expired() || privateError || queue.current.busy) return false;
    setBusy(true);
    setError('');
    try {
      const value = await queue.current.send(command, snapshot, (body) =>
        api.command(access, body)
      );
      apply(value);
      return !terminalRef.current;
    } catch (e) {
      if (e instanceof RoomFailure && e.snapshot) apply(e.snapshot);
      if (e instanceof RoomFailure && e.code === 'unauthorized') authority(e);
      else expired(e);
      if (!terminalRef.current)
        setError(
          e instanceof RoomFailure
            ? publicFailureMessage(e.code, e.message, e.details)
            : e instanceof Error
              ? e.message
              : 'Your action could not be confirmed.'
        );
      if (!queue.current.pending) void refetch().catch(() => undefined);
      return false;
    } finally {
      setBusy(false);
      setPending(terminalRef.current ? null : queue.current.pending);
    }
  }
  return {
    room,
    access,
    connection,
    error,
    busy,
    privateError,
    terminal,
    pending,
    send,
    refetch,
    reconnect: () => {
      if (!expired()) channel.current?.start();
    },
    activities,
    activityNow: () => Date.now() + clock.current,
    setView: (view: ActivityView) => channel.current?.setView(view),
    inspect: (inspection: MatchInspection) =>
      channel.current?.sendActivity('matches', undefined, undefined, inspection),
    activity: (gesture?: ActivityGesture, beat?: 'answer') =>
      channel.current?.sendActivity(undefined, gesture, beat),
  };
}
