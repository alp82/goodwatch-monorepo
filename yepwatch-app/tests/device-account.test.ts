import assert from 'node:assert/strict';
import test from 'node:test';
import type { AccountStatus, MemberStatusResponse } from '@goodwatch/yepwatch-contracts/proposal';
import { createAuthEpoch, type DeviceAccount } from '../src/core/continuous/account-flow';
import { createDeviceAccount, settleLogoutRooms, withoutAccount } from '../src/core/continuous/device-account';
import { continuousFixture } from './continuous-fixture';
import { linkOutcome } from '../src/features/room/link-gate';

type Status = AccountStatus;
type Link = MemberStatusResponse & { session?: string };
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

/** A native device with an in-memory secure store, a scripted API and a fake query cache. */
function device(start: { session: string | null; name: string | null }) {
  const store = { ...start };
  let hint = start.session !== null;
  let cached: DeviceAccount | undefined;
  let cancels = 0;
  /** Each call: did the account read as guest and had the epoch already moved when room caches were scrubbed? */
  const scrubs: { guest: boolean; epoch: number }[] = [];
  const accountCalls: { session: string | null | undefined; reply: ReturnType<typeof deferred<Status>> }[] = [];
  const linkCalls: { session: string | null | undefined; reply: ReturnType<typeof deferred<Link>> }[] = [];
  const epoch = createAuthEpoch();
  epoch.subscribe(() => { cancels++; });
  const account = createDeviceAccount({
    guestOnly: false,
    nativeClient: true,
    epoch,
    api: {
      account(session) { const reply = deferred<Status>(); accountCalls.push({ session, reply }); return reply.promise; },
      memberLink(_access, session) { const reply = deferred<Link>(); linkCalls.push({ session, reply }); return reply.promise; },
      async accountLogout() { return { state: 'guest', displayName: null }; },
    },
    store: {
      async readSession() { return store.session; },
      async saveSession(s) { store.session = s; },
      async clearSession() { store.session = null; },
      async readMemberName() { return store.name; },
      async rememberMemberName(n) { store.name = n; },
      async forgetMemberName() { store.name = null; },
    },
    hint: { has: () => hint, remember: () => { hint = true; }, forget: () => { hint = false; } },
    cache: { get: () => cached, set: (a) => { cached = a; } },
    bump() {},
    unsupported: () => false,
    forgetAccount() { scrubs.push({ guest: cached?.state === 'guest', epoch: epoch.current() }); },
  });
  /** What finishAccount does when a sign-in completes: a new account replaces the device session. */
  const finishSignIn = async (session: string, status: Status) => {
    epoch.advance();
    store.session = session;
    await account.signedIn(status);
  };
  return { account, store, accountCalls, linkCalls, finishSignIn, cached: () => cached, cancels: () => cancels, hint: () => hint, scrubs, epoch };
}

test('a delayed account answer for Alice after Log out changes nothing: no name, no session, no lapsed Alice', async () => {
  const d = device({ session: 'alice-1', name: 'Alice' });
  const stale = d.account.load();
  await tick();
  assert.equal(d.accountCalls.length, 1);
  await d.account.signOut();
  assert.ok(d.cancels() > 0, 'Log out cancels the account query in flight');
  d.accountCalls[0].reply.resolve({ state: 'member', displayName: 'Alice', session: 'alice-2' });
  const view = await stale;
  assert.deepEqual(view, { state: 'guest', displayName: null, unavailable: false }, 'the stale load reads the signed-out device again');
  assert.equal(d.store.session, null, 'the renewed session is not written back');
  assert.equal(d.store.name, null, 'the name is not remembered again');
  assert.equal(d.hint(), false);
  // The next look at the device is a plain guest, not "lapsed Alice".
  assert.deepEqual(await d.account.load(), { state: 'guest', displayName: null, unavailable: false });
});

