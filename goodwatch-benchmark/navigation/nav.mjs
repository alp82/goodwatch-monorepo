// Click-through navigation benchmark with in-page timing.
// usage: node nav.mjs <origin> <desktop|mobile> <tap|hover> <runs> <out.json> [cookieFile]
import { createRequire } from 'node:module'
import { writeFileSync, readFileSync } from 'node:fs'
import { HUB, INIT, openPhoneCard, assertCoverage, matchesDestination } from './nav-support.mjs'
const { chromium, devices } = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)('playwright')
const [origin, profile, mode, runsArg, out, cookieFile] = process.argv.slice(2)
const exe = process.env.CHROME_PATH || undefined
const TITLE = 'main a[href^="/movie/"], main a[href^="/show/"]'
const FLOW = [
	{ name: 'list→title', start: '/movies/best', sel: TITLE },
	{ name: 'title→person', sel: 'main a[href^="/person/"]' },
	{ name: 'person→title', sel: TITLE },
	{ name: 'title→title', sel: TITLE, skip: 2 },
	{ name: 'back', back: true },
	{ name: 'back', back: true },
	{ name: 'hub→discover', open: HUB, sel: '[role=dialog] a[href^="/discover"]' },
	{ name: 'discover→title', sel: TITLE },
	{ name: 'hub→shows', open: HUB, sel: '[role=dialog] a[href="/shows"]' },
	{ name: 'shows→category', sel: 'main a[href="/shows/best"]' },
	{ name: 'category→title', sel: TITLE },
	{ name: 'back', back: true },
	{ name: 'forward', forward: true },
]
const IGNORE = /posthog|\/api\/e\b|google|sentry|ingest|impression|\/flags\/\?|web-vitals|array\/phc/

