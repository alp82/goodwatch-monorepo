// End to end: the real unpacked diagnostic extension and its popup in Chromium,
// on a synthetic Netflix My List page with a local fake GraphQL server. Every
// netflix.com request is fulfilled locally; nothing is sent to Netflix.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { chromium, executablePath, sleep } from './browser.mjs'
import { graphqlServer, makeList, netflixPage } from './fixture.mjs'

const extension = fileURLToPath(new URL('../extension', import.meta.url))
let context
let cdp
let extensionId
let profileDir
let fixture = { page: '', server: null }
let blocked = 0

before(async () => {
  profileDir = mkdtempSync(join(tmpdir(), 'gw730-'))
  context = await chromium.launchPersistentContext(profileDir, {
    executablePath, headless: true, viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--enable-unsafe-extension-debugging'],
  })
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin === 'https://www.netflix.com') {
      if (url.pathname === '/graphql') {
        let body = null
        try { body = JSON.parse(route.request().postData() || 'null') } catch {}
        const r = fixture.server.handle(body)
        if (r.delay) await sleep(r.delay)
        return route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body) }).catch(() => {})
      }
      if (url.pathname.endsWith('.png')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' })
      return route.fulfill({ status: 200, contentType: 'text/html', body: fixture.page })
    }
    if (url.protocol === 'chrome-extension:') return route.continue()
    blocked++
    return route.abort()
  })
  cdp = await context.browser().newBrowserCDPSession()
  const settings = await context.newPage()
  await settings.goto('chrome://extensions/')
  const infos = await settings.evaluate(() => chrome.developerPrivate.getExtensionsInfo({}))
  const info = infos.find(v => v.name === JSON.parse(readFileSync(join(extension, 'manifest.json'))).name)
  assert.ok(info && info.state === 'ENABLED')
  assert.deepEqual(info.permissions.runtimeHostPermissions.hosts, [])
  extensionId = info.id
  await settings.close()
})
after(async () => {
  await context?.close()
  if (profileDir) rmSync(profileDir, { recursive: true, force: true })
})

async function openPopup(page) {
  await page.bringToFront()
  const target = (await cdp.send('Target.getTargets', { filter: [{}] })).targetInfos.find(t => t.type === 'tab' && t.url === page.url())
  await cdp.send('Extensions.triggerAction', { id: extensionId, targetId: target.targetId })
  let popupTarget
  for (let i = 0; i < 60 && !popupTarget; i++) {
    popupTarget = (await cdp.send('Target.getTargets')).targetInfos.find(t => t.url === `chrome-extension://${extensionId}/popup.html`)
    if (!popupTarget) await sleep(50)
  }
  assert.ok(popupTarget, 'popup opened')
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: popupTarget.targetId, flatten: false })
  let nextId = 0
  const pending = new Map()
  const errors = []
  const onMessage = event => {
    if (event.sessionId !== sessionId) return
    const m = JSON.parse(event.message)
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params?.exceptionDetails?.text || 'exception')
    const h = m.id && pending.get(m.id)
    if (!h) return
    pending.delete(m.id)
    m.error ? h.reject(new Error(m.error.message)) : h.resolve(m.result)
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
      const v = await rpc('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true })
      if (v.exceptionDetails) throw new Error(v.exceptionDetails.exception?.description || v.exceptionDetails.text)
      return v.result.value
    },
    async waitFor(expression, ms = 15000) {
      const until = Date.now() + ms
      while (Date.now() < until) {
        if (await this.eval(expression).catch(() => false)) return
        await sleep(150)
      }
      throw new Error(`Timed out: ${expression} (state ${await this.eval('current && current.state').catch(() => '?')})`)
    },
    async close() {
      cdp.off('Target.receivedMessageFromTarget', onMessage)
      await cdp.send('Target.closeTarget', { targetId: popupTarget.targetId }).catch(() => {})
    },
  }
  await popup.waitFor("document.getElementById('state').textContent !== 'Checking this tab…'")
  return popup
}

async function setup(o) {
  fixture = { page: netflixPage(o), server: graphqlServer(o) }
  const page = await context.newPage()
  await page.goto('https://www.netflix.com/browse/my-list')
  await page.waitForSelector('#my-list [data-uia="standard-card"]')
  if (o.prefetch) await page.waitForFunction(() => window.__fixture.requests >= 1)
  return page
}
async function capture(o) {
  const page = await setup(o)
  const popup = await openPopup(page)
  await popup.eval("document.getElementById('start').click()")
  await popup.waitFor("current && (current.state === 'traversal_stopped' || current.state === 'discarded' || current.state === 'finalized')", 120000)
  if (o.during) await o.during(page, popup)
  if ((await popup.eval('current.state')) === 'traversal_stopped') {
    await popup.eval("document.getElementById('finish').click()")
    await popup.waitFor("current && current.state === 'finalized'", 15000)
  }
  const r = await popup.eval('current')
  const reportText = await popup.eval("document.getElementById('report').textContent")
  const nativeAfter = await page.evaluate(() => /\[native code\]/.test(Function.prototype.toString.call(window.fetch)) && /\[native code\]/.test(Function.prototype.toString.call(XMLHttpRequest.prototype.send)))
  const errors = popup.errors.slice()
  await popup.close()
  await page.close()
  return { r, reportText, nativeAfter, errors }
}
const noPrivateText = (text, list) => list.every(i => !text.includes(i.title) && !text.includes(String(i.id))) && !text.includes('ROW-MYLIST') && !text.includes('Synthetic profile')

