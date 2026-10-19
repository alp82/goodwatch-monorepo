// P8 and P9: the page-world observer against native fetch and XMLHttpRequest
// in a real Chromium page. The page is synthetic and served at a routed
// netflix.com origin; nothing is sent to Netflix.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { chromium, executablePath, sleep } from './browser.mjs'

const OBSERVER = readFileSync(new URL('../extension/observer.js', import.meta.url), 'utf8')
const CFG = {
  token: 'tok-1', channel: 'gwtest', rowId: 'ROW1', version: '1', total: 30, label: 'Meine Liste',
  profileMarker: JSON.stringify(['Synthetic profile', '/avatar-a.png']),
  endpoints: ['https://www.netflix.com/graphql'],
  otherGraphqlOrigins: ['https://web.prod.cloud.netflix.com', 'https://sgw.prod.cloud.netflix.com'],
}
const b64 = n => Buffer.from(String(n)).toString('base64')
const IDS = Array.from({ length: 30 }, (_, i) => 5001 + i)

function carouselBody(afterPos, size, over = {}) {
  return {
    operationName: 'CarouselPage',
    variables: { rowId: CFG.rowId, carouselAfterCursor: afterPos < 0 ? null : b64(afterPos), carouselPageSize: size, carouselVersion: CFG.version, ...over.variables },
    extensions: { persistedQuery: { version: 1, sha256Hash: '0' } },
  }
}
// A CarouselPage response, with optional faults.
function listPage(afterPos, size, f = {}) {
  const total = f.total ?? 30
  const start = afterPos + 1
  const end = Math.min(total, start + size)
  const edges = []
  for (let p = start; p < end; p++) {
    if (f.gapAt === p) continue
    edges.push({
      __typename: 'PinotEntityEdge',
      cursor: b64(p),
      node: {
        __typename: f.treatment ?? 'PinotStandardBoxshotEntityTreatment',
        id: `T${p}`, displayString: `Invented ${p}`,
        unifiedEntity: { __typename: p % 2 ? 'Show' : 'Movie', videoId: IDS[p] ?? 9000 + p, unifiedEntityId: `U${p}` },
      },
    })
  }
  return {
    ...(f.errors ? { errors: [{ message: 'x' }] } : {}),
    data: {
      node: {
        __typename: 'PinotCarouselSection', _id: f.rowId ?? CFG.rowId, id: 'S1', displayString: CFG.label, version: f.version ?? CFG.version,
        entities: { __typename: 'PinotEntityConnection', edges, pageInfo: { __typename: 'PageInfo', hasNextPage: f.hasNext ?? end < total, endCursor: b64(end - 1) }, totalCount: total },
      },
    },
  }
}

let browser
let context
let server = () => ({ status: 404, body: '' })
before(async () => {
  browser = await chromium.launch({ executablePath, headless: true })
  context = await browser.newContext()
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin === 'https://www.netflix.com' && url.pathname === '/test') {
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body><button data-uia="navigation+profile-menu+trigger"><img data-uia="navigation+profile-menu+Avatar" alt="Synthetic profile" src="/avatar-a.png"></button></body></html>' })
    }
    if (url.pathname === '/graphql' || url.pathname.startsWith('/raw')) {
      let body = null
      try { body = JSON.parse(route.request().postData() || 'null') } catch {}
      const r = (await server({ url, body, method: route.request().method() })) || { status: 404, body: '' }
      if (r.abort) return route.abort()
      if (r.delay) await sleep(r.delay)
      return route.fulfill({ status: r.status ?? 200, contentType: 'application/json', body: typeof r.body === 'string' ? r.body : JSON.stringify(r.body), headers: { 'access-control-allow-origin': '*' } }).catch(() => {})
    }
    return route.fulfill({ status: 404, body: '' })
  })
})
after(async () => { await browser?.close() })

