// Core session tests (ticket #730): traversal bounds, finalize lifecycle and the
// counts-only report, with a fake Netflix module, a fake observer bridge and a
// virtual clock. The real observer is tested in Chromium (observer.browser.mjs).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'

const context = vm.createContext({})
vm.runInContext(readFileSync(new URL('../extension/core.js', import.meta.url), 'utf8'), context)
vm.runInContext(readFileSync(new URL('../extension/netflix.js', import.meta.url), 'utf8'), context)
const { GWCore, GWNetflixVerdict } = context

function clock() {
  let now = 1_000_000
  let seq = 0
  const timers = new Map()
  return {
    now: () => now,
    setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { at: now + Math.max(0, ms), fn }); return id },
    clearTimeout: id => timers.delete(id),
    setInterval: (fn, ms) => { const id = ++seq; timers.set(id, { at: now + ms, fn, every: ms }); return id },
    clearInterval: id => timers.delete(id),
    advance(ms) {
      const end = now + ms
      for (;;) {
        let next = null
        for (const [id, t] of timers) if (t.at <= end && (!next || t.at < next[1].at)) next = [id, t]
        if (!next) break
        const [id, t] = next
        now = t.at
        if (t.every) t.at += t.every; else timers.delete(id)
        t.fn()
      }
      now = end
    },
  }
}

const inline = n => Array.from({ length: Math.min(13, n) }, (_, p) => ({ position: p, id: String(5001 + p), title: `Invented ${p}`, entityType: p % 2 ? 'Show' : 'Movie', treatment: 'standard' }))
const entry = p => ({ position: p, id: String(5001 + p), title: `Invented ${p}`, entityType: p % 2 ? 'Show' : 'Movie', treatment: 'standard' })

// A fake world: a module whose arrow asks a fake server for the next page, and a
// bridge that behaves like the observer (bindings, pending, outbox, cutoff, seal).
function world(o = {}) {
  const c = clock()
  const total = o.total ?? 40
  const state = { marker: 'P1', page: true, row: true, fingerprintOk: true, loaded: 12, clicks: 0, cards: [] }
  const obs = { open: true, gen: 1, pending: new Map(), outbox: [], sticky: new Set(), counters: { accepted: 0, myListBindings: 0, afterCutoff: 0, lateDropped: 0, rejected: {} }, calls: [], integrity: { fetch: true, open: true, send: true } }
  let bindingSeq = 0
  const deliver = (afterPos, size, delay) => {
    if (!obs.open) { obs.counters.afterCutoff++; return }
    const id = ++bindingSeq
    const gen = obs.gen
    obs.pending.set(id, true)
    obs.counters.myListBindings++
    c.setTimeout(() => {
      if (gen !== obs.gen) { obs.counters.lateDropped++; return }
      const entries = []
      for (let p = afterPos + 1; p < Math.min(total, afterPos + 1 + size); p++) entries.push(o.entryAt ? o.entryAt(p) : entry(p))
      obs.counters.accepted++
      obs.outbox.push({ id, page: { afterPosition: afterPos, pageSize: size, total, version: '1', entries } })
    }, delay)
  }
  const button = {
    click() {
      state.clicks++
      if (o.deadArrow) return
      const size = o.stepSize ?? 6
      const delay = typeof o.delay === 'function' ? o.delay(state.clicks) : (o.delay ?? 700)
      if (state.loaded < total - 1) { deliver(state.loaded, size, delay); state.loaded = Math.min(total - 1, state.loaded + size) }
    },
  }
  const module = {
    matchesPage: () => state.page,
    profileMarker: () => state.marker,
    readReference: () => (o.refusal ? { refusal: o.refusal } : { reference: { rowId: 'ROW1', label: 'Meine Liste', total, version: '1', entries: o.inlineEntries ?? inline(total), fingerprint: 'F1' } }),
    referenceUnchanged: () => state.fingerprintOk,
    rowPresent: () => state.row,
    nextButton: () => (o.noArrow ? null : button),
    readCards: () => state.cards,
    cardsInView: () => o.cardsInView ?? 7,
    observerConfig: (ref, marker, token, channel) => ({ token, channel, rowId: ref.rowId }),
    verdict: GWNetflixVerdict,
    release() { module.released = true },
    released: false,
  }
  const bridge = {
    request(op) {
      obs.calls.push(op)
      if (op === 'cutoff') obs.open = false
      if (op === 'seal') { obs.open = false; for (const _ of obs.pending.keys()) obs.sticky.add('pending_unresolved'); obs.pending.clear(); obs.outbox.length = 0; obs.gen++ }
      const outbox = op === 'pull' ? obs.outbox.splice(0) : []
      for (const x of outbox) obs.pending.delete(x.id)
      const reply = { generation: obs.gen, pending: obs.pending.size, sticky: [...obs.sticky], counters: { ...obs.counters, rejected: { ...obs.counters.rejected } }, integrity: { ...obs.integrity }, installedAtMsAfterLoad: 1200, outbox: outbox.map(x => x.page) }
      if (op === 'cleanup') reply.cleanupResult = o.cleanupResult ?? 'restored'
      return reply
    },
  }
  return { c, state, obs, module, bridge, total }
}
function start(w) {
  const s = GWCore.createSession({ module: w.module, bridge: w.bridge, clock: w.c, random: () => 'abc' })
  const prep = s.prepare()
  if (prep.ok) s.begin({ ok: true, installedAtMsAfterLoad: 1200 })
  return s
}
function finish(w, s, ms = 6000) {
  s.finalize()
  w.c.advance(ms)
  return s.status()
}

