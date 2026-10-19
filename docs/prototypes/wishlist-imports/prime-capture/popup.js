'use strict'

// Popup for the experimental Prime Video Watchlist capture. It talks to
// collector.js in the active tab through chrome.scripting only. Every value
// from the page is untrusted and reaches the DOM through textContent.

const POLL_MS = 1500

const MESSAGES = {
  idle: 'Not capturing. Open your Watchlist on Prime Video in this tab, refresh it, then choose Start capture.',
  capturing: 'Capturing. Scroll slowly to the end of the Watchlist, then open this popup again to stop.',
  stopped: 'Capture stopped.',
  cancelled: 'Capture canceled. Nothing was saved.',
  terminated_navigation: 'The capture ended because this tab left the Watchlist. You can save what was read before that. It is marked partial.',
  terminated_profile: 'The capture ended because the Prime Video profile changed. Nothing was kept, so the file can\'t mix two lists.',
  limit_items: 'The capture reached its size limit. You can save what was read so far. It is marked partial.',
  limit_time: 'The capture reached its 15-minute limit. You can save what was read so far. It is marked partial.',
  wrong_page: 'This tab isn\'t showing a Prime Video Watchlist. Open the Watchlist from the Prime Video menu, then try again.',
  collector_error: 'The capture hit an error and stopped. You can save what was read so far. It is marked partial.',
  invalid_command: 'The capture didn\'t understand that request. Close this popup, open it again, and retry.',
  tab_unreachable: 'This extension can\'t run on this page. Open your Prime Video Watchlist in this tab, then open this popup again.',
  no_response: 'The capture didn\'t answer. Refresh the Prime Video tab and start again.',
}

// Plain words for the gate's reason codes. The code itself stays visible.
const REASONS = {
  continuation_pending: 'Prime Video says more titles exist than were loaded.',
  no_terminal_evidence: 'The page data never said where the list ends.',
  no_structured_watchlist: 'The page data didn\'t name a Watchlist, so only cards were read.',
  visible_not_in_structured: 'Some cards weren\'t in the page data.',
  structured_not_seen_visible: 'Some titles in the page data never appeared as cards.',
  total_mismatch: 'The count Prime Video reports differs from what was read.',
  cursor_repeated: 'Prime Video repeated a page.',
  filter_changed: 'The Watchlist filter changed during the capture.',
  filtered_view: 'The capture started on a filtered view, not All.',
  profile_unconfirmed: 'The open profile couldn\'t be confirmed.',
  unknown_response_schema: 'Prime Video sent list data in a shape this version can\'t read.',
  visible_group_guessed: 'The page has several card groups and the Watchlist grid was guessed.',
  conflicting_identity: 'A title appeared with two different names or IDs and was left out.',
}

const KNOWN_STATES = new Set(['idle', 'capturing', 'stopped', 'cancelled', 'terminated'])
const el = (id) => document.getElementById(id)
const ui = Object.fromEntries(['state', 'detail', 'profile-warning', 'counts', 'items', 'structured', 'visible', 'both', 'coverage', 'completeness', 'reasons', 'start', 'stop', 'save', 'save-report', 'cancel', 'saved', 'saved-line', 'code-line', 'code'].map((id) => [id, el(id)]))

let tabId = null
let busy = false
let pollTimer = null
let current = { state: 'idle', code: 'idle' }
let files = null
let savedNames = null

const count = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : 0)
const text = (v) => (typeof v === 'string' ? v : '')

function isEnvelope(v) {
  return v !== null && typeof v === 'object' && v.format === 'goodwatch-wishlist' && v.version === 1 && v.source === 'prime-video' && Array.isArray(v.items)
}

function render() {
  const state = text(current.state)
  const code = text(current.code)
  const capturing = state === 'capturing'
  const hasCounts = capturing || state === 'stopped' || state === 'terminated'
  ui.state.textContent = MESSAGES[code] || MESSAGES[state] || 'Something unexpected happened. The code that follows can help whoever is testing this.'
  ui.counts.hidden = !hasCounts
  const c = current.counts || {}
  ui.items.textContent = count(c.items).toLocaleString()
  ui.structured.textContent = count(c.structured).toLocaleString()
  ui.visible.textContent = count(c.visible).toLocaleString()
  ui.both.textContent = count(c.inBoth).toLocaleString()
  ui.coverage.hidden = !hasCounts
  ui.completeness.textContent = text(current.completeness) || 'unknown'
  const reasons = Array.isArray(current.reasons) ? current.reasons.filter((r) => typeof r === 'string') : []
  ui.reasons.hidden = !hasCounts || reasons.length === 0
  ui.reasons.textContent = reasons.map((r) => REASONS[r] ? `${REASONS[r]} (${r})` : r).join(' ')
  ui['profile-warning'].hidden = !(capturing && current.profileGuard === 'none')
  ui.start.hidden = capturing
  ui.start.disabled = busy || tabId === null
  ui.start.textContent = state === 'idle' ? 'Start capture' : 'Start a new capture'
  ui.stop.hidden = !capturing
  ui.stop.disabled = busy
  ui.cancel.hidden = !(capturing || (files !== null && savedNames === null))
  ui.cancel.disabled = busy
  ui.save.hidden = capturing || files === null
  ui.save.disabled = busy
  ui['save-report'].hidden = ui.save.hidden
  ui['save-report'].disabled = busy
  ui.saved.hidden = savedNames === null
  if (savedNames) ui['saved-line'].textContent = `Saved ${savedNames.join(' and ')} to your Downloads folder.`
  const showCode = code !== '' && !['idle', 'capturing', 'stopped', 'cancelled'].includes(code)
  ui['code-line'].hidden = !showCode
  ui.code.textContent = showCode ? code : ''
}