async function openPage({ observer = true, beforeInstall, serve } = {}) {
  if (serve) server = serve
  const page = await context.newPage()
  await page.goto('https://www.netflix.com/test')
  await page.evaluate(() => {
    window.__unhandled = 0
    window.addEventListener('unhandledrejection', () => { window.__unhandled++ })
  })
  if (beforeInstall) await page.evaluate(beforeInstall)
  if (observer) {
    await page.addScriptTag({ content: OBSERVER })
    const r = await page.evaluate(cfg => window.__gwDiagObserverInstall(cfg), CFG)
    assert.equal(r.ok, true)
  }
  return page
}
const op = (page, name) => page.evaluate(([ch, token, name]) => {
  let reply = null
  const f = e => { reply = e.detail }
  document.addEventListener(`${ch}:res`, f)
  document.dispatchEvent(new CustomEvent(`${ch}:req`, { detail: JSON.stringify({ token, op: name }) }))
  document.removeEventListener(`${ch}:res`, f)
  return reply && JSON.parse(reply)
}, [CFG.channel, CFG.token, name])
const postGraphql = (page, body) => page.evaluate(b => fetch('/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.text()), body)
const serveList = (faults = {}) => ({ body }) => (body?.operationName === 'CarouselPage'
  ? { body: listPage(body.variables.carouselAfterCursor ? Number(Buffer.from(body.variables.carouselAfterCursor, 'base64').toString()) : -1, body.variables.carouselPageSize, faults) }
  : { body: { data: {} } })
async function pullUntil(page, fn, ms = 3000) {
  const until = Date.now() + ms
  let last
  while (Date.now() < until) {
    last = await op(page, 'pull')
    if (fn(last)) return last
    await sleep(50)
  }
  return last
}

// ---- P8 pass-through ---------------------------------------------------------

test('P8: fetch returns the same promise the underlying fetch returned, and the page gets the exact body', async () => {
  const page = await openPage({
    serve: serveList(),
    beforeInstall: () => {
      const inner = window.fetch
      window.fetch = function (...a) { window.__innerPromise = inner.apply(this, a); return window.__innerPromise }
    },
  })
  const same = await page.evaluate(b => { const p = fetch('/graphql', { method: 'POST', body: JSON.stringify(b) }); return p === window.__innerPromise }, carouselBody(12, 6))
  assert.equal(same, true)
  const text = await postGraphql(page, carouselBody(12, 6))
  assert.equal(text, JSON.stringify(listPage(12, 6)))
  const r = await pullUntil(page, x => x.counters.accepted >= 2)
  assert.equal(r.counters.accepted, 2)
  assert.equal(r.outbox.length, 2)
  assert.deepEqual(r.outbox[0].entries.map(e => e.position), [13, 14, 15, 16, 17, 18])
  await page.close()
})

test('P8: no extra getter or accessor calls on init.body, init.method, URL.href or Request.url', async () => {
  const count = async observer => {
    const page = await openPage({ observer, serve: serveList() })
    const n = await page.evaluate(async b => {
      const calls = { body: 0, method: 0, href: 0 }
      const init = {}
      Object.defineProperty(init, 'body', { enumerable: true, get() { calls.body++; return JSON.stringify(b) } })
      Object.defineProperty(init, 'method', { enumerable: true, get() { calls.method++; return 'POST' } })
      await fetch('/graphql', init).then(r => r.text())
      class CountingURL extends URL { get href() { calls.href++; return super.href } }
      await fetch(new CountingURL('https://www.netflix.com/graphql'), { method: 'POST', body: JSON.stringify(b) }).then(r => r.text())
      const u = new URL('https://www.netflix.com/graphql')
      Object.defineProperty(u, 'href', { get() { calls.href++; return 'https://www.netflix.com/graphql' } })
      await fetch(u, { method: 'POST', body: JSON.stringify(b) }).then(r => r.text()).catch(() => {})
      return calls
    }, carouselBody(12, 6))
    const counters = observer ? (await op(page, 'pull')).counters : null
    await page.close()
    return { n, counters }
  }
  const without = await count(false)
  const withObs = await count(true)
  assert.deepEqual(withObs.n, without.n)
  // The accessor-backed init and the non-plain URL inputs are classified, never read.
  assert.ok(withObs.counters.unsupportedBody >= 1)
  assert.ok(withObs.counters.unsupportedInput >= 2)
})

test('P8: a Proxy init sees only the documented extra traps (getPrototypeOf, getOwnPropertyDescriptor)', async () => {
  const traps = async observer => {
    const page = await openPage({ observer, serve: serveList() })
    const t = await page.evaluate(async b => {
      const seen = []
      const init = new Proxy({ method: 'POST', body: JSON.stringify(b) }, new Proxy({}, { get: (_, trap) => (...args) => { seen.push(trap); return Reflect[trap](...args) } }))
      await fetch('/graphql', init).then(r => r.text())
      return seen
    }, carouselBody(12, 6))
    await page.close()
    return t
  }
  const without = await traps(false)
  const withObs = await traps(true)
  const extra = [...withObs]
  for (const t of without) extra.splice(extra.indexOf(t), 1)
  assert.ok(extra.every(t => t === 'getPrototypeOf' || t === 'getOwnPropertyDescriptor'), extra.join(','))
})

test('P8: native synchronous exceptions are rethrown unchanged and leave no binding', async () => {
  const page = await openPage({
    serve: serveList(),
    beforeInstall: () => {
      window.__thrown = new TypeError('synthetic sync failure')
      const inner = window.fetch
      window.fetch = function (input, init) { if (init && init.__throw) throw window.__thrown; return inner.apply(this, arguments) }
    },
  })
  const r = await page.evaluate(b => {
    const out = {}
    try { fetch('/graphql', { method: 'POST', body: JSON.stringify(b), __throw: true }) } catch (e) { out.fetchSame = e === window.__thrown }
    const x = new XMLHttpRequest()
    try { x.send() } catch (e) { out.sendName = e.name }
    try { x.open('CONNECT', '/graphql') } catch (e) { out.openName = e.name }
    return out
  }, carouselBody(12, 6))
  assert.deepEqual(r, { fetchSame: true, sendName: 'InvalidStateError', openName: 'SecurityError' })
  const p = await op(page, 'pull')
  assert.equal(p.pending, 0)
  assert.equal(p.counters.myListBindings, 0)
  await page.close()
})

test('P8: rejected fetches cause no unhandled rejection from observer promises; the handled-marking difference is asserted', async () => {
  const run = async observer => {
    const page = await openPage({ observer, serve: () => ({ abort: true }) })
    await page.evaluate(b => fetch('/graphql', { method: 'POST', body: JSON.stringify(b) }).catch(() => {}), carouselBody(12, 6))
    await sleep(300)
    const handled = await page.evaluate(() => window.__unhandled)
    await page.evaluate(b => { fetch('/graphql', { method: 'POST', body: JSON.stringify(b) }) }, carouselBody(12, 6))
    await sleep(500)
    const total = await page.evaluate(() => window.__unhandled)
    await page.close()
    return { handled, unhandledByPage: total - handled }
  }
  const without = await run(false)
  const withObs = await run(true)
  assert.equal(without.handled, 0)
  assert.equal(withObs.handled, 0)
  assert.equal(without.unhandledByPage, 1)
  // Documented difference: the observer's handler marks Netflix's promise as handled.
  assert.equal(withObs.unhandledByPage, 0)
})

test('P8: an already consumed response gives response_unreadable', async () => {
  const page = await openPage({
    serve: serveList(),
    beforeInstall: () => {
      const inner = window.fetch
      window.fetch = function () { return inner.apply(this, arguments).then(async r => { await r.text(); return r }) }
    },
  })
  await page.evaluate(b => fetch('/graphql', { method: 'POST', body: JSON.stringify(b) }), carouselBody(12, 6))
  const r = await pullUntil(page, x => x.sticky.includes('response_unreadable'))
  assert.ok(r.sticky.includes('response_unreadable'))
  assert.equal(r.counters.accepted, 0)
  await page.close()
})

test('P8: an XHR reopened in onload before loadend is xhr_reused and nothing is read', async () => {
  const page = await openPage({ serve: serveList() })
  await page.evaluate(b => new Promise(res => {
    const x = new XMLHttpRequest()
    x.open('POST', '/graphql')
    x.onload = () => { x.open('GET', '/raw-other'); res() }
    x.send(JSON.stringify(b))
  }), carouselBody(12, 6))
  const r = await pullUntil(page, x => x.counters.xhrReused >= 1)
  assert.equal(r.counters.xhrReused, 1)
  assert.ok(r.sticky.includes('xhr_reused') && r.sticky.includes('pending_unresolved'))
  assert.equal(r.counters.accepted, 0)
  await page.close()
})

test('P8: XHR with text and json response types is read; blob is unsupported', async () => {
  const page = await openPage({ serve: serveList() })
  for (const type of ['', 'json', 'blob']) {
    await page.evaluate(([b, type]) => new Promise(res => {
      const x = new XMLHttpRequest()
      x.open('POST', '/graphql')
      x.responseType = type
      x.onloadend = () => res()
      x.send(JSON.stringify(b))
    }), [carouselBody(12, 6), type])
  }
  const r = await pullUntil(page, x => x.counters.accepted >= 2 && x.sticky.includes('unsupported_response_type'))
  assert.equal(r.counters.accepted, 2)
  assert.ok(r.sticky.includes('unsupported_response_type'))
  assert.equal(r.counters.transportXhr, 3)
  await page.close()
})

test('P8: request-string limits and unreadable bodies are classified without reading', async () => {
  const page = await openPage({ serve: serveList() })
  await page.evaluate(b => Promise.all([
    fetch('/graphql', { method: 'POST', body: JSON.stringify({ ...b, pad: 'x'.repeat(70000) }) }).then(r => r.text()),
    fetch(new Request('https://www.netflix.com/graphql', { method: 'POST', body: JSON.stringify(b) })).then(r => r.text()),
    fetch('/graphql', { method: 'POST', body: new Blob([JSON.stringify(b)]) }).then(r => r.text()),
  ]), carouselBody(12, 6))
  const r = await op(page, 'pull')
  assert.ok(r.sticky.includes('request_too_large'))
  assert.ok(r.sticky.includes('unsupported_body'))
  assert.equal(r.counters.requestTooLarge, 1)
  assert.equal(r.counters.unsupportedBody, 2)
  await page.close()
})

test('P8: a response over 2 MB is dropped by the observer while the page receives all of it', async () => {
  const big = { ...listPage(12, 6), pad: 'y'.repeat(2.5 * 1024 * 1024) }
  const page = await openPage({ serve: () => ({ body: big }) })
  const len = await page.evaluate(b => fetch('/graphql', { method: 'POST', body: JSON.stringify(b) }).then(r => r.text()).then(t => t.length), carouselBody(12, 6))
  assert.equal(len, JSON.stringify(big).length)
  const r = await pullUntil(page, x => x.sticky.includes('response_too_large'))
  assert.ok(r.sticky.includes('response_too_large'))
  assert.equal(r.counters.sizeDrops, 1)
  await page.close()
})

test('P8: more than 4 concurrent observer readers gives observer_overloaded', async () => {
  const page = await openPage({ serve: ({ body }) => ({ ...serveList()({ body }), delay: 50 }) })
  // Slow streaming bodies keep the observer's readers busy.
  await page.evaluate(b => {
    const inner = window.fetch
    window.__slow = () => new Response(new ReadableStream({ start(c) { setTimeout(() => { c.enqueue(new TextEncoder().encode(JSON.stringify({ data: {} }))); c.close() }, 800) } }))
    return Promise.all(Array.from({ length: 6 }, (_, i) => fetch('/graphql', { method: 'POST', body: JSON.stringify({ ...b, variables: { ...b.variables, carouselAfterCursor: btoa(String(12 + i * 3)) } }) }).then(r => r.text())))
  }, carouselBody(12, 3))
  const r = await pullUntil(page, x => x.pending === 0, 4000)
  assert.equal(r.pending, 0)
  // Six concurrent My List reads of normal size fit when they finish quickly; the
  // bound itself is exercised with slow bodies below.
  await page.close()
  const page2 = await openPage({
    serve: serveList(),
    beforeInstall: () => {
      const inner = window.fetch
      window.fetch = function () {
        return inner.apply(this, arguments).then(r => r.text().then(t => new Response(new ReadableStream({ start(c) { setTimeout(() => { c.enqueue(new TextEncoder().encode(t)); c.close() }, 1000) } }), { status: 200 })))
      }
    },
  })
  await page2.evaluate(b => Promise.all(Array.from({ length: 6 }, (_, i) => fetch('/graphql', { method: 'POST', body: JSON.stringify({ ...b, variables: { ...b.variables, carouselAfterCursor: btoa(String(i)) } }) }).then(r => r.text()))), carouselBody(12, 3))
  const r2 = await pullUntil(page2, x => x.sticky.includes('observer_overloaded'), 4000)
  assert.ok(r2.sticky.includes('observer_overloaded'))
  await page2.close()
})

test('P8: delayed and out-of-order responses are all accepted', async () => {
  const page = await openPage({ serve: ({ body }) => ({ ...serveList()({ body }), delay: body.variables.carouselAfterCursor === Buffer.from('12').toString('base64') ? 600 : 50 }) })
  await page.evaluate(([a, b]) => Promise.all([fetch('/graphql', { method: 'POST', body: JSON.stringify(a) }), fetch('/graphql', { method: 'POST', body: JSON.stringify(b) })]), [carouselBody(12, 6), carouselBody(18, 6)])
  const r = await pullUntil(page, x => x.counters.accepted === 2)
  assert.equal(r.counters.accepted, 2)
  await page.close()
})

test('P8: other GraphQL endpoints are counted, never accepted', async () => {
  const page = await openPage({ serve: serveList() })
  await page.evaluate(b => fetch('https://web.prod.cloud.netflix.com/graphql', { method: 'POST', body: JSON.stringify(b) }).then(r => r.text()).catch(() => {}), carouselBody(12, 6))
  const r = await op(page, 'pull')
  assert.equal(r.counters.endpointOther, 1)
  assert.equal(r.counters.myListBindings, 0)
  await page.close()
})

test('P8/P4: each response fault has its own rejection code and its entries are excluded', async () => {
  const cases = [
    ['response_rejected_version', { version: '2' }],
    ['response_rejected_total', { total: 31 }],
    ['response_rejected_positions', { gapAt: 14 }],
    ['response_rejected_entity', { treatment: 'PinotSomethingElse' }],
    ['response_rejected_has_next', { hasNext: false }],
    ['response_rejected_errors', { errors: true }],
    ['response_rejected_row_id', { rowId: 'OTHER' }],
  ]
  for (const [code, faults] of cases) {
    const page = await openPage({ serve: serveList(faults) })
    await postGraphql(page, carouselBody(12, 6))
    const r = await pullUntil(page, x => x.sticky.includes(code))
    assert.ok(r.sticky.includes(code), `${code}: ${r.sticky}`)
    assert.equal(r.outbox.length, 0, code)
    await page.close()
  }
  const page = await openPage({ serve: () => ({ status: 500, body: '{}' }) })
  await postGraphql(page, carouselBody(12, 6))
  assert.ok((await pullUntil(page, x => x.sticky.includes('response_rejected_status'))).sticky.includes('response_rejected_status'))
  await page.close()
})

test('P8: a profile change seen at binding time is recorded', async () => {
  const page = await openPage({ serve: serveList() })
  await page.evaluate(() => document.querySelector('img[data-uia="navigation+profile-menu+Avatar"]').setAttribute('src', '/avatar-b.png'))
  await postGraphql(page, carouselBody(12, 6))
  const r = await op(page, 'pull')
  assert.ok(r.sticky.includes('profile_changed'))
  await page.close()
})

// ---- P9 lifecycle -------------------------------------------------------------

test('P9: a response bound before the cutoff and delivered during the drain is accepted and transferred', async () => {
  const page = await openPage({ serve: ({ body }) => ({ ...serveList()({ body }), delay: 800 }) })
  await page.evaluate(b => { window.__p = fetch('/graphql', { method: 'POST', body: JSON.stringify(b) }).then(r => r.text()) }, carouselBody(12, 6))
  await sleep(100)
  await op(page, 'cutoff')
  const during = await op(page, 'pull')
  assert.equal(during.pending, 1)
  const r = await pullUntil(page, x => x.outbox.length === 1, 3000)
  assert.equal(r.outbox.length, 1)
  assert.equal(r.pending, 0)
  await page.close()
})

test('P9: requests after the cutoff are counted, not bound', async () => {
  const page = await openPage({ serve: serveList() })
  await op(page, 'cutoff')
  await postGraphql(page, carouselBody(12, 6))
  const r = await op(page, 'pull')
  assert.equal(r.counters.afterCutoff, 1)
  assert.equal(r.counters.myListBindings, 0)
  await page.close()
})

test('P9: the drain bound seals the session; pending becomes pending_unresolved and late callbacks change nothing', async () => {
  const page = await openPage({ serve: ({ body }) => ({ ...serveList()({ body }), delay: 2500 }) })
  await page.evaluate(b => { fetch('/graphql', { method: 'POST', body: JSON.stringify(b) }).then(r => r.text()) }, carouselBody(12, 6))
  await sleep(100)
  await op(page, 'cutoff')
  const sealed = await op(page, 'seal')
  assert.ok(sealed.sticky.includes('pending_unresolved'))
  assert.equal(sealed.pending, 0)
  const before = JSON.stringify({ c: sealed.counters.accepted, s: sealed.sticky })
  await sleep(3000)
  const later = await op(page, 'pull')
  assert.equal(JSON.stringify({ c: later.counters.accepted, s: later.sticky }), before)
  assert.equal(later.outbox.length, 0)
  assert.equal(later.counters.lateDropped, 1)
  await page.close()
})

test('P9: cleanup restores methods it still owns', async () => {
  const page = await openPage({ serve: serveList() })
  await page.evaluate(() => { window.__origFetchName = window.fetch.name })
  const c = await op(page, 'cleanup')
  assert.equal(c.cleanupResult, 'restored')
  const native = await page.evaluate(() => ({ fetch: /\[native code\]/.test(Function.prototype.toString.call(window.fetch)), open: /\[native code\]/.test(Function.prototype.toString.call(XMLHttpRequest.prototype.open)), send: /\[native code\]/.test(Function.prototype.toString.call(XMLHttpRequest.prototype.send)) }))
  assert.deepEqual(native, { fetch: true, open: true, send: true })
  await page.close()
})

test('P9: a displaced wrapper becomes inert; the page wrapper on top keeps working', async () => {
  const page = await openPage({ serve: serveList() })
  await page.evaluate(() => { const ours = window.fetch; window.fetch = function () { window.__topCalls = (window.__topCalls || 0) + 1; return ours.apply(this, arguments) } })
  const c = await op(page, 'cleanup')
  assert.equal(c.cleanupResult, 'inert')
  const text = await postGraphql(page, carouselBody(12, 6))
  assert.equal(text, JSON.stringify(listPage(12, 6)))
  assert.equal(await page.evaluate(() => window.__topCalls), 1)
  await page.close()
})

test('P9: cleanup removes XHR listeners and cancels observer readers while Netflix still gets its responses', async () => {
  const page = await openPage({
    serve: ({ body }) => ({ ...serveList()({ body }), delay: 600 }),
    beforeInstall: () => {
      const inner = window.fetch
      window.fetch = function () {
        return inner.apply(this, arguments).then(r => r.text().then(t => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(t.slice(0, 10))); setTimeout(() => { c.enqueue(new TextEncoder().encode(t.slice(10))); c.close() }, 1200) } }), { status: 200 })))
      }
    },
  })
  await page.evaluate(b => {
    window.__xhrDone = false
    const x = new XMLHttpRequest()
    x.open('POST', '/graphql')
    x.onloadend = () => { window.__xhrLen = x.responseText.length; window.__xhrDone = true }
    x.send(JSON.stringify(b))
    window.__fetchText = fetch('/graphql', { method: 'POST', body: JSON.stringify(b) }).then(r => r.text())
  }, carouselBody(12, 6))
  await sleep(900)
  const c = await op(page, 'cleanup')
  assert.equal(c.cleanupResult, 'restored')
  const page1 = await page.evaluate(async () => { const t = await window.__fetchText; while (!window.__xhrDone) await new Promise(r => setTimeout(r, 50)); return { fetchLen: t.length, xhrLen: window.__xhrLen } })
  const expected = JSON.stringify(listPage(12, 6)).length
  assert.deepEqual(page1, { fetchLen: expected, xhrLen: expected })
  const after = await op(page, 'pull')
  assert.equal(after, null) // channel removed with cleanup
  await page.close()
})

