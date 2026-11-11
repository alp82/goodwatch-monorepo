import type { AccountStatus, MemberStatusResponse } from '@goodwatch/yepwatch-contracts/proposal';
import type { RoomAccess } from '../credentials';
import { RoomFailure } from './api-client';
import { accountView, type AuthEpoch, type DeviceAccount } from './account-flow';

export interface DeviceAccountDeps {
  guestOnly: boolean;
  nativeClient: boolean;
  epoch: AuthEpoch;
  api: {
    account(session: string | null): Promise<AccountStatus>;
    memberLink(access: RoomAccess, session: string | null): Promise<MemberStatusResponse & { session?: string }>;
    accountLogout(session?: string | null): Promise<unknown>;
  };
  store: {
    readSession(): Promise<string | null>;
    saveSession(session: string): Promise<unknown>;
    clearSession(): Promise<unknown>;
    readMemberName(): Promise<string | null>;
    rememberMemberName(name: string): Promise<unknown>;
    forgetMemberName(): Promise<unknown>;
  };
  hint: { has(): boolean; remember(): void; forget(): void };
  cache: { get(): DeviceAccount | undefined; set(account: DeviceAccount): void };
  /** The device's sign-in changed: rooms try linking again. */
  bump(): void;
  /** This API has no account endpoint (older server): the device stays a guest. */
  unsupported(error: unknown): boolean;
}

const guestStatus: AccountStatus = { state: 'guest', displayName: null };
export const guestAccount: DeviceAccount = accountView(guestStatus, null);

/** The answer was asked under an earlier sign-in (Log out or another account came in between). */
class Outdated extends Error {}

/**
 * This device's GoodWatch sign-in, kept in its session store and read by the account query. Every
 * answer is checked against the auth epoch it was asked under before anything is written.
 */
export function createDeviceAccount(deps: DeviceAccountDeps) {
  const { epoch, store } = deps;
  /** Runs a write only while `asked` is still the current sign-in. */
  const write = async (asked: number, run: () => unknown) => {
    if (!epoch.isCurrent(asked)) throw new Outdated();
    await run();
  };
  const settle = (next: DeviceAccount) => {
    const previous = deps.cache.get();
    if (previous && previous.state !== next.state) deps.bump();
    return next;
  };

  async function readOnce(asked: number): Promise<DeviceAccount> {
    const [session, remembered] = await Promise.all([store.readSession(), store.readMemberName()]);
    if (!epoch.isCurrent(asked)) throw new Outdated();
    // The app knows it has no session without asking. A browser's session is an HttpOnly cookie: a
    // browser that never signed in here (no hint) doesn't ask either, so a first visit makes no request.
    if (deps.nativeClient ? !session : !deps.hint.has()) return settle(accountView(guestStatus, remembered));
    let status: AccountStatus;
    try { status = await deps.api.account(session); }
    catch (e) {
      if (!epoch.isCurrent(asked)) throw new Outdated();
      if (deps.unsupported(e)) return guestAccount;
      throw e;
    }
    if (status.session) await write(asked, () => store.saveSession(status.session!));
    if (status.state === 'guest' && session) await write(asked, () => store.clearSession());
    if (status.state === 'member') {
      await write(asked, () => deps.hint.remember());
      await write(asked, () => store.rememberMemberName(status.displayName ?? ''));
    } else if (remembered === null) await write(asked, () => deps.hint.forget());
    if (!epoch.isCurrent(asked)) throw new Outdated();
    return settle(accountView(status, remembered));
  }

  return {
    /** The account query: what this device's sign-in is now. An outdated answer reads the device again. */
    async load(): Promise<DeviceAccount> {
      if (deps.guestOnly) return guestAccount;
      for (;;) {
        try { return await readOnce(epoch.current()); }
        catch (e) { if (!(e instanceof Outdated)) throw e; }
      }
    },
    /** A sign-in that just completed on this device (its session is already saved under a new epoch). */
    async signedIn(status: AccountStatus) {
      await store.rememberMemberName(status.displayName ?? '');
      deps.cache.set(accountView(status, null));
      deps.bump();
    },
    /** Links your participant in a room to this device's sign-in; keeps a renewed session only if still current. */
    async linkRoom(access: RoomAccess): Promise<MemberStatusResponse> {
      const asked = epoch.current();
      const result = await deps.api.memberLink(access, await store.readSession());
      if (result.session && epoch.isCurrent(asked)) await store.saveSession(result.session);
      // GoodWatch couldn't confirm who the renewed session belongs to yet: try again shortly.
      if (result.state === 'unavailable') throw new RoomFailure('busy', 'GoodWatch is temporarily unavailable', 503, undefined, undefined, true);
      return { state: result.state, prefill: result.prefill };
    },
    /**
     * Ends this device's GoodWatch sign-in. The epoch moves before (answers in flight are outdated)
     * and after (a read that started during Log out saw the old session) the session is cleared.
     */
    async signOut() {
      // Guest at once, before the epoch moves: its listeners drop the account reads, and nothing may read
      // them again as a member while the session ends (account home would only answer 403). A failed
      // Log out puts the sign-in back.
      const before = deps.cache.get();
      deps.cache.set(guestAccount);
      epoch.advance();
      let result: unknown;
      try {
        result = await deps.api.accountLogout(await store.readSession());
        await store.clearSession();
        await store.forgetMemberName();
        deps.hint.forget();
      } catch (e) {
        if (before) deps.cache.set(before);
        throw e;
      } finally {
        epoch.advance();
      }
      deps.bump();
      return result;
    },
  };
}
