import test from 'node:test';
import assert from 'node:assert/strict';
import { qrModules, qrPath } from '../src/core/qr';

// Decoding was checked with zbarimg for links up to version 8 (2026-11-15); these pin the structure.
test('qr: the smallest version that fits, with finder patterns in three corners', () => {
  const short = qrModules('https://yepwatch.com/r/K7QX');
  assert.equal(short.length, 29, 'a short link fits version 3 at level M');
  const finder = (x: number, y: number) => [0, 1, 2, 3, 4, 5, 6].every((d) => short[y][x + d] && short[y + d][x] && short[y + 6][x + d] && short[y + d][x + 6]);
  assert.ok(finder(0, 0) && finder(short.length - 7, 0) && finder(0, short.length - 7));
  assert.equal(short[short.length - 8][8], true, 'the dark module');
  assert.equal(qrModules(`https://yepwatch.com/r/${'x'.repeat(120)}`).length, 49);
  assert.throws(() => qrModules('x'.repeat(500)));
});

test('qr: one path segment per dark module', () => {
  const modules = qrModules('K7QX');
  const dark = modules.flat().filter(Boolean).length;
  assert.equal(qrPath(modules).split('M').length - 1, dark);
});
