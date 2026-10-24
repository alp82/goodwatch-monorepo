import * as SecureStore from 'expo-secure-store';
import { recentRoom, type RecentRoom } from './recent-room-state';
export type { RecentRoom } from './recent-room-state';
const key = 'yepwatch.recent-room';
export async function rememberRoom(room: RecentRoom) {
  await SecureStore.setItemAsync(key, JSON.stringify(room), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}
export async function loadRecentRoom() { return recentRoom(await SecureStore.getItemAsync(key)); }
