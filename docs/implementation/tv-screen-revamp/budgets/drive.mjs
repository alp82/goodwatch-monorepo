// Slice 12 of the new TV: the first paint, access and the budgets, on /home-preview.
//
//   PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs BASE=http://localhost:3191 node drive.mjs [paint|access|budget]
//   BUILD=1 BASE=http://localhost:3196 node drive.mjs paint      against a production build, served without services
//   LABEL=<text>                                                 files the run's numbers under "<mode>, <text>" in checks.json
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
	// By the file it shows, or for a picture whose file is chosen by a source, by its fallback: a lazy picture that
	// has not loaded yet has no current file.
	for (const el of room.querySelectorAll("img")) put(`img ${(el.currentSrc || el.getAttribute("src")).split("/").at(-1).split("?")[0].replace(/-[\w-]{8}\.(avif|webp)$/, ".$1").replace(/\.(avif|webp)$/, "")}`, el)
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
		// The TV's pictures come from another host about a second in: the first paint draws them once they are here.
		await before.page.waitForFunction(() => [...document.querySelectorAll("#room img")].every((i) => !i.getClientRects().length || i.complete), null, { timeout: 8000 }).catch(() => {})
		await before.page.waitForTimeout(400)
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

/** The contrast of each word with the lightest tenth of the pixels in its box, in a screenshot without the words. */
async function judge(png, words, [w, h]) {
	const page = await browser.newPage()
	const out = await page.evaluate(
		async ([png, words, w]) => {
			const img = new Image()
			img.src = `data:image/png;base64,${png}`
			await img.decode()
			const c = new OffscreenCanvas(img.width, img.height)
			const g = c.getContext("2d")
			g.drawImage(img, 0, 0)
			const k = img.width / w
			const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
			const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
			return words.map((word) => {
				const [x, y, bw, bh] = word.box.map((v) => Math.max(0, Math.round(v * k)))
				const data = g.getImageData(x, y, Math.max(1, Math.min(bw, img.width - x)), Math.max(1, Math.min(bh, img.height - y))).data
				const px = []
				for (let i = 0; i < data.length; i += 4) px.push([data[i], data[i + 1], data[i + 2]])
				px.sort((a, b) => lum(b) - lum(a))
				const bg = px[Math.floor(px.length * 0.1)] ?? [0, 0, 0]
				// The word's colour as the browser draws it (oklab and color-mix included): over white and over black.
				const dot = new OffscreenCanvas(2, 1).getContext("2d")
				dot.fillStyle = "#fff"
				dot.fillRect(0, 0, 1, 1)
				dot.fillStyle = "#000"
				dot.fillRect(1, 0, 1, 1)
				dot.fillStyle = word.color
				dot.fillRect(0, 0, 2, 1)
				const [onWhite, onBlack] = [[...dot.getImageData(0, 0, 1, 1).data], [...dot.getImageData(1, 0, 1, 1).data]]
				const a = 1 - (onWhite[0] - onBlack[0]) / 255
				const text = [0, 1, 2].map((i) => (a ? onBlack[i] / a : 0) * a + bg[i] * (1 - a))
				const [p, q] = [lum(text), lum(bg)].sort((m, n) => n - m)
				const large = word.px >= 24 || (word.bold && word.px >= 18.66)
				return { text: word.text, px: word.px, large, focused: word.focused, ratio: Math.round(((p + 0.05) / (q + 0.05)) * 100) / 100 }
			})
		},
		[png.toString("base64"), words, w],
	)
	await page.close()
	return out
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


// ---------------------------------------------------------------------------------------------------------
// Access: the keyboard alone, and what a screen reader meets.

const AXE = process.env.AXE ?? join(dirname(fileURLToPath(new URL(process.env.PLAYWRIGHT ?? "file:///nowhere", "file:///"))), "../axe-core/axe.min.js")

/** What the room says to assistive technology: the focused element, the TV's focus, the live region, the layers. */
const SAYS = () => {
	const room = document.getElementById("room")
	const active = document.activeElement
	const name = (el) => (el ? (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60) : null)
	const layers = [...room.querySelectorAll("[data-tv-layer]")]
	const top = layers.at(-1)
	const live = [...room.querySelectorAll("[aria-live]")]
	return {
		search: location.search,
		active: active === document.body ? "body" : `${active?.tagName.toLowerCase()} ${active?.getAttribute("data-tv-item") ?? ""} ${name(active)}`.trim(),
		activeItem: active?.getAttribute("data-tv-item") ?? null,
		inRoom: room.contains(active),
		focus: top?.querySelector("[data-tv-item][aria-current]")?.getAttribute("data-tv-item") ?? null,
		live: live.map((el) => el.textContent),
		liveKinds: live.map((el) => el.getAttribute("aria-live")),
		menu: Boolean(room.querySelector('[role="menu"]')),
		layers: layers.length,
	}
}

async function access() {
	// ---- The keyboard alone, on the desktop and on a phone with a keyboard (a tablet), as a guest and as a member.
	for (const [who, url, size] of [
		["guest desktop", PAGE, [1920, 1080]],
		["guest phone", PAGE, [390, 844]],
		["member desktop", `${BASE}/prototype/my-library-real/tv?member=six`, [1920, 1080]],
	]) {
		where = `access keyboard ${who}`
		console.log(where)
		const { ctx, page, quiet } = await context(size)
		await goto(page, url, "#room:not([data-room=unmeasured]) [data-tv-item]")
		await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" })
		await page.waitForTimeout(800)
		const says = () => page.evaluate(SAYS)
		const wait = async (fits, ms = 8000) => {
			const end = Date.now() + ms
			let v = await says()
			while (!fits(v) && Date.now() < end) {
				await page.waitForTimeout(80)
				v = await says()
			}
			return v
		}
		// Tab from the top of the page into the room: what the Tab key meets, in order, until it leaves the TV.
		const items = await page.evaluate(() => [...[...document.querySelectorAll("#room [data-tv-layer]")].at(-1).querySelectorAll("[data-tv-item]")].map((el) => el.getAttribute("data-tv-item")))
		const met = []
		for (let n = 0; n < 60; n += 1) {
			await page.keyboard.press("Tab")
			const v = await says()
			if (v.inRoom) met.push(v.activeItem ?? `key ${v.active}`)
			if (v.inRoom && !v.activeItem && met.some((m) => !m.startsWith("key"))) break
		}
		const metItems = met.filter((m) => !m.startsWith("key"))
		is(metItems, items, "Tab walks the TV's items in reading order, the machine's order, before the Remote's keys")
		const remoteKeys = met.filter((m) => m.startsWith("key"))
		check(remoteKeys.length >= 1, `then the Remote's keys: ${remoteKeys.slice(0, 3).join(", ")}`)
		numbers[`tab order ${who}`] = met
		// Shift+Tab back onto the TV: the browser's focus is on an item and the TV's focus follows it.
		await page.keyboard.press("Shift+Tab")
		let v = await says()
		is(v.activeItem, items.at(-1), "Shift+Tab comes back to the last item")
		is(v.focus, items.at(-1), "the TV's focus follows the browser's")
		// Home with the arrows: the browser's focus goes where the TV's goes.
		await page.keyboard.press("ArrowUp")
		await page.keyboard.press("ArrowDown")
		v = await wait((x) => x.focus?.startsWith("app:"))
		is(v.activeItem, v.focus, "after the arrows the browser's focus is the TV's focused item")
		// To the row's start, then one along it and back.
		for (let n = 0; n < 8; n += 1) await page.keyboard.press("ArrowLeft")
		v = await wait((x) => x.focus === "app:tonight")
		const start = v.focus
		await page.keyboard.press("ArrowRight")
		v = await wait((x) => x.focus !== start)
		is([v.focus, v.activeItem], ["app:discover", "app:discover"], "an arrow moves both")
		await page.keyboard.press("ArrowLeft")
		v = await wait((x) => x.focus === start)
		// Enter opens the app; its screen is announced, and the focus is on the new screen's first item.
		is(v.live, ["Home"], "the live region names the screen on show")
		is(v.liveKinds, ["polite"], "one polite live region in the room")
		await page.keyboard.press("Enter")
		v = await wait((x) => x.live[0] !== "Home" && x.activeItem && x.activeItem !== start)
		check(v.live[0] && v.live[0] !== "Home", `Enter opens ${start}, and the live region says ${JSON.stringify(v.live)}`)
		check(v.inRoom && v.activeItem === v.focus, `the browser's focus moved to the new screen's focused item: ${v.active}`)
		// Escape is Back: home again, announced, the focus where it was.
		await page.keyboard.press("Escape")
		v = await wait((x) => x.live[0] === "Home" && x.focus === start)
		is([v.live[0], v.focus, v.activeItem], ["Home", start, start], "Escape is Back: home, announced, the focus on the app it left")
		// M opens the menu: a menu of named items, the focus on its first.
		await page.keyboard.press("m")
		v = await wait((x) => x.menu && x.activeItem?.startsWith("menu:"))
		const menu = await page.evaluate(() => {
			const m = document.querySelector('#room [role="menu"]')
			return { label: m?.getAttribute("aria-label"), items: [...m.querySelectorAll("[data-tv-item]")].map((el) => ({ id: el.getAttribute("data-tv-item"), role: el.getAttribute("role") ?? el.tagName.toLowerCase(), name: el.textContent.trim() })) }
		})
		check(v.menu && v.activeItem === menu.items[0]?.id, `M opens the menu with the focus on its first item: ${v.active}`)
		is(menu.label, "Menu", "the menu's name")
		check(menu.items.every((i) => i.name), `every item of the menu has a name: ${menu.items.map((i) => i.name).join(", ")}`)
		check(menu.items.every((i) => i.role === "menuitem"), `every item of the menu is a menu item: ${menu.items.map((i) => i.role).join(", ")}`)
		const under = await page.evaluate(() => document.querySelector("#room [data-tv-layer]")?.hasAttribute("inert"))
		is(under, true, "the screen under the menu takes no input and is not read out")
		await page.keyboard.press("ArrowDown")
		v = await wait((x) => x.activeItem === menu.items[1]?.id)
		is(v.activeItem, menu.items[1]?.id, "Down moves along the menu")
		await page.keyboard.press("Escape")
		v = await wait((x) => !x.menu)
		is([v.menu, v.focus, v.activeItem], [false, start, start], "Escape closes the menu, the focus back on the screen")
		check(quiet().length === 0, `nothing in the console: ${quiet().slice(0, 3).join(" | ")}`)
		await ctx.close()
	}

	// ---- axe on the room, after hydration: names, roles, ARIA, contrast. Home, Tonight, the menu.
	for (const [who, size] of [
		["desktop", [1920, 1080]],
		["phone", [390, 844]],
	]) {
		where = `access axe ${who}`
		console.log(where)
		const { ctx, page } = await context(size)
		await goto(page, PAGE, "#room:not([data-room=unmeasured]) [data-tv-item]")
		await page.addScriptTag({ path: AXE })
		const run = (name) =>
			page.evaluate(async () => {
				const r = await window.axe.run("#room", { resultTypes: ["violations", "incomplete"] })
				const short = (v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => `${n.target.join(" ")}: ${(n.failureSummary ?? "").split("\n").slice(1, 2).join("").trim()} ${n.any?.[0]?.data?.contrastRatio ? `(contrast ${n.any[0].data.contrastRatio}, ${n.any[0].data.fgColor} on ${n.any[0].data.bgColor})` : ""}`) })
				return { violations: r.violations.map(short), incomplete: r.incomplete.map(short) }
			}).then((r) => ({ name, ...r }))
		const home = await run("home")
		await page.keyboard.press("m")
		await page.waitForSelector('#room [role="menu"]')
		await page.waitForTimeout(400)
		const menu = await run("menu")
		for (const r of [home, menu]) {
			check(r.violations.length === 0, `axe finds no violation on ${r.name}: ${JSON.stringify(r.violations)}`)
			numbers[`axe ${who} ${r.name}`] = r
		}
		await ctx.close()
	}

	// ---- What every key of the Remotes and the TV says, and the contrast of the Remote's words and marks.
	for (const size of [[1920, 1080], [390, 844]]) {
		where = `access keys ${size.join("x")}`
		console.log(where)
		const { ctx, page } = await context(size)
		await goto(page, PAGE, "#room:not([data-room=unmeasured]) [data-tv-item]")
		const keys = await page.evaluate(() => {
			const lum = (c) => {
				const [r, g, b] = c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
				return 0.2126 * r + 0.7152 * g + 0.0722 * b
			}
			const rgba = (s) => (s.match(/[\d.]+/g) ?? []).map(Number)
			const over = (fg, bg) => (fg.length < 4 ? fg.slice(0, 3) : fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3])))
			// The Remote's body is a dark gradient: its lightest stop is the background the words must hold against.
			const body = getComputedStyle(document.querySelector("#room .remote-body"))
			const stops = (body.backgroundImage.match(/rgba?\([^)]+\)/g) ?? [body.backgroundColor]).map(rgba).map((c) => c.slice(0, 3))
			const lightest = stops.sort((a, b) => lum(b) - lum(a))[0]
			const words = [...document.querySelectorAll("#room [data-remote] span, #room [data-phone-remote] span")].filter((el) => el.getClientRects().length && el.textContent.trim() && !el.querySelector("*"))
			const ratio = (a, b) => {
				const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
				return (x + 0.05) / (y + 0.05)
			}
			const buttons = [...document.querySelectorAll("#room button")].filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden")
			return {
				lightest,
				words: words.map((el) => ({ text: el.textContent.trim(), px: getComputedStyle(el).fontSize, ratio: +ratio(over(rgba(getComputedStyle(el).color), lightest), lightest).toFixed(2) })),
				unnamed: buttons.filter((el) => !(el.getAttribute("aria-label") || el.textContent.trim())).map((el) => el.outerHTML.slice(0, 120)),
				small: buttons.map((el) => ({ el, b: el.getBoundingClientRect() })).filter(({ b }) => b.width < 44 || b.height < 44).map(({ el, b }) => `${el.getAttribute("data-tv-item") ?? el.getAttribute("aria-label") ?? el.textContent.trim()} ${b.width.toFixed(1)}x${b.height.toFixed(1)}`),
				count: buttons.length,
			}
		})
		is(keys.unnamed, [], "every visible button in the room has a name")
		const low = keys.words.filter((w) => w.ratio < 4.5)
		check(low.length === 0, `the Remote's words hold 4.5:1 against the lightest part of its body (${JSON.stringify(keys.lightest)}): ${JSON.stringify(low.slice(0, 4))}`)
		numbers[`remote words ${size.join("x")}`] = keys.words
		if (isPhone(size)) is(keys.small, [], `every one of the ${keys.count} buttons of the room is 44 px or more on the phone`)
		await ctx.close()
	}
	// The phone's touch targets at every phone layout, home and the menu.
	for (const size of [[390, 844], [375, 667], [320, 568], [844, 390], [667, 375]]) {
		where = `access targets ${size.join("x")}`
		console.log(where)
		const { ctx, page } = await context(size)
		await goto(page, PAGE, "#room:not([data-room=unmeasured]) [data-tv-item]")
		const small = () => page.evaluate(() => [...document.querySelectorAll("#room button")].filter((el) => el.getClientRects().length && !el.closest("[inert]")).map((el) => ({ el, b: el.getBoundingClientRect() })).filter(({ b }) => b.width < 43.99 || b.height < 43.99).map(({ el, b }) => `${el.getAttribute("data-tv-item") ?? el.getAttribute("aria-label") ?? el.textContent.trim()} ${b.width.toFixed(1)}x${b.height.toFixed(1)}`))
		is(await small(), [], "home: every button is 44 px or more")
		await page.locator('#room [aria-label="Menu"]').first().tap()
		await page.waitForSelector('#room [role="menu"]')
		await page.waitForTimeout(400)
		is(await small(), [], "the menu: every button is 44 px or more")
		await ctx.close()
	}

	// ---- The TV's words against what is behind them: the picture, its shade, a tile. axe cannot tell a background
	// that is a picture or a gradient, so the words are hidden, the window photographed, and each word's box read:
	// the contrast with the lightest tenth of the pixels behind it (what the eye meets at worst).
	for (const [who, url, size] of [
		["guest desktop", PAGE, [1920, 1080]],
		["guest phone", PAGE, [390, 844]],
		["member desktop", `${BASE}/prototype/my-library-real/tv?member=six`, [1920, 1080]],
	]) {
		where = `access contrast ${who}`
		console.log(where)
		const { ctx, page } = await context(size)
		await goto(page, url, "#room:not([data-room=unmeasured]) [data-tv-item]")
		await page.waitForTimeout(2500)
		const words = await page.evaluate(() => {
			const out = []
			for (const el of document.querySelectorAll("#room [data-tv-canvas] *")) {
				const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
				if (!own || !el.getClientRects().length) continue
				const s = getComputedStyle(el)
				if (s.visibility === "hidden" || Number(s.opacity) === 0) continue
				const b = el.getBoundingClientRect()
				if (b.right < 0 || b.bottom < 0 || b.left > innerWidth || b.top > innerHeight) continue
				// A word on a tile that sits back is dimmed by the tile's overlay too: its opacity is the tile's own.
				const item = el.closest("[data-tv-item]")
				// The size on the screen: the canvas is drawn scaled.
				const canvas = el.closest("[data-tv-canvas]")
				const scale = canvas.getBoundingClientRect().width / canvas.offsetWidth
				out.push({ text: el.textContent.trim().slice(0, 40), color: s.color, px: Math.round(Number.parseFloat(s.fontSize) * scale * 10) / 10, bold: Number(s.fontWeight) >= 700, box: [b.left, b.top, b.width, b.height], focused: item?.hasAttribute("aria-current") ?? null })
			}
			return out
		})
		await page.addStyleTag({ content: "#room [data-tv-canvas] * { color: transparent !important; text-shadow: none !important; } #room [data-tv-canvas] svg { visibility: hidden }" })
		await page.waitForTimeout(300)
		const shot = await page.screenshot()
		const judged = await judge(shot, words, size)
		const low = judged.filter((w) => w.ratio < (w.large ? 3 : 4.5))
		check(low.length === 0, `every word on the TV holds ${"4.5:1"} (3:1 when large) against what is behind it: ${JSON.stringify(low.slice(0, 6))}`)
		numbers[`tv words ${who}`] = judged
		await ctx.close()
	}

	// ---- Reduced motion: screens cut, nothing moves of itself, the Remote does not aim.
	where = "access reduced motion"
	console.log(where)
	{
		const { ctx, page } = await context([1920, 1080], { reducedMotion: "reduce" })
		await goto(page, PAGE, "#room:not([data-room=unmeasured]) [data-tv-item]")
		await page.mouse.move(400, 300, { steps: 3 })
		await page.waitForTimeout(1500)
		await page.keyboard.press("ArrowRight")
		await page.keyboard.press("Enter")
		await page.waitForFunction(() => document.querySelector("#room [aria-live]")?.textContent !== "Home")
		await page.waitForTimeout(300)
		const motion = await page.evaluate(() => {
			const room = document.getElementById("room")
			const all = [...room.querySelectorAll("*")]
			// What moves: an animation, or a transition of something that moves (a colour may still ease, as a
			// key's light does when it is pressed: that is no motion).
			const moving = all.filter((el) => {
				const s = getComputedStyle(el)
				const anim = s.animationName !== "none" && s.animationDuration !== "0s"
				const props = s.transitionProperty.split(",").map((p) => p.trim())
				const trans = s.transitionDuration.split(",").some((d, i) => Number.parseFloat(d) > 0 && /^(all|transform|translate|scale|rotate|inset|left|top|width|height)$/.test(props[i % props.length]))
				return anim || trans
			})
			return { moving: moving.map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")}: ${getComputedStyle(el).animationName} ${getComputedStyle(el).transitionDuration}`).slice(0, 8), count: moving.length, remote: room.querySelector("[data-remote]")?.style.transform }
		})
		await page.mouse.move(1800, 200, { steps: 10 })
		await page.waitForTimeout(500)
		const aimed = await page.evaluate(() => document.querySelector("#room [data-remote]")?.style.transform)
		check(motion.count === 0, `with reduced motion nothing in the room animates or transitions after a screen change: ${JSON.stringify(motion.moving)}`)
		check(!/rotateZ\(-?[1-9]/.test(aimed ?? ""), `the Remote does not aim at the cursor: ${aimed}`)
		await ctx.close()
	}
}


// ---------------------------------------------------------------------------------------------------------
// The rendering budget (#190): long tasks, long frames and the time an interaction takes, while pointing, moving
// the focus and changing screens. On a production build (BUILD=1). NOREPLAY=1 turns the error reporting's session
// recorder off in its chunk as served, to tell its share.

/** Counts frames and their script time, the tasks over 50 ms, the long frames with their scripts, and interactions. */
const METER = () => {
	const meter = { frames: 0, longest: 0, total: 0, tasks: [], loafs: [], events: [] }
	window.__meter = meter
	const raf = window.requestAnimationFrame.bind(window)
	window.requestAnimationFrame = (callback) =>
		raf((time) => {
			const start = performance.now()
			callback(time)
			const took = performance.now() - start
			meter.frames += 1
			meter.total += took
			meter.longest = Math.max(meter.longest, took)
		})
	new PerformanceObserver((list) => {
		for (const e of list.getEntries()) meter.tasks.push(Math.round(e.duration))
	}).observe({ entryTypes: ["longtask"] })
	try {
		new PerformanceObserver((list) => {
			for (const e of list.getEntries())
				if (e.duration >= 50)
					meter.loafs.push({
						ms: Math.round(e.duration),
						blocking: Math.round(e.blockingDuration),
						scripts: e.scripts.filter((x) => x.duration >= 10).map((x) => `${Math.round(x.duration)} ms ${x.invokerType} ${x.invoker.slice(-40)} in ${x.sourceURL.split("/").at(-1).replace(/-[\w-]{8}\.js$/, ".js").slice(0, 40)}`),
					})
		}).observe({ type: "long-animation-frame" })
	} catch {}
	try {
		new PerformanceObserver((list) => {
			for (const e of list.getEntries()) if (e.interactionId) meter.events.push({ type: e.name, ms: Math.round(e.duration) })
		}).observe({ type: "event", durationThreshold: 16 })
	} catch {}
}

async function budget() {
	const ROUNDS = Number(process.env.ROUNDS ?? 5)
	const variant = process.env.NOREPLAY ? "recorder off" : process.env.BLOCKED ? "Remote and ring kept out of the recording" : "as served"
	const PROFILES = [
		["desktop, GPU", [1920, 1080], [], 1],
		["desktop, software rendering", [1920, 1080], ["--disable-gpu"], 1],
		["phone, CPU slowed 4 times", [390, 844], [], 4],
	]
	// PROFILE=0,2 measures those profiles only; POINTING=1 the pointing sweeps only.
	const chosen = process.env.PROFILE ? process.env.PROFILE.split(",").map(Number) : PROFILES.map((_, i) => i)
	for (const [name, size, args, cpu] of PROFILES.filter((_, i) => chosen.includes(i))) {
		where = `budget ${name}, ${variant}`
		console.log(where)
		const own = await launch(args)
		const { ctx, page } = await context(size, { on: own })
		const cdp = await ctx.newCDPSession(page)
		await page.addInitScript(METER)
		const chunks = []
		page.on("request", (r) => r.resourceType() === "script" && chunks.push(r.url().split("/").at(-1)))
		// BLOCKED=1: the recorder on, with the moving Remote and the ring kept out of the recording (Sentry's `block`).
		if (process.env.BLOCKED)
			await page.route(/\/assets\/sentry-browser-/, async (route) => {
				const response = await route.fetch()
				const body = (await response.text()).replace('block:[".search-private"]', 'block:[".search-private","[data-remote]","[data-remote-rig]","[data-tv-pointer]"]')
				await route.fulfill({ status: 200, contentType: "text/javascript", body })
			})
		if (process.env.NOREPLAY)
			await page.route(/\/assets\/sentry-browser-/, async (route) => {
				const response = await route.fetch()
				const body = (await response.text()).replace(/replaysSessionSampleRate:[^,]*,replaysOnErrorSampleRate:[^,}]*/, "replaysSessionSampleRate:0,replaysOnErrorSampleRate:0")
				await route.fulfill({ status: 200, contentType: "text/javascript", body })
			})
		await goto(page, PAGE, "#room:not([data-room=unmeasured]) [data-tv-item]")
		if (cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu })
		const meter = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__meter)))
		const reset = () => page.evaluate(() => Object.assign(window.__meter, { frames: 0, longest: 0, total: 0, tasks: [], loafs: [], events: [] }))
		const tv = await page.evaluate(() => {
			const b = document.querySelector("#room [data-tv-screen]").getBoundingClientRect()
			return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }
		})
		const phone = isPhone(size)
		// The first interaction: pointing's code and the screens' come, and the site's telemetry after a pause.
		if (phone) await page.locator('#room [aria-label="Next"]').first().tap()
		else await page.mouse.move(tv.left + 100, tv.top + 100, { steps: 4 })
		const until = Date.now() + 20000
		while (!chunks.some((c) => c.startsWith("sentry-browser")) && Date.now() < until) await page.waitForTimeout(250)
		await page.waitForTimeout(6000)
		const sentry = chunks.some((c) => c.startsWith("sentry-browser"))
		check(sentry, "the error reporting (Sentry) has loaded before the measurement")
		const result = { sentryLoaded: sentry, cpuSlowdown: cpu, rounds: [] }
		const summary = (m, ms) => ({ ms, frames: m.frames, meanFrameMs: +(m.total / Math.max(1, m.frames)).toFixed(3), longestFrameMs: +m.longest.toFixed(2), tasksOver50ms: m.tasks, longFrames: m.loafs, slowestInteractionMs: Math.max(0, ...m.events.map((e) => e.ms)) })
		const key = async (k) => {
			if (phone) await page.locator(k === "OK" ? "#room [data-phone-remote] .remote-ok" : `#room [data-phone-remote] [aria-label="${k}"]`).first().tap()
			else await page.keyboard.press({ Next: "ArrowRight", Previous: "ArrowLeft", Up: "ArrowUp", Down: "ArrowDown", OK: "Enter", Back: "Escape" }[k] ?? k)
		}
		const live = () => page.evaluate(() => document.querySelector("#room [aria-live]")?.textContent)
		const settled = async (fits, ms = 15000) => {
			const end = Date.now() + ms
			while (!(await fits()) && Date.now() < end) await page.waitForTimeout(50)
		}
		for (let round = 0; round < ROUNDS; round += 1) {
			const row = {}
			// Pointing: the Remote and the ring follow the cursor around the window and across the picture; on the
			// phone a finger drags across the picture, the ring above it.
			await reset()
			let from = Date.now()
			if (phone) {
				const y = tv.top + tv.height * 0.45
				const touch = (type, x, yy) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y: yy }] })
				await touch("touchStart", tv.left + 20, y)
				for (let n = 0; n <= 60; n += 1) {
					const t = n / 60
					await touch("touchMove", tv.left + 20 + (tv.width - 40) * (t < 0.5 ? t * 2 : 2 - t * 2), y - 30 * Math.sin(t * Math.PI))
					await page.waitForTimeout(16)
				}
				// Let go over nothing: back off the picture's edge first.
				await touch("touchMove", tv.left + 4, tv.bottom + 120)
				await touch("touchEnd")
			} else {
				const [w, h] = size
				const free = tv.top + tv.height * 0.42
				for (const [x, y] of [[20, 90], [w - 40, 90], [w - 40, h - 20], [20, h - 20], [20, 90], [tv.left + 30, free], [tv.right - 30, free - 60], [tv.left + 30, free - 120], [tv.left + 400, free]]) await page.mouse.move(x, y, { steps: 40 })
			}
			await page.waitForTimeout(400)
			row.pointing = summary(await meter(), Date.now() - from)
			if (process.env.POINTING) {
				row.focusMoves = row.screenChanges = summary({ frames: 0, total: 0, longest: 0, tasks: [], loafs: [], events: [] }, 0)
				result.rounds.push(row)
				console.log(`  round ${round + 1}: pointing ${JSON.stringify(row.pointing.tasksOver50ms)} ${JSON.stringify(row.pointing.longFrames.filter((l) => l.ms >= 50).map((l) => l.scripts.join(";")))}`)
				continue
			}
			// Ten focus moves with the Remote's keys (the keyboard on the desktop, the phone Remote's wheel by a finger).
			await reset()
			from = Date.now()
			for (const k of ["Next", "Next", "Next", "Previous", "Next", "Next", "Previous", "Previous", "Previous", "Previous"]) {
				await key(k)
				await page.waitForTimeout(phone ? 250 : 150)
			}
			await page.waitForTimeout(500)
			row.focusMoves = summary(await meter(), Date.now() - from)
			// Screen changes: open each app from home and go back, by OK and Back.
			await reset()
			from = Date.now()
			for (const app of ["Tonight", "Discover", "Explorer"]) {
				await settled(async () => (await live()) === "Home")
				await page.evaluate((id) => document.querySelector(`#room [data-tv-item="app:${id.toLowerCase()}"]`)?.focus(), app)
				await key("OK")
				await settled(async () => (await live()) === app)
				await page.waitForTimeout(500)
				await key("Back")
				await settled(async () => (await live()) === "Home")
				await page.waitForTimeout(500)
			}
			row.screenChanges = summary(await meter(), Date.now() - from)
			result.rounds.push(row)
			console.log(`  round ${round + 1}: pointing ${JSON.stringify(row.pointing.tasksOver50ms)}, focus ${JSON.stringify(row.focusMoves.tasksOver50ms)}, screens ${JSON.stringify(row.screenChanges.tasksOver50ms)}; slowest interaction ${row.focusMoves.slowestInteractionMs}/${row.screenChanges.slowestInteractionMs} ms`)
		}
		// At rest: nothing asks for a frame, and the main thread is quiet.
		await page.mouse.move(size[0] - 5, 5)
		await page.evaluate(() => document.documentElement.dispatchEvent(new MouseEvent("mouseleave")))
		await page.waitForTimeout(2500)
		await cdp.send("Performance.enable")
		const busy = async () => (await cdp.send("Performance.getMetrics")).metrics.find((m) => m.name === "TaskDuration").value
		await reset()
		const t0 = await busy()
		await page.waitForTimeout(5000)
		const idle = ((await busy()) - t0) / 5
		const still = await meter()
		result.atRest = { framesIn5s: still.frames, mainThreadShare: +idle.toFixed(4) }
		is(still.frames, 0, "at rest nothing asks for a frame")
		check(idle <= 0.05 * cpu, `at rest the page's main thread is busy ${(idle * 100).toFixed(2)}% of a core`)
		const all = result.rounds.flatMap((r) => [r.pointing, r.focusMoves, r.screenChanges])
		result.longest = Math.max(...all.map((r) => r.longestFrameMs))
		result.tasks = all.flatMap((r) => r.tasksOver50ms)
		check(result.longest <= 10 * cpu, `no frame callback over ${10 * cpu} ms: ${result.longest} ms at the most`)
		numbers[`budget ${name}, ${variant}`] = result
		await ctx.close()
		await own.close()
	}
}


