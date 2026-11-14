import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMotionPreference } from '../src/components/motion-preference';

const never = () => new Promise<boolean>(() => {});

test('the web answers synchronously, before any screen mounts, and follows changes', () => {
  let change: ((e: { matches: boolean }) => void) | undefined;
  let asked = 0;
  const pref = createMotionPreference({ media: () => ({ matches: false, addEventListener: (_t, cb) => { change = cb; } }), ask: () => { asked++; return never(); }, onChange: () => {} });
  assert.equal(pref.read(), false);
  assert.equal(asked, 0);
  let heard = 0;
  pref.subscribe(() => heard++);
  change?.({ matches: true });
  assert.equal(pref.read(), true);
  assert.equal(heard, 1);
});

test('native asks once at start, reads null until then, and keeps the answer for later mounts', async () => {
  let asked = 0;
  let answer!: (v: boolean) => void;
  const pref = createMotionPreference({ media: () => null, ask: () => { asked++; return new Promise(r => { answer = r; }); }, onChange: () => {} });
  assert.equal(pref.read(), null);
  let heard = 0;
  const off = pref.subscribe(() => heard++);
  answer(false);
  await Promise.resolve();
  assert.equal(pref.read(), false);
  assert.equal(heard, 1);
  off();
  assert.equal(pref.read(), false);
  assert.equal(asked, 1);
});

test('native: a change event wins over a late first answer; a failed answer counts as reduced', async () => {
  let fire!: (v: boolean) => void;
  let answer!: (v: boolean) => void;
  const pref = createMotionPreference({ media: () => null, ask: () => new Promise(r => { answer = r; }), onChange: cb => { fire = cb; } });
  fire(true);
  answer(false);
  await Promise.resolve();
  assert.equal(pref.read(), true);
  const failed = createMotionPreference({ media: () => null, ask: () => Promise.reject(new Error('no bridge')), onChange: () => {} });
  await new Promise(r => setTimeout(r, 0));
  assert.equal(failed.read(), true);
});
