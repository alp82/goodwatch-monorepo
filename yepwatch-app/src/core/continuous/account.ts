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
import { createDeviceAccount, guestAccount } from './device-account';
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
});
// Log out or a new sign-in: an account answer still in flight belongs to the earlier sign-in. Rooms stay
// on screen (Log out keeps this device in them as a guest; a sign-in links the same place) and read again.
authEpoch.subscribe(() => {
  void queryClient.cancelQueries({ queryKey: accountKey });
  void queryClient.cancelQueries({ queryKey: ['account-home'] });
  queryClient.removeQueries({ queryKey: ['account-home'] });
  for (const key of ['proposal-room', 'home-room']) void queryClient.invalidateQueries({ queryKey: [key] });
});

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
 * in its rooms as a guest: they go on the device's own list first (so Your rooms never empties for a
 * moment), and the ones the server didn't keep for this device (another device holds the account's
 * place) leave it again.
 */
export async function signOut() {
  const rooms = queryClient.getQueriesData<AccountHome>({ queryKey: ['account-home'] })
    .flatMap(([, home]) => home?.rooms ?? []).filter((r) => !r.snapshot.own.left)
    .map((r) => ({ roomId: r.snapshot.shared.roomId, expiresAt: r.snapshot.shared.expiresAt,
      nickname: r.snapshot.shared.participants.find((p) => p.participantId === r.snapshot.own.participantId)?.nickname ?? '' }));
  await Promise.all(rooms.map((r) => roomRegistry.remember(r).catch(() => undefined)));
  const result = await device.signOut() as { keptRooms?: { roomId: string }[] } | undefined;
  if (!Array.isArray(result?.keptRooms)) return;
  const kept = new Set(result.keptRooms.map((r) => r.roomId));
  await Promise.all(rooms.filter((r) => !kept.has(r.roomId)).map((r) => roomRegistry.forget(r.roomId).catch(() => undefined)));
}

export function useAccount() {
  const query = useQuery({
    queryKey: accountKey, queryFn: loadAccount, enabled: !guestOnly, staleTime: 60_000, retry: 1,
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
