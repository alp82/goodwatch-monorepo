import test from 'node:test';
import assert from 'node:assert/strict';
import { ContinuousApi } from '../src/core/continuous/api-client';
import { authEpoch } from '../src/core/continuous/account-flow';
import { sessionCommandStorage } from '../src/core/continuous/command-storage';

test('native room requests carry the current account session and preserve a renewed session from an error response', async () => {
  let kept = '', requestHeaders: Record<string, string> = {};
  const client = new ContinuousApi((async (_url, init) => {
    requestHeaders = init?.headers as Record<string, string>;
    return Response.json({ error: { code: 'busy', message: 'GoodWatch is temporarily unavailable', retryable: true } }, { status: 503, headers: { 'x-yepwatch-session': 'rotated-session' } });
  }) as typeof fetch, true, { read: async () => 'phone-login', save: async value => { kept = value; } });
  await assert.rejects(client.snapshot({ roomId: 'room', participantId: 'alex', token: 'room-capability', expiresAt: 1 }));
  assert.equal(requestHeaders['x-yepwatch-member'], 'phone-login');
  assert.equal(requestHeaders.Authorization, 'Bearer room-capability');
  assert.equal(kept, 'rotated-session');
});

test('a delayed room-session renewal cannot replace a different account sign-in', async () => {
  let finish!: (response: Response) => void, kept = '';
  const client = new ContinuousApi((() => new Promise<Response>(resolve => { finish = resolve; })) as typeof fetch, true,
    { read: async () => 'old-login', save: async value => { kept = value; } });
  const reading = client.accountHome();
  await new Promise(resolve => setTimeout(resolve, 0));
  authEpoch.advance();
  finish(Response.json({ rooms: [], decisions: [] }, { headers: { 'x-yepwatch-session': 'old-rotated-login' } }));
  await assert.rejects(reading, error => error instanceof Error && error.message.includes('Sign-in changed'));
  assert.equal(kept, '');
});

test('pending commands and their clear operations stay in the credential session that created them', async () => {
  const writes: (string | undefined)[] = [];
  const storage = sessionCommandStorage('room', async (_room, _command, _retry, session) => { writes.push(session); });
  storage.useSession('phone-session');
  await storage.write({ commandId: 'vote', sequence: 1, command: { type: 'leave' } });
  await storage.write(null);
  storage.useSession('another-account-session');
  await storage.write(null);
  assert.deepEqual(writes, ['phone-session', 'phone-session', 'another-account-session']);
});

test('only native room creation sends the persistent installation identifier', async () => {
  const calls: Record<string, string>[] = [];
  let reads = 0;
  const fetcher = (async (_url, init) => {
    calls.push(init?.headers as Record<string, string>);
    return Response.json({});
  }) as typeof fetch;
  const creators = { read: async () => { reads++; return 'a'.repeat(64); } };
  const native = new ContinuousApi(fetcher, true, undefined, creators);
  const rooms = '/api/yepwatch/v1/proposal/rooms';
  await native.request(rooms, { commandId: 'first' });
  await native.request(rooms, { commandId: 'second' });
  await native.request(rooms + '/friend/join', { commandId: 'join' });
  await native.request(rooms + '/mine');
  await new ContinuousApi(fetcher, false, undefined, creators).request(rooms, { commandId: 'web' });
  assert.equal(reads, 2);
  assert.equal(calls[0]['X-YepWatch-Creator'], 'a'.repeat(64));
  assert.equal(calls[1]['X-YepWatch-Creator'], calls[0]['X-YepWatch-Creator']);
  for (const headers of calls.slice(2)) assert.equal(headers['X-YepWatch-Creator'], undefined);
});
