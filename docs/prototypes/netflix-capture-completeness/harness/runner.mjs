// Shared runner for the #706 benchmark and stress runs.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClock, createPage, loadCollector } from './sim.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const COLLECTORS = {
  M0: join(root, 'baseline/capture-v004.js'),
  M1: join(root, 'extension/capture.js'),
  A: join(root, 'extension/capture.js'),
}

const DEFAULT_CLICK_MS = 1500
const HUMAN_LOOK_MS = 1000
const POPUP_POLL_MS = 1500

// ---- Member models ---------------------------------------------------------
async function memberClicksUntilRepeat(page, clock, ctx, { maxLaps = 1, stopAtCount = null } = {}) {
  const row = page.myList
  if (!row) {
    // Grid: the member scrolls to the end.
    await clock.advance(5000)
    return
  }
  const startWraps = row.wraps
  let guard = 0
  while (row.wraps - startWraps < maxLaps && guard++ < 400 && !ctx.ended) {
    if (stopAtCount) {
      const r = stopAtCount()
      if (r.verdict?.reportedTotal != null && r.observedCount >= r.verdict.reportedTotal) return
    }
    row.nextButton().click()
    ctx.arrowClicks++
    ctx.actions++
    await clock.advance(ctx.clickMs || DEFAULT_CLICK_MS)
  }
  // The member sees the first titles again, looks, then acts.
  await clock.advance(HUMAN_LOOK_MS)
}

async function runOnce(route, scenario, { pageOptions, events, ctx }) {
  const clock = createClock()
  const page = createPage(clock, pageOptions)
  const command = loadCollector(page, clock, COLLECTORS[route])
  const t0 = clock.now()
  const due = [...(events || [])].sort((a, b) => a.at - b.at)
  let reloaded = false
  // Events fire on the virtual clock.
  for (const event of due) {
    clock.setTimeout(() => {
      if (event.kind === 'profile') page.switchProfile()
      else if (event.kind === 'navigate') page.navigateAway()
      else if (event.kind === 'replace') page.replaceMyListSection()
      else if (event.kind === 'add') page.addItem(event.item, event.index)
      else if (event.kind === 'remove') page.removeItem(event.id)
      else if (event.kind === 'reload') { reloaded = true; ctx.ended = true }
    }, event.at)
  }
  ctx.actions += 2 // open popup, start
  let response = command(route === 'A' ? { action: 'start', mode: 'assisted' } : { action: 'start' })
  if (response.state !== 'capturing') {
    page.close()
    return { response, clock, t0, page, reloaded }
  }
  const assisted = route === 'A' && response.traversal?.outcome !== 'needs_reference'
  if (route === 'A' && !assisted) ctx.actions += 1 // read the popup's fallback instruction
  if (assisted) {
    // The popup stays open and polls; the member waits.
    for (let i = 0; i < 400; i++) {
      await clock.advance(POPUP_POLL_MS)
      if (reloaded) break
      response = command({ action: 'status' })
      if (response.state !== 'capturing' || response.traversal?.outcome === 'manual_fallback') break
    }
    ctx.arrowClicks += response.traversal?.advances ?? 0
    if (response.traversal?.outcome === 'manual_fallback' && !reloaded) {
      // The popup asks the member to click through; continue as manual.
      ctx.actions += 1
      response = await memberManual(route, scenario, page, clock, ctx, command)
    } else if (!reloaded) {
      if (response.state === 'capturing') {
        ctx.actions += 1
        response = command({ action: 'stop' })
      }
      ctx.actions += 1 // save
    }
  } else if (!reloaded) {
    response = await memberManual(route, scenario, page, clock, ctx, command, () => reloaded)
  }
  page.close()
  return { response, clock, t0, page, reloaded }
}