test('coverage reached: traversal stops, finalize gives partial snapshot_unproven with full coverage', () => {
  const w = world()
  const s = start(w)
  w.c.advance(60000)
  assert.equal(s.status().state, 'traversal_stopped')
  const r = finish(w, s)
  assert.equal(r.state, 'finalized')
  assert.equal(r.result.verdict, 'partial')
  assert.equal(r.result.reason, 'snapshot_unproven')
  assert.equal(r.result.report.traversalOutcome, 'coverage_reached')
  assert.equal(r.result.report.positionsCovered, 40)
  assert.equal(r.result.report.unobservedPositions, 0)
  assert.equal(r.result.report.cleanupResult, 'restored')
})

test('click cap: ceil(total / cards in view) + 3 plus 3 more, fixed at Start, independent of gain', () => {
  const w = world({ total: 40, stepSize: 1, delay: 300 })
  const s = start(w)
  w.c.advance(170000)
  const cap = Math.ceil(40 / 7) + 3 + 3
  assert.equal(w.state.clicks, cap)
  assert.equal(s.status().report.traversalOutcome, 'advance_limit')
  assert.equal(s.status().report.clickCap, cap)
})

test('wait after a click is at most 8 seconds, then it counts toward the stall limit', () => {
  const w = world({ delay: 9000 })
  const s = start(w)
  const times = []
  const click = w.module.nextButton().click
  w.module.nextButton().click = function () { times.push(w.c.now()); return click.call(this) }
  w.c.advance(60000)
  assert.ok(times.length >= 2)
  // The second click follows the 8-second maximum wait, not the 9-second delivery.
  assert.ok(times[1] - times[0] >= 8000 && times[1] - times[0] < 8500, String(times[1] - times[0]))
  assert.ok(s.status().report.advances > s.status().report.positionsCovered / 6 - 1)
})

test('stall limit: 3 clicks without a newly accepted position', () => {
  const w = world({ deadArrow: true })
  const s = start(w)
  w.c.advance(60000)
  assert.equal(w.state.clicks, 3)
  assert.equal(s.status().report.traversalOutcome, 'stalled')
})

test('the 3-minute deadline holds inside waits', () => {
  const w = world({ total: 400, stepSize: 1, delay: 7900, cardsInView: 1 })
  const s = start(w)
  w.c.advance(400000)
  const st = s.status()
  assert.equal(st.report.traversalOutcome, 'assist_time_limit')
  assert.ok(st.report.traversalStoppedAfterMs <= 180000, String(st.report.traversalStoppedAfterMs))
})

test('manual fallback: no safe arrow means no clicks; the deadline still ends the traversal', () => {
  const w = world({ noArrow: true })
  const s = start(w)
  w.c.advance(10000)
  assert.equal(s.status().state, 'collecting')
  assert.equal(s.status().report.traversalOutcome, 'manual_fallback')
  w.c.advance(180000)
  assert.equal(s.status().state, 'traversal_stopped')
})

test('a page bound before the cutoff and delivered during the drain is accepted and transferred', () => {
  const w = world({ delay: n => (n === 4 ? 2000 : 700) })
  const s = start(w)
  w.c.advance(3700)
  s.stop()
  const r = finish(w, s)
  assert.ok(!r.result.report.stickyCodes.includes('pending_unresolved'))
  assert.ok(r.result.report.positionsCovered > 13)
})

test('a page still pending after the 3-second drain is pending_unresolved; the result is immutable', () => {
  const w = world({ delay: n => (n === 2 ? 20000 : 700) })
  const s = start(w)
  w.c.advance(2500)
  s.stop()
  const r = finish(w, s)
  assert.ok(r.result.report.stickyCodes.includes('pending_unresolved'))
  const frozen = JSON.stringify(r.result)
  w.c.advance(30000)
  assert.equal(JSON.stringify(s.status().result), frozen)
  assert.ok(Object.isFrozen(r.result) && Object.isFrozen(r.result.report))
  assert.ok(w.obs.calls.indexOf('seal') < w.obs.calls.indexOf('cleanup'))
})

test('cleanup runs before the result: a failed cleanup appears as cleanup_failed', () => {
  const w = world({ cleanupResult: 'failed' })
  const s = start(w)
  w.c.advance(60000)
  const r = finish(w, s)
  assert.equal(r.result.report.cleanupResult, 'failed')
  assert.ok(r.result.report.stickyCodes.includes('cleanup_failed'))
})

