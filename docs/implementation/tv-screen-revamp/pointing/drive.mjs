// Slice 4 of the new TV (pointing) and slice 4b as far as pointing goes (the phone in landscape): points at the
// TV on /home-preview with the mouse and with a finger, as a guest on real data and as a member on the tracking
// harness, checks the ring, the Remote and the TV's state after every step, measures what pointing costs, and takes
// the screenshots in shots/ and the sheets beside the prototype's own strips.
//
//   PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs GUEST=http://localhost:3184 \
//   MEMBER=http://localhost:3185 node drive.mjs [checks|landscape|shots|budget]
//   BUILD=1 GUEST=http://localhost:3186 node drive.mjs budget     against a production build, served without services
//   BUILD=1 CONTROL=1 ... node drive.mjs budget                   the same without pointing, to tell its cost from the page's
//   BUILD=1 NOREPLAY=1 ... node drive.mjs budget                  the same with the error reporting's session recorder off
//
// The repo has no browser driver: install playwright-core outside it. GUEST is a dev server of goodwatch-webapp
// that reads real data; MEMBER is one without any service, for the harness (see README.md here for both
// commands). PROTOTYPE= is the folder of the prototype's notes (docs/prototypes/tv-screen-design on
// prototype/tv-screen-flow), for the sheets. Nothing here signs in, rates or writes: requests that would leave the
// machine are stopped in the browser.
//
// The checks are the prototype's own for the mouse and for a finger (its walk.mjs, "pointing" and "touching"),
// ported to the product's markup, and new ones for landscape, which the prototype did not have.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const GUEST = `${process.env.GUEST ?? "http://localhost:3184"}/home-preview`
const MEMBER = `${process.env.MEMBER ?? "http://localhost:3185"}/prototype/my-library-real/tv?member=six`
const prototype = process.env.PROTOTYPE ?? "/home/alper/projects/goodwatch-monorepo-38caebf4/docs/prototypes/tv-screen-design"
const only = process.argv[2]
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")

const DESKTOP = [1920, 1080]
const BESIDE = [1440, 800]
const PHONE = [390, 844]
const SHORT = [375, 667]
const LANDSCAPES = [
	[844, 390],
	[932, 430],
	[667, 375],
]

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
const is = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), `${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
const numbers = {}

const launch = (args = []) => chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--use-angle=gl", "--ignore-gpu-blocklist", ...args] })
let browser = await launch()

/** Counts the frames the page asks for and how long each takes, and the tasks over 50 ms: for the budget. */
const METER = () => {
	const meter = { frames: 0, longest: 0, total: 0, tasks: [], scripts: [] }
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
		for (const entry of list.getEntries()) meter.tasks.push(Math.round(entry.duration))
	}).observe({ entryTypes: ["longtask"] })
	// Which script ran for 25 ms or more in a long frame, to say whose a long task is.
	try {
		new PerformanceObserver((list) => {
			for (const entry of list.getEntries())
				for (const script of entry.scripts) if (script.duration >= 25) meter.scripts.push(`${Math.round(script.duration)} ms: ${script.invokerType} ${script.invoker.slice(-50)} in ${script.sourceURL.split("/").at(-1).slice(0, 40)}`)
		}).observe({ type: "long-animation-frame" })
	} catch {}
}

/** Opens a page. A busy machine times a load out now and then: try again, twice. */
async function open(url, [width, height], { touch = width < 768 || height < 541, hasTouch = touch, tries = 3, reducedMotion, meter = false, on = browser } = {}) {
	const ctx = await on.newContext({
		viewport: { width, height },
		deviceScaleFactor: touch ? 2 : 1,
		reducedMotion,
		...(touch ? { isMobile: true } : {}),
		hasTouch,
	})
	const page = await ctx.newPage()
	const logs = []
	const requests = []
	page.on("console", (m) => {
		if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text()}`)
	})
	page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`))
	page.on("request", (r) => requests.push(r.url()))
	// Nothing may leave the machine but for the pictures.
	await page.route(
		(u) => !["localhost", "127.0.0.1", "image.tmdb.org"].includes(u.hostname) && u.protocol.startsWith("http"),
		(route) => route.fulfill({ status: 204, body: "" }),
	)
	// The browser's telemetry goes through the dev server to Sentry (/api/e): a drive's page views are no news.
	await page.route("**/api/e", (route) => route.fulfill({ status: 200, body: "" }))
	if (meter) await page.addInitScript(METER)
	try {
		await page.goto(url, { waitUntil: "load", timeout: 180000 })
		await page.waitForSelector("#room:not([data-room=unmeasured]) [data-tv-item]", { timeout: 180000 })
	} catch (error) {
		await ctx.close().catch(() => {})
		if (tries <= 1) throw error
		console.log("loading again:", String(error.message).split("\n")[0])
		await new Promise((done) => setTimeout(done, 4000))
		return open(url, [width, height], { touch, hasTouch, tries: tries - 1, reducedMotion, meter, on })
	}
	// The dev tools' round key is no part of the page.
	await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" })
	await page.waitForTimeout(600)
	const cdp = await ctx.newCDPSession(page)
	/** The requests for pointing's code: the dev server serves each module by its path. */
	const code = () => requests.filter((u) => /\/tv\/pointing(-aim)?\.ts/.test(u))
	const quiet = () => logs.filter((l) => !l.includes("Future Flag") && !l.includes("net::ERR_FAILED") && !l.includes("503") && !l.includes("Failed to load resource"))
	return { ctx, page, cdp, logs, requests, code, quiet }
}

/** What the room shows: the TV's state, the ring, the Remote. Positions are the window's. */
const look = (page) =>
	page.evaluate(() => {
		const room = document.getElementById("room")
		const origin = room.getBoundingClientRect()
		const ring = room.querySelector("[data-tv-pointer]")
		const at = ring && /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(ring.style.transform)
		const rig = room.querySelector("[data-remote-rig]")
		const remote = rig ?? room.querySelector("[data-remote]")
		const t = remote.style.transform
		const deg = (name) => Number(new RegExp(`${name}\\(([-\\d.]+)deg\\)`).exec(t)?.[1] ?? 0)
		const move = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(t)
		const box = (selector) => {
			const el = room.querySelector(selector)
			if (!el) return null
			const b = el.getBoundingClientRect()
			return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }
		}
		const layers = [...room.querySelectorAll("[data-tv-layer]")]
		const top = layers.at(-1)
		return {
			search: location.search,
			hash: location.hash,
			room: room.dataset.room,
			place: room.dataset.remotePlace ?? null,
			form: room.dataset.remoteForm ?? null,
			power: room.dataset.tvPower,
			away: room.hasAttribute("inert"),
			layers: layers.length,
			items: top ? [...top.querySelectorAll("[data-tv-item]")].map((el) => el.getAttribute("data-tv-item")).filter((id) => id !== "expand") : [],
			focus: top?.querySelector("[data-tv-item][aria-current]")?.getAttribute("data-tv-item") ?? null,
			pointing: room.dataset.pointing ?? null,
			shown: ring?.dataset.shown === "true",
			over: ring?.dataset.over === "true",
			hold: ring?.dataset.hold === "true",
			opacity: ring ? Number(getComputedStyle(ring).opacity) : 0,
			fade: ring ? getComputedStyle(ring).transitionDuration : null,
			small: Boolean(ring?.classList.contains("tvp-small")),
			x: at ? Number(at[1]) + origin.left : null,
			y: at ? Number(at[2]) + origin.top : null,
			// "" before pointing has started and on the phone at rest; "none" once the phone's Remote has rested.
			transform: t,
			flat: t === "" || t === "none",
			rz: deg("rotateZ"),
			rx: deg("rotateX"),
			ry: deg("rotateY"),
			tx: Number(move?.[1] ?? 0),
			ty: Number(move?.[2] ?? 0),
			scene: { left: origin.left, top: origin.top, right: origin.right, bottom: origin.bottom, width: origin.width, height: origin.height },
			tv: box("[data-tv-screen]"),
			tvBody: box("[data-tv-body]"),
			body: box(".remote-body"),
			streaming: Math.max(...[...room.querySelectorAll(".remote-service")].map((el) => el.getBoundingClientRect().bottom)),
			cursor: getComputedStyle(room.querySelector("[data-tv-screen]")).cursor,
			selected: String(getSelection()),
			scrolled: window.scrollY + document.documentElement.scrollTop + room.scrollTop,
		}
	})

/** Waits until the room is as wanted, for `timeout` at most, and returns what it shows then. */
async function settle(page, fits, timeout = 8000) {
	const end = Date.now() + timeout
	let v = await look(page)
	while (!fits(v) && Date.now() < end) {
		await page.waitForTimeout(80)
		v = await look(page)
	}
	return v
}
/** Waits until the Remote has arrived where it is going (two looks in a row show the same transform), and returns the last look. */
async function arrived(page, least = 300) {
	await page.waitForTimeout(least)
	let before = await look(page)
	for (let i = 0; i < 40; i++) {
		await page.waitForTimeout(150)
		const now = await look(page)
		if (now.transform === before.transform && now.x === before.x && now.y === before.y) return now
		before = now
	}
	return before
}
/** The same, and a failed check where it did not come. */
async function until(page, fits, what, timeout = 12000) {
	const v = await settle(page, fits, timeout)
	check(fits(v), `${what}: still ${JSON.stringify({ search: v.search, focus: v.focus, layers: v.layers, shown: v.shown, transform: v.transform, pointing: v.pointing })}`)
	return v
}
/**
 * The TV shows the screen of an address: the address is there and so is the screen. The address changes at the
 * press and the screen is drawn a moment later; a key pressed in between would still be the screen before's.
 */
const shows = (search) => (s) => s.search === search && s.items.some((id) => (/[?&]tv=/.test(search) ? id === "bar:back" : id.startsWith("app:") || id.startsWith("menu:")))
/** The desktop's Remote is at rest: leaning back 12 degrees and nothing else. */
const resting = (v) => v.rz === 0 && v.rx === 12 && v.ry === 0 && v.tx === 0 && v.ty === 0
const middle = async (page, selector) => {
	const b = await page.locator(selector).first().boundingBox()
	return [b.x + b.width / 2, b.y + b.height / 2]
}
const item = (id) => `#room [data-tv-screen] [data-tv-item="${id}"]`
/** A key of either Remote, by its name: the label of a key with an icon, or the word on the OK key. */
const remoteKey = (page, label) =>
	label === "OK"
		? page.locator('#room [aria-label="Remote control"] button', { hasText: /^OK$/ })
		: page.locator(`#room [aria-label="Remote control"] button[aria-label="${label}"]`)
