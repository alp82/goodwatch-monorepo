// Real Chromium run of the unpacked version 0.0.5 extension against the
// self-running synthetic page, served at a routed netflix.com origin. Never
// contacts Netflix. Uses real time, so it takes a few minutes.
//
// Usage:
//   GOODWATCH_PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
//   GOODWATCH_CHROMIUM_PATH=/path/to/chrome \
//   node scripts/browser-run.mjs [--screens <dir>] [--json <file>]
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { liveFixture } from '../harness/live-fixture.mjs'

const moduleName = process.env.GOODWATCH_PLAYWRIGHT_MODULE
const { chromium } = await import(moduleName ? pathToFileURL(resolve(moduleName)).href : 'playwright-core')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const extension = join(root, 'extension')
const argv = process.argv.slice(2)
const screens = argv.includes('--screens') ? resolve(argv[argv.indexOf('--screens') + 1]) : null
const jsonOut = argv.includes('--json') ? resolve(argv[argv.indexOf('--json') + 1]) : null
if (screens) mkdirSync(screens, { recursive: true })
const sleep = ms => new Promise(r => setTimeout(r, ms))

let fixture = liveFixture()
const profile = mkdtempSync(join(tmpdir(), 'goodwatch-706-profile-'))
const downloads = mkdtempSync(join(tmpdir(), 'goodwatch-706-downloads-'))
const context = await chromium.launchPersistentContext(profile, {
  executablePath: process.env.GOODWATCH_CHROMIUM_PATH || chromium.executablePath(),
  headless: true,
  acceptDownloads: true,
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--enable-unsafe-extension-debugging'],
})
const results = []
let netflixRequests = 0
let blocked = 0
try {
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin === 'https://www.netflix.com') {
      netflixRequests++
      if (url.pathname.endsWith('.png')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' })
      return route.fulfill({ status: 200, contentType: 'text/html', body: fixture })
    }
    if (url.protocol === 'chrome-extension:') return route.continue()
    blocked++
    return route.abort()
  })
  const cdp = await context.browser().newBrowserCDPSession()
  const settings = await context.newPage()
  await settings.goto('chrome://extensions/')
  const infos = await settings.evaluate(() => chrome.developerPrivate.getExtensionsInfo({}))
  const info = infos.find(value => value.name === JSON.parse(readFileSync(join(extension, 'manifest.json'))).name)
  assert.ok(info && info.state === 'ENABLED', 'extension loaded')
  assert.equal(info.version, '0.0.5')
  assert.deepEqual(info.permissions.runtimeHostPermissions.hosts, [])
  await settings.close()
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: downloads, eventsEnabled: true })

  async function openPopup(page) {
    await page.bringToFront()
    const target = (await cdp.send('Target.getTargets', { filter: [{}] })).targetInfos.find(t => t.type === 'tab' && t.url === page.url())
    await cdp.send('Extensions.triggerAction', { id: info.id, targetId: target.targetId })
    let popupTarget
    for (let i = 0; i < 60 && !popupTarget; i++) {
      popupTarget = (await cdp.send('Target.getTargets')).targetInfos.find(t => t.url === `chrome-extension://${info.id}/popup.html`)
      if (!popupTarget) await sleep(50)
    }
    assert.ok(popupTarget, 'popup opened')
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: popupTarget.targetId, flatten: false })
    let nextId = 0
    const pending = new Map()
    const errors = []
    const onMessage = event => {
      if (event.sessionId !== sessionId) return
      const message = JSON.parse(event.message)
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params?.exceptionDetails?.text || 'exception')
      const handlers = message.id && pending.get(message.id)
      if (!handlers) return
      pending.delete(message.id)
      message.error ? handlers.reject(new Error(message.error.message)) : handlers.resolve(message.result)
    }
    cdp.on('Target.receivedMessageFromTarget', onMessage)
    const rpc = (method, params = {}) => new Promise((res, rej) => {
      const id = ++nextId
      pending.set(id, { resolve: res, reject: rej })
      cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(rej)
    })
    await rpc('Runtime.enable')
    const popup = {
      errors,
      async eval(expression) {
        const value = await rpc('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true })
        if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description || value.exceptionDetails.text)
        return value.result.value
      },
      async waitFor(expression, timeoutMs = 10000) {
        const until = Date.now() + timeoutMs
        while (Date.now() < until) {
          if (await this.eval(expression).catch(() => false)) return
          await sleep(100)
        }
        throw new Error(`Timed out: ${expression}`)
      },
      async shot(name) {
        if (!screens) return
        const { data } = await rpc('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
        writeFileSync(join(screens, `${name}.png`), Buffer.from(data, 'base64'))
      },
      async close() {
        cdp.off('Target.receivedMessageFromTarget', onMessage)
        await cdp.send('Target.closeTarget', { targetId: popupTarget.targetId }).catch(() => {})
      },
    }
    await popup.waitFor("document.getElementById('state').textContent !== 'Checking this tab…'")
    return popup
  }
  function nextDownload() {
    return new Promise((res, rej) => {
      const timer = setTimeout(() => rej(new Error('download timed out')), 10000)
      let started
      const begin = e => { started = e }
      const progress = e => {
        if (started && e.guid === started.guid && e.state === 'completed') {
          clearTimeout(timer)
          cdp.off('Browser.downloadWillBegin', begin)
          cdp.off('Browser.downloadProgress', progress)
          res(JSON.parse(readFileSync(join(downloads, started.guid), 'utf8')))
        }
      }
      cdp.on('Browser.downloadWillBegin', begin)
      cdp.on('Browser.downloadProgress', progress)
    })
  }
  const newTab = async () => {
    const page = await context.newPage()
    await page.goto('https://www.netflix.com/browse/my-list')
    await page.waitForSelector('#my-list [data-uia="standard-card"]')
    return page
  }

  // 1. Assisted, 77 titles.
  {
    fixture = liveFixture()
    const page = await newTab()
    const popup = await openPopup(page)
    await popup.shot('1-idle')
    const t0 = Date.now()
    await popup.eval("document.getElementById('assist').click()")
    await popup.waitFor("current.state === 'capturing'")
    await sleep(4000)
    await popup.shot('2-assisted-running')
    await popup.waitFor("current.state === 'stopped'", 120000)
    const seconds = (Date.now() - t0) / 1000
    const r = await popup.eval('current')
    await popup.shot('3-assisted-complete')
    const download = nextDownload()
    await popup.eval("document.getElementById('save').click()")
    const file = await download
    const fx = await page.evaluate(() => window.__fixture)
    assert.equal(file.completeness, 'complete')
    assert.equal(file.items.length, 77)
    assert.equal(new Set(file.items.map(i => i.sourceId)).size, 77)
    assert.ok(file.items.every(i => Number(i.sourceId) >= 1001 && Number(i.sourceId) <= 1077), 'no other-row IDs')
    assert.deepEqual(popup.errors, [])
    results.push({ run: 'assisted-77', completeness: file.completeness, items: file.items.length, seconds, advances: r.traversal.advances, outcome: r.traversal.outcome, untrustedClicks: fx.untrustedClicks, memberActions: 3 })
    await popup.close()
    await page.close()
  }

  // 2. Assisted, 77 counted, 2 never rendered.
  {
    fixture = liveFixture({ unavailable: ['1030', '1066'] })
    const page = await newTab()
    const popup = await openPopup(page)
    const t0 = Date.now()
    await popup.eval("document.getElementById('assist').click()")
    await popup.waitFor("current.state === 'stopped'", 120000)
    const seconds = (Date.now() - t0) / 1000
    await popup.shot('4-assisted-partial')
    const r = await popup.eval('current')
    const download = nextDownload()
    await popup.eval("document.getElementById('save').click()")
    const file = await download
    assert.equal(file.completeness, 'partial')
    assert.equal(file.items.length, 75)
    results.push({ run: 'assisted-unavailable', completeness: file.completeness, items: file.items.length, reportedTotal: r.verdict.reportedTotal, reason: r.verdict.reason, seconds })
    await popup.close()
    await page.close()
  }

  // 3. Manual, member clicks the arrow with trusted input until the row wraps,
  // then checks the popup. If titles are missing, the member goes round again.
  {
    fixture = liveFixture()
    const page = await newTab()
    let popup = await openPopup(page)
    const t0 = Date.now()
    await popup.eval("document.getElementById('manual').click()")
    await popup.waitFor("current.state === 'capturing'")
    await popup.shot('5-manual-running')
    await popup.close()
    let clicks = 0
    let actions = 2
    const laps = []
    for (let lap = 1; lap <= 2; lap++) {
      const wrapsAtStart = await page.evaluate(() => window.__fixture.wraps)
      while ((await page.evaluate(() => window.__fixture.wraps)) < wrapsAtStart + 1 && clicks < 80) {
        await page.click('#my-list [data-uia="carousel-hawkins-right-button"]')
        clicks++
        actions++
        await sleep(1200)
      }
      await sleep(1000)
      popup = await openPopup(page)
      actions++
      const status = await popup.eval('current')
      laps.push({ lap, captured: status.observedCount, reportedTotal: status.verdict.reportedTotal, reason: status.verdict.reason })
      if (lap === 1) await popup.shot('6-manual-after-first-lap')
      if (status.verdict.reason !== 'total_reached_still_capturing' && lap === 1) {
        await popup.close()
        continue
      }
      break
    }
    const download = nextDownload()
    await popup.eval("document.getElementById('stop').click()")
    actions++
    const file = await download
    const seconds = (Date.now() - t0) / 1000
    const r = await popup.eval('current')
    await popup.shot('7-manual-result')
    results.push({ run: 'manual-77-at-1.2s-clicks', completeness: file.completeness, items: file.items.length, seconds, arrowClicks: clicks, memberActions: actions, laps, reason: r.verdict.reason })
    await popup.close()
    await page.close()
  }

  // 4. Profile change during assisted capture discards everything.
  {
    fixture = liveFixture()
    const page = await newTab()
    const popup = await openPopup(page)
    await popup.eval("document.getElementById('assist').click()")
    await popup.waitFor("current.state === 'capturing'")
    await sleep(3000)
    await page.evaluate(() => document.querySelector('img[data-uia="navigation+profile-menu+Avatar"]').setAttribute('src', '/avatar-b.png'))
    await popup.waitFor("current.state === 'terminated'", 10000)
    const r = await popup.eval('current')
    await popup.shot('8-profile-changed')
    assert.equal(r.code, 'terminated_profile')
    assert.equal(await popup.eval('envelope'), null)
    assert.equal(await popup.eval("document.getElementById('save').hidden"), true)
    results.push({ run: 'profile-change', code: r.code, fileOffered: false })
    await popup.close()
    await page.close()
  }

  const out = { status: 'passed', synthetic: true, liveProviderValidated: false, chromium: context.browser().version(), netflixRequestsFulfilledLocally: netflixRequests, otherRequestsBlocked: blocked, results }
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify(out, null, 2) + '\n')
  console.log(JSON.stringify(out, null, 2))
} finally {
  await context.close()
  rmSync(profile, { recursive: true, force: true })
  rmSync(downloads, { recursive: true, force: true })
}
