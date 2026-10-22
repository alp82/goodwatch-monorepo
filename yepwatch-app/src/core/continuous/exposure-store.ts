import * as SecureStore from 'expo-secure-store';
const key = (roomId: string) => `yepwatch.v3.exposure.${roomId.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
/** Observation markers only. A reload never reconstructs a duration from wall time. */
export async function readObserved(roomId: string): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(key(roomId));
  return raw ? JSON.parse(raw) : [];
}
export async function writeObserved(roomId: string, keys: string[]) {
  await SecureStore.setItemAsync(key(roomId), JSON.stringify(keys));
}
