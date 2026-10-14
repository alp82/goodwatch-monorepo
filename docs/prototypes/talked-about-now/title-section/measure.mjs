// The cost of each source's embed, before and after the click, with Playwright on headless Chromium.
//   PLAYWRIGHT=<folder with playwright-core> BASE=http://localhost:3142 RUNS=3 node measure.mjs [source ...] > costs.json
// For every source: a fresh browser context (cold cache, no cookies) opens the lab variant with only that source,
// then clicks its facade. Before: requests to any host other than the dev server and TMDB's artwork while the page
// loads and settles. After: everything the click brings, in every frame, until the network is quiet for 3 s (25 s at
// most). Site isolation is off, so the players' frames run in the page's renderer process and their long tasks and
// script time count in the page's numbers, as Lighthouse's main-thread view would show them.
import { createRequire } from "node:module"
import { join } from "node:path"

const require = createRequire(join(process.env.PLAYWRIGHT ?? ".", "noop.js"))
const { chromium } = require("playwright-core")
const BASE = process.env.BASE ?? "http://localhost:3142"
const RUNS = Number(process.env.RUNS ?? 3)
const ITEMS = {
	control: "",
	youtube: "yt-trailer",
	short: "short-out-now",
	tiktok: "tiktok-1",
	reel: "reel-1",
	threads: "threads-1",
	facebook: "facebook-1",
	bluesky: "bsky-deadline",
	reddit: "reddit-1",
	mastodon: "masto-codorco",
}
const sources = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ITEMS)
const OWN = (host) => host.startsWith("localhost") || host === "image.tmdb.org" || BLOCK.test(host)
const BLOCK = /\/api\/e(\?|$)|posthog|google-analytics|googletagmanager|sentry/

