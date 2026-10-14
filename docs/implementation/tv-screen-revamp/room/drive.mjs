// Slice 2 of the new TV (the room): walks / at every window size of the prototype's tables, checks
// the room against them, presses every key of both Remotes, and takes the screenshots in shots/ and the sheets
// beside the prototype's own.
//
//   PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs BASE=http://localhost:3162 node drive.mjs [checks|shots]
//
// The repo has no browser driver: install playwright-core outside it. Needs a dev server of goodwatch-webapp (see
// README.md here). PROTOTYPE= is the folder of the prototype's notes
// (docs/prototypes/tv-screen-design on prototype/tv-screen-flow), for the sheets.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
	layoutPhoneLandscape,
	layoutPhoneRoom,
	layoutRoom,
} from "../../../../goodwatch-webapp/app/ui/living-room/tv/room-layout.ts"

const here = dirname(fileURLToPath(import.meta.url))
const base = `${process.env.BASE ?? "http://localhost:3162"}/`
const prototype = process.env.PROTOTYPE ?? "/home/alper/projects/goodwatch-monorepo-38caebf4/docs/prototypes/tv-screen-design"
const only = process.argv[2]
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")

// Window, the Remote's place or form, the TV's picture. The desktop rows and the first block of phones are the
// prototype's tables. The phone rows are the real page's: the lip takes 60 px where the prototype kept 20 free
// and the dock is 72 px, not 64, so the two short phones have a shorter TV than the prototype measured.
const DESKTOP = [
	[1920, 1080, "below", 1271, 686],
	[1920, 940, "below", 1080, 583],
	[2560, 1300, "below", 1556, 841],
	[1536, 730, "beside", 1080, 583],
	[1440, 800, "beside", 1080, 583],
	[1366, 650, "beside", 998, 539],
	[1280, 720, "beside", 949, 513],
]
const PHONES = [
	[390, 844, "hand", 362, 302],
	[360, 740, "hand", 332, 277],
	[375, 667, "table", 347, 258],
	[430, 932, "hand", 402, 335],
	[390, 700, "table", 362, 291],
]
const LANDSCAPE = [
	[844, 390, "hand", 488, 364],
	[932, 430, "hand", 541, 404],
]
// Not in any table: sizes the report asks the owner about.
const OTHER = [
	[820, 1180],
	[1024, 768],
	[667, 375],
]

let passed = 0
const failed = []
const check = (ok, what) => {
	if (ok) passed += 1
	else {
		failed.push(what)
		console.log("  FAILED", what)
	}
}
const near = (a, b, within = 1) => Math.abs(a - b) <= within

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium" })
// A busy machine times a load out now and then: try again, twice.
const open = async (width, height, { touch = width < 768 || height <= 540, tries = 3 } = {}) => {
	const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ...(touch ? { isMobile: true, hasTouch: true } : {}) })
	const page = await ctx.newPage()
	const logs = []
	page.on("console", (m) => {
		if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text()}`)
	})
	page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`))
	try {
		await page.goto(base, { waitUntil: "load", timeout: 180000 })
		await page.waitForSelector("#room:not([data-room=unmeasured])", { timeout: 180000 })
	} catch (error) {
		await ctx.close().catch(() => {})
		if (tries <= 1) throw error
		console.log("loading again:", String(error.message).split("\n")[0])
		await new Promise((done) => setTimeout(done, 4000))
		return open(width, height, { touch, tries: tries - 1 })
	}
	// The photos, and the dev tools' round key, which is no part of the page.
	await page.evaluate(() => Promise.all([...document.querySelectorAll("#room img")].map((img) => img.decode().catch(() => {}))))
	await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" })
	await page.waitForTimeout(400)
	return { ctx, page, logs }
}

