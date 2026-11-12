import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '@goodwatch/yepwatch-contracts/proposal';
import { EARLY_INVITE_MAX_AGE_MS, takeEarlyInvite, type EarlyInvite } from '../src/core/continuous/early-invite-core';

const ORIGIN = 'https://yepwatch.com';
const post = (code: string, signal?: AbortSignal): RequestInit => ({ method: 'POST', body: JSON.stringify({ code }), signal });
const never = () => Promise.reject(new Error('fetcher must not run'));
const early = (answers: Partial<Record<string, Promise<Response>>>, at = 1000): EarlyInvite => ({ code: 'T8TBD4', at, requests: { ...answers } });

test('the page asks for the same paths the app asks for', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'invite-page.cjs'), 'utf8');
  const listed = JSON.parse(/const EARLY_INVITE_PATHS = (\[[^\]]+\])/.exec(script)![1].replace(/'/g, '"'));
  assert.deepEqual(listed, [paths.invitePreview, paths.resolveInvite]);
});

test('the app\'s first request for the invitation takes the page\'s answer, once', async () => {
  const answer = Response.json({ roomId: 'room' });
  const e = early({ [paths.resolveInvite]: Promise.resolve(answer) });
  const taken = takeEarlyInvite(e, ORIGIN, 2000, `${ORIGIN}${paths.resolveInvite}`, post('T8TBD4'), never);
  assert.equal(await taken, answer);
  assert.equal(takeEarlyInvite(e, ORIGIN, 2000, `${ORIGIN}${paths.resolveInvite}`, post('T8TBD4'), never), null);
});

test('another code, path, origin, an old answer or no page answer asks the server itself', () => {
  const answers = () => early({ [paths.resolveInvite]: Promise.resolve(Response.json({})) });
  assert.equal(takeEarlyInvite(answers(), ORIGIN, 2000, `${ORIGIN}${paths.resolveInvite}`, post('OTHER1'), never), null);
  assert.equal(takeEarlyInvite(answers(), ORIGIN, 2000, `${ORIGIN}${paths.invitePreview}`, post('T8TBD4'), never), null);
  assert.equal(takeEarlyInvite(answers(), ORIGIN, 2000, `https://elsewhere.example${paths.resolveInvite}`, post('T8TBD4'), never), null);
  assert.equal(takeEarlyInvite(answers(), ORIGIN, 1000 + EARLY_INVITE_MAX_AGE_MS + 1, `${ORIGIN}${paths.resolveInvite}`, post('T8TBD4'), never), null);
  assert.equal(takeEarlyInvite(answers(), ORIGIN, 2000, `${ORIGIN}${paths.resolveInvite}`, { method: 'GET' }, never), null);
  assert.equal(takeEarlyInvite(undefined, ORIGIN, 2000, `${ORIGIN}${paths.resolveInvite}`, post('T8TBD4'), never), null);
});

test('a page request that failed goes out again; the caller\'s abort ends the wait', async () => {
  const again = Response.json({ roomId: 'again' });
  let asked = 0;
  const failed = early({ [paths.invitePreview]: Promise.reject(new TypeError('Failed to fetch')) });
  const retried = takeEarlyInvite(failed, ORIGIN, 2000, `${ORIGIN}${paths.invitePreview}`, post('T8TBD4'), async () => { asked++; return again; });
  assert.equal(await retried, again);
  assert.equal(asked, 1);

  const controller = new AbortController();
  const pending = early({ [paths.invitePreview]: new Promise<Response>(() => {}) });
  const waiting = takeEarlyInvite(pending, ORIGIN, 2000, `${ORIGIN}${paths.invitePreview}`, post('T8TBD4', controller.signal), never)!;
  controller.abort();
  await assert.rejects(waiting);
});
