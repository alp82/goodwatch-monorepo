// Slice 9 of the new TV (My shows): walks home's My shows tile, My shows, a show's title screen and its Seen it
// key with the keyboard, both Remotes' keys, the pointer and a finger, as a member on the tracking harness; follows
// the New episodes signal on the tile and on the screen; measures every key of My shows, a show's title screen,
// the menu and What is GoodWatch? on every phone of the room's table; and takes the screenshots in shots/ and the
// sheets beside the prototype's own.
//
//   PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs MEMBER=http://localhost:3292 \
//   node drive.mjs [checks|shots]
//
// PARTS=walk,signal,edges,sizes,guest runs some of the checks. SHOTS=member,guest,sheets takes some of the shots:
// a member's from the harness, a guest's from GUEST, and the sheets from the shots that are there, so the two
// servers need not run at the same time.
//
// The repo has no browser driver: install playwright-core outside it. MEMBER is a dev server of goodwatch-webapp
// without any service, for the harness (see README.md here for the command). GUEST is the server a guest's pages
// come from: the same one by default; a dev server that reads real data gives a guest's shots their pictures.
// PROTOTYPE= is the folder of the prototype's notes (docs/prototypes/tv-screen-design on prototype/tv-screen-flow),
// for the sheets.
//
// The walk marks episodes watched. Those writes go to the harness's API alone, which keeps a member who does not
// exist in the dev server's memory. Nothing here signs in, and no write reaches any other address: every request
// that is not a GET and not the harness's is stopped in the browser and counted, and a request to another host
// is stopped too.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const ORIGIN = process.env.MEMBER ?? "http://localhost:3292"
const HARNESS = `${ORIGIN}/prototype/my-library-real/tv`
const HARNESS_API = "/prototype/my-library-real/api"
const GUEST = `${process.env.GUEST ?? ORIGIN}/home-preview`
const prototype = process.env.PROTOTYPE ?? "/home/alper/projects/goodwatch-monorepo-38caebf4/docs/prototypes/tv-screen-design"
const only = process.argv[2]
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")

const DESKTOP = [1920, 1080]
const PHONE = [390, 844]
/** The phones of the room's table, and landscape. */
const PHONES = [
	[360, 740],
	[375, 667],
	[390, 700],
	[390, 844],
	[430, 932],
	[844, 390],
]
/** What a guest's page reads with POST: the pool, Tonight's pick, a title's card. */
const GUEST_READS = ["/api/living-room/picks", "/api/tonight", "/api/title-cards"]
const BAR = ["bar:back", "bar:search", "bar:menu"]
const TITLE = ["watch", "want-to-see", "seen", ...BAR]
const show = (id) => `title:show-${id}`
/** The sample member `six`: three shows to continue, three to start. Slow Horses has three aired episodes left. */
const SIX = [101, 102, 103, 302, 309, 303].map(show)
const memberUrl = (member, rest = "") => `${HARNESS}?member=${member}&session=member${rest}`

