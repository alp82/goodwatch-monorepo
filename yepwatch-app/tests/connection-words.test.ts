import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionWords, disrupted, OFFLINE_WORDS, PLANNED_RESTART_QUIET_MS, QUIET_OUTAGE_MS, quietPeriod, RECONNECTING_WORDS } from '../src/core/continuous/connection-words';

test('connection words: nothing before the quiet period, then one line, offline says only that', () => {
  const live = { offline: false, connection: 'live' as const, pending: false };
  assert.equal(disrupted(live), false);
  assert.equal(connectionWords(live, true), '');
  for (const connection of ['polling', 'background', 'connecting'] as const) assert.equal(disrupted({ ...live, connection }), false, connection);
  const reconnecting = { ...live, connection: 'reconnecting' as const };
  assert.equal(connectionWords(reconnecting, false), '', 'a short outage says nothing');
  assert.equal(connectionWords(reconnecting, true), RECONNECTING_WORDS);
  assert.equal(connectionWords({ ...live, connection: 'unavailable' }, true), RECONNECTING_WORDS);
  assert.equal(connectionWords({ ...live, pending: true }, true), RECONNECTING_WORDS, 'a saved action past the quiet period');
  assert.equal(connectionWords({ ...reconnecting, offline: true }, false), '');
  assert.equal(connectionWords({ ...reconnecting, offline: true }, true), OFFLINE_WORDS);
  for (const words of [OFFLINE_WORDS, RECONNECTING_WORDS]) assert.doesNotMatch(words, /\d/, 'never a countdown');
});

test('an announced restart is quiet for longer, unless the device is offline; it still says Reconnecting after', () => {
  assert.equal(quietPeriod(false, false), QUIET_OUTAGE_MS);
  assert.equal(quietPeriod(true, false), PLANNED_RESTART_QUIET_MS);
  assert.equal(quietPeriod(true, true), QUIET_OUTAGE_MS, 'no network on the device is never a server restart');
  assert.ok(PLANNED_RESTART_QUIET_MS > QUIET_OUTAGE_MS);
  const restarting = { offline: false, connection: 'restarting' as const, pending: false };
  assert.equal(disrupted(restarting), true, 'an announced restart is an outage, only a quieter one');
  assert.equal(connectionWords(restarting, false), '');
  assert.equal(connectionWords(restarting, true), RECONNECTING_WORDS);
});
