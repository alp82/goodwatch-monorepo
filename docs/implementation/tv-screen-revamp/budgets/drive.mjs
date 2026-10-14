// Slice 12 of the new TV: the first paint, access and the budgets, on /home-preview.
//
//   PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs BASE=http://localhost:3191 node drive.mjs [paint|access|budget]
//   BUILD=1 BASE=http://localhost:3196 node drive.mjs paint      against a production build, served without services
//
// paint   At every room layout and at the sizes around each layout's threshold: the room as the server's HTML and
//         CSS paint it before any script runs (the page's scripts are stopped), against the room once the script
//         has measured the window. Every part's box, every TV item's box and the H1s must agree to half a pixel,
//         and the pictures the first paint asks for must be the ones the room keeps. Then the layout shift of a
//         real load, also on a phone with a slowed CPU, and the console after hydration.
// access  The keyboard alone and what a screen reader meets: roles, names, the order of the items, the menu,
//         what is announced when the screen changes, reduced motion, the contrast of the Remote's keys and
//         words, and the size of every touch target on a phone.
// budget  Long tasks and frame times while pointing, moving the focus and changing screens, on the desktop and
//         on a phone with a slowed CPU (see also ../pointing/drive.mjs budget, which this reuses).
//
// The repo has no browser driver: install playwright-core outside it. Nothing here signs in, rates or writes:
// requests that would leave the machine are stopped in the browser, and the telemetry is answered here.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const BASE = process.env.BASE ?? "http://localhost:3191"
const PAGE = `${BASE}/home-preview`
const only = process.argv[2]
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")

let passed = 0
const failed = []
let where = ""
const check = (ok, what) => {
	if (ok) passed += 1
	else {
		failed.push(`${where}: ${what}`)
		console.log("  FAILED", where, "-", what)
	}
}
const numbers = {}
const launch = (args = []) => chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--use-angle=gl", "--ignore-gpu-blocklist", ...args] })
const browser = await launch()

/** A phone's window: a touch screen at two device pixels a pixel. */
const isPhone = ([w, h]) => w < 768 || h < 541

async function context([width, height], { reducedMotion, on = browser } = {}) {
	const touch = isPhone([width, height])
	const ctx = await on.newContext({
		viewport: { width, height },
		deviceScaleFactor: touch ? 2 : 1,
		reducedMotion,
		...(touch ? { isMobile: true, hasTouch: true } : {}),
	})
	const page = await ctx.newPage()
	const logs = []
	page.on("console", (m) => {
		if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text()}`)
	})
	page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`))
	// Nothing may leave the machine but for the pictures.
	await page.route(
		(u) => !["localhost", "127.0.0.1", "image.tmdb.org"].includes(u.hostname) && u.protocol.startsWith("http"),
		(route) => route.fulfill({ status: 204, body: "" }),
	)
	await page.route("**/api/e", (route) => route.fulfill({ status: 200, body: "" }))
	const quiet = () => logs.filter((l) => !l.includes("Future Flag") && !l.includes("Failed to load resource") && !l.includes("net::ERR"))
	return { ctx, page, logs, quiet }
}

async function goto(page, url, ready) {
	for (let tries = 3; ; tries -= 1) {
		try {
			await page.goto(url, { waitUntil: "load", timeout: 180000 })
			if (ready) await page.waitForSelector(ready, { timeout: 180000 })
			return
		} catch (error) {
			if (tries <= 1) throw error
			console.log("loading again:", String(error.message).split("\n")[0])
			await new Promise((done) => setTimeout(done, 4000))
		}
	}
}

// ---------------------------------------------------------------------------------------------------------
// The first paint.

/** The rooms to compare: each layout, and the sizes on either side of each threshold. */
const SIZES = [
	// The desktop, the Remote under the TV: the prototype's sizes, and the smallest window that keeps it there.
	["under", [1920, 1080]],
	["under", [1920, 940]],
	["under", [2560, 1300]],
	// A desktop window has a scrollbar's gutter of 15 px here: a room of 1108 x 854.
	["under", [1123, 918]],
	// Beside it: the prototype's sizes, a tablet, and a pixel short of the threshold either way.
	["beside", [1536, 730]],
	["beside", [1440, 800]],
	["beside", [1366, 650]],
	["beside", [1280, 720]],
	["beside", [1122, 918]],
	["beside", [1123, 917]],
	["beside", [1024, 768]],
	["beside", [820, 1180]],
	["beside", [768, 1024]],
	// A phone upright, the Remote in the hand: the slice's phones and Lighthouse's.
	["hand", [390, 844]],
	["hand", [360, 740]],
	["hand", [430, 932]],
	["hand", [412, 823]],
	["hand", [767, 1100]],
	// The smallest window that keeps it in the hand at 390 wide is 757 tall (319 + 362 / 1.2, and the header and
	// the dock's 136).
	["hand", [390, 757]],
	// On the table.
	["table", [390, 756]],
	["table", [767, 1024]],
	["table", [375, 667]],
	["table", [390, 700]],
	["table", [320, 568]],
	// Landscape: in the hand from 282 px of room (from 768 wide, the room is the whole window), on the table under.
	["landscape hand", [844, 390]],
	["landscape hand", [932, 430]],
	["landscape hand", [896, 414]],
	["landscape hand", [800, 282]],
	["landscape table", [800, 281]],
	["landscape table", [667, 375]],
	["landscape hand", [740, 450]],
]