async function memberManual(route, scenario, page, clock, ctx, command, wasReloaded = () => false) {
  const stopAtCount = scenario.member === 'stop-at-count' && route !== 'M0' ? () => command({ action: 'status' }) : null
  await memberClicksUntilRepeat(page, clock, ctx, { stopAtCount })
  if (wasReloaded()) return command({ action: 'status' })
  ctx.actions += 1 // reopen popup
  let response = command({ action: 'status' })
  if (route !== 'M0' && !stopAtCount && response.state === 'capturing' && response.verdict?.completeness !== 'complete' &&
      ['below_total', 'positions_unconfirmed'].includes(response.verdict?.reason)) {
    // The popup says titles are missing: the member goes round once more.
    await memberClicksUntilRepeat(page, clock, ctx)
    ctx.actions += 1
  }
  ctx.actions += 1 // stop and save
  return command({ action: 'stop' })
}

export async function runScenario(route, scenario) {
  const ctx = { actions: 0, arrowClicks: 0, ended: false, clickMs: scenario.clickMs }
  let run = await runOnce(route, scenario, { pageOptions: scenario.page, events: scenario.events, ctx })
  let elapsed = run.clock.now() - run.t0
  let restarted = false
  if (run.reloaded) {
    // The reload destroys the collector; the popup can't reach it, so no file.
    // The member opens the popup and starts again on the fresh page.
    restarted = true
    const ctx2 = { actions: ctx.actions, arrowClicks: ctx.arrowClicks, ended: false, clickMs: scenario.clickMs }
    const second = await runOnce(route, scenario, { pageOptions: scenario.page, events: [], ctx: ctx2 })
    elapsed += second.clock.now() - second.t0
    ctx.actions = ctx2.actions
    ctx.arrowClicks = ctx2.arrowClicks
    run = second
  }
  const r = run.response
  const truth = new Set(scenario.page.items.map(item => item.id))
  const removed = new Set((scenario.events || []).filter(e => e.kind === 'remove').map(e => e.id))
  // Ground truth is membership at Start (what the reported total describes).
  const captured = r.envelope ? r.envelope.items.map(item => item.sourceId) : null
  const capturedSet = new Set(captured || [])
  const hit = [...truth].filter(id => capturedSet.has(id)).length
  const contamination = captured ? captured.filter(id => !truth.has(id)).length : 0
  const completeness = r.envelope?.completeness ?? (r.code === 'list_empty' ? 'complete' : 'no file')
  const exact = captured !== null && hit === truth.size && contamination === 0
  return {
    scenario: scenario.id,
    name: scenario.name,
    added: Boolean(scenario.added),
    route,
    truth: truth.size,
    captured: captured ? captured.length : null,
    recall: truth.size ? hit / truth.size : (captured && captured.length === 0 ? 1 : null),
    contamination,
    otherRowIds: captured ? captured.filter(id => !truth.has(id) && /^9[0-2]/.test(id)).length : 0,
    completeness,
    code: r.code,
    reason: r.verdict?.reason ?? null,
    reportedTotal: r.verdict?.reportedTotal ?? null,
    falseComplete: completeness === 'complete' && !exact,
    actions: ctx.actions,
    arrowClicks: ctx.arrowClicks,
    // Protocol G12, computed independently of the implementation's own cap:
    // ceil(total / visible cards) + 3 advances, plus a stall budget of 3.
    protocolAdvanceCap: r.traversal?.mode === 'assisted' && r.verdict?.reportedTotal != null
      ? Math.ceil(r.verdict.reportedTotal / (scenario.page.visible ?? 6)) + 3 + 3 : null,
    lastRunAdvances: r.traversal?.mode === 'assisted' ? r.traversal.advances : null,
    collectorElapsedMs: r.elapsedMs ?? null,
    traversalOutcome: r.traversal?.outcome ?? null,
    assistOutcome: r.traversal?.outcome ?? null,
    elapsedS: Math.round(elapsed / 100) / 10,
    restarted,
    removedDuringCapture: removed.size,
    missingIds: captured ? [...truth].filter(id => !capturedSet.has(id)).slice(0, 5) : [],
  }
}