test('a delayed account answer for Alice after signing in as Bob does not overwrite Bob', async () => {
  const d = device({ session: 'alice-1', name: 'Alice' });
  const stale = d.account.load();
  await tick();
  await d.finishSignIn('bob-1', { state: 'member', displayName: 'Bob' });
  assert.equal(d.store.name, 'Bob');
  d.accountCalls[0].reply.resolve({ state: 'member', displayName: 'Alice', session: 'alice-2' });
  await tick();
  assert.equal(d.store.session, 'bob-1', 'Alice’s renewed session is dropped');
  assert.equal(d.store.name, 'Bob');
  // The stale load asks again with Bob's session and settles on Bob.
  assert.equal(d.accountCalls[1]?.session, 'bob-1');
  d.accountCalls[1].reply.resolve({ state: 'member', displayName: 'Bob' });
  assert.deepEqual(await stale, { state: 'member', displayName: 'Bob', unavailable: false });
  assert.equal(d.store.name, 'Bob');
});

test('a delayed guest answer for Alice after signing in as Bob does not clear Bob’s session', async () => {
  const d = device({ session: 'alice-1', name: 'Alice' });
  const stale = d.account.load();
  await tick();
  await d.finishSignIn('bob-1', { state: 'member', displayName: 'Bob' });
  d.accountCalls[0].reply.resolve({ state: 'guest', displayName: null });
  await tick();
  assert.equal(d.store.session, 'bob-1');
  d.accountCalls[1].reply.resolve({ state: 'member', displayName: 'Bob' });
  await stale;
  assert.equal(d.store.session, 'bob-1');
});

test('a renewed session from a room link that answers after Log out or a switch is not kept', async () => {
  const d = device({ session: 'alice-1', name: 'Alice' });
  const access = { roomId: 'r1', participantId: 'p1', token: 't' } as never;
  const afterLogout = d.account.linkRoom(access);
  await tick();
  assert.equal(d.linkCalls[0].session, 'alice-1');
  await d.account.signOut();
  d.linkCalls[0].reply.resolve({ state: 'linked', prefill: null, session: 'alice-2' } as Link);
  await afterLogout;
  assert.equal(d.store.session, null);

  await d.finishSignIn('bob-1', { state: 'member', displayName: 'Bob' });
  const beforeSwitch = d.account.linkRoom(access);
  await tick();
  await d.finishSignIn('carol-1', { state: 'member', displayName: 'Carol' });
  d.linkCalls[1].reply.resolve({ state: 'linked', prefill: null, session: 'bob-2' } as Link);
  await beforeSwitch;
  assert.equal(d.store.session, 'carol-1');

  // A current renewal is still kept.
  const current = d.account.linkRoom(access);
  await tick();
  d.linkCalls[2].reply.resolve({ state: 'linked', prefill: null, session: 'carol-2' } as Link);
  await current;
  assert.equal(d.store.session, 'carol-2');
});

test('a load that starts while Log out is still running does not bring the account back', async () => {
  const d = device({ session: 'alice-1', name: 'Alice' });
  const out = d.account.signOut();
  const during = d.account.load();
  await out;
  for (const call of d.accountCalls) call.reply.resolve({ state: 'member', displayName: 'Alice', session: 'alice-2' });
  await tick();
  for (const call of d.accountCalls) call.reply.resolve({ state: 'member', displayName: 'Alice', session: 'alice-2' });
  assert.deepEqual(await during, { state: 'guest', displayName: null, unavailable: false });
  assert.equal(d.store.session, null);
  assert.equal(d.store.name, null);
});

test('a room link GoodWatch can’t verify yet keeps the renewed session and counts as a transient failure, not linked', async () => {
  const d = device({ session: 'alice-1', name: 'Alice' });
  const access = { roomId: 'r1', participantId: 'p1', token: 't' } as never;
  const pending = d.account.linkRoom(access);
  await tick();
  d.linkCalls[0].reply.resolve({ state: 'unavailable', prefill: null, session: 'alice-2' });
  await assert.rejects(pending, (e: unknown) => linkOutcome(e) === 'transient');
  assert.equal(d.store.session, 'alice-2', 'rotated credentials are kept');
});

test('Log out scrubs account data from the room caches at once, in the same tick the sign-in ends', async () => {
  const d = device({ session: 'alice-1', name: 'Alice' });
  const out = d.account.signOut();
  // Synchronously, before Log out's request has gone anywhere.
  assert.deepEqual(d.scrubs, [{ guest: true, epoch: 1 }]);
  await out;
});