/** What the page made of the window. Boxes are [left, top, width, height] from the window's top left. */
const measure = (page) =>
	page.evaluate(() => {
		const box = (el) => {
			const b = el?.getBoundingClientRect()
			return b ? [b.left, b.top, b.width, b.height] : null
		}
		const room = document.querySelector("#room")
		const hit = (el) => {
			const b = el.getBoundingClientRect()
			const at = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
			return Boolean(at && (at === el || el.contains(at)))
		}
		const keys = [...document.querySelectorAll("[data-remote] button")].map((el) => ({ name: el.getAttribute("aria-label") ?? el.textContent.trim(), box: box(el), hit: hit(el) }))
		const lip = document.querySelector(".lrb-lip")
		return {
			room: room.dataset.room,
			place: room.dataset.remotePlace ?? null,
			form: room.dataset.remoteForm ?? null,
			power: room.dataset.tvPower,
			inert: room.hasAttribute("inert"),
			scene: box(room),
			tv: box(document.querySelector("[data-tv-screen]")),
			body: box(document.querySelector("[data-tv-body]")),
			lip: box(lip),
			lipHit: lip ? hit(lip) : false,
			below: box(document.querySelector("#browse")),
			links: document.querySelectorAll("#browse a[href^='/']").length,
			keys,
			lastKey: document.querySelector("[data-empty-tv]")?.dataset.lastKey ?? null,
			window: [innerWidth, innerHeight],
			pageWidth: document.documentElement.scrollWidth,
			scrollY,
		}
	})

const overlap = (a, b) => Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]))
const lastKey = (page) => page.evaluate(() => document.querySelector("[data-empty-tv]")?.dataset.lastKey ?? null)

/** The checks every size shares: the page around the room. */
const around = (m, at) => {
	check(m.pageWidth <= m.window[0], `${at}: nothing is wider than the window`)
	check(m.lip !== null && m.lip[2] > 0 && m.lipHit, `${at}: the lip is there and takes a press`)
	check(m.lip && m.lip[1] + m.lip[3] <= m.window[1] + 1 && m.lip[1] >= m.scene[1], `${at}: the lip is inside the first screen`)
	// In landscape the room covers the window and slides away; everywhere else the section follows it.
	if (m.room !== "landscape") check(m.below && near(m.below[1], m.scene[1] + m.scene[3], 2), `${at}: the section starts where the room ends`)
	check(m.links >= 12, `${at}: the section has its hub links (${m.links})`)
	check(m.lip && overlap(m.lip, m.tv) === 0, `${at}: the lip does not cover the TV`)
	check(!m.inert, `${at}: the room takes input while it is in the window`)
}

/** Presses a key of the Remote and reads what reached the seam. */
const press = async (page, name, says, at) => {
	const key = page.locator(`[data-remote] button${name === "OK" ? ":text-is('OK')" : `[aria-label="${name}"]`}`)
	await key.click({ timeout: 20000 })
	const got = await lastKey(page)
	check(got === says, `${at}: ${name} reaches the TV as "${says}" (got "${got}")`)
}

const shots = join(here, "shots")
mkdirSync(shots, { recursive: true })
const shoot = (page, name) => page.screenshot({ path: join(shots, `${name}.jpg`), quality: 82, timeout: 180000 })
const doChecks = !only || only === "checks"
const doShots = !only || only === "shots"
const report = {}

