// Measurement runner: headless Chromium, mobile emulation, optional CPU throttle, one trace per run.
// usage: node run.mjs <out.jsonl> <runs> <label> <variantFilter|all> <throttle>
import { createRequire } from "node:module"
import { appendFileSync, writeFileSync } from "node:fs"
const require = createRequire("/usr/lib/node_modules/@playwright/cli/node_modules/")
const { chromium } = require("playwright-core")

const [out, runsArg, label = "prod", filterArg = "all", throttleArg = "1"] = process.argv.slice(2)
const filter = filterArg === "all" ? "" : filterArg
const RUNS = Number(runsArg || 5)
const THROTTLE = Number(throttleArg)
const ORIGIN = "http://localhost:3111"
const PAGES = { movie: "/movie/603-the-matrix", show: "/show/1396-breaking-bad" }
const VARIANTS = {
	baseline: "",
	fingerprint: "fingerprint",
	episodes: "episodes",
	about_crew: "about_crew",
	actors: "actors",
	related: "related",
	sequels: "sequels",
	media: "media",
	faq: "faq",
	footer: "footer",
	hero_actions: "hero_actions",
	navs: "navs",
	header: "header",
	hero: "hero",
	sitenav: "sitenav",
	content: "content",
	floor: "fingerprint,content",
	floor_nofooter: "fingerprint,content,footer",
	shell: "page",
	shell_min: "page,footer,sitenav",
}
const UA =
	"Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36"
const BOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const urlOf = (page, variant) => ORIGIN + PAGES[page] + (VARIANTS[variant] ? `?ablate=${VARIANTS[variant]}` : "")

// A crawler gets a longer budget for the related panel, so the page is complete and the in-process page cache keeps it.
async function warm(url) {
	for (let i = 0; i < 12; i++) {
		const res = await fetch(url, { headers: { "accept-language": "en-US,en;q=0.9", "user-agent": BOT } })
		await res.arrayBuffer()
		if (res.headers.get("gw-page-cache") === "hit") return true
		await sleep(300)
	}
	return false
}

const SCRIPT = new Set(["EvaluateScript", "v8.compile", "v8.compileModule", "v8.evaluateModule", "FunctionCall", "EventDispatch", "TimerFire", "FireAnimationFrame", "RunMicrotasks", "MinorGC", "MajorGC", "V8.GCScavenger", "V8.GCCompactor", "V8.GCFinalizeMC", "V8.GCIncrementalMarking", "BlinkGC.AtomicPhase", "XHRReadyStateChange", "XHRLoad", "FireIdleCallback", "v8.produceCache", "v8.produceModuleCache", "v8.callFunction", "v8.run", "V8.BytecodeBudgetInterrupt", "V8.HandleInterrupts"])
const STYLE = new Set(["UpdateLayoutTree", "RecalculateStyles", "ParseAuthorStyleSheet", "Document::recalcStyle", "CSSParserImpl::parseStyleSheet.parse"])
const LAYOUT = new Set(["Layout", "LocalFrameView::performLayout"])
const PAINT = new Set(["Paint", "PrePaint", "Layerize", "Commit", "UpdateLayerTree", "UpdateLayer", "CompositeLayers", "PaintImage", "Decode Image"])
const PARSE = new Set(["ParseHTML"])
const catOf = (name) => (SCRIPT.has(name) ? "script" : STYLE.has(name) ? "style" : LAYOUT.has(name) ? "layout" : PAINT.has(name) ? "paint" : PARSE.has(name) ? "parse" : null)

