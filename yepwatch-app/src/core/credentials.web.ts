import type { GuestCredential } from '@goodwatch/yepwatch-contracts';
export interface RoomAccess { roomId: string; participantId: string; token: string; expiresAt: number }
export const nativeClient = false;
/** Only nonsensitive routing IDs persist. The credential lives in an HttpOnly server cookie. */
export async function saveAccess(access: GuestCredential) {
  const safe = { roomId: access.roomId, participantId: access.participantId, token: '', expiresAt: access.expiresAt };
  sessionStorage.setItem(`yepwatch.room.${access.roomId}`, JSON.stringify(safe));
}
export async function loadAccess(roomId: string): Promise<RoomAccess | null> {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(`yepwatch.room.${roomId}`);
  if (!raw) return null;
  try { return { ...JSON.parse(raw), token: '' }; } catch { return null; }
}
export async function forgetAccess(roomId: string) { sessionStorage.removeItem(`yepwatch.room.${roomId}`); }
