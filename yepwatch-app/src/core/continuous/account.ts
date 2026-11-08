import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AccountStatus, MemberStatusResponse } from '@goodwatch/yepwatch-contracts/proposal';
import { guestOnly } from '../config';
import { nativeClient, type RoomAccess } from '../credentials';
import { queryClient } from '../providers';
import { continuousApi, RoomFailure } from './api';
import { beginAccount, clearSession, readSession, saveSession } from './member';
import { forgetMemberHint, hasMemberHint, rememberMemberHint } from './web-member-return';

/**
 * This device's GoodWatch sign-in. It belongs to the device, not to a room: signing in never creates
 * or opens a room, and every room you create, join or open while signed in links to it.
 */
export const accountKey = ['yepwatch-account'] as const;
const guest: AccountStatus = { state: 'guest', displayName: null };

export async function loadAccount(): Promise<AccountStatus> {
  if (guestOnly) return guest;
  const session = await readSession();
  // The app knows it has no session without asking. A browser's session is an HttpOnly cookie: a
  // browser that never signed in here (no hint) doesn't ask either, so a first visit makes no request.
  if (nativeClient ? !session : !hasMemberHint()) return guest;
  try {
    const status = await continuousApi.account(session);
    if (status.session) await saveSession(status.session);
    if (status.state === 'guest' && session) await clearSession();
    if (status.state === 'member') rememberMemberHint(); else forgetMemberHint();
    return { state: status.state, displayName: status.displayName };
  } catch (e) {
    if (e instanceof RoomFailure && (e.code === 'not_implemented' || e.status === 404)) return guest;
    throw e;
  }
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
  forgetMemberHint();
  queryClient.setQueryData(accountKey, guest);
}

export function useAccount() {
  const query = useQuery({ queryKey: accountKey, queryFn: loadAccount, enabled: !guestOnly, staleTime: 60_000, retry: 1 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** Signs in and comes back to `returnPath` (the web's one round trip); the app stays on its screen. */
  const signIn = useCallback(async (returnPath: string) => {
    if (guestOnly) return;
    setBusy(true);
    setError('');
    try {
      const status = await beginAccount(returnPath);
      if (status) queryClient.setQueryData(accountKey, status);
    } catch (e) {
      setError(e instanceof RoomFailure && e.code === 'not_implemented' ? 'GoodWatch sign-in isn’t connected yet.' : e instanceof Error ? e.message : 'Sign-in could not start.');
    } finally {
      setBusy(false);
    }
  }, []);
  const logOut = useCallback(async () => {
    setBusy(true);
    setError('');
    try { await signOut(); }
    catch { setError('Couldn’t log out. Try again.'); }
    finally { setBusy(false); }
  }, []);
  const data = guestOnly ? guest : query.data;
  return {
    /** The sign-in is known (or this build has none). */
    ready: guestOnly || query.isFetched,
    member: data?.state === 'member',
    name: data?.displayName ?? null,
    signIn,
    logOut,
    busy,
    error,
  };
}
