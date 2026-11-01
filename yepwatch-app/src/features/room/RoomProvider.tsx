/**
 * One live room for every room screen (the room page and its sub-pages are routes under
 * /room/<id>; they share this one connection). Owns the room's side effects: registry, member
 * sign-in, protocol entry, background refill, and this device's "Keep swiping" choice.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { ActivityView } from '@goodwatch/yepwatch-contracts/proposal';
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
import { useLobbyEntry } from '../glow/useLobbyEntry';
import { roomCommands, roomView, type RoomCommands, type RoomView } from './model';

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
  const refilled = useRef(new Set<string>());
  const latest = useCallback(() => queryClient.getQueryData<CachedRoom>(continuousKey(id)), [id]);
  const send = state.send;
  const cmd = useMemo(() => roomCommands(send, latest), [send, latest]);
  const view = useMemo(() => (snapshot ? roomView(snapshot) : null), [snapshot]);
  const disabled = state.busy || Boolean(state.pending) || state.privateError || entry.working;

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
  const countryAsked = useRef(new Set<number>());
  const needsCountry = Boolean(view && view.isHost && !view.country && view.phase === 'setup');
  const contextVersion = snapshot?.shared.contextVersion;
  const prefillCountry = snapshot?.own.member.prefill?.country;
  useEffect(() => {
    if (!needsCountry || contextVersion === undefined || state.busy || state.pending || countryAsked.current.has(contextVersion)) return;
    countryAsked.current.add(contextVersion);
    void cmd.configure({ country: prefillCountry ?? deviceCountryHint() ?? 'US' });
  }, [needsCountry, contextVersion, prefillCountry, state.busy, state.pending, cmd]);
  // The deck never ends: refill in the background before anyone runs out.
  useEffect(() => {
    if (!snapshot || snapshot.shared.phase !== 'choosing' || state.busy || entry.required || state.pending || state.privateError || state.terminal) return;
    const unanswered = snapshot.shared.candidates.filter((c) => !snapshot.own.votes.some((v) => v.candidateId === c.id && v.value !== null)).length;
    const key = `${snapshot.shared.generation}:${snapshot.shared.stream.version}`;
    if (unanswered <= 2 && snapshot.shared.stream.state === 'ready' && !refilled.current.has(key)) {
      refilled.current.add(key);
      void cmd.refill();
    }
  }, [snapshot, state.busy, state.pending, state.privateError, state.terminal, entry.required, cmd]);
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
    dismissedProposal, dismissProposal, reopenProposal, setActivityView: state.setView,
  };
  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}
