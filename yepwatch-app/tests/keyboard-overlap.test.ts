import assert from 'node:assert/strict';
import test from 'node:test';
import { keyboardOverlap } from '../src/features/shell/keyboard-overlap';

test('a page body reaching to the screen bottom pads by the whole keyboard, navigation area included', () => {
  // 915 dp tall screen, body from under the header (y 96) to the bottom; keyboard top at 560.
  assert.equal(keyboardOverlap(96, 819, { screenY: 560, height: 307 }), 355);
});

test('a view ending above the keyboard, or no keyboard, needs no room', () => {
  assert.equal(keyboardOverlap(100, 300, { screenY: 560, height: 307 }), 0);
  assert.equal(keyboardOverlap(96, 819, null), 0);
  assert.equal(keyboardOverlap(96, 819, { screenY: 915, height: 0 }), 0);
});