let passed = 0
const failed = []
const numbers = {}
let where = ""
const check = (ok, what) => {
	if (ok) passed += 1
	else {
		failed.push(`${where}: ${what}`)
		console.log("  FAILED", where, "-", what)
	}
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const is = (got, want, what) => check(same(got, want), `${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--use-angle=gl", "--ignore-gpu-blocklist"] })

/** Starts a sample member over: the watches a walk made are gone. */
const reset = (member, rest = "") => fetch(`${HARNESS}?member=${member}${rest}&reset=1`).then((r) => r.text())
/** What the harness holds for a sample member, asked directly. */
const harness = async (member, what, rest = "") => (await fetch(`${ORIGIN}${HARNESS_API}?what=${what}&member=${member}&seen=30&landed=none${rest}`)).json()

/** Opens a page. A busy machine times a load out now and then: try again, twice. */
async function open(url, [width, height], { touch = width < 768 || height < 500, tries = 3, reducedMotion, room = true } = {}) {
	const ctx = await browser.newContext({
		viewport: { width, height },
		deviceScaleFactor: touch ? 2 : 1,
		reducedMotion,
		...(touch ? { isMobile: true, hasTouch: true } : {}),
	})
	const page = await ctx.newPage()
	const logs = []
	const requests = []
	const answers = []
	page.on("console", (m) => {
		if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text()}`)
	})
	page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`))
	page.on("request", (r) => {
		const u = new URL(r.url())
		requests.push({ url: r.url(), path: u.pathname, search: u.search, what: u.searchParams.get("what"), method: r.method(), body: r.postData() })
	})
	page.on("response", async (r) => {
		const u = new URL(r.url())
		if (u.pathname !== HARNESS_API || r.request().method() === "GET") return
		answers.push({ what: u.searchParams.get("what"), status: r.status(), json: await r.json().catch(() => null) })
	})
	// Nothing may leave the machine but the pictures: a request to another host is stopped.
	const left = []
	await page.route(
		(u) => !["localhost", "127.0.0.1", "image.tmdb.org"].includes(u.hostname) && u.protocol.startsWith("http"),
		(route) => {
			left.push(route.request().url())
			return route.fulfill({ status: 204, body: "" })
		},
	)
	// The browser's telemetry goes through the dev server to Sentry (/api/e): a drive's page views are no news.
	await page.route("**/api/e", (route) => route.fulfill({ status: 200, body: "" }))
	// No write but the harness's own: every other request that is not a GET is stopped here and counted. A guest
	// reads by POST, with their browser's progress in the body: those reads pass.
	const stopped = []
	await page.route(
		(u) => ["localhost", "127.0.0.1"].includes(u.hostname) && u.pathname !== HARNESS_API && u.pathname !== "/api/e" && !GUEST_READS.includes(u.pathname),
		(route) => {
			const request = route.request()
			if (request.method() === "GET") return route.fallback()
			stopped.push({ path: new URL(request.url()).pathname, method: request.method(), body: request.postData() })
			return route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
		},
	)
	try {
		await page.goto(url, { waitUntil: "load", timeout: 180000 })
		await page.waitForSelector(room ? "#room:not([data-room=unmeasured]) [data-tv-item]" : "h1", { timeout: 180000 })
	} catch (error) {
		await ctx.close().catch(() => {})
		if (tries <= 1) throw error
		console.log("loading again:", String(error.message).split("\n")[0])
		await sleep(4000)
		return open(url, [width, height], { touch, tries: tries - 1, reducedMotion, room })
	}
	// The dev tools' round key is no part of the page.
	await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" })
	await page.waitForTimeout(600)
	return { ctx, page, logs, requests, answers, left, stopped }
}

/** What the TV shows. */
const read = (page) =>
	page.evaluate(() => {
		const room = document.getElementById("room")
		if (!room) return { search: location.search, path: location.pathname, room: false, items: [], focus: [], labels: {}, layers: 0, text: "" }
		const layers = [...room.querySelectorAll("[data-tv-layer]")]
		const top = layers.at(-1)
		const items = top ? [...top.querySelectorAll("[data-tv-item]")] : []
		const id = (el) => el.getAttribute("data-tv-item")
		const tile = room.querySelector('[data-tv-item="app:shows"]')
		return {
			search: location.search,
			tv: new URLSearchParams(location.search).get("tv"),
			title: new URLSearchParams(location.search).get("title"),
			path: location.pathname,
			room: true,
			layers: layers.length,
			items: items.map(id),
			focus: items.filter((el) => el.getAttribute("aria-current")).map(id),
			// What an item says: its label for a screen reader, else its words.
			labels: Object.fromEntries(items.map((el) => [id(el), el.getAttribute("aria-label") ?? el.textContent])),
			// What a poster says on itself, and whether it is marked as new.
			posters: Object.fromEntries(
				items
					.filter((el) => id(el).startsWith("title:"))
					.map((el) => [id(el), { on: el.querySelector("span.bottom-0")?.textContent ?? null, fresh: Boolean(el.querySelector(".bg-sky-300")), img: el.querySelector("img")?.getAttribute("src") ?? null, loaded: Boolean(el.querySelector("img")?.naturalWidth) }]),
			),
			// The top bar's name and what stands under it.
			name: top?.querySelector(":scope > .top-0.justify-between .truncate.font-bold")?.textContent ?? null,
			crumb: top?.querySelector(":scope > .top-0.justify-between .truncate.leading-tight")?.textContent ?? null,
			// The focused show's name and its line of facts; on the title screen the title's name.
			heading: top?.querySelector(".tvc-fade .tracking-tight, .line-clamp-2.tracking-tight")?.textContent ?? null,
			facts: top?.querySelector(".tvc-fade .text-white\\/75")?.textContent ?? null,
			// Home: the large name, its line, and the My shows tile's number.
			large: top?.querySelector("h1 + .tvc-fade > div")?.textContent ?? null,
			line: top?.querySelector("h1 + .tvc-fade > div + div")?.textContent ?? null,
			badge: tile?.querySelector(".bg-sky-300")?.textContent ?? null,
			badgeSaid: tile?.querySelector(".sr-only")?.textContent ?? null,
			text: top?.innerText ?? "",
			toast: room.querySelector(".tvc-toast")?.textContent ?? null,
			history: history.length,
			// The picture behind the screen: the last one, once a cross-fade has brought it in.
			picture: [...(top?.querySelectorAll(":scope > .absolute.inset-0.overflow-hidden img") ?? [])].at(-1)?.getAttribute("src") ?? null,
		}
	})

/** Waits until the TV's state says `want`, then returns the state. */
async function until(page, want, what, timeout = 20000) {
	const end = Date.now() + timeout
	let now
	for (;;) {
		now = await read(page).catch(() => null)
		if (now && want(now)) return now
		if (Date.now() > end) {
			check(false, `${what}: still ${JSON.stringify(now && { search: now.search, focus: now.focus, items: now.items, heading: now.heading, seen: now.labels.seen, toast: now.toast, badge: now.badge })}`)
			return now ?? { items: [], focus: [], labels: {}, posters: {}, text: "" }
		}
		await page.waitForTimeout(60)
	}
}
const focusIs = (item) => (s) => s.focus.length === 1 && s.focus[0] === item
const onShows = (s) => s.room && s.tv === "shows" && s.layers === 1 && s.items.some((item) => item.startsWith("title:"))
const onTitle = (id) => (s) => s.room && s.tv === "title" && s.title === `show-${id}` && s.layers === 1 && same(s.items, TITLE)

/** A key of the keyboard, and the state once the focus is on `item`. */
async function key(page, name, item, what = `${name} moves the focus to ${item}`) {
	await page.keyboard.press(name)
	return until(page, focusIs(item), what)
}
/** The focus on `item` by the direction keys, from wherever it is on a title's keys. */
async function focusOn(page, item) {
	for (const press of ["ArrowRight", "ArrowRight", "ArrowDown", "ArrowLeft", "ArrowDown"]) {
		if ((await read(page)).focus[0] === item) break
		await page.keyboard.press(press)
		await page.waitForTimeout(120)
	}
	return until(page, focusIs(item), `the focus on ${item}`)
}

/** A key of either Remote, by its name: the label of a key with an icon, or the word on the OK key. */
const remoteKey = (page, label) =>
	label === "OK"
		? page.locator('#room [aria-label="Remote control"] button', { hasText: /^OK$/ })
		: page.locator(`#room [aria-label="Remote control"] button[aria-label="${label}"]`)
async function remote(page, label, touch) {
	const button = remoteKey(page, label)
	if (touch) await button.tap()
	else await button.click()
}
const itemOf = (page, item) => page.locator(`#room [data-tv-layer] [data-tv-item="${item}"]`).last()
/** An item on the TV, pressed with the pointer or a finger. */
async function point(page, item, touch) {
	if (touch) await itemOf(page, item).tap()
	else await itemOf(page, item).click()
}

/** The requests that would have left the machine, without the site's own telemetry. */
const beyondTelemetry = (left) => [...new Set(left.map((u) => new URL(u).hostname))].filter((host) => !/posthog|sentry|googletagmanager|google-analytics|cloudflareinsights/.test(host))
// What a dev server's console says on any page. The harness has no title snapshot: its pool answers 503.
const noise = (logs) => logs.filter((l) => !l.includes("Future Flag") && !l.includes("net::ERR_FAILED") && !l.includes("503") && !l.includes("Failed to load resource") && !l.includes("Swiper Loop Warning"))
/** The watches a page sent to the harness: each POST of a show's tracking, with what it asked for. */
const marks = (requests) => requests.filter((r) => r.method === "POST" && r.path === HARNESS_API && r.what === "tracking-show").map((r) => JSON.parse(r.body))
const reads = (requests, id) => requests.filter((r) => r.method === "GET" && r.path === HARNESS_API && r.what === "tracking-show" && new URLSearchParams(r.search).get("id") === String(id)).length
const loaderRuns = (requests) => requests.filter((r) => r.search.includes("_data=")).length

// ---------------------------------------------------------------------------------------------------------
// Where everything is, on the window: for the sizes.

