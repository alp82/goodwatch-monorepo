// Regression tests for the first independent review of version 0.0.5
// (ticket #706). Each test reproduces one finding; synthetic data only.
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
const list = (n, start = 1001) => Array.from({ length: n }, (_, i) => ({ id: String(start + i), title: `Invented ${i + 1}`, type: i % 2 ? 'show' : 'movie' }))
const foreign = { id: '9901', title: 'Invented promo', type: 'show' }

// Finding 1: assisted clicking must never press a control outside the row's own scroller.
test('1: an arrow-like button in a dialog inside the row is never clicked', async () => {
  const clock = createClock()
  const page = createPage(clock, { items: list(30) })
  const row = page.document.querySelector('section.carousel-row')
  page.myList.nextButton().remove()
  const dialog = page.document.createElement('div')
  dialog.setAttribute('role', 'dialog')
  dialog.innerHTML = '<button data-uia="carousel-hawkins-right-button" aria-label="Preview next">Preview next</button>'
  row.append(dialog)
  let wrongClicks = 0
  dialog.firstChild.addEventListener('click', () => wrongClicks++)
  const command = loadCollector(page, clock, collector)
  command({ action: 'start', mode: 'assisted' })
  await clock.advance(5000)
  const r = command({ action: 'status' })
  assert.equal(wrongClicks, 0)
  // Unsure: fall back to manual and keep capturing.
  assert.equal(r.state, 'capturing')
  assert.equal(r.traversal.outcome, 'manual_fallback')
  page.close()
})

test('1: a second matching arrow elsewhere in the row makes assisted mode fall back', async () => {
  const clock = createClock()
  const page = createPage(clock, { items: list(30) })
  const extra = page.document.createElement('div')
  extra.innerHTML = '<div><button data-uia="carousel-hawkins-right-button">x</button></div>'
  page.document.querySelector('section.carousel-row [data-uia="carousel-scroller"]').append(extra)
  let extraClicks = 0
  extra.querySelector('button').addEventListener('click', () => extraClicks++)
  const command = loadCollector(page, clock, collector)
  command({ action: 'start', mode: 'assisted' })
  await clock.advance(5000)
  assert.equal(extraClicks, 0)
  assert.equal(page.myList.clicks, 0)
  assert.equal(command({ action: 'status' }).traversal.outcome, 'manual_fallback')
  page.close()
})

// Finding 2: a stale reference must not produce complete.
test('2: a stale 7-title reference for a 30-title row is never complete', async () => {
  const clock = createClock()
  const items = list(30)
  const page = createPage(clock, { items })
  page.document.querySelector('script').textContent = pageStateScript([{ label: 'Meine Liste', inPageState: true, stateItems: items.slice(0, 7), stateTotal: 7 }], 13)
  const command = loadCollector(page, clock, collector)
  command({ action: 'start', mode: 'assisted' })
  await clock.advance(2000)
  assert.notEqual(command({ action: 'status' }).verdict.completeness, 'complete')
  await clock.advance(60000)
  const r = command({ action: 'stop' })
  assert.notEqual(r.verdict.completeness, 'complete')
  assert.notEqual(r.envelope.completeness, 'complete')
  page.close()
})

test('2: a reference from another profile is rejected', async () => {
  const r = await runScenario('A', { page: { items: list(30), stateProfile: { profiles: ['Synthetic profile', 'Second profile'], current: 'Second profile' } } })
  assert.notEqual(r.completeness, 'complete')
  assert.equal(r.reason, 'reference_other_profile')
})

test('2: a reference from a document first loaded on another page is rejected', async () => {
  const r = await runScenario('A', { page: { items: list(30), loadedPath: '/browse' } })
  assert.notEqual(r.completeness, 'complete')
  assert.equal(r.reason, 'reference_other_page')
})

// Finding 3: profile identity fails closed, and empty captures keep their guards.
test('3: a missing avatar alt text gives no profile guard and no complete', async () => {
  const r = await runScenario('A', { page: { items: list(30), avatarAlt: '' } })
  assert.notEqual(r.completeness, 'complete')
})