test('P9: a cleanup that can\'t restore reports failed', async () => {
  const page = await openPage({ serve: serveList() })
  await page.evaluate(() => { Object.defineProperty(window, 'fetch', { value: window.fetch, writable: false, configurable: false }) })
  const c = await op(page, 'cleanup')
  assert.equal(c.cleanupResult, 'failed')
  await page.close()
})

test('P9: the observer removes itself when its session lifetime ends', async () => {
  const page = await openPage({ serve: serveList() })
  await page.close()
  const page2 = await context.newPage()
  await page2.goto('https://www.netflix.com/test')
  await page2.addScriptTag({ content: OBSERVER })
  await page2.evaluate(cfg => window.__gwDiagObserverInstall({ ...cfg, sessionMs: 400 }), CFG)
  await sleep(700)
  const r = await page2.evaluate(() => ({ native: /\[native code\]/.test(Function.prototype.toString.call(window.fetch)) }))
  assert.equal(r.native, true)
  assert.equal(await op(page2, 'pull'), null)
  await page2.close()
})

// ---- Implementation review of 361b99e0 -------------------------------------------

test('review 1: capacity is checked before cloning; five simultaneous replies make at most four clones', async () => {
  const page = await openPage({
    serve: serveList(),
    beforeInstall: () => {
      window.__clones = 0
      const clone = Response.prototype.clone
      Response.prototype.clone = function () { window.__clones++; return clone.call(this) }
      window.__controllers = []
      window.fetch = function () { return Promise.resolve(new Response(new ReadableStream({ start(c) { window.__controllers.push(c) } }))) }
    },
  })
  await page.evaluate(b => { for (let i = 0; i < 5; i++) fetch('/graphql', { method: 'POST', body: JSON.stringify(b) }) }, carouselBody(-1, 1))
  await sleep(100)
  const r = await op(page, 'pull')
  assert.equal(await page.evaluate(() => window.__clones), 4)
  assert.ok(r.sticky.includes('observer_overloaded'))
  await page.close()
})

