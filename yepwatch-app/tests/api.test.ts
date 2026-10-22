import test from 'node:test';
import assert from 'node:assert/strict';
import { YepApi } from '../src/core/api-client';
import { ApiFailure } from '../src/core/errors';
import { createServer } from 'node:http';
const access = { roomId: 'r', participantId: 'p', token: 'native-secret', expiresAt: 999 };
test('native API credential headers, cookie browser flow and namespace stay separate', async () => {
  const calls: { url: string; options?: RequestInit }[] = [];
  const fetcher = (async (input, options) => { calls.push({ url: String(input), options }); return Response.json({}); }) as typeof fetch;
  await new YepApi(fetcher, true).snapshot(access);
  assert.equal((calls[0].options?.headers as Record<string, string>).Authorization, 'Bearer native-secret');
  assert.equal((calls[0].options?.headers as Record<string, string>)['X-YepWatch-Participant'], 'p');
  await new YepApi(fetcher, false).snapshot(access);
  assert.equal((calls[1].options?.headers as Record<string, string>).Authorization, undefined);
  assert.equal(calls[1].options?.credentials, 'include'); assert.ok(calls[1].url.includes('/api/yepwatch/v1/rooms/r'));
});
test('network failure leaves write outcome unknown and preserves server conflict snapshots', async () => {
  const network = new YepApi((async () => { throw new Error('Network'); }) as typeof fetch);
  await assert.rejects(network.request('/api/yepwatch/v1/rooms', {}), e => e instanceof ApiFailure && e.code === 'outcome_unknown');
  const api = new YepApi((async () => Response.json({ error: { code: 'conflict', message: 'Changed', retryable: false } }, { status: 409 })) as typeof fetch);
  await assert.rejects(api.snapshot(access), e => e instanceof ApiFailure && e.code === 'conflict');
});
test('the deadline covers a real response that flushes headers then stalls its body', async () => {
  const server = createServer((_request, response) => { response.writeHead(200, { 'content-type': 'application/json' }); response.flushHeaders(); response.write('{'); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const original = globalThis.setTimeout;
  globalThis.setTimeout = ((callback: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) => original(callback, ms === 15000 ? 30 : ms, ...args)) as typeof setTimeout;
  let settled = false;
  const request = new YepApi((_url, init) => fetch(`http://127.0.0.1:${address.port}/`, init)).request('/api/yepwatch/v1/rooms', {}).catch(error => { assert.ok(error instanceof ApiFailure); assert.equal(error.code, 'outcome_unknown'); }).finally(() => { settled = true; });
  await new Promise(resolve => original(resolve, 120)); const result = settled;
  server.closeAllConnections(); await request; await new Promise<void>(resolve => server.close(() => resolve())); globalThis.setTimeout = original;
  assert.equal(result, true);
});
test('structured public recovery details survive the HTTP adapter', async () => {
  const details = { type: 'access', reason: 'member_auth_unavailable', actions: ['use_guest_modes'] };
  const api = new YepApi((async () => Response.json({ error: { code: 'member_required', message: 'Sign in required', retryable: false, details } }, { status: 403 })) as typeof fetch);
  await assert.rejects(api.snapshot(access), e => e instanceof ApiFailure && e.code === 'member_required' && JSON.stringify(e.details) === JSON.stringify(details));
});
