/**
 * One live room for every room screen (the room page and its sub-pages are routes under
 * /room/<id>; they share this one connection). Owns the room's side effects: registry, member
 * sign-in, protocol entry, background refill, and this device's "Keep swiping" choice.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { ActivityView, RoomCommand } from '@goodwatch/yepwatch-contracts/proposal';
import { continuousKey, useContinuousRoom } from '../../core/continuous/useRoom';
import { roomRegistry } from '../../core/continuous/room-registry';
import { loadInvite, type StoredInvite } from '../../core/continuous/invite-store';
import { beginMember } from '../../core/continuous/member';
import { RoomFailure } from '../../core/continuous/api';
import type { CachedRoom } from '../../core/continuous/state';
import { appInviteUrl } from '../../core/invites';
import { guestOnly } from '../../core/config';
import { deviceCountryHint } from '../../core/lobby';
import { queryClient } from '../../core/providers';
import { readSeenIdeas, writeSeenIdeas } from '../../core/continuous/room-local';
import { useLobbyEntry } from '../glow/useLobbyEntry';
import { roomCommands, roomView, type RoomCommands, type RoomView } from './model';
import { RefillGate } from './refill';
import { useSettingsSaves, type SettingsSaves } from './settings-save';

/** Proposals set aside with Keep swiping, per room and per device, for this app session. */
const dismissed = new Map<string, number>();

export interface RoomContextValue {
  id: string;
  state: ReturnType<typeof useContinuousRoom>;
  entry: ReturnType<typeof useLobbyEntry>;
  snapshot: CachedRoom | undefined;
  view: RoomView | null;
  cmd: RoomCommands;
  latest: () => CachedRoom | undefined;
  /** A command is in flight, awaiting confirmation, or the private state needs a refresh. */
  disabled: boolean;
  invite: StoredInvite | null | undefined;
  inviteUrl: string | null;
  signin: () => Promise<void>;
  memberBusy: boolean;
  notice: string;
  setNotice: (text: string) => void;
  dismissedProposal: number | null;
  dismissProposal: (version: number) => void;
  reopenProposal: () => void;
  setActivityView: (view: ActivityView) => void;
  /** Your services and Movies and shows: drafts until the server confirms them. */
  saves: SettingsSaves;
  /** The host has seen these friend ideas (opened the Room page): they're no longer NEW on this device. */
  acknowledgeIdeas: (ids: readonly string[]) => void;
}
const RoomContext = createContext<RoomContextValue | null>(null);
export function useRoom() {
  const value = useContext(RoomContext);
  if (!value) throw new Error('useRoom outside a room');
  return value;
}

