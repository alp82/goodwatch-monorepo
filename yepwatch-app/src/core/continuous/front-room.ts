import * as SecureStore from 'expo-secure-store';
/**
 * The room this device last had in front (see resume-room.ts). A routing reminder only: the room's
 * credential stays in its own store. Native: survives the app being closed or killed.
 */
const key = 'yepwatch.v3.front-room';
export async function loadFrontRoom(): Promise<string | null> {
  const value = await SecureStore.getItemAsync(key);
  return value || null;
}
export async function saveFrontRoom(roomId: string | null) {
  if (roomId) await SecureStore.setItemAsync(key, roomId);
  else await SecureStore.deleteItemAsync(key);
}
