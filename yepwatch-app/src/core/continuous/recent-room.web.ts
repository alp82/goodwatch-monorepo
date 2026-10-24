import { recentRoom, type RecentRoom } from './recent-room-state';
export type { RecentRoom } from './recent-room-state';
const key = 'yepwatch.recent-room';
export async function rememberRoom(room: RecentRoom) { sessionStorage.setItem(key, JSON.stringify(room)); }
export async function loadRecentRoom() { return recentRoom(sessionStorage.getItem(key)); }