export function RoomProvider({ id, children }: { id: string; children: ReactNode }) {
  const state = useContinuousRoom(id);
  const entry = useLobbyEntry(state);
  const invitation = useQuery<StoredInvite | null>({ queryKey: ['continuous-invite', id], queryFn: () => loadInvite(id) });
  const snapshot = state.room.data;
  const [memberBusy, setMemberBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [dismissedProposal, setDismissed] = useState<number | null>(() => dismissed.get(id) ?? null);
  const latest = useCallback(() => queryClient.getQueryData<CachedRoom>(continuousKey(id)), [id]);
  // state.send is a new function every render; commands go through a stable ref so timers and effects keyed on them don't restart.
  const sendRef = useRef(state.send);
  useEffect(() => { sendRef.current = state.send; });
  const [seenIdeas, setSeenIdeas] = useState<ReadonlySet<string>>(() => new Set());
  const seenRef = useRef(seenIdeas);
  useEffect(() => {
    let live = true;
    void readSeenIdeas(id).then((ids) => {
      if (!live || !ids.length) return;
      seenRef.current = new Set([...seenRef.current, ...ids]);
      setSeenIdeas(seenRef.current);
    }).catch(() => undefined);
    return () => { live = false; };
  }, [id]);
  const acknowledgeIdeas = useCallback((ids: readonly string[]) => {
    if (ids.every((i) => seenRef.current.has(i))) return;
    seenRef.current = new Set([...seenRef.current, ...ids]);
    setSeenIdeas(seenRef.current);
    void writeSeenIdeas(id, [...seenRef.current].slice(-64)).catch(() => undefined);
  }, [id]);
  const cmd = useMemo<RoomCommands>(() => {
    // Commands are only sent from handlers and effects, never while rendering.
    // eslint-disable-next-line react-hooks/refs
    const base = roomCommands((command: RoomCommand) => sendRef.current(command), latest);
    // Switching a friend's idea (either way) means the host has dealt with it: never NEW again.
    return { ...base, setIdea: (ideaId: string, on: boolean) => base.setIdea(ideaId, on).then((ok) => { if (ok) acknowledgeIdeas([ideaId]); return ok; }) };
  }, [latest, acknowledgeIdeas]);
  const view = useMemo(() => (snapshot ? roomView(snapshot, seenIdeas) : null), [snapshot, seenIdeas]);
  const disabled = state.busy || Boolean(state.pending) || state.privateError || entry.working;
  const saveFailed = useCallback((key: 'services' | 'kinds') => {
    setNotice(key === 'services' ? 'Couldn’t save your services. Try again.' : 'Couldn’t save movies and shows. Try again.');
  }, []);
  const saves = useSettingsSaves({ cmd, view, latest, blocked: disabled || state.retrySeconds > 0, failed: saveFailed });

  const nickname = view?.me.nickname;
  const expiresAt = snapshot?.shared.expiresAt;
  useEffect(() => {
    if (expiresAt) void roomRegistry.remember({ roomId: id, nickname: nickname ?? '', expiresAt }).catch(() => undefined);
  }, [id, nickname, expiresAt]);
  useEffect(() => { if (snapshot?.own.left) router.replace('/'); }, [snapshot?.own.left]);

  const signin = useCallback(async () => {
    if (guestOnly || !state.access || memberBusy) return;
    setMemberBusy(true);
    try {
      await beginMember(state.access);
      await state.refetch();
    } catch (e) {
      setNotice(e instanceof RoomFailure && e.code === 'not_implemented'
        ? 'GoodWatch sign-in isn’t connected yet.'
        : e instanceof Error ? e.message : 'Sign-in could not start.');
    } finally {
      setMemberBusy(false);
    }
  }, [state, memberBusy]);
  // A new room has no country yet, and services are only valid within one: the host sets it right away
  // (member prefill, else the device's region), before anyone picks services.
  // A command already in flight (room entry) makes the send a no-op: try again once it settles, a few times at most.
  const countryTries = useRef(0);
  const needsCountry = Boolean(view && view.isHost && !view.country && view.phase === 'setup');
  const prefillCountry = snapshot?.own.member.prefill?.country;
  const blocked = state.busy || Boolean(state.pending) || state.privateError || entry.working;
  useEffect(() => {
    if (!needsCountry || blocked || countryTries.current >= 3) return;
    countryTries.current++;
    void cmd.configure({ country: prefillCountry ?? deviceCountryHint() ?? 'US' });
  }, [needsCountry, blocked, prefillCountry, cmd]);
  // The deck never ends: refill in the background before anyone runs out. One refill in flight at a
  // time; a send that doesn't go through is retried a few times; a new stream version or state starts over.
  const refill = useRef(new RefillGate());
  const [refillRetry, setRefillRetry] = useState(0);
  useEffect(() => {
    if (!snapshot || snapshot.shared.phase !== 'choosing' || state.busy || entry.required || state.pending || state.privateError || state.terminal) return;
    const unanswered = snapshot.shared.candidates.filter((c) => !snapshot.own.votes.some((v) => v.candidateId === c.id && v.value !== null)).length;
    if (unanswered > 2 || snapshot.shared.stream.state !== 'ready') return;
    const key = `${snapshot.shared.generation}:${snapshot.shared.stream.version}:${snapshot.shared.stream.state}`;
    const gate = refill.current;
    const go = gate.begin(key, Date.now());
    if (!go.send) {
      if (go.retryInMs === null) return;
      const timer = setTimeout(() => setRefillRetry((n) => n + 1), go.retryInMs);
      return () => clearTimeout(timer);
    }
    void cmd.refill().catch(() => false).then((ok) => {
      gate.settle(key, ok, Date.now());
      if (!ok) setRefillRetry((n) => n + 1);
    });
  }, [snapshot, state.busy, state.pending, state.privateError, state.terminal, entry.required, cmd, refillRetry]);
  // Out of cards and the stream says it's done: keep quietly asking for more ("Finding more…").
  const empty = Boolean(snapshot && snapshot.shared.phase === 'choosing' && snapshot.shared.stream.state !== 'ready' && snapshot.shared.stream.reason !== 'awaiting_answers'
    && !snapshot.shared.candidates.some((c) => !snapshot.own.votes.some((v) => v.candidateId === c.id && v.value !== null)));
  useEffect(() => {
    if (!empty) return;
    const timer = setInterval(() => { void cmd.refill(); }, 15_000);
    return () => clearInterval(timer);
  }, [empty, cmd]);

  const dismissProposal = useCallback((version: number) => { dismissed.set(id, version); setDismissed(version); }, [id]);
  const reopenProposal = useCallback(() => { dismissed.delete(id); setDismissed(null); }, [id]);
  const invite = invitation.data;
  let inviteUrl: string | null = null;
  try { inviteUrl = invite ? appInviteUrl(invite.path) : null; } catch { inviteUrl = null; }
  const value: RoomContextValue = {
    id, state, entry, snapshot, view, cmd, latest, disabled, invite, inviteUrl, signin, memberBusy, notice, setNotice,
    dismissedProposal, dismissProposal, reopenProposal, setActivityView: state.setView, saves, acknowledgeIdeas,
  };
  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}
