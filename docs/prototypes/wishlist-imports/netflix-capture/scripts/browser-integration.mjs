// Optional browser validation only; no extension runtime dependency.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const moduleName = process.env.GOODWATCH_PLAYWRIGHT_MODULE
const { chromium } = await import(moduleName ? pathToFileURL(resolve(moduleName)).href : 'playwright-core')
const extension = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fixture = readFileSync(join(extension, 'fixtures/my-list.html'), 'utf8')
const profile = mkdtempSync(join(tmpdir(), 'goodwatch-mv3-validation-'))
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
let fixtureRequests = 0
let blockedRequests = 0
try {
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin === 'https://www.netflix.com') {
      fixtureRequests++
      if (url.pathname.endsWith('.png')) {
        return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' })
      }
      return route.fulfill({ status: 200, contentType: 'text/html', body: fixture })
    }
    if (url.protocol === 'chrome-extension:') return route.continue()
    blockedRequests++
    return route.abort()
  })
  const cdp = await context.browser().newBrowserCDPSession()
  const settings = await context.newPage()
  await settings.goto('chrome://extensions/')
  const infos = await settings.evaluate(async () => chrome.developerPrivate.getExtensionsInfo({}))
  const info = infos.find(value => value.name === JSON.parse(readFileSync(join(extension, 'manifest.json'))).name)
  assert.ok(info, 'unpacked extension loaded')
  assert.equal(info.state, 'ENABLED')
  assert.deepEqual(info.permissions.runtimeHostPermissions.hosts, [])
  results.push('actual unpacked MV3 extension enabled, with no persistent host access')

  const page = await context.newPage()
  await page.goto('https://www.netflix.com/browse/my-list?view=grid')
  await page.bringToFront()
  const targets = await cdp.send('Target.getTargets', { filter: [{}] })
  const target = targets.targetInfos.find(value => value.type === 'tab' && value.url === page.url())
  assert.ok(target, 'browser tab target discovered')
  await cdp.send('Extensions.triggerAction', { id: info.id, targetId: target.targetId })
  const extensionOrigin = `chrome-extension://${info.id}`
  let popupTarget
  for (let i = 0; i < 30 && !popupTarget; i++) {
    popupTarget = (await cdp.send('Target.getTargets')).targetInfos.find(value => value.url === `${extensionOrigin}/popup.html`)
    if (!popupTarget) await new Promise(resolve => setTimeout(resolve, 50))
  }
  assert.ok(popupTarget, 'actual extension action opened its popup')
  // Chrome action popups are real page targets but are omitted from Playwright context.pages().
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: popupTarget.targetId, flatten: false })
  let nextId = 0
  const pending = new Map()
  const errors = []
  cdp.on('Target.receivedMessageFromTarget', event => {
    if (event.sessionId !== sessionId) return
    const message = JSON.parse(event.message)
    if (message.method === 'Runtime.exceptionThrown') errors.push('popup runtime exception')
    if (!message.id) return
    const handlers = pending.get(message.id)
    if (!handlers) return
    pending.delete(message.id)
    if (message.error) handlers.reject(new Error(message.error.message))
    else handlers.resolve(message.result)
  })
  const rpc = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject })
    cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(reject)
  })
  const popup = {
    async evaluate(fn) {
      const value = await rpc('Runtime.evaluate', { expression: `(${fn.toString()})()`, awaitPromise: true, returnByValue: true, userGesture: true })
      if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description || value.exceptionDetails.text)
      return value.result.value
    },
    async waitForFunction(fn) {
      for (let i = 0; i < 100; i++) {
        if (await this.evaluate(fn)) return
        await new Promise(resolve => setTimeout(resolve, 25))
      }
      throw new Error('Popup condition timed out')
    },
  }
  await rpc('Runtime.enable')
  const downloads = mkdtempSync(join(tmpdir(), 'goodwatch-mv3-download-'))
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: downloads, eventsEnabled: true })
  await popup.waitForFunction(() => document.getElementById('state').textContent.startsWith('Not capturing.'))
  assert.equal(await popup.evaluate(() => current.state), 'idle')
  results.push('real popup status probe leaves capture idle; activeTab granted by the extension action')

  await popup.evaluate(() => document.getElementById('start').click())
  await popup.waitForFunction(() => current.state === 'capturing')
  assert.equal(await popup.evaluate(() => current.observedCount), 2)
  assert.equal(await page.evaluate(() => typeof globalThis.__goodwatchWishlistCaptureCommand), 'undefined', 'collector remains outside page main world')
  results.push('popup Start injects capture.js into the isolated world, captures two list cards and excludes recommendation')

  // The DOM contains only the latest card; previous cards must remain accumulated.
  await page.evaluate(() => {
    document.querySelector('.gallery').innerHTML = '<div class="ptrack-content" data-ui-tracking-context="%7B%22video_id%22%3A%221003%22%7D"><a href="/title/1003?token=discard#private"><span class="fallback-text">Synthetic third</span></a></div>'
  })
  const accumulated = await popup.evaluate(async () => run('status'))
  assert.equal(accumulated.observedCount, 3)
  assert.deepEqual(accumulated.envelope.items.map(value => value.sourceId).sort(), ['1001', '1002', '1003'])
  results.push('real MutationObserver handles recycled cards and once-encoded tracking metadata')

  await page.evaluate(() => {
    document.querySelector('.gallery').insertAdjacentHTML('beforeend', '<div class="ptrack-content" data-ui-tracking-context="{&quot;video_id&quot;:&quot;1001&quot;}"><a href="/title/1001"><span class="fallback-text">Conflicting title</span></a></div>')
  })
  const conflict = await popup.evaluate(async () => run('status'))
  assert.equal(conflict.observedCount, 2)
  await page.evaluate(() => document.querySelector('.gallery .ptrack-content:last-child .fallback-text').textContent = 'Synthetic movie')
  const quarantined = await popup.evaluate(async () => run('status'))
  assert.ok(!quarantined.envelope.items.some(value => value.sourceId === '1001'))
  results.push('contradictory title evidence removes the earlier item permanently for this capture')

  const downloadPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Download timed out')), 5000)
    let started
    cdp.on('Browser.downloadWillBegin', event => { started = event })
    cdp.on('Browser.downloadProgress', event => {
      if (started && event.guid === started.guid && event.state === 'completed') {
        clearTimeout(timer)
        resolve(started)
      }
    })
  })
  await popup.evaluate(() => document.getElementById('stop').click())
  const download = await downloadPromise
  const output = JSON.parse(readFileSync(join(downloads, download.guid), 'utf8'))
  assert.equal(output.format, 'goodwatch-wishlist')
  assert.equal(output.version, 1)
  assert.equal(output.source, 'netflix')
  assert.equal(output.completeness, 'unknown')
  assert.equal(output.items.length, 2)
  assert.ok(output.items.every(value => value.mediaType === 'unknown' && !('tmdbId' in value) && !('imdbId' in value)))
  assert.ok(output.items.every(value => !value.sourceUrl || !/[?#]/.test(value.sourceUrl)))
  assert.ok(!('profileLabel' in output))
  await popup.waitForFunction(() => current.state === 'stopped')
  results.push('real popup Stop downloads valid two-item JSON with unknown type/coverage and no URL query/hash')
  if (process.env.GOODWATCH_CAPTURE_SCREENSHOT) {
    const screenshot = await rpc('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    writeFileSync(process.env.GOODWATCH_CAPTURE_SCREENSHOT, Buffer.from(screenshot.data, 'base64'))
  }

  await popup.evaluate(() => document.getElementById('start').click())
  await popup.waitForFunction(() => current.state === 'capturing')
  await page.evaluate(() => document.querySelector('.account-dropdown-button .profile-icon').setAttribute('src', '/avatar-b.png'))
  await popup.evaluate(async () => { accept(await run('status')); render() })
  assert.equal(await popup.evaluate(() => current.code), 'terminated_profile')
  assert.equal(await popup.evaluate(() => envelope), null)
  assert.equal(await popup.evaluate(() => document.getElementById('save').hidden), true)
  results.push('profile marker change discards capture and popup save state')

  await popup.evaluate(() => document.getElementById('start').click())
  await popup.waitForFunction(() => current.state === 'capturing')
  await page.evaluate(() => history.pushState({}, '', '/browse'))
  await popup.evaluate(async () => { accept(await run('status')); render() })
  assert.equal(await popup.evaluate(() => current.code), 'terminated_navigation')
  assert.equal(await popup.evaluate(() => envelope), null)
  rmSync(downloads, { recursive: true, force: true })
  results.push('SPA navigation away from My List discards capture and popup save state')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({
    status: 'passed', synthetic: true, liveProviderValidated: false,
    fixtureRequestsFulfilledLocally: fixtureRequests, otherRequestsBlocked: blockedRequests,
    downloadName: download.suggestedFilename, results,
  }, null, 2))
} finally {
  await context.close()
  rmSync(profile, { recursive: true, force: true })
}