for (const [w, h, place, tvW, tvH] of DESKTOP) {
	const at = `${w} x ${h}`
	const { ctx, page } = await open(w, h)
	const m = await measure(page)
	if (doShots) await shoot(page, `${w}x${h}`)
	const L = layoutRoom(m.scene[2], m.scene[3])
	report[at] = { scene: `${m.scene[2]} x ${m.scene[3]}`, remote: m.place, tv: `${Math.round(m.tv[2])} x ${Math.round(m.tv[3])}`, canvasShownAt: +L.canvas.scale.toFixed(3), remoteSize: +L.remote.scale.toFixed(3) }
	console.log(at, JSON.stringify(report[at]))
	if (doChecks) {
		check(m.room === "desktop" && m.place === place, `${at}: the Remote is ${place} (${m.place})`)
		check(Math.round(m.tv[2]) === tvW && Math.round(m.tv[3]) === tvH, `${at}: the TV is ${tvW} x ${tvH} (${Math.round(m.tv[2])} x ${Math.round(m.tv[3])})`)
		check(near(m.tv[0], m.scene[0] + L.tv.left) && near(m.tv[1], m.scene[1] + L.tv.top), `${at}: the TV is where the layout puts it`)
		check(m.scene[3] === h - 64, `${at}: the scene is the window without the header (${m.scene[3]})`)
		around(m, at)
		// The keys: all of them beside the TV, down to the streaming keys under it.
		for (const key of m.keys) {
			const inside = key.box[0] >= 0 && key.box[1] >= 64 && key.box[0] + key.box[2] <= m.window[0] && key.box[1] + key.box[3] <= m.window[1]
			check(inside && key.hit, `${at}: the key ${key.name} is inside the window and under nothing`)
			check(overlap(key.box, m.lip) === 0, `${at}: the key ${key.name} is clear of the lip`)
		}
		check(m.keys.length === 12, `${at}: the Remote has its 12 keys (${m.keys.length})`)
		const row = m.keys.find((key) => key.name === "Only Netflix")
		check(row && row.box[1] + row.box[3] < h, `${at}: the streaming row ends inside the window (${row && Math.round(row.box[1] + row.box[3])} of ${h})`)
		if (place === "below") {
			// The layout puts the Remote's top 18 px over the picture's bottom edge. Leaning back it is drawn lower:
			// its top edge ends within a few pixels of the picture's bottom edge, as in the prototype.
			const remote = await page.evaluate(() => document.querySelector("[data-remote]").getBoundingClientRect().top)
			report[at].remoteTopUnderTv = +(remote - (m.tv[1] + m.tv[3])).toFixed(1)
			check(near(L.tv.top + L.tv.height - L.remote.top, 18, 0.01) && Math.abs(remote - (m.tv[1] + m.tv[3])) <= 16, `${at}: the Remote's top is at the picture's bottom edge (${report[at].remoteTopUnderTv} px under it as drawn)`)
		} else check(m.keys.every((key) => key.box[0] > m.tv[0] + m.tv[2]), `${at}: the Remote is right of the TV`)
	}
	// Every key, once, at the two sizes that have the two places.
	if (doChecks && ((w === 1920 && h === 1080) || (w === 1440 && h === 800))) {
		await press(page, "Up", "move up", at)
		await press(page, "Down", "move down", at)
		await press(page, "Previous", "move left", at)
		await press(page, "Next", "move right", at)
		await press(page, "OK", "ok", at)
		await press(page, "Back", "back", at)
		await press(page, "Search", "search", at)
		await press(page, "Home", "home", at)
		await press(page, "Menu", "menu", at)
		await press(page, "Only Netflix", "only Netflix", at)
		await press(page, "Only Amazon Prime Video", "only Amazon Prime Video", at)
		// Scrolling over the wheel steps through the items, as on the Remote today.
		const wheel = await page.locator("[data-remote] .remote-wheel").boundingBox()
		await page.mouse.move(wheel.x + wheel.width / 2, wheel.y + 12)
		await page.mouse.wheel(0, 60)
		await page.waitForTimeout(200)
		check((await lastKey(page)) === "step on", `${at}: scrolling over the wheel steps on`)
		// The power key: the picture goes dark and the room's lights go down; any key turns it on again.
		await page.locator("[data-remote] button[data-power]").click()
		const off = await measure(page)
		check(off.power === "off" && off.lastKey === null, `${at}: the power key turns the TV off`)
		if (doShots && w === 1920) {
			await page.waitForTimeout(900)
			await shoot(page, `${w}x${h}-off`)
		}
		await page.locator('[data-remote] button[aria-label="Home"]').click()
		const on = await measure(page)
		check(on.power === "on" && on.lastKey === "power on", `${at}: a key turns a dark TV on and does nothing else`)
	}
	await ctx.close()
}

