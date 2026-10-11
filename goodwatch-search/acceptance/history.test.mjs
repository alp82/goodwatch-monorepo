import assert from 'node:assert/strict';
import test from 'node:test';
import { createCipheriv, randomBytes } from 'node:crypto';
import { summarize, authenticates, percentile } from './history.mjs';
const start = '2026-10-11T12:00:00.000Z', end = '2026-10-18T12:00:00.000Z';
const options = { start, end, now: end };
const row = (overrides = {}) => ({ created_at: Date.parse(start) + 1, ciphertext: 'test', elapsed_ms: 1800, outcome: 'ready', reason: null, ranker_version: 'hybrid-v2', ranker_fallback: null, stage_ms: { firstResults: 210, total: 1800 }, ...overrides });
test('first delivery controls threshold while completion remains separate and needs error corroboration', () => {
  const r = summarize([row()], options);
  assert.equal(r.history_acceptance_pass, true);
  assert.equal(r.first_results.p95_nearest_rank_ms, 210);
  assert.equal(r.full_completion.p95_nearest_rank_ms, 1800);
  assert.equal(r.seven_day_acceptance_pass, false);
});
test('missing firstResults must fail, never substitute historical total', () => {
  const r = summarize([row({ elapsed_ms: 100, stage_ms: { total: 100 } })], options);
  assert.equal(r.history_acceptance_pass, false);
  assert.equal(r.missing_first_results_rows, 1);
  assert.equal(r.first_results.n, 0);
});
test('delivered aborted searches contribute their slow first result without a fullcompletion sample', () => {
  const r = summarize([row(), row({ stage_ms: { firstResults: 1600, completionAborted: 1 } })], options);
  assert.equal(r.first_results.p95_nearest_rank_ms, 1600);
  assert.equal(r.full_completion.n, 1);
  assert.equal(r.completion_aborted_rows, 1);
  assert.equal(r.history_acceptance_pass, false);
});
test('late failure and ranker fallback independently block acceptance', () => {
  assert.equal(summarize([row({ stage_ms: { firstResults: 100, completionFailed: 1 } })], options).history_acceptance_pass, false);
  assert.equal(summarize([row({ ranker_fallback: 'timeout' })], options).history_acceptance_pass, false);
  assert.equal(summarize([row({ reason: 'provider_failed' })], options).history_acceptance_pass, false);
});
test('requires finished full seven-day interval, nonempty rows and complete extraction', () => {
  assert.equal(summarize([row()], { ...options, now: start }).history_acceptance_pass, false);
  assert.equal(summarize([row()], { ...options, end: '2026-10-12T12:00:00Z' }).history_acceptance_pass, false);
  assert.equal(summarize([], options).history_acceptance_pass, false);
  assert.equal(summarize([row()], { ...options, sourceCount: 2 }).history_acceptance_pass, false);
});
test('nearest rank p95 is exact with ties and 20 samples', () => {
  assert.equal(percentile(Array.from({ length: 20 }, (_, i) => i + 1), .95), 19);
  assert.equal(percentile([], .95), null);
});
test('AES authentication rejects foreign or corrupted rows without decrypting into reports', () => {
  const key = randomBytes(32), iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  const payload = Buffer.concat([cipher.update('private query and account'), cipher.final()]);
  const text = Buffer.concat([iv, cipher.getAuthTag(), payload]).toString('base64');
  assert.equal(authenticates(text, key), true);
  assert.equal(authenticates(text, randomBytes(32)), false);
  assert.equal(authenticates('broken', key), false);
  const r = summarize([row({ ciphertext: text }), row({ ciphertext: 'foreign' })], { ...options, authentic: value => authenticates(value, key) });
  assert.equal(r.foreign_key_rows_excluded, 1);
  assert.equal(r.production_rows, 1);
  assert.equal(JSON.stringify(r).includes('private query'), false);
  assert.equal(JSON.stringify(r).includes(text), false);
});