const layout = (page) =>
	page.evaluate(() => {
		const room = document.getElementById("room")
		const layer = [...room.querySelectorAll("[data-tv-layer]")].at(-1)
		const tv = layer.getBoundingClientRect()
		const k = tv.width / layer.offsetWidth
		// An item at rest: the focused one is drawn larger, and counts at the size it lies at.
		const rest = (el) => {
			const b = el.getBoundingClientRect()
			const [w, h] = [el.offsetWidth * k, el.offsetHeight * k]
			const [x, y] = [b.left + b.width / 2 - w / 2, b.top + b.height / 2 - h / 2]
			return { left: x, top: y, right: x + w, bottom: y + h, width: w, height: h }
		}
		const place = layer.querySelector("[data-tv-expand-place]")
		const heading = layer.querySelector(".tvc-fade .tracking-tight, .line-clamp-2.tracking-tight")
		const row = layer.querySelector("[data-tv-row]")
		return {
			k,
			tv: { left: tv.left, top: tv.top, right: tv.right, bottom: tv.bottom },
			items: [...layer.querySelectorAll("[data-tv-item]")].map((el) => ({
				id: el.getAttribute("data-tv-item"),
				...rest(el),
				// What a key says is cut short where it does not fit.
				cut: [...el.querySelectorAll(".truncate")].some((text) => text.scrollWidth > text.clientWidth + 1) || (!el.querySelector("*") && el.scrollWidth > el.clientWidth + 1),
				// What a key says stands on this many lines.
				lines: Math.round(el.scrollHeight > el.clientHeight + 1 ? 99 : 1),
			})),
			// A box that cuts off what does not fit holds more than it shows. A row pages sideways, on purpose.
			clipped: [...layer.querySelectorAll(".overflow-hidden")].filter((el) => !el.hasAttribute("data-tv-row") && !el.hasAttribute("data-tv-item") && el.scrollHeight > el.clientHeight + 1).length,
			heading: heading ? rest(heading) : null,
			place: place ? rest(place) : null,
			row: row ? { scroll: row.scrollLeft, more: row.scrollWidth > row.clientWidth } : null,
			// How far the menu is raised over the screen under it, and the most anything of that screen is raised: a
			// focused tile and the bar's keys are, and they must not be drawn over a key of the menu.
			raised: (() => {
				const layers = [...room.querySelectorAll("[data-tv-layer]")]
				if (layers.length < 2) return null
				const z = (el) => Number.parseInt(getComputedStyle(el).zIndex, 10) || 0
				return { menu: z(layers.at(-1)), under: Math.max(0, ...[...layers[0].querySelectorAll("*")].map(z)) }
			})(),
			// The word "Menu" over the menu's keys.
			head: [...layer.querySelectorAll("[role=menu] > div")].some((el) => el.textContent === "Menu"),
			// The smallest type on the screen, in canvas pixels.
			type: Math.min(...[...layer.querySelectorAll("*")].filter((el) => [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())).map((el) => Number.parseFloat(getComputedStyle(el).fontSize))),
		}
	})

const meet = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5
const within = (a, b) => a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5

/**
 * A screen holds what it shows: touch targets, nothing over anything, nothing cut off, the corner free. `paged`:
 * the screen's row pages sideways, so the items of the row that are out of the picture do not count, and the
 * focused one must be in it.
 */
function fits(l, what, { touch = false, corner = true, paged = null } = {}) {
	const shown = paged ? l.items.filter((item) => !item.id.startsWith("title:") || within(item, l.tv)) : l.items
	if (paged) check(shown.some((item) => item.id === paged), `${what}: the focused show is inside the picture`)
	const small = shown.filter((item) => Math.min(item.width, item.height) < 44 - 0.05)
	if (touch) check(small.length === 0, `${what}: every key is 44 px or more on the phone's screen: ${small.map((item) => `${item.id} ${item.width.toFixed(1)} x ${item.height.toFixed(1)}`).join(", ") || "all"}`)
	const out = shown.filter((item) => !within(item, l.tv))
	check(out.length === 0, `${what}: every key is inside the picture: ${out.map((item) => item.id).join(", ") || "all"}`)
	const over = shown.flatMap((a, n) => shown.slice(n + 1).filter((b) => meet(a, b)).map((b) => `${a.id} and ${b.id}`))
	check(over.length === 0, `${what}: no key lies over another: ${over.join(", ") || "none"}`)
	check(l.clipped === 0, `${what}: nothing is cut off by its box`)
	const cut = shown.filter((item) => item.cut || item.lines > 2)
	check(cut.length === 0, `${what}: every key says its words in full: ${cut.map((item) => item.id).join(", ") || "all"}`)
	if (l.heading) check(within(l.heading, l.tv) && !shown.some((item) => meet(item, l.heading)), `${what}: the focused show's name is inside the picture and under no key`)
	check(l.type >= 20, `${what}: no type under 20 canvas px: ${l.type}`)
	if (corner) {
		if (l.place) {
			// The Expand key's cell: 158 canvas px wide on the phone, 220 on the desktop, as tall as a key.
			const size = touch ? [158, 54] : [220, 64]
			const cell = { right: l.place.right, bottom: l.place.bottom, left: l.place.right - size[0] * l.k, top: l.place.bottom - Math.max(size[1] * l.k, touch ? 44 : 0) }
			const inCorner = l.items.filter((item) => meet(item, cell))
			check(inCorner.length === 0, `${what}: the Expand key's corner is free: ${inCorner.map((item) => item.id).join(", ") || "free"}`)
		} else check(false, `${what}: the Expand key's corner is there`)
	}
	return { key: Math.min(...shown.map((item) => Math.min(item.width, item.height))) }
}
const px = (item) => `${Math.round(item.width)} x ${Math.round(item.height)}`

// ---------------------------------------------------------------------------------------------------------
// The walk: home's tile, My shows, a show's title screen and its Seen it key.

