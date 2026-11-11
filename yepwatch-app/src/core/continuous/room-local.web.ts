/** Friend ideas the host has already seen, kept in this browser tab. */
const safe = (roomId: string) => roomId.replace(/[^a-zA-Z0-9._-]/g, '_');
const seenKey = (roomId: string) => `yepwatch.v3.ideas-seen.${safe(roomId)}`;
const store = () => (typeof sessionStorage === 'undefined' ? null : sessionStorage);
export async function readSeenIdeas(roomId: string): Promise<string[]> {
  const raw = store()?.getItem(seenKey(roomId));
  const value: unknown = raw ? JSON.parse(raw) : [];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}
export async function writeSeenIdeas(roomId: string, seen: string[]) {
  store()?.setItem(seenKey(roomId), JSON.stringify(seen));
}