const browser = await chromium.launch({
	executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium",
	args: ["--disable-features=IsolateOrigins,site-per-process", "--disable-site-isolation-trials", "--autoplay-policy=no-user-gesture-required"],
})
// Sites answer HeadlessChrome differently (Reddit's embed blocks it, Facebook's answers 503): a normal Chrome UA.
const UA = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version().split(".")[0]}.0.0.0 Safari/537.36`

async function once(source) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA })
	const page = await context.newPage()
	await page.route(BLOCK, (route) => route.fulfill({ status: 200, body: "" }))
	const log = []
	let lastRequest = Date.now()
	page.on("request", () => {
		lastRequest = Date.now()
	})
	page.on("requestfinished", async (request) => {
		const host = new URL(request.url()).host
		let bytes = 0
		try {
			const sizes = await request.sizes()
			bytes = sizes.responseBodySize + sizes.responseHeadersSize
		} catch {}
		// This Chromium blocks third-party cookies, so what a vendor tries to set is read from its responses.
		let setCookies = 0
		try {
			const header = await (await request.response())?.headerValue("set-cookie")
			setCookies = header ? header.split("\n").length : 0
		} catch {}
		log.push({ host, type: request.resourceType(), bytes, setCookies, at: Date.now() })
	})
	await page.goto(`${BASE}/prototype/title-section?variant=lab&only=${source === "control" ? "news" : source}&panel=0&switcher=0`, { waitUntil: "load", timeout: 180_000 })
	await page.waitForSelector("#talked-about-now[data-hydrated] [data-item]", { timeout: 180_000 })
	await page.waitForTimeout(3000)
	const before = log.filter((entry) => !OWN(entry.host))
	const thirdPartyCookies = async () => (await context.cookies()).filter((c) => !c.domain.includes("localhost")).length
	const cookiesBefore = await thirdPartyCookies()

	const cdp = await context.newCDPSession(page)
	await cdp.send("Performance.enable")
	const metric = async (name) => (await cdp.send("Performance.getMetrics")).metrics.find((m) => m.name === name)?.value ?? 0
	const script0 = await metric("ScriptDuration")
	await page.evaluate(() => {
		window.__longTasks = []
		new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) window.__longTasks.push(entry.duration)
		}).observe({ type: "longtask" })
	})
	// A trace over the click attributes main-thread work to the script's host, as Lighthouse's third-party summary
	// does: the vendor's own time, apart from this dev page's re-render.
	await cdp.send("Tracing.start", { categories: "devtools.timeline,v8.execute", transferMode: "ReturnAsStream" })
	const start = log.length
	const t0 = Date.now()
	let readyMs = null
	// "control" clicks nothing: what the idle dev page itself costs over the same time, to read the others against.
	if (source !== "control") {
		const button = page.locator(`[data-load="${ITEMS[source]}"]`)
		await button.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }))
		await button.click()
	}
	// The player is shown when its frame has loaded.
	if (source !== "control") try {
		const frameEl = await page.waitForSelector(`iframe[data-player="${ITEMS[source]}"], [data-player="${ITEMS[source]}"] iframe`, { timeout: 25_000 })
		const frame = await frameEl.contentFrame()
		await frame?.waitForLoadState("load", { timeout: 25_000 })
		readyMs = Date.now() - t0
	} catch {}
	lastRequest = Date.now()
	if (source === "control") await page.waitForTimeout(10_000)
	while (Date.now() - lastRequest < 3000 && Date.now() - t0 < 25_000) await page.waitForTimeout(250)
	const after = log.slice(start).filter((entry) => !OWN(entry.host))
	const longTasks = await page.evaluate(() => window.__longTasks)
	const vendorMs = await vendorScriptMs(cdp)
	const scriptMs = Math.round(((await metric("ScriptDuration")) - script0) * 1000)
	const cookies = (await thirdPartyCookies()) - cookiesBefore
	await context.close()
	return {
		beforeRequests: before.length,
		requests: after.length,
		hostList: [...new Set(after.map((entry) => entry.host))].sort(),
		kb: Math.round(after.reduce((sum, entry) => sum + entry.bytes, 0) / 1024),
		jsKb: Math.round(after.filter((entry) => entry.type === "script").reduce((sum, entry) => sum + entry.bytes, 0) / 1024),
		cookies,
		setCookies: after.reduce((sum, entry) => sum + entry.setCookies, 0),
		tbtMs: Math.round(longTasks.reduce((sum, d) => sum + Math.max(0, d - 50), 0)),
		scriptMs,
		vendorMs,
		readyMs,
	}
}

/** Milliseconds of script work (evaluation, compilation, callbacks) whose script is not on the dev server. */
async function vendorScriptMs(cdp) {
	const done = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve))
	await cdp.send("Tracing.end")
	const { stream } = await done
	let text = ""
	for (;;) {
		const chunk = await cdp.send("IO.read", { handle: stream })
		text += chunk.base64Encoded ? Buffer.from(chunk.data, "base64").toString() : chunk.data
		if (chunk.eof) break
	}
	await cdp.send("IO.close", { handle: stream })
	const events = JSON.parse(text).traceEvents ?? JSON.parse(text)
	const NAMES = new Set(["EvaluateScript", "FunctionCall", "v8.compile", "v8.compileModule"])
	// Per thread, an event inside one already counted (a compile inside an evaluation) is not counted again.
	const counted = events
		.filter((event) => event.ph === "X" && NAMES.has(event.name))
		.map((event) => {
			const data = event.args?.data ?? {}
			const url = data.url ?? data.scriptName ?? event.args?.fileName ?? ""
			return { ...event, url }
		})
		.filter((event) => event.url.startsWith("http") && !OWN(new URL(event.url).host))
		.sort((a, b) => a.ts - b.ts)
	const openUntil = new Map()
	let us = 0
	for (const event of counted) {
		const thread = `${event.pid}:${event.tid}`
		if (event.ts < (openUntil.get(thread) ?? 0)) continue
		openUntil.set(thread, event.ts + (event.dur ?? 0))
		us += event.dur ?? 0
	}
	return Math.round(us / 1000)
}

const median = (values) => {
	const v = values.filter((x) => x !== null).sort((a, b) => a - b)
	return v.length ? v[Math.floor((v.length - 1) / 2)] : null
}

const out = { measuredAt: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC", runsPerSource: RUNS, sources: {}, raw: {} }
for (const source of sources) {
	const runs = []
	for (let i = 0; i < RUNS; i++) {
		try {
			runs.push(await once(source))
		} catch (error) {
			console.error(source, "run failed:", error.message.split("\n")[0])
		}
		console.error(source, i + 1, JSON.stringify(runs.at(-1)))
	}
	if (!runs.length) continue
	out.raw[source] = runs
	const pick = (key) => median(runs.map((run) => run[key]))
	out.sources[source] = {
		before: { thirdPartyRequests: Math.max(...runs.map((run) => run.beforeRequests)) },
		after: {
			requests: pick("requests"),
			hosts: median(runs.map((run) => run.hostList.length)),
			hostList: [...new Set(runs.flatMap((run) => run.hostList))].sort(),
			kb: pick("kb"),
			jsKb: pick("jsKb"),
			cookies: pick("cookies"),
			setCookies: pick("setCookies"),
			tbtMs: pick("tbtMs"),
			scriptMs: pick("scriptMs"),
			vendorMs: pick("vendorMs"),
			readyMs: pick("readyMs"),
		},
		runs: runs.length,
	}
}
await browser.close()
console.log(JSON.stringify(out, null, 1))