test('E2E: a clean 77-title list over fetch is fully covered and stays partial with snapshot_unproven', async () => {
  const list = makeList(77)
  const { r, reportText, nativeAfter, errors } = await capture({ list })
  assert.equal(r.result.verdict, 'partial')
  assert.equal(r.result.reason, 'snapshot_unproven')
  const rep = r.result.report
  assert.equal(rep.positionsCovered, 77)
  assert.equal(rep.unobservedPositions, 0)
  assert.equal(rep.reportedTotal, 77)
  assert.equal(rep.traversalOutcome, 'coverage_reached')
  assert.ok(rep.transport.fetch >= 5)
  assert.equal(rep.cleanupResult, 'restored')
  assert.equal(rep.cardsOutsideEntries, 0)
  assert.ok(rep.advances <= rep.clickCap)
  assert.equal(nativeAfter, true)
  assert.ok(noPrivateText(reportText, list), 'report holds counts and codes only')
  assert.deepEqual(errors, [])
})

test('E2E: the same over XMLHttpRequest', async () => {
  const list = makeList(40)
  const { r } = await capture({ list, transport: 'xhr' })
  assert.equal(r.result.reason, 'snapshot_unproven')
  assert.equal(r.result.report.positionsCovered, 40)
  assert.ok(r.result.report.transport.xhr >= 2)
})

test('E2E: a page fetched before install shows as unobserved positions, cause unknown', async () => {
  const list = makeList(60)
  const { r } = await capture({ list, prefetch: true })
  assert.equal(r.result.reason, 'unobserved_positions')
  assert.ok(r.result.report.unobservedPositions >= 12)
})

test('E2E: a list change between page reads is caught by its own code', async () => {
  const list = makeList(50)
  const { r } = await capture({ list, mutate: s => { if (s.requests === 2) s.list.splice(20, 0, { id: 79999, title: 'Invented added', type: 'Movie' }) } })
  assert.notEqual(r.result.reason, 'snapshot_unproven')
  assert.ok(r.result.report.stickyCodes.includes('response_rejected_total'), r.result.report.stickyCodes.join(','))
})

test('E2E: a profile change discards the session and cleans up', async () => {
  const list = makeList(77)
  const page = await setup({ list, delay: 1500 })
  const popup = await openPopup(page)
  await popup.eval("document.getElementById('start').click()")
  await popup.waitFor("current && current.state === 'collecting'")
  await sleep(1500)
  await page.evaluate(() => document.querySelector('img[data-uia="navigation+profile-menu+Avatar"]').setAttribute('src', '/avatar-b.png'))
  await popup.waitFor("current && current.state === 'discarded'")
  const cur = await popup.eval('current')
  assert.equal(cur.result.reason, 'ended_terminated_profile')
  assert.equal(await page.evaluate(() => /\[native code\]/.test(Function.prototype.toString.call(window.fetch))), true)
  await popup.close()
  await page.close()
})

test('E2E: Cancel then a new Start runs a clean second session', async () => {
  const list = makeList(40)
  const page = await setup({ list })
  let popup = await openPopup(page)
  await popup.eval("document.getElementById('start').click()")
  await popup.waitFor("current && current.state === 'collecting'")
  await popup.eval("document.getElementById('cancel').click()")
  await popup.waitFor("current && current.state === 'discarded'")
  assert.equal(await popup.eval('current.result.reason'), 'ended_cancelled')
  await popup.eval("document.getElementById('start').click()")
  await popup.waitFor("current && current.state === 'traversal_stopped'", 60000)
  await popup.eval("document.getElementById('finish').click()")
  await popup.waitFor("current && current.state === 'finalized'")
  assert.equal(await popup.eval('current.result.report.positionsCovered'), 40)
  await popup.close()
  await page.close()
})

test('E2E: an ambiguous arrow means no clicks: manual fallback', async () => {
  const list = makeList(40)
  const page = await setup({ list, twoArrows: true })
  const popup = await openPopup(page)
  await popup.eval("document.getElementById('start').click()")
  await popup.waitFor("current && current.traversalOutcome === 'manual_fallback'", 10000)
  assert.equal(await page.evaluate(() => window.__fixture.clicks), 0)
  await popup.eval("document.getElementById('cancel').click()")
  await popup.waitFor("current && current.state === 'discarded'")
  await popup.close()
  await page.close()
})

test('E2E: no request left the machine', () => {
  assert.equal(blocked, 0)
})
