// Optional browser validation only; no extension runtime dependency.
// Loads the real unpacked extension in Chromium against invented pages served
// at Prime Video addresses on this computer. It never contacts Amazon.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { card, hydration, nextHref, page, viewOutputPage } from '../fixtures/synthetic.mjs'

const moduleName = process.env.GOODWATCH_PLAYWRIGHT_MODULE
const { chromium } = await import(moduleName ? pathToFileURL(resolve(moduleName)).href : 'playwright-core')
const extension = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ORIGIN = 'https://www.primevideo.com'
const WATCHLIST = `${ORIGIN}/region/eu/mystuff/watchlist`

// The page loads page 2 with fetch and page 3 with XMLHttpRequest, then
// renders the new cards and drops earlier ones, like a virtualized grid.
const loader = `<script>
const cardHtml = ${JSON.stringify(Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, card(n)])))};
function render(show, hide) {
  const grid = document.getElementById('grid');
  for (const n of hide) grid.querySelector('a[href*="' + n.toString().padStart(6, '0') + 'X"]')?.closest('li').remove();
  grid.insertAdjacentHTML('beforeend', show.map((n) => cardHtml[n]).join(''));
}
window.loadPage2 = () => fetch(${JSON.stringify(nextHref(2, 'c1'))}).then((r) => r.json()).then(() => render([3, 4], [1, 2]));
window.loadAccount = () => fetch('/region/eu/account/settings.json').then((r) => r.json());
window.loadPage3 = () => new Promise((done) => {
  const x = new XMLHttpRequest();
  x.open('GET', ${JSON.stringify(nextHref(4, 'c2'))});
  x.onload = () => { render([5], [3]); done(); };
  x.send();
});
</script>`
const fixture = page({ state: hydration({ page: viewOutputPage([1, 2], { next: 2, total: 5, cursor: 'c1' }) }), grid: [1, 2], script: loader })
const api = {
  [nextHref(2, 'c1')]: viewOutputPage([3, 4], { next: 4, total: 5, cursor: 'c2' }),
  [nextHref(4, 'c2')]: viewOutputPage([5], { next: 5, total: 5 }),
  '/region/eu/account/settings.json': { unrelated: true },
}