async function walk(size) {
	const touch = size !== DESKTOP
	where = `the walk, ${size.join("x")}`
	console.log(where)
	await reset("six")
	const { ctx, page, logs, requests, answers, left, stopped } = await open(memberUrl("six"), size)
	const backdrop = touch ? "/w780/" : "/w1280/"

	// ---- Arrival: nothing of a show's episodes is asked for, and nothing is written.
	let s = await until(page, (x) => x.items.includes("app:shows"), "a member's home has the My shows tile")
	// (Slice 6b put a tile for each of the member's two streaming services after My shows: services/drive.mjs.)
	is(s.items.filter((item) => !item.startsWith("service:")), ["app:tonight", "app:discover", "app:explorer", "app:taste", "app:shows", "bar:search", "bar:menu"], "home's items")
	await page.waitForTimeout(1500)
	check(!requests.some((r) => r.path.includes("ShowEpisode") || r.path.includes("use-tv-episode") || r.path.includes("/ui/tracking/")), "the code that marks an episode is not asked for on arrival")
	is(requests.filter((r) => r.what === "tracking-show").length, 0, "no show's tracking is read on arrival")
	is(requests.filter((r) => r.method !== "GET" && r.path !== "/api/e").length, 0, "nothing is written on arrival")
	const start = (await read(page)).history

	// ---- The tile: the home names My shows and shows one of the member's shows.
	for (const item of ["app:discover", "app:explorer", "app:taste", "app:shows"]) s = await key(page, "ArrowRight", item)
	s = await until(page, (x) => x.large === "My shows", "the home names the focused app")
	is(s.line, "Your next episodes.", "and says what it holds")
	is(s.badge, null, "nothing is new for this member: the tile has no number")
	s = await until(page, (x) => x.picture?.includes(backdrop), "the picture is one of the member's shows")
	is(s.history, start, "no focus move adds a history entry")

	// ---- My shows.
	await page.keyboard.press("Enter")
	s = await until(page, (x) => onShows(x) && focusIs(SIX[0])(x), "OK on the tile opens My shows")
	is(s.history, start + 1, "one history entry")
	is(s.items, [...SIX, ...BAR], "three shows with a Next episode, three to start, and the bar")
	is([s.name, s.crumb], ["My shows", "Your next episodes"], "the bar names the screen")
	is(s.heading, "Slow Horses", "the focused show is named")
	check(/^Next: S1 E4 · .+ · 45 min · 3 episodes left$/.test(s.facts ?? ""), `with its Next episode and what is left: ${s.facts}`)
	is(s.labels[SIX[0]], "Slow Horses, S1 E4 · 45 min", "a poster says the show and its Next episode to a screen reader")
	is(s.labels[SIX[3]].split(", ").at(-1), "Start", "a show to start says Start")
	if (touch) check(Object.values(s.posters).every((poster) => poster.on === null), "on the phone a poster has no words on it")
	else is(Object.values(s.posters).map((poster) => poster.on), ["S1 E4 · 45 min", "S2 E5 · 46 min", "S1 E10 · 47 min", "Start", "Start", "Start"], "on the desktop a poster says where a press leads")
	check(Object.values(s.posters).every((poster) => !poster.fresh), "no show is marked as new")
	s = await until(page, (x) => x.picture?.includes(backdrop) && Object.values(x.posters).filter((poster) => poster.loaded).length >= 3, "the picture and the posters are there", 40000)
	const first = s.picture
	// Along the row: the name, the line and the picture follow, and the row pages.
	s = await key(page, "ArrowRight", SIX[1])
	s = await until(page, (x) => x.heading === "Severance" && x.picture !== first, "the name and the picture follow the focus")
	for (const item of SIX.slice(2)) s = await key(page, "ArrowRight", item)
	check((s.facts ?? "").startsWith("To start"), `a show to start says what starting it takes: ${s.facts}`)
	await page.waitForTimeout(500)
	let l = await layout(page)
	fits(l, "My shows with the focus on its last show", { touch, paged: SIX[5] })
	check(l.row?.scroll > 0, "the row has paged to it")
	await page.keyboard.press("ArrowRight")
	await page.waitForTimeout(200)
	is((await read(page)).focus, [SIX[5]], "Right on the last show stays")
	// Up to the bar and back.
	await page.keyboard.press("ArrowUp")
	s = await until(page, (x) => x.focus[0]?.startsWith("bar:"), "Up reaches the top bar")
	check((await read(page)).heading !== null, "the screen keeps naming the show that had the focus")
	await page.keyboard.press("ArrowDown")
	s = await until(page, (x) => x.focus[0]?.startsWith("title:"), "Down returns to the shows")
	for (let n = 0; n < 6 && (await read(page)).focus[0] !== SIX[0]; n++) await page.keyboard.press("ArrowLeft")
	s = await until(page, focusIs(SIX[0]), "Left along the row returns to the first show")
	is(s.history, start + 1, "no focus move adds a history entry")
	is(requests.filter((r) => r.what === "new-episodes" && r.method !== "GET").length, 0, "opening My shows on the TV records no My shows visit")

	// ---- A show the member is midway through: Seen it marks the Next episode.
	await page.keyboard.press("Enter")
	s = await until(page, (x) => onTitle(101)(x) && x.heading === "Slow Horses", "OK on a show opens its title screen, named at once")
	is(s.history, start + 2, "one history entry more")
	s = await until(page, (x) => x.labels.seen === "Seen S1 E4", "the Seen it key names the Next episode")
	is(reads(requests, 101), 1, "the show's tracking is read once")
	is(marks(requests).length, 0, "and nothing is written by looking")
	await focusOn(page, "seen")
	const before = loaderRuns(requests)
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.labels.seen === "Seen S1 E5", "OK marks the episode, and the key names the one after it")
	is(s.toast, "S1 E4 seen", "the TV says which episode was marked")
	is([s.tv, s.title, s.history, s.focus], ["title", "show-101", start + 2, ["seen"]], "the screen stays, with the focus on the key")
	// The write: one request, to the harness, as the show's page sends it.
	await until(page, () => answers.length === 1, "the harness answers the watch")
	let sent = marks(requests)
	is(sent.map((one) => [one.id, one.event]), [[101, { type: "watch", season: 1, number: 4 }]], "one watch of that episode is sent")
	check(/^[0-9a-f-]{32,36}$/.test(sent[0]?.actionId ?? ""), "with an id made in the browser, so a request sent twice records once")
	is([answers[0]?.status, answers[0]?.json?.status], [200, "applied"], "and the harness applied it")
	await until(page, () => loaderRuns(requests) > before, "the page's loader runs again once the watch is stored")
	// One press an episode: by the Remote's OK key, then by the pointer or a finger on the key itself.
	await remote(page, "OK", touch)
	s = await until(page, (x) => x.labels.seen === "Seen S1 E6", "the Remote's OK key marks the next one")
	is(s.toast, "S1 E5 seen", "and the TV says so")
	await until(page, () => answers.length === 2, "the harness answers")
	await point(page, "seen", touch)
	s = await until(page, (x) => x.labels.seen === "Seen ✓", "the pointer or a finger marks the last aired one, and the show is Seen")
	is(s.toast, "S1 E6 seen, every episode watched", "the TV says it was the last")
	await until(page, () => answers.length === 3, "the harness answers")
	sent = marks(requests)
	is(sent.map((one) => one.event.number), [4, 5, 6], "three presses, three episodes, in order")
	is(new Set(sent.map((one) => one.actionId)).size, 3, "each watch with its own id")
	check(answers.every((answer) => answer.status === 200 && answer.json?.status === "applied"), "every watch was applied")
	is((await read(page)).history, start + 2, "no press added a history entry")
	// What the harness holds now, asked directly.
	const state = (await harness("six", "user-data")).watchState["show-101"]
	is([state?.state, state?.episodesWatched], ["seen", 6], "the member's show is Seen with six episodes watched")

	// ---- With no episode left the key asks how the show was, and records nothing more.
	await focusOn(page, "seen")
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.tv === "rate" && x.title === "show-101", "Seen it on a Seen show asks how it was")
	await page.waitForTimeout(400)
	is(marks(requests).length, 3, "no episode is marked by it")
	is(stopped.length, 0, "and no watch is sent: the show is Seen already")
	await page.keyboard.press("Escape")
	s = await until(page, (x) => onTitle(101)(x) && focusIs("seen")(x), "Back returns to the title with the focus on the key")

	// ---- Back on My shows the list is the loader's new one: the show has left it.
	await page.keyboard.press("Escape")
	s = await until(page, (x) => onShows(x) && !x.items.includes(SIX[0]), "Back shows My shows without the show that is Seen now")
	is(s.items.slice(0, 3), [102, 103, 104].map(show), "the next three shows to continue")
	is(s.focus, [show(102)], "the focus starts on the first show")
	is(s.heading, "Severance", "which the screen names")

	// ---- A show the member has not started: Seen it is the show's Seen press and the rating, as before.
	for (let n = 0; n < 5 && (await read(page)).focus[0] !== show(302); n++) await page.keyboard.press("ArrowRight")
	await until(page, focusIs(show(302)), "the focus on a show to start")
	await page.keyboard.press("Enter")
	s = await until(page, (x) => onTitle(302)(x) && x.heading === "Mr. Robot", "a show to start opens its title screen, named at once")
	await page.waitForTimeout(1200)
	is((await read(page)).labels.seen, "Seen it", "its key says Seen it")
	is(reads(requests, 302), 0, "a show not started costs no tracking read")
	await focusOn(page, "seen")
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.tv === "rate" && x.title === "show-302", "Seen it asks how it was")
	await until(page, () => stopped.length === 1, "and sends the show's Seen press")
	is(stopped.map((one) => [one.path, JSON.parse(one.body).tmdb_id, JSON.parse(one.body).media_type, JSON.parse(one.body).action]), [["/api/update-watch-history", 302, "show", "add"]], "which is the watch every title surface sends; the script stopped it in the browser")
	is(marks(requests).length, 3, "no episode is marked by it")

	// ---- Nothing else.
	is(requests.filter((r) => r.method !== "GET" && r.path !== "/api/e" && r.path !== HARNESS_API && r.path !== "/api/update-watch-history").length, 0, "no other write was tried")
	is(requests.filter((r) => r.what === "new-episodes" && r.method !== "GET").length, 0, "no My shows visit was recorded")
	is(beyondTelemetry(left), [], "no request left the machine but the site's own telemetry, which was stopped")
	is(noise(logs), [], "nothing in the console")
	numbers[`${where}: tracking reads, watches sent`] = [requests.filter((r) => r.what === "tracking-show" && r.method === "GET").length, marks(requests).length]
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// The New episodes signal: on home's tile and on My shows.