test('a room without the account keeps the seat and drops the GoodWatch link, prefill and seen titles', () => {
  const s = continuousFixture();
  s.own.showSeen = true;
  s.own.member = { state: 'linked', prefill: { country: 'DE', serviceIds: [8], savedProgressAvailable: true } };
  const guest = withoutAccount({ ...s, ownRevision: 3 });
  assert.deepEqual(guest.own.member, { state: 'guest', prefill: null });
  assert.equal(guest.own.showSeen, false);
  assert.equal(guest.ownRevision, 3);
  assert.deepEqual(guest.own.votes, s.own.votes);
  assert.equal(guest.shared, s.shared);
});

test('Log out keeps every room the server kept, even ones Your rooms never loaded', async () => {
  const remembered: string[] = [], forgotten: string[] = [];
  const registry = {
    remember: async (e: { roomId: string; nickname: string; expiresAt: number }) => { remembered.push(`${e.roomId}:${e.nickname}:${e.expiresAt}`); },
    forget: async (id: string) => { forgotten.push(id); },
  };
  await settleLogoutRooms([{ roomId: 'shown', nickname: 'Al', expiresAt: 5 }, { roomId: 'gone', nickname: 'Al', expiresAt: 5 }],
    { keptRooms: [{ roomId: 'shown', nickname: 'Al', expiresAt: 5 }, { roomId: 'unloaded', nickname: 'Alp', expiresAt: 9 }] }, registry);
  assert.ok(remembered.includes('unloaded:Alp:9'), 'a room Your rooms never loaded goes on the device list');
  assert.ok(remembered.includes('shown:Al:5'));
  assert.deepEqual(forgotten, ['gone'], 'a room another device of the account keeps leaves the list');
  // An older server without keptRooms: the rooms already on screen stay.
  forgotten.length = 0;
  await settleLogoutRooms([{ roomId: 'shown', nickname: 'Al', expiresAt: 5 }], { state: 'guest' }, registry);
  assert.deepEqual(forgotten, []);
});

test('a room answer that comes while Log out runs is refused, and the rooms are scrubbed again once the session is gone', async () => {
  // The real auth epoch and API client: the room refresh Log out's epoch move starts answers before the
  // server has ended the sign-in, still carrying the account's prefill.
  const { authEpoch } = await import('../src/core/continuous/account-flow');
  const { ContinuousApi } = await import('../src/core/continuous/api-client');
  const store = { session: 'alice-1' as string | null, name: 'Alice' as string | null };
  const logout = deferred<unknown>();
  const scrubs: (string | null)[] = [];
  const account = createDeviceAccount({
    guestOnly: false, nativeClient: true, epoch: authEpoch,
    api: { account: async () => ({ state: 'guest', displayName: null }), memberLink: async () => ({ state: 'guest', prefill: null }), accountLogout: () => logout.promise },
    store: {
      async readSession() { return store.session; }, async saveSession(s) { store.session = s; }, async clearSession() { store.session = null; },
      async readMemberName() { return store.name; }, async rememberMemberName(n) { store.name = n; }, async forgetMemberName() { store.name = null; },
    },
    hint: { has: () => true, remember() {}, forget() {} },
    cache: { get: () => undefined, set() {} },
    bump() {}, unsupported: () => false,
    forgetAccount() { scrubs.push(store.session); },
  });
  let finish!: (response: Response) => void;
  const client = new ContinuousApi((() => new Promise<Response>(resolve => { finish = resolve; })) as typeof fetch, true,
    { read: async () => store.session, save: async () => undefined });
  const out = account.signOut();
  // The refresh starts after the epoch moved and answers before Log out does.
  const reading = client.snapshot({ roomId: 'room', participantId: 'alex', token: 'room-capability', expiresAt: 1 });
  await tick();
  finish(Response.json({ shared: {}, own: { member: { state: 'linked', prefill: { country: 'DE', serviceIds: [8], savedProgressAvailable: true } } } }));
  await assert.rejects(reading, (e: Error & { code?: string }) => e.code === 'outcome_unknown', 'the member answer is not applied');
  logout.resolve({ state: 'guest', displayName: null });
  await out;
  assert.equal(scrubs.at(-1), null, 'the last scrub runs after the session is cleared, before the fresh reads');
});
