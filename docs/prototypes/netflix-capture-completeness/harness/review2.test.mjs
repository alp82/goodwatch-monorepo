// Regression tests for the second independent review (of version 0.0.6,
// ticket #706). Each test reproduces one finding; synthetic data only.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { runScenario } from './runner.mjs'
import { createClock, createPage, loadCollector, pageStateScript } from './sim.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const collector = join(root, 'extension/capture.js')
const list = (n, start = 1001) => Array.from({ length: n }, (_, i) => ({ id: String(start + i), title: `Invented ${i + 1}`, type: 'movie' }))

// Finding 1: unmount and remount of the cards is not a wrap.
test('1: removing and restoring the cards with a stale 7-title reference is never complete', async () => {
  const clock = createClock()
  const items = list(30)
  const page = createPage(clock, { items })
  page.document.querySelector('script').textContent = pageStateScript([{ label: 'Meine Liste', inPageState: true, stateItems: items.slice(0, 7), stateTotal: 7 }], 13)
  const command = loadCollector(page, clock, collector)
  command({ action: 'start' })
  await clock.advance(1000)
  const track = page.document.querySelector('.track')
  const html = track.innerHTML
  track.innerHTML = ''
  await clock.advance(500)
  track.innerHTML = html
  await clock.advance(1000)
  const r = command({ action: 'stop' })
  assert.equal(r.lapSeen, false)
  assert.notEqual(r.verdict.completeness, 'complete')
  page.close()
})

test('1: a reference from a document loaded long ago is refused as stale', async () => {
  const r = await runScenario('A', { page: { items: list(30), loadedAgoMs: 11 * 60 * 1000 } })
  assert.notEqual(r.completeness, 'complete')
  assert.equal(r.reason, 'reference_stale')
})

test('1: the real wrap is still recognized without a partly visible neighbor card', async () => {
  const r = await runScenario('A', { page: { items: list(40), peek: 0 } })
  assert.equal(r.completeness, 'complete')
})

// Finding 2: a zero count isn't complete while a row can still appear.
test('2: a stale zero count is not complete after a 30-title row appears', async () => {
  const clock = createClock()
  const items = list(30)
  const page = createPage(clock, { items })
  page.document.querySelector('script').textContent = pageStateScript([{ label: 'Meine Liste', inPageState: true, stateItems: [], stateTotal: 0 }], 13)
  const row = page.document.querySelector('section.carousel-row')
  const parent = row.parentElement
  row.remove()
  const command = loadCollector(page, clock, collector)
  command({ action: 'start' })
  parent.append(row)
  await clock.advance(1000)
  const r = command({ action: 'stop' })
  assert.notEqual(r.verdict.completeness, 'complete')
  page.close()
})

test('2: a row that appears after the empty check finished still undoes complete', async () => {
  const clock = createClock()
  const items = list(30)
  const page = createPage(clock, { items })
  page.document.querySelector('script').textContent = pageStateScript([{ label: 'Meine Liste', inPageState: true, stateItems: [], stateTotal: 0 }], 13)
  const row = page.document.querySelector('section.carousel-row')
  const parent = row.parentElement
  row.remove()
  const command = loadCollector(page, clock, collector)
  command({ action: 'start' })
  await clock.advance(5000)
  assert.equal(command({ action: 'status' }).verdict.completeness, 'complete')
  parent.append(row)
  const r = command({ action: 'status' })
  assert.notEqual(r.verdict.completeness, 'complete')
  page.close()
})

test('2: a truly empty list is complete only after it stays empty', async () => {
  const clock = createClock()
  const page = createPage(clock, { items: [], emptyRow: 'state-only' })
  const command = loadCollector(page, clock, collector)
  assert.notEqual(command({ action: 'start' }).verdict.completeness, 'complete')
  await clock.advance(5000)
  const r = command({ action: 'stop' })
  assert.equal(r.code, 'list_empty')
  assert.equal(r.verdict.completeness, 'complete')
  page.close()
})