async function signal(size) {
	const touch = size !== DESKTOP
	where = `the signal, ${size.join("x")}`
	console.log(where)
	await reset("new")
	const { ctx, page, logs, requests, answers } = await open(memberUrl("new"), size)
	// ---- The tile carries the number, before any press.
	let s = await until(page, (x) => x.badge === "4", "home's My shows tile carries the signal's number", 30000)
	is(s.badgeSaid, "4 shows have new episodes", "and a screen reader hears what it counts")
	is((await harness("new", "new-episodes")).shows, 4, "it is the number the site's navigation is told")
	for (const item of ["app:discover", "app:explorer", "app:taste", "app:shows"]) s = await key(page, "ArrowRight", item)
	s = await until(page, (x) => x.large === "My shows", "the home names the focused app")
	is(s.line, "New in 4 shows.", "and says what is new")
	// ---- My shows marks the shows that are new.
	await page.keyboard.press("Enter")
	s = await until(page, (x) => onShows(x), "My shows opens")
	is(s.items, [...[201, 219, 202, 302, 303, 301].map(show), ...BAR], "the member's shows")
	is([s.name, s.crumb], ["My shows", "New in 4 shows"], "under the screen's name: what is new")
	is(Object.entries(s.posters).filter(([, poster]) => poster.fresh).map(([item]) => item), [show(202)], "the one show on the screen whose Next episode is new is marked")
	is(s.labels[show(202)], `Slow Horses, new, S6 E4${touch ? " · 48 min" : " · 48 min"}`, "and a screen reader hears that it is new")
	await key(page, "ArrowRight", show(219))
	s = await key(page, "ArrowRight", show(202))
	s = await until(page, (x) => x.heading === "Slow Horses", "the focus on it")
	check(/^New: S6 E4 · /.test(s.facts ?? ""), `its line says the new episode: ${s.facts}`)
	await page.waitForTimeout(600)
	is(requests.filter((r) => r.what === "new-episodes" && r.method !== "GET").length, 0, "the TV's My shows records no My shows visit")
	// ---- Watching the new episode takes the show out of the signal.
	await page.keyboard.press("Enter")
	s = await until(page, (x) => onTitle(202)(x) && x.labels.seen === "Seen S6 E4", "its title screen's key names the new episode")
	await focusOn(page, "seen")
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.toast === "S6 E4 seen, every episode watched", "OK marks it: it was the last aired one")
	await until(page, () => answers.length === 1 && answers[0].json?.status === "applied", "the harness applied the watch")
	await page.keyboard.press("Escape")
	s = await until(page, (x) => onShows(x) && x.crumb === "New in 3 shows", "My shows counts one show less", 30000)
	// The list is the loader's, which runs again once the watch is stored.
	s = await until(page, (x) => onShows(x) && !x.items.includes(show(202)), "and the show has left the list", 30000)
	check(Object.values(s.posters).every((poster) => !poster.fresh), "no show on the screen is new any more")
	await page.keyboard.press("Escape")
	s = await until(page, (x) => x.badge === "3", "home's tile carries the new number")
	is((await harness("new", "new-episodes")).shows, 3, "which is what the harness says")
	is(requests.filter((r) => r.what === "new-episodes" && r.method !== "GET").length, 0, "still no My shows visit")
	is(noise(logs), [], "nothing in the console")
	await ctx.close()

	// ---- A show that landed on one of the member's services joins the signal, and leads the shows to start.
	if (size !== DESKTOP) return
	where = "the signal, a show that landed"
	console.log(where)
	await reset("new", "&landed=show")
	const landed = await open(memberUrl("new", "&landed=show&tv=shows"), size)
	s = await until(landed.page, (x) => onShows(x) && x.crumb === "New in 5 shows", "My shows counts the show that landed with the four", 30000)
	is(Object.entries(s.posters).filter(([, poster]) => poster.fresh).map(([item]) => item), [show(202), show(303)], "and marks it beside the show with a new episode")
	for (const item of [219, 202, 303].map(show)) s = await key(landed.page, "ArrowRight", item)
	s = await until(landed.page, (x) => x.heading === "Station Eleven", "the focus on it")
	check(/^Now on Disney\+ · To start/.test(s.facts ?? ""), `its line leads with the service: ${s.facts}`)
	await landed.ctx.close()
	await reset("new")
}

// ---------------------------------------------------------------------------------------------------------
// The edges: a show on hold, a member without shows, a guest.

