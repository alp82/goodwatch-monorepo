'use strict'

// Popup for the experimental My List capture, version 0.0.5. It talks to
// capture.js in the active tab through chrome.scripting only, after the member
// opens the popup. Page values reach the DOM via textContent only.

const POLL_MS = 1000

const STATE_TEXT = {
  idle: 'Open My List on netflix.com in this tab.',
  wrong_page: 'Open My List on netflix.com in this tab, then open this again.',
  boundary_missing: 'GoodWatch can\'t find the My List row on this page. Wait until it has loaded and try again.',
  boundary_ambiguous: 'GoodWatch found more than one list. Close any open title details and try again.',
  list_empty: 'Netflix says My List is empty.',
  cancelled: 'Capture canceled. Nothing was saved.',
  terminated_navigation: 'The tab left My List, so the capture was thrown away.',
  terminated_profile: 'The Netflix profile changed, so the capture was thrown away.',
  tab_unreachable: 'This extension can\'t run on this page.',
  no_response: 'The capture didn\'t answer. Refresh the Netflix tab and try again.',
}

// Short reasons for an incomplete file.
const REASON_TEXT = {
  below_total: 'Some titles didn\'t load.',
  above_total: 'There are more titles than Netflix reported. The list may have changed while capturing.',
  loaded_title_missing: 'Some of the first titles weren\'t captured.',
  order_mismatch: 'The first titles didn\'t match Netflix\'s order.',
  not_in_listing: 'A captured title isn\'t one Netflix listed.',
  lap_not_finished: 'The capture didn\'t reach the end of the row.',
  conflicting_cards: 'Some titles couldn\'t be read reliably.',
  unreadable_cards: 'Some titles couldn\'t be read reliably.',
  no_profile_guard: 'GoodWatch couldn\'t confirm which profile is open.',
  ended_terminated_boundary: 'My List disappeared from the page.',
  ended_limit_rows: 'The capture reached its size limit.',
  ended_limit_time: 'The capture reached its time limit.',
}

const KNOWN_STATES = new Set(['idle', 'capturing', 'stopped', 'cancelled', 'terminated'])
const KEEPABLE_CODES = new Set(['stopped', 'list_empty', 'terminated_boundary', 'limit_rows', 'limit_time'])

const el = (id) => document.getElementById(id)
const ui = {
  state: el('state'),
  progress: el('progress'),
  detail: el('detail'),
  assist: el('assist'),
  manual: el('manual'),
  stop: el('stop'),
  save: el('save'),
  cancel: el('cancel'),
  savedLine: el('saved-line'),
  diagnostics: el('diagnostics'),
  diagnosticsText: el('diagnostics-text'),
}

let tabId = null
let onMyList = false
let busy = false
let pollTimer = null
let current = { state: 'idle', code: 'idle' }
let envelope = null
let savedName = null

const text = (value) => (typeof value === 'string' ? value : '')
const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null)
const titles = (n) => (n === 1 ? '1 title' : `${n.toLocaleString()} titles`)

function isEnvelope(value) {
  return value !== null && typeof value === 'object' && value.format === 'goodwatch-wishlist' &&
    value.version === 1 && typeof value.source === 'string' && typeof value.completeness === 'string' &&
    Array.isArray(value.items)
}

function progressLine(r) {
  const captured = count(r.observedCount) ?? 0
  const total = count(r.verdict?.reportedTotal)
  return total === null ? `${titles(captured)} captured.` : `${captured.toLocaleString()} of ${total.toLocaleString()} captured.`
}

function finishedText(r) {
  const v = r.verdict || {}
  const captured = count(r.observedCount) ?? 0
  const total = count(v.reportedTotal)
  if (v.completeness === 'complete') return total === 0 ? STATE_TEXT.list_empty : `All ${titles(captured)} on My List captured.`
  if (total === null) return `${titles(captured)} captured. Netflix didn't report a total, so GoodWatch can't tell if that's all of them.`
  return `${captured.toLocaleString()} of the ${titles(total)} on My List captured. The file is marked incomplete.`
}

function diagnosticsLine(r) {
  const v = r.verdict || {}
  return [
    `v${text(r.version) || '?'}`,
    text(r.traversal?.mode) || 'manual',
    `${count(r.observedCount) ?? '?'}/${count(v.reportedTotal) ?? '?'}`,
    text(v.completeness), text(v.reason),
    `code=${text(r.code)}`,
    r.traversal?.mode === 'assisted' ? `advances=${count(r.traversal.advances) ?? '?'} outcome=${text(r.traversal.outcome)}` : '',
    `lap=${r.lapSeen === true}`, `order=${text(r.orderCheck)}`, `rebinds=${count(r.rebinds) ?? 0}`,
    `rejected=${count(r.rejectedCount) ?? 0}`, `profileGuard=${r.profileGuard === true}`,
    `seconds=${Math.round((count(r.elapsedMs) ?? 0) / 100) / 10}`,
  ].filter(Boolean).join(' ')
}

