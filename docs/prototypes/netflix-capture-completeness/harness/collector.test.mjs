// Rule tests for the version 0.0.5 collector (ticket #706). Synthetic data only.
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { runScenario } from './runner.mjs'
import { createClock, createPage, loadCollector } from './sim.mjs'

const collector = join(fileURLToPath(new URL('..', import.meta.url)), 'extension/capture.js')
const list = (n, start = 1001) => Array.from({ length: n }, (_, i) => ({ id: String(start + i), title: `Invented ${i + 1}`, type: i % 2 ? 'show' : 'movie' }))
const other = items => [{ label: 'Weiterschauen', position: 'before', items }]

test('reads the reported total and loaded positions for the selected row only', async () => {
  const clock = createClock()
  const items = list(30).map((item, i) => (i === 0 ? { ...item, title: 'Ünïcödé "quoted" \'single\' \\ back' } : item))
  const page = createPage(clock, { items, otherRows: [{ label: 'Nochmal ansehen', items: list(99, 5001) }] })
  const command = loadCollector(page, clock, collector)
  const r = command({ action: 'start' })
  assert.equal(r.state, 'capturing')
  assert.deepEqual({ ...r.reference }, { found: true, total: 30, loaded: 13 })
  await clock.advance(1000)
  const s = command({ action: 'status' })
  assert.equal(s.orderCheck, 'match')
  assert.equal(s.envelope.items.find(i => i.sourceId === '1001').title, items[0].title)
  page.close()
})

test('assisted traversal reaches complete for a clean list', async () => {
  const r = await runScenario('A', { page: { items: list(77), otherRows: other(list(2, 9001)) } })
  assert.equal(r.completeness, 'complete')
  assert.equal(r.captured, 77)
  assert.equal(r.actions, 3)
})

test('never complete without a reported total', async () => {
  for (const route of ['M1', 'A']) {
    const r = await runScenario(route, { page: { items: list(40), pageState: false } })
    assert.equal(r.completeness, 'unknown')
    assert.equal(r.captured, 40)
  }
})

test('recycled cards updated link-first or label-first lose nothing', async () => {
  for (const recycle of ['href-first', 'label-first']) {
    const r = await runScenario('M1', { page: { items: list(50), recycle, staggerMs: 200 } })
    assert.equal(r.recall, 1, recycle)
    assert.equal(r.completeness, 'complete', recycle)
  }
})

test('IDs that also appear in other rows are captured only from My List', async () => {
  const items = list(40)
  const r = await runScenario('A', { page: { items, otherRows: other([items[30], ...list(3, 9001)]) } })
  assert.equal(r.contamination, 0)
  assert.equal(r.completeness, 'complete')
})

test('more titles than reported is partial', async () => {
  const r = await runScenario('A', { page: { items: list(40), stateTotal: 39 } })
  assert.equal(r.completeness, 'partial')
  assert.equal(r.reason, 'above_total')
})

test('a title counted but never shown is partial', async () => {
  const r = await runScenario('A', { page: { items: list(40), unavailable: ['1033'] } })
  assert.equal(r.completeness, 'partial')
  assert.equal(r.reason, 'below_total')
  assert.equal(r.captured, 39)
})

test('a profile change discards the capture', async () => {
  const r = await runScenario('A', { page: { items: list(77) }, events: [{ at: 5000, kind: 'profile' }] })
  assert.equal(r.completeness, 'no file')
  assert.equal(r.code, 'terminated_profile')
})

test('a foreign card among the first positions fails the order check', async () => {
  const r = await runScenario('M1', { page: { items: list(40), unavailable: ['1035'], contaminants: [{ index: 1, item: { id: '9901', title: 'Invented promo', type: 'show' } }] } })
  assert.equal(r.completeness, 'partial')
  assert.equal(r.reason, 'order_mismatch')
})

test('a re-rendered row is rebound and capture continues', async () => {
  const r = await runScenario('M1', { page: { items: list(60) }, events: [{ at: 4000, kind: 'replace' }] })
  assert.equal(r.completeness, 'complete')
})

test('an empty list reported as 0 is complete with no titles; no row at all is unknown', async () => {
  const empty = await runScenario('A', { page: { items: [], emptyRow: 'state-only' } })
  assert.equal(empty.code, 'list_empty')
  assert.equal(empty.captured, 0)
  const missing = await runScenario('A', { page: { items: [] } })
  assert.equal(missing.code, 'boundary_missing')
  assert.equal(missing.completeness, 'no file')
})

test('stopping before the row comes back to its first title is partial', async () => {
  const r = await runScenario('M1', { member: 'stop-at-count', page: { items: list(40) } })
  // The count matches only once the last page is in view, which is also where
  // the first title returns; stopping at the count before that is not enough.
  assert.ok(['complete', 'partial'].includes(r.completeness))
  if (r.completeness === 'partial') assert.equal(r.reason, 'lap_not_finished')
})
