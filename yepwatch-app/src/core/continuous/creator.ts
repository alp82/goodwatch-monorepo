import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const key = 'yepwatch.v3.room-creator';
let pending: Promise<string> | null = null;
/** One anonymous installation identifier, independent of individual room requests and sign-in. */
export function readCreator(): Promise<string> {
  pending ??= (async () => {
    const saved = await SecureStore.getItemAsync(key);
    if (saved !== null) {
      if (!/^[a-f0-9]{64}$/.test(saved)) throw new Error('Could not restore this app’s room allowance.');
      return saved;
    }
    const value = Array.from(await Crypto.getRandomBytesAsync(32), b => b.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    return value;
  })().catch(error => { pending = null; throw error; });
  return pending;
}
