/**
 * One live room for every room screen (the room, Mood and Matches are routes under /room/<id>; they
 * share this one connection). Owns the room's side effects: registry, GoodWatch link, protocol
 * entry, background refill, this device's "Keep swiping" choice, and the room's open sheets.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigation } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { ActivityView } from '@goodwatch/yepwatch-contracts/proposal';
import { continuousKey, useContinuousRoom } from '../../core/continuous/useRoom';
import { roomRegistry } from '../../core/continuous/room-registry';
import { loadInvite, type StoredInvite } from '../../core/continuous/invite-store';
import { accountKey, linkRoom, useAccount } from '../../core/continuous/account';
import { returnPath } from '../../core/continuous/member-state';
import { memberTransition } from '../../core/continuous/member-transition';
import { RoomFailure } from '../../core/continuous/api';
import type { CachedRoom } from '../../core/continuous/state';
import { appInviteUrl } from '../../core/invites';
import { guestOnly } from '../../core/config';
import { useConnectionWords } from '../../core/continuous/connection-words';
import { deviceCountryHint } from '../../core/lobby';
import { queryClient } from '../../core/providers';
import { readSeenIdeas, writeSeenIdeas } from '../../core/continuous/room-local';
import { useLobbyEntry } from '../glow/useLobbyEntry';
import { NO_ARRIVALS, trackArrivals } from '../shell/live-beat';
import { leaveScreen } from '../shell/sheet-back';
import { roomCommands, roomView, type RoomCommands, type RoomView } from './model';
import { exitRoom } from './nav';
import { RefillGate } from './refill';
import { RoomLinkGate, linkOutcome } from './link-gate';
import { previewDrafts, useSettingsSaves, type SettingsSaves } from './settings-save';
import { BootPageReady } from '../home/boot-phase';

const COUNTRY_TRIES = 5;
const COUNTRY_RETRY_MS = 1200;

/** Opening a room connects within a moment; only a connection that stays away is worth a line. */

/** The room's sheets: Room (its menu), Your services, Streaming, Movies and shows, People. */
export const ROOM_SHEETS = ['room', 'services', 'streaming', 'kinds', 'people'] as const;
export type RoomSheet = (typeof ROOM_SHEETS)[number];
export const isRoomSheet = (value: unknown): value is RoomSheet => typeof value === 'string' && (ROOM_SHEETS as readonly string[]).includes(value);

/** Proposals set aside with Keep swiping, per room and per device, for this app session. */
const dismissed = new Map<string, number>();
/** Each opening of a room on this device: its own live-dot beat. */
let openings = 0;

export interface RoomContextValue {
  id: string;
  state: ReturnType<typeof useContinuousRoom>;
  entry: ReturnType<typeof useLobbyEntry>;
  /** The room with this device's unconfirmed changes in it. */
  snapshot: CachedRoom | undefined;
  view: RoomView | null;
  cmd: RoomCommands;
  latest: () => CachedRoom | undefined;
  /** Only what really stops input: the server is deciding, a command awaits confirmation, or the private state needs a refresh. */
  disabled: boolean;
  invite: StoredInvite | null | undefined;
  inviteUrl: string | null;
  signin: () => Promise<void>;
  memberBusy: boolean;
  /** This device was signed in and the session ran out: GoodWatch prompts read Reconnect GoodWatch. */
  memberLapsed: boolean;
  /** Linking your place here to this device's GoodWatch sign-in failed: the room offers a quiet Retry. */
  linkFailed: boolean;
  retryLink: () => void;
  /** The live connection has been missing long enough to mention. */
  /** The connection line ('' for none): see core/continuous/connection-words.ts. */
  connectionWords: string;
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
  /** This device is leaving the room (the Leave was sent and not refused). */
  leaving: boolean;
  /** The sheet on top (the focused room screen shows it), or null. */
  sheet: RoomSheet | null;
  /** Opens a sheet over the current one; closing it returns to the one underneath. */
  openSheet: (sheet: RoomSheet) => void;
  closeSheet: () => void;
  closeSheets: () => void;
  /** Draws a sheet (injected by the room layout, so the screens' frame doesn't import the sheets). */
  renderSheet: (sheet: RoomSheet) => ReactNode;
  /** Opens another room in front of this one (Your rooms). */
  openRoom: (roomId: string) => void;
  /** The header's live dot rings when this changes: the room opening here, then each join. */
  liveBeat: string;
}
const RoomContext = createContext<RoomContextValue | null>(null);
/** The room when the screen is inside one (the shared frame derives its header from it), else null. */
export function useOptionalRoom() {
  return useContext(RoomContext);
}
export function useRoom() {
  const value = useContext(RoomContext);
  if (!value) throw new Error('useRoom outside a room');
  return value;
}