function analyze(events, scale) {
	const mark = (name) => events.find((e) => e.cat?.includes("blink.user_timing") && e.name === name)
	const call = mark("gw:hydrate-call")
	if (!call) return { error: "no hydrate mark" }
	const passive = mark("gw:hydrate-passive-effects")
	const layoutMark = mark("gw:hydrate-layout-effects")
	const { pid, tid } = call
	const navStart = events.find((e) => e.name === "navigationStart" && e.pid === pid && e.args?.data?.documentLoaderURL?.startsWith(ORIGIN))?.ts
	const main = events.filter((e) => e.pid === pid && e.tid === tid && e.ph === "X" && e.dur != null && e.ts >= navStart).sort((a, b) => a.ts - b.ts || b.dur - a.dur)
	const fcp = events.find((e) => e.name === "firstContentfulPaint" && e.pid === pid && e.ts >= navStart)?.ts
	const ms = (ts) => (ts == null ? null : +((ts - navStart) / 1000).toFixed(1))
	const tasks = main.filter((e) => e.name === "RunTask")
	// Phases by task: load = up to and including the task that calls hydrateRoot; hydrate = the tasks after it up to and
	// including the task in which the root's passive effects ran; after = the rest of the trace.
	const callTask = tasks.find((t) => t.ts <= call.ts && t.ts + t.dur >= call.ts)
	const passiveTask = tasks.find((t) => t.ts <= passive.ts && t.ts + t.dur >= passive.ts)
	const loadEnd = callTask ? callTask.ts + callTask.dur : call.ts
	const hydrateEnd = passiveTask ? passiveTask.ts + passiveTask.dur : passive.ts
	const phaseOf = (ts) => (ts < loadEnd ? "load" : ts < hydrateEnd ? "hydrate" : "after")
	const zero = () => ({ script: 0, style: 0, layout: 0, paint: 0, parse: 0, other: 0 })
	const self = { load: zero(), hydrate: zero(), after: zero() }
	const stack = []
	const close = (e) => {
		if (!e._inTask) return
		let cat = null
		for (let i = e._chain.length - 1; i >= 0 && !cat; i--) cat = e._chain[i]
		self[e._phase][cat ?? "other"] += e.dur - e._children
	}
	for (const e of main) {
		while (stack.length && stack[stack.length - 1].ts + stack[stack.length - 1].dur <= e.ts) close(stack.pop())
		const parent = stack[stack.length - 1]
		e._children = 0
		e._chain = [...(parent?._chain ?? []), catOf(e.name)]
		e._inTask = e.name === "RunTask" || !!parent?._inTask
		e._phase = parent?._phase ?? phaseOf(e.ts)
		if (parent) parent._children += e.dur
		stack.push(e)
	}
	while (stack.length) close(stack.pop())
	const r1 = (v) => +(v / 1000).toFixed(1)
	const phases = {}
	for (const p of ["load", "hydrate", "after"]) {
		const list = tasks.filter((t) => phaseOf(t.ts) === p)
		const wall = list.reduce((s, t) => s + t.dur, 0)
		const cpu = list.reduce((s, t) => s + (t.tdur ?? 0), 0)
		// Blocking time as Lighthouse counts it (the part of a task over 50 ms), with every task `scale` times as long.
		const block = (key) => list.reduce((s, t) => s + Math.max(0, (t[key] ?? 0) * scale - 50_000), 0)
		const blockFcp = (key) => list.reduce((s, t) => {
			if (fcp == null) return s
			const d = (t[key] ?? 0) * scale
			const start = (t.ts - navStart) * scale
			const end = start + d
			const f = (fcp - navStart) * scale
			if (d <= 50_000 || end <= f) return s
			return s + Math.max(0, end - Math.max(start + 50_000, f))
		}, 0)
		phases[p] = {
			wall: r1(wall), cpu: r1(cpu), tbt: r1(block("dur")), tbtCpu: r1(block("tdur")), tbtFcp: r1(blockFcp("dur")), tbtFcpCpu: r1(blockFcp("tdur")),
			longest: r1(Math.max(0, ...list.map((t) => t.dur))),
			longTasks: list.filter((t) => t.dur * scale > 50_000).map((t) => [ms(t.ts), r1(t.dur), r1(t.tdur ?? 0)]),
			self: Object.fromEntries(Object.entries(self[p]).map(([k, v]) => [k, r1(v)])),
		}
	}
	return { scale, fcp: ms(fcp), marks: { call: ms(call.ts), layout: ms(layoutMark?.ts), passive: ms(passive.ts) }, phases }
}

