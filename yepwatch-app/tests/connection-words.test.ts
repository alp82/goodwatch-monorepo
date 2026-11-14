import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionWords, disrupted, nextOutage, OFFLINE_WORDS, PLANNED_RESTART_QUIET_MS, QUIET_OUTAGE_MS, quietPeriod, RECONNECTING_WORDS } from '../src/core/continuous/connection-words';

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

test('an outage is planned only when it starts as an announced restart; offline once makes it short for good', () => {
  const live = { offline: false, connection: 'live' as const, pending: false };
  assert.equal(nextOutage(null, live, 0), null);
  const planned = nextOutage(null, { ...live, connection: 'restarting' }, 100)!;
  assert.deepEqual(planned, { since: 100, planned: true, offline: false });
  // The announcement running out mid-outage (now `reconnecting`) keeps the outage and its start.
  assert.equal(nextOutage(planned, { ...live, connection: 'reconnecting' }, 5000), planned);
  // Offline at 4 s, online again at 5 s while the server is still away: still the short period, never hidden again.
  const offline = nextOutage(planned, { ...live, connection: 'restarting', offline: true }, 4000)!;
  assert.equal(offline.offline, true);
  const back = nextOutage(offline, { ...live, connection: 'restarting' }, 5000)!;
  assert.equal(back.since, 100);
  assert.equal(quietPeriod(back.planned, back.offline), QUIET_OUTAGE_MS);
  // A `restarting` within the short quiet period of an unannounced start (a vote that failed just before the
  // goodbye) makes it planned; after the line could have shown, it doesn't.
  const unplanned = nextOutage(null, { ...live, pending: true }, 0)!;
  assert.equal(nextOutage(unplanned, { ...live, connection: 'restarting', pending: true }, 1000)!.planned, true);
  assert.equal(nextOutage(unplanned, { ...live, connection: 'restarting' }, QUIET_OUTAGE_MS)!.planned, false);
  assert.equal(nextOutage(back, live, 6000), null, 'live again ends it');
});