for (const [list, kind] of [
	[PHONES, "phone"],
	[LANDSCAPE, "landscape"],
])
	for (const [w, h, form, tvW, tvH] of list) {
		const at = `${w} x ${h}`
		const { ctx, page } = await open(w, h)
		const m = await measure(page)
		if (doShots) await shoot(page, `${w}x${h}`)
		const L = kind === "phone" ? layoutPhoneRoom(m.scene[2], m.scene[3], 60) : layoutPhoneLandscape(m.scene[2], m.scene[3], { tv: 0, remote: 46 })
		report[at] = { scene: `${m.scene[2]} x ${m.scene[3]}`, remote: m.form, tv: `${Math.round(m.tv[2])} x ${Math.round(m.tv[3])}`, canvas: `500 x ${Math.round(L.canvas.h)}`, canvasShownAt: +L.canvas.scale.toFixed(3), smallestKey: Math.round(Math.min(...m.keys.flatMap((key) => [key.box[2], key.box[3]]))), keysEndAt: Math.round(Math.max(...m.keys.map((key) => key.box[1] + key.box[3]))), lipAt: Math.round(m.lip[1]) }
		console.log(at, JSON.stringify(report[at]))
		if (doChecks) {
			check(m.room === kind && m.form === form, `${at}: the ${kind}'s room, the Remote ${form === "hand" ? "in the hand" : "on the table"} (${m.room}, ${m.form})`)
			check(Math.round(m.tv[2]) === tvW && Math.round(m.tv[3]) === tvH, `${at}: the picture is ${tvW} x ${tvH} (${Math.round(m.tv[2])} x ${Math.round(m.tv[3])})`)
			check(near(m.tv[0], m.scene[0] + L.tv.left) && near(m.tv[1], m.scene[1] + L.tv.top), `${at}: the TV is where the layout puts it`)
			check(m.body && m.body[0] < m.tv[0] && m.body[1] < m.tv[1] && m.body[0] + m.body[2] > m.tv[0] + m.tv[2] && m.body[1] + m.body[3] > m.tv[1] + m.tv[3], `${at}: the TV has its body on every side of the picture`)
			check(m.tv[2] > m.tv[3], `${at}: the TV is wider than tall`)
			around(m, at)
			check(m.keys.length === 11, `${at}: the Remote has its 11 keys (${m.keys.length})`)
			for (const key of m.keys) {
				check(key.box[2] >= 43.9 && key.box[3] >= 43.9, `${at}: the key ${key.name} is 44 px or more (${Math.round(key.box[2])} x ${Math.round(key.box[3])})`)
				const inside = key.box[0] >= 0 && key.box[0] + key.box[2] <= m.window[0] && key.box[1] + key.box[3] <= m.window[1]
				check(inside && key.hit, `${at}: the key ${key.name} is inside the window and under nothing`)
				check(overlap(key.box, m.lip) === 0, `${at}: the key ${key.name} is clear of the lip`)
				if (kind === "phone") check(key.box[1] >= m.tv[1] + m.tv[3], `${at}: the key ${key.name} is under the TV`)
				else check(key.box[0] >= m.tv[0] + m.tv[2], `${at}: the key ${key.name} is right of the TV`)
			}
			await press(page, "Up", "move up", at)
			await press(page, "Down", "move down", at)
			await press(page, "Previous", "move left", at)
			await press(page, "Next", "move right", at)
			await press(page, "OK", "ok", at)
			await press(page, "Back", "back", at)
			await press(page, "Search", "search", at)
			await press(page, "Home", "home", at)
			await press(page, "Menu", "menu", at)
			await press(page, "Only Netflix", "only Netflix", at)
			await press(page, "Only Amazon Prime Video", "only Amazon Prime Video", at)
			check((await page.locator("[data-remote] button[data-power]").count()) === 0, `${at}: the phone's Remote has no power key`)
		}
		await ctx.close()
	}

if (doShots)
	for (const [w, h] of OTHER) {
		const { ctx, page } = await open(w, h)
		const m = await measure(page)
		await shoot(page, `${w}x${h}`)
		report[`${w} x ${h}`] = { scene: `${m.scene[2]} x ${m.scene[3]}`, room: m.room, remote: m.place ?? m.form, tv: `${Math.round(m.tv[2])} x ${Math.round(m.tv[3])}` }
		console.log(`${w} x ${h}`, JSON.stringify(report[`${w} x ${h}`]))
		await ctx.close()
	}

// Going below and coming back: the room takes no input while it is away. And nothing in the console.
if (doChecks)
	for (const [w, h] of [
		[1440, 900],
		[390, 844],
	]) {
		const at = `${w} x ${h}`
		const { ctx, page, logs } = await open(w, h)
		await page.waitForTimeout(1500)
		// The router's own notice about its next version is on every page of the site.
		const ours = logs.filter((line) => !line.includes("React Router Future Flag Warning"))
		check(ours.length === 0, `${at}: nothing in the console after hydration${ours.length ? `: ${ours.join(" | ").slice(0, 400)}` : ""}`)
		await page.locator(".lrb-lip").click()
		await page.waitForFunction(() => document.querySelector("#room").hasAttribute("inert"), null, { timeout: 20000 }).catch(() => {})
		const away = await measure(page)
		check(away.inert && away.scrollY > 0, `${at}: after the lip the page is below and the room is inert`)
		await page.locator(".lrb-back").first().click()
		await page.waitForFunction(() => !document.querySelector("#room").hasAttribute("inert") && scrollY === 0, null, { timeout: 20000 }).catch(() => {})
		const back = await measure(page)
		check(!back.inert && back.scrollY === 0, `${at}: back in the room it takes input again`)
		await ctx.close()
	}

