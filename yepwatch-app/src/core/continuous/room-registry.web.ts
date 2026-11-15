import { createRegistry, REGISTRY_KEYS } from './room-registry-store';
import { loadRecentRoom } from './recent-room';
import { eraseDevice } from './erase-device';
export type { RegisteredRoom, DecisionRecord } from './room-registry-state';

type Storage = typeof sessionStorage;
const session = (): Storage | null => { try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; } };
const local = (): Storage | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };
/**
 * The name is the browser's (every tab and later visits keep it), in localStorage; storage that is missing or blocked
 * keeps it for this tab only. Everything else has the tab scope of routing IDs and invitations.
 */
const shared = (key: string) => key === REGISTRY_KEYS.profile;
const get = (s: Storage | null, key: string) => { try { return s?.getItem(key) ?? null; } catch { return null; } };
const set = (s: Storage | null, key: string, value: string) => { try { s?.setItem(key, value); return Boolean(s); } catch { return false; } };
const drop = (s: Storage | null, key: string) => { try { s?.removeItem(key); } catch { /* nothing kept */ } };

/** Browser: credentials stay in HttpOnly cookies. */
export const roomRegistry = createRegistry({
  read: async (key) => (shared(key) ? get(local(), key) ?? get(session(), key) : get(session(), key)),
  write: async (key, value) => {
    if (shared(key) && set(local(), key, value)) { drop(session(), key); return; }
    set(session(), key, value);
  },
  remove: async (key) => { if (shared(key)) drop(local(), key); drop(session(), key); },
}, loadRecentRoom, Date.now, eraseDevice);
