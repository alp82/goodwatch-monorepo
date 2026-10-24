import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { recentRoom } from '../src/core/continuous/recent-room-state';
test('recent room reminder ignores expired or damaged storage without holding credentials', () => {
  const valid = { roomId: 'room', nickname: 'Mika', expiresAt: Date.now() + 60000 };
  assert.deepEqual(recentRoom(JSON.stringify(valid)), valid);
  for (const raw of [null, '{', '{}', JSON.stringify({ ...valid, expiresAt: Date.now() - 1 }), JSON.stringify({ ...valid, nickname: null })]) assert.equal(recentRoom(raw), null);
});