test('a displaced wrapper is reported: observer_displaced and cleanup inert', () => {
  const w = world({ cleanupResult: 'inert' })
  const s = start(w)
  w.c.advance(2000)
  w.obs.integrity.fetch = false
  w.c.advance(60000)
  const r = finish(w, s)
  assert.ok(r.result.report.stickyCodes.includes('observer_displaced'))
  assert.equal(r.result.report.cleanupResult, 'inert')
})

test('a profile change discards the session; late pages change nothing', () => {
  const w = world({ delay: 5000 })
  const s = start(w)
  w.c.advance(1500)
  w.state.marker = 'P2'
  w.c.advance(1000)
  const st = s.status()
  assert.equal(st.state, 'discarded')
  assert.equal(st.result.reason, 'ended_terminated_profile')
  const frozen = JSON.stringify(st.result)
  w.c.advance(20000)
  assert.equal(JSON.stringify(s.status().result), frozen)
  assert.ok(w.obs.calls.includes('seal') && w.obs.calls.includes('cleanup'))
})

test('navigation, fingerprint change and row loss each end the session with their own code', () => {
  for (const [key, value, code] of [['page', false, 'ended_terminated_navigation'], ['fingerprintOk', false, 'ended_reference_changed'], ['row', false, 'ended_terminated_boundary']]) {
    const w = world()
    const s = start(w)
    w.c.advance(1000)
    w.state[key] = value
    w.c.advance(1000)
    assert.equal(s.status().result.reason, code, key)
  }
})

test('conflicting reads have their own codes; identical duplicates are counted', () => {
  const w = world({ entryAt: p => (p === 20 ? { ...entry(p), id: '5003' } : entry(p)) })
  const s = start(w)
  w.c.advance(60000)
  const r = finish(w, s)
  assert.ok(r.result.report.stickyCodes.includes('id_conflict'))
})

test('unknown entity types withhold everything but partial with entity_type_unknown', () => {
  const w = world({ entryAt: p => (p === 30 ? { ...entry(p), entityType: 'Game' } : entry(p)) })
  const s = start(w)
  w.c.advance(60000)
  const r = finish(w, s)
  assert.equal(r.result.reason, 'entity_type_unknown')
  assert.equal(r.result.report.typeCounts.unknown, 1)
})

test('a stable card outside the entries downgrades with card_outside_entries', () => {
  const w = world()
  w.state.cards = [{ element: {}, sourceId: '9999', title: 'Foreign' }]
  const s = start(w)
  w.c.advance(60000)
  const r = finish(w, s)
  assert.equal(r.result.reason, 'card_outside_entries')
  assert.equal(r.result.report.cardsOutsideEntries, 1)
})

test('a reference refusal installs nothing and reports unknown', () => {
  const w = world({ refusal: 'reference_other_profile' })
  const s = GWCore.createSession({ module: w.module, bridge: w.bridge, clock: w.c, random: () => 'abc' })
  const prep = s.prepare()
  assert.equal(prep.ok, false)
  assert.equal(s.status().result.verdict, 'unknown')
  assert.equal(s.status().result.reason, 'reference_other_profile')
  assert.equal(w.obs.calls.length, 0)
})

test('cancel seals and cleans up; the report holds counts and codes only', () => {
  const w = world()
  const s = start(w)
  w.c.advance(3000)
  s.cancel()
  const st = s.status()
  assert.equal(st.state, 'discarded')
  assert.equal(st.result.reason, 'ended_cancelled')
  const text = JSON.stringify(st.result)
  assert.ok(!/Invented|500\d|ROW1|Meine Liste|P1/.test(text), text)
})

test('the verdict is never complete, even with full coverage and a clean session', () => {
  const v = GWNetflixVerdict({ reference: true, ended: null, profileGuard: true, sticky: [], unobserved: 0, unknownTypes: 0, cardsOutside: 0, titleConflicts: 0 })
  assert.deepEqual({ ...v }, { verdict: 'partial', reason: 'snapshot_unproven' })
})

// ---- Implementation review of 361b99e0 -------------------------------------------

test('review 5: every guard runs right before the arrow is clicked', () => {
  for (const [key, value, reason] of [['page', false, 'ended_terminated_navigation'], ['marker', 'P2', 'ended_terminated_profile']]) {
    const w = world()
    const s = start(w)
    w.c.advance(599)
    w.state[key] = value
    w.c.advance(1)
    assert.equal(w.state.clicks, 0, key)
    assert.equal(s.status().state, 'discarded', key)
    assert.equal(s.status().result.reason, reason, key)
  }
})

test('review 4: finalize and discard keep only the counts-only result', () => {
  for (const end of ['finalize', 'cancel']) {
    const w = world()
    w.state.cards = [{ element: {}, sourceId: '5001', title: 'Invented 0' }]
    const s = start(w)
    w.c.advance(60000)
    if (end === 'finalize') finish(w, s); else s.cancel()
    assert.deepEqual({ ...s.retainedEvidence() }, { membership: 0, positions: 0, signatures: 0, cards: 0, reference: false, marker: false, timers: 0 }, end)
    assert.equal(w.module.released, true, end)
    assert.ok(s.status().result)
  }
})