/** A finger, sent event by event. */
const finger = (cdp) => (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" || type === "touchCancel" ? [] : [{ x, y, id: 1 }] })
const near = (a, b, within) => a !== null && Math.abs(a - b) <= within

/** Pointing's code is there and running. The first interaction asks for it. */
async function started(page, what) {
	await until(page, (v) => v.pointing === "live", `${what}: pointing runs once its code has come`, 30000)
}

// ---------------------------------------------------------------------------------------------------------
// The mouse, with the Remote under the TV.

async function mouse(who, url) {
	const member = who === "member"
	where = `${who} ${DESKTOP.join("x")} mouse`
	console.log(where)
	const { ctx, page, code, quiet } = await open(url, DESKTOP)
	const home = member ? "?member=six" : ""
	const at = (tv) => (member ? `?member=six&${tv}` : `?${tv}`)

	// ---- Before anyone has used the page: no code for pointing, no ring, the system cursor.
	let v = await look(page)
	is(v.place, "below", "the Remote is under the TV")
	is(code().length, 0, "pointing's code is not asked for before the first interaction")
	is([v.pointing, v.shown, v.opacity], [null, false, 0], "nothing points yet and the ring is not shown")
	check(v.cursor !== "none", `the system cursor shows over the picture until the TV draws its own: ${v.cursor}`)
	check(v.rz === 0 && v.rx === 12, `the Remote rests, leaning back 12 degrees: ${v.transform}`)
	// Where its OK key is while it rests: that is where a hand goes for it.
	const [okX, okY] = await middle(page, "#room [data-remote] .remote-ok")

	// ---- The ring over the picture.
	const [cx, cy] = [v.tv.left + v.tv.width * 0.5, v.tv.top + v.tv.height * 0.3]
	await page.mouse.move(cx - 60, cy, { steps: 4 })
	await started(page, "a mouse move")
	check(code().length >= 1, "the first interaction asked for pointing's code")
	await page.mouse.move(cx, cy, { steps: 4 })
	v = await until(page, (s) => s.shown && s.opacity > 0.95, "the ring appears over the TV")
	is(v.cursor, "none", "the system cursor is hidden over the picture")
	check(near(v.x, cx, 3) && near(v.y, cy, 3), `the ring is where the cursor is: ${v.x}, ${v.y} against ${cx}, ${cy}`)
	is(v.small, false, "the desktop's ring is the full size")
	const outside = await page.evaluate(() => getComputedStyle(document.querySelector("#room [data-remote]")).cursor)
	check(outside !== "none", `outside the picture the system cursor shows: ${outside}`)

	const second = "app:discover"
	const [dx, dy] = await middle(page, item(second))
	await page.mouse.move(dx, dy, { steps: 6 })
	v = await until(page, (s) => s.focus === second && s.over, "the item under the ring takes the focus, and the ring closes around its dot")
	is(v.search, home, "pointing at an item does not open it")
	v = await settle(page, (s) => near(s.x, dx, 2) && near(s.y, dy, 2))
	check(near(v.x, dx, 2) && near(v.y, dy, 2), "the ring arrives where the cursor is")
	await page.mouse.click(dx, dy)
	v = await until(page, (s) => shows(at("tv=discover"))(s), "a click is OK")

	// ---- A key hides it, movement brings it back, and it fades by itself.
	await page.keyboard.press("Escape")
	v = await until(page, (s) => shows(home)(s) && !s.shown, "the ring hides when a key is used, and Escape went back")
	await page.mouse.move(cx + 40, cy + 10, { steps: 3 })
	v = await until(page, (s) => s.shown, "the ring comes back on movement")
	const since = Date.now()
	v = await until(page, (s) => !s.shown, "the ring fades without movement")
	const faded = (Date.now() - since) / 1000
	check(faded >= 2.6 && faded <= 6 && v.cursor === "none", `it fades after 3.2 s, and the system cursor stays hidden over the picture: ${faded.toFixed(1)} s, ${v.cursor}`)

	// ---- The Remote swings toward the cursor.
	const corner = async (x, y) => {
		await page.mouse.move(x, y, { steps: 8 })
		return arrived(page)
	}
	const [w, h] = DESKTOP
	const tl = await corner(16, 80)
	const tr = await corner(w - 30, 80)
	const bl = await corner(16, h - 16)
	const br = await corner(w - 30, h - 16)
	check(tl.rz < -30 && tr.rz > 30 && bl.rz < -30 && br.rz > 30, `the Remote swings far toward each corner: ${[tl, tr, bl, br].map((c) => c.rz)}`)
	check([tl, tr, bl, br].every((c) => Math.abs(c.rz) <= 42), "and no further than 42 degrees")
	check(tl.rx > bl.rx + 1 && tr.rx > br.rx + 1, `it leans back further for the top corners than for the bottom ones: ${[tl, tr, bl, br].map((c) => c.rx)}`)
	check(tl.ry < 0 && tr.ry > 0, "it rolls toward the cursor's side")
	check([tl, tr, bl, br].every((c) => c.streaming <= c.scene.bottom), `the streaming row stays in the room while the Remote is turned: ${[tl, tr, bl, br].map((c) => Math.round(c.streaming))} of ${tl.scene.bottom}`)
	check([tl, tr, bl, br].every((c) => !c.shown), "no ring while the cursor is off the picture")
	numbers.swing = { topLeft: tl.rz, topRight: tr.rz, bottomLeft: bl.rz, bottomRight: br.rz, lean: [tl.rx, tr.rx, bl.rx, br.rx] }

	// It follows the cursor over the site's header too.
	await page.mouse.move(200, 20, { steps: 6 })
	v = await arrived(page)
	check(v.rz < -30, `the Remote follows the cursor over the site's header: ${v.rz}`)

	// ---- Over its own keys it settles, and they work.
	await page.mouse.move(okX, okY, { steps: 8 })
	v = await until(page, resting, "over its own keys the Remote settles at rest")
	check(await page.evaluate(([x, y]) => Boolean(document.elementFromPoint(x, y)?.closest(".remote-ok")), [okX, okY]), "and the key is under the cursor, where it was")
	await page.mouse.move(cx, cy, { steps: 6 })
	await until(page, (s) => s.shown, "(the ring is out again)")
	const before = (await look(page)).focus
	await remoteKey(page, "Next").click()
	v = await until(page, (s) => s.focus !== before && !s.shown, "a key of the Remote moves the focus and hides the ring")
	v = await until(page, resting, "and leaves the Remote at rest")

	// ---- The cursor leaves the window.
	await page.mouse.move(300, 300, { steps: 4 })
	await page.waitForTimeout(300)
	await page.evaluate(() => document.documentElement.dispatchEvent(new MouseEvent("mouseleave")))
	v = await until(page, resting, "the Remote is at rest after the cursor left the window")

	if (!member) {
		// ---- Nothing else moves: over the room, away from the TV, the page changes only the Remote's transform.
		await page.mouse.move(120, 700, { steps: 3 })
		await page.evaluate(() => {
			window.__seen = []
			window.__watch = new MutationObserver((records) => {
				for (const r of records) window.__seen.push(`${r.type} ${r.attributeName ?? ""} ${r.target.nodeType === 1 ? (r.target.getAttribute("data-remote") !== null ? "remote" : r.target.getAttribute("data-tv-pointer") !== null ? "ring" : r.target.tagName) : "text"}`)
			})
			window.__watch.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true })
		})
		for (const [x, y] of [[300, 900], [900, 1000], [1700, 880], [1500, 980], [200, 820]]) await page.mouse.move(x, y, { steps: 12 })
		await page.waitForTimeout(600)
		const seen = await page.evaluate(() => {
			window.__watch.disconnect()
			return [...new Set(window.__seen)]
		})
		is(seen, ["attributes style remote"], "following the cursor over the room changes the Remote's transform and nothing else in the page")

		// ---- The menu: the ring points at its items, and the screen under it takes none.
		await page.keyboard.press("m")
		await until(page, (s) => s.layers === 2, "(the menu opens)")
		const [mx, my] = await middle(page, item("menu:about"))
		await page.mouse.move(mx, my, { steps: 6 })
		v = await until(page, (s) => s.focus === "menu:about" && s.over && s.shown, "over the menu the ring points at the menu's items")
		const [ux, uy] = await page.evaluate(() => {
			const b = document.querySelector('#room [data-tv-item="app:tonight"]').getBoundingClientRect()
			return [b.left + 12, b.top + 12]
		})
		await page.mouse.move(ux, uy, { steps: 6 })
		v = await settle(page, (s) => !s.over)
		is([v.over, v.focus], [false, "menu:about"], "an item under the menu takes no focus, and the ring is open over it")
		await page.keyboard.press("Escape")
		await until(page, (s) => s.layers === 1, "(the menu closes)")

		// ---- Off: no ring, the system cursor, the Remote at rest. On again, it points again.
		await remoteKey(page, "Turn off").click()
		await until(page, (s) => s.power === "off" && s.pointing === "idle", "with the TV off pointing waits")
		await page.mouse.move(cx, cy, { steps: 5 })
		await page.waitForTimeout(700)
		v = await look(page)
		check(!v.shown && v.cursor !== "none" && resting(v), `a dark TV draws no ring, shows the system cursor and leaves the Remote at rest: ${v.shown} ${v.cursor} ${v.transform}`)
		await page.keyboard.press("Enter")
		await until(page, (s) => s.pointing === "live", "the TV is on again and pointing runs", 15000)
		await page.mouse.move(cx + 30, cy + 20, { steps: 5 })
		await until(page, (s) => s.shown, "and the ring is back")

		// ---- Below the room: the room is away and nothing points.
		await page.locator(".lrb-lip").click()
		await until(page, (s) => s.away && s.pointing === "idle", "below the room pointing waits", 20000)
		await page.mouse.move(600, 300, { steps: 6 })
		await page.waitForTimeout(600)
		v = await look(page)
		check(!v.shown && resting(v), `away, the cursor moves no ring and no Remote: ${v.shown} ${v.transform}`)
		await page.locator(".lrb-back").first().click()
		await until(page, (s) => !s.away && s.scrolled === 0 && s.pointing === "live", "back in the room it points again", 20000)
	}
	is(quiet(), [], "nothing in the console")
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// The mouse, with the Remote beside the TV: it only nods.