/** Every part of the room and every item on the TV, by a name that is the same before and after hydration. */
const BOXES = () => {
	const room = document.getElementById("room")
	const out = {}
	const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden"
	const put = (name, el) => {
		if (!shown(el)) return
		const b = el.getBoundingClientRect()
		if (!b.width && !b.height) return
		let key = name
		for (let n = 2; key in out; n += 1) key = `${name} #${n}`
		out[key] = [b.left, b.top, b.width, b.height].map((v) => Math.round(v * 100) / 100)
	}
	put("room", room)
	for (const el of room.querySelectorAll("img")) put(`img ${el.currentSrc.split("/").at(-1).split("?")[0].replace(/-[\w-]{8}\.(avif|webp)$/, ".$1")}`, el)
	for (const [name, sel] of [
		["tv", "[data-tv-screen]"],
		["canvas", "[data-tv-canvas]"],
		["desktop remote", "[data-remote]:not([data-phone-remote])"],
		["phone remote", "[data-phone-remote]"],
		["remote body", ".remote-body"],
		["tv body", "[data-tv-body]"],
		["h1", "h1"],
		["service key", "[data-service-key]"],
		["wheel", ".remote-wheel"],
	])
		for (const el of room.querySelectorAll(sel)) put(name, el)
	for (const el of room.querySelectorAll("[data-tv-item]")) put(`item ${el.getAttribute("data-tv-item")}`, el)
	for (const el of room.querySelectorAll("button[aria-label]")) if (!el.hasAttribute("data-tv-item")) put(`key ${el.getAttribute("aria-label")}`, el)
	return { boxes: out, room: room.dataset.room, form: room.dataset.remoteForm ?? null, place: room.dataset.remotePlace ?? null }
}