test('review 2: rejected stream cancellations never become unhandled rejections', async () => {
  const page = await openPage({
    serve: serveList(),
    beforeInstall: () => {
      window.__responses = []
      window.fetch = function () {
        const r = new Response(new ReadableStream({ start() {}, cancel() { return Promise.reject(new Error('synthetic cancel rejection')) } }))
        window.__responses.push(r)
        return Promise.resolve(r)
      }
    },
  })
  await page.evaluate(b => { for (let i = 0; i < 4; i++) fetch('/graphql', { method: 'POST', body: JSON.stringify(b) }) }, carouselBody(-1, 1))
  await sleep(100)
  // The source's cancel runs (and rejects) only once both stream branches are
  // cancelled, so the page cancels its own branch first, handling its result.
  await page.evaluate(() => { for (const r of window.__responses) r.body.cancel().catch(() => {}) })
  await op(page, 'seal')
  await op(page, 'cleanup')
  await sleep(300)
  assert.equal(await page.evaluate(() => window.__unhandled), 0)
  await page.close()
})

test('review 3: after cleanup a cached wrapper classifies nothing, even when restore succeeded', async () => {
  const page = await openPage({ serve: serveList() })
  const r = await page.evaluate(async ([ch, token]) => {
    const cached = window.fetch
    let result
    const f = e => { result = JSON.parse(e.detail) }
    document.addEventListener(`${ch}:res`, f)
    document.dispatchEvent(new CustomEvent(`${ch}:req`, { detail: JSON.stringify({ token, op: 'cleanup' }) }))
    document.removeEventListener(`${ch}:res`, f)
    let traps = 0
    const init = new Proxy({ method: 'POST', body: '{}' }, {
      getPrototypeOf(t) { traps++; return Reflect.getPrototypeOf(t) },
      getOwnPropertyDescriptor(t, k) { traps++; return Reflect.getOwnPropertyDescriptor(t, k) },
    })
    await fetch('/graphql', init).then(x => x.text())
    const nativeTraps = traps
    traps = 0
    await cached('/graphql', init).then(x => x.text())
    return { cleanup: result.cleanupResult, nativeTraps, cachedTraps: traps }
  }, [CFG.channel, CFG.token])
  assert.equal(r.cleanup, 'restored')
  assert.equal(r.cachedTraps, r.nativeTraps)
  await page.close()
})

