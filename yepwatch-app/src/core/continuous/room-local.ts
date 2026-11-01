/**
 * Small per-room notes kept on this device only (never sent): friend ideas the host has already
 * seen, and the "open Mood next" step of a just-created room that waits through member sign-in.
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
// Native sign-in returns into this same app process (auth session), so memory is enough here.
const moodSteps = new Set<string>();
export function markMoodStep(roomId: string) { moodSteps.add(roomId); }
export function hasMoodStep(roomId: string) { return moodSteps.has(roomId); }
export function clearMoodStep(roomId: string) { moodSteps.delete(roomId); }