test('3: two profiles with the same name cannot be told apart', async () => {
  const r = await runScenario('A', { page: { items: list(30), stateProfile: { profiles: ['Synthetic profile', 'Synthetic profile'], current: 'Synthetic profile' } } })
  assert.notEqual(r.completeness, 'complete')
})

test('3: an empty result is discarded after a profile switch and navigation', async () => {
  const clock = createClock()
  const page = createPage(clock, { items: [], emptyRow: 'state-only' })
  const command = loadCollector(page, clock, collector)
  assert.equal(command({ action: 'start' }).code, 'list_empty')
  page.switchProfile()
  page.navigateAway()
  const r = command({ action: 'status' })
  assert.match(r.code, /^terminated_/)
  assert.equal(r.envelope, undefined)
  assert.notEqual(r.verdict.completeness, 'complete')
  page.close()
})

// Finding 4: only cards proven to be in My List may enter the file.
test('4: a recommendation section inside the grid never enters the file', async () => {
  const clock = createClock()
  const page = createPage(clock, { items: list(30), layout: 'grid' })
  page.document.querySelector('.gallery').insertAdjacentHTML('beforeend',
    '<section><h2>Recommendations</h2><div class="ptrack-content"><a href="/title/9001"><span class="fallback-text">Invented foreign title</span></a></div></section>')
  const command = loadCollector(page, clock, collector)
  command({ action: 'start' })
  await clock.advance(1000)
  const r = command({ action: 'stop' })
  assert.equal(r.envelope.items.filter(item => item.sourceId === '9001').length, 0)
  assert.equal(r.observedCount, 30)
  page.close()
})

test('4: a headed group inside the row scroller never enters the file', async () => {
  const clock = createClock()
  const page = createPage(clock, { items: list(5) })
  page.document.querySelector('section.carousel-row [data-uia="carousel-scroller"]').insertAdjacentHTML('beforeend',
    '<div role="group" aria-label="More like this"><a data-uia="standard-card" aria-label="Invented foreign" href="/browse?jbv=9002"></a></div>')
  const command = loadCollector(page, clock, collector)
  command({ action: 'start' })
  await clock.advance(1000)
  const r = command({ action: 'stop' })
  assert.equal(r.envelope.items.filter(item => item.sourceId === '9002').length, 0)
  page.close()
})

// Finding 5: check every known position, and require positive wrap evidence by ID.
test('5: a foreign card at a known position not shown at Start is caught', async () => {
  for (const route of ['M1', 'A']) {
    const r = await runScenario(route, { page: { items: list(77), unavailable: ['1060'], contaminants: [{ index: 9, item: foreign }] } })
    assert.notEqual(r.completeness, 'complete', route)
    assert.equal(r.reason, 'order_mismatch', route)
  }
})

test('5: starting with the row moved away from its first title still checks positions', async () => {
  const clock = createClock()
  const page = createPage(clock, { items: list(40), unavailable: ['1035'], contaminants: [{ index: 2, item: foreign }] })
  page.myList.nextButton().click()
  await clock.advance(1500)
  const command = loadCollector(page, clock, collector)
  command({ action: 'start' })
  for (let i = 0; i < 12; i++) {
    page.myList.nextButton().click()
    await clock.advance(1500)
  }
  await clock.advance(1000)
  const r = command({ action: 'stop' })
  assert.notEqual(r.verdict.completeness, 'complete')
  page.close()
})

test('5: a missing next arrow is not lap evidence', async () => {
  const clock = createClock()
  const page = createPage(clock, { items: list(40) })
  const command = loadCollector(page, clock, collector)
  command({ action: 'start' })
  page.myList.nextButton().click()
  await clock.advance(1500)
  page.myList.nextButton().remove()
  await clock.advance(1500)
  assert.equal(command({ action: 'status' }).lapSeen, false)
  page.close()
})

