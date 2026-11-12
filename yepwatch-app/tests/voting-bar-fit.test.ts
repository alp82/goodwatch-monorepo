import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPACT_LABEL, FULL_LABEL, PROPOSAL_DOT, faceOffset, liveFacesWidth, matchesChipFrame, matchesChipWidth, moreOffset, moreSlot, votingBarFit } from '../src/features/glow/faces-row';
import { layoutFor } from '../src/features/shell/scale';

const UNDO = 48, GAP = 10;
/** The bar at a window width (phones: the window minus 16 px gutters) and font scale. */
function bar(width: number, fontScale = 1) {
  const { z, phone, max } = layoutFor(width, 800);
  const rowWidth = phone ? width - 32 : Math.min(max, 1100);
  const fit = votingBarFit({ rowWidth, size: z(26), fontScale, z, undo: Math.max(UNDO, z(40)), gap: GAP });
  const chip = matchesChipWidth(z, fontScale, fit.compactChip ? 2 : 10);
  return { ...fit, rowWidth, used: chip + GAP + fit.facesWidth + GAP + Math.max(UNDO, z(40)) };
}

test('at 320 px the bar keeps "10 matches" with the proposal dot, two face slots and Undo inside its width', () => {
  const b = bar(320);
  assert.equal(b.slots, 2);
  assert.equal(b.compactChip, false);
  assert.ok(b.used <= b.rowWidth, `bar needs ${b.used} of ${b.rowWidth}`);
});

test('common phones and desktops keep four face slots', () => {
  for (const w of [360, 390, 430, 1440]) assert.equal(bar(w).slots, 4, `${w} px`);
});

test('large font scales reserve fewer faces, then a compact chip, and never overflow the bar', () => {
  for (const w of [320, 360, 390]) for (const fs of [1, 1.15, 1.3, 1.5, 1.75, 2]) {
    const b = bar(w, fs);
    assert.ok(b.slots >= 1 && b.slots <= 4, `${w} px @${fs}: ${b.slots} slots`);
    assert.ok(b.used <= b.rowWidth, `${w} px @${fs}: bar needs ${b.used} of ${b.rowWidth}`);
  }
  assert.equal(bar(320, 2).compactChip, true);
  assert.equal(bar(390, 1.3).compactChip, false);
});

test('slots grow with width and shrink with font scale (until the chip turns compact and frees room)', () => {
  let last = 0;
  for (let w = 300; w <= 700; w += 10) { const s = bar(w).slots; assert.ok(s >= last, `${w} px`); last = s; }
  last = 5;
  for (const fs of [1, 1.1, 1.2, 1.3, 1.4, 1.5]) { const b = bar(320, fs); if (b.compactChip) break; assert.ok(b.slots <= last, `@${fs}`); last = b.slots; }
});

test('faces end against "+N" inside the fixed row, whatever the count', () => {
  for (const fs of [1, 2]) for (const slots of [1, 2, 3, 4]) {
    const width = liveFacesWidth(26, slots, fs);
    for (let shown = 1; shown <= slots; shown++) for (const more of [false, true]) {
      const first = faceOffset(26, slots, fs, shown, 0, more), last = faceOffset(26, slots, fs, shown, shown - 1, more);
      assert.ok(first >= 0, 'first face starts inside the row');
      assert.ok(last + 26 <= width - (more ? moreSlot(fs) : 0) + 1e-9, 'last face ends before "+N"');
    }
    assert.ok(moreOffset(26, slots, fs) + 22 * fs <= width + 1e-9, '"+99" fits its slot');
  }
});

test('the chip always keeps room for the proposal dot, so "10 matches" stays whole with a proposal', () => {
  for (const w of [300, 320, 360]) for (const fs of [1, 1.3, 2]) {
    const { z } = layoutFor(w, 800);
    const b = bar(w, fs);
    const chars = b.compactChip ? COMPACT_LABEL : FULL_LABEL;
    const text = Math.ceil(z(14) * Math.max(1, fs) * 0.56 * chars);
    const needed = 2 * (12 + 1) + z(15) + 6 + text + 6 + PROPOSAL_DOT;
    assert.ok(matchesChipWidth(z, fs, chars) >= needed, `${w} px @${fs}: chip ${matchesChipWidth(z, fs, chars)} < ${needed}`);
    assert.ok(b.used <= b.rowWidth, `${w} px @${fs}: bar needs ${b.used} of ${b.rowWidth}`);
  }
});

test('the compact chip has a fixed, start-aligned box: the first match and a proposal move nothing', () => {
  const { z } = layoutFor(320, 800);
  const frame = matchesChipFrame(z, 2, true);
  assert.equal(frame.justifyContent, 'flex-start', 'icon pinned to the start edge, not centered');
  assert.equal(frame.width, matchesChipWidth(z, 2, COMPACT_LABEL), 'same width with no count, "1", "10" and the dot');
  assert.ok(frame.width >= 48, 'at least the touch target, so the minimum width never re-centers it');
  assert.equal(matchesChipFrame(z, 1, false).width, undefined, 'the full chip sizes to its label');
});