export function RoomProvider(props: { id: string; children: ReactNode; renderSheet: (sheet: RoomSheet) => ReactNode }) {
  const account = useAccount();
  // A new sign-in starts the room afresh. Log out doesn't: this device keeps its place as a guest, so the
  // room, its open sheet and its connection stay as they are.
  const [signedIn, setSignedIn] = useState(account.generation);
  if (account.member && signedIn !== account.generation) setSignedIn(account.generation);
  return <RoomProviderContent key={signedIn} {...props} />;
}

function RoomProviderContent({ id, children, renderSheet }: { id: string; children: ReactNode; renderSheet: (sheet: RoomSheet) => ReactNode }) {
  const state = useContinuousRoom(id);
  const entry = useLobbyEntry(state);
  // Another room goes on the app's stack as a room of its own. The router would resolve /room/<other>
  // inside this room's stack (same layout), leaving this room's provider, and so this room, on screen.
  // A room already on the stack (A → B → A) is gone back to instead: one provider per room, so one
  // live connection, one refill and one command queue for its session.
  const navigation = useNavigation();
  const openRoom = useCallback((roomId: string) => {
    if (roomId === id) return;
    const below = (stack: ReturnType<typeof navigation.getState>) =>
      stack ? stack.routes.findLastIndex((r) => r.name === 'room/[id]' && (r.params as { id?: string } | undefined)?.id === roomId) : -1;
    if (below(navigation.getState()) < 0) {
      navigation.dispatch({ type: 'PUSH', payload: { name: 'room/[id]', params: { id: roomId, screen: 'index', params: { id: roomId } } } });
      return;
    }
    // Going back is shaped like a Back, which an open sheet would take for itself: the sheets close first.
    leaveScreen(() => {
      const stack = navigation.getState();
      const at = below(stack);
      if (stack && at >= 0) navigation.dispatch({ type: 'POP', payload: { count: stack.routes.length - 1 - at }, target: stack.key });
    });
  }, [navigation, id]);
  const invitation = useQuery<StoredInvite | null>({ queryKey: ['continuous-invite', id], queryFn: () => loadInvite(id) });
  const confirmed = state.confirmed;
  const account = useAccount();
  const [notice, setNotice] = useState('');
  /** This device asked to leave: the room keeps its screen until it's gone, it never says "access ended" first. */
  const [leaving, setLeaving] = useState(false);
  const [sheets, setSheets] = useState<readonly RoomSheet[]>([]);
  const openSheet = useCallback((sheet: RoomSheet) => setSheets((list) => (list.at(-1) === sheet ? list : [...list.filter((s) => s !== sheet), sheet])), []);
  const closeSheet = useCallback(() => setSheets((list) => list.slice(0, -1)), []);
  const closeSheets = useCallback(() => setSheets((list) => (list.length ? [] : list)), []);
  const [dismissedProposal, setDismissed] = useState<number | null>(() => dismissed.get(id) ?? null);
  const latest = useCallback(() => queryClient.getQueryData<CachedRoom>(continuousKey(id)), [id]);
  // state.send is a new function every render; commands go through a stable ref so timers and effects keyed on them don't restart.
  const sendRef = useRef(state.send);
  const viewRef = useRef(state.view);
  useEffect(() => { sendRef.current = state.send; viewRef.current = state.view; });
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
    const base = roomCommands((command) => sendRef.current(command), latest, () => viewRef.current());
    // Switching a friend's idea (either way) means the host has dealt with it: never NEW again.
    return {
      ...base,
      setIdea: (ideaId: string, on: boolean) => base.setIdea(ideaId, on).then((ok) => { if (ok) acknowledgeIdeas([ideaId]); return ok; }),
      leave: () => { setLeaving(true); return base.leave().then((ok) => { if (!ok) setLeaving(false); return ok; }); },
    };
  }, [latest, acknowledgeIdeas]);
  const confirmedView = useMemo(() => (confirmed ? roomView(confirmed) : null), [confirmed]);
  const disabled = state.working || Boolean(state.pending) || state.privateError || entry.working;
  const saveFailed = useCallback((key: 'services' | 'kinds') => {
    setNotice(key === 'services' ? 'Couldn’t save your services. Try again.' : 'Couldn’t save movies and shows. Try again.');
  }, []);
  const saves = useSettingsSaves({ cmd, view: confirmedView, latest, blocked: disabled || state.retrySeconds > 0, failed: saveFailed });
  const display = state.display;
  const snapshot = useMemo(() => (display ? previewDrafts(display, saves.saving) : undefined), [display, saves.saving]);
  const view = useMemo(() => (snapshot ? roomView(snapshot, seenIdeas, state.proposing) : null), [snapshot, seenIdeas, state.proposing]);

  // One rule for every connection word (core/continuous/connection-words.ts): nothing for a short outage,
  // then one small line. A hidden page reads as background, so a quick return shows nothing.
  const connectionWords = useConnectionWords({ offline: state.offline, connection: state.connection, pending: Boolean(state.pending) });
  const nickname = view?.me.nickname;
  const expiresAt = snapshot?.shared.expiresAt;
  useEffect(() => {
    if (expiresAt && !account.member && !account.lapsed) void roomRegistry.remember({ roomId: id, nickname: nickname ?? '', expiresAt }).catch(() => undefined);
  }, [id, nickname, expiresAt, account.member, account.lapsed]);
  useEffect(() => { if (snapshot?.own.left) exitRoom(); }, [snapshot?.own.left]);

  // Continue with GoodWatch in a room signs this device in and comes back to this room, which then links.
  const { signIn: accountSignIn } = account;
  const signin = useCallback(async () => {
    if (guestOnly || account.busy) return;
    await accountSignIn(returnPath(`/room/${id}`));
  }, [account.busy, accountSignIn, id]);
  // Signed in on this device: your place in this room links to it (rooms you create, join or open, and
  // rooms whose earlier link has run out). Per participant, link state and device session: a refusal
  // can't loop, a new sign-in (even with this room still open) tries again, a dropped request retries
  // a few times, and if linking still fails the room says so with a quiet Retry.
  const own = snapshot?.own;
  const linkKey = own && !own.left ? `${own.participantId}:${own.member.state}:${account.generation}` : null;
  const gate = useRef(new RoomLinkGate());
  const [linkTick, setLinkTick] = useState(0);
  const [linked, setLinked] = useState<string | null>(null);
  const [linkFailed, setLinkFailed] = useState(false);
  const wantsLink = !guestOnly && account.member && !account.unavailable && Boolean(state.access) && own?.member.state !== 'linked' && Boolean(linkKey);
  const refetch = state.refetch;
  const access = state.access;
  const adoptAccess = state.adoptAccess;
  useEffect(() => {
    if (!wantsLink || !linkKey || !access) return;
    const go = gate.current.begin(linkKey, Date.now());
    if (!go.send) {
      if (go.retryInMs === null) return;
      const timer = setTimeout(() => setLinkTick((n) => n + 1), go.retryInMs);
      return () => clearTimeout(timer);
    }
    setLinkFailed(false);
    void linkRoom(access)
      .then((result) => { gate.current.settle(linkKey, 'linked', Date.now()); adoptAccess(result.credential); if (result.replacedGuest) setNotice('Resumed your existing place. Your account’s saved answers were kept.'); })
      .catch((e) => {
        const outcome = linkOutcome(e);
        gate.current.settle(linkKey, outcome, Date.now());
        if (e instanceof RoomFailure && e.code === 'member_required') void queryClient.invalidateQueries({ queryKey: accountKey });
        else if (e instanceof RoomFailure && e.code === 'conflict') setNotice('You joined this room with another GoodWatch account.');
      })
      .finally(() => {
        const failed = gate.current.failed(linkKey);
        setLinkFailed(failed);
        // Settled for now: done, refused, given up, or waiting out a retry (the room doesn't wait for that).
        setLinked(linkKey);
        setLinkTick((n) => n + 1);
      });
  }, [wantsLink, linkKey, access, refetch, linkTick, adoptAccess]);
  const retryLink = useCallback(() => {
    if (!linkKey) return;
    gate.current.retry(linkKey);
    setLinkFailed(false);
    setLinkTick((n) => n + 1);
  }, [linkKey]);
  // Until the account is known and the first link attempt has settled, the room doesn't ask for a country or services.
  const linking = !guestOnly && (!account.ready || (wantsLink && linked !== linkKey));
  const memberBusy = account.busy || linking;
  // Back from GoodWatch in this room: the cover lifts once the room is on screen.
  useEffect(() => { if (view) memberTransition.arrived(); }, [view]);
  // At startup the app shows once the room can show itself (or say why it can't), never its empty opening frame.
  const markPageReady = useContext(BootPageReady);
  const showable = Boolean(view) || Boolean(state.terminal) || state.access === null || Boolean(state.room.error);
  useEffect(() => { if (showable) markPageReady(`room:${id}`); }, [showable, markPageReady, id]);
  // A new room has no country yet, and services are only valid within one: the host sets it right away
  // (member prefill, else the device's region), before anyone picks services.
  // A command already in flight (room entry) makes the send a no-op: try again once it settles, a few times at most.
  // A send that doesn't go through (the room's credential still loading, or a GoodWatch link changing the
  // settings at the same moment) tries again shortly; each new settings version gets its own tries, so
  // the room never stays without a country (friends couldn't pick services then).
  const countryTries = useRef({ context: -1, n: 0 });
  const [countryRetry, setCountryRetry] = useState(0);
  const needsCountry = Boolean(view && view.isHost && !view.country && view.phase === 'setup');
  const prefillCountry = snapshot?.own.member.prefill?.country;
  const context = snapshot?.shared.contextVersion ?? 0;
  const blocked = state.busy || Boolean(state.pending) || state.privateError || entry.working || linking;
  useEffect(() => {
    if (!needsCountry || blocked) return;
    if (countryTries.current.context !== context) countryTries.current = { context, n: 0 };
    if (countryTries.current.n >= COUNTRY_TRIES) return;
    countryTries.current.n++;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void cmd.configure({ country: prefillCountry ?? deviceCountryHint() ?? 'US' }).then((ok) => {
      if (!ok && live) timer = setTimeout(() => setCountryRetry((n) => n + 1), COUNTRY_RETRY_MS);
    });
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [needsCountry, blocked, prefillCountry, context, cmd, countryRetry]);
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
  // Someone joining rings the live dot again; it rests otherwise (owner Q41).
  const [opening] = useState(() => ++openings);
  const [arrivals, setArrivals] = useState(NO_ARRIVALS);
  if (view) {
    const next = trackArrivals(arrivals, view.people.map((p) => p.id));
    if (next !== arrivals) setArrivals(next);
  }
  const invite = invitation.data;
  let inviteUrl: string | null = null;
  try { inviteUrl = invite ? appInviteUrl(invite.path) : null; } catch { inviteUrl = null; }
  const value: RoomContextValue = {
    id, state, entry, snapshot, view, cmd, latest, disabled, invite, inviteUrl, signin, memberBusy, memberLapsed: account.lapsed, linkFailed: linkFailed && wantsLink, retryLink, connectionWords, notice: notice || account.error, setNotice,
    dismissedProposal, dismissProposal, reopenProposal, setActivityView: state.setView, saves, acknowledgeIdeas,
    leaving, sheet: sheets.at(-1) ?? null, openSheet, closeSheet, closeSheets, renderSheet, openRoom,
    liveBeat: `${id}:${opening}:${arrivals.joins}`,
  };
  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}