async function beside() {
	where = `guest ${BESIDE.join("x")} mouse`
	console.log(where)
	const { ctx, page, quiet } = await open(GUEST, BESIDE)
	let v = await look(page)
	is(v.place, "beside", "the Remote is beside the TV")
	await page.mouse.move(400, 300, { steps: 4 })
	await started(page, "a mouse move")
	const corner = async (x, y) => {
		await page.mouse.move(x, y, { steps: 8 })
		return arrived(page)
	}
	const [w, h] = BESIDE
	const tl = await corner(16, 80)
	const tr = await corner(w - 30, 80)
	const bl = await corner(16, h - 16)
	const br = await corner(w - 30, h - 16)
	const all = [tl, tr, bl, br]
	check(tl.rz < -8 && tr.rz > 1 && bl.rz < -8 && br.rz > 8, `the Remote nods left for the left corners and right for the right ones: ${all.map((c) => c.rz)}`)
	check(all.every((c) => Math.abs(c.rz) <= 13.01), "and never turns further than its nod of 13 degrees")
	check(Math.abs(tl.ry) > 16 && Math.abs(tl.ry) <= 26, `it rolls more instead: ${tl.ry}`)
	check(all.every((c) => c.body.left >= c.tv.right), `nodding, the Remote never reaches the picture: ${all.map((c) => Math.round(c.body.left - c.tv.right))} px between them`)
	numbers.nod = { topLeft: tl.rz, topRight: tr.rz, bottomLeft: bl.rz, bottomRight: br.rz, roll: tl.ry, gap: all.map((c) => +(c.body.left - c.tv.right).toFixed(1)) }
	// Across the picture too, where it points most of the time.
	for (const [fx, fy] of [[0.1, 0.15], [0.5, 0.5], [0.1, 0.9], [0.95, 0.9]]) {
		const c = await corner(tl.tv.left + tl.tv.width * fx, tl.tv.top + tl.tv.height * fy)
		check(c.shown && c.rz < 0 && c.body.left >= c.tv.right, `pointing at the picture (${fx}, ${fy}) the Remote nods toward it and stays beside it: ${c.rz}, ${Math.round(c.body.left - c.tv.right)} px`)
	}
	await page.evaluate(() => document.documentElement.dispatchEvent(new MouseEvent("mouseleave")))
	await until(page, resting, "the Remote is at rest after the cursor left the window")
	is(quiet(), [], "nothing in the console")
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// A finger on the phone.

async function touching(who, url, size, form) {
	const member = who === "member"
	where = `${who} ${size.join("x")} finger`
	console.log(where)
	const { ctx, page, cdp, code, quiet } = await open(url, size)
	const touch = finger(cdp)
	const home = member ? "?member=six" : ""
	const at = (tv) => (member ? `?member=six&${tv}` : `?${tv}`)
	const back = async (what = "(back)") => {
		await remoteKey(page, "Back").tap()
		return until(page, (s) => shows(home)(s) && s.layers === 1, what)
	}
	const rested = (s) => !s.shown && s.flat

	let v = await look(page)
	is([v.room, v.form], ["phone", form], `the phone's room, the Remote ${form === "hand" ? "in the hand" : "on the table"}`)
	is(code().length, 0, "pointing's code is not asked for before the first interaction")
	is([v.pointing, v.shown, v.flat], [null, false, true], "nothing points yet")

	// ---- The very first tap comes before pointing's code: it opens what it lands on, as a tap always did.
	let [x, y] = await middle(page, item("app:discover"))
	await page.touchscreen.tap(x, y)
	await until(page, (s) => shows(at("tv=discover"))(s), "the first tap opens the app it lands on")
	await started(page, "the first tap")
	check(code().length >= 1, "and asked for pointing's code")
	await back("Back on the Remote returns")

	// ---- A tap.
	;[x, y] = await middle(page, item("app:discover"))
	// A tap is short: the finger is up again before a long press begins. The ring and the Remote stay out a moment longer.
	await page.touchscreen.tap(x, y)
	v = await settle(page, (s) => s.shown && !s.flat)
	check(v.shown && near(v.x, x, 14) && near(v.y, y, 14), `a tap shows the ring where the finger landed: ${v.x}, ${v.y} against ${x}, ${y}`)
	check(!v.flat, `and the Remote aims at it: ${v.transform}`)
	is(v.small, true, "the phone's ring is the smaller one")
	await until(page, (s) => shows(at("tv=discover"))(s), "the tapped app opens")
	v = await until(page, rested, "then the ring is gone and the Remote back at rest, without a transform")
	is(v.transform, "none", "at rest the Remote has no transform, so its keys are hit where they are drawn")
	await back()
	v = await look(page)
	check(rested(v), `a key of the Remote works as before and neither aims the Remote nor shows the ring: ${v.shown} ${v.transform}`)

	// ---- A press held still for a second, on an item with another one above it: the ring stays under the finger.
	await remoteKey(page, "Menu").tap()
	await until(page, (s) => s.layers === 2, "(the menu opens)")
	const [x2, y2] = await middle(page, item("menu:search"))
	const [, yAbove] = await middle(page, item("menu:home"))
	check(yAbove < y2 - 30, "(the menu's Search has Home above it)")
	await touch("touchStart", x2, y2)
	await page.waitForTimeout(1000)
	v = await look(page)
	check(v.shown && !v.hold && near(v.x, x2, 14) && near(v.y, y2, 14), `a press held still for a second keeps the ring under the finger: ${v.x}, ${v.y} against ${x2}, ${y2}`)
	is(v.focus, "menu:search", "and the pressed item has the focus")
	await touch("touchEnd")
	await until(page, (s) => shows(at("tv=search"))(s) && s.layers === 1, "letting go opens the item that was pressed, not the one above it")
	await settle(page, rested)
	await back()

	// ---- A drag, from one app to the next. Once the finger has moved more than 10 px the ring steps out above it.
	const [ax, ay] = await middle(page, item("app:tonight"))
	const [bx, by] = await middle(page, item("app:discover"))
	await touch("touchStart", ax, ay + 46)
	await page.waitForTimeout(150)
	v = await look(page)
	check(v.shown && !v.hold && near(v.y, ay + 46, 14), "(before it moves, the ring is under the finger)")
	await touch("touchMove", ax + 6, ay + 46)
	v = await look(page)
	check(!v.hold, "6 px of movement is not a drag")
	await touch("touchMove", ax + 14, ay + 46)
	v = await settle(page, (s) => s.hold && near(s.y, ay, 8))
	check(v.shown && v.hold && near(v.x, ax + 14, 14) && near(v.y, ay, 14), `once the finger drags, the ring steps out 46 px above it: ${v.x}, ${v.y} against ${ax + 14}, ${ay}`)
	await until(page, (s) => s.focus === "app:tonight", "the item under the ring has the focus")
	const turned = v.rz
	for (let i = 1; i <= 8; i++) {
		await touch("touchMove", ax + 14 + ((bx - ax - 14) * i) / 8, ay + 46 + ((by - ay) * i) / 8)
		await page.waitForTimeout(40)
	}
	await until(page, (s) => s.focus === "app:discover", "dragged, the focus goes where the ring goes")
	v = await settle(page, (s) => near(s.x, bx, 16) && near(s.y, by, 16) && Math.abs(s.rz - turned) > 0.4)
	check(near(v.x, bx, 16) && near(v.y, by, 16), `the ring follows the finger: ${v.x}, ${v.y} against ${bx}, ${by}`)
	check(Math.abs(v.rz - turned) > 0.4, `and the Remote follows it: ${turned} to ${v.rz}`)
	check(form === "table" ? v.rx === 0 : v.rx > 3, form === "table" ? `lying, the Remote turns on the table and does not lean: ${v.rx}` : `held, the Remote leans back toward the picture: ${v.rx}`)
	check(v.body.top >= v.tvBody.bottom - 1, `turned, the Remote stays under the TV: ${v.body.top} against ${v.tvBody.bottom}`)
	is([v.scrolled, v.selected], [0, ""], "the drag scrolls nothing and selects nothing")
	check(
		await page.evaluate(() => {
			const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true })
			document.querySelector("#room [data-tv-screen] [data-tv-item]").dispatchEvent(e)
			return e.defaultPrevented
		}),
		"a held finger opens no menu",
	)
	is(v.search, home, "nothing has opened while the finger is down")
	await touch("touchEnd")
	await until(page, (s) => shows(at("tv=discover"))(s), "letting go opens the app under the ring")
	await until(page, rested, "and both return to rest")
	await back()

	// ---- The whole picture: wherever the finger points, the turned Remote stays under the TV.
	v = await look(page)
	const { tv } = v
	let lowest = Number.POSITIVE_INFINITY
	let most = 0
	for (const [fx, fy] of [[0.04, 0.05], [0.5, 0.05], [0.96, 0.05], [0.04, 0.45], [0.96, 0.45]]) {
		await touch("touchStart", tv.left + tv.width * fx, tv.top + tv.height * fy)
		const s = await arrived(page)
		lowest = Math.min(lowest, s.body.top - s.tvBody.bottom)
		most = Math.max(most, Math.abs(s.rz))
		await touch("touchCancel")
		await settle(page, rested)
	}
	check(lowest >= -1, `pointing at the picture's corners and sides, the Remote stays under the TV: ${lowest.toFixed(1)} px clear at the least`)
	check(most <= (form === "hand" ? 11.01 : 3.51) && most > (form === "hand" ? 8 : 2), `it turns ${form === "hand" ? 11 : 3.5} degrees at most: ${most}`)
	numbers[`phone ${size.join("x")} ${who}`] = { form, mostTurn: most, clearOfTv: +lowest.toFixed(1) }

	// ---- A drag let go over nothing.
	await touch("touchStart", tv.left + tv.width * 0.5, tv.top + tv.height * 0.25 + 46)
	await page.waitForTimeout(500)
	await touch("touchMove", tv.left + tv.width * 0.3, tv.top + tv.height * 0.2 + 46)
	await page.waitForTimeout(400)
	v = await look(page)
	check(v.shown && v.hold && !v.over, "dragged over no item, the ring is out and open")
	await touch("touchEnd")
	await page.waitForTimeout(500)
	v = await look(page)
	is(v.search, home, "let go over nothing, nothing opens")
	await until(page, rested, "and both return to rest")

	// ---- A finger that leaves the picture points at nothing.
	;[x, y] = await middle(page, item("app:tonight"))
	await touch("touchStart", x, y)
	await page.waitForTimeout(200)
	await touch("touchMove", x, y + 40)
	await touch("touchMove", x, tv.bottom + 46 + 60)
	v = await settle(page, (s) => !s.shown)
	check(!v.shown, "a finger that left the picture by more than 24 px points at nothing")
	await touch("touchEnd")
	await page.waitForTimeout(400)
	is((await look(page)).search, home, "and letting go there opens nothing")

	// ---- A tap beside the open menu closes it, as before.
	await remoteKey(page, "Menu").tap()
	await until(page, (s) => s.layers === 2, "(the menu opens)")
	await page.touchscreen.tap(tv.left + 14, tv.top + 14)
	await until(page, (s) => s.layers === 1 && shows(home)(s), "a tap beside the menu closes it")
	await settle(page, rested)

	// ---- Nothing scrolls: a finger drags up on the TV and on the Remote, then the page is told to scroll.
	for (const fy of [tv.top + tv.height * 0.5, size[1] - 150]) await cdp.send("Input.synthesizeScrollGesture", { x: size[0] / 2, y: fy, yDistance: -300, gestureSourceType: "touch", speed: 1600 }).catch(() => {})
	await page.waitForTimeout(400)
	v = await look(page)
	is([v.scrolled, v.away], [0, false], "nothing scrolls under a finger that drags up on the TV or on the Remote")

	is(quiet(), [], "nothing in the console")
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// The phone in landscape: the TV on the left, the Remote on the right. It turns about its grip toward the spot.

