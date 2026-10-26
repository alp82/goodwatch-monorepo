// Browser check of a phone's route-code warm-up (app/navigation/instant-navigation.ts, #753), against a running build.
// usage: node warmup-check.mjs <origin>   (PLAYWRIGHT_FROM and CHROME_PATH as for nav.mjs)
// Pixel 7 with nav.mjs's slow 4G and 4x CPU; the DevTools protocol records each script request's priority. Anonymous,
// GET only: it presses links and scrolls, nothing else. Exits 1 when a check fails.
// 1. A best list warms the title page's code at low priority, at most three files at a time, and a tap during the
//    warm-up takes every file not yet requested at high priority.
// 2. The start page warms no code, also after scrolling to its title links (its LCP and TBT budget, #236).
import { createRequire } from "node:module"

const { chromium, devices } = createRequire(
	process.env.PLAYWRIGHT_FROM || import.meta.url,
)("playwright")
const origin = process.argv[2]
if (!origin) throw new Error("usage: node warmup-check.mjs <origin>")
const failures = []
const check = (ok, message) => {
	console.log(`${ok ? "ok  " : "FAIL"} ${message}`)
	if (!ok) failures.push(message)
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
async function phone() {
	const ctx = await browser.newContext({ ...devices["Pixel 7"] })
	const page = await ctx.newPage()
	const cdp = await ctx.newCDPSession(page)
	await cdp.send("Network.enable")
	await cdp.send("Network.emulateNetworkConditions", {
		offline: false,
		latency: 150,
		downloadThroughput: 1.6e6 / 8,
		uploadThroughput: 750e3 / 8,
	})
	await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })
	const scripts = []
	cdp.on("Network.requestWillBeSent", (e) => {
		if (/\/assets\/[^/]+\.js$/.test(e.request.url))
			scripts.push({
				id: e.requestId,
				file: e.request.url.split("/").pop(),
				priority: e.request.initialPriority,
				start: e.timestamp,
				end: null,
			})
	})
	cdp.on("Network.loadingFinished", (e) => {
		const s = scripts.find((x) => x.id === e.requestId)
		if (s) s.end = e.timestamp
	})
	await page.route(/posthog|google|sentry|ingest|\/api\/e\b/, (r) => r.abort())
	await page.route("**/*", (r) =>
		r.request().method() === "GET" ? r.fallback() : r.abort(),
	)
	return { ctx, page, scripts }
}

{
	const { ctx, page, scripts } = await phone()
	await page.goto(`${origin}/movies/best`, { waitUntil: "load", timeout: 120000 })
	for (let i = 0; i < 600 && !scripts.some((s) => s.priority === "Low"); i++)
		await page.waitForTimeout(25)
	const before = scripts.length
	const titleCode = new Set(
		await page.evaluate(() => {
			const route = window.__remixManifest.routes["routes/movie.$movieKey"]
			return [route.module, ...(route.imports ?? [])].map((h) => h.split("/").pop())
		}),
	)
	const warm = scripts.filter((s) => s.priority === "Low")
	check(
		warm.length > 0 && warm.every((s) => titleCode.has(s.file)),
		`a best list warms the title code at low priority (${warm.length} file(s) started before the tap)`,
	)
	await page.locator('main a[href^="/movie/"]').first().tap({ force: true })
	await page.waitForURL(/\/movie\//, { timeout: 60000 })
	await page.waitForTimeout(3000)
	const lows = scripts.filter((s) => s.priority === "Low")
	const most = Math.max(
		...lows.map((x) => lows.filter((y) => y.start <= x.start && (!y.end || y.end > x.start)).length),
	)
	check(most <= 3, `at most three warm-up files load at once (saw ${most})`)
	const afterTap = scripts.slice(before).filter((s) => titleCode.has(s.file))
	check(
		afterTap.length > 0 && afterTap.every((s) => s.priority !== "Low"),
		`the tap takes the title files not yet requested at high priority (${afterTap.length}: ${[...new Set(afterTap.map((s) => s.priority))].join(", ")})`,
	)
	await ctx.close()
}

{
	const { ctx, page, scripts } = await phone()
	await page.goto(`${origin}/`, { waitUntil: "load", timeout: 120000 })
	await page.waitForTimeout(4000)
	const before = scripts.length
	// Down from the room first, as a reader does: the section below takes the scroll after that.
	for (let i = 0; i < 12; i++) {
		await page.mouse.wheel(0, 700)
		await page.waitForTimeout(250)
	}
	await page.evaluate(() => {
		const link = [
			...document.querySelectorAll('#browse a[href^="/movie/"], #browse a[href^="/show/"]'),
		].find((a) => a.getBoundingClientRect().width > 0)
		link?.scrollIntoView({ block: "center" })
	})
	await page.waitForTimeout(8000)
	const seen = await page.evaluate(() => ({
		links: [...document.querySelectorAll('a[href^="/movie/"], a[href^="/show/"]')].filter((a) => {
			const r = a.getBoundingClientRect()
			return r.top >= 0 && r.bottom <= innerHeight && r.width > 0
		}).length,
		prefetches: window.__gwNavCache?.prefetches ?? 0,
	}))
	const low = scripts.slice(before).filter((s) => s.priority === "Low")
	check(seen.links > 0 && seen.prefetches > 0, `the start page's title links are on screen and prefetched (${seen.links} links, ${seen.prefetches} prefetches)`)
	check(low.length === 0, `the start page warms no code after scrolling to them (${low.length} low-priority script(s))`)
	await ctx.close()
}

await browser.close()
if (failures.length) process.exit(1)
