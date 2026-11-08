import type { AccountStatus } from '@goodwatch/yepwatch-contracts/proposal';

/**
 * The device sign-in as the app shows it. `lapsed`: this device was signed in and the session ran out
 * (no renewal yet): the name stays and Profile offers Reconnect, instead of turning into a guest.
 * `unavailable`: still signed in, GoodWatch just couldn't renew the session right now.
 */
export interface DeviceAccount {
  state: 'member' | 'lapsed' | 'guest';
  displayName: string | null;
  unavailable: boolean;
}

/** What the server says, read against the name this device remembers from its last sign-in. */
export function accountView(status: AccountStatus, rememberedName: string | null): DeviceAccount {
  if (status.state === 'member') return { state: 'member', displayName: status.displayName, unavailable: status.unavailable === true };
  if (rememberedName !== null) return { state: 'lapsed', displayName: rememberedName || null, unavailable: false };
  return { state: 'guest', displayName: null, unavailable: false };
}

/**
 * One GoodWatch sign-in at a time for the whole app: every Continue with GoodWatch (start page, Join,
 * Profile, a room) shares it, so a double press can't start a second flow that overwrites the first
 * one's intent and verifier. `generation` moves whenever the device's sign-in changes.
 */
export function createAccountFlow() {
  let state = { pending: false, generation: 0 };
  let running: Promise<unknown> | null = null;
  const listeners = new Set<() => void>();
  const set = (next: Partial<typeof state>) => {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };
  return {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    signIn<T>(start: () => Promise<T>): Promise<T> {
      if (running) return running as Promise<T>;
      set({ pending: true });
      const result = (async () => start())().finally(() => {
        running = null;
        set({ pending: false });
      });
      running = result;
      return result;
    },
    bump() { set({ generation: state.generation + 1 }); },
  };
}
export const accountFlow = createAccountFlow();

/**
 * Which device sign-in is current. It moves before Log out and before a new sign-in replaces the
 * session, so an account or room-link answer that was asked under an earlier sign-in can't write its
 * session, name or hint back over the newer state. Listeners cancel the account queries in flight.
 */
export function createAuthEpoch() {
  let value = 0;
  const listeners = new Set<() => void>();
  return {
    current: () => value,
    isCurrent: (epoch: number) => epoch === value,
    advance() {
      value++;
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
export type AuthEpoch = ReturnType<typeof createAuthEpoch>;
export const authEpoch = createAuthEpoch();
