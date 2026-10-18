'use strict'

// Popup for the experimental My List capture. It talks to capture.js in the
// active tab through chrome.scripting only, after the member opens the popup.
// Every value from the page is untrusted: it reaches the DOM via textContent.

const POLL_MS = 1500

const MESSAGES = {
  idle: 'Not capturing. Open My List on netflix.com in this tab, then choose Start capture.',
  capturing: 'Capturing. Go through My List to the end, then open this popup again to stop.',
  stopped: 'Capture stopped.',
  cancelled: 'Capture canceled. Nothing was saved.',
  terminated_navigation: 'The capture ended because this tab left My List. Nothing was kept. Open My List and start again.',
  terminated_profile: 'The capture ended because the Netflix profile changed. Nothing was kept, so the file can\'t mix two lists. Start again on one profile.',
  terminated_boundary: 'The capture ended because My List disappeared from the page. You can save the titles captured before that.',
  limit_rows: 'The capture reached its size limit and ended. You can save the titles captured so far.',
  limit_time: 'The capture reached its time limit and ended. You can save the titles captured so far.',
  wrong_page: 'This tab isn\'t showing My List. Open netflix.com/browse/my-list, then choose Start capture.',
  boundary_missing: 'GoodWatch couldn\'t identify My List on this page. Netflix may be showing a layout that this version doesn\'t support. Wait until the page has loaded, then choose Start capture again. If this message comes back, report the code that follows and the heading of your list row, such as My List or Meine Liste.',
  boundary_ambiguous: 'GoodWatch found more than one list on this page and can\'t tell which one is My List. Close any open title details, then try again.',
  invalid_command: 'The capture didn\'t understand that request. Close this popup, open it again, and retry.',
  // Codes set by this popup, not by capture.js.
  tab_unreachable: 'This extension can\'t run on this page. Open My List on netflix.com in this tab, then open this popup again.',
  no_response: 'The capture didn\'t answer. Refresh the Netflix tab, then choose Start capture again.',
}

const FALLBACK_MESSAGE = 'Something unexpected happened. The code that follows can help whoever is testing this.'
const BAD_FILE = 'The capture returned data GoodWatch can\'t read, so no file was saved.'

const KNOWN_STATES = new Set(['idle', 'capturing', 'stopped', 'cancelled', 'terminated'])
// Codes after which capture.js still holds titles that the member can save.
// Navigation and profile endings, cancel, and every other code discard them.
const KEEPABLE_CODES = new Set(['stopped', 'terminated_boundary', 'limit_rows', 'limit_time'])

const el = (id) => document.getElementById(id)
const ui = {
  state: el('state'),
  detail: el('detail'),
  profileWarning: el('profile-warning'),
  counts: el('counts'),
  countsHint: el('counts-hint'),
  observed: el('observed'),
  rejected: el('rejected'),
  start: el('start'),
  stop: el('stop'),
  save: el('save'),
  cancel: el('cancel'),
  saved: el('saved'),
  savedLine: el('saved-line'),
  codeLine: el('code-line'),
  code: el('code'),
}

let tabId = null
let busy = false
let pollTimer = null
let current = { state: 'idle', code: 'idle', observedCount: 0, rejectedCount: 0 }
let envelope = null
let savedName = null

function count(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
}

function text(value) {
  return typeof value === 'string' ? value : ''
}

function isEnvelope(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    value.format === 'goodwatch-wishlist' &&
    value.version === 1 &&
    typeof value.source === 'string' &&
    typeof value.completeness === 'string' &&
    Array.isArray(value.items)
  )
}

function titlesLabel(n) {
  return n === 1 ? '1 title' : `${n.toLocaleString()} titles`
}

function messageFor(response) {
  const code = text(response.code)
  if (Object.hasOwn(MESSAGES, code)) return MESSAGES[code]
  const state = text(response.state)
  if (Object.hasOwn(MESSAGES, state) && state !== 'terminated') return MESSAGES[state]
  return FALLBACK_MESSAGE
}

