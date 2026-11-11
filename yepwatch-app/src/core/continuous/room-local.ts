/**
 * Friend ideas the host has already seen, kept on this device only.
 */
import * as SecureStore from 'expo-secure-store';
const safe = (roomId: string) => roomId.replace(/[^a-zA-Z0-9._-]/g, '_');
const seenKey = (roomId: string) => `yepwatch.v3.ideas-seen.${safe(roomId)}`;
const ids = (raw: string | null) => {
  const value: unknown = raw ? JSON.parse(raw) : [];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
};
export async function readSeenIdeas(roomId: string): Promise<string[]> {
  return ids(await SecureStore.getItemAsync(seenKey(roomId)));
}
export async function writeSeenIdeas(roomId: string, seen: string[]) {
  await SecureStore.setItemAsync(seenKey(roomId), JSON.stringify(seen));
}
