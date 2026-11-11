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
import { transientFailure } from './backoff';
import { ContinuousRealtime } from './realtime';
import { applyActivity, pruneActivity, type PeerActivity } from './activity';
import { applyCheerFrame, emptyCheers, freshCheerEvents, holderSeeds, nextCheerExpiry, pruneCheers, type CheerEvent, type CheerState } from './cheers';
import { sessionCommandStorage } from './command-storage';
import { useAccount } from './account';
import { adoptAccountRoom } from './account-access';
import { authEpoch } from './account-flow';
import { ACTIVITY_LIMITS } from '@goodwatch/yepwatch-contracts/proposal';
import { continuousKey } from './keys';
import { browserEvents, browserOffline } from './network';
export { continuousKey } from './keys';
/** Your rooms keeps one query per room; room snapshots update it directly. */
export const homeRoomKey = (roomId: string) => ['home-room', roomId] as const;
const EMPTY_HOLDERS: ReadonlyMap<string, number> = new Map();
/** A command waiting its turn: shown at once, sent in order, settled with the server's answer. */
interface OutboxEntry extends QueuedCommand { foreground: boolean; settle: (ok: boolean) => void }
/** Commands still unsent when their room's screen went away and a stuck command held them back. The next visit takes them. */
const parked = new Map<string, OutboxEntry[]>();
authEpoch.subscribe(() => { for (const entries of parked.values()) entries.forEach(e => e.settle(false)); parked.clear(); });
/** Automatic retries of one saved command once the connection is back. */
const AUTO_RETRIES = 3;
export function useContinuousRoom(roomId: string) {
  const account = useAccount();
  const [access, setAccess] = useState<RoomAccess | null>();
  const [connection, setConnection] = useState<Connection>('connecting');
  const [error, setError] = useState('');
  /** The last command failure's code, for screens that answer it in place (needs_context, limit_reached). */
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const clearError = useCallback(() => { setError(''); setErrorCode(null); }, []);
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
  const [commandStorage] = useState(() => sessionCommandStorage(roomId, writePending));
  const startedEpoch = useRef(authEpoch.current());
  const queue = useRef(
    new PersistentCommands(() => Crypto.randomUUID(), commandStorage)
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
      // Log out doesn't end access: the server keeps this device's place as a guest, same credential.
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
  /** A Leave is on its way: the refusals it causes (the live channel, a read) are its own outcome, not lost access. */
  const leavingNow = useRef(false);
  /** The command id the server last refused as a conflict (see submit and drain). */
  const conflicted = useRef<string | null>(null);
  const authority = useCallback(
    (e: unknown) => {
      if (expired(e) || leavingNow.current) return;
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
  const adoptAccess = useCallback((next: RoomAccess) => {
    channel.current?.stop();
    queue.current.pending = null;
    outbox.current.forEach(entry => entry.settle(false));
    outbox.current = [];
    setQueued([]);
    setPending(null);
    commandStorage.useSession(next.sessionKey);
    setAccess(next);
    terminalRef.current = null;
    setTerminal(null);
  }, [commandStorage]);
  const refetch = useCallback(async () => {
    if (!access || expired()) return;
    try {
      const incoming = await api.snapshot(access);
      apply(incoming);
      if (!terminalRef.current) setPrivateError(false);
      return incoming;
    } catch (e) {
      authority(e);
      // No answer or a restarting server is an outage, not a stale private state: the connection line covers it.
      if (!terminalRef.current && !transientFailure(e)) setPrivateError(true);
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
    if (!account.ready) return;
    const asked = authEpoch.current();
    const restore = async () => {
      if (account.member && !account.unavailable) {
        try {
          const admission = await api.resume(roomId);
          if (!authEpoch.isCurrent(asked) || !active) return null;
          return await adoptAccountRoom(admission, asked);
        } catch (e) {
          if (!(e instanceof RoomFailure) || e.code !== 'not_found') throw e;
        }
      }
      return loadAccess(roomId);
    };
    void restore().then(async (stored) => {
      commandStorage.useSession(stored?.sessionKey);
      return [stored, await readCommandRecovery(roomId, stored?.sessionKey)] as const;
    })
      .then(([stored, recovery]) => {
        const { envelope, retryAt: until } = recovery;
        if (!active || !authEpoch.isCurrent(asked)) return;
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
  }, [roomId, account.ready, account.member, account.unavailable, commandStorage]);
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
  // One live channel per room credential. Learning this browser's participant ID (the first read of a
  // room opened without saved access) changes `access` but not the credential: the channel stays, so a
  // fresh open doesn't take a second ticket and socket.
  const accessRef = useRef(access);
  const refetchRef = useRef(refetch);
  useEffect(() => { accessRef.current = access; refetchRef.current = refetch; });
  const credential = access ? `${access.roomId}\u0000${access.token}\u0000${access.sessionKey ?? ""}` : null;
  useEffect(() => {
    if (!credential || !accessRef.current || terminalRef.current) return;
    const realtime = new ContinuousRealtime({
      roomId,
      ticket: () => api.ticket(accessRef.current!),
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
      privateRead: () => refetchRef.current(),
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
        void refetchRef.current().catch(() => undefined);
        realtime.start();
      } else realtime.pause();
    });
    return () => {
      sub.remove();
      realtime.stop();
      channel.current = null;
    };
  }, [credential, roomId, cached, end, expired, authority]);
  // Browsers: back online or back in front connects at once (the backoff timer kept growing while offline),
  // and a saved action whose request never got an answer goes again right away.
  const [offline, setOffline] = useState(() => browserOffline());
  useEffect(() => {
    if (!browserEvents()) return;
    const resume = () => {
      setOffline(browserOffline());
      if (browserOffline() || terminalRef.current || expired() || AppState.currentState !== 'active') return;
      channel.current?.resume();
      if (queue.current.pending && queue.current.unanswered) {
        queue.current.retryAt = 0;
        setRetryAt(0);
        void retryRef.current();
      }
    };
    const away = () => setOffline(true);
    window.addEventListener('online', resume);
    window.addEventListener('focus', resume);
    window.addEventListener('offline', away);
    return () => {
      window.removeEventListener('online', resume);
      window.removeEventListener('focus', resume);
      window.removeEventListener('offline', away);
    };
  }, [expired]);
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
    const leaving = (command ?? queue.current.pending?.command)?.type === 'leave';
    leavingNow.current = leaving;
    try {
      const value = await queue.current.send(command, snapshot, (body) =>
        api.command(access, body), commandId
      );
      apply(value);
      // A Leave the server confirmed went through, even when the live channel brought the refusal of
      // the leaver's next read first and access already ended here.
      return leaving || !terminalRef.current;
    } catch (e) {
      // The server reads its answer as the person who just left, and refuses that read: the Leave went
      // through. Access ends here on purpose, so the room never says "access ended" afterwards.
      if (leaving && e instanceof RoomFailure && e.code === 'forbidden') {
        end('access');
        // Your rooms read this room before the Leave: it reads it again and files it under History.
        queryClient.removeQueries({ queryKey: homeRoomKey(roomId) });
        return true;
      }
      if (e instanceof RoomFailure && e.snapshot) apply(e.snapshot);
      // A conflict means this device's view was behind (another device, a friend's change). It says nothing:
      // the outbox builds the command again from the fresh room and sends it once (drain below), or drops
      // it when it no longer applies, and the screen shows the room as it is.
      if (e instanceof RoomFailure && e.code === 'conflict') {
        conflicted.current = commandId ?? null;
        await refetch().catch(() => undefined);
        return false;
      }
      // A refused command (not the host, not the author, an idea that's gone…) is not lost access: show why
      // and re-read the room below. Only missing credentials or an expired room end it from here; a read
      // that fails decides the rest.
      if (expired(e) || (e instanceof RoomFailure && (e.status === 401 || e.code === 'unauthorized'))) authority(e);
      // A saved action (no answer, or the server asked to try later) says nothing: it shows already and goes
      // again by itself; a long outage gets the room's one connection line (connection-words.ts).
      const saved = Boolean(queue.current.pending);
      if (!terminalRef.current && !saved) setErrorCode(e instanceof RoomFailure ? e.code : null);
      if (!terminalRef.current && !saved)
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
      leavingNow.current = false;
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
        let ok = command ? await submitRef.current(command, entry.commandId) : false;
        if (!ok && conflicted.current === entry.commandId && !terminalRef.current) {
          // Rebased once on the room the conflict brought (the same command id: it can only apply once). A
          // conflict about your own choice (another device of yours changed that vote or agreement) builds
          // nothing: the newer choice stays and the room shows it (roomCommands).
          const fresh = cached();
          const again = fresh ? entry.build(fresh) : null;
          ok = again ? await submitRef.current(again, entry.commandId) : false;
        }
        conflicted.current = null;
        take(entry, ok);
      }
    } finally {
      draining.current = false;
      if (!mounted.current && outbox.current.length) {
        if (authEpoch.isCurrent(startedEpoch.current)) parked.set(roomId, outbox.current);
        else outbox.current.forEach(e => e.settle(false));
        outbox.current = [];
      }
    }
  }, [cached, roomId]);
  useEffect(() => {
    mounted.current = true;
    const epoch = startedEpoch.current;
    const waiting = parked.get(roomId);
    if (waiting) {
      parked.delete(roomId);
      outbox.current = [...waiting, ...outbox.current];
      setQueued(outbox.current);
    }
    return () => { mounted.current = false; if (!draining.current && outbox.current.length) { if (authEpoch.isCurrent(epoch)) parked.set(roomId, outbox.current); else outbox.current.forEach(e => e.settle(false)); outbox.current = []; } };
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
  const retryOnline = (connection === 'live' || connection === 'polling') && Boolean(pending) && !busy && retrySeconds === 0;
  const retryRef = useRef(send);
  useEffect(() => { retryRef.current = send; });
  // Bounded: after a few tries the line with Retry stays, so a failing server isn't kept busy by this device.
  const autoRetries = useRef({ commandId: '', tries: 0 });
  useEffect(() => {
    if (!retryOnline || !pending) return;
    if (autoRetries.current.commandId !== pending.commandId) autoRetries.current = { commandId: pending.commandId, tries: 0 };
    if (autoRetries.current.tries++ < AUTO_RETRIES) void retryRef.current();
  }, [retryOnline, pending]);
  // Stable: screens set their view in focus effects, which must not re-run on every room update.
  const setView = useCallback((view: ActivityView) => channel.current?.setView(view), []);
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
    /** `display` as of now (not the last render): taps aim their own-choice guards at it. */
    view: () => {
      const now = cached();
      return now ? overlayRoom(now, queue.current.pending, outbox.current) : undefined;
    },
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
    /** The browser has no network: actions are saved and go when it's back. */
    offline,
    error,
    errorCode,
    clearError,
    busy,
    privateError,
    terminal,
    adoptAccess,
    pending,
    retrySeconds,
    send,
    refetch,
    reconnect: () => {
      if (!expired()) channel.current?.reconnectNow();
    },
    activities,
    activityNow: () => Date.now() + clock.current,
    setView,
    inspect: (inspection: MatchInspection) =>
      channel.current?.sendActivity('matches', undefined, undefined, inspection),
    pointer: (pointer: ActivityPointer | null) => channel.current?.sendPointer(pointer),
    activity: (gesture?: ActivityGesture, beat?: 'answer') =>
      channel.current?.sendActivity(undefined, gesture, beat),
  };
}