async function measure(browser, page, variant, keepTrace) {
	const url = urlOf(page, variant)
	const cached = await warm(url)
	const context = await browser.newContext({
		viewport: { width: 412, height: 823 },
		deviceScaleFactor: 1.75,
		isMobile: true,
		hasTouch: true,
		userAgent: UA,
		locale: "en-US",
	})
	const tab = await context.newPage()
	const requests = []
	tab.on("request", (r) => requests.push({ url: r.url(), method: r.method(), type: r.resourceType() }))
	const failed = []
	tab.on("requestfailed", (r) => failed.push(r.url()))
	const errors = []
	tab.on("pageerror", (e) => errors.push(String(e).slice(0, 300)))
	tab.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)) })
	const cdp = await context.newCDPSession(tab)
	await cdp.send("Network.enable")
	// The Sentry tunnel of the local server would forward to production Sentry.
	await cdp.send("Network.setBlockedURLs", { urls: ["*/api/e", "*/api/e?*"] })
	if (THROTTLE > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE })
	const chunks = []
	cdp.on("Tracing.dataCollected", (d) => chunks.push(...d.value))
	const done = new Promise((r) => cdp.once("Tracing.tracingComplete", r))
	await cdp.send("Tracing.start", {
		transferMode: "ReportEvents",
		traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "v8.execute", "blink.user_timing", "loading"], excludedCategories: ["*"] },
	})
	const response = await tab.goto(url, { waitUntil: "load" })
	const pageCache = response.headers()["gw-page-cache"]
	await tab.waitForFunction(() => performance.getEntriesByName("gw:hydrate-passive-effects").length > 0, null, { timeout: 60000 })
	await sleep(THROTTLE > 1 ? 3500 : 2000)
	const info = await tab.evaluate(() => ({
		elements: document.getElementsByTagName("*").length,
		buttons: document.querySelectorAll("button").length,
		links: document.querySelectorAll("a").length,
		images: document.querySelectorAll("img").length,
		swipers: document.querySelectorAll(".swiper").length,
		html: document.documentElement.outerHTML.length,
		profile: window.__gwProfile ?? null,
		scrollY: window.scrollY,
	}))
	await cdp.send("Tracing.end")
	await done
	await context.close()
	if (keepTrace) writeFileSync(keepTrace, JSON.stringify({ traceEvents: chunks }))
	const result = analyze(chunks, THROTTLE > 1 ? 1 : 4)
	const local = requests.filter((r) => r.url.startsWith(ORIGIN))
	return {
		label, page, variant, throttle: THROTTLE, pageCache, cached, ...result, info,
		requests: {
			total: requests.length,
			localScripts: local.filter((r) => r.type === "script").length,
			localFetch: local.filter((r) => r.type === "fetch" || r.type === "xhr").map((r) => `${r.method} ${r.url.slice(ORIGIN.length)}`),
			otherHosts: [...new Set(requests.filter((r) => !r.url.startsWith(ORIGIN) && !r.url.startsWith("data:")).map((r) => new URL(r.url).host))],
			failedHosts: [...new Set(failed.map((u) => { try { return new URL(u).host } catch { return u.slice(0, 30) } }))],
		},
		errors,
	}
}

const browser = await chromium.launch({
	executablePath: "/usr/bin/chromium",
	headless: true,
	args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE image.tmdb.org, EXCLUDE i.ytimg.com, EXCLUDE img.youtube.com"],
})
const jobs = []
for (const page of Object.keys(PAGES))
	for (const variant of Object.keys(VARIANTS)) {
		if (variant === "episodes" && page === "movie") continue
		if (filter && !filter.split(",").includes(variant) && !filter.split(",").includes(`${page}:${variant}`)) continue
		jobs.push([page, variant])
	}
for (let run = 0; run < RUNS; run++) {
	// A different order each round, so drift of the machine does not line up with a variant.
	const order = run % 2 ? [...jobs].reverse() : jobs
	for (const [page, variant] of order) {
		try {
			const keep = process.env.KEEP_TRACE && run === 0 ? `${process.env.KEEP_TRACE}-${page}-${variant}.json` : null
			const result = await measure(browser, page, variant, keep)
			appendFileSync(out, `${JSON.stringify({ run, ...result })}\n`)
			const p = result.phases ?? {}
			console.log(run, page, variant, "load", p.load?.wall, p.load?.cpu, "hyd", p.hydrate?.wall, p.hydrate?.cpu, "after", p.after?.wall, p.after?.cpu, "tbtFcp", (p.load?.tbtFcp + p.hydrate?.tbtFcp + p.after?.tbtFcp).toFixed(0), "cpu", (p.load?.tbtFcpCpu + p.hydrate?.tbtFcpCpu + p.after?.tbtFcpCpu).toFixed(0), "els", result.info.elements, result.pageCache, result.requests.localFetch.join(" "), result.errors.length ? `ERR ${result.errors[0].slice(0, 60)}` : "")
		} catch (error) {
			console.log(run, page, variant, "FAILED", String(error).slice(0, 200))
		}
	}
}
await browser.close()
