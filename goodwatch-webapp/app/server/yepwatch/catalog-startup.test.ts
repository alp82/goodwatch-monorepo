import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requireCatalogSnapshot } from './catalog-startup.ts'
test('Cold catalog waits for the already-started loader instead of failing first Start', async () => {
  const snapshot = { count: 36 }; let time = 0; let reads = 0
  const result = await requireCatalogSnapshot(() => { reads++; return time >= 50 ? snapshot : null }, { now: () => time, wait: async ms => { time += ms } })
  assert.equal(result, snapshot); assert.equal(time, 50); assert.equal(reads, 3)
})
test('Unavailable loader has a bounded actionable retry error without room or offer side effects', async () => {
  let time = 0
  await assert.rejects(requireCatalogSnapshot(() => null, { timeoutMs: 75, now: () => time, wait: async ms => { time += ms } }), { code: 'catalog_unavailable', retryable: true, details: { type: 'catalog', reason: 'catalog_loading', actions: ['retry'] } })
  assert.equal(time, 75)
})
test('Warm catalog returns immediately without waiting', async () => {
  const value = { count: 36 }; const result = await requireCatalogSnapshot(() => value, { wait: async () => { assert.fail('Warm lookup must not wait') } })
  assert.equal(result, value)
})
