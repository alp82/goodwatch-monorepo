import test from 'node:test';
import assert from 'node:assert/strict';
import { closeTopSheet, isTopSheet, registerSheet, screenBack } from '../src/features/shell/sheet-stack';

test('a screen’s back closes the sheet on top first; with no sheet the screen’s own back runs', () => {
  const closed: string[] = [];
  let left = 0;
  const leave = () => { left++; };
  const room = registerSheet(() => closed.push('room'));
  const services = registerSheet(() => closed.push('services'));
  assert.ok(isTopSheet(services.entry));
  // However many times a screen re-registers its handler, a back press reaches the sheet first.
  assert.equal(screenBack(leave), true);
  assert.deepEqual(closed, ['services']);
  assert.equal(left, 0);
  services.remove();
  assert.ok(isTopSheet(room.entry));
  screenBack(leave);
  assert.deepEqual(closed, ['services', 'room']);
  room.remove();
  room.remove();
  assert.equal(closeTopSheet(), false);
  screenBack(leave);
  assert.equal(left, 1);
});
