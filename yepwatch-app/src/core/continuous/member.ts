import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import type { AccountStatus } from '@goodwatch/yepwatch-contracts/proposal';
import { loadAccess } from '../credentials';
import { authEpoch } from './account-flow';
import { continuousApi } from './api';
import { memberReturnUri, nativeAccountCallback, nativeMemberCallback, secureAuthorizeUrl, type AccountIntent, type MemberIntent } from './member-state';
const key = 'yepwatch.v2.member-intent';
const accountIntentKey = 'yepwatch.v3.account-intent';
const sessionKey = 'yepwatch.v3.member-session';
const nameKey = 'yepwatch.v3.member-name';
const secure = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

/**
 * The sealed GoodWatch session of this device (the API seals it; the app only keeps it). Every request
 * sends it, so it's read from the keystore once and then kept in memory: a keystore read on Android
 * takes tens of ms and queued in front of each vote's request.
 */
let session: Promise<string | null> | undefined;
let known: { value: string | null } | undefined;
export function readSession() {
  if (!session) {
    const read = SecureStore.getItemAsync(sessionKey);
    session = read;
    read.then((value) => { if (session === read) known = { value }; }, () => { if (session === read) session = undefined; });
  }
  return session;
}
/** The session when it has been read already; undefined until then. */
export function peekSession() { return known?.value; }
function keep(value: string | null) { session = Promise.resolve(value); known = { value }; }
export function saveSession(value: string) { keep(value); return SecureStore.setItemAsync(sessionKey, value, secure); }
export function clearSession() { keep(null); return SecureStore.deleteItemAsync(sessionKey); }
/** The stored session was erased behind this module's back (erase-device): read it again next time. */
export function forgetSessionCache() { session = undefined; known = undefined; }
/** The name of this device's last GoodWatch sign-in ('' without one), kept until Log out: a lapsed session shows it. */
export function readMemberName() { return SecureStore.getItemAsync(nameKey).catch(() => null); }
export function rememberMemberName(name: string) { return SecureStore.setItemAsync(nameKey, name, secure).catch(() => undefined); }
export function forgetMemberName() { return SecureStore.deleteItemAsync(nameKey).catch(() => undefined); }

async function challenge() {
  const bytes = await Crypto.getRandomBytesAsync(32);
  const verifier = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const digest = (
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
      encoding: Crypto.CryptoEncoding.BASE64,
    })
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return { verifier, challenge: digest };
}

/**
 * Signs this device in with GoodWatch in the system sign-in sheet. The screen underneath stays where
 * it was; nothing is created. Resolves with the account, or null when the sheet was closed.
 */
export async function beginAccount(_returnPath: string): Promise<AccountStatus | null> {
  const callback = memberReturnUri(Constants.expoConfig?.scheme);
  const pkce = await challenge();
  const result = await continuousApi.accountStart({ returnTo: callback, client: 'native', codeChallenge: pkce.challenge });
  const authorizeUrl = secureAuthorizeUrl(result.authorizeUrl);
  const pending: AccountIntent = { expectedState: result.state, verifier: pkce.verifier, returnUri: callback, expiresAt: result.expiresAt };
  await SecureStore.setItemAsync(accountIntentKey, JSON.stringify(pending), secure);
  const session = await WebBrowser.openAuthSessionAsync(authorizeUrl, callback);
  if (session.type === 'success') return finishAccount(session.url);
  return null;
}
let finishing: { url: string; result: Promise<AccountStatus> } | null = null;
/** Redeems a GoodWatch return link with the verifier kept on this device. One link redeems once. */
export function finishAccount(raw: string): Promise<AccountStatus> {
  if (finishing?.url === raw) return finishing.result;
  const result = (async () => {
    const stored = await SecureStore.getItemAsync(accountIntentKey);
    if (!stored) throw new Error('No pending sign-in. Try again.');
    const request = nativeAccountCallback(raw, JSON.parse(stored) as AccountIntent);
    const status = await continuousApi.accountExchange(request);
    if (status.state !== 'member' || !status.session) throw new Error('GoodWatch sign-in was not confirmed.');
    // A new account replaces this device's session: answers asked under the old one are outdated.
    authEpoch.advance();
    await saveSession(status.session);
    // Again after the save, like Log out: a read that started during the save may hold the old session.
    authEpoch.advance();
    await SecureStore.deleteItemAsync(accountIntentKey);
    return { state: status.state, displayName: status.displayName };
  })();
  finishing = { url: raw, result };
  result.catch(() => { if (finishing?.result === result) finishing = null; });
  return result;
}
/** The return link this device is redeeming or last redeemed, if any. */
export function accountRedeeming(): Promise<AccountStatus> | null { return finishing?.result ?? null; }
let exchanging: Promise<string> | null = null;
let exchangingUrl: string | null = null;
let completed: { callback: string; roomId: string } | null = null;
/** Finishes a room-bound link started by an older app version (still pending on this device). */
export function finishMember(raw: string): Promise<string> {
  if (completed?.callback === raw) return Promise.resolve(completed.roomId);
  if (exchanging)
    return raw === exchangingUrl
      ? exchanging
      : Promise.reject(new Error('A different sign-in callback is already being verified.'));
  exchangingUrl = raw;
  exchanging = (async () => {
    const stored = await SecureStore.getItemAsync(key);
    if (!stored) throw new Error('No pending sign-in. Return to your room to start again.');
    const pending: MemberIntent = JSON.parse(stored);
    const request = nativeMemberCallback(raw, pending);
    const access = await loadAccess(pending.roomId);
    if (!access) throw new Error('Reopen your room invitation before linking your account.');
    const result = await continuousApi.memberExchange(access, request);
    if (result.state !== 'linked') throw new Error('The server has not confirmed account linking.');
    await SecureStore.deleteItemAsync(key);
    completed = { callback: raw, roomId: pending.roomId };
    return pending.roomId;
  })().finally(() => {
    exchanging = null;
    exchangingUrl = null;
  });
  return exchanging;
}
