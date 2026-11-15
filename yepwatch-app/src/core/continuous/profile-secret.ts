import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { encodeProfileSecret, PROFILE_SECRET_BYTES, validProfileSecret } from './profile-secret-format';

export const PROFILE_SECRET_KEY = 'yepwatch.v3.taste-secret';
let known: string | undefined;
let pending: Promise<string> | null = null;

/** The secret once read (no wait), undefined before. */
export function peekProfileSecret(): string | undefined { return known; }

/** This device's taste profile secret, made on first use and kept in the keychain / keystore. */
export function readProfileSecret(): Promise<string> {
  pending ??= (async () => {
    const saved = await SecureStore.getItemAsync(PROFILE_SECRET_KEY);
    if (validProfileSecret(saved)) return (known = saved);
    const value = encodeProfileSecret(await Crypto.getRandomBytesAsync(PROFILE_SECRET_BYTES));
    await SecureStore.setItemAsync(PROFILE_SECRET_KEY, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    return (known = value);
  })().catch((error) => { pending = null; throw error; });
  return pending;
}

/** After Reset my taste or erasing the device: the next profile request makes a new secret. */
export async function forgetProfileSecret() {
  known = undefined;
  pending = null;
  await SecureStore.deleteItemAsync(PROFILE_SECRET_KEY);
}