function showDetail(message) {
  ui.detail.textContent = message
  ui.detail.hidden = message === ''
}

function forget() {
  files = null
  savedNames = null
}

function accept(response) {
  if (response === null || typeof response !== 'object' || !KNOWN_STATES.has(text(response.state))) {
    forget()
    current = { state: 'unknown', code: 'no_response' }
    return
  }
  current = response
  const done = response.state === 'stopped' || response.state === 'terminated'
  if (!done) {
    if (response.state !== 'capturing') forget()
    return
  }
  if (isEnvelope(response.envelope) && response.report && typeof response.report === 'object') {
    files = { envelope: response.envelope, report: response.report }
  } else {
    forget()
  }
}

// Runs in the page's isolated world. collector.js defines the global there.
function pageCommand(command, probeOnly) {
  const api = globalThis.__goodwatchPrimeCommand
  if (typeof api !== 'function') return probeOnly ? { state: 'idle', code: 'idle' } : null
  return api(command)
}

// Runs in the page's main world before observer.js, to hand it the nonce.
function setObserverArgs(nonce) {
  globalThis.__goodwatchPrimeObserverArgs = [nonce]
}

async function run(action, { start = false, probeOnly = false, report = false } = {}) {
  const command = { action, report }
  if (start) {
    command.nonce = crypto.randomUUID()
    await chrome.scripting.executeScript({ target: { tabId }, files: ['extract.js', 'collector.js'] })
    await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: setObserverArgs, args: [command.nonce] })
    await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['extract.js', 'observer.js'] })
  }
  const [frame] = await chrome.scripting.executeScript({ target: { tabId }, func: pageCommand, args: [command, probeOnly] })
  return frame ? frame.result : null
}

function stopPolling() {
  if (pollTimer !== null) clearInterval(pollTimer)
  pollTimer = null
}

function syncPolling() {
  if (text(current.state) === 'capturing' && !document.hidden) {
    if (pollTimer === null) pollTimer = setInterval(poll, POLL_MS)
  } else stopPolling()
}

async function poll() {
  if (busy || tabId === null) return
  try {
    accept(await run('status', { probeOnly: true, report: current.state === 'terminated' }))
  } catch {
    stopPolling()
    forget()
    current = { state: 'unknown', code: 'tab_unreachable' }
  }
  render()
  syncPolling()
}

function stamp() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

function download(name, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function saveFiles(which = 'both') {
  if (files === null) return
  const s = stamp()
  const names = []
  if (which !== 'report') {
    names.push(`goodwatch-wishlist-prime-video-${s}.json`)
    download(names[names.length - 1], files.envelope)
  }
  if (which !== 'wishlist') {
    names.push(`goodwatch-prime-capture-report-${s}.json`)
    download(names[names.length - 1], files.report)
  }
  savedNames = names
}

async function act(action, options) {
  if (busy || tabId === null) return
  busy = true
  showDetail('')
  render()
  try {
    accept(await run(action, options))
    if (action === 'stop' && files !== null) saveFiles()
  } catch {
    forget()
    current = { state: 'unknown', code: 'tab_unreachable' }
  } finally {
    busy = false
    render()
    syncPolling()
  }
}

ui.start.addEventListener('click', () => {
  forget()
  act('start', { start: true })
})
ui.stop.addEventListener('click', () => act('stop'))
ui.cancel.addEventListener('click', () => act('cancel'))
ui.save.addEventListener('click', () => {
  saveFiles('wishlist')
  render()
})
ui['save-report'].addEventListener('click', () => {
  saveFiles('report')
  render()
})
document.addEventListener('visibilitychange', syncPolling)

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    tabId = tab && Number.isInteger(tab.id) ? tab.id : null
  } catch {
    tabId = null
  }
  if (tabId === null) {
    current = { state: 'unknown', code: 'tab_unreachable' }
    render()
    return
  }
  // Opening the popup only asks a running capture for its status. It doesn't
  // load the collector or read titles; that happens after Start capture.
  try {
    accept(await run('status', { probeOnly: true, report: true }))
  } catch {
    current = { state: 'unknown', code: 'tab_unreachable' }
    tabId = null
  }
  render()
  syncPolling()
}

init()
