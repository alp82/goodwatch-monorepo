#!/usr/bin/env node
// Run against an isolated install of the exact packages, without contacting services:
// node probe-storage.mjs /path/to/isolated-install
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.resolve(process.argv[2], 'package.json'));
const { betterAuth } = await import(require.resolve('better-auth'));
const { memoryAdapter } = await import(require.resolve('better-auth/adapters/memory'));
const { jwt } = await import(require.resolve('better-auth/plugins'));
const { mcp } = await import(require.resolve('@better-auth/mcp'));
const { redisStorage } = await import(require.resolve('@better-auth/redis-storage'));
for (const name of ['better-auth', '@better-auth/core', '@better-auth/mcp', '@better-auth/oauth-provider', '@better-auth/cimd', '@better-auth/redis-storage']) {
  let directory = path.dirname(require.resolve(name));
  while (!require('node:fs').existsSync(path.join(directory, 'package.json'))) directory = path.dirname(directory);
  assert.equal(JSON.parse(require('node:fs').readFileSync(path.join(directory, 'package.json'), 'utf8')).version, '1.7.7');
}
function cache() {
  const values = new Map();
  let error = false;
  return { values, fail: () => { error = true; }, storage: {
    get(key) { if (error) throw new Error('probe cache unavailable'); return values.get(key) ?? null; },
    getAndDelete(key) { const value = values.get(key); values.delete(key); return value ?? null; },
    increment(key) { const value = Number(values.get(key) ?? 0) + 1; values.set(key, value); return value; },
    set(key, value) { values.set(key, value); }, delete(key) { values.delete(key); },
  } };
}
function setup(session, plugins = []) {
  const store = cache();
  const database = { user: [], account: [], session: [], verification: [], jwks: [], oauthClient: [],
    oauthResource: [], oauthClientResource: [], oauthAccessToken: [], oauthRefreshToken: [], oauthConsent: [], oauthClientAssertion: [] };
  const auth = betterAuth({ baseURL: 'http://localhost:3000', secret: 'inventory-probe-secret-long-enough-for-test', logger: { disabled: true },
    database: memoryAdapter(database), secondaryStorage: store.storage, session,
    emailAndPassword: { enabled: true }, plugins });
  return { auth, store, database };
}
const signUp = auth => auth.api.signUpEmail({ body: { name: 'Probe', email: 'probe@example.com', password: 'probe-password-strong' } });
const results = [];
{
  const { auth, store, database } = setup({ storeSessionInDatabase: true });
  const created = await signUp(auth);
  const { internalAdapter } = await auth.$context;
  assert.equal(database.session.length, 1);
  store.values.clear();
  assert.equal((await internalAdapter.findSession(created.token)).user.id, created.user.id);
  assert.equal(store.values.size, 0); // The read does not warm the cache.
  assert.deepEqual(await internalAdapter.listSessions(created.user.id), []);
  assert.deepEqual(await internalAdapter.findSessions([created.token]), []);
  await internalAdapter.updateSession(created.token, { expiresAt: new Date(Date.now() + 60_000) });
  assert.equal(store.values.size, 0); // Refresh also does not reconstruct a missing cache entry.
  store.values.set(created.token, '{malformed');
  assert.equal(await internalAdapter.findSession(created.token), null);
  store.fail();
  await assert.rejects(() => internalAdapter.findSession(created.token), /probe cache unavailable/);
  results.push('DB-backed session: missing key falls back; no cache warming; list/batch read misses remain empty; malformed key returns null; get error propagates');
}
{
  const { auth, store, database } = setup({ storeSessionInDatabase: true });
  const created = await signUp(auth);
  const { internalAdapter } = await auth.$context;
  store.values.delete(`active-sessions-${created.user.id}`);
  await internalAdapter.deleteUserSessions(created.user.id);
  assert.equal(database.session.length, 0);
  assert.ok(store.values.has(created.token));
  assert.ok(await internalAdapter.findSession(created.token));
  results.push('Missing active-session index: revoke-all deletes DB sessions but leaves a surviving cached token accepted');
}
{
  const { auth, store } = setup({ storeSessionInDatabase: true, preserveSessionInDatabase: true });
  const created = await signUp(auth);
  store.values.clear();
  assert.equal(await (await auth.$context).internalAdapter.findSession(created.token), null);
  results.push('Preserved session: missing key does not fall back');
}
{
  const { auth } = setup({ storeSessionInDatabase: false }, [jwt(), mcp({ loginPage: '/login', consentPage: '/consent', resource: 'https://goodwatch.app/mcp' })]);
  await assert.rejects(() => auth.$context, /requires `session.storeSessionInDatabase: true`/);
  results.push('MCP/OAuth provider rejects secondary storage without database sessions');
}
{
  const calls = [];
  const client = { get: async (...args) => { calls.push(['get', ...args]); return null; },
    call: async (...args) => { calls.push(['call', ...args]); return 'value'; },
    eval: async (...args) => { calls.push(['eval', args[1], ...args.slice(2)]); return 1; },
    setex: async (...args) => calls.push(['setex', ...args]), set: async (...args) => calls.push(['set', ...args]),
    del: async (...args) => calls.push(['del', ...args]) };
  const storage = redisStorage({ client, keyPrefix: 'gw:auth:' });
  await storage.get('session'); await storage.getAndDelete('verification:code');
  await storage.increment('rate', 10); await storage.set('session', 'value', 60); await storage.delete('session');
  assert.deepEqual(calls, [['get', 'gw:auth:session'], ['call', 'GETDEL', 'gw:auth:verification:code'],
    ['eval', 1, 'gw:auth:rate', 10], ['setex', 'gw:auth:session', 60, 'value'], ['del', 'gw:auth:session']]);
  await assert.rejects(() => storage.increment('rate', 0), /positive integer/);
  results.push('Redis command recorder: required operations each use one prefixed key; increment rejects ttl=0 (no Redis server used)');
}
console.log(JSON.stringify({ packages: '1.7.7', verification: 'In-process memory adapter and command recorder; no CrateDB, Valkey or external client', passed: results }, null, 2));
