import test from 'node:test';
import assert from 'node:assert/strict';
import { lobbyEntryPlan } from '../src/core/continuous/lobby-entry';
import { continuousFixture } from './continuous-fixture';
function guest() {
  const s = continuousFixture();
  s.own.canHost = false;
  s.shared.phase = 'setup';
  s.shared.participants[0].screenId = null;
  s.shared.participants[0].ready = false;
  return s;
}
test('confirmed shared-screen entry assigns once then readies only its own actor with current context', () => {
  const s = guest();
  assert.deepEqual(lobbyEntryPlan(s)?.command, {
    type: 'assign_screen',
    expectedContextVersion: 1,
    screenId: 'tv',
  });
  s.shared.participants[0].screenId = 'tv';
  s.shared.rosterVersion++;
  assert.deepEqual(lobbyEntryPlan(s)?.command, {
    type: 'ready',
    expectedContextVersion: 1,
    ready: true,
  });
  s.shared.participants[0].ready = true;
  assert.equal(lobbyEntryPlan(s), null);
  assert.equal(s.own.agreement.agreed, false);
});
test('multi-screen assignment is always explicit, even when only one screen is usable', () => {
  const s = guest();
  s.shared.screens.push({ ...s.shared.screens[0], id: 'remote', confirmed: false, serviceIds: [] });
  assert.equal(lobbyEntryPlan(s), null);
  s.shared.participants[0].screenId = 'remote';
  assert.equal(lobbyEntryPlan(s), null);
  s.shared.screens[1].serviceIds = [9];
  s.shared.screens[1].confirmed = true;
  assert.equal(lobbyEntryPlan(s)?.command.type, 'ready');
});
test('no readiness is inferred from missing country/services/confirmation, account prefill, host or terminal state', () => {
  for (const patch of [{ country: null }, { serviceIds: [] }, { confirmed: false }]) {
    const s = guest();
    Object.assign(s.shared.screens[0], patch);
    s.own.member = {
      state: 'linked',
      prefill: { country: 'DE', serviceIds: [8], savedProgressAvailable: true },
    };
    assert.equal(lobbyEntryPlan(s), null);
  }
  const s = guest();
  s.own.canHost = true;
  assert.equal(lobbyEntryPlan(s), null);
  s.own.canHost = false;
  s.shared.phase = 'decided';
  assert.equal(lobbyEntryPlan(s), null);
});
test('context/roster/screen fences change entry keys; unrelated revisions never repeat readiness', () => {
  const s = guest();
  s.shared.participants[0].screenId = 'tv';
  const first = lobbyEntryPlan(s)!.key;
  s.shared.revision++;
  assert.equal(lobbyEntryPlan(s)?.key, first);
  s.shared.contextVersion++;
  assert.notEqual(lobbyEntryPlan(s)?.key, first);
  assert.equal(lobbyEntryPlan(s)?.command.type, 'ready');
  const context = lobbyEntryPlan(s)!.key;
  s.shared.rosterVersion++;
  assert.notEqual(lobbyEntryPlan(s)?.key, context);
  s.shared.phase = 'choosing';
  assert.equal(lobbyEntryPlan(s)?.command.type, 'ready');
});