test('review 4: cleanup cancels the lifetime timer', async () => {
  const page = await openPage({
    serve: serveList(),
    beforeInstall: () => {
      window.__timers = new Set()
      const st = window.setTimeout
      const ct = window.clearTimeout
      window.setTimeout = function (fn, ms) { const id = st.call(window, () => { window.__timers.delete(id); fn() }, ms); if (ms >= 60000) window.__timers.add(id); return id }
      window.clearTimeout = function (id) { window.__timers.delete(id); return ct.call(window, id) }
    },
  })
  assert.equal(await page.evaluate(() => window.__timers.size), 1)
  await op(page, 'cleanup')
  assert.equal(await page.evaluate(() => window.__timers.size), 0)
  await page.close()
})

test('review 6: two interleaved replies split inside UTF-8 characters both decode correctly', async () => {
  const page = await openPage({
    serve: serveList(),
    beforeInstall: () => {
      window.__controllers = []
      window.fetch = function () { return Promise.resolve(new Response(new ReadableStream({ start(c) { window.__controllers.push(c) } }))) }
    },
  })
  const result = await page.evaluate(async ([a, b, ch, token]) => {
    const enc = new TextEncoder()
    const sleep = () => new Promise(r => setTimeout(r, 50))
    const aa = enc.encode(JSON.stringify(a))
    const bb = enc.encode(JSON.stringify(b))
    const ai = aa.indexOf(195) + 1
    const bi = bb.indexOf(195) + 1
    const body = JSON.stringify({ operationName: 'CarouselPage', variables: { rowId: 'ROW1', carouselAfterCursor: null, carouselPageSize: 1, carouselVersion: '1' } })
    const ps = [fetch('/graphql', { method: 'POST', body }).then(r => r.json()), fetch('/graphql', { method: 'POST', body }).then(r => r.json())]
    window.__controllers[0].enqueue(aa.slice(0, ai)); await sleep()
    window.__controllers[1].enqueue(bb.slice(0, bi)); await sleep()
    window.__controllers[0].enqueue(aa.slice(ai)); window.__controllers[0].close(); await sleep()
    window.__controllers[1].enqueue(bb.slice(bi)); window.__controllers[1].close()
    await Promise.all(ps); await sleep()
    let out
    const f = e => { out = JSON.parse(e.detail) }
    document.addEventListener(`${ch}:res`, f)
    document.dispatchEvent(new CustomEvent(`${ch}:req`, { detail: JSON.stringify({ token, op: 'pull' }) }))
    document.removeEventListener(`${ch}:res`, f)
    return { accepted: out.counters.accepted, titles: out.outbox.map(p => p.entries[0].title), sticky: out.sticky }
  }, [titled('é'), titled('ö'), CFG.channel, CFG.token])
  assert.equal(result.accepted, 2, result.sticky.join(','))
  assert.deepEqual(result.titles.sort(), ['é', 'ö'])
  await page.close()
})

test('regression: XHR json responses are inspected without calling page-defined getters', async () => {
  const page = await openPage({ serve: serveList() })
  const r = await page.evaluate(b => new Promise(resolve => {
    window.__hits = 0
    const x = new XMLHttpRequest()
    x.open('POST', '/graphql')
    x.responseType = 'json'
    x.onload = () => { Object.defineProperty(x.response, 'extra', { enumerable: true, get() { window.__hits++; return 1 } }) }
    x.onloadend = () => setTimeout(() => resolve(window.__hits), 50)
    x.send(JSON.stringify(b))
  }), carouselBody(12, 6))
  assert.equal(r, 0)
  await page.close()
})

function titled(title) {
  return { data: { node: { __typename: 'PinotCarouselSection', _id: 'ROW1', displayString: 'Meine Liste', version: '1', entities: { totalCount: 30, edges: [{ cursor: b64(0), node: { __typename: 'PinotStandardBoxshotEntityTreatment', displayString: title, unifiedEntity: { __typename: 'Movie', videoId: 1 } } }], pageInfo: { hasNextPage: true } } } } }
}
