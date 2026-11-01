import test from 'node:test';
import assert from 'node:assert/strict';
import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { roomView } from '../src/features/room/model';
import { RefillGate, REFILL_TRIES, refillBackoffMs } from '../src/features/room/refill';
import { kindsOnLeave, nextSaveStep, servicesOnLeave } from '../src/features/room/settings-save';
import { continuousFixture } from './continuous-fixture';

function room(): RoomSnapshot {
  const s = continuousFixture();
  s.shared.phase = 'setup';
  s.shared.screens = [{ id: 'room', label: 'Our room', country: 'DE', serviceIds: [8], confirmed: true }];
  s.shared.participants = [{ participantId: 'host', nickname: 'Alp', screenId: 'room', ready: true, serviceIds: [8] }];
  s.own.participantId = 'host';
  s.own.canHost = true;
  s.shared.hostParticipantId = 'host';
  s.shared.constraints = { ...s.shared.constraints, kinds: ['movie'] };
  return s;
}

test('services draft: nothing changed saves nothing; a change is kept until the room shows it', () => {
  const s = room();
  const v = roomView(s);
  assert.equal(servicesOnLeave(undefined, v, 'DE'), undefined);
  assert.equal(servicesOnLeave({ country: null, picked: [8] }, v, 'DE'), undefined, 'same services');
  const draft = servicesOnLeave({ country: null, picked: [8, 337] }, v, 'DE')!;
  assert.deepEqual(draft, { country: null, picked: [8, 337] });
  assert.deepEqual(nextSaveStep('services', { services: draft }, v, s), { type: 'services', serviceIds: [8, 337] });
  // Confirmed by the server: the draft has nothing left to send.
  s.shared.participants[0].serviceIds = [337, 8];
  assert.equal(nextSaveStep('services', { services: draft }, roomView(s), s), null);
});

test('services draft: the host’s new country goes first, then the services', () => {
  const s = room();
  const draft = servicesOnLeave({ country: 'US', picked: [9] }, roomView(s), 'US')!;
  assert.deepEqual(draft, { country: 'US', picked: [9] });
  assert.deepEqual(nextSaveStep('services', { services: draft }, roomView(s), s), { type: 'country', country: 'US' });
  s.shared.screens[0].country = 'US';
  assert.deepEqual(nextSaveStep('services', { services: draft }, roomView(s), s), { type: 'services', serviceIds: [9] });
  // A room without a country gets the shown one with the host's first services.
  const t = room();
  t.shared.screens = [];
  t.shared.participants[0].serviceIds = null;
  assert.deepEqual(servicesOnLeave({ country: null, picked: [8] }, roomView(t), 'DE'), { country: 'DE', picked: [8] });
});

test('kinds draft: saved as room constraints, keeping other kinds; done once the room shows it', () => {
  const s = room();
  s.shared.constraints = { ...s.shared.constraints, kinds: ['movie', 'show_start'] };
  const v = roomView(s);
  assert.equal(kindsOnLeave(['show_start', 'movie'], v), undefined);
  assert.equal(kindsOnLeave([], v), undefined, 'nothing picked keeps the room as it is');
  const draft = kindsOnLeave(['movie'], v)!;
  const step = nextSaveStep('kinds', { kinds: draft }, v, s);
  assert.equal(step?.type, 'kinds');
  assert.deepEqual(step?.type === 'kinds' && step.constraints.kinds, ['movie']);
  s.shared.constraints = { ...s.shared.constraints, kinds: ['movie'] };
  assert.equal(nextSaveStep('kinds', { kinds: draft }, roomView(s), s), null);
});

test('refill gate: one in flight, retries after a failed send, stops after a few, a new stream starts over', () => {
  const g = new RefillGate();
  assert.deepEqual(g.begin('1:1:ready', 0), { send: true });
  assert.deepEqual(g.begin('1:1:ready', 0), { send: false, retryInMs: null }, 'in flight');
  g.settle('1:1:ready', false, 0);
  assert.deepEqual(g.begin('1:1:ready', 10), { send: false, retryInMs: refillBackoffMs(1) - 10 }, 'waits, then retries');
  assert.deepEqual(g.begin('1:1:ready', refillBackoffMs(1)), { send: true });
  g.settle('1:1:ready', false, refillBackoffMs(1));
  let now = 100_000;
  for (let i = 2; i < REFILL_TRIES; i++) {
    assert.deepEqual(g.begin('1:1:ready', now), { send: true });
    g.settle('1:1:ready', false, now);
    now += 100_000;
  }
  assert.deepEqual(g.begin('1:1:ready', now), { send: false, retryInMs: null }, 'bounded');
  // A fresh snapshot (new stream version or state) enables it again.
  assert.deepEqual(g.begin('1:2:ready', now), { send: true });
  g.settle('1:2:ready', true, now);
  assert.deepEqual(g.begin('1:2:ready', now + 100_000), { send: false, retryInMs: null }, 'a refill that went through isn’t repeated');
  assert.deepEqual(g.begin('1:2:exhausted', now), { send: true });
});
