import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOOT, bootSettleMs, revealTiming, wordGoneMs } from '../src/features/home/boot-timing';

for (const quiet of [false, true]) {
  test(`header logo starts only after the boot word is gone (${quiet ? 'reduced motion' : 'motion'})`, () => {
    for (const index of [0, 1]) assert.ok(revealTiming('header', index, quiet).delayMs >= wordGoneMs(quiet));
  });
  test(`boot is done only after every part has appeared (${quiet ? 'reduced motion' : 'motion'})`, () => {
    const settle = bootSettleMs(true, quiet);
    for (const part of ['block', 'header', 'backdrop'] as const)
      for (let i = 0; i <= 12; i++) {
        const t = revealTiming(part, i, quiet);
        assert.ok(t.delayMs + t.durationMs <= settle, `${part} ${i}`);
      }
  });
}

test('blocks build in reading order and the stagger is bounded', () => {
  const delays = [0, 1, 2, 3, 4, 5].map((i) => revealTiming('block', i, false).delayMs);
  assert.deepEqual(delays, [...delays].sort((a, b) => a - b));
  assert.equal(revealTiming('block', 40, false).delayMs, revealTiming('block', BOOT.block.maxIndex, false).delayMs);
  assert.equal(revealTiming('block', -3, false).delayMs, BOOT.block.firstMs);
});

test('reduced motion has no rise and no stagger', () => {
  for (let i = 0; i < 6; i++) {
    const t = revealTiming('block', i, true);
    assert.equal(t.rise, 0);
    assert.equal(t.delayMs, BOOT.quiet.delayMs);
  }
});

test('deep links do not wait for a page build-in', () => {
  assert.ok(bootSettleMs(false, false) < bootSettleMs(true, false));
  assert.equal(bootSettleMs(false, false), Math.max(BOOT.word.exitMs, BOOT.curtainMs));
});
