import { useCallback, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AccountStatus, MemberStatusResponse } from '@goodwatch/yepwatch-contracts/proposal';
import { guestOnly } from '../config';
import { nativeClient, type RoomAccess } from '../credentials';
import { queryClient } from '../providers';
import { continuousApi, RoomFailure } from './api';
import { accountFlow, accountView, type DeviceAccount } from './account-flow';
import { beginAccount, clearSession, forgetMemberName, readMemberName, readSession, rememberMemberName, saveSession } from './member';
import { forgetMemberHint, hasMemberHint, rememberMemberHint } from './web-member-return';

/**
 * This device's GoodWatch sign-in. It belongs to the device, not to a room: signing in never creates
 * or opens a room, and every room you create, join or open while signed in links to it.
 */
export const accountKey = ['yepwatch-account'] as const;
const guestStatus: AccountStatus = { state: 'guest', displayName: null };
const guest: DeviceAccount = accountView(guestStatus, null);

/** The device's sign-in changed (signed in, lapsed, logged out): rooms try linking again. */
function settle(next: DeviceAccount) {
  const previous = queryClient.getQueryData<DeviceAccount>(accountKey);
  if (previous && previous.state !== next.state) accountFlow.bump();
  return next;
}

export async function loadAccount(): Promise<DeviceAccount> {
  if (guestOnly) return guest;
  const [session, remembered] = await Promise.all([readSession(), readMemberName()]);
  // The app knows it has no session without asking. A browser's session is an HttpOnly cookie: a
  // browser that never signed in here (no hint) doesn't ask either, so a first visit makes no request.
  if (nativeClient ? !session : !hasMemberHint()) return settle(accountView(guestStatus, remembered));
  try {
    const status = await continuousApi.account(session);
    if (status.session) await saveSession(status.session);
    if (status.state === 'guest' && session) await clearSession();
    if (status.state === 'member') {
      rememberMemberHint();
      await rememberMemberName(status.displayName ?? '');
    } else if (remembered === null) forgetMemberHint();
    return settle(accountView(status, remembered));
  } catch (e) {
    if (e instanceof RoomFailure && (e.code === 'not_implemented' || e.status === 404)) return guest;
    throw e;
  }
}

/** A sign-in that just completed on this device (the app's sheet or its return link). */
export async function accountSignedIn(status: AccountStatus) {
  await rememberMemberName(status.displayName ?? '');
  queryClient.setQueryData(accountKey, accountView(status, null));
  accountFlow.bump();
}

/** Links your participant in a room to this device's sign-in (a no-op on the server when already linked). */
export async function linkRoom(access: RoomAccess): Promise<MemberStatusResponse> {
  const result = await continuousApi.memberLink(access, await readSession());
  if (result.session) await saveSession(result.session);
  return { state: result.state, prefill: result.prefill };
}

/** Ends this device's GoodWatch sign-in for YepWatch. GoodWatch itself stays signed in. */
export async function signOut() {
  if (!nativeClient) await continuousApi.accountLogout();
  await clearSession();
  await forgetMemberName();
  forgetMemberHint();
  queryClient.setQueryData(accountKey, guest);
  accountFlow.bump();
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