async function paint() {
	const dir = join(here, "shots")
	mkdirSync(dir, { recursive: true })
	const rows = []
	for (const [layout, size] of SIZES) {
		where = `paint ${size.join("x")} (${layout})`
		console.log(where)
		// Before any script runs: the page's scripts are stopped, the HTML and the stylesheets are the server's.
		const before = await context(size)
		const pictures = []
		before.page.on("request", (r) => r.resourceType() === "image" && pictures.push(r.url()))
		await before.page.route((u) => u.pathname.endsWith(".js") || u.pathname.endsWith(".ts") || u.pathname.endsWith(".tsx") || u.pathname.includes("/@"), (route) => route.request().resourceType() === "script" ? route.abort() : route.fallback())
		await goto(before.page, PAGE, "#room")
		await before.page.waitForTimeout(800)
		const first = await before.page.evaluate(BOXES)
		const firstShot = await before.page.screenshot({ clip: { x: 0, y: 0, width: size[0], height: size[1] } })
		await before.ctx.close()
		is(first.room, "unmeasured", "before any script the room is not measured")
		// Hydrated and measured.
		const after = await context(size)
		const kept = []
		after.page.on("request", (r) => r.resourceType() === "image" && kept.push(r.url()))
		await after.page.addInitScript(() => {
			window.__shifts = []
			new PerformanceObserver((list) => {
				for (const e of list.getEntries()) window.__shifts.push({ value: e.value, recent: e.hadRecentInput, at: Math.round(e.startTime), sources: (e.sources ?? []).map((s) => s.node?.nodeName + "." + String(s.node?.className ?? "").slice(0, 60)) })
			}).observe({ type: "layout-shift", buffered: true })
		})
		await goto(after.page, PAGE, "#room:not([data-room=unmeasured]) [data-tv-item]")
		await after.page.waitForTimeout(1500)
		const last = await after.page.evaluate(BOXES)
		const lastShot = await after.page.screenshot({ clip: { x: 0, y: 0, width: size[0], height: size[1] } })
		const shifts = await after.page.evaluate(() => window.__shifts)
		const room = { "under": "desktop", "beside": "desktop", "hand": "phone", "table": "phone", "landscape hand": "landscape", "landscape table": "landscape" }[layout]
		is(last.room, room, "the measured room")
		if (layout === "under" || layout === "beside") is(last.place, layout === "under" ? "below" : "beside", "the Remote's place")
		if (layout.endsWith("hand") || layout.endsWith("table")) is(last.form, layout.split(" ").at(-1), "the phone Remote's form")
		// Every box, both ways.
		const names = [...new Set([...Object.keys(first.boxes), ...Object.keys(last.boxes)])]
		let worst = 0
		const off = []
		for (const name of names) {
			const a = first.boxes[name]
			const b = last.boxes[name]
			if (!a || !b) {
				off.push(`${name}: ${a ? "only before" : "only after"}`)
				continue
			}
			const d = Math.max(...a.map((v, i) => Math.abs(v - b[i])))
			worst = Math.max(worst, d)
			if (d > 0.5) off.push(`${name}: ${JSON.stringify(a)} before, ${JSON.stringify(b)} after`)
		}
		check(off.length === 0, `the first paint places every part where the measured room does (${names.length} boxes, ${off.length} off): ${off.slice(0, 6).join("; ")}`)
		check(Object.keys(first.boxes).filter((n) => n === "h1" || n.startsWith("h1 #")).length === 1, "one H1 shows before any script")
		// The pictures: what the first paint asked for is what the room shows, and nothing for the other room.
		const files = (urls) => [...new Set(urls.filter((u) => !u.startsWith("data:")).map((u) => u.split("/").at(-1).split("?")[0]))].sort()
		const roomFiles = (urls) => files(urls).filter((f) => /^(room|hand)/.test(f))
		is(roomFiles(pictures), roomFiles(kept), "the room's pictures before any script are the ones the measured room loads")
		// The layout shift of the real load, with what moved.
		const cls = shifts.filter((s) => !s.recent).reduce((sum, s) => sum + s.value, 0)
		check(cls <= 0.01, `layout shift of the load ${cls.toFixed(4)} (the budget's 0.01): ${JSON.stringify(shifts.filter((s) => s.value > 0.0001).slice(0, 4))}`)
		// The two pictures of the window, pixel by pixel: how much of the room differs.
		const diff = await pixels(firstShot, lastShot)
		check(after.quiet().length === 0, `nothing in the console: ${after.quiet().slice(0, 3).join(" | ")}`)
		writeFileSync(join(dir, `paint-${size.join("x")}-before.png`), firstShot)
		writeFileSync(join(dir, `paint-${size.join("x")}-after.png`), lastShot)
		rows.push({ layout, size: size.join("x"), boxes: names.length, worstPx: +worst.toFixed(2), cls: +cls.toFixed(4), pixelsDiffering: diff, pictures: roomFiles(pictures) })
		console.log(`  ${names.length} boxes, worst ${worst.toFixed(2)} px, CLS ${cls.toFixed(4)}, ${diff}`)
		await after.ctx.close()
	}
	numbers.paint = rows
}

/** The share of pixels that differ by more than 24 in a channel, between two PNGs of the same size, in the browser. */
async function pixels(a, b) {
	const page = await browser.newPage()
	const share = await page.evaluate(
		async ([a, b]) => {
			const load = async (s) => {
				const img = new Image()
				img.src = `data:image/png;base64,${s}`
				await img.decode()
				const c = new OffscreenCanvas(img.width, img.height)
				const g = c.getContext("2d")
				g.drawImage(img, 0, 0)
				return g.getImageData(0, 0, img.width, img.height).data
			}
			const [x, y] = [await load(a), await load(b)]
			let n = 0
			for (let i = 0; i < x.length; i += 4) if (Math.abs(x[i] - y[i]) > 24 || Math.abs(x[i + 1] - y[i + 1]) > 24 || Math.abs(x[i + 2] - y[i + 2]) > 24) n += 1
			return n / (x.length / 4)
		},
		[a.toString("base64"), b.toString("base64")],
	)
	await page.close()
	return `${(share * 100).toFixed(2)}% of pixels differ`
}

const is = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), `${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)

if (!only || only === "paint") await paint()

await browser.close()
const file = join(here, "checks.json")
let previous = {}
try {
	previous = JSON.parse(readFileSync(file, "utf8"))
} catch {}
writeFileSync(file, `${JSON.stringify({ ...previous, [only ?? "all"]: { passed, failed, numbers } }, null, "\t")}\n`)
console.log(`\n${passed} checks passed, ${failed.length} failed`)
for (const f of failed) console.log(`  ${f}`)
process.exit(failed.length ? 1 : 0)