const profile = mkdtempSync(join(tmpdir(), 'goodwatch-prime-mv3-'))
const context = await chromium.launchPersistentContext(profile, {
  executablePath: process.env.GOODWATCH_CHROMIUM_PATH || chromium.executablePath(),
  headless: true,
  acceptDownloads: true,
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
    // Enables CDP's real extension action; does not change the extension's permissions.
    '--enable-unsafe-extension-debugging',
  ],
})
const results = []
let fulfilled = 0
let blocked = 0
try {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin === ORIGIN) {
      fulfilled++
      const json = api[url.pathname + url.search] ?? api[url.pathname]
      if (json) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) })
      if (url.pathname.endsWith('.png')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' })
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fixture })
    }
    if (url.protocol === 'chrome-extension:') return route.continue()
    blocked++
    return route.abort()
  })
  const cdp = await context.browser().newBrowserCDPSession()
  const settings = await context.newPage()
  await settings.goto('chrome://extensions/')
  const name = JSON.parse(readFileSync(join(extension, 'manifest.json'), 'utf8')).name
  const info = (await settings.evaluate(async () => chrome.developerPrivate.getExtensionsInfo({}))).find((v) => v.name === name)
  assert.ok(info, 'unpacked extension loaded')
  assert.equal(info.state, 'ENABLED')
  assert.deepEqual(info.permissions.runtimeHostPermissions.hosts, [])
  results.push('unpacked MV3 extension enabled with only activeTab and scripting, no persistent host access')

  const tab = await context.newPage()
  await tab.goto(WATCHLIST)
  await tab.bringToFront()
  const target = (await cdp.send('Target.getTargets', { filter: [{}] })).targetInfos.find((v) => v.type === 'tab' && v.url === tab.url())
  assert.ok(target, 'tab target found')
  await cdp.send('Extensions.triggerAction', { id: info.id, targetId: target.targetId })
  let popupTarget
  for (let i = 0; i < 40 && !popupTarget; i++) {
    popupTarget = (await cdp.send('Target.getTargets')).targetInfos.find((v) => v.url === `chrome-extension://${info.id}/popup.html`)
    if (!popupTarget) await new Promise((r) => setTimeout(r, 50))
  }
  assert.ok(popupTarget, 'extension action opened its popup')
  // Action popups are page targets that Playwright leaves out of context.pages().
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: popupTarget.targetId, flatten: false })
  let nextId = 0
  const pending = new Map()
  const errors = []
  cdp.on('Target.receivedMessageFromTarget', (event) => {
    if (event.sessionId !== sessionId) return
    const message = JSON.parse(event.message)
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails?.exception?.description || 'popup exception')
    const handlers = message.id && pending.get(message.id)
    if (!handlers) return
    pending.delete(message.id)
    if (message.error) handlers.reject(new Error(message.error.message))
    else handlers.resolve(message.result)
  })
  const rpc = (method, params = {}) => new Promise((res, rej) => {
    const id = ++nextId
    pending.set(id, { resolve: res, reject: rej })
    cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(rej)
  })
  const popup = {
    async evaluate(fn) {
      const v = await rpc('Runtime.evaluate', { expression: `(${fn.toString()})()`, awaitPromise: true, returnByValue: true, userGesture: true })
      if (v.exceptionDetails) throw new Error(v.exceptionDetails.exception?.description || v.exceptionDetails.text)
      return v.result.value
    },
    async waitFor(fn) {
      for (let i = 0; i < 120; i++) {
        if (await this.evaluate(fn)) return
        await new Promise((r) => setTimeout(r, 25))
      }
      throw new Error(`popup condition timed out: ${fn}`)
    },
  }
  await rpc('Runtime.enable')
  const downloads = mkdtempSync(join(tmpdir(), 'goodwatch-prime-download-'))
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: downloads, eventsEnabled: true })
  const finished = []
  let begun = new Map()
  cdp.on('Browser.downloadWillBegin', (e) => begun.set(e.guid, e.suggestedFilename))
  cdp.on('Browser.downloadProgress', (e) => { if (e.state === 'completed') finished.push(e.guid) })

  await popup.waitFor(() => document.getElementById('state').textContent.startsWith('Not capturing.'))
  assert.equal(await tab.evaluate(() => typeof globalThis.__goodwatchPrimeObserver), 'undefined', 'nothing injected before Start')
  results.push('opening the popup probes status only; nothing is injected before Start')

  await popup.evaluate(() => document.getElementById('start').click())
  await popup.waitFor(() => current.state === 'capturing')
  assert.equal(await popup.evaluate(() => current.counts.structured), 2)
  assert.equal(await popup.evaluate(() => current.counts.visible), 2)
  assert.equal(await tab.evaluate(() => typeof globalThis.__goodwatchPrimeCommand), 'undefined', 'collector stays in the isolated world')
  assert.equal(await tab.evaluate(() => globalThis.__goodwatchPrimeObserver?.active), true, 'observer runs in the main world')
  results.push('Start reads the first page from hydration state and the grid; library and recommendation rows stay out')

  await tab.evaluate(() => window.loadAccount())
  await tab.evaluate(() => window.loadPage2())
  await tab.evaluate(() => window.loadPage3())
  await popup.waitFor(() => run('status').then((r) => { accept(r); render(); return r.counts.structured === 5 && r.counts.visible === 5 }))
  const observed = await popup.evaluate(() => run('status', { report: true }).then((r) => r.report.responses.length))
  assert.equal(observed, 2, 'only the two Watchlist responses were read; the unrelated JSON response was not')
  results.push('linked fetch and XMLHttpRequest pages are observed in the main world; an unrelated same-origin JSON response is not read; virtualized cards accumulate')

  await popup.evaluate(() => document.getElementById('stop').click())
  for (let i = 0; i < 100 && finished.length < 2; i++) await new Promise((r) => setTimeout(r, 50))
  assert.equal(finished.length, 2, 'two downloads completed')
  const byName = Object.fromEntries(finished.map((g) => [begun.get(g), JSON.parse(readFileSync(join(downloads, g), 'utf8'))]))
  const wishName = Object.keys(byName).find((n) => n.startsWith('goodwatch-wishlist-prime-video-'))
  const reportName = Object.keys(byName).find((n) => n.startsWith('goodwatch-prime-capture-report-'))
  assert.ok(wishName && reportName, `file names: ${Object.keys(byName)}`)
  const wish = byName[wishName]
  assert.equal(wish.format, 'goodwatch-wishlist')
  assert.equal(wish.version, 1)
  assert.equal(wish.completeness, 'complete', JSON.stringify([byName[reportName].partialReasons, byName[reportName].unknownReasons, byName[reportName].pagination.pages]))
  assert.equal(wish.items.length, 5)
  assert.ok(wish.items.every((i) => i.sourceId.startsWith('amzn1.dv.gti.') && !/[?#]/.test(i.sourceUrl) && !/ref=/.test(i.sourceUrl)))
  const report = byName[reportName]
  // Optional: keep the two synthetic files, for example for scripts/parser-check.mjs.
  if (process.env.GOODWATCH_CAPTURE_OUT) {
    writeFileSync(join(process.env.GOODWATCH_CAPTURE_OUT, 'synthetic-wishlist.json'), JSON.stringify(wish, null, 2))
    writeFileSync(join(process.env.GOODWATCH_CAPTURE_OUT, 'synthetic-report.json'), JSON.stringify(report, null, 2))
  }
  assert.equal(report.counts.inBoth, 5)
  assert.ok(report.responses.length >= 2)
  assert.ok(!/Synthetic|Remake|amzn1\.dv\.gti\.0|0SYNTH|synthetic-profile/.test(JSON.stringify(report)), 'report has no titles or IDs')
  results.push('Stop downloads a complete five-item shared wishlist file and a report without titles or IDs')
  const restored = await tab.evaluate(() => [String(window.fetch).includes('[native code]'), String(XMLHttpRequest.prototype.open).includes('[native code]'), String(XMLHttpRequest.prototype.send).includes('[native code]'), globalThis.__goodwatchPrimeObserver?.active])
  assert.deepEqual(restored, [true, true, true, false], 'native fetch and XMLHttpRequest restored, observer inactive')
  results.push('after Stop the page has its native fetch and XMLHttpRequest back and observation is off')

  await popup.evaluate(() => document.getElementById('start').click())
  await popup.waitFor(() => current.state === 'capturing')
  await tab.evaluate(() => history.pushState({}, '', '/region/eu/storefront'))
  await popup.waitFor(() => run('status', { report: true }).then((r) => { accept(r); render(); return r.code === 'terminated_navigation' }))
  assert.equal(await popup.evaluate(() => files.envelope.completeness), 'partial')
  results.push('leaving the Watchlist ends the capture as partial and keeps what was read')
  // A rejected Start (not a Watchlist page) must leave nothing running.
  await tab.goto(`${ORIGIN}/region/eu/storefront`)
  await popup.evaluate(() => document.getElementById('start').click())
  await popup.waitFor(() => current.code === 'wrong_page')
  const untouched = await tab.evaluate(() => [String(window.fetch).includes('[native code]'), String(XMLHttpRequest.prototype.open).includes('[native code]')])
  assert.deepEqual(untouched, [true, true], 'nothing wrapped after a rejected Start')
  const injected = await popup.evaluate(() => chrome.scripting.executeScript({ target: { tabId }, func: () => typeof globalThis.__goodwatchPrimeCommand }).then(([f]) => f.result))
  assert.equal(injected, 'undefined', 'no collector injected on a rejected Start')
  results.push('a Start on a non-Watchlist page injects nothing and leaves the page untouched')
  assert.deepEqual(errors, [])
  rmSync(downloads, { recursive: true, force: true })
  console.log(JSON.stringify({ status: 'passed', synthetic: true, liveProviderValidated: false, requestsFulfilledLocally: fulfilled, otherRequestsBlocked: blocked, results }, null, 2))
} finally {
  await context.close()
  rmSync(profile, { recursive: true, force: true })
}
