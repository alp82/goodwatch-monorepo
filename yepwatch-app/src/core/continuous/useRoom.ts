import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { awaitsServer, overlayRoom, type CommandBuild, type QueuedCommand } from './optimistic';
import { readCommandRecovery, writePending } from './storage';
import { useRetryCountdown } from './useRetryCountdown';
import { ContinuousRealtime, type ReconnectState } from './realtime';
import { applyActivity, pruneActivity, type PeerActivity } from './activity';
import { applyCheerFrame, emptyCheers, freshCheerEvents, holderSeeds, nextCheerExpiry, pruneCheers, type CheerEvent, type CheerState } from './cheers';
import { ACTIVITY_LIMITS } from '@goodwatch/yepwatch-contracts/proposal';
export const continuousKey = (id: string) => ['proposal-room', id] as const;
/** Your rooms keeps one query per room; room snapshots update it directly. */
export const homeRoomKey = (roomId: string) => ['home-room', roomId] as const;
const EMPTY_HOLDERS: ReadonlyMap<string, number> = new Map();
/** A command waiting its turn: shown at once, sent in order, settled with the server's answer. */
interface OutboxEntry extends QueuedCommand { foreground: boolean; settle: (ok: boolean) => void }
/** Commands still unsent when their room's screen went away and a stuck command held them back. The next visit takes them. */
const parked = new Map<string, OutboxEntry[]>();
/** Automatic retries of one saved command once the connection is back. */
const AUTO_RETRIES = 3;
export function useContinuousRoom(roomId: string) {
  const [access, setAccess] = useState<RoomAccess | null>();
  const [connection, setConnection] = useState<Connection>('connecting');
  const [reconnect, setReconnect] = useState<ReconnectState>({ attempting: false, retryAt: 0 });
  const reconnectSeconds = useRetryCountdown(reconnect.retryAt);
  const [error, setError] = useState('');
  /** The last command failure's code, for screens that answer it in place (needs_context, limit_reached). */
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [privateError, setPrivateError] = useState(false);
  const [terminal, setTerminal] = useState<'expired' | 'access' | null>(null);
  const terminalRef = useRef<typeof terminal>(null);
  const [pending, setPending] = useState<CommandEnvelope | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const outbox = useRef<OutboxEntry[]>([]);
  const draining = useRef(false);
  const mounted = useRef(false);
  const [queued, setQueued] = useState<OutboxEntry[]>([]);
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
      // A status without the API's own answer (a proxy page while the server restarts) is not lost access.
      if (e instanceof RoomFailure && ((e.code !== 'outcome_unknown' && [401, 403, 404].includes(e.status ?? 0)) || ['unauthorized', 'forbidden', 'not_found'].includes(e.code)))
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
      attempt: setReconnect,
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
  async function submit(command?: RoomCommand, commandId?: string) {
    const snapshot = cached();
    if (!access || !snapshot || expired() || privateError || queue.current.busy || Date.now() < queue.current.retryAt) return false;
    setBusy(true);
    setError('');
    setErrorCode(null);
    try {
      const value = await queue.current.send(command, snapshot, (body) =>
        api.command(access, body), commandId
      );
      apply(value);
      return !terminalRef.current;
    } catch (e) {
      if (e instanceof RoomFailure && e.snapshot) apply(e.snapshot);
      // A refused command (not the host, not the author, an idea that's gone…) is not lost access: show why
      // and re-read the room below. Only missing credentials or an expired room end it from here; a read
      // that fails decides the rest.
      if (expired(e) || (e instanceof RoomFailure && (e.status === 401 || e.code === 'unauthorized'))) authority(e);
      if (!terminalRef.current) setErrorCode(e instanceof RoomFailure ? e.code : null);
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
  // The newest submit reads the newest access and state; a drain outlives the render (and the screen) it began in.
  const submitRef = useRef(submit);
  useEffect(() => { submitRef.current = submit; });
  /** One command at a time, in the order they were made: the server refuses sequences out of order. */
  const drain = useCallback(async () => {
    if (draining.current) return;
    draining.current = true;
    const take = (entry: OutboxEntry, ok: boolean) => {
      outbox.current = outbox.current.filter((e) => e !== entry);
      setQueued(outbox.current);
      entry.settle(ok);
    };
    try {
      while (outbox.current.length && (!queue.current.pending || terminalRef.current)) {
        const entry = outbox.current[0];
        const snapshot = terminalRef.current ? undefined : cached();
        const command = snapshot ? entry.build(snapshot) : null;
        take(entry, command ? await submitRef.current(command, entry.commandId) : false);
      }
    } finally {
      draining.current = false;
      if (!mounted.current && outbox.current.length) { parked.set(roomId, outbox.current); outbox.current = []; }
    }
  }, [cached, roomId]);
  useEffect(() => {
    mounted.current = true;
    const waiting = parked.get(roomId);
    if (waiting) {
      parked.delete(roomId);
      outbox.current = [...waiting, ...outbox.current];
      setQueued(outbox.current);
    }
    return () => { mounted.current = false; if (!draining.current && outbox.current.length) { parked.set(roomId, outbox.current); outbox.current = []; } };
  }, [roomId]);
  // A command stuck awaiting confirmation holds the rest back; they go when it clears or the room ends.
  useEffect(() => {
    if (terminal || !pending) void drain();
  }, [pending, terminal, drain]);
  /** With a command: shown at once and queued. Without: retries the command awaiting confirmation. */
  function send(input?: RoomCommand | CommandBuild): Promise<boolean> {
    if (!input) return submit();
    const snapshot = cached();
    if (!access || !snapshot || expired() || privateError) return Promise.resolve(false);
    const build: CommandBuild = typeof input === 'function' ? input : () => input;
    const command = build(snapshot);
    if (!command) return Promise.resolve(false);
    return new Promise<boolean>((settle) => {
      outbox.current = [...outbox.current, { commandId: Crypto.randomUUID(), build, foreground: awaitsServer(command), settle }];
      setQueued(outbox.current);
      void drain();
    });
  }
  // Back online: the saved command goes again by itself (same id, so it can only apply once).
  const retryOnline = connection === 'live' && Boolean(pending) && !busy && retrySeconds === 0;
  const retryRef = useRef(send);
  useEffect(() => { retryRef.current = send; });
  // Bounded: after a few tries the line with Retry stays, so a failing server isn't kept busy by this device.
  const autoRetries = useRef({ commandId: '', tries: 0 });
  useEffect(() => {
    if (!retryOnline || !pending) return;
    if (autoRetries.current.commandId !== pending.commandId) autoRetries.current = { commandId: pending.commandId, tries: 0 };
    if (autoRetries.current.tries++ < AUTO_RETRIES) void retryRef.current();
  }, [retryOnline, pending]);
  // Read straight from the cache: a settled command leaves the queue in the same render its result shows.
  const confirmed = cached() ?? room.data;
  const display = useMemo(() => (confirmed ? overlayRoom(confirmed, pending, queued) : undefined), [confirmed, pending, queued]);
  const decided = room.data?.shared.phase === 'decided' ? room.data.shared.generation : null;
  return {
    room,
    /** The room as the server last confirmed it: version guards and retries read this. */
    confirmed,
    /** The room with this device's unconfirmed commands applied: screens read this. */
    display,
    /** A command the server has to decide (Start, Propose, Leave…) is on its way. */
    working: queued.some((e) => e.foreground),
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
    /** An automatic or Refresh reconnect is running right now. */
    reconnecting: reconnect.attempting,
    /** Seconds until the next automatic reconnect; 0 when none is waiting. */
    reconnectSeconds,
    error,
    errorCode,
    clearError: () => { setError(''); setErrorCode(null); },
    busy,
    privateError,
    terminal,
    pending,
    retrySeconds,
    send,
    refetch,
    reconnect: () => {
      if (!expired()) channel.current?.reconnectNow();
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
