import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PEER_HUES, peerColor } from '../src/features/glow/model';

const AMBER = '#fbbf24';

test('no friend is ever amber (amber is always you)', () => {
  assert.ok(!PEER_HUES.map((h) => h.toLowerCase()).includes(AMBER));
  for (let i = 0; i < 500; i++) assert.notEqual(peerColor(`person-${i}`).toLowerCase(), AMBER);
});

test('friends in one room never share a color, up to eight people', () => {
  const roster = Array.from({ length: PEER_HUES.length }, (_, i) => `id-${i * 7919}`);
  const colors = roster.map((id) => peerColor(id, roster));
  assert.equal(new Set(colors).size, roster.length);
});

test("a person's color follows their place in the roster, the same on every phone", () => {
  const roster = ['host', 'mia', 'jon'];
  assert.equal(peerColor('mia', roster), PEER_HUES[1]);
  // Someone who left keeps their place, so nobody else changes color.
  assert.equal(peerColor('jon', ['host', 'mia', 'jon']), peerColor('jon', roster));
});

test('outside a room (no roster) a color still comes from the palette', () => {
  assert.ok((PEER_HUES as readonly string[]).includes(peerColor('someone')));
  assert.ok((PEER_HUES as readonly string[]).includes(peerColor('someone', ['other'])));
});
