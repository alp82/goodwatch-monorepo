import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import type {
  ActivityGesture,
  ActivityPointer,
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
import { readCommandRecovery, writePending } from './storage';
import { useRetryCountdown } from './useRetryCountdown';
import { ContinuousRealtime } from './realtime';
import { applyActivity, pruneActivity, type PeerActivity } from './activity';
import { applyCheerFrame, emptyCheers, freshCheerEvents, holderSeeds, nextCheerExpiry, pruneCheers, type CheerEvent, type CheerState } from './cheers';
import { ACTIVITY_LIMITS } from '@goodwatch/yepwatch-contracts/proposal';
export const continuousKey = (id: string) => ['proposal-room', id] as const;
/** Your rooms keeps one query per room; room snapshots update it directly. */
export const homeRoomKey = (roomId: string) => ['home-room', roomId] as const;
const EMPTY_HOLDERS: ReadonlyMap<string, number> = new Map();
export function useContinuousRoom(roomId: string) {
  const [access, setAccess] = useState<RoomAccess | null>();
  const [connection, setConnection] = useState<Connection>('connecting');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [privateError, setPrivateError] = useState(false);
  const [terminal, setTerminal] = useState<'expired' | 'access' | null>(null);
  const terminalRef = useRef<typeof terminal>(null);
  const [pending, setPending] = useState<CommandEnvelope | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const retrySeconds = useRetryCountdown(retryAt);
  const [activities, setActivities] = useState(new Map<string, PeerActivity>());
  const clock = useRef(0);
  // Decision cheers: peer state lives in a ref (pure folds), holders/events are published as state.
  const cheerState = useRef<CheerState>(emptyCheers());
  const [cheerVersion, setCheerVersion] = useState(0);
  const [cheerHolders, setCheerHolders] = useState<{ generation: number; ids: Map<string, number> }>({ generation: -1, ids: new Map() });
  const [cheerEvents, setCheerEvents] = useState<CheerEvent[]>([]);
  const ownHoldSeed = useRef<number | null>(null);
  const ownCheerSeq = useRef(0);
  const channel = useRef<ContinuousRealtime | null>(null);
  const queue = useRef(
    new PersistentCommands(() => Crypto.randomUUID(), { write: (e, until) => writePending(roomId, e, until) })
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
      if (e instanceof RoomFailure && ([401, 403, 404].includes(e.status ?? 0) || ['unauthorized', 'forbidden', 'not_found'].includes(e.code)))
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
      // Your rooms reads the same authoritative state: Back after Done or Start again is never stale.
      const merged = queryClient.getQueryData<CachedRoom>(continuousKey(roomId));
      if (merged) queryClient.setQueryData(homeRoomKey(roomId), merged);
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
    void Promise.all([loadAccess(roomId), readCommandRecovery(roomId)])
      .then(([stored, recovery]) => {
        const { envelope, retryAt: until } = recovery;
        if (!active) return;
        if (
          envelope &&
          typeof envelope.commandId === 'string' &&
          Number.isInteger(envelope.sequence) &&
          envelope.command?.type
        ) {
          queue.current.pending = envelope;
          queue.current.retryAt = until;
          setRetryAt(until);
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
      clearActivity: () => {
        setActivities(new Map());
        cheerState.current = emptyCheers();
        setCheerHolders({ generation: -1, ids: new Map() });
        setCheerEvents((old) => old.filter((e) => e.self));
        setCheerVersion((v) => v + 1);
      },
      activity: (frame) => {
        if (frame.cheer) {
          // Only the confirmed decision of the current generation can be cheered.
          const shared = cached()?.shared;
          if (!shared || shared.phase !== 'decided' || frame.cheer.generation !== shared.generation) return;
          const now = Date.now() + clock.current;
          const result = applyCheerFrame(cheerState.current, frame, now, cached()?.own.participantId ?? '');
          cheerState.current = result.state;
          setCheerHolders({ generation: shared.generation, ids: holderSeeds(result.state, now, shared.generation) });
          setCheerVersion((v) => v + 1);
          if (result.event) {
            const event = result.event;
            setCheerEvents((old) => [...old, event].slice(-24));
          }
        }
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
  // One-shot expiry: a holder whose renewals stop disappears within the pulse TTL; no tick while nobody holds.
  useEffect(() => {
    const now = Date.now() + clock.current;
    const next = nextCheerExpiry(cheerState.current, now);
    if (next === null) return;
    const timer = setTimeout(() => {
      const at = Date.now() + clock.current;
      cheerState.current = pruneCheers(cheerState.current, at);
      setCheerHolders((old) => ({ generation: old.generation, ids: holderSeeds(cheerState.current, at, old.generation) }));
      setCheerVersion((v) => v + 1);
    }, Math.max(1, next - now));
    return () => clearTimeout(timer);
  }, [cheerVersion]);
  // Bursts expire with the pulse TTL (one timer per change, none while empty).
  useEffect(() => {
    if (!cheerEvents.length) return;
    const now = Date.now() + clock.current;
    const next = Math.min(...cheerEvents.map((e) => e.at)) + ACTIVITY_LIMITS.pulseTtlMs;
    const timer = setTimeout(() => setCheerEvents((old) => freshCheerEvents(old, Date.now() + clock.current)), Math.max(1, next - now));
    return () => clearTimeout(timer);
  }, [cheerEvents]);
  useEffect(() => {
    const deadline = room.data?.shared.expiresAt;
    if (!deadline || terminal) return;
    const timer = setTimeout(() => expired(), Math.max(1, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [room.data?.shared.expiresAt, terminal, expired]);
  async function send(command?: RoomCommand) {
    const snapshot = cached();
    if (!access || !snapshot || expired() || privateError || queue.current.busy || Date.now() < queue.current.retryAt) return false;
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
      authority(e);
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
      setRetryAt(terminalRef.current ? 0 : queue.current.retryAt);
      setPending(terminalRef.current ? null : queue.current.pending);
    }
  }
  const decided = room.data?.shared.phase === 'decided' ? room.data.shared.generation : null;
  return {
    room,
    access,
    /** Peer participants (distinct, not sessions) currently holding for the shown decision, with their episode seed. */
    cheerHolders: decided !== null && cheerHolders.generation === decided ? cheerHolders.ids : EMPTY_HOLDERS,
    /** Bursts to render (taps and first holds), own ones included with self:true; current decision only. */
    cheerEvents: decided === null ? [] : cheerEvents.filter((e) => e.generation === decided),
    /** Sends one cheer frame for the confirmed decision; local feedback is immediate even if offline. */
    cheer: (kind: 'tap' | 'hold' | 'release', seed: number) => {
      const snapshot = cached();
      if (!snapshot || snapshot.shared.phase !== 'decided') return;
      const generation = snapshot.shared.generation;
      channel.current?.sendCheer({ kind, generation, seed });
      const first = kind === 'tap' || (kind === 'hold' && ownHoldSeed.current !== seed);
      if (kind === 'hold') ownHoldSeed.current = seed;
      if (kind === 'release') ownHoldSeed.current = null;
      if (first) {
        const event: CheerEvent = { id: `self:${++ownCheerSeq.current}`, participantId: snapshot.own.participantId, kind, seed, generation, at: Date.now() + clock.current, self: true };
        setCheerEvents((old) => [...old, event].slice(-24));
      }
    },
    connection,
    error,
    busy,
    privateError,
    terminal,
    pending,
    retrySeconds,
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
    pointer: (pointer: ActivityPointer | null) => channel.current?.sendPointer(pointer),
    activity: (gesture?: ActivityGesture, beat?: 'answer') =>
      channel.current?.sendActivity(undefined, gesture, beat),
  };
}
