import * as SecureStore from 'expo-secure-store';

/** Unsent taste answers (taste-outbox.ts encodes them small: SecureStore values stay under 2 KB). */
const KEY = 'yepwatch.v3.taste-outbox';
export const readOutbox = () => SecureStore.getItemAsync(KEY);
export async function writeOutbox(value: string | null) {
  if (value) await SecureStore.setItemAsync(KEY, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  else await SecureStore.deleteItemAsync(KEY);
}
export const TASTE_OUTBOX_KEY = KEY;
