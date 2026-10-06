// CPU sampling profile of one page load, attributed through the build's source maps.
// usage: node prof.mjs <page> <variant-query> <runs> <out.json>
import { createRequire } from "node:module"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
const require = createRequire("/usr/lib/node_modules/@playwright/cli/node_modules/")
const { chromium } = require("playwright-core")
const appRequire = createRequire("/home/alper/projects/goodwatch-monorepo/goodwatch-webapp/node_modules/")
const { TraceMap, originalPositionFor } = appRequire("@jridgewell/trace-mapping")

const [pageArg = "movie", ablate = "", runsArg = "5", out] = process.argv.slice(2)
const ORIGIN = "http://localhost:3111"
const BUILD = "/home/alper/projects/goodwatch-monorepo/.claude/worktrees/agent-a481d941d1d836668/goodwatch-webapp/build/client"
const PAGES = { movie: "/movie/603-the-matrix", show: "/show/1396-breaking-bad" }
const url = ORIGIN + PAGES[pageArg] + (ablate ? `?ablate=${ablate}` : "")
const UA = "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36"
const BOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const maps = new Map()
function original(frame) {
	if (!frame.url?.startsWith(ORIGIN)) return { source: frame.url ? "(other script)" : `(${frame.functionName || "native"})`, name: frame.functionName }
	const file = BUILD + new URL(frame.url).pathname
	if (!maps.has(file)) maps.set(file, existsSync(`${file}.map`) ? new TraceMap(readFileSync(`${file}.map`, "utf8")) : null)
	const map = maps.get(file)
	if (!map) return { source: `(inline or unmapped ${new URL(frame.url).pathname.slice(0, 40)})`, name: frame.functionName }
	const pos = originalPositionFor(map, { line: frame.lineNumber + 1, column: frame.columnNumber })
	return { source: (pos.source ?? "(unmapped)").replace(/^(\.\.\/)+/, ""), name: pos.name ?? frame.functionName, line: pos.line }
}
const pkgOf = (source) => {
	const m = source.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)
	if (m) return m[1]
	if (source.startsWith("app/")) return source
	return source
}
const GROUP = (pkg) =>
	/^(react-dom|scheduler|react)$/.test(pkg) ? "react-dom" :
	/^swiper/.test(pkg) ? "swiper" :
	/^@tanstack/.test(pkg) ? "tanstack" :
	/^(@remix-run|react-router)/.test(pkg) ? "remix-router" :
	/^framer-motion/.test(pkg) ? "framer-motion" :
	/^(@headlessui|@react-aria|@floating-ui)/.test(pkg) ? "headlessui" :
	pkg.startsWith("app/") ? pkg : pkg.startsWith("(") ? pkg : `pkg:${pkg}`

async function once(browser) {
	for (let i = 0; i < 12; i++) {
		const res = await fetch(url, { headers: { "accept-language": "en-US,en;q=0.9", "user-agent": BOT } })
		await res.arrayBuffer()
		if (res.headers.get("gw-page-cache") === "hit") break
		await sleep(300)
	}
	const context = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true, userAgent: UA, locale: "en-US" })
	const tab = await context.newPage()
	const cdp = await context.newCDPSession(tab)
	await cdp.send("Network.enable")
	await cdp.send("Network.setBlockedURLs", { urls: ["*/api/e", "*/api/e?*"] })
	const chunks = []
	cdp.on("Tracing.dataCollected", (d) => chunks.push(...d.value))
	const done = new Promise((r) => cdp.once("Tracing.tracingComplete", r))
	await cdp.send("Tracing.start", { transferMode: "ReportEvents", traceConfig: { includedCategories: ["blink.user_timing"], excludedCategories: ["*"] } })
	await cdp.send("Profiler.enable")
	await cdp.send("Profiler.setSamplingInterval", { interval: 200 })
	await cdp.send("Profiler.start")
	await tab.goto(url, { waitUntil: "load" })
	await tab.waitForFunction(() => performance.getEntriesByName("gw:hydrate-passive-effects").length > 0, null, { timeout: 60000 })
	await sleep(2000)
	const { profile } = await cdp.send("Profiler.stop")
	await cdp.send("Tracing.end")
	await done
	await context.close()
	const mark = (name) => chunks.find((e) => e.name === name)?.ts
	const call = mark("gw:hydrate-call"), passive = mark("gw:hydrate-passive-effects")
	const byId = new Map(profile.nodes.map((n) => [n.id, n]))
	const parent = new Map()
	for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
	const info = new Map()
	const infoOf = (id) => {
		if (!info.has(id)) {
			const o = original(byId.get(id).callFrame)
			info.set(id, { ...o, group: GROUP(pkgOf(o.source)) })
		}
		return info.get(id)
	}
	const windows = { load: {}, hydrate: {}, after: {} }
	const selfFn = { load: {}, hydrate: {}, after: {} }
	const owner = { load: {}, hydrate: {}, after: {} }
	let ts = profile.startTime
	for (let i = 0; i < profile.samples.length; i++) {
		ts += profile.timeDeltas[i]
		const dt = (profile.timeDeltas[i + 1] ?? 0) / 1000
		const w = ts < call ? "load" : ts < passive ? "hydrate" : "after"
		const id = profile.samples[i]
		const leaf = infoOf(id)
		if (leaf.source === "(idle)" || leaf.source === "(root)") continue
		windows[w][leaf.group] = (windows[w][leaf.group] ?? 0) + dt
		const key = `${leaf.name || "?"} @ ${leaf.source.split("node_modules/").pop()}:${leaf.line ?? ""}`
		selfFn[w][key] = (selfFn[w][key] ?? 0) + dt
		// The nearest frame that is not React itself: which library or app file asked for this work.
		let cur = id, who = "react-dom (no app frame above)"
		while (cur != null) {
			const g = infoOf(cur).group
			if (g !== "react-dom" && !g.startsWith("(")) { who = g; break }
			cur = parent.get(cur)
		}
		owner[w][who] = (owner[w][who] ?? 0) + dt
	}
	return { windows, selfFn, owner }
}

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE image.tmdb.org, EXCLUDE i.ytimg.com, EXCLUDE img.youtube.com"] })
const runs = []
for (let i = 0; i < Number(runsArg); i++) runs.push(await once(browser))
await browser.close()
const total = (r) => Object.values(r.windows.hydrate).reduce((a, b) => a + b, 0) + Object.values(r.windows.after).reduce((a, b) => a + b, 0)
// The run with the median total stands for all (a slow spell of the machine inflates a whole run).
const sorted = [...runs].sort((a, b) => total(a) - total(b))
const pick = sorted[Math.floor((sorted.length - 1) / 2)]
console.log("totals hydrate+after per run:", runs.map((r) => total(r).toFixed(0)).join(" "), "picked", total(pick).toFixed(0))
const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${v.toFixed(1).padStart(8)}  ${k}`).join("\n")
for (const w of ["load", "hydrate", "after"]) {
	console.log(`\n### ${w}: self time by group (ms), total ${Object.values(pick.windows[w]).reduce((a, b) => a + b, 0).toFixed(0)}`)
	console.log(top(pick.windows[w], 14))
	console.log(`--- ${w}: by nearest non-React frame`)
	console.log(top(pick.owner[w], 22))
	console.log(`--- ${w}: top self functions`)
	console.log(top(pick.selfFn[w], 22))
}
if (out) writeFileSync(out, JSON.stringify(pick))
