import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { loadAccess, type RoomAccess } from '../credentials';
import { continuousApi } from './api';
import { nativeMemberCallback, secureAuthorizeUrl, type MemberIntent } from './member-state';
const key = 'yepwatch.v2.member-intent';
const callback = 'yepwatch://auth/callback';
let exchanging: Promise<string> | null = null;
let exchangingUrl: string | null = null;
let completed: { callback: string; roomId: string } | null = null;
export async function beginMember(access: RoomAccess) {
  const bytes = await Crypto.getRandomBytesAsync(32);
  const verifier = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const challenge = (
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
      encoding: Crypto.CryptoEncoding.BASE64,
    })
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const result = await continuousApi.memberStart(access, {
    roomId: access.roomId,
    returnTo: callback,
    client: 'native',
    codeChallenge: challenge,
  });
  const authorizeUrl = secureAuthorizeUrl(result.authorizeUrl);
  const pending: MemberIntent = {
    roomId: access.roomId,
    verifier,
    expectedState: result.state,
    expiresAt: result.expiresAt,
  };
  await SecureStore.setItemAsync(key, JSON.stringify(pending), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  completed = null;
  const session = await WebBrowser.openAuthSessionAsync(authorizeUrl, callback);
  if (session.type === 'success') await finishMember(session.url);
}
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