async function edges() {
	where = "a show on hold"
	console.log(where)
	await reset("six")
	{
		const { ctx, page, requests, stopped } = await open(memberUrl("six", "&tv=title&title=show-109"), DESKTOP)
		let s = await until(page, (x) => onTitle(109)(x) && Boolean(x.heading), "a link straight to a show on hold")
		await page.waitForTimeout(2000)
		s = await read(page)
		is(s.labels.seen, "Seen it", "its key says Seen it, not an episode")
		is(reads(requests, 109), 0, "its tracking is not read: a watch would end the hold the member chose")
		await focusOn(page, "seen")
		await page.keyboard.press("Enter")
		s = await until(page, (x) => x.tv === "rate", "Seen it asks how it was")
		await page.waitForTimeout(600)
		is([marks(requests).length, stopped.length], [0, 0], "and records neither an episode nor a watch")
		await ctx.close()
	}
	where = "a link straight to a show the member is midway through"
	console.log(where)
	{
		const { ctx, page, requests } = await open(memberUrl("six", "&tv=title&title=show-102"), PHONE)
		const s = await until(page, (x) => onTitle(102)(x) && x.labels.seen === "Seen S2 E5", "the key names the Next episode once the show's tracking is read", 30000)
		is(s.heading, "Severance", "the screen is named from My shows")
		is(marks(requests).length, 0, "nothing is written")
		// A reload keeps it.
		await page.reload({ waitUntil: "load" })
		await until(page, (x) => onTitle(102)(x) && x.labels.seen === "Seen S2 E5", "after a reload too", 30000)
		await ctx.close()
	}
	where = "a member without shows"
	console.log(where)
	for (const size of [DESKTOP, PHONE]) {
		const { ctx, page } = await open(memberUrl("empty", "&tv=shows"), size)
		const s = await until(page, (x) => x.tv === "shows" && x.text.includes("No show for tonight"), `${size.join("x")}: My shows says there is none`)
		is([s.items, s.focus], [BAR, ["bar:back"]], "with the bar alone, and the focus on Back")
		check(s.text.includes("Want to See on a show puts it here to start."), "and how a show gets here")
		fits(await layout(page), `${size.join("x")}: My shows without shows`, { touch: size !== DESKTOP })
		await ctx.close()
	}
	where = "a member with shows to start only"
	console.log(where)
	{
		const { ctx, page } = await open(memberUrl("none", "&tv=shows"), DESKTOP)
		const s = await until(page, (x) => onShows(x), "My shows opens")
		is([s.crumb, s.items.length], ["Shows to start", 3 + BAR.length], "three shows to start, named as such")
		await ctx.close()
	}
}

