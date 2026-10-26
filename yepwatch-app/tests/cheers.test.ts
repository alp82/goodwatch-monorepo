import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITY_LIMITS } from '@goodwatch/yepwatch-contracts/proposal';
import { parseFrame } from '../src/core/continuous/wire';
import { allHolding, applyCheerFrame, emptyCheers, freshCheerEvents, holderSeeds, holdingParticipants, mulberry32, newCheerSeed, nextCheerExpiry, pruneCheers, type CheerState } from '../src/core/continuous/cheers';
import { activityFixture } from './continuous-fixture';

const TTL = ACTIVITY_LIMITS.pulseTtlMs;
const cheerFrame = (patch: Record<string, unknown> = {}, cheer: Record<string, unknown> = {}) =>
  JSON.stringify({ ...activityFixture({ view: 'matches' }), ...patch, cheer: { kind: 'tap', generation: 2, seed: 41, ...cheer } });

test('wire accepts a lone cheer on the matches view and rejects mixes, wrong views and bad ranges', () => {
  assert.equal(parseFrame(cheerFrame())?.type, 'activity');
  assert.equal(parseFrame(cheerFrame({}, { kind: 'hold', seed: 2147483647, generation: 0 }))?.type, 'activity');
  assert.equal(parseFrame(cheerFrame({ view: 'voting' })), null);
  assert.equal(parseFrame(cheerFrame({ view: 'away' })), null);
  assert.equal(parseFrame(cheerFrame({ gesture: 'handle' })), null);
  assert.equal(parseFrame(cheerFrame({ inspection: { kind: 'lens' } })), null);
  assert.equal(parseFrame(cheerFrame({ beat: 'answer' })), null);
  assert.equal(parseFrame(cheerFrame({}, { seed: 2147483648 })), null);
  assert.equal(parseFrame(cheerFrame({}, { seed: -1 })), null);
  assert.equal(parseFrame(cheerFrame({}, { seed: 1.5 })), null);
  assert.equal(parseFrame(cheerFrame({}, { generation: -1 })), null);
  assert.equal(parseFrame(cheerFrame({}, { kind: 'wave' })), null);
  assert.equal(parseFrame(cheerFrame({}, { extra: true })), null);
});

const frame = (participantId: string, sessionId: string, sequence: number, serverTime: number, kind: 'tap' | 'hold' | 'release', seed = 5, generation = 2) =>
  activityFixture({ participantId, sessionId, sequence, serverTime, expiresAt: serverTime + 6000, view: 'matches', cheer: { kind, generation, seed } });

test('a tap is one burst; a hold bursts once per episode and renewals with the same seed do not', () => {
  let s: CheerState = emptyCheers();
  let r = applyCheerFrame(s, frame('peer', 'a', 1, 1000, 'tap', 9), 1000, 'me');
  assert.equal(r.event?.kind, 'tap');
  assert.equal(r.event?.seed, 9);
  assert.equal(r.event?.self, false);
  s = r.state;
  r = applyCheerFrame(s, frame('peer', 'a', 2, 1100, 'hold', 11), 1100, 'me');
  assert.equal(r.event?.kind, 'hold');
  s = r.state;
  for (const t of [1600, 2100, 2600]) { r = applyCheerFrame(s, frame('peer', 'a', t, t, 'hold', 11), t, 'me'); assert.equal(r.event, undefined); s = r.state; }
  assert.deepEqual([...holdingParticipants(s, 2700, 2)], ['peer']);
  r = applyCheerFrame(s, frame('peer', 'a', 9, 2800, 'release', 11), 2800, 'me');
  assert.equal(r.event, undefined);
  assert.equal(holdingParticipants(r.state, 2800, 2).size, 0);
  r = applyCheerFrame(r.state, frame('peer', 'a', 10, 3000, 'hold', 12), 3000, 'me');
  assert.equal(r.event?.kind, 'hold', 'a new seed is a new episode');
});

test('holds expire after the pulse TTL without renewal, so nobody stays stuck holding', () => {
  const s = applyCheerFrame(emptyCheers(), frame('peer', 'a', 1, 1000, 'hold'), 1000, 'me').state;
  assert.equal(holdingParticipants(s, 1000 + TTL - 1, 2).size, 1);
  assert.equal(holdingParticipants(s, 1000 + TTL, 2).size, 0);
  assert.equal(nextCheerExpiry(s, 1000), 1000 + TTL);
  const pruned = pruneCheers(s, 1000 + TTL);
  assert.equal(pruned.holds.size, 0);
  assert.equal(nextCheerExpiry(pruned, 1000 + TTL), null);
});

