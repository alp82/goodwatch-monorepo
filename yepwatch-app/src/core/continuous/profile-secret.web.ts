import * as Crypto from 'expo-crypto';
import { encodeProfileSecret, PROFILE_SECRET_BYTES, validProfileSecret } from './profile-secret-format';

/**
 * Browsers keep the secret in localStorage (no keychain on the web), so a profile lasts across visits on this browser.
 * Storage can be missing (private windows, blocked site data): the secret then lives for this page only.
 */
export const PROFILE_SECRET_KEY = 'yepwatch.v3.taste-secret';
let known: string | undefined;
let pending: Promise<string> | null = null;
const storage = () => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

export function peekProfileSecret(): string | undefined { return known; }

export function readProfileSecret(): Promise<string> {
  pending ??= (async () => {
    let saved: string | null = null;
    try { saved = storage()?.getItem(PROFILE_SECRET_KEY) ?? null; } catch { saved = null; }
    if (validProfileSecret(saved)) return (known = saved);
    const value = encodeProfileSecret(await Crypto.getRandomBytesAsync(PROFILE_SECRET_BYTES));
    try { storage()?.setItem(PROFILE_SECRET_KEY, value); } catch { /* this page only */ }
    return (known = value);
  })().catch((error) => { pending = null; throw error; });
  return pending;
}

export async function forgetProfileSecret() {
  known = undefined;
  pending = null;
  try { storage()?.removeItem(PROFILE_SECRET_KEY); } catch { /* nothing kept */ }
}