function render() {
  const state = text(current.state)
  const code = text(current.code)
  const capturing = state === 'capturing'
  const assisted = current.traversal?.mode === 'assisted' && current.traversal?.outcome !== 'needs_reference'
  const finished = envelope !== null

  let line = STATE_TEXT[code] ?? STATE_TEXT[state] ?? 'Something unexpected happened.'
  if (state === 'idle' && code === 'idle' && onMyList) line = 'Ready to capture My List in this tab.'
  let detail = ''
  if (capturing) {
    line = assisted ? 'Going through My List…' : 'Click the next arrow on the My List row until its first title comes back.'
    if (current.traversal?.outcome === 'needs_reference') {
      detail = 'Netflix didn\'t report a total for this row, so GoodWatch can\'t go through it for you or tell when it\'s complete.'
    } else if (assisted) {
      detail = 'Keep this tab open and leave the page alone until this finishes.'
    } else if (current.lapSeen === true && current.verdict?.reason === 'below_total') {
      detail = 'The row is back at its start, but some titles are still missing. Go round once more, a little slower.'
    }
  } else if (finished) {
    line = finishedText(current)
    if (current.verdict?.completeness !== 'complete') detail = REASON_TEXT[text(current.verdict?.reason)] ?? ''
    if (current.verdict?.reason === 'below_total' && current.traversal?.mode === 'assisted') {
      detail = 'The row ended before every title showed up. Netflix may count titles that aren\'t available in your country.'
    }
    if (state === 'terminated' && REASON_TEXT[`ended_${code}`]) detail = REASON_TEXT[`ended_${code}`]
  }
  ui.state.textContent = line
  ui.progress.hidden = !capturing
  ui.progress.textContent = capturing ? progressLine(current) : ''
  ui.detail.hidden = detail === ''
  ui.detail.textContent = detail

  const ready = !capturing && tabId !== null
  ui.assist.hidden = !ready || (finished && current.verdict?.completeness === 'complete')
  const retry = finished || state === 'cancelled' || state === 'terminated'
  ui.assist.textContent = retry ? 'Try again' : 'Capture My List'
  ui.assist.classList.toggle('primary', !finished)
  ui.manual.hidden = !ready || finished
  ui.stop.hidden = !capturing
  ui.cancel.hidden = !capturing
  ui.save.hidden = capturing || !finished
  ui.save.textContent = savedName === null ? 'Save file' : 'Save file again'
  for (const button of [ui.assist, ui.manual, ui.stop, ui.save, ui.cancel]) button.disabled = busy

  ui.savedLine.hidden = savedName === null || !finished
  ui.savedLine.textContent = savedName ? `Saved ${savedName} to your Downloads folder.` : ''

  const showDiagnostics = capturing || finished || state === 'terminated'
  ui.diagnostics.hidden = !showDiagnostics
  ui.diagnosticsText.textContent = showDiagnostics ? diagnosticsLine(current) : ''
}

function forget() {
  envelope = null
  savedName = null
}

function fail(code) {
  forget()
  current = { state: 'unknown', code }
}

function accept(response) {
  if (response === null || typeof response !== 'object' || !KNOWN_STATES.has(text(response.state))) {
    fail('no_response')
    return
  }
  const wasCapturing = text(current.state) === 'capturing'
  current = response
  const keepable = ['stopped', 'terminated'].includes(text(response.state)) && KEEPABLE_CODES.has(text(response.code))
  if (!keepable || !isEnvelope(response.envelope)) {
    forget()
    return
  }
  const isNew = envelope === null || wasCapturing
  envelope = response.envelope
  if (isNew) savedName = null
}

// Runs in the page's isolated world. capture.js defines the global there.
function pageCommand(command, probeOnly) {
  const api = globalThis.__goodwatchWishlistCaptureCommand
  if (typeof api !== 'function') return probeOnly ? { state: 'idle', code: 'idle' } : null
  return api(command)
}

async function run(command, { inject = false, probeOnly = false } = {}) {
  if (inject) await chrome.scripting.executeScript({ target: { tabId }, files: ['capture.js'] })
  const [frame] = await chrome.scripting.executeScript({ target: { tabId }, func: pageCommand, args: [command, probeOnly] })
  return frame ? frame.result : null
}

function syncPolling() {
  if (text(current.state) === 'capturing' && !document.hidden) {
    if (pollTimer === null) pollTimer = setInterval(poll, POLL_MS)
  } else if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function poll() {
  if (busy || tabId === null) return
  try {
    accept(await run({ action: 'status' }, { probeOnly: true }))
  } catch {
    fail('tab_unreachable')
  }
  render()
  syncPolling()
}

function fileName(source) {
  const safe = text(source).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'capture'
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `goodwatch-wishlist-${safe}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`
}

function saveFile() {
  if (envelope === null) return
  const name = fileName(envelope.source)
  const url = URL.createObjectURL(new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  savedName = name
}

async function act(command, options) {
  if (busy || tabId === null) return
  busy = true
  render()
  try {
    accept(await run(command, options))
    if (command.action === 'stop' && envelope !== null) saveFile()
  } catch {
    fail('tab_unreachable')
  } finally {
    busy = false
    render()
    syncPolling()
  }
}

ui.assist.addEventListener('click', () => {
  forget()
  act({ action: 'start', mode: 'assisted' }, { inject: true })
})
ui.manual.addEventListener('click', () => {
  forget()
  act({ action: 'start' }, { inject: true })
})
ui.stop.addEventListener('click', () => act({ action: 'stop' }))
ui.cancel.addEventListener('click', () => act({ action: 'cancel' }))
ui.save.addEventListener('click', () => {
  saveFile()
  render()
})
document.addEventListener('visibilitychange', syncPolling)

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    tabId = tab && Number.isInteger(tab.id) ? tab.id : null
    // activeTab exposes the URL while the popup is open; nothing is stored.
    onMyList = /^https:\/\/www\.netflix\.com\/browse\/my-list\/?(?:[?#]|$)/.test(text(tab?.url))
  } catch {
    tabId = null
  }
  if (tabId === null) {
    fail('tab_unreachable')
    render()
    return
  }
  // A status check only. It doesn't load capture.js or read titles.
  try {
    accept(await run({ action: 'status' }, { probeOnly: true }))
  } catch {
    fail('tab_unreachable')
    tabId = null
  }
  render()
  syncPolling()
}

init()