async function guest() {
	where = "a guest"
	console.log(where)
	const { ctx, page, requests } = await open(`${GUEST}?tv=shows`, DESKTOP)
	const s = await until(page, (x) => x.items.includes("app:tonight"), "a guest's link to My shows shows home")
	check(!s.items.includes("app:shows"), "which has no My shows tile")
	is(s.badge, null, "and no number")
	await page.mouse.move(400, 400)
	await page.waitForTimeout(1500)
	check(!requests.some((r) => r.path.includes("screens/Shows") || r.path.includes("ShowEpisode") || r.path.includes("use-tv-shows") || r.path.includes("use-tv-episode")), "a guest's page asks for none of My shows' code, on arrival or after the first interaction")
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// Every key on every phone of the room's table: My shows, a show's title screen, the menu, What is GoodWatch?

async function sizes() {
	await reset("six")
	for (const size of [...PHONES, DESKTOP]) {
		const touch = size !== DESKTOP
		where = `sizes ${size.join("x")}`
		console.log(where)
		const smallest = {}
		const { ctx, page } = await open(memberUrl("six", "&tv=shows"), size, { touch })
		numbers[`${where}: the room`] = await page.evaluate(() => {
			const room = document.getElementById("room")
			return [room.dataset.room, room.dataset.remotePlace].filter(Boolean).join(", ")
		})
		// My shows, the focus on its first show.
		let s = await until(page, (x) => onShows(x) && Object.values(x.posters).filter((poster) => poster.loaded).length >= 3, "My shows", 40000)
		let l = await layout(page)
		smallest.shows = fits(l, "My shows", { touch, paged: SIX[0] }).key
		const posters = l.items.filter((item) => item.id.startsWith("title:"))
		check(posters.every((poster) => Math.abs(poster.width - posters[0].width) < 0.6 && Math.abs(poster.height - posters[0].height) < 0.6), "six posters of one size")
		numbers[`${where}: a poster, px`] = px(posters[0])
		// The focus on the last show: the row pages it into the picture.
		for (let n = 0; n < 5; n++) await page.keyboard.press("ArrowRight")
		await until(page, focusIs(SIX[5]), "the focus on the last show")
		await page.waitForTimeout(500)
		fits(await layout(page), "My shows with the focus on its last show", { touch, paged: SIX[5] })
		// A show's title screen with the key that names its Next episode.
		for (let n = 0; n < 5; n++) await page.keyboard.press("ArrowLeft")
		await until(page, focusIs(SIX[0]), "the focus on the first show")
		await page.keyboard.press("Enter")
		s = await until(page, (x) => onTitle(101)(x) && x.labels.seen === "Seen S1 E4", "a show's title screen with its Next episode", 30000)
		await page.waitForTimeout(500)
		l = await layout(page)
		smallest.title = fits(l, "a show's title screen", { touch }).key
		numbers[`${where}: the Seen it key, px`] = px(l.items.find((item) => item.id === "seen"))
		// A member's menu: four keys.
		await page.keyboard.press("m")
		s = await until(page, (x) => x.layers === 2 && x.items.length === 4, "a member's menu")
		await page.waitForTimeout(400)
		l = await layout(page)
		smallest.menuMember = fits(l, "a member's menu", { touch, corner: false }).key
		check(l.raised && l.raised.menu > l.raised.under, `a member's menu lies over everything of My shows under it: ${JSON.stringify(l.raised)}`)
		check(l.head, "the word Menu stands over a member's four keys")
		await page.keyboard.press("m")
		await ctx.close()

		// A guest's menu, five keys, and What is GoodWatch?
		const visitor = await open(GUEST, size, { touch })
		await visitor.page.keyboard.press("m")
		s = await until(visitor.page, (x) => x.layers === 2 && x.items.length === 5, "a guest's menu", 30000)
		is(s.items, ["menu:home", "menu:search", "menu:sign-in", "menu:about", "menu:off"], "its five keys")
		await visitor.page.waitForTimeout(400)
		l = await layout(visitor.page)
		smallest.menu = fits(l, "a guest's menu", { touch, corner: false }).key
		check(l.raised && l.raised.menu > l.raised.under, `a guest's menu lies over everything of home under it, its focused tile and its bar's keys: ${JSON.stringify(l.raised)}`)
		const keys = l.items.map((item) => item.height)
		check(Math.max(...keys) - Math.min(...keys) < 0.6, "the menu's keys are one height")
		numbers[`${where}: a menu key, px, and the word Menu`] = [px(l.items[0]), l.head]
		// The keys do what they say at this size: Down along them, and OK on What is GoodWatch?
		for (const item of ["menu:search", "menu:sign-in", "menu:about"]) await key(visitor.page, "ArrowDown", item)
		await visitor.page.keyboard.press("Enter")
		s = await until(visitor.page, (x) => x.tv === "about" && x.layers === 1 && x.items.includes("got-it"), "What is GoodWatch? opens from the menu", 30000)
		await visitor.page.waitForTimeout(500)
		l = await layout(visitor.page)
		smallest.about = fits(l, "What is GoodWatch?", { touch, corner: false }).key
		const answers = l.items.filter((item) => !item.id.startsWith("bar:"))
		numbers[`${where}: an answer of What is GoodWatch?, px`] = px(answers[0])
		// Its words start under the bar's keys.
		const words = await visitor.page.evaluate(() => {
			const layer = [...document.querySelectorAll("#room [data-tv-layer]")].at(-1)
			const kicker = [...layer.querySelectorAll("div")].find((el) => el.textContent === "What is GoodWatch?" && !el.querySelector("*"))
			return kicker?.getBoundingClientRect().top ?? null
		})
		const bar = Math.max(...l.items.filter((item) => item.id.startsWith("bar:")).map((item) => item.bottom))
		if (touch) check(words !== null && words >= bar - 0.5, `the words start under the bar's keys: ${words?.toFixed(1)} against ${bar.toFixed(1)}`)
		await visitor.ctx.close()
		numbers[`${where}: the smallest key, px`] = Object.fromEntries(Object.entries(smallest).map(([screen, value]) => [screen, Math.round(value * 10) / 10]))
	}
}

// ---------------------------------------------------------------------------------------------------------
// Screenshots, and the sheets beside the prototype's.

async function shots() {
	const dir = join(here, "shots")
	mkdirSync(dir, { recursive: true })
	const shot = async (page, name) => {
		await page.waitForTimeout(900)
		await page.screenshot({ path: join(dir, `${name}.jpg`), quality: 82 })
	}
	const loaded = (page) => until(page, (x) => Boolean(x.picture) && Object.values(x.posters).every((poster) => poster.loaded), "the pictures", 40000)
	const kinds = process.env.SHOTS?.split(",")
	const kind = (name) => !kinds || kinds.includes(name)
	for (const [size, edition] of [
		[DESKTOP, "desktop"],
		[PHONE, "phone"],
	]) {
		const touch = size !== DESKTOP
		console.log("shots", edition)
		// A member: home's tile with the signal, My shows with a new show, a show's title screen and the mark.
		if (kind("member")) await reset("new")
		if (kind("member")) {
			const { ctx, page } = await open(memberUrl("new"), size)
			await until(page, (x) => x.badge === "4", "the tile's number", 30000)
			for (const item of ["app:discover", "app:explorer", "app:taste", "app:shows"]) await key(page, "ArrowRight", item)
			await until(page, (x) => x.large === "My shows" && Boolean(x.picture), "home on My shows")
			await shot(page, `home-tile-signal-member-${edition}`)
			await page.keyboard.press("Enter")
			await until(page, onShows, "My shows")
			await loaded(page)
			await shot(page, `shows-signal-member-${edition}`)
			await key(page, "ArrowRight", show(219))
			await key(page, "ArrowRight", show(202))
			await loaded(page)
			await shot(page, `shows-new-episode-member-${edition}`)
			await ctx.close()
		}
		if (kind("member")) await reset("six")
		if (kind("member")) {
			const { ctx, page } = await open(memberUrl("six", "&tv=shows"), size)
			await until(page, onShows, "My shows")
			await loaded(page)
			await shot(page, `shows-member-${edition}`)
			for (const item of SIX.slice(1, 5)) await key(page, "ArrowRight", item)
			await loaded(page)
			await shot(page, `shows-to-start-member-${edition}`)
			for (let n = 0; n < 4; n++) await page.keyboard.press("ArrowLeft")
			await until(page, focusIs(SIX[0]), "the first show")
			await page.keyboard.press("Enter")
			await until(page, (x) => onTitle(101)(x) && x.labels.seen === "Seen S1 E4" && Boolean(x.picture), "a show's title screen", 30000)
			await focusOn(page, "seen")
			await shot(page, `title-next-episode-member-${edition}`)
			await page.keyboard.press("Enter")
			await until(page, (x) => x.toast === "S1 E4 seen", "the mark")
			await page.waitForTimeout(250)
			await page.screenshot({ path: join(dir, `title-episode-marked-member-${edition}.jpg`), quality: 82 })
			await page.keyboard.press("Escape")
			await until(page, onShows, "My shows")
			await page.keyboard.press("m")
			await until(page, (x) => x.layers === 2, "the menu")
			await shot(page, `menu-member-${edition}`)
			await ctx.close()
		}
		if (kind("member")) {
			const { ctx, page } = await open(memberUrl("empty", "&tv=shows"), size)
			await until(page, (x) => x.text.includes("No show for tonight"), "no shows")
			await shot(page, `shows-none-member-${edition}`)
			await ctx.close()
		}
		// A guest: the menu and What is GoodWatch?
		if (kind("guest")) {
			const { ctx, page } = await open(GUEST, size, { touch })
			// The first press brings the guest's own picks: the home's picture is theirs before the menu opens.
			await page.keyboard.press("ArrowRight")
			await page.keyboard.press("ArrowLeft")
			await page.waitForTimeout(4000)
			await page.keyboard.press("m")
			await until(page, (x) => x.layers === 2 && x.items.length === 5, "a guest's menu", 30000)
			await shot(page, `menu-guest-${edition}`)
			for (const item of ["menu:search", "menu:sign-in", "menu:about"]) await key(page, "ArrowDown", item)
			await page.keyboard.press("Enter")
			await until(page, (x) => x.tv === "about" && x.items.includes("got-it"), "What is GoodWatch?", 30000)
			await shot(page, `about-guest-${edition}`)
			await ctx.close()
		}
	}
	// The menu and What is GoodWatch? on each phone of the table, the short one among them.
	for (const size of PHONES) {
		const name = size.join("x")
		console.log("shots", name)
		if (kind("guest")) {
			const { ctx, page } = await open(GUEST, size, { touch: true })
			await page.keyboard.press("ArrowRight")
			await page.keyboard.press("ArrowLeft")
			await page.waitForTimeout(4000)
			await page.keyboard.press("m")
			await until(page, (x) => x.layers === 2 && x.items.length === 5, "a guest's menu", 30000)
			await shot(page, `menu-guest-${name}`)
			for (const item of ["menu:search", "menu:sign-in", "menu:about"]) await key(page, "ArrowDown", item)
			await page.keyboard.press("Enter")
			await until(page, (x) => x.tv === "about" && x.items.includes("got-it"), "What is GoodWatch?", 30000)
			await shot(page, `about-guest-${name}`)
			await ctx.close()
		}
		if (kind("member")) {
			const member = await open(memberUrl("six", "&tv=shows"), size, { touch: true })
			await until(member.page, onShows, "My shows")
			await loaded(member.page)
			await shot(member.page, `shows-member-${name}`)
			await member.ctx.close()
		}
	}
	if (kind("member")) await reset("six")
	if (!kind("sheets")) return

	// The sheets: ours beside the prototype's shot of the same screen.
	const uri = (file) => `data:image/jpeg;base64,${readFileSync(file).toString("base64")}`
	const ours = (name) => uri(join(dir, `${name}.jpg`))
	const theirs = (name) => uri(join(prototype, "screens/cinema", `${name}.jpg`))
	const cell = (src, caption, width) => `<figure><img src="${src}" width="${width}"><figcaption>${caption}</figcaption></figure>`
	const sheet = async (name, width, body) => {
		const ctx = await browser.newContext({ viewport: { width, height: 600 }, deviceScaleFactor: 1 })
		const page = await ctx.newPage()
		await page.setContent(`<style>body{margin:0;padding:16px;background:#14161b;color:#fff;font:15px system-ui}h2{font-size:18px;margin:18px 0 8px}div{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start}figure{margin:0}img{display:block}figcaption{padding:4px 0 0;color:#cbd5e1;max-width:940px}</style>${body}`)
		await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode())))
		await page.screenshot({ path: join(here, `${name}.jpg`), quality: 80, fullPage: true })
		await ctx.close()
	}
	const pair = (title, their, our, note, width) => `<h2>${title}</h2><div>${cell(theirs(their), "prototype (sample data)", width)}${cell(ours(our), note, width)}</div>`
	const row = (title, names, width) => `<h2>${title}</h2><div>${names.map(([name, note, own]) => cell(ours(name), note, own ?? width)).join("")}</div>`
	await sheet(
		"desktop-beside-prototype",
		1960,
		[
			pair("1920 x 1080, My shows as a member", "19-my-shows-desktop", "shows-member-desktop", "slice 9: the harness's sample member. The line says the Next episode and what is left. The Expand key is slice 11's; its corner is kept free", 956),
			pair("The menu", "14-menu-desktop", "menu-guest-desktop", "slice 9: unchanged on the desktop (a guest's, with Sign in)", 956),
			row(
				"The New episodes signal, shows to start, a show's title screen and its Seen it key, a member without shows",
				[
					["home-tile-signal-member-desktop", "home's My shows tile carries the signal's number, and the home says what is new"],
					["shows-signal-member-desktop", "My shows: what is new under its name, New on the show whose Next episode is new"],
					["shows-new-episode-member-desktop", "the focus on that show: its line says the new episode"],
					["shows-to-start-member-desktop", "the focus on a show to start; the row has paged"],
					["title-next-episode-member-desktop", "a show the member is midway through: the key names the episode it marks"],
					["title-episode-marked-member-desktop", "after OK: the TV says which episode, and the key names the one after it"],
					["shows-none-member-desktop", "a member without a show to continue or to start"],
					["menu-member-desktop", "a member's menu"],
				],
				956,
			),
		].join(""),
	)
	await sheet(
		"phone-beside-prototype",
		1750,
		[
			`<h2>390 x 844: the prototype (left of each pair) and slice 9 (right). My shows, the menu, What is GoodWatch?</h2><div>${[
				["19-my-shows-phone", "shows-member-phone"],
				["14-menu-phone", "menu-guest-phone"],
				["15-about-phone", "about-guest-phone"],
			]
				.map(([their, our]) => cell(theirs(their), "prototype", 270) + cell(ours(our), "slice 9", 270))
				.join("")}</div>`,
			row(
				"The signal, a show's title screen and its Seen it key, a member without shows",
				[
					["home-tile-signal-member-phone", "home's tile with the signal's number"],
					["shows-signal-member-phone", "My shows: New in 4 shows"],
					["shows-new-episode-member-phone", "the focus on the new show"],
					["shows-to-start-member-phone", "a show to start"],
					["title-next-episode-member-phone", "the key names the episode"],
					["title-episode-marked-member-phone", "after OK"],
					["shows-none-member-phone", "no shows"],
					["menu-member-phone", "a member's menu"],
				],
				270,
			),
			row(
				"The menu's keys are touch targets on every phone of the room's table (a guest's five keys)",
				PHONES.map((size) => [`menu-guest-${size.join("x")}`, size.join(" x "), size[0] > size[1] ? 470 : 250]),
				250,
			),
			row(
				"What is GoodWatch? on the same phones",
				PHONES.map((size) => [`about-guest-${size.join("x")}`, size.join(" x "), size[0] > size[1] ? 470 : 250]),
				250,
			),
			row(
				"My shows on the same phones",
				PHONES.map((size) => [`shows-member-${size.join("x")}`, size.join(" x "), size[0] > size[1] ? 470 : 250]),
				250,
			),
		].join(""),
	)
}

