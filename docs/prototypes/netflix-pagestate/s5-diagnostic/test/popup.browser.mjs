// End to end: the real unpacked diagnostic extension and its popup in Chromium,
// on a synthetic Netflix My List page with a local fake GraphQL server. Every
// netflix.com request is fulfilled locally; nothing is sent to Netflix.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, cpSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { chromium, executablePath, sleep } from './browser.mjs'
import { graphqlServer, makeList, s5Page } from './fixture.mjs'

const extension = fileURLToPath(new URL('../extension', import.meta.url))
import { adapter } from './config.mjs'
let packaged
let context
let cdp
let extensionId
let profileDir
let fixture = { page: '', server: null }
let blocked = 0

before(async () => {
  profileDir = mkdtempSync(join(tmpdir(), 'gw730-'))
  packaged=join(profileDir,'extension')
  cpSync(extension,packaged,{recursive:true})
  writeFileSync(join(packaged,'adapter-config.js'),'globalThis.GWS5AdapterConfig='+JSON.stringify({...adapter,fixture:false}))
  context = await chromium.launchPersistentContext(profileDir, {
    executablePath, headless: true, viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${packaged}`, `--load-extension=${packaged}`, '--host-resolver-rules=MAP * ~NOTFOUND', '--enable-unsafe-extension-debugging'],
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
      if (url.pathname.endsWith('.js')) return route.fulfill({body:'',contentType:'text/javascript'})
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

test('real extension popup: owner-only Start, automatic counts report, no private data or persistent host grant',async () => {
  fixture={page:s5Page({list:makeList(77)}),server:graphqlServer({list:makeList(77)})}
  const page=await context.newPage()
  await page.goto('https://www.netflix.com/browse/my-list')
  const popup=await openPopup(page)
  try {
    assert.match(await popup.eval('document.body.textContent'),/Owner-only experiment/)
    await popup.eval("document.getElementById('start').click()")
    await popup.waitFor("current && current.state==='finalized'")
    assert.equal(await popup.eval('current.report.s5IssuedCalls'),2)
    assert.equal(await popup.eval('current.report.reason'),'snapshot_unproven')
    assert.equal(fixture.server.requests,2)
    const text=await popup.eval("document.getElementById('report').textContent")
    assert.ok(!text.includes('Invented title') && !text.includes('ROW-MYLIST') && !text.includes('Synthetic profile'))
    assert.equal(await page.evaluate(() => window.__fixture.clicks),0)
    assert.deepEqual(popup.errors,[])
  } finally {await popup.close();await page.close()}
})

test('popup does not claim private evidence was released when cleanup failed',async()=>{
  fixture={page:s5Page({list:makeList(77)}),server:graphqlServer({list:makeList(77)})}
  const page=await context.newPage();await page.goto('https://www.netflix.com/browse/my-list')
  const popup=await openPopup(page)
  try{
    await popup.eval("document.getElementById('start').click()")
    await page.waitForFunction(()=>globalThis.GWS5Command?.('status').state==='collecting')
    await page.evaluate(()=>{const release=GWS5Provenance.release;GWS5Provenance.release=()=>{release();throw Error('invented cleanup fault')}})
    await popup.waitFor("current && current.state==='finalized'")
    assert.equal(await popup.eval('current.report.reason'),'cleanup_failed')
    assert.match(await popup.eval("document.getElementById('state').textContent"),/cleanup failure/i)
    assert.doesNotMatch(await popup.eval("document.getElementById('state').textContent"),/Private evidence released/)
  }finally{await popup.close();await page.close()}
})
