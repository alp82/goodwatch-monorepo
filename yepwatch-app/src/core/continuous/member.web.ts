import type { AccountStatus } from '@goodwatch/yepwatch-contracts/proposal';
import { secureAuthorizeUrl } from './member-state';
import { continuousApi } from './api';
import { rememberMemberReturn, clearMemberReturn, rememberMemberHint, readMemberHintName, rememberMemberHintName, forgetMemberHintName } from './web-member-return';
import { memberTransition } from './member-transition';
import { replaceSignInGeneration } from './room-snapshot';

/** Browsers keep the sealed session in an HttpOnly cookie: nothing to read or store here. */
export async function readSession(): Promise<string | null> { return null; }
export function peekSession(): string | null { return null; }
export async function saveSession(_session: string) { /* The API sets the cookie. */ }
export async function clearSession() { /* The API clears the cookie. */ }
/** The name of this browser's last GoodWatch sign-in ('' without one), kept until Log out. */
export async function readMemberName() { return readMemberHintName(); }
export async function rememberMemberName(name: string) { rememberMemberHintName(name); }
export async function forgetMemberName() { forgetMemberHintName(); }

/**
 * Signs this browser in with GoodWatch and comes back to `returnPath` (the screen you were on), in
 * one full-page round trip. The transition covers leaving; the returning page covers arriving.
 * Resolves only if the browser restores this page from its back/forward cache.
 */
export async function beginAccount(returnPath: string): Promise<AccountStatus | null> {
  const result = await continuousApi.accountStart({ returnTo: `${window.location.origin}${returnPath}`, client: 'browser' });
  const destination = secureAuthorizeUrl(result.authorizeUrl);
  rememberMemberReturn(returnPath);
  rememberMemberHint();
  // The sign-in changes on the way back: rooms saved for a reload belong to the one before it.
  replaceSignInGeneration();
  await memberTransition.leave();
  await new Promise<void>((resolve, reject) => {
    const resumed = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      window.removeEventListener('pageshow', resumed);
      clearMemberReturn();
      memberTransition.reset();
      resolve();
    };
    window.addEventListener('pageshow', resumed);
    try { window.location.assign(destination); }
    catch (error) {
      window.removeEventListener('pageshow', resumed);
      clearMemberReturn();
      memberTransition.reset();
      reject(error);
    }
  });
  return null;
}
export async function finishAccount(_raw: string): Promise<AccountStatus> {
  throw new Error('Browsers finish GoodWatch sign-in on the server.');
}
/** Older room-bound returns only exist in the native app. */
export async function finishMember(_raw: string): Promise<string> {
  throw new Error('Browser linking is verified by the API callback.');
}
