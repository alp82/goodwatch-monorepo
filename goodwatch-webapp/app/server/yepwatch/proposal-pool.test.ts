import test from 'node:test'
import assert from 'node:assert/strict'
import { rankingSnapshot } from './proposal-ranking-test-support.ts'
import { passesFloor, roomPool, basePool, roomJitter } from './proposal-pool.ts'
test('floors differ by kind; relax ladder stops at 300 and never lifts adult or release rules', async () => {
  const snapshot = rankingSnapshot([
    { key: 1e12 + 1, votes: 4999 }, { key: 2e12 + 2, votes: 1500, score: 65 },
    { key: 1e12 + 3, votes: 2000, score: 55 }, { key: 1e12 + 4, votes: 1000, score: 50 },
    { key: 1e12 + 5, flags: 7 }, { key: 1e12 + 6, day: 99999 }, { key: 2e12 + 7, year: 2099 },
    { key: 2e12 + 8, genre: 2 }, { key: 1e12 + 9, flags: 0 },
  ])
  assert.equal(passesFloor(snapshot, 1e12 + 1), false)
  assert.equal(passesFloor(snapshot, 2e12 + 2), true)
  assert.equal(passesFloor(snapshot, 1e12 + 3, 1), true)
  assert.equal(passesFloor(snapshot, 1e12 + 4, 1), false)
  assert.equal(passesFloor(snapshot, 1e12 + 4, 2), true)
  for (const id of [5, 6, 9]) assert.equal(passesFloor(snapshot, 1e12 + id, 2, true), false)
  assert.equal(passesFloor(snapshot, 2e12 + 7, 2, true), false)
  assert.equal(passesFloor(snapshot, 2e12 + 8), false)
  assert.equal(passesFloor(snapshot, 2e12 + 8, 0, true), true)
  const calls: number[] = []
  const room = await roomPool(async step => { calls.push(step); return Array.from({ length: step ? 400 : 200 }, (_, i) => i) }, key => key % 2 === 0)
  assert.deepEqual(calls, [0, 1, 2]); assert.equal(room.keys.length, 200)
  assert.equal((await roomPool(async () => [1, 2, 3], null)).keys.length, 3)
})
test('base pool is cached, quality ordered, kind/mood filtered and seeded jitter is stable', async () => {
  const snapshot = rankingSnapshot([{ key: 1e12 + 1, score: 65 }, { key: 1e12 + 2, score: 90 }, { key: 2e12 + 3 }])
  const pool = await basePool(snapshot, ['movie'])
  assert.deepEqual(pool, [1e12 + 2, 1e12 + 1])
  assert.equal(await basePool(snapshot, ['movie']), pool)
  assert.deepEqual(await basePool(snapshot, ['movie'], 1), [])
  snapshot.columns.moods[0] = 1; snapshot.columns.moods[1] = 2
  assert.deepEqual(await basePool(snapshot, ['movie'], 3), [1e12 + 2, 1e12 + 1], 'moods combine with OR')
  assert.equal(roomJitter('a', 1), roomJitter('a', 1)); assert.notEqual(roomJitter('b', 1), roomJitter('a', 1))
})
test('200k-title pool yields while cold; warm pool reuses its array', async () => {
  const snapshot = rankingSnapshot(Array.from({ length: 200000 }, (_, i) => ({ key: 1e12 + i + 1, score: 50 + i % 50, votes: 1000 + i % 20000 })), 'pool-speed')
  let turns = 0
  const tick = setInterval(() => turns++, 0)
  const start = performance.now(), pool = await basePool(snapshot, ['movie'])
  clearInterval(tick)
  assert.ok(turns >= 3, 'other I/O runs while the pool builds')
  const warm = performance.now(); assert.equal(await basePool(snapshot, ['movie']), pool)
  assert.ok(performance.now() - warm < 5)
  console.info(JSON.stringify({ event: 'test_pool_speed', rows: snapshot.count, coldMs: performance.now() - start, yields: turns }))
})