function render() {
  const state = text(current.state)
  const code = text(current.code)
  const capturing = state === 'capturing'
  const hasCounts = capturing || state === 'stopped' || state === 'terminated' || envelope !== null

  ui.state.textContent = messageFor(current)

  ui.counts.hidden = !hasCounts
  ui.countsHint.hidden = !hasCounts
  ui.observed.textContent = count(current.observedCount).toLocaleString()
  ui.rejected.textContent = count(current.rejectedCount).toLocaleString()

  ui.profileWarning.hidden = !(current.profileGuard === false && (capturing || envelope !== null))

  ui.start.hidden = capturing
  ui.start.disabled = busy || tabId === null
  ui.start.textContent = state === 'idle' ? 'Start capture' : 'Start a new capture'
  ui.stop.hidden = !capturing
  ui.stop.disabled = busy
  ui.cancel.hidden = !(capturing || (envelope !== null && savedName === null))
  ui.cancel.disabled = busy
  ui.save.hidden = capturing || envelope === null
  ui.save.disabled = busy
  ui.save.textContent = savedName === null ? 'Save file' : 'Save file again'

  ui.saved.hidden = savedName === null || envelope === null
  if (savedName !== null && envelope !== null) {
    ui.savedLine.textContent = `Saved ${savedName} with ${titlesLabel(envelope.items.length)}. Check your Downloads folder.`
  }

  const showCode = code !== '' && !['idle', 'capturing', 'stopped', 'cancelled'].includes(code)
  ui.codeLine.hidden = !showCode
  ui.code.textContent = showCode ? code : ''
}

function showDetail(message) {
  ui.detail.textContent = message
  ui.detail.hidden = message === ''
}

// The popup can't tell which capture an earlier file came from once the tab
// stops answering as expected, so it forgets that file instead of offering it.
function forget() {
  envelope = null
  savedName = null
}

function fail(code) {
  forget()
  current = { state: 'unknown', code, observedCount: 0, rejectedCount: 0 }
}

function accept(response) {
  if (response === null || typeof response !== 'object' || !KNOWN_STATES.has(text(response.state))) {
    fail('no_response')
    return
  }
  current = response
  const state = text(response.state)
  const code = text(response.code)
  const keepable = (state === 'stopped' || state === 'terminated') && KEEPABLE_CODES.has(code)
  if (!keepable) {
    forget()
  } else if (isEnvelope(response.envelope)) {
    envelope = response.envelope
  } else {
    forget()
    showDetail(BAD_FILE)
  }
}

// Runs in the page's isolated world. capture.js defines the global there.
function pageCommand(command, probeOnly) {
  const api = globalThis.__goodwatchWishlistCaptureCommand
  if (typeof api !== 'function') {
    return probeOnly ? { state: 'idle', code: 'idle', observedCount: 0, rejectedCount: 0 } : null
  }
  return api(command)
}

async function run(action, { inject = false, probeOnly = false } = {}) {
  if (inject) {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['capture.js'] })
  }
  const [frame] = await chrome.scripting.executeScript({
    target: { tabId },
    func: pageCommand,
    args: [{ action }, probeOnly],
  })
  return frame ? frame.result : null
}

function stopPolling() {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function syncPolling() {
  if (text(current.state) === 'capturing' && !document.hidden) {
    if (pollTimer === null) pollTimer = setInterval(poll, POLL_MS)
  } else {
    stopPolling()
  }
}

async function poll() {
  if (busy || tabId === null) return
  try {
    accept(await run('status', { probeOnly: true }))
  } catch {
    stopPolling()
    fail('tab_unreachable')
  }
  render()
  syncPolling()
}

function fileName(source) {
  const safeSource = text(source).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'capture'
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `goodwatch-wishlist-${safeSource}-${stamp}.json`
}

function saveFile() {
  if (envelope === null) return
  const name = fileName(envelope.source)
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
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

async function act(action, options) {
  if (busy || tabId === null) return
  busy = true
  showDetail('')
  render()
  try {
    accept(await run(action, options))
    if (action === 'stop' && envelope !== null) saveFile()
  } catch {
    fail('tab_unreachable')
  } finally {
    busy = false
    render()
    syncPolling()
  }
}

ui.start.addEventListener('click', () => {
  forget()
  act('start', { inject: true })
})
ui.stop.addEventListener('click', () => act('stop'))
ui.cancel.addEventListener('click', () => act('cancel'))
ui.save.addEventListener('click', () => {
  saveFile()
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
    fail('tab_unreachable')
    render()
    return
  }
  // Opening the popup runs a small status check in the tab. It doesn't load
  // capture.js or start a capture; titles are read only after Start capture.
  try {
    accept(await run('status', { probeOnly: true }))
  } catch {
    fail('tab_unreachable')
    tabId = null
  }
  render()
  syncPolling()
}

init()
