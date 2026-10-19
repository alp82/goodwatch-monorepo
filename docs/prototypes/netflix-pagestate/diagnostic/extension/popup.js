'use strict'
// Popup for the counts-only diagnostic. Injects the isolated collector, then
// the page-world observer, and shows only what finalize returns.
const el = id => document.getElementById(id)
const ui = { state: el('state'), progress: el('progress'), start: el('start'), finish: el('finish'), stop: el('stop'), cancel: el('cancel'), copy: el('copy'), report: el('report') }
const TEXT = {
  idle: 'Open My List on netflix.com in this tab, then start the diagnostic.',
  preparing: 'Checking the page…',
  collecting: 'Going through My List…',
  traversal_stopped: 'Done clicking. Choose Finish to see the report.',
  finalizing: 'Finishing…',
  finalized: 'Finished. The report shows counts and codes only.',
  discarded: 'Ended early. The report shows why.',
}
let tabId = null
let current = null
let timer = null

async function command(cmd) {
  const [frame] = await chrome.scripting.executeScript({ target: { tabId }, func: c => (globalThis.__gwDiagCommand ? globalThis.__gwDiagCommand(c) : null), args: [cmd] })
  return frame ? frame.result : null
}
function render() {
  const s = current ? current.state : 'idle'
  ui.state.textContent = TEXT[s] || s
  const busy = ['collecting', 'traversal_stopped', 'finalizing', 'preparing'].includes(s)
  ui.progress.hidden = !busy || !current || current.reportedTotal === null
  if (!ui.progress.hidden) ui.progress.textContent = `${current.observed} of ${current.reportedTotal} positions observed`
  ui.start.hidden = busy || tabId === null
  ui.start.textContent = current && current.result ? 'Start again' : 'Start diagnostic'
  ui.finish.hidden = !['collecting', 'traversal_stopped'].includes(s)
  ui.stop.hidden = s !== 'collecting'
  ui.cancel.hidden = !['collecting', 'traversal_stopped'].includes(s)
  const result = current && current.result
  ui.report.hidden = !result
  ui.copy.hidden = !result
  if (result) ui.report.textContent = JSON.stringify({ verdict: result.verdict, reason: result.reason, ...result.report }, null, 2)
}
async function poll() {
  try {
    const r = await command({ action: 'status' })
    if (r) current = r.status
  } catch { current = { state: 'idle' } }
  render()
  if (current && ['finalized', 'discarded', 'idle'].includes(current.state) && timer) { clearInterval(timer); timer = null }
}
function startPolling() { if (!timer) timer = setInterval(poll, 500) }

ui.start.addEventListener('click', async () => {
  ui.start.hidden = true
  await chrome.scripting.executeScript({ target: { tabId }, files: ['core.js', 'netflix.js', 'content.js'] })
  const prep = await command({ action: 'prepare' })
  if (!prep || !prep.ok) { current = prep ? prep.status : null; render(); return }
  let install = { ok: false }
  try {
    await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, world: 'MAIN', files: ['observer.js'] })
    const [frame] = await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, world: 'MAIN', func: cfg => (typeof window.__gwDiagObserverInstall === 'function' ? window.__gwDiagObserverInstall(cfg) : { ok: false }), args: [prep.cfg] })
    install = frame ? frame.result : { ok: false }
  } catch { install = { ok: false } }
  const r = await command({ action: 'begin', install })
  current = r ? r.status : null
  render()
  startPolling()
})
ui.finish.addEventListener('click', async () => { const r = await command({ action: 'finalize' }); current = r && r.status; render(); startPolling() })
ui.stop.addEventListener('click', async () => { const r = await command({ action: 'stop' }); current = r && r.status; render() })
ui.cancel.addEventListener('click', async () => { const r = await command({ action: 'cancel' }); current = r && r.status; render() })
ui.copy.addEventListener('click', () => { navigator.clipboard.writeText(ui.report.textContent).catch(() => {}) })

;(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    tabId = tab && Number.isInteger(tab.id) ? tab.id : null
  } catch { tabId = null }
  if (tabId !== null) {
    try { await poll() } catch {}
    if (current && ['collecting', 'traversal_stopped', 'finalizing'].includes(current.state)) startPolling()
  }
  if (!current) current = { state: 'idle' }
  render()
})()
