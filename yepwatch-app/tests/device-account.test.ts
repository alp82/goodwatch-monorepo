import assert from 'node:assert/strict';
import test from 'node:test';
import type { AccountStatus, MemberStatusResponse } from '@goodwatch/yepwatch-contracts/proposal';
import { createAuthEpoch, type DeviceAccount } from '../src/core/continuous/account-flow';
import { createDeviceAccount } from '../src/core/continuous/device-account';
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
  });
  /** What finishAccount does when a sign-in completes: a new account replaces the device session. */
  const finishSignIn = async (session: string, status: Status) => {
    epoch.advance();
    store.session = session;
    await account.signedIn(status);
  };
  return { account, store, accountCalls, linkCalls, finishSignIn, cached: () => cached, cancels: () => cancels, hint: () => hint };
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
