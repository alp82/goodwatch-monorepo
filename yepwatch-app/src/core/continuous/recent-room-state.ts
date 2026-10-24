export interface RecentRoom { roomId: string; nickname: string; expiresAt: number }
/** Routing reminder only. Credentials and invitation capabilities remain in their existing stores. */
export function recentRoom(raw: string | null): RecentRoom | null {
  try {
    const value = raw ? JSON.parse(raw) : null;
    return value && typeof value.roomId === 'string' && typeof value.nickname === 'string'
      && Number.isFinite(value.expiresAt) && value.expiresAt > Date.now() ? value : null;
  } catch { return null; }
}
