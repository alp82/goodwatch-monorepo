import * as SecureStore from 'expo-secure-store';
import { chunkedKeyValue, createRegistry } from './room-registry-store';
import { loadRecentRoom } from './recent-room';
export type { RegisteredRoom, DecisionRecord } from './room-registry-state';
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
/** Native: each list is split into small SecureStore items (at most 500 characters each). */
export const roomRegistry = createRegistry(chunkedKeyValue({
  read: (key) => SecureStore.getItemAsync(key, options),
  write: (key, value) => SecureStore.setItemAsync(key, value, options),
  remove: (key) => SecureStore.deleteItemAsync(key, options),
}), loadRecentRoom);
