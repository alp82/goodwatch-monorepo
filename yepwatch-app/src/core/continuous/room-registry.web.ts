import { createRegistry } from './room-registry-store';
import { loadRecentRoom } from './recent-room';
export type { RegisteredRoom, DecisionRecord } from './room-registry-state';
/** Browser: the same tab scope as routing IDs and invitations. Credentials stay in HttpOnly cookies. */
export const roomRegistry = createRegistry({
  read: async (key) => (typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(key)),
  write: async (key, value) => { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, value); },
}, loadRecentRoom);
