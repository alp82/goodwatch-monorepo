import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { HUB, INIT, openPhoneCard, assertCoverage, matchesDestination } from './nav-support.mjs'
const { chromium, devices } = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)('playwright')
test('Phone hub and action reveal use real safe destinations', async () => {
 const b = await chromium.launch({executablePath: process.env.CHROME_PATH})
 try {
 const page = await b.newPage({...devices['Pixel 7']})
 await page.addInitScript(INIT)
 await page.route('https://benchmark.test/**', route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }))
 await page.goto('https://benchmark.test/')
 await page.setContent(`<header hidden><button aria-haspopup="dialog">Movies</button></header><button aria-haspopup="dialog" aria-label="Browse GoodWatch, you're on Movies">Go to</button><div data-poster-card><a href="/movie/1" data-gwnav onclick="event.preventDefault(); setTimeout(() => this.nextElementSibling.hidden=false,100)">Poster</a><div hidden><button onclick="throw Error('Member write')">Seen</button><a aria-label="Open Title" href="/movie/1">Open</a></div></div>`)
 assert.equal(await page.locator('header button:visible').count(), 0)
 assert.equal(await page.locator(HUB).count(), 1)
 assert.equal(await page.evaluate(async () => { try {await fetch('https://goodwatch.app/api/write', {method:'POST'}); return false} catch (e) {return e.message === 'Read-only benchmark'} }), true)
 assert.equal(await page.evaluate(async () => (await fetch('/api/discover/results', {method:'POST'})).status),200)
 const pick = page.locator('[data-gwnav]')
 await pick.tap()
 assert.equal(await openPhoneCard(page,pick,'/movie/1'),true)
 assert.equal(await page.locator('[data-gwnav]').textContent(),'Open')
 assert.equal(await page.locator('[data-gwnav]').getAttribute('href'),'/movie/1')
 await Promise.all([page.waitForURL('https://benchmark.test/movie/1'), page.locator('[data-gwnav]').tap()])
 assert.equal(new URL(page.url()).pathname,'/movie/1')
 } finally {await b.close()}
})
test('Coverage rejects null timings and unverified destinations', () => {
 const good = Array.from({length:13},()=>({step:'x',commit:10,paint:20,verified:true}))
 assertCoverage([good])
 assert.throws(()=>assertCoverage([[...good.slice(1),{step:'x',commit:null,paint:null}]]),/Incomplete/)
 assert.throws(()=>assertCoverage([[...good.slice(1),{step:'x',commit:10,paint:20,verified:false}]]),/Incomplete/)
})
test('A later query restoration preserves the first commit and frame', async () => {
 const b=await chromium.launch({executablePath:process.env.CHROME_PATH})
 try {
 const page=await b.newPage()
 await page.addInitScript(INIT)
 await page.goto('data:text/html,<html></html>')
 await page.evaluate(()=>{window.__remixRouter={state:{location:{key:'initial'}},subscribe(fn){window.commitState=fn}}})
 await page.waitForFunction(()=>!!window.commitState)
 await page.evaluate(()=>{window.__gwMark();window.commitState({navigation:{state:'idle'},location:{key:'first'}})})
 await page.waitForFunction(()=>window.__gw.paint!==null)
 const first=await page.evaluate(()=>({...window.__gw}))
 await page.evaluate(()=>window.commitState({navigation:{state:'idle'},location:{key:'restored-query'}}))
 const after=await page.evaluate(()=>({...window.__gw}))
 assert.equal(after.commit,first.commit)
 assert.equal(after.paint,first.paint)
 assert.ok(after.paint>=after.commit)
 } finally {await b.close()}
})

test('Only bare Discover links allow query restoration', () => {
 assert.equal(matchesDestination('/discover?foryou=0','/discover'),true)
 assert.equal(matchesDestination('/discover?foryou=0','/discover',true),false)
 assert.equal(matchesDestination('/discover?foryou=0','/discover?foryou=1'),false)
 assert.equal(matchesDestination('/movies/best','/discover'),false)
 assert.equal(matchesDestination('/discover/other','/discover'),false)
})