/** The pixels of a strip of the page that differ between two screenshots of it, in the screenshot's own pixels. */
async function differs(page, a, b) {
	return page.evaluate(
		async ([a, b]) => {
			const height = async (src) => {
				const img = new Image()
				img.src = `data:image/png;base64,${src}`
				await img.decode()
				return img.height
			}
			const pixels = async (src) => {
				const img = new Image()
				img.src = `data:image/png;base64,${src}`
				await img.decode()
				const canvas = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height })
				const g = canvas.getContext("2d")
				g.drawImage(img, 0, 0)
				return g.getImageData(0, 0, img.width, img.height).data
			}
			const [p, q] = [await pixels(a), await pixels(b)]
			const width = Math.round(p.length / 4 / (await height(a)))
			const at = []
			for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]) > 36) at.push([(i / 4) % width, Math.floor(i / 4 / width)])
			return at
		},
		[a.toString("base64"), b.toString("base64")],
	)
}

async function landscape(size) {
	where = `guest ${size.join("x")} landscape`
	console.log(where)
	const { ctx, page, cdp, quiet } = await open(GUEST, size)
	const touch = finger(cdp)
	const rested = (s) => !s.shown && s.flat
	let v = await look(page)
	// Under 768 px of width the room is not the whole window: the site's header and dock leave it too short to
	// hold the Remote, which lies on the table there.
	const form = size[0] >= 768 ? "hand" : "table"
	is([v.room, v.form], ["landscape", form], `the room is the landscape one, the Remote ${form === "hand" ? "in the hand" : "on the table"}`)
	check(v.tv.right < v.body.left, "the TV is on the left and the Remote on the right")
	const { tv } = v

	// ---- The first tap, then pointing runs.
	let [x, y] = await middle(page, item("app:tonight"))
	await page.touchscreen.tap(x, y)
	await until(page, (s) => shows("?tv=tonight")(s), "the first tap opens the app it lands on")
	await started(page, "the first tap")
	await remoteKey(page, "Back").tap()
	await until(page, (s) => shows("")(s), "Back on the Remote returns")
	await until(page, rested, "(at rest)")

	// ---- Every key is hit by a tap where it is drawn.
	const keys = await page.evaluate(() =>
		[...document.querySelectorAll('#room [aria-label="Remote control"] button')].map((el) => {
			const b = el.getBoundingClientRect()
			const at = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
			return { name: el.getAttribute("aria-label") ?? el.textContent, w: b.width, h: b.height, hit: at === el || el.contains(at), inside: b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight }
		}),
	)
	is(keys.length, 11, "the Remote has its 11 keys")
	check(keys.every((k) => k.hit && k.inside && k.w >= 44 - 0.01 && k.h >= 44 - 0.01), `every key is 44 px or more, inside the window and under nothing: ${JSON.stringify(keys.filter((k) => !(k.hit && k.inside && k.w >= 44 - 0.01 && k.h >= 44 - 0.01)))}`)
	for (const [label, fits, what] of [
		["Next", (s) => s.focus === "app:discover", "Next moves the focus"],
		["Previous", (s) => s.focus === "app:tonight", "Previous moves it back"],
		["Up", (s) => s.focus?.startsWith("bar:"), "Up reaches the top bar"],
		["Down", (s) => s.focus?.startsWith("app:"), "Down returns to the apps"],
		["Menu", (s) => s.layers === 2, "Menu opens the menu"],
		["Back", (s) => s.layers === 1, "Back closes it"],
		["Search", (s) => shows("?tv=search")(s), "Search opens search"],
		["Home", (s) => shows("")(s), "Home goes home"],
	]) {
		await remoteKey(page, label).tap()
		await until(page, fits, `a tap on ${label}: ${what}`)
	}
	v = await look(page)
	check(rested(v), `the keys neither aim the Remote nor show the ring: ${v.shown} ${v.transform}`)

	// ---- A tap on the picture.
	;[x, y] = await middle(page, item("app:tonight"))
	await page.touchscreen.tap(x, y)
	v = await settle(page, (s) => s.shown && !s.flat)
	check(v.shown && near(v.x, x, 14) && near(v.y, y, 14), "a tap shows the ring where the finger landed")
	check(v.rz < 0, `and the Remote turns toward it: ${v.transform}`)
	await until(page, (s) => shows("?tv=tonight")(s), "the tapped app opens")
	v = await until(page, rested, "then the ring is gone and the Remote back at rest")
	is(v.transform, "none", "at rest it has no transform, so its keys are hit where they are drawn")
	await remoteKey(page, "Back").tap()
	await until(page, (s) => shows("")(s), "(back)")

	// ---- Wherever a held finger points, the Remote turns toward it and its top never crosses the picture.
	const spots = []
	for (const fy of [0.06, 0.35, 0.65, 0.94]) for (const fx of [0.04, 0.3, 0.6, 0.96]) spots.push([fx, fy])
	const held = {}
	for (const [fx, fy] of spots) {
		await touch("touchStart", tv.left + tv.width * fx, tv.top + tv.height * fy)
		held[`${fx},${fy}`] = await arrived(page)
		await touch("touchCancel")
		await settle(page, rested)
	}
	const all = Object.values(held)
	check(all.every((s) => s.shown && s.rz < 0), `for every spot the ring is out and the Remote turns to the left: ${all.map((s) => s.rz)}`)
	const gap = Math.min(...all.map((s) => s.body.left - s.tv.right))
	check(gap >= 0, `the turned Remote's body never crosses the picture's edge: ${gap.toFixed(1)} px clear at the least`)
	check(all.every((s) => s.body.top >= s.scene.top), "nor the room's top edge")
	const most = Math.max(...all.map((s) => -s.rz))
	const least = Math.min(...all.map((s) => -s.rz))
	if (form === "hand") {
		check(most >= 17 && most <= 22.01 && least >= 3 && least < most - 6, `it turns between ${least} and ${most} degrees across the picture`)
		check(-held["0.04,0.65"].rz > -held["0.96,0.65"].rz + 0.5 && -held["0.04,0.06"].rz > -held["0.96,0.06"].rz + 2, "further for a spot further left")
		check(-held["0.6,0.94"].rz > -held["0.6,0.06"].rz + 2, "and further for a spot lower down, where the angle from the grip is larger")
		check(held["0.3,0.06"].rx > held["0.3,0.94"].rx + 2, `it leans back further for a spot higher up: ${held["0.3,0.06"].rx} against ${held["0.3,0.94"].rx}`)
		check(held["0.04,0.35"].ry < held["0.96,0.35"].ry - 2 && held["0.96,0.35"].ry < 0, `and rolls toward the TV's side for a spot further left: ${held["0.04,0.35"].ry} against ${held["0.96,0.35"].ry}`)
	} else {
		check(most <= 3.51 && least > 1, `lying, it only shifts on the table: between ${least} and ${most} degrees`)
		check(all.every((s) => s.rx === 0 && s.ry === 0), "and neither leans nor rolls")
	}
	numbers[`landscape ${size.join("x")}`] = { picture: `${Math.round(tv.width)} x ${Math.round(tv.height)}`, turn: [least, most], clearOfPicture: +gap.toFixed(1) }

	// ---- Nothing of the Remote or the hand is drawn over the picture: its right edge looks the same turned as at rest.
	await page.addStyleTag({ content: "[data-tv-pointer] { visibility: hidden !important; }" })
	// The picture's right 70 px, without its rounded corners (3 px), where the TV's bezel shows.
	const strip = { x: Math.floor(tv.right) - 70, y: Math.ceil(tv.top) + 4, width: 70, height: Math.floor(tv.height) - 8 }
	// On the first app, low on the left, where it turns furthest. Once before, so the app has the focus and the
	// TV shows the same at rest as under the finger.
	await remoteKey(page, "Home").tap()
	for (let i = 0; i < 4; i++) await remoteKey(page, "Previous").tap()
	await until(page, (s) => s.focus === "app:tonight", "(the focus is on the first app)")
	await page.waitForTimeout(1500)
	;[x, y] = await middle(page, item("app:tonight"))
	const calm = await page.screenshot({ clip: strip, type: "png" })
	await touch("touchStart", x, y)
	await page.waitForTimeout(800)
	v = await look(page)
	const turnedShot = await page.screenshot({ clip: strip, type: "png" })
	await touch("touchCancel")
	const changed = await differs(page, calm, turnedShot)
	check(-v.rz > most - 4, `(the Remote is turned for the picture: ${v.rz})`)
	is(changed.slice(0, 12), [], `turned as far as it goes, no pixel of the picture's right edge has changed (a strip ${strip.width} x ${strip.height}): the Remote and the hand stay off it`)
	await page.addStyleTag({ content: "[data-tv-pointer] { visibility: visible !important; }" })
	await settle(page, rested)

	// ---- A drag, as in portrait.
	// The finger lands on the first app and goes down under it, off the picture if it must: the ring stays on the app.
	const [ax, ay] = await middle(page, item("app:tonight"))
	const [bx, by] = await middle(page, item("app:discover"))
	await touch("touchStart", ax, ay)
	await page.waitForTimeout(150)
	await touch("touchMove", ax, ay + 20)
	await touch("touchMove", ax, ay + 46)
	v = await settle(page, (s) => s.hold && near(s.y, ay, 8))
	check(v.shown && v.hold && near(v.x, ax, 14) && near(v.y, ay, 14), `once the finger drags, the ring steps out 46 px above it: ${v.x}, ${v.y} against ${ax}, ${ay}`)
	await until(page, (s) => s.focus === "app:tonight", "the item under the ring has the focus")
	const turned = v
	for (let i = 1; i <= 8; i++) {
		await touch("touchMove", ax + ((bx - ax) * i) / 8, ay + 46 + ((by - ay) * i) / 8)
		await page.waitForTimeout(40)
	}
	await until(page, (s) => s.focus === "app:discover", "dragged, the focus goes where the ring goes")
	v = await settle(page, (s) => near(s.x, bx, 16) && (form === "table" || s.ry > turned.ry + 0.3))
	check(near(v.x, bx, 16) && near(v.y, by, 16), `the ring follows the finger: ${v.x}, ${v.y} against ${bx}, ${by}`)
	// Both apps are level with the grip, a quarter turn away: the turn stays, the roll follows the finger.
	if (form === "hand") check(v.ry > turned.ry + 0.3 && v.rz < -10, `and the Remote follows it, rolling back for a spot nearer to it: ${turned.ry} to ${v.ry}`)
	else check(v.rz < 0 && v.body.left >= v.tv.right, `and the lying Remote stays shifted toward it: ${v.rz}`)
	is([v.scrolled, v.selected], [0, ""], "the drag scrolls nothing and selects nothing")
	await touch("touchEnd")
	await until(page, (s) => shows("?tv=discover")(s), "letting go opens the app under the ring")
	await until(page, rested, "and both return to rest")
	await remoteKey(page, "Back").tap()
	await until(page, (s) => shows("")(s), "(back)")

	// ---- Going below and back with the lip.
	if (size[0] >= 768) {
		await page.locator(".lrb-lip").tap()
		await until(page, (s) => s.hash === "#browse" && s.pointing === "idle", "below the room, by the lip, pointing waits", 20000)
		await page.locator(".lrb-back").first().tap()
		await until(page, (s) => s.hash === "" && !s.away && s.pointing === "live", "back in the room it points again", 20000)
		// The room slides back into the window: the app is tapped once it stands still.
		for (let before = null; ; ) {
			;[x, y] = await middle(page, item("app:explorer"))
			if (before && before[0] === x && before[1] === y) break
			before = [x, y]
			await page.waitForTimeout(250)
		}
		await page.touchscreen.tap(x, y)
		await until(page, (s) => shows("?tv=explorer")(s), "and a tap opens an app")
	}
	is(quiet(), [], "nothing in the console")
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// Reduced motion, a touch screen in the room, and the mouse on a phone in landscape.

async function others() {
	// ---- Reduced motion, the mouse.
	where = "guest 1920x1080 reduced motion"
	console.log(where)
	{
		const { ctx, page, quiet } = await open(GUEST, DESKTOP, { reducedMotion: "reduce" })
		let v = await look(page)
		const [cx, cy] = [v.tv.left + v.tv.width * 0.5, v.tv.top + v.tv.height * 0.3]
		await page.mouse.move(cx - 80, cy, { steps: 4 })
		await started(page, "a mouse move")
		await page.mouse.move(cx, cy, { steps: 3 })
		v = await until(page, (s) => s.shown, "the ring shows")
		is(v.fade, "0s", "it appears and goes without a fade")
		check(near(v.x, cx, 0.2) && near(v.y, cy, 0.2), `and is drawn without lag, at the cursor: ${v.x}, ${v.y}`)
		check(resting(v), `the Remote does not aim: ${v.transform}`)
		await page.mouse.move(30, 100, { steps: 6 })
		await page.waitForTimeout(500)
		v = await look(page)
		check(resting(v), `nor for a corner: ${v.transform}`)
		const [dx, dy] = await middle(page, item("app:explorer"))
		await page.mouse.move(dx, dy, { steps: 4 })
		await until(page, (s) => s.focus === "app:explorer" && s.over, "the item under the ring takes the focus")
		await page.mouse.click(dx, dy)
		await until(page, (s) => shows("?tv=explorer")(s), "and a click is OK")
		is(quiet(), [], "nothing in the console")
		await ctx.close()
	}
	// ---- Reduced motion, a finger.
	where = "guest 390x844 reduced motion"
	console.log(where)
	{
		const { ctx, page, cdp, quiet } = await open(GUEST, PHONE, { reducedMotion: "reduce" })
		const touch = finger(cdp)
		let [x, y] = await middle(page, item("bar:search"))
		await page.touchscreen.tap(x, y)
		await until(page, (s) => shows("?tv=search")(s), "(the first tap opens search)")
		await started(page, "the first tap")
		await remoteKey(page, "Home").tap()
		await until(page, (s) => shows("")(s), "(home)")
		;[x, y] = await middle(page, item("app:discover"))
		await touch("touchStart", x, y)
		await page.waitForTimeout(250)
		let v = await look(page)
		check(v.shown && near(v.x, x, 1) && near(v.y, y, 1), "a press shows the ring under the finger at once")
		is(v.flat, true, "and the Remote stays still")
		await touch("touchMove", x + 6, y)
		await touch("touchMove", x + 14, y)
		await page.waitForTimeout(60)
		v = await look(page)
		check(v.hold && near(v.y, y - 46, 1), `dragged, the ring steps out above the finger at once: ${v.y} against ${y - 46}`)
		is(v.flat, true, "the Remote still does not move")
		await touch("touchCancel")
		await page.touchscreen.tap(x, y)
		await until(page, (s) => shows("?tv=discover")(s), "a tap opens the app")
		is(quiet(), [], "nothing in the console")
		await ctx.close()
	}
	// ---- The room on a touch screen: a finger on the picture points too, with the Remote in the hand.
	where = "guest 1920x1080 touch screen"
	console.log(where)
	{
		const { ctx, page, quiet } = await open(GUEST, DESKTOP, { touch: false, hasTouch: true })
		let v = await look(page)
		is(v.place, "below", "the Remote is in the hand under the TV")
		let [x, y] = await middle(page, item("bar:menu"))
		await page.touchscreen.tap(x, y)
		await until(page, (s) => s.layers === 2, "(the first tap opens the menu)")
		await started(page, "the first tap")
		await page.keyboard.press("Escape")
		await until(page, (s) => s.layers === 1, "(and Escape closes it)")
		;[x, y] = await middle(page, item("app:tonight"))
		await page.touchscreen.tap(x, y)
		v = await settle(page, (s) => s.shown && s.rz < -3)
		check(v.shown && v.rz < -3, `a finger on the picture shows the ring and turns the Remote in the hand toward it: ${v.rz}`)
		await until(page, (s) => shows("?tv=tonight")(s), "and the app opens")
		await until(page, (s) => !s.shown && resting(s), "then the ring goes and the Remote rests")
		is(quiet(), [], "nothing in the console")
		await ctx.close()
	}
	// ---- A short, wide window with a mouse: the landscape room, and the mouse points there too.
	where = "guest 900x420 mouse"
	console.log(where)
	{
		const { ctx, page, quiet } = await open(GUEST, [900, 420], { touch: false })
		let v = await look(page)
		is(v.room, "landscape", "a short, wide window has the landscape room")
		const { tv } = v
		await page.mouse.move(tv.left + 200, tv.top + 100, { steps: 4 })
		await started(page, "a mouse move")
		await page.mouse.move(tv.left + 60, tv.top + tv.height * 0.6, { steps: 6 })
		v = await until(page, (s) => s.shown && s.rz < -10, "over the picture the ring shows and the Remote turns toward the cursor")
		check(v.body.left >= v.tv.right, "and stays off the picture")
		const [okX, okY] = await middle(page, "#room .remote-ok")
		await page.mouse.move(okX, okY, { steps: 8 })
		v = await until(page, (s) => s.flat && !s.shown, "over its own keys it rests flat, and the ring is gone")
		is(quiet(), [], "nothing in the console")
		await ctx.close()
	}
}

// ---------------------------------------------------------------------------------------------------------
// What pointing costs (the rendering budget, #190): the frames it asks for, the tasks over 50 ms, the idle CPU.

async function budget() {
	for (const [name, args] of [
		["gpu", []],
		["software", ["--disable-gpu"]],
	]) {
		where = `budget ${name}`
		console.log(where)
		const own = await launch(args)
		const { ctx, page, cdp } = await open(GUEST, DESKTOP, { meter: true, on: own })
		const meter = () => page.evaluate(() => ({ ...window.__meter, tasks: [...window.__meter.tasks], scripts: [...window.__meter.scripts] }))
		const reset = () => page.evaluate(() => Object.assign(window.__meter, { frames: 0, longest: 0, total: 0, tasks: [], scripts: [] }))
		const busy = async () => (await cdp.send("Performance.getMetrics")).metrics.find((m) => m.name === "TaskDuration").value
		await cdp.send("Performance.enable")
		const v = await look(page)
		// CONTROL=1: the same measurement with pointing's chunk replaced by an empty one, to tell pointing's cost
		// from the page's own. Against a production build only (the dev server serves modules, not chunks).
		if (process.env.CONTROL) await page.route(/\/assets\/pointing-/, (route) => route.fulfill({ contentType: "text/javascript", body: "export function startPointing(){return{refresh(){},stop(){}}}" }))
		// NOREPLAY=1: the same with the error reporting's session recorder off (its two sample rates set to 0 in
		// the chunk as it is served), to tell what the recorder adds while the Remote moves.
		if (process.env.NOREPLAY)
			await page.route(/\/assets\/sentry-browser-/, async (route) => {
				const response = await route.fetch()
				const body = (await response.text()).replace(/replaysSessionSampleRate:[^,]*,replaysOnErrorSampleRate:[^,}]*/, "replaysSessionSampleRate:0,replaysOnErrorSampleRate:0")
				await route.fulfill({ status: 200, contentType: "text/javascript", body })
			})
		await page.mouse.move(v.tv.left + 100, v.tv.top + 100, { steps: 4 })
		if (process.env.CONTROL) await page.waitForTimeout(1500)
		else await started(page, "a mouse move")
		// Everything a first interaction loads has come and run: the site asks for its telemetry and its navigation's
		// panels about four seconds after it, on every page, and running that code is a task of about 100 ms.
		await page.waitForTimeout(9000)

		// ---- The Remote following the cursor: around the four corners, then twice across the picture over no item
		// (the ring follows there too), for about 6 s. No focus moves: this is pointing alone.
		await reset()
		const from = Date.now()
		const [w, h] = DESKTOP
		const free = v.tv.top + v.tv.height * 0.42
		const path = [[20, 90], [w - 40, 90], [w - 40, h - 20], [20, h - 20], [20, 90], [v.tv.left + 30, free], [v.tv.right - 30, free - 60], [v.tv.left + 30, free - 120], [v.tv.left + 400, free]]
		const focusBefore = (await look(page)).focus
		for (const [x, y] of path) await page.mouse.move(x, y, { steps: 40 })
		const swept = (Date.now() - from) / 1000
		const moving = await meter()
		is((await look(page)).focus, focusBefore, "(the path crossed no item)")
		// A long task that the browser puts down to a script of another file is not pointing's: the site's error
		// reporting listens to the mouse on every page and now and then takes 50 to 80 ms in that listener.
		const others = moving.scripts.filter((script) => !/ in (pointing|home-preview)/.test(script))
		check(moving.tasks.length <= others.length, `the Remote and the ring follow the cursor for ${swept.toFixed(1)} s with no task over 50 ms of their own: ${JSON.stringify(moving.tasks)} ${JSON.stringify(moving.scripts)}`)
		if (others.length) console.log(`  tasks over 50 ms while following, put down to other scripts: ${JSON.stringify(moving.tasks)} ${JSON.stringify(others)}`)
		check(moving.longest <= 10, `no frame of the loop takes more than 10 ms of the main thread: ${moving.longest.toFixed(2)} ms at the most`)

		// ---- At rest: the loop has stopped.
		await page.evaluate(() => document.documentElement.dispatchEvent(new MouseEvent("mouseleave")))
		await page.waitForTimeout(2500)
		await reset()
		const cpu = await busy()
		await page.waitForTimeout(5000)
		const idle = ((await busy()) - cpu) / 5
		const still = await meter()
		is(still.frames, 0, "at rest pointing asks for no frame: the loop has stopped")
		check(idle <= (name === "gpu" ? 0.05 : 0.1), `idle, the page's main thread is busy ${(idle * 100).toFixed(1)}% of a core (the limit is ${name === "gpu" ? 5 : 10}%)`)

		// ---- Ten focus moves by the ring.
		await reset()
		const ids = ["app:tonight", "app:discover", "app:explorer", "app:taste", "app:explorer", "app:discover", "app:tonight", "app:discover", "app:explorer", "app:taste"]
		for (const id of ids) {
			const [x, y] = await middle(page, item(id))
			await page.mouse.move(x, y, { steps: 10 })
			await settle(page, (s) => s.focus === id, 3000)
		}
		await page.waitForTimeout(600)
		const focus = await meter()
		// Not pointing's own cost: a focus move draws the home again and cross-fades its picture (slice 3). A dev
		// server runs React's development build, which is several times slower at it: the number is reported, and
		// it is a check only against a production build (BUILD=1).
		if (process.env.BUILD) check(focus.tasks.length === 0, `ten focus moves by the ring with no task over 50 ms: ${JSON.stringify(focus.tasks)}`)
		else console.log(`  ten focus moves by the ring, tasks over 50 ms on the dev server: ${JSON.stringify(focus.tasks)}`)
		numbers[`budget ${name}${process.env.BUILD ? ", production build" : ", dev server"}${process.env.CONTROL ? ", without pointing" : ""}${process.env.NOREPLAY ? ", recorder off" : ""}`] = {
			following: { seconds: +swept.toFixed(1), frames: moving.frames, longestFrameMs: +moving.longest.toFixed(2), meanFrameMs: +(moving.total / Math.max(1, moving.frames)).toFixed(3), tasksOver50ms: moving.tasks, scriptsOver25ms: moving.scripts },
			atRest: { framesIn5s: still.frames, mainThreadShare: +idle.toFixed(4) },
			tenFocusMovesByTheRing: { frames: focus.frames, longestFrameMs: +focus.longest.toFixed(2), tasksOver50ms: focus.tasks },
		}
		await ctx.close()
		await own.close()
	}
}