// ---------------------------------------------------------------------------------------------------------
// SEO (docs/verification/235-living-room-seo.md, as far as /home-preview can show it before the switch): the
// room's HTML is the same for every user agent, one H1 per window, the start titles and the hubs as links.

async function seo() {
	where = "seo"
	console.log(where)
	const agents = {
		googlebot: "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.126 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
		desktop: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
		iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
	}
	const pages = {}
	for (const [name, agent] of Object.entries(agents)) {
		const response = await fetch(PAGE, { headers: { "user-agent": agent, "accept-language": "en-US,en;q=0.9" } })
		const html = await response.text()
		const start = html.indexOf('<div id="room"')
		const end = html.indexOf("</section>", html.indexOf('<section id="browse"')) + "</section>".length
		pages[name] = { status: response.status, room: html.slice(start, end), length: html.length }
	}
	const [first, ...rest] = Object.values(pages)
	check(rest.every((p) => p.room === first.room), `the room and the section below are the same HTML for every user agent (${first.room.length} characters)`)
	const room = first.room
	const count = (text) => room.split(text).length - 1
	is(count("<h1"), 2, "two H1s in the HTML, one per edition of the screen")
	is([...room.matchAll(/<a href="\/(movie|show)\//g)].length, 16, "the 16 start titles as links")
	for (const hub of ["/discover", "/explorer", "/taste"]) check(room.includes(`href="${hub}"`), `the hub ${hub} as a link`)
	check(!/data-tv-item="app:shows"/.test(room), "a guest's HTML has no member's tile")
	numbers.seo = { roomCharacters: room.length, documentCharacters: first.length, titleLinks: 16 }
	// One H1 shows in every window, before any script and after hydration.
	for (const size of [[1920, 1080], [1440, 800], [390, 844], [375, 667], [844, 390]]) {
		for (const scripts of [false, true]) {
			const { ctx, page } = await context(size)
			if (!scripts) await page.route((u) => /\.(js|ts|tsx)$/.test(u.pathname) || u.pathname.includes("/@"), (route) => (route.request().resourceType() === "script" ? route.abort() : route.fallback()))
			await goto(page, PAGE, scripts ? "#room:not([data-room=unmeasured]) [data-tv-item]" : "#room")
			await page.waitForTimeout(500)
			const shown = await page.evaluate(() => [...document.querySelectorAll("h1")].filter((h) => h.getClientRects().length && getComputedStyle(h).visibility !== "hidden").map((h) => h.textContent))
			is(shown, ["Let's find something good for tonight."], `${size.join("x")} ${scripts ? "after hydration" : "before any script"}: one H1 shows`)
			await ctx.close()
		}
	}
	// The old address still answers 301 with its query.
	const old = await fetch(`${BASE}/living-room?tv=moods`, { redirect: "manual" })
	is([old.status, old.headers.get("location")], [301, "/?tv=moods"], "/living-room?tv=moods answers 301")
}

const is = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), `${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)

if (!only || only === "paint") await paint()
if (!only || only === "access") await access()
if (!only || only === "budget") await budget()
if (!only || only === "seo") await seo()

await browser.close()
const file = join(here, "checks.json")
let previous = {}
try {
	previous = JSON.parse(readFileSync(file, "utf8"))
} catch {}
writeFileSync(file, `${JSON.stringify({ ...previous, [`${only ?? "all"}${process.env.LABEL ? `, ${process.env.LABEL}` : ""}`]: { passed, failed, numbers } }, null, "\t")}\n`)
console.log(`\n${passed} checks passed, ${failed.length} failed`)
for (const f of failed) console.log(`  ${f}`)
process.exit(failed.length ? 1 : 0)