test('5: a stalled, repeating window is not a lap', async () => {
  const clock = createClock()
  const page = createPage(clock, { items: list(7) })
  // The arrow does nothing: replace it with a copy that has no listener.
  const dead = page.myList.nextButton()
  dead.replaceWith(dead.cloneNode(true))
  const command = loadCollector(page, clock, collector)
  command({ action: 'start', mode: 'assisted' })
  await clock.advance(30000)
  const r = command({ action: 'status' })
  assert.equal(r.lapSeen, false)
  assert.notEqual(r.verdict.completeness, 'complete')
  page.close()
})

// Finding 6: the 3-minute assisted deadline holds during waits too.
test('6: assisted traversal stops by its 3-minute deadline', async () => {
  const clock = createClock()
  const page = createPage(clock, { items: list(400), visible: 4, renderDelay: 1450, fetchDelay: 3600 })
  const command = loadCollector(page, clock, collector)
  command({ action: 'start', mode: 'assisted' })
  let clicksAtDeadline = null
  for (let t = 0; t < 400; t++) {
    await clock.advance(500)
    const r = command({ action: 'status' })
    if (r.elapsedMs >= 180000 && clicksAtDeadline === null) clicksAtDeadline = page.myList.clicks
    if (r.state !== 'capturing') break
  }
  const r = command({ action: 'status' })
  assert.equal(r.state, 'stopped')
  assert.ok(r.elapsedMs <= 180000 + 200, `elapsed ${r.elapsedMs}`)
  assert.ok(clicksAtDeadline === null || page.myList.clicks === clicksAtDeadline)
  page.close()
})

// Finding 7: scripts print fixed codes and anonymous labels, never private input.
test('7: replay and compare never print private input or file names', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gw706-'))
  try {
    const secret = 'PRIVATE-TITLE-Zq81'
    const bad = join(dir, `secret-name-${secret}.json`)
    writeFileSync(bad, `{"items":[{"title":"${secret}"`)
    const good = join(dir, `another-${secret}.json`)
    writeFileSync(good, JSON.stringify({ format: 'goodwatch-wishlist', completeness: 'unknown', items: [{ title: secret, sourceId: '1' }] }))
    const run = (script, args) => {
      try {
        return execFileSync(process.execPath, [join(root, script), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      } catch (error) {
        return `${error.stdout}${error.stderr}`
      }
    }
    const compare = run('scripts/compare-captures.mjs', [good, bad])
    assert.ok(!compare.includes(secret), compare)
    assert.match(compare, /capture_unreadable/)
    const html = join(dir, 'page.html')
    writeFileSync(html, `<html><body><script>netflix.reactContext.models.graphql = JSON.parse('{"data":${secret}');</script></body></html>`)
    const replay = run('scripts/private-replay.mjs', [html, bad])
    assert.ok(!replay.includes(secret), replay)
    assert.ok(!replay.includes(dir), replay)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('7: the replay reader refuses an ambiguous reference like the collector', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gw706-'))
  try {
    const rows = [
      { label: 'Meine Liste', inPageState: true, stateItems: list(5), stateTotal: 5 },
      { label: 'Meine Liste', inPageState: true, stateItems: list(9, 2001), stateTotal: 9 },
    ]
    const html = join(dir, 'page.html')
    const cards = list(5).map(i => `<a data-uia="standard-card" aria-label="${i.title}" href="/browse?jbv=${i.id}"></a>`).join('')
    writeFileSync(html, `<html><head><script>${pageStateScript(rows, 13)}</script></head><body>
<button data-uia="navigation+profile-menu+trigger"><img data-uia="navigation+profile-menu+Avatar" alt="Synthetic profile" src="/a.png"></button>
<section class="carousel-row"><div><div><h2>Meine Liste</h2></div></div><div data-uia="carousel-scroller"><div>${cards}</div></div></section></body></html>`)
    const capture = join(dir, 'c.json')
    writeFileSync(capture, JSON.stringify({ format: 'goodwatch-wishlist', completeness: 'unknown', items: list(5).map(i => ({ title: i.title, sourceId: i.id })) }))
    const out = execFileSync(process.execPath, [join(root, 'scripts/private-replay.mjs'), html, capture], { encoding: 'utf8' })
    assert.match(out, /reference_ambiguous/)
    assert.doesNotMatch(out, /count rule met/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