// ---------------------------------------------------------------------------------------------------------
// The pictures.

async function shots() {
	where = "shots"
	console.log(where)
	const dir = join(here, "shots")
	mkdirSync(dir, { recursive: true })
	const shot = (page, name) => page.screenshot({ path: join(dir, `${name}.jpg`), quality: 82 })
	/** The finger, drawn by this script: the page does not draw one. */
	const withFinger = async (page) => {
		await page.evaluate(() => {
			const f = document.createElement("div")
			f.id = "finger"
			f.style.cssText = "position:fixed;left:-23px;top:-23px;width:46px;height:46px;border-radius:50%;background:rgba(200,205,215,.5);border:2px solid rgba(255,255,255,.75);z-index:99999;pointer-events:none;opacity:0"
			document.body.appendChild(f)
		})
		return (x, y, on) =>
			page.evaluate(
				([x, y, on]) => {
					const f = document.getElementById("finger")
					f.style.transform = `translate(${x}px, ${y}px)`
					f.style.opacity = on ? "1" : "0"
				},
				[x, y, on],
			)
	}

	// ---- The mouse at 1920 x 1080: the ring and the Remote at six stops, as the prototype's strip has them.
	for (const [who, url] of [
		["guest", GUEST],
		["member", MEMBER],
	]) {
		const { ctx, page } = await open(url, DESKTOP)
		const v = await look(page)
		await page.mouse.move(v.tv.left + 300, v.tv.top + 200, { steps: 4 })
		await settle(page, (s) => s.pointing === "live", 30000)
		const [w, h] = DESKTOP
		const [ix, iy] = await middle(page, item(who === "member" ? "app:shows" : "app:explorer"))
		const [sx, sy] = await middle(page, item("bar:search"))
		const stops = [["top-left", 30, 96], ["top-right", w - 40, 96], ["item", ix, iy], ["bar", sx, sy], ["bottom-left", 30, h - 30], ["bottom-right", w - 40, h - 30]]
		for (const [name, x, y] of stops) {
			await page.mouse.move(x, y, { steps: 10 })
			await page.waitForTimeout(1100)
			await shot(page, `mouse-${name}-${who}-desktop`)
		}
		await ctx.close()
	}
	// ---- The nod at 1440 x 800.
	{
		const { ctx, page } = await open(GUEST, BESIDE)
		const v = await look(page)
		await page.mouse.move(v.tv.left + 300, v.tv.top + 200, { steps: 4 })
		await settle(page, (s) => s.pointing === "live", 30000)
		for (const [name, x, y] of [["item", ...(await middle(page, item("app:tonight")))], ["top-left", 30, 96], ["bar", ...(await middle(page, item("bar:menu")))]]) {
			await page.mouse.move(x, y, { steps: 10 })
			await page.waitForTimeout(1100)
			await shot(page, `nod-${name}-guest-1440x800`)
		}
		await ctx.close()
	}
	// ---- A finger at 390 x 844: a tap, and a press that is held and then dragged.
	for (const [who, url] of [
		["guest", GUEST],
		["member", MEMBER],
	]) {
		const { ctx, page, cdp } = await open(url, PHONE)
		const touch = finger(cdp)
		const draw = await withFinger(page)
		const [sx, sy] = await middle(page, item("bar:search"))
		await page.touchscreen.tap(sx, sy)
		await settle(page, (s) => s.pointing === "live", 30000)
		await remoteKey(page, "Home").tap()
		await settle(page, (s) => s.layers === 1 && !s.search.includes("tv="))
		await page.waitForTimeout(900)
		const [ax, ay] = await middle(page, item("app:tonight"))
		const [bx, by] = await middle(page, item("app:discover"))
		// The tap: before; the finger down on Discover; a moment after it lifted (the ring and the Remote still out).
		await shot(page, `tap-1-before-${who}-phone`)
		await draw(bx, by, true)
		await touch("touchStart", bx, by)
		await page.waitForTimeout(260)
		await shot(page, `tap-2-down-${who}-phone`)
		await touch("touchEnd")
		await draw(bx, by, false)
		await page.waitForTimeout(350)
		await shot(page, `tap-3-opened-${who}-phone`)
		await page.waitForTimeout(1200)
		await shot(page, `tap-4-rest-${who}-phone`)
		await remoteKey(page, "Back").tap()
		await settle(page, (s) => !s.search.includes("tv="))
		await page.waitForTimeout(700)
		// The held press, then the drag: held still on Tonight; dragged (the ring steps out above the finger); on to
		// Discover; let go.
		await draw(ax, ay + 30, true)
		await touch("touchStart", ax, ay + 30)
		await page.waitForTimeout(900)
		await shot(page, `hold-1-held-${who}-phone`)
		for (let i = 1; i <= 4; i++) await touch("touchMove", ax + 6 * i, ay + 30 + 4 * i)
		await draw(ax + 24, ay + 46, true)
		await page.waitForTimeout(500)
		await shot(page, `hold-2-dragged-${who}-phone`)
		for (let i = 1; i <= 8; i++) {
			await touch("touchMove", ax + 24 + ((bx - ax - 24) * i) / 8, ay + 46 + ((by - ay) * i) / 8)
			await draw(ax + 24 + ((bx - ax - 24) * i) / 8, ay + 46 + ((by - ay) * i) / 8, true)
			await page.waitForTimeout(40)
		}
		await page.waitForTimeout(600)
		await shot(page, `hold-3-over-${who}-phone`)
		await touch("touchEnd")
		await draw(0, 0, false)
		await page.waitForTimeout(450)
		await shot(page, `hold-4-let-go-${who}-phone`)
		await ctx.close()
	}
	// ---- On the table, at 375 x 667: a held finger at the picture's left edge.
	{
		const { ctx, page, cdp } = await open(GUEST, SHORT)
		const touch = finger(cdp)
		const draw = await withFinger(page)
		const [sx, sy] = await middle(page, item("bar:search"))
		await page.touchscreen.tap(sx, sy)
		await settle(page, (s) => s.pointing === "live", 30000)
		await remoteKey(page, "Home").tap()
		await settle(page, (s) => s.layers === 1 && !s.search.includes("tv="))
		await page.waitForTimeout(900)
		const [ax, ay] = await middle(page, item("app:tonight"))
		await draw(ax - 40, ay, true)
		await touch("touchStart", ax - 40, ay)
		await page.waitForTimeout(900)
		await shot(page, "table-held-guest-375x667")
		await touch("touchCancel")
		await ctx.close()
	}
	// ---- Landscape, which the prototype does not have: at rest, and a held finger at five spots.
	for (const size of LANDSCAPES) {
		const name = size.join("x")
		const { ctx, page, cdp } = await open(GUEST, size)
		const touch = finger(cdp)
		const draw = await withFinger(page)
		const [sx, sy] = await middle(page, item("bar:search"))
		await page.touchscreen.tap(sx, sy)
		await settle(page, (s) => s.pointing === "live", 30000)
		await remoteKey(page, "Home").tap()
		await settle(page, (s) => s.layers === 1 && !s.search.includes("tv="))
		await page.waitForTimeout(900)
		const { tv } = await look(page)
		await shot(page, `landscape-${name}-0-rest`)
		const [ax, ay] = await middle(page, item("app:tonight"))
		const [bx, by] = await middle(page, item("app:discover"))
		const spots = [["1-top-left", tv.left + tv.width * 0.12, tv.top + tv.height * 0.12], ["2-top-right", tv.left + tv.width * 0.86, tv.top + tv.height * 0.3], ["3-middle", tv.left + tv.width * 0.45, tv.top + tv.height * 0.5], ["4-app", ax, ay], ["5-next-app", bx, by]]
		for (const [spot, x, y] of spots) {
			await draw(x, y, true)
			await touch("touchStart", x, y)
			await page.waitForTimeout(900)
			await shot(page, `landscape-${name}-${spot}`)
			await touch("touchCancel")
			await draw(x, y, false)
			await page.waitForTimeout(700)
		}
		// A drag: the ring above the finger, the Remote following it.
		await draw(ax, ay + 46, true)
		await touch("touchStart", ax, ay + 46)
		await page.waitForTimeout(200)
		for (let i = 1; i <= 8; i++) {
			await touch("touchMove", ax + ((bx - ax) * i) / 8, ay + 46)
			await draw(ax + ((bx - ax) * i) / 8, ay + 46, true)
			await page.waitForTimeout(40)
		}
		await page.waitForTimeout(600)
		await shot(page, `landscape-${name}-6-dragged`)
		await touch("touchCancel")
		await ctx.close()
	}

	// ---- The sheets: ours beside the prototype's strips.
	const uri = (file) => `data:image/jpeg;base64,${readFileSync(file).toString("base64")}`
	const ours = (name) => uri(join(dir, `${name}.jpg`))
	const { ctx, page } = await open(GUEST, [1600, 900], { touch: false })
	const sheet = async (name, width, body) => {
		await page.setViewportSize({ width, height: 900 })
		await page.setContent(
			`<body style="margin:0;padding:24px;background:#15171c;color:#e6e8ee;font:15px system-ui,sans-serif"><style>h2{font-size:18px;margin:26px 0 10px}h2:first-child{margin-top:0}.row{display:flex;gap:6px;align-items:flex-start;flex-wrap:wrap}figure{margin:0}figcaption{font-size:13px;color:#aab;margin:4px 0 10px}img{display:block}</style>${body}</body>`,
		)
		await page.waitForTimeout(400)
		await page.screenshot({ path: join(here, `${name}.jpg`), quality: 80, fullPage: true })
	}
	const cell = (src, caption, w) => `<figure><img src="${src}" width="${w}"><figcaption>${caption}</figcaption></figure>`
	const stops = ["top-left", "top-right", "item", "bar", "bottom-left", "bottom-right"]
	const said = { "top-left": "the top left corner", "top-right": "the top right corner", item: "over an app: the ring closes", bar: "over a key of the bar", "bottom-left": "the bottom left corner", "bottom-right": "the bottom right corner" }
	await sheet(
		"desktop-beside-prototype",
		1968,
		`<h2>The prototype's strip of the ring pointer at 1920 x 1080 (its sample home, with the two service tiles that wait for their prototype)</h2><div class="row">${cell(uri(join(prototype, "pointing/ring-strip.jpg")), "", 1920)}</div>` +
			`<h2>Slice 4 on /home-preview, a guest on real data: the Remote swings toward the cursor, the ring is the pointer over the picture</h2><div class="row">${stops.map((s) => cell(ours(`mouse-${s}-guest-desktop`), said[s], 636)).join("")}</div>` +
			`<h2>A member, on the harness</h2><div class="row">${stops.map((s) => cell(ours(`mouse-${s}-member-desktop`), said[s], 636)).join("")}</div>` +
			`<h2>Beside the TV (1440 x 800) the Remote only nods</h2><div class="row">${["item", "top-left", "bar"].map((s) => cell(ours(`nod-${s}-guest-1440x800`), said[s], 636)).join("")}</div>`,
	)
	const taps = [["tap-1-before", "before"], ["tap-2-down", "the finger is down: the ring under it, the Remote aims"], ["tap-3-opened", "it lifted: the app opens"], ["tap-4-rest", "the ring is gone, the Remote rests"]]
	const holds = [["hold-1-held", "held still: the ring stays under the finger"], ["hold-2-dragged", "dragged: the ring steps out above it"], ["hold-3-over", "on to the next app, which takes the focus"], ["hold-4-let-go", "let go: the app under the ring opens"]]
	await sheet(
		"phone-beside-prototype",
		1640,
		`<h2>The prototype's strips at 390 x 844: a tap, and a press held and then dragged (the grey disc is the finger, drawn by the script)</h2><div class="row">${cell(uri(join(prototype, "touch/tap-strip.jpg")), "a tap", 780)}${cell(uri(join(prototype, "touch/hold-strip.jpg")), "held, then dragged", 780)}</div>` +
			["guest", "member"]
				.map(
					(who) =>
						`<h2>Slice 4, ${who === "guest" ? "a guest on real data" : "a member on the harness"}: a tap</h2><div class="row">${taps.map(([n, c]) => cell(ours(`${n}-${who}-phone`), c, 390)).join("")}</div><h2>${who === "guest" ? "A guest" : "A member"}: held, then dragged</h2><div class="row">${holds.map(([n, c]) => cell(ours(`${n}-${who}-phone`), c, 390)).join("")}</div>`,
				)
				.join("") +
			`<h2>On the table (375 x 667) the Remote only shifts: 3.5 degrees at most, no lean</h2><div class="row">${cell(ours("table-held-guest-375x667"), "a held finger at the picture's left", 375)}</div>`,
	)
	const spots = [["0-rest", "at rest: flat, no transform"], ["1-top-left", "a held finger at the top left"], ["2-top-right", "at the top right: the least turn"], ["3-middle", "in the middle"], ["4-app", "on the first app: the furthest turn"], ["5-next-app", "on the next app"], ["6-dragged", "dragged: the ring above the finger"]]
	await sheet(
		"landscape",
		1740,
		LANDSCAPES.map((size) => {
			const name = size.join("x")
			const shown = Math.min(size[0], 560)
			return `<h2>Phone landscape, ${size[0]} x ${size[1]} (not in the prototype): the Remote turns about its grip toward the spot and never crosses the picture</h2><div class="row">${spots.map(([s, c]) => cell(ours(`landscape-${name}-${s}`), c, shown)).join("")}</div>`
		}).join(""),
	)
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------

if (only === "landscape") for (const size of LANDSCAPES) await landscape(size)
if (!only || only === "checks") {
	await mouse("guest", GUEST)
	await mouse("member", MEMBER)
	await beside()
	await touching("guest", GUEST, PHONE, "hand")
	await touching("guest", GUEST, SHORT, "table")
	await touching("member", MEMBER, PHONE, "hand")
	for (const size of LANDSCAPES) await landscape(size)
	await others()
}
if (!only || only === "budget") await budget()
if (!only || only === "checks" || only === "budget") {
	const file = join(here, "checks.json")
	let before = {}
	try {
		before = JSON.parse(readFileSync(file, "utf8"))
	} catch {}
	// A run of one part keeps the other part's numbers.
	writeFileSync(file, `${JSON.stringify({ ...before, [`${only ?? "all"}${process.env.BUILD ? ", production build" : ""}${process.env.CONTROL ? ", without pointing" : ""}${process.env.NOREPLAY ? ", recorder off" : ""}`]: { passed, failed }, numbers: { ...before.numbers, ...numbers } }, null, "\t")}\n`)
}
if (!only || only === "shots") await shots()
await browser.close()
console.log(`${passed} checks passed, ${failed.length} failed`)
if (failed.length) {
	for (const line of failed) console.log(" -", line)
	process.exit(1)
}