test('several sessions of one participant count as one holder while any session is valid', () => {
  let s = applyCheerFrame(emptyCheers(), frame('peer', 'phone', 1, 1000, 'hold'), 1000, 'me').state;
  s = applyCheerFrame(s, frame('peer', 'laptop', 1, 1400, 'hold'), 1400, 'me').state;
  s = applyCheerFrame(s, frame('other', 'x', 1, 1400, 'hold'), 1400, 'me').state;
  assert.equal(holdingParticipants(s, 1500, 2).size, 2);
  s = applyCheerFrame(s, frame('peer', 'phone', 2, 1600, 'release'), 1600, 'me').state;
  assert.ok(holdingParticipants(s, 1700, 2).has('peer'), 'laptop still holds');
  assert.ok(!holdingParticipants(s, 1400 + TTL, 2).has('peer'), 'laptop hold expired');
});

test('own, expired, far-future, non-cheer and other-generation frames do not count', () => {
  const s = emptyCheers();
  assert.equal(applyCheerFrame(s, frame('me', 'a', 1, 1000, 'tap'), 1000, 'me').event, undefined);
  assert.equal(applyCheerFrame(s, frame('peer', 'a', 1, 1000, 'tap'), 1000 + TTL, 'me').event, undefined);
  assert.equal(applyCheerFrame(s, frame('peer', 'a', 1, 9000, 'tap'), 1000, 'me').event, undefined);
  assert.equal(applyCheerFrame(s, activityFixture({ view: 'matches', serverTime: 1000 }), 1000, 'me').event, undefined);
  const held = applyCheerFrame(s, frame('peer', 'a', 1, 1000, 'hold', 5, 3), 1000, 'me').state;
  assert.equal(holdingParticipants(held, 1100, 2).size, 0);
  assert.equal(holdingParticipants(held, 1100, 3).size, 1);
});

test('all holding needs every non-dropped participant; one-person rooms count; nobody required is never all', () => {
  const people = [{ participantId: 'me' }, { participantId: 'a' }, { participantId: 'b', dropped: true }];
  assert.equal(allHolding(new Set(['a']), true, 'me', people), true);
  assert.equal(allHolding(new Set(['a']), false, 'me', people), false);
  assert.equal(allHolding(new Set(), true, 'me', people), false);
  assert.equal(allHolding(new Set(), true, 'me', [{ participantId: 'me' }]), true);
  assert.equal(allHolding(new Set(), false, 'me', [{ participantId: 'me' }]), false);
  assert.equal(allHolding(new Set(['a']), true, 'me', []), false);
});

test('seeds are valid protocol integers and the shared PRNG is deterministic per seed', () => {
  for (let i = 0; i < 200; i++) { const s = newCheerSeed(); assert.ok(Number.isInteger(s) && s >= 0 && s <= 2147483647); }
  const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
  const sa = [a(), a(), a()], sb = [b(), b(), b()];
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, [c(), c(), c()]);
  assert.ok(sa.every((x) => x >= 0 && x < 1));
});

test('holders carry their episode seed so every window draws the same stream; stale bursts never replay', () => {
  let s = applyCheerFrame(emptyCheers(), frame('peer', 'a', 1, 1000, 'hold', 77), 1000, 'me').state;
  s = applyCheerFrame(s, frame('other', 'b', 1, 1100, 'hold', 88), 1100, 'me').state;
  assert.deepEqual([...holderSeeds(s, 1200, 2)].sort(), [['other', 88], ['peer', 77]]);
  assert.deepEqual([...holderSeeds(s, 1000 + TTL, 2)], [['other', 88]], 'an unrenewed hold leaves with its seed');
  // Revisiting Tonight after the TTL: old bursts are gone, so the remounted layer has nothing to replay
  // and no expired remote hold can complete an all-hold.
  const events = [{ id: 'a', at: 1000 }, { id: 'b', at: 2000 }];
  assert.deepEqual(freshCheerEvents(events, 1000 + TTL).map((e) => e.id), ['b']);
  assert.deepEqual(freshCheerEvents(events, 2000 + TTL), []);
  assert.equal(allHolding(new Set(holderSeeds(s, 5000, 2).keys()), true, 'me', [{ participantId: 'me' }, { participantId: 'peer' }]), false);
});
