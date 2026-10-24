// Cache-enabled browser regression through the real TV and router. No request routing: Playwright's routing
// disables HTTP caching and conceals the backdrop bug. API writes/telemetry are blocked with CDP instead.
// PLAYWRIGHT=/path/to/playwright/index.mjs ORIGIN=http://127.0.0.1:3374 node scripts/check-title-navigation.mjs
import assert from "node:assert/strict"

const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright")
const origin = process.env.ORIGIN ?? "http://127.0.0.1:3374"
const browser = await chromium.launch()
try {
	for (const mode of (process.env.CASES ?? "hover,focus,remote,touch").split(",")) {
		const phone = mode === "touch"
		const context = await browser.newContext({
			viewport: phone ? { width: 390, height: 844 } : { width: 1678, height: 998 },
			isMobile: phone,
			hasTouch: phone,
		})
		const page = await context.newPage()
		const cdp = await context.newCDPSession(page)
		await cdp.send("Network.enable")
		await cdp.send("Network.setBlockedURLs", {
			urls: ["*/api/e", "*/api/update-*", "*/api/poster-impressions", "*googletagmanager.com/*", "*faststats.dev/*"],
		})
		const document = await (await context.request.get(`${origin}/movie/603-the-matrix`)).text()
		const hero = document.match(/<img[^>]*elementtiming="hero"[^>]*>/)?.[0]
		assert.ok(hero, "server HTML must contain the complete hero")
		const src = hero.match(/ src="([^"]+)"/)?.[1]
		assert.ok(src)
		const old = new URL(src)
		old.search = ""
		// Seed the browser with the old TV/CSS non-CORS cache entries at every responsive size.
		await page.goto(`${origin}/robots.txt`)
		const seeded = await page.evaluate(async url => Promise.all(["w300", "w780", "w1280"].map(size => new Promise(resolve => {
			const image = new Image()
			image.onload = () => resolve(true)
			image.onerror = () => resolve(false)
			image.src = url.replace(/\/w\d+\//, `/${size}/`)
		}))), old.href)
		assert.ok(seeded.every(Boolean), "the real backdrop must exist before testing its cache reuse")
		const data = []
		const scripts = []
		page.on("request", r => {
			if (r.resourceType() === "script") scripts.push(r.url())
			if (r.url().includes("/movie/603-") && new URL(r.url()).searchParams.has("_data")) data.push(r.url())
		})
		await page.goto(`${origin}/?tv=title&title=movie-603`, { waitUntil: "networkidle" })
		const expand = page.locator('[data-tv-item="expand"]:visible').first()
		await expand.waitFor()
		// Wait for the TV's own title read to resolve the canonical destination.
		await page.waitForFunction(() => [...document.querySelectorAll('[data-tv-item="expand"]')]
			.some(e => e.getAttribute("data-prefetch-href") === "/movie/603-the-matrix"), null, { timeout: 5000 })
		if (mode === "hover") {
			await page.waitForTimeout(2200)
			assert.equal(scripts.filter(url => /\/assets\/(person\.|discover\.|_type\.)/.test(url)).length, 0,
				"idle time must not download unrelated catalog routes")
		}
		const before = data.length
		const prefetched = phone ? null : page.waitForResponse(r => r.url().includes("/movie/603-") && new URL(r.url()).searchParams.has("_data") && r.status() === 200)
		if (mode === "hover") await expand.hover()
		if (mode === "focus") await expand.focus()
		if (mode === "remote") {
			// The TV's focus is its state, independent of DOM focus. Tab walks that state too.
			await page.locator("body").click({ position: { x: 2, y: 2 } })
			for (let i = 0; i < 40; i++) {
				if (await expand.getAttribute("aria-current") === "true") break
				await page.keyboard.press("Tab")
			}
			assert.equal(await expand.getAttribute("aria-current"), "true", "remote focus reaches Full Details")
		}
		if (!phone) {
			await page.waitForFunction(() => window.__gwNavCache?.prefetches > 0, null, { timeout: 5000 })
			await prefetched
			await page.waitForTimeout(200)
			assert.equal(data.length - before, 1, `${mode} starts one title prefetch before activation`)
		}
		const started = Date.now()
		if (phone) await expand.tap()
		else if (mode === "remote") await page.keyboard.press("Enter")
		else await expand.click()
		await page.waitForURL(/\/movie\/603-the-matrix/)
		await page.locator('#overview img[elementtiming="hero"]').waitFor()
		await page.waitForFunction(() => {
			const image = document.querySelector('#overview img[elementtiming="hero"]')
			return image?.complete && image.naturalWidth > 0
		})
		assert.equal(data.length - before, 1, "activation reuses the prefetch instead of requesting the page twice")
		const overviewMs = Date.now() - started
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-tv-transition"))
		console.log(JSON.stringify({ mode, overviewMs, finishedMs: Date.now() - started, requests: data.length - before }))
		await page.goBack()
		await page.locator('[data-tv-item="expand"]:visible').first().waitFor()
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-tv-transition"))
		await context.close()
	}
} finally {
	await browser.close()
}