// Finding 3: the advance cap follows the protocol formula, not the first gain.
function oneStepArrow(page, items) {
  let clicks = 0
  const old = page.myList.nextButton()
  const button = old.cloneNode(true)
  old.replaceWith(button)
  button.addEventListener('click', () => {
    clicks++
    page.document.querySelectorAll('section.carousel-row [data-virtual-slot]').forEach((slot, k) => {
      const item = items[(clicks + k) % items.length]
      slot.innerHTML = `<a data-uia="standard-card" aria-label="${item.title}" href="/browse?jbv=${item.id}"></a>`
    })
  })
  return () => clicks
}

test('3: an arrow that advances one title stops at ceil(total / visible) + 3 + 3 clicks', async () => {
  for (const [n, visible, peek] of [[30, 5, 0], [77, 6, 1]]) {
    const clock = createClock()
    const items = list(n)
    const page = createPage(clock, { items, visible, peek, loaded: n })
    const clicks = oneStepArrow(page, items)
    const command = loadCollector(page, clock, collector)
    command({ action: 'start', mode: 'assisted' })
    await clock.advance(120000)
    const r = command({ action: 'status' })
    const mounted = visible + peek
    assert.ok(clicks() <= Math.ceil(n / mounted) + 6, `${n}: ${clicks()} clicks`)
    assert.equal(r.traversal.outcome, 'advance_limit', String(n))
    assert.notEqual(r.verdict.completeness, 'complete', String(n))
    page.close()
  }
})

// Finding 4 and 6: private scripts validate fields and accept parameterized keys.
function runScript(script, args) {
  try {
    return execFileSync(process.execPath, [join(root, script), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    return `${error.stdout}${error.stderr}`
  }
}

test('4: an unexpected completeness value prints a fixed code, never the value', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gw706-'))
  try {
    const file = join(dir, 'c.json')
    writeFileSync(file, JSON.stringify({ format: 'goodwatch-wishlist', completeness: 'PRIVATE_NAME_1234', items: [] }))
    const compare = runScript('scripts/compare-captures.mjs', [file])
    assert.ok(!compare.includes('PRIVATE'), compare)
    assert.match(compare, /completeness_invalid/)
    const page = join(dir, 'p.html')
    writeFileSync(page, '<html><body></body></html>')
    const replay = runScript('scripts/private-replay.mjs', [page, file])
    assert.ok(!replay.includes('PRIVATE'), replay)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('6: the replay accepts a parameterized entities key like the collector', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gw706-'))
  try {
    const items = list(9)
    const rows = [{ label: 'Meine Liste', inPageState: true, stateItems: items, stateTotal: 9, entitiesKey: 'entities({"first":13})' }]
    const cards = items.map(i => `<a data-uia="standard-card" aria-label="${i.title}" href="/browse?jbv=${i.id}"></a>`).join('')
    const page = join(dir, 'p.html')
    writeFileSync(page, `<html><head><script>${pageStateScript(rows, 13)}</script></head><body>
<button data-uia="navigation+profile-menu+trigger"><img data-uia="navigation+profile-menu+Avatar" alt="Synthetic profile" src="/a.png"></button>
<section class="carousel-row"><div><div><h2>Meine Liste</h2></div></div><div data-uia="carousel-scroller"><div>${cards}</div></div></section></body></html>`)
    const file = join(dir, 'c.json')
    writeFileSync(file, JSON.stringify({ format: 'goodwatch-wishlist', completeness: 'unknown', items: items.map(i => ({ title: i.title, sourceId: i.id })) }))
    const out = JSON.parse(runScript('scripts/private-replay.mjs', [page, file]))
    assert.equal(out.savedPage.reference.found, true)
    assert.equal(out.captures[0].reportedTotal, 9)
    assert.equal(out.captures[0].loadedEdgesPresent, '9/9')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