// The sheets: every size at one scale, and ours beside the prototype's own shots.
if (doShots) {
	const uri = (file) => `data:image/jpeg;base64,${readFileSync(file).toString("base64")}`
	const ours = (w, h) => uri(join(shots, `${w}x${h}.jpg`))
	const cell = (src, label, width) => `<figure><img src="${src}" width="${width}"><figcaption>${label}</figcaption></figure>`
	const sheet = async (name, width, html) => {
		const ctx = await browser.newContext({ viewport: { width, height: 600 }, deviceScaleFactor: 1 })
		const page = await ctx.newPage()
		await page.setContent(`<style>body{margin:0;padding:16px;background:#14161b;color:#fff;font:15px system-ui}h2{font-size:18px;margin:18px 0 8px}div{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start}figure{margin:0}img{display:block}figcaption{padding:4px 0 0;color:#cbd5e1}</style>${html}`)
		await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode())))
		await page.screenshot({ path: join(here, `${name}.jpg`), quality: 80, fullPage: true })
		await ctx.close()
	}
	await sheet(
		"desktop-beside-prototype",
		1960,
		`<h2>1920 x 1080: the prototype's home (left), the room on / with an empty TV (right)</h2><div>${cell(uri(join(prototype, "screens/cinema/01-home-desktop.jpg")), "prototype", 956)}${cell(ours(1920, 1080), "slice 2", 956)}</div>`,
	)
	await sheet(
		"desktop-sizes",
		1960,
		`<h2>The prototype's contact sheet</h2><div>${cell(uri(join(prototype, "viewports/contact-sheet.jpg")), "", 1928)}</div><h2>Slice 2 at the same window sizes, all at one scale</h2><div>${DESKTOP.map(([w, h, place, tvW, tvH]) => cell(ours(w, h), `${w} x ${h}: ${place === "below" ? "under" : "beside"}, TV ${tvW} x ${tvH}`, Math.round(w / 4.2))).join("")}</div>`,
	)
	await sheet(
		"phone-beside-prototype",
		900,
		`<h2>390 x 844: the prototype's home (left), the room on / with an empty TV (right)</h2><div>${cell(uri(join(prototype, "screens/cinema/01-home-phone.jpg")), "prototype", 390)}${cell(ours(390, 844), "slice 2: the lip is over the room's bottom edge", 390)}</div>`,
	)
	await sheet(
		"phone-sizes",
		2262,
		`<h2>The prototype's phones: the home at each size, in the hand and on the table</h2><div>${cell(uri(join(prototype, "viewports/phones-forms.jpg")), "", 1115)}</div><h2>Slice 2 at the same sizes, as the phone takes the Remote by itself, with the lip</h2><div>${PHONES.map(([w, h, form, tvW, tvH]) => cell(ours(w, h), `${w} x ${h}: ${form === "hand" ? "in the hand" : "on the table"}, picture ${tvW} x ${tvH}`, w)).join("")}</div>`,
	)
	await sheet("phone-landscape", 1840, `<h2>Phone landscape (not in the prototype): the TV on the left, the phone's Remote on the right</h2><div>${LANDSCAPE.map(([w, h, , tvW, tvH]) => cell(ours(w, h), `${w} x ${h}: picture ${tvW} x ${tvH}`, w)).join("")}</div>`)
	await sheet("other-sizes", 2600, `<h2>Sizes in no table</h2><div>${OTHER.map(([w, h]) => cell(ours(w, h), `${w} x ${h}: ${report[`${w} x ${h}`].room}, TV ${report[`${w} x ${h}`].tv}`, w)).join("")}</div>`)
	await sheet("tv-off", 1960, `<h2>1920 x 1080: the TV on (left) and off (right)</h2><div>${cell(ours(1920, 1080), "on", 956)}${cell(uri(join(shots, "1920x1080-off.jpg")), "off: the lights go down, no glow on the wall", 956)}</div>`)
}

await browser.close()
writeFileSync(join(here, "sizes.json"), `${JSON.stringify(report, null, "\t")}\n`)
console.log(`\n${passed} checks passed, ${failed.length} failed`)
for (const what of failed) console.log("  FAILED", what)
process.exit(failed.length ? 1 : 0)
