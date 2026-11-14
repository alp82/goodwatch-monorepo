import { useCallback, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { guestOnly } from '../config';
import { nativeClient } from '../credentials';
import { queryClient } from '../providers';
import { continuousApi, RoomFailure } from './api';
import { adoptAccountRoom } from './account-access';
import { roomRegistry } from './room-registry';
import type { AccountHome } from '@goodwatch/yepwatch-contracts/proposal';
import { accountFlow, authEpoch, type DeviceAccount } from './account-flow';
import { createDeviceAccount, guestAccount, settleLogoutRooms, withoutAccount } from './device-account';
import type { CachedRoom } from './state';
import { continuousKey } from './keys';
import { beginAccount, clearSession, forgetMemberName, readMemberName, readSession, rememberMemberName, saveSession } from './member';
import { forgetMemberHint, hasMemberHint, rememberMemberHint } from './web-member-return';

/**
 * This device's GoodWatch sign-in. It belongs to the device, not to a room: signing in never creates
 * or opens a room, and every room you create, join or open while signed in links to it.
 */
export const accountKey = ['yepwatch-account'] as const;
const guest = guestAccount;

const device = createDeviceAccount({
  guestOnly,
  nativeClient,
  epoch: authEpoch,
  api: continuousApi,
  store: { readSession, saveSession, clearSession, readMemberName, rememberMemberName, forgetMemberName },
  hint: { has: hasMemberHint, remember: rememberMemberHint, forget: forgetMemberHint },
  cache: {
    get: () => queryClient.getQueryData<DeviceAccount>(accountKey),
    set: (account) => queryClient.setQueryData(accountKey, account),
  },
  bump: () => accountFlow.bump(),
  unsupported: (e) => e instanceof RoomFailure && (e.code === 'not_implemented' || e.status === 404),
  forgetAccount: () => {
    for (const key of ['proposal-room', 'home-room'])
      queryClient.setQueriesData<CachedRoom>({ queryKey: [key] }, (room) => (room?.own ? withoutAccount(room) : room));
  },
});
// Log out or a new sign-in: an account answer still in flight belongs to the earlier sign-in. Rooms stay
// on screen (Log out keeps this device in them as a guest; a sign-in links the same place) and read again
// once the change has ended (an answer while Log out runs is refused).
authEpoch.subscribe(() => {
  void queryClient.cancelQueries({ queryKey: accountKey });
  void queryClient.cancelQueries({ queryKey: ['account-home'] });
  queryClient.removeQueries({ queryKey: ['account-home'] });
  if (!authEpoch.settled()) return;
  for (const key of ['proposal-room', 'home-room']) void queryClient.invalidateQueries({ queryKey: [key] });
});

type AccountRoomChange = { leftLabel: string } | { archivedAt: number | null };
const homeKey = ['account-home'] as const;
type AccountRoom = AccountHome['rooms'][number];

function changed(r: AccountRoom, change: AccountRoomChange): AccountRoom {
  return 'leftLabel' in change ? { ...r, leftLabel: change.leftLabel, snapshot: { ...r.snapshot, own: { ...r.snapshot.own, left: true } } }
    : { ...r, archivedAt: change.archivedAt };
}

/**
 * A change this device just made to one of the account's rooms (left, archived, restored), written into the
 * account's cached rooms at once: the start page draws its final layout from its first frame, and the read that
 * follows only confirms it (a stale card, then History in its place, moved the page under the person).
 * An account read already in flight is cancelled first, so its older answer can't put the room back. A cached
 * read from before the room was made or joined gets the room from its own cached snapshot. `undo` puts the
 * room back as it was.
 */
export async function settleAccountRoom(roomId: string, change: AccountRoomChange) {
  await queryClient.cancelQueries({ queryKey: homeKey });
  const before = queryClient.getQueriesData<AccountHome>({ queryKey: homeKey });
  const own = queryClient.getQueryData<CachedRoom>(continuousKey(roomId));
  const fresh: AccountRoom | null = own ? (({ ownRevision: _, ...snapshot }) => ({ snapshot, joinedAt: Date.now(), archivedAt: null, leftLabel: null }))(own) : null;
  queryClient.setQueriesData<AccountHome>({ queryKey: homeKey }, (home) => {
    if (!home) return home;
    if (home.rooms.some((r) => r.snapshot.shared.roomId === roomId))
      return { ...home, rooms: home.rooms.map((r) => (r.snapshot.shared.roomId === roomId ? changed(r, change) : r)) };
    return fresh ? { ...home, rooms: [...home.rooms, changed(fresh, change)] } : home;
  });
  // Undo puts back this room only: another change made meanwhile stays.
  const undo = () => {
    for (const [key, home] of before) {
      if (!home) continue;
      const was = home.rooms.find((r) => r.snapshot.shared.roomId === roomId);
      queryClient.setQueryData<AccountHome>(key, (now) => now && { ...now, rooms: was
        ? now.rooms.map((r) => (r.snapshot.shared.roomId === roomId ? was : r))
        : now.rooms.filter((r) => r.snapshot.shared.roomId !== roomId) });
    }
  };
  return { undo };
}

/** The server has the change (Leave, Archive in the room): settle the cache before the start page shows, then read it. */
export async function accountRoomChanged(roomId: string, change: AccountRoomChange) {
  await settleAccountRoom(roomId, change);
  void queryClient.invalidateQueries({ queryKey: homeKey });
}

export const loadAccount = device.load;
/** A sign-in that just completed on this device (the app's sheet or its return link). */
export const accountSignedIn = device.signedIn;
/** Links your participant in a room to this device's sign-in (a no-op on the server when already linked). */
export const linkRoom = async (access: import('../credentials').RoomAccess) => {
  const asked = authEpoch.current();
  const result = await continuousApi.memberLink(access, await readSession());
  await adoptAccountRoom(result, asked);
  return result;
};
/**
 * Ends this device's GoodWatch sign-in for YepWatch. GoodWatch itself stays signed in. The device stays
 * in its rooms as a guest: the rooms already shown go on the device's own list first (so Your rooms never
 * empties for a moment), then every room the server kept goes on it and the others leave it again
 * (settleLogoutRooms). Log out starts in this tick: account data leaves the rooms on screen at once.
 */
export async function signOut() {
  const shown = queryClient.getQueriesData<AccountHome>({ queryKey: ['account-home'] })
    .flatMap(([, home]) => home?.rooms ?? []).filter((r) => !r.snapshot.own.left)
    .map((r) => ({ roomId: r.snapshot.shared.roomId, expiresAt: r.snapshot.shared.expiresAt,
      nickname: r.snapshot.shared.participants.find((p) => p.participantId === r.snapshot.own.participantId)?.nickname ?? '' }));
  const ending = device.signOut();
  ending.catch(() => undefined); // awaited below; a failed Log out still throws there
  await Promise.all(shown.map((r) => roomRegistry.remember(r).catch(() => undefined)));
  await settleLogoutRooms(shown, await ending, roomRegistry);
}

export function useAccount() {
  const query = useQuery({
    queryKey: accountKey, queryFn: loadAccount, enabled: !guestOnly, staleTime: 60_000, retry: 1,
    // Never paused offline: a guest is known from the device alone, and a member's check fails (and says
    // so) instead of leaving the start page waiting for a network that may not come.
    networkMode: 'always',
    // GoodWatch couldn't renew the session just now: check again soon, quietly.
    refetchInterval: (q) => (q.state.data?.unavailable ? 30_000 : false),
  });
  const flow = useSyncExternalStore(accountFlow.subscribe, accountFlow.snapshot, accountFlow.snapshot);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');
  /**
   * Signs in and comes back to `returnPath` (the web's one round trip); the app stays on its screen.
   * One flow for the whole app: a second press anywhere joins the one already starting.
   */
  const signIn = useCallback(async (returnPath: string) => {
    if (guestOnly) return;
    setError('');
    try {
      const status = await accountFlow.signIn(() => beginAccount(returnPath));
      if (status) await accountSignedIn(status);
    } catch (e) {
      setError(e instanceof RoomFailure && e.code === 'not_implemented' ? 'GoodWatch sign-in isn’t connected yet.' : e instanceof Error ? e.message : 'Sign-in could not start.');
    }
  }, []);
  const logOut = useCallback(async () => {
    setLoggingOut(true);
    setError('');
    try { await signOut(); }
    catch { setError('Couldn’t log out. Try again.'); }
    finally { setLoggingOut(false); }
  }, []);
  const data = guestOnly ? guest : query.data;
  return {
    /** The sign-in is known (or this build has none). */
    ready: guestOnly || query.isFetched,
    member: data?.state === 'member',
    /** Signed in here before and the session ran out: the name stays, Profile offers Reconnect. */
    lapsed: data?.state === 'lapsed',
    /** The sign-in couldn't be checked (no network, YepWatch unreachable) and nothing is known yet. */
    failed: !guestOnly && query.isError && query.data === undefined,
    /** Checks the sign-in again. */
    recheck: () => { void query.refetch(); },
    /** Signed in, but GoodWatch couldn't renew the session just now (tried again shortly). */
    unavailable: data?.unavailable === true,
    name: data?.displayName ?? null,
    /** Moves whenever this device's sign-in changes. */
    generation: flow.generation,
    signIn,
    logOut,
    /** A sign-in is starting (anywhere in the app) or Log out is running. */
    busy: flow.pending || loggingOut,
    error,
  };
}