// A dev server builds a page's code at its first request, and a load that falls into that reloads the page: the
// pages of the run are asked for once before anything is checked.
const SHOT_KINDS = only === "shots" ? process.env.SHOTS?.split(",") : undefined
const warm = [
	...(!SHOT_KINDS || SHOT_KINDS.includes("member") ? [memberUrl("six", "&tv=shows"), memberUrl("six", "&tv=title&title=show-102")] : []),
	...(!SHOT_KINDS || SHOT_KINDS.includes("guest") ? [GUEST, `${GUEST}?tv=about`] : []),
]
for (const size of [DESKTOP, PHONE])
	for (const url of warm) {
		const { ctx, page } = await open(url, size)
		await page.mouse.move(300, 300)
		await page.keyboard.press("m")
		await page.waitForTimeout(4000)
		await ctx.close()
	}
passed = 0
failed.length = 0

if (only !== "shots") {
	// PARTS=walk,signal,edges,sizes,guest runs some of the checks; checks.json is written by a whole run only.
	const parts = process.env.PARTS?.split(",")
	const part = (name) => !parts || parts.includes(name)
	if (part("walk")) for (const size of [DESKTOP, PHONE]) await walk(size)
	if (part("signal")) for (const size of [DESKTOP, PHONE]) await signal(size)
	if (part("edges")) await edges()
	if (part("guest")) await guest()
	if (part("sizes")) await sizes()
	if (!parts) writeFileSync(join(here, "checks.json"), `${JSON.stringify({ passed, failed, numbers }, null, "\t")}\n`)
	else console.log(JSON.stringify(numbers, null, 1))
}
if (only !== "checks") await shots()
// The watches of the run are gone from the harness.
if (!SHOT_KINDS || SHOT_KINDS.includes("member")) {
	await reset("new")
	await reset("six")
}
await browser.close()
console.log(`${passed} checks passed, ${failed.length} failed`)
for (const line of failed) console.log(" -", line)
process.exit(failed.length ? 1 : 0)