async function run() {
	const browser = await chromium.launch({ executablePath: exe })
	const ctx = await browser.newContext(profile === 'mobile' ? { ...devices['Pixel 7'] } : { viewport: { width: 1440, height: 900 } })
	if (cookieFile) await ctx.addCookies(JSON.parse(readFileSync(cookieFile, 'utf8')))
	await ctx.addInitScript(INIT)
	const page = await ctx.newPage()
	if (process.env.BLOCK_RM) await page.route(/\/api\/related-map/, (r) => r.abort())
	const cdp = await ctx.newCDPSession(page)
	if (profile === 'mobile') {
		await cdp.send('Network.enable')
		// Lighthouse-style slow 4G: 150 ms RTT, 1.6 Mbps down, 750 kbps up; CPU 4x.
		await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 })
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
	}
	const hdr = new Map()
	page.on('response', async (r) => { try { const h = await r.allHeaders(); hdr.set(r.url(), { cc: h['cache-control'], serverTiming: h['server-timing'], status: r.status() }) } catch {} })
	let docs = 0
	page.on('request', (q) => { if (q.isNavigationRequest() && q.frame() === page.mainFrame()) docs++ })
	await page.goto(origin + FLOW[0].start, { waitUntil: 'networkidle', timeout: 90000 })
	await page.waitForTimeout(2000)
	const member = await page.evaluate(() => !!window.__remixRouter?.state.loaderData.root?.user)
	if (member !== !!cookieFile) throw new Error('Session verification failed for requested profile')
	const results = []
	const historyPaths = [FLOW[0].start]
	let historyIndex = 0
	for (const step of FLOW) {
		try {
			if (step.open) {
				await (profile === 'mobile' ? page.locator(step.open).first().tap() : page.locator(step.open).first().click())
				await page.locator(step.sel).first().waitFor({ state: 'visible' })
				await page.waitForTimeout(600)
			}
			let target = null
			if (!step.back && !step.forward) {
				target = await page.evaluate(async ({ sel, skip }) => {
					document.querySelectorAll('[data-gwnav]').forEach((a) => a.removeAttribute('data-gwnav'))
					const as = [...document.querySelectorAll(sel)].filter((a) => !a.closest('[data-related-map]') && a.getAttribute('href').split('?')[0] !== location.pathname)
					let seen = 0
					for (const a of as.slice(0, 80)) {
						a.scrollIntoView({ block: 'center', inline: 'center' })
						await new Promise((r) => setTimeout(r, 60))
						const r = a.getBoundingClientRect()
						if (r.width < 4 || r.height < 4 || r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight) continue
						const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
						if (hit?.closest('a') !== a) continue
						if (seen++ < (skip || 0)) continue
						a.setAttribute('data-gwnav', '1')
						return a.getAttribute('href')
					}
					return null
				}, { sel: step.sel, skip: step.skip })
				if (!target) throw new Error('No reachable link for intended step')
				await page.waitForTimeout(1200) // viewport prefetch and lazy work settle, as a reader would pause
			}
			const pick = page.locator('[data-gwnav]')
			const expected = target || historyPaths[historyIndex + (step.back ? -1 : 1)]
			const from = await page.evaluate(() => location.pathname + location.search)
			const beforeKey = await page.evaluate(() => window.__remixRouter.state.location.key)
			let preparationTap = false
			let preparationMs = 0
			const docsBefore = docs
			const link = target ? await pick.evaluate((a) => (a.hasAttribute('data-discover') ? 'remix' : 'plain')) : null
			let tStart = await page.evaluate(() => performance.now())
			if (step.back || step.forward) {
				await page.evaluate((b) => { window.__gwMark(); b ? history.back() : history.forward() }, !!step.back)
			} else if (mode === 'hover') {
				await pick.hover(); await page.waitForTimeout(300)
				await (profile === 'mobile' ? pick.tap() : pick.click())
			} else {
				await (profile === 'mobile' ? pick.tap() : pick.click())
			}
			// A touch poster may reveal an overlay. Never tap its centre twice:
			// it now contains member write controls. Select only the Open anchor.
			if (profile === 'mobile' && target && await page.evaluate(() => !window.__gw.commit && window.__remixRouter.state.navigation.state === 'idle')) {
				const revealStart = await page.evaluate(() => window.__gw.t0)
				preparationTap = await openPhoneCard(page, pick, target)
				if (preparationTap) {
					tStart = await page.evaluate(() => performance.now())
					await pick.tap()
					preparationMs = await page.evaluate(first => Math.round(window.__gw.t0 - first), revealStart)
				}
			}
			// wait for commit (or a document load)
			let st = null
			for (let i = 0; i < 1500; i++) {
				st = await page.evaluate(() => ({ ...window.__gw, path: location.pathname, nav: window.__remixRouter?.state.navigation.state })).catch(() => null)
				if (st && st.paint) break
				if (docs > docsBefore && st && st.origin && st.nav === 'idle') break
				await page.waitForTimeout(10)
			}
			const doc = docs > docsBefore
			const destination = await page.evaluate(() => ({ url: location.pathname + location.search, key: window.__remixRouter.state.location.key }))
			const verified = matchesDestination(destination.url, expected, !!(step.back || step.forward)) && destination.key !== beforeKey
			if (!verified || !st?.paint) throw new Error(`Navigation verification failed: ${JSON.stringify({ expected, destination: destination.url, changedKey: destination.key !== beforeKey, commit: st?.commit, paint: st?.paint, nav: st?.nav, path: st?.path })}`)
			if (step.back) historyIndex--
			else if (step.forward) historyIndex++
			else { historyPaths.splice(++historyIndex); historyPaths.push(destination.url) }
			if (doc) { await page.waitForLoadState('load') }
			// visible images loaded
			const imgsAt = await page.evaluate(async () => {
				for (let i = 0; i < 300; i++) {
					const vis = [...document.images].filter((im) => { const r = im.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && r.width > 40 })
					if (vis.every((im) => im.complete)) return performance.now()
					await new Promise((r) => setTimeout(r, 25))
				}
				return null
			})
			await page.waitForTimeout(3500)
			const r = await page.evaluate(({ ignore }) => {
				const g = window.__gw
				const t0 = g.t0
				const res = performance.getEntriesByType('resource').filter((e) => (e.startTime >= t0 - 1 || e.responseEnd >= t0) && !new RegExp(ignore).test(e.name))
				return { t0, build: window.__remixManifest?.version, commit: g.commit, paint: g.paint, res: res.map((e) => ({ u: e.name.replace(/^https?:\/\/[^/]+/, ''), host: new URL(e.name).host, type: e.initiatorType, start: Math.round(e.startTime - t0), dur: Math.round(e.duration), ttfb: Math.round(e.responseStart - e.requestStart), kb: Math.round(e.transferSize / 1024), cached: e.transferSize === 0 && e.decodedBodySize > 0 })) }
			}, { ignore: IGNORE.source })
			const rel = (t) => (t == null || r.t0 == null ? null : Math.round(t - r.t0))
			const settledReqs = r.res.filter((e) => !/image\.tmdb|\.(png|jpe?g|webp|avif|svg)/.test(e.u))
			results.push({
				step: step.name, build: r.build, from, target, destination: destination.url, verified, member, preparationTap, preparationMs, link, doc, harnessLag: Math.round(r.t0 - tStart),
				commit: rel(r.commit), paint: rel(r.paint), images: rel(imgsAt),
				lastData: settledReqs.length ? Math.max(...settledReqs.map((e) => e.start + e.dur)) : null,
				res: r.res.filter(e => [new URL(origin).host, 'static.goodwatch.app'].includes(e.host) && !/(?:^|\/)(?:avatars?|profiles?|images?)(?:\/|\?|$)|\.(png|jpe?g|webp|avif|svg)(?:[?#]|$)/i.test(e.u)).map((e) => ({ ...e, ...hdr.get('https://' + e.host + e.u) })),
			})
		} catch (e) { results.push({ step: step.name, error: String(e).slice(0, 600) }); console.error(step.name, results.at(-1).error); break }
		console.log(step.name, results.at(-1).paint ?? results.at(-1).error)
	}
	await browser.close()
	return results
}
const all = []
for (let i = 0; i < Number(runsArg); i++) {
	console.log(`Round ${i + 1}/${runsArg}: ${profile} ${mode} ${cookieFile ? 'member' : 'anonymous'}`)
	const result = await run()
	all.push(result)
	writeFileSync(out, JSON.stringify(all, null, 1))
	assertCoverage([result])
}
assertCoverage(all)
for (const res of all) { for (const s of res) console.log(s.error ? `${s.step} ERROR ${s.error}` : [s.step.padEnd(15), (s.link || '-').padEnd(5), s.doc ? 'DOC' : 'spa', 'commit', s.commit, 'paint', s.paint, 'img', s.images, 'lastData', s.lastData, s.target || ''].join(' ')); console.log('--') }
