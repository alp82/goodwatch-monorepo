// Slice 11 of the new TV (the Expand key): draws and measures the key on every screen that has one, leaves through
// it from each of them into the real page, checks what travelled, and returns three ways (the browser's Back,
// Escape, the TV button) into the same TV screen with the focus on the key. It also watches the motion's marks,
// calls a page off while it is on its way, runs with reduced motion, goes two and three pages deep, reloads the
// page, parks the pointer over a tile, leaves from every layout of the room, and looks for anything that still
// animates at rest. And it settles two timings of slice 5's script (the part `timing`).
//
//   PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs SIDE=guest GUEST=http://localhost:3411 node drive.mjs
//   PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs SIDE=member MEMBER=http://localhost:3412 node drive.mjs
//
// One dev server at a time: SIDE=guest with the reading server alone, then SIDE=member with the harness's alone
// (README.md here has both commands). The guest's half keeps its count in a file (STOCK=); the member's half
// writes checks.json for both. `drive.mjs checks` and `drive.mjs shots` do one of the two;
// PARTS=key,trips,motion,cancel,calm,deep,reload,pointer,layouts,rest,explorer,timing runs some of the checks.
//
// A search is stood in for, as in ../search/drive.mjs: the reading server refuses one, and a real one would be
// written to the search history. Never on port 3003. The script signs in nowhere and writes to no server.
//
// The repo has no browser driver: install playwright-core outside it. Clips need ffmpeg.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const ORIGIN = process.env.GUEST ?? "http://localhost:3411"
const GUEST = `${ORIGIN}/home-preview`
const MEMBER_ORIGIN = process.env.MEMBER ?? "http://localhost:3412"
const MEMBER = `${MEMBER_ORIGIN}/prototype/my-library-real/tv?member=six&session=on`
const prototype = process.env.PROTOTYPE ?? "/home/alper/projects/goodwatch-monorepo-38caebf4/docs/prototypes/tv-screen-design"
const only = process.argv[2]
const SIDE = process.env.SIDE ?? "guest"
const guestSide = SIDE === "guest"
const STOCK = process.env.STOCK ?? join(tmpdir(), "tv-drive-expand-stock.json")
const PARTS = (process.env.PARTS ?? "key,trips,motion,cancel,calm,deep,reload,pointer,layouts,rest,explorer,timing").split(",")
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")
if ([ORIGIN, MEMBER_ORIGIN].some((origin) => new URL(origin).port === "3003")) throw new Error("Not on port 3003: a search from there is not refused")

const DESKTOP = [1920, 1080]
const BESIDE = [1366, 650]
const PHONE = [390, 844]
const SHORT = [375, 667]
const LANDSCAPE = [844, 390]
const MATRIX = { key: "movie-603", name: "The Matrix", path: "/movie/603-the-matrix" }
const PROGRESS_KEY = "onboarding_ratings"
const TRIP_KEY = "living-room:left-through-tv"

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
const near = (a, b, by = 1) => Math.abs(a - b) <= by
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const json = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
const tvKey = (title) => `${title.media_type}-${title.tmdb_id}`
const rowKey = (title) => `${title.media_type}:${title.tmdb_id}`
const catalogKey = (title) => (title.media_type === "movie" ? 1e12 : 2e12) + title.tmdb_id
const keyOfHref = (href) => {
	const [, kind, id] = /^\/(movie|show)\/(\d+)/.exec(href) ?? []
	return kind ? `${kind}-${id}` : href
}

/** What a guest's browser holds. Eighteen scores in three kinds: enough loved titles for sides (../taste/drive.mjs). */
const t0 = Date.UTC(2026, 9, 1)
const scored = (rows) => JSON.stringify(rows.map(([media_type, tmdb_id, score], at) => ({ media_type, tmdb_id, type: "score", score, timestamp: t0 + at * 60000 })))
const FRESH = { country: "US", guest_progress_reminder_dismissed: "yes" }
const WITH_SIDES = {
	...FRESH,
	[PROGRESS_KEY]: scored([
		["show", 1396, 10], ["show", 60059, 9], ["show", 1398, 9], ["show", 1438, 10], ["show", 46648, 9], ["show", 67744, 8], ["show", 60622, 9],
		["show", 2316, 9], ["show", 8592, 9], ["show", 48891, 8], ["show", 97546, 9], ["movie", 346648, 9],
		["movie", 157336, 10], ["movie", 329865, 9], ["movie", 27205, 9], ["movie", 335984, 9], ["movie", 264660, 8],
		["movie", 19995, 4],
	]),
}

// ---------------------------------------------------------------------------------------------------------
// The stand-in for the search (../search/drive.mjs): a ranked list of real titles, answered in the browser.

let ranked = []
async function keepRanked() {
	for (let tries = 0; ; tries += 1) {
		const response = await fetch(`${ORIGIN}/api/discover/results?themes=crime&page=1`, json({ guest: { interactions: [], country: "US", services: null } }))
		if (response.ok) {
			ranked = ((await response.json()).cards ?? []).slice(0, 24).map((card) => ({ media_type: card.media_type, tmdb_id: card.tmdb_id, title: card.title }))
			return
		}
		if (tries > 40) throw new Error(`Discover's results did not come: ${response.status}`)
		// The title snapshot loads for a while after a start.
		await sleep(5000)
	}
}
const BATCH = { reading: [], metadata: [], errors: [], mode: "en", elapsedMs: 800, chargedNano: 0, people: [], creditScope: null }
async function standIn(target) {
	const searches = []
	await target.route("**/api/combined-search", (route) => {
		const body = JSON.parse(route.request().postData() ?? "null")
		searches.push(body)
		return route
			.fulfill({
				status: 200,
				contentType: "application/x-ndjson; charset=utf-8",
				body: `${JSON.stringify({ kind: "reading", reading: [] })}\n${JSON.stringify({ kind: "batch", batch: { q: String(body?.q ?? ""), rows: ranked.map((title) => ({ key: rowKey(title) })), ...BATCH } })}\n`,
			})
			.catch(() => {})
	})
	return searches
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--use-angle=gl", "--ignore-gpu-blocklist"] })

/** What every page of a run gets: nothing leaves the machine but the pictures, and nothing is written. */
async function guard(target, { left = [], writes = [] } = {}) {
	await target.route(
		(u) => !["localhost", "127.0.0.1", "image.tmdb.org"].includes(u.hostname) && u.protocol.startsWith("http"),
		(route) => {
			left.push(route.request().url())
			return route.fulfill({ status: 204, body: "" })
		},
	)
	await target.route("**/api/e", (route) => route.fulfill({ status: 200, body: "" }))
	await target.route(/\/api\/(update-[a-z-]+|poster-impressions)/, (route) => {
		const path = new URL(route.request().url()).pathname
		if (path !== "/api/poster-impressions") writes.push(path)
		return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success" }) })
	})
}

/** Opens a page. A busy machine times a load out now and then: try again, twice. */
async function open(url, [width, height], { touch = width < 768 || height < 541, tries = 3, storage = FRESH, room = true, reducedMotion = false, video, before } = {}) {
	const ctx = await browser.newContext({
		viewport: { width, height },
		deviceScaleFactor: touch ? 2 : 1,
		...(touch ? { isMobile: true, hasTouch: true } : {}),
		reducedMotion: reducedMotion ? "reduce" : "no-preference",
		...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}),
	})
	await ctx.addInitScript((entries) => {
		if (sessionStorage.getItem("drive:seeded")) return
		sessionStorage.setItem("drive:seeded", "1")
		for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value)
	}, storage)
	const searches = await standIn(ctx)
	const left = []
	const writes = []
	await guard(ctx, { left, writes })
	await before?.(ctx)
	const page = await ctx.newPage()
	const logs = []
	const requests = []
	page.on("console", (m) => {
		if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text()}`)
	})
	page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`))
	page.on("request", (r) => requests.push({ url: r.url(), path: new URL(r.url()).pathname, method: r.method() }))
	try {
		await page.goto(url, { waitUntil: "load", timeout: 180000 })
		// The Explorer's page keeps its `main` out of sight under the map: a page without the room is waited for by its body.
		await page.waitForSelector(room ? "#room:not([data-room=unmeasured]) [data-tv-item]" : "body", { timeout: 180000 })
		// The dev tools' round key is no part of the page.
		await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" })
		await page.waitForTimeout(600)
	} catch (error) {
		await ctx.close().catch(() => {})
		if (tries <= 1) throw error
		console.log("loading again:", String(error.message).split("\n")[0])
		await sleep(4000)
		return open(url, [width, height], { touch, tries: tries - 1, storage, room, reducedMotion, video, before })
	}
	return { ctx, page, logs, requests, searches, left, writes, touch }
}

/** What the window shows: the TV's screen while the room is there, and the marks of a trip through the TV. */
const read = (page) =>
	page.evaluate((tripKey) => {
		const box = (el) => {
			const b = el.getBoundingClientRect()
			return { x: +b.left.toFixed(2), y: +b.top.toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2) }
		}
		const visible = (el) => {
			const b = el.getBoundingClientRect()
			const style = getComputedStyle(el)
			return b.width > 0 && b.height > 0 && style.visibility !== "hidden" && Number(style.opacity) > 0.5
		}
		let trip = null
		try {
			trip = JSON.parse(sessionStorage.getItem(tripKey) ?? "null")
		} catch {}
		const base = {
			path: location.pathname,
			search: location.search,
			hash: location.hash,
			idx: history.state?.idx ?? null,
			mark: document.documentElement.dataset.tvTransition ?? null,
			fixed: [...document.querySelectorAll("[data-tv-bracket]")].map(box),
			wayBack: [...document.querySelectorAll("[data-tv-back]")].filter(visible).map(box),
			trip,
			title: document.title,
			// A title's page has drawn its header: the page on show is the title's, not the one before it.
			details: Boolean(document.querySelector("[data-details-header]")),
			h1: document.querySelector("main h1, h1")?.textContent?.trim() ?? null,
		}
		const room = document.getElementById("room")
		if (!room) return { ...base, room: false, items: [], focus: [], labels: {}, aria: {}, boxes: {}, layers: 0, own: [] }
		const layers = [...room.querySelectorAll("[data-tv-layer]")]
		const top = layers.at(-1)
		const items = top ? [...top.querySelectorAll("[data-tv-item]")] : []
		const id = (el) => el.getAttribute("data-tv-item")
		const tv = room.querySelector("[data-tv-screen]")
		const screen = room.querySelector(".tvc")
		return {
			...base,
			room: true,
			edition: room.dataset.room,
			place: room.dataset.remotePlace ?? null,
			form: room.dataset.remoteForm ?? null,
			layers: layers.length,
			items: items.map(id),
			focus: items.filter((el) => el.getAttribute("aria-current")).map(id),
			labels: Object.fromEntries(items.map((el) => [id(el), el.textContent])),
			aria: Object.fromEntries(items.map((el) => [id(el), el.getAttribute("aria-label")])),
			boxes: Object.fromEntries(items.map((el) => [id(el), box(el)])),
			tv: tv ? box(tv) : null,
			framed: Boolean(tv?.hasAttribute("data-tv-framed")),
			// How large the picture is drawn in its box: 0.94 while it stands in its frame.
			back: screen ? +new DOMMatrix(getComputedStyle(screen).transform).a.toFixed(4) : null,
			own: [...room.querySelectorAll(".tvr-bracket")].map((el) => ({ ...box(el), shown: getComputedStyle(el).visibility !== "hidden" })),
			ring: room.querySelector(".tvp") ? { shown: room.querySelector(".tvp").dataset.shown ?? null, out: room.querySelector(".tvp").dataset.out ?? null } : null,
			text: top?.innerText ?? "",
		}
	}, TRIP_KEY)

/** Waits until the window's state says `want`, then returns the state. */
async function until(page, want, what, timeout = 30000) {
	const end = Date.now() + timeout
	let now
	for (;;) {
		now = await read(page).catch(() => null)
		// A wait that ends in time is a check that passed.
		if (now && want(now)) {
			passed += 1
			return now
		}
		if (Date.now() > end) {
			check(false, `${what}: still ${JSON.stringify(now && { path: now.path, search: now.search, room: now.room, focus: now.focus, items: now.items, mark: now.mark, framed: now.framed })}`)
			return now ?? { items: [], focus: [], labels: {}, aria: {}, boxes: {}, own: [], fixed: [], wayBack: [] }
		}
		await page.waitForTimeout(60)
	}
}
async function eventually(page, want, what, timeout = 30000) {
	const end = Date.now() + timeout
	for (;;) {
		const got = await want()
		if (got) {
			passed += 1
			return got
		}
		if (Date.now() > end) {
			check(false, what)
			return null
		}
		await page.waitForTimeout(80)
	}
}
const focusIs = (item) => (s) => s.focus.length === 1 && s.focus[0] === item
const onTv = (search) => (s) => s.room && s.edition !== "unmeasured" && s.search === search && s.layers === 1
/** The TV screen of an address, with the Expand key focused and the picture in its frame. */
const backOn = (search) => (s) => onTv(search)(s) && focusIs("expand")(s) && s.framed && s.mark === null
const item = (page, id) => page.locator(`#room [data-tv-layer] [data-tv-item="${id}"]`).last()
const remoteKey = (page, label) =>
	label === "OK"
		? page.locator('#room [aria-label="Remote control"] button', { hasText: /^OK$/ })
		: page.locator(`#room [aria-label="Remote control"] button[aria-label="${label}"]`)
// What a dev server's console says on any page. The last is the Discover page's own, on a touch device: its poster
// cards take the answer "this pointer cannot hover" as one transition for all of them (ui/title-actions/pointer.ts).
const noise = (logs) => logs.filter((l) => !l.includes("large number of updates inside startTransition") && !l.includes("Future Flag") && !l.includes("net::ERR_FAILED") && !l.includes("503") && !l.includes("403") && !l.includes("Failed to load resource") && !l.includes("Swiper Loop Warning"))

/**
 * Moves the focus to the Expand key with the direction keys: Down while that moves the focus, else Right. Returns
 * the keys pressed, or null when the key cannot be reached.
 */
async function reach(page) {
	const pressed = []
	for (let n = 0; n < 12; n += 1) {
		const now = await read(page)
		if (focusIs("expand")(now)) return pressed
		for (const name of ["ArrowDown", "ArrowRight"]) {
			await page.keyboard.press(name)
			await page.waitForTimeout(140)
			const next = await read(page)
			if (!same(next.focus, now.focus)) {
				pressed.push(name)
				break
			}
		}
	}
	return focusIs("expand")(await read(page)) ? pressed : null
}

// ---------------------------------------------------------------------------------------------------------
// The record of a trip: the marks the motion sets on <html>, its animations and its brackets, with their times.
// It lives in the page and survives the change of page, which happens inside the same document.

const record = (page) =>
	page.evaluate(() => {
		if (window.__trip) {
			window.__trip.log.length = 0
			return
		}
		const log = []
		const html = document.documentElement
		const note = (what, extra) => log.push({ t: Math.round(performance.now()), what, room: Boolean(document.getElementById("room")), ...extra })
		new MutationObserver(() => note("mark", { mark: html.dataset.tvTransition ?? null, brackets: document.querySelectorAll("[data-tv-bracket]").length })).observe(html, {
			attributes: true,
			attributeFilter: ["data-tv-transition"],
		})
		for (const type of ["animationstart", "animationend"])
			html.addEventListener(type, (e) => {
				if (e.animationName.startsWith("living-room-tv-")) note(type, { name: e.animationName, pseudo: e.pseudoElement, elapsed: e.elapsedTime })
			})
		let count = document.querySelectorAll("[data-tv-bracket]").length
		new MutationObserver(() => {
			const now = document.querySelectorAll("[data-tv-bracket]").length
			if (now !== count) note("brackets", { brackets: now })
			count = now
		}).observe(document.body, { childList: true })
		const push = history.pushState.bind(history)
		history.pushState = (...args) => {
			note("push", { to: String(args[2]) })
			return push(...args)
		}
		window.addEventListener("popstate", () => note("pop", { to: location.pathname + location.search }))
		window.__trip = { log }
	})
const recorded = (page) => page.evaluate(() => window.__trip?.log.slice() ?? [])
/**
 * The marks of a record, one after the other, without repeats: on the way in the TV button's code sets the mark at
 * the history move and the room sets it again when it has measured the TV.
 */
const marksOf = (log) => log.filter((e) => e.what === "mark").map((e) => e.mark).filter((mark, n, all) => mark !== all[n - 1])

// ---------------------------------------------------------------------------------------------------------
// The screens with an Expand key, and the pages they grow into.

/** The first titles on the Discover page, by key, and what it shows as chosen (../discover/drive.mjs). */
const discoverPage = (page) =>
	page.evaluate(() => {
		const links = [...(document.querySelector("main") ?? document.body).querySelectorAll('a[href^="/movie/"], a[href^="/show/"]')].map((a) => a.getAttribute("href"))
		return {
			titles: [...new Set(links)],
			chips: [...new Set([...document.querySelectorAll("button[aria-label^='Remove ']")].map((button) => button.getAttribute("aria-label").slice(7)))],
		}
	})
/** The Discover page once its first four titles are `want`: it asks again with the person's progress once it has read it. */
async function discoverShows(page, want, chip, timeout = 60000) {
	const end = Date.now() + timeout
	let now
	for (;;) {
		now = await discoverPage(page).catch(() => null)
		if (now && (!want || same(now.titles.slice(0, 4).map(keyOfHref), want)) && (!chip || now.chips.includes(chip))) break
		if (Date.now() > end) break
		await page.waitForTimeout(250)
	}
	now ??= { titles: [], chips: [] }
	if (want) is(now.titles.slice(0, 4).map(keyOfHref), want, "the page starts with the TV's four titles, in the same order")
	if (chip) check(now.chips.includes(chip), `the page shows ${chip} as chosen: ${now.chips.join(", ") || "nothing"}`)
	else is(now.chips, [], "the page shows nothing as chosen")
	return now
}
const tvTitles = (s) => s.items.filter((id) => id.startsWith("title:")).map((id) => id.slice(6))
/** The Explorer page's camera, as its development build shows it. */
const explorerView = (page) =>
	page.evaluate(() => {
		const explorer = window.__explorer
		if (!explorer) return null
		const view = explorer.view()
		return {
			focus: view.focus?.id ?? (typeof view.focus === "string" ? view.focus : null),
			inside: Boolean(view.focus && view.cam.s >= (view.stops[1] ?? view.base * 3) * 0.8),
			overview: view.cam.s <= view.fit * 1.05,
			busy: explorer.busy(),
			near: explorer.engine.regionNear?.() ?? null,
			picks: explorer.picks(),
			islands: explorer.islands().length,
		}
	})
async function explorerAt(page, what, want, timeout = 60000) {
	const got = await eventually(
		page,
		async () => {
			const view = await explorerView(page).catch(() => null)
			return view && view.islands > 0 && !view.busy && want(view) ? view : null
		},
		`${what}: ${JSON.stringify(await explorerView(page).catch(() => null))}`,
		timeout,
	)
	return got
}

/**
 * The guest's screens. `at` is the TV's address, `to` the page's; `sign` checks what travelled, given the TV's
 * state before leaving.
 */
function guestScreens(island) {
	return [
		{ name: "Tonight", at: "?tv=tonight", to: "/discover", says: "Discover", sign: (page) => discoverShows(page, null, null) },
		{ name: "Discover, the choice", at: "?tv=discover", to: "/discover", says: "Discover", sign: (page) => discoverShows(page, null, null) },
		{ name: "Discover, a mood's titles", at: "?tv=discover&mood=funny", to: "/discover?moods=funny", says: "Discover", sign: (page, s) => discoverShows(page, tvTitles(s), "Funny") },
		{ name: "Discover, a theme's titles", at: "?tv=discover&theme=crime", to: "/discover?themes=crime", says: "Discover", sign: (page, s) => discoverShows(page, tvTitles(s), "Crime") },
		{ name: "Discover, a style's titles", at: "?tv=discover&style=animated", to: "/discover?styles=animated", says: "Discover", sign: (page, s) => discoverShows(page, tvTitles(s), "Animated") },
		{
			name: "the Explorer's map",
			at: "?tv=explorer",
			to: "/explorer?grouping=mood",
			says: "Explorer",
			sign: async (page) => {
				const view = await explorerAt(page, "the Explorer opens on the Mood region", (v) => !v.overview && !v.inside && v.near === "mood")
				check(Boolean(view), "the Explorer's page is on the Mood region, inside no island")
			},
		},
		{
			name: "an island",
			at: `?tv=explorer&island=${island}`,
			to: `/explorer?grouping=mood&island=${island}`,
			says: "Explorer",
			sign: async (page) => {
				const view = await explorerAt(page, `the Explorer opens inside ${island}`, (v) => v.inside && v.focus === `mood:${island}`)
				is([view?.focus, view?.inside, view?.picks], [`mood:${island}`, true, []], "the Explorer's page is inside that island, and has picked none")
			},
		},
		{ name: "Taste, before a taste", at: "?tv=taste", to: "/taste", says: "Taste", sign: async (page) => check(/taste/i.test((await read(page)).title), "the Taste page") },
		{ name: "Taste, the sides", at: "?tv=taste", to: "/taste", says: "Taste", storage: WITH_SIDES, wait: (s) => s.items.some((id) => id.startsWith("side:")), sign: async (page) => check(/taste/i.test((await read(page)).title), "the Taste page") },
		{ name: "a side", at: "?tv=taste&side=side-1", to: "/taste", says: "Taste", storage: WITH_SIDES, wait: (s) => s.items.some((id) => id.startsWith("title:")), sign: async (page) => check(/taste/i.test((await read(page)).title), "the Taste page") },
		{
			name: "a title",
			at: `?tv=title&title=${MATRIX.key}`,
			to: MATRIX.path,
			says: MATRIX.name,
			wait: (s) => s.aria.expand === `Expand: ${MATRIX.name}`,
			sign: async (page) => {
				const s = await read(page)
				check(s.h1?.includes(MATRIX.name), `the title's page: ${s.h1}`)
				is(s.hash, "", "with no fragment: the page starts at its top")
				is(await page.evaluate(() => document.querySelectorAll(".gw-watch-glow").length), 0, "and nothing is highlighted")
			},
		},
		{
			name: "On Netflix",
			at: "?tv=service&service=8",
			to: "/discover?services=8",
			says: "Discover",
			wait: (s) => s.items.some((id) => id.startsWith("title:")),
			sign: async (page) => {
				// The page's chip for chosen services names one that is the person's own, and counts any other (slice 6b).
				const end = Date.now() + 60000
				let d = await discoverPage(page)
				while (!d.chips.length && Date.now() < end) {
					await page.waitForTimeout(250)
					d = await discoverPage(page)
				}
				check(d.chips.some((chip) => /^1 service$/.test(chip) || chip.includes("Netflix")), `the page shows the one service as chosen: ${d.chips.join(", ") || "nothing"}`)
			},
		},
		{
			name: "search results",
			at: "?tv=search&q=heist",
			to: "/discover?q=heist",
			says: "Discover",
			wait: (s) => s.items.some((id) => id.startsWith("title:")),
			sign: async (page, s, { searches }) => {
				const sent = searches.length
				await discoverShows(page, tvTitles(s), null)
				await page.waitForTimeout(1500)
				is(searches.length, sent, "the page draws from the TV's kept answer: no second search is sent")
				check(await page.evaluate(() => [...document.querySelectorAll("input")].some((input) => input.value === "heist") || document.body.innerText.includes("heist")), "the page shows the query")
			},
		},
	]
}
/** The member's screens, on the harness. Its server has no services: the pages it opens are a guest's there. */
const memberScreens = [
	{ name: "My shows", at: "&tv=shows", to: "/my-shows", says: "My shows", sign: async (page) => numbers["the harness's /my-shows says"] = (await read(page)).h1 },
	{ name: "a member's Tonight", at: "&tv=tonight", to: null, says: null, sign: async () => {} },
]

/** Opens a screen and waits for its Expand key. */
async function openScreen(base, screen, size, options = {}) {
	const url = `${base}${base.includes("?") ? screen.at.replace(/^\?/, "&") : screen.at}`
	const opened = await open(`${url}${options.focus ? `&focus=${options.focus}` : ""}`, size, { storage: screen.storage ?? FRESH, ...options })
	const search = new URL(url).search + (options.focus ? `&focus=${options.focus}` : "")
	const s = await until(opened.page, (x) => onTv(search)(x) && x.items.includes("expand") && (screen.wait?.(x) ?? true), `${screen.name}: the screen with its Expand key`, 120000)
	return { ...opened, s, search }
}

/** After a press on the Expand key: the page at `to`, with the motion ended. */
async function arrive(page, to, what) {
	const url = new URL(to, ORIGIN)
	return until(page, (x) => !x.room && x.path === url.pathname && x.search === url.search && x.hash === url.hash && x.mark === null, what, 120000)
}

const WAYS = ["back", "escape", "button"]
/** Returns to the TV one of three ways. */
async function goBack(page, way, touch) {
	if (way === "back") return page.goBack().catch(() => {})
	if (way === "escape") return page.keyboard.press("Escape")
	const button = page.locator("[data-tv-back]:visible").first()
	await button.waitFor({ timeout: 30000 })
	// The button comes into sight once the way out has ended.
	await page.waitForFunction(() => [...document.querySelectorAll("[data-tv-back]")].some((el) => el.getBoundingClientRect().width > 0 && getComputedStyle(el).opacity === "1"), null, { timeout: 30000 }).catch(() => {})
	if (touch) await button.tap()
	else await button.click()
}

// ---------------------------------------------------------------------------------------------------------
// The key on every screen, at every size: where it is, how large, what it says, and the frame around the picture.

const meet = (a, b) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5
const within = (a, b) => a.x >= b.x - 0.5 && a.x + a.w <= b.x + b.w + 0.5 && a.y >= b.y - 0.5 && a.y + a.h <= b.y + b.h + 0.5
const SIZES = [DESKTOP, BESIDE, [360, 740], SHORT, PHONE, [430, 932], LANDSCAPE]

async function keyOn(base, screen, size, smallest) {
	const touch = size[0] < 768 || size[1] < 541
	where = `the key on ${screen.name} ${size.join("x")}`
	const { ctx, page, s } = await openScreen(base, screen, size, { focus: "expand" })
	// ---- With the focus: amber, the picture in its frame.
	const key = s.boxes.expand
	is(s.focus, ["expand"], "focus=expand puts the focus on the key")
	is(s.labels.expand, "Expand", "it says Expand, and nothing longer")
	if (screen.says) is(s.aria.expand, `Expand: ${screen.says}`, "a screen reader hears where it leads")
	check(key && within(key, s.tv), "the key is inside the picture")
	check(key && s.tv.x + s.tv.w - (key.x + key.w) < s.tv.w * 0.09 && s.tv.y + s.tv.h - (key.y + key.h) < s.tv.h * 0.12, "at its bottom right")
	const others = Object.entries(s.boxes).filter(([id]) => id !== "expand")
	check(key && others.every(([, other]) => !meet(key, other)), `the focused key lies over no other key: ${others.filter(([, other]) => key && meet(key, other)).map(([id]) => id).join(", ") || "none"}`)
	check(s.framed && near(s.back, 0.94, 0.001), `the picture stands back in its frame: ${s.back}`)
	const arm = s.own[0]?.w
	is(s.own.length, 4, "four brackets frame the picture")
	check(
		s.own.length === 4 &&
			s.own.every((b) => b.shown && near(b.w, arm) && near(b.h, arm)) &&
			near(s.own[0].x, s.tv.x + 14) && near(s.own[0].y, s.tv.y + 14) &&
			near(s.own[3].x + s.own[3].w, s.tv.x + s.tv.w - 14) && near(s.own[3].y + s.own[3].h, s.tv.y + s.tv.h - 14) &&
			near(s.own[1].x + s.own[1].w, s.tv.x + s.tv.w - 14) && near(s.own[2].y + s.own[2].h, s.tv.y + s.tv.h - 14),
		`they stand 14 px inside the picture's edge, arms of ${arm} px`,
	)
	const style = await page.evaluate(() => {
		const key = document.querySelector('#room [data-tv-item="expand"]')
		const computed = getComputedStyle(key)
		return { color: computed.color, background: computed.backgroundColor, arms: key.querySelectorAll(".tvc-x-arm").length, picture: Boolean(key.querySelector(".bg-current")) }
	})
	is([style.background, style.color, style.arms, style.picture], ["rgb(251, 191, 36)", "rgb(0, 0, 0)", 4, true], "focused it is amber, with four brackets around a small picture")
	// ---- Away from it and back, with the direction keys.
	let away = null
	for (const name of ["ArrowLeft", "ArrowUp"]) {
		await page.keyboard.press(name)
		await page.waitForTimeout(160)
		if (!focusIs("expand")(await read(page))) {
			away = name
			break
		}
	}
	check(Boolean(away), "Left or Up moves the focus off the key")
	const rest = await until(page, (x) => !x.framed && near(x.back ?? 0, 1, 0.001) && x.own.length === 0, "off the key the picture fills its box again, and the brackets are gone", 5000)
	const at = rest.boxes.expand
	numbers[`${where}: ${away} from the key lands on`] = rest.focus[0]
	check(at && within(at, rest.tv), "at rest the key is inside the picture")
	if (touch) check(at && Math.min(at.w, at.h) >= 44 - 0.05, `at rest it is a touch target of 44 px or more: ${at?.w.toFixed(1)} x ${at?.h.toFixed(1)}`)
	if (touch) smallest[size.join("x")] = Math.min(smallest[size.join("x")] ?? 999, at ? +Math.min(at.w, at.h).toFixed(1) : 0)
	const overAtRest = Object.entries(rest.boxes).filter(([id, other]) => id !== "expand" && at && meet(at, other))
	// The item that has the focus is drawn a little larger than it lies.
	check(overAtRest.every(([id]) => id === rest.focus[0]) && overAtRest.length <= 1, `at rest it lies over no other key: ${overAtRest.map(([id]) => id).join(", ") || "none"}`)
	check(at && key && near(at.x + at.w / 2, key.x + key.w / 2, 0.6) && near(at.y + at.h / 2, key.y + key.h / 2, 0.6), `the key keeps its place while the picture steps back: ${JSON.stringify([at?.x + at?.w / 2, key?.x + key?.w / 2])}`)
	// Its colours change over 0.18 s.
	await page.waitForTimeout(350)
	const quiet = await page.evaluate(() => {
		const computed = getComputedStyle(document.querySelector('#room [data-tv-item="expand"]'))
		return [computed.color, computed.backgroundColor]
	})
	is(quiet, ["rgb(251, 191, 36)", "rgba(0, 0, 0, 0.5)"], "at rest it is a dark pill with amber type")
	const reverse = away === "ArrowLeft" ? "ArrowRight" : "ArrowDown"
	await page.keyboard.press(reverse)
	await until(page, (x) => focusIs("expand")(x) && x.framed, `${reverse} from there is the key again`, 5000)
	await ctx.close()
}

async function theKey() {
	const smallest = {}
	const island = await firstIsland()
	const screens = (guestSide ? guestScreens(island) : memberScreens.filter((screen) => screen.says)).filter((screen) => !process.env.SCREEN || screen.name.includes(process.env.SCREEN))
	const base = guestSide ? GUEST : MEMBER
	for (const size of SIZES) for (const screen of screens) await keyOn(base, screen, size, smallest)
	if (guestSide) numbers["the key's smallest side at rest, px, by phone"] = smallest
	// ---- The screens that have no page to grow into have no key.
	const without = guestSide
		? [
				["home", ""],
				["What is GoodWatch?", "?tv=about"],
				["the search screen before a query", "?tv=search"],
				["the rating", `?tv=rate&title=${MATRIX.key}`],
				["the quiz", "?tv=quiz"],
			]
		: [["a member's home", ""]]
	for (const size of [DESKTOP, PHONE]) {
		for (const [name, at] of without) {
			where = `no key on ${name} ${size.join("x")}`
			const url = `${base}${base.includes("?") ? at.replace(/^\?/, "&") : at}`
			const { ctx, page } = await open(`${url}${url.includes("?") ? "&" : "?"}focus=expand`, size)
			await page.waitForTimeout(1500)
			const s = await read(page)
			check(!s.items.includes("expand") && !s.framed && s.own.length === 0, `no Expand key, no frame: ${s.items.join(", ")}`)
			check(s.focus.length === 1 && s.focus[0] !== "expand", `focus=expand leaves the focus where it starts: ${s.focus[0]}`)
			await ctx.close()
		}
	}
}

/** The first island of the mini Explorer's map. */
let island0 = null
async function firstIsland() {
	if (!guestSide) return null
	if (island0) return island0
	const { ctx, page } = await open(`${GUEST}?tv=explorer`, DESKTOP)
	const s = await until(page, (x) => x.items.some((id) => id.startsWith("island:")), "the map's islands", 120000)
	island0 = s.items.find((id) => id.startsWith("island:"))?.slice(7) ?? "funny"
	await ctx.close()
	return island0
}

// ---------------------------------------------------------------------------------------------------------
// Out through the key from every screen, and back three ways.

async function trip(base, screen, size, way, by) {
	const touch = size[0] < 768
	where = `${screen.name} ${size.join("x")}, back by ${way}`
	console.log(where)
	const opened = await openScreen(base, screen, size)
	const { ctx, page, search, logs } = opened
	let s = opened.s
	const start = s.focus[0]
	check(start !== "expand", `the focus starts on the screen's own first item, not on the key: ${start}`)
	let spot = null
	// ---- To the key: the direction keys, the pointer, or a finger.
	if (by === "keys" || by === "remote") {
		const pressed = await reach(page)
		check(Boolean(pressed), `the direction keys reach the key: ${pressed?.join(" ") ?? "not reached"}`)
		numbers[`${screen.name} ${size.join("x")}: keys to the Expand key`] = pressed?.join(" ") ?? null
	} else if (by === "pointer") {
		// The cursor at the key's right end, where a key that stepped back with the picture would leave it (the pill's
		// corners are round: its very corner is not the key's). The screen has arrived: its short zoom is over.
		await page.waitForTimeout(600)
		const key = (await read(page)).boxes.expand
		spot = [key.x + key.w - 10, key.y + key.h / 2]
		await page.mouse.move(spot[0], spot[1], { steps: 6 })
	}
	if (by !== "finger") {
		s = await until(page, (x) => focusIs("expand")(x) && x.framed && near(x.back ?? 0, 0.94, 0.001), "the key has the focus and the picture stands in its frame", 8000)
		if (by === "pointer") {
			is(s.ring, { shown: "true", out: "true" }, "the ring is amber over the key")
			const under = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("[data-tv-item]")?.getAttribute("data-tv-item") ?? null, spot)
			is(under, "expand", "the key is still under the cursor after the picture stepped back")
		}
	}
	const before = s
	const idx = s.idx
	await record(page)
	// ---- Out.
	if (by === "keys") await page.keyboard.press("Enter")
	else if (by === "pointer") await page.mouse.click(spot[0], spot[1])
	else if (by === "remote") await (touch ? remoteKey(page, "OK").tap() : remoteKey(page, "OK").click())
	else await item(page, "expand").tap()
	const to = screen.to ?? (await eventually(page, async () => ((await read(page)).room ? null : (await read(page)).path), "the member's pick has a page", 120000))
	let there = await arrive(page, to, `the key opens ${to}`)
	is([there.path + there.search + there.hash, there.idx], [to, idx + 1], "the page is one step on in the tab's history")
	is([there.trip?.idx, there.trip?.to, there.trip?.out], [idx, new URL(to, ORIGIN).pathname, true], "the trip is remembered: the TV's entry, the page, and that the person is out")
	await screen.sign(page, before, opened)
	there = await until(page, (x) => x.wayBack.length === 1 && x.fixed.length === 0, "the TV button is there, and the brackets of the way out are gone", 20000)
	numbers[`${screen.name} ${size.join("x")}: the TV button`] = there.wayBack[0] && `${Math.round(there.wayBack[0].w)} x ${Math.round(there.wayBack[0].h)} at ${Math.round(there.wayBack[0].x)}, ${Math.round(there.wayBack[0].y)}`
	if (touch) check(there.wayBack[0]?.h >= 44, `the TV button is a touch target: ${there.wayBack[0]?.h} px tall`)
	// ---- Back.
	await goBack(page, way, touch)
	s = await until(page, (x) => backOn(search)(x) && (screen.wait?.(x) ?? true), `${way} returns to the same TV screen, with the focus on the Expand key and the picture in its frame`, 60000)
	is(s.idx, idx, "on the TV's own history entry")
	is(s.items, before.items, "with the same items as before leaving")
	is(s.fixed, [], "the brackets of the way in are gone")
	check(s.own.length === 4 && s.own.every((b) => b.shown), "and the frame's own brackets show")
	is(s.trip?.out, false, "the trip says the person is back")
	// The pointer was left on the page, wherever: the focus is the key's until it moves.
	await page.waitForTimeout(700)
	is((await read(page)).focus, ["expand"], "the focus is still on the key a moment later")
	is(noise(logs), [], "nothing in the console")
	await ctx.close()
}

async function trips() {
	const island = await firstIsland()
	const screens = (guestSide ? guestScreens(island) : memberScreens).filter((screen) => !process.env.SCREEN || screen.name.includes(process.env.SCREEN))
	const base = guestSide ? GUEST : MEMBER
	let n = 0
	for (const size of [DESKTOP, PHONE]) {
		const touch = size[0] < 768
		for (const screen of screens) {
			// Every way back and every way of pressing takes its turn; the first screens get all three ways below.
			const way = WAYS[n % 3]
			const by = touch ? ["finger", "keys", "remote"][n % 3] : ["keys", "pointer", "remote"][n % 3]
			n += 1
			await trip(base, screen, size, way, by).catch((error) => check(false, `${screen.name}: ${String(error.message).split("\n")[0]}`))
		}
	}
	// One screen, every way back, on both sizes.
	if (guestSide) {
		const results = screens.find((screen) => screen.at === "?tv=discover&mood=funny")
		for (const size of [DESKTOP, PHONE]) for (const way of WAYS) await trip(GUEST, results, size, way, "keys").catch((error) => check(false, String(error.message).split("\n")[0]))
	}
}

// ---------------------------------------------------------------------------------------------------------
// The motion: what is marked, and when.

const RESULTS = { name: "Discover, a mood's titles", at: "?tv=discover&mood=funny", to: "/discover?moods=funny" }

async function motion(size) {
	where = `the motion ${size.join("x")}`
	console.log(where)
	const { ctx, page, search } = await openScreen(GUEST, RESULTS, size)
	await reach(page)
	let s = await until(page, (x) => focusIs("expand")(x) && x.framed, "the key has the focus", 8000)
	const frame = s.own
	const tv = s.tv
	await record(page)
	// A slow page: the press is answered before the page is there.
	let hold = true
	await page.route(/\/discover\?.*_data=/, async (route) => {
		while (hold) await sleep(50)
		return route.continue()
	})
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.mark === "out" && x.fixed.length === 4, "the press marks the way out and puts up its four brackets", 5000)
	check(s.room, "the room is still there: the page is on its way")
	check(s.own.every((b) => !b.shown), "the frame's own brackets are hidden while those of the way out stand")
	check(
		s.fixed.every((b, corner) => near(b.x, frame[corner].x) && near(b.y, frame[corner].y) && near(b.w, frame[corner].w) && near(b.h, frame[corner].h)),
		`the brackets of the way out stand exactly where the frame's stood: ${JSON.stringify([s.fixed[0], frame[0]])}`,
	)
	is([s.trip?.box && Math.round(s.trip.box.width), s.trip?.box && Math.round(s.trip.box.height)], [Math.round(tv.w), Math.round(tv.h)], "the trip keeps the picture's box")
	await page.waitForTimeout(700)
	const waiting = await page.evaluate(() => document.getAnimations().filter((a) => a.animationName === "living-room-tv-wait" && a.playState === "running").length)
	is(waiting, 4, "while the page is on its way the four brackets breathe")
	hold = false
	const there = await arrive(page, RESULTS.to, "the page arrives")
	await until(page, (x) => x.fixed.length === 0 && x.wayBack.length === 1, "the brackets fold into the TV button and are gone", 10000)
	let log = await recorded(page)
	const marks = marksOf(log)
	is(marks, ["out", null], "the way out is marked once and cleared once")
	const out = log.find((e) => e.what === "animationend" && e.name === "living-room-tv-room-out")
	check(Boolean(out), "the room's zoom ran to its end")
	numbers[`${where}: the way out, s`] = out?.elapsed ?? null
	check(out && near(out.elapsed, 0.9, 0.02), `the way out takes 0.9 s: ${out?.elapsed}`)
	const pushed = log.find((e) => e.what === "push")
	const cleared = log.filter((e) => e.what === "mark" && e.mark === null).at(-1)
	check(pushed && out && cleared && pushed.t <= out.t && out.t <= cleared.t + 1, "the page is swapped in before the zoom, and the mark goes when the zoom ends")
	is(there.idx, s.idx + 1, "one history step")
	// ---- And back.
	await record(page)
	await page.goBack()
	s = await until(page, backOn(search), "Back returns into the same TV screen", 60000)
	log = await recorded(page)
	is(marksOf(log), ["in", null], "the way in is marked once and cleared once")
	const back = log.find((e) => e.what === "animationend" && e.name === "living-room-tv-room-in")
	check(back && near(back.elapsed, 0.6, 0.02), `the way in takes 0.6 s: ${back?.elapsed}`)
	numbers[`${where}: the way in, s`] = back?.elapsed ?? null
	check(s.own.length === 4 && s.own.every((b, corner) => b.shown && near(b.x, frame[corner].x) && near(b.y, frame[corner].y)), "the frame's brackets stand where the brackets of the way in landed")
	is(s.fixed, [], "and those are gone")
	// ---- Forward and Back again: the focus comes from the entry.
	await page.goForward()
	await arrive(page, RESULTS.to, "Forward is the page again")
	await until(page, (x) => x.wayBack.length === 1 && x.trip?.out === true, "with its TV button", 10000)
	await page.goBack()
	await until(page, backOn(search), "and Back from it is the TV screen with the focus on the key", 60000)
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// Calling the page off while it is on its way.

async function cancel(size) {
	where = `cancel while loading ${size.join("x")}`
	console.log(where)
	// From the choice to a mood's titles: one step of the TV's own history lies behind the screen.
	const choice = "?tv=discover"
	const { ctx, page, requests } = await openScreen(GUEST, { name: "Discover, the choice", at: choice }, size)
	await until(page, focusIs("mood:funny"), "the choice starts on Funny", 8000)
	await page.keyboard.press("Enter")
	const search = RESULTS.at
	await until(page, (x) => onTv(search)(x) && x.items.some((id) => id.startsWith("title:")), "Funny's titles", 60000)
	await reach(page)
	let s = await until(page, (x) => focusIs("expand")(x) && x.framed, "the key has the focus", 8000)
	const idx = s.idx
	const length = await page.evaluate(() => history.length)
	// The page's data takes five seconds.
	await page.route(/\/discover\?.*_data=/, async (route) => {
		await sleep(5000)
		return route.continue().catch(() => {})
	})
	const asked = () => requests.filter((r) => r.path === "/discover" && r.url.includes("_data=")).length
	const before = asked()
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.mark === "out" && x.fixed.length === 4, "the press is taken: the brackets stand at the picture's edge", 5000)
	await page.waitForTimeout(400)
	is(asked() - before, 1, "the page's data is asked for at the press")
	// A second press while the page is on its way.
	await page.keyboard.press("Enter")
	await page.waitForTimeout(400)
	is(asked() - before, 1, "a second press asks for nothing more")
	is((await read(page)).fixed.length, 4, "and the brackets stay")
	// The arrows move nothing off the screen, and Escape calls the page off.
	await page.keyboard.press("Escape")
	s = await until(page, (x) => x.mark === null && x.fixed.length === 0, "Escape calls the page off: the mark and the brackets go", 5000)
	is([s.room, s.search, s.focus, s.framed, s.idx], [true, search, ["expand"], true, idx], "the TV shows the same screen, with the focus on the key")
	is(s.trip, null, "no trip is remembered")
	check(s.own.length === 4 && s.own.every((b) => b.shown), "the frame's own brackets show again")
	await page.waitForTimeout(6500)
	s = await read(page)
	is([s.room, s.search, s.focus, s.idx, s.wayBack.length], [true, search, ["expand"], idx, 0], "the page's late data changes nothing: still the TV")
	is(await page.evaluate(() => history.length), length, "and the tab's history has no entry more")
	// ---- Another key of the TV while a page is on its way takes the page's place.
	await page.keyboard.press("Enter")
	await until(page, (x) => x.mark === "out" && x.fixed.length === 4, "a press again", 5000)
	await page.keyboard.press("h")
	s = await until(page, (x) => x.room && x.search === "" && x.mark === null && x.fixed.length === 0, "the Home key while a page is on its way shows home, and the way out is off", 20000)
	is([s.trip, s.idx], [null, idx + 1], "no trip is remembered, and home is one step on")
	await page.waitForTimeout(6500)
	s = await read(page)
	is([s.room, s.search, s.mark, s.fixed.length, s.wayBack.length], [true, "", null, 0, 0], "the page's late data changes nothing")
	await page.goBack()
	s = await until(page, (x) => onTv(search)(x) && focusIs("expand")(x), "Back from home is the titles again, with the focus on the key", 20000)
	// ---- The key works again afterwards, and the TV's own history is as it was.
	await page.unroute(/\/discover\?.*_data=/)
	await page.keyboard.press("Enter")
	await arrive(page, RESULTS.to, "after a cancel the key still opens the page")
	await page.goBack()
	await until(page, backOn(search), "and Back returns", 60000)
	await page.keyboard.press("Backspace")
	// The address changes a moment before the screen does.
	s = await until(page, (x) => onTv(choice)(x) && x.items.includes("tab:moods"), "the TV's Back still steps back to the choice: its history was kept", 20000)
	is([s.idx, s.focus], [idx - 1, ["mood:funny"]], "one step back, with the focus on Funny")
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// Reduced motion: plain navigation both ways.

async function calm(size) {
	where = `reduced motion ${size.join("x")}`
	console.log(where)
	const { ctx, page, search } = await openScreen(GUEST, RESULTS, size, { reducedMotion: true })
	await reach(page)
	let s = await until(page, (x) => focusIs("expand")(x) && x.framed && near(x.back ?? 0, 0.94, 0.001), "the key has the focus, the picture in its frame at once", 8000)
	const still = await page.evaluate(() => ({
		animations: document.getAnimations().filter((a) => !(a.timeline instanceof ScrollTimeline) && a.playState === "running").map((a) => a.animationName ?? a.transitionProperty),
		arms: [...document.querySelectorAll('#room [data-tv-item="expand"] .tvc-x-arm')].map((arm) => getComputedStyle(arm).transform),
	}))
	is(still.animations, [], "nothing moves: no animation and no transition runs")
	check(still.arms.length === 4 && still.arms.every((transform) => transform === "none"), "the key's brackets rest open at once")
	const idx = s.idx
	await record(page)
	await page.keyboard.press("Enter")
	const there = await arrive(page, RESULTS.to, "the key opens the page")
	let log = await recorded(page)
	is(log.filter((e) => e.what === "mark" || e.what.startsWith("animation") || e.what === "brackets"), [], "plainly: no mark, no brackets, no animation of the motion")
	is([there.idx, there.trip?.idx, there.trip?.box], [idx + 1, idx, null], "the trip is remembered all the same, without a box")
	await until(page, (x) => x.wayBack.length === 1, "and the TV button leads back", 10000)
	for (const way of WAYS) {
		await record(page)
		await goBack(page, way, size[0] < 768)
		s = await until(page, backOn(search), `${way} returns to the same TV screen with the focus on the key`, 60000)
		log = await recorded(page)
		is(log.filter((e) => e.what === "mark" || e.what.startsWith("animation") || e.what === "brackets"), [], `${way}: plainly`)
		if (way === WAYS.at(-1)) break
		await page.keyboard.press("Enter")
		await arrive(page, RESULTS.to, "out again")
		await until(page, (x) => x.wayBack.length === 1, "the TV button", 10000)
	}
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// Two pages deep, three pages deep.

async function deep(size) {
	const touch = size[0] < 768
	where = `two pages deep ${size.join("x")}`
	console.log(where)
	const { ctx, page, search } = await openScreen(GUEST, RESULTS, size)
	await reach(page)
	const start = await until(page, (x) => focusIs("expand")(x) && x.framed, "the key has the focus", 8000)
	const idx = start.idx
	const second = async () => {
		await page.keyboard.press("Enter")
		await arrive(page, RESULTS.to, "the Discover page")
		await page.waitForSelector('main a[href^="/movie/"], main a[href^="/show/"]', { timeout: 60000 })
		await until(page, (x) => x.wayBack.length === 1, "the TV button on the first page", 10000)
		const card = page.locator('main a[href^="/movie/"], main a[href^="/show/"]').first()
		if (touch) await card.tap()
		else await card.click()
		// The address changes a moment before the title's page is drawn; until then the Discover page and its button
		// are what shows, and they lead one page back, as they say.
		const s = await until(page, (x) => /^\/(movie|show)\//.test(x.path) && x.details && x.idx === idx + 2 && x.wayBack.length === 1, "a title opened from it is two pages from the TV, and the TV button is still there", 60000)
		await page.waitForTimeout(400)
		return s
	}
	// ---- The TV button from the second page: one move.
	let s = await second()
	await record(page)
	await goBack(page, "button", touch)
	s = await until(page, backOn(search), "the TV button returns straight to the TV screen", 60000)
	let log = await recorded(page)
	is([s.idx, log.filter((e) => e.what === "pop").length], [idx, 1], "in one history move, not two")
	is(marksOf(log), ["in", null], "as one transition into the TV")
	// ---- Escape from the second page.
	await second()
	await record(page)
	await page.keyboard.press("Escape")
	s = await until(page, backOn(search), "Escape from the second page returns straight to the TV screen", 60000)
	log = await recorded(page)
	is([s.idx, log.filter((e) => e.what === "pop").length], [idx, 1], "in one history move")
	// ---- The browser's Back from the second page is the browser's: one page at a time.
	await second()
	await page.goBack()
	s = await until(page, (x) => !x.room && x.path === "/discover" && x.idx === idx + 1 && x.wayBack.length === 1, "the browser's Back from the second page is the first page, with its TV button", 60000)
	await page.goBack()
	await until(page, backOn(search), "and Back again is the TV screen with the focus on the key", 60000)
	// ---- Three pages deep: the TV is no longer where the person comes from.
	s = await second()
	const href = await page.evaluate(() => [...document.querySelectorAll('main a[href^="/movie/"], main a[href^="/show/"]')].map((a) => a.getAttribute("href")).find((to) => to !== location.pathname) ?? null)
	numbers[`${where}: the third page`] = href
	if (href) {
		// Its section's heading lies over the card where the page is scrolled: the link is followed as a link.
		await page.evaluate((to) => [...document.querySelectorAll("main a")].find((a) => a.getAttribute("href") === to)?.click(), href)
		s = await until(page, (x) => x.idx === idx + 3 && x.details && x.wayBack.length === 0, "three pages from the TV the TV button is gone", 60000)
		await page.keyboard.press("Escape")
		await page.waitForTimeout(1200)
		is((await read(page)).idx, idx + 3, "and Escape goes nowhere")
		await page.goBack()
		await until(page, (x) => x.idx === idx + 2 && x.wayBack.length === 1, "one step back the TV button is there again", 60000)
	} else check(false, "the title's page has a link to another title")
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// A reload of the page the TV opened.

async function reload(size) {
	where = `a reload on the page ${size.join("x")}`
	console.log(where)
	const { ctx, page, search } = await openScreen(GUEST, RESULTS, size)
	await reach(page)
	const start = await until(page, (x) => focusIs("expand")(x) && x.framed, "the key has the focus", 8000)
	await page.keyboard.press("Enter")
	await arrive(page, RESULTS.to, "the page")
	await page.reload({ waitUntil: "load", timeout: 180000 })
	await page.waitForSelector("main", { timeout: 120000 })
	let s = await until(page, (x) => x.path === "/discover" && x.wayBack.length === 1, "after a reload the TV button is there", 60000)
	is([s.idx, s.trip?.idx, s.trip?.out], [start.idx + 1, start.idx, true], "the trip survived the reload")
	await page.goBack()
	s = await until(page, (x) => onTv(search)(x) && focusIs("expand")(x) && x.framed, "Back after the reload is the same TV screen, with the focus on the key", 120000)
	is(s.own.length, 4, "in its frame")
	// And a reload of the TV's own entry keeps the focus.
	await page.reload({ waitUntil: "load", timeout: 180000 })
	await until(page, (x) => onTv(search)(x) && focusIs("expand")(x) && x.framed, "a reload of the TV's screen keeps the focus on the key", 120000)
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// The pointer on return: it takes the focus only after it has moved.

async function pointer() {
	where = "the pointer on return"
	console.log(where)
	const { ctx, page, search, s: first } = await openScreen(GUEST, RESULTS, DESKTOP)
	const tile = first.items.find((id) => id.startsWith("title:") && id !== first.focus[0])
	const at = first.boxes[tile]
	const spot = [at.x + at.w / 2, at.y + at.h / 2]
	const key = first.boxes.expand
	await page.mouse.move(key.x + key.w / 2, key.y + key.h / 2, { steps: 5 })
	await until(page, (x) => focusIs("expand")(x) && x.framed, "the pointer over the key gives it the focus", 5000)
	await page.mouse.click(key.x + key.w / 2, key.y + key.h / 2)
	await arrive(page, RESULTS.to, "a click on the key leaves")
	// On the page the cursor comes to rest where a tile of the TV will lie.
	await page.mouse.move(spot[0], spot[1], { steps: 8 })
	await page.waitForTimeout(300)
	await page.keyboard.press("Escape")
	let s = await until(page, backOn(search), "Escape returns to the TV screen with the focus on the key", 60000)
	await page.waitForTimeout(1500)
	s = await read(page)
	const under = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("[data-tv-item]")?.getAttribute("data-tv-item") ?? null, spot)
	numbers["the pointer on return: the tile under the resting cursor"] = under
	check(under?.startsWith("title:"), `the cursor rests over a tile: ${under}`)
	is([s.focus, s.framed], [["expand"], true], "the tile under the resting cursor did not take the focus")
	// Once it moves, it points.
	await page.mouse.move(spot[0] + 4, spot[1] + 3, { steps: 2 })
	s = await until(page, (x) => x.focus[0]?.startsWith("title:") && !x.framed, "once the cursor moves, the tile under it takes the focus and the frame goes", 5000)
	is(s.own, [], "with its brackets")
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// Every layout of the room: the Remote under and beside the TV, the phone's two forms, landscape.

async function layouts() {
	const rooms = [
		[DESKTOP, { edition: "desktop", place: "below" }],
		[BESIDE, { edition: "desktop", place: "beside" }],
		[PHONE, { edition: "phone", form: "hand" }],
		[SHORT, { edition: "phone", form: "table" }],
		[LANDSCAPE, { edition: "landscape" }],
	]
	for (const [size, want] of rooms) {
		where = `the layout ${size.join("x")}`
		console.log(where)
		const { ctx, page, search, s: first } = await openScreen(GUEST, RESULTS, size)
		numbers[`${where}: the room`] = { edition: first.edition, place: first.place, form: first.form, tv: first.tv }
		check(Object.entries(want).every(([key, value]) => first[key] === value), `the room is ${JSON.stringify(want)}: ${JSON.stringify({ edition: first.edition, place: first.place, form: first.form })}`)
		const pressed = await reach(page)
		check(Boolean(pressed), `the direction keys reach the key: ${pressed?.join(" ")}`)
		let s = await until(page, (x) => focusIs("expand")(x) && x.framed, "the key has the focus", 8000)
		const frame = s.own
		await record(page)
		await page.keyboard.press("Enter")
		const there = await arrive(page, RESULTS.to, "the page arrives")
		const box = there.trip?.box
		check(box && near(box.left, s.tv.x) && near(box.top, s.tv.y) && near(box.width, s.tv.w) && near(box.height, s.tv.h), `the motion started from the picture's box: ${JSON.stringify(box)} for ${JSON.stringify(s.tv)}`)
		let log = await recorded(page)
		is(marksOf(log), ["out", null], "the way out ran")
		check(log.some((e) => e.what === "animationend" && e.name === "living-room-tv-room-out"), "to its end")
		await until(page, (x) => x.wayBack.length === 1 && x.fixed.length === 0, "the TV button is there", 10000)
		await record(page)
		await page.goBack()
		s = await until(page, backOn(search), "Back returns into the same TV screen with the focus on the key", 60000)
		log = await recorded(page)
		is(marksOf(log), ["in", null], "the way in ran")
		check(s.own.length === 4 && s.own.every((b, corner) => near(b.x, frame[corner].x) && near(b.y, frame[corner].y)), "the picture is framed as it was")
		check(Object.entries(want).every(([key, value]) => s[key] === value), "in the same room")
		await ctx.close()
	}
}

// ---------------------------------------------------------------------------------------------------------
// Nothing animates at rest.

/** What moves by itself in the page: animations and transitions that run on the clock, and frames asked for. */
const moving = (page, ms) =>
	page.evaluate(async (ms) => {
		const frames = { asked: 0 }
		const raf = window.requestAnimationFrame
		window.requestAnimationFrame = (callback) => {
			frames.asked += 1
			return raf.call(window, callback)
		}
		await new Promise((done) => setTimeout(done, ms))
		window.requestAnimationFrame = raf
		const running = document
			.getAnimations()
			.filter((a) => !(a.timeline instanceof ScrollTimeline) && (a.playState === "running" || a.pending))
			.map((a) => `${a.animationName ?? a.transitionProperty} on ${a.effect?.target?.className || a.effect?.target?.tagName} ${a.effect?.pseudoElement ?? ""}`.trim())
		return { running, frames: frames.asked }
	}, ms)

async function rest(size) {
	where = `at rest ${size.join("x")}`
	console.log(where)
	const { ctx, page, search } = await openScreen(GUEST, RESULTS, size)
	await page.waitForTimeout(4000)
	let quiet = await moving(page, 3000)
	is(quiet, { running: [], frames: 0 }, "the screen with its key, unfocused: nothing runs and no frame is asked for in 3 s")
	await reach(page)
	await until(page, (x) => focusIs("expand")(x) && x.framed, "the key has the focus", 8000)
	// The key's brackets move out twice and rest: 3 x 0.9 s.
	const early = await page.evaluate(() => document.getAnimations().filter((a) => a.animationName === "tvc-x-out").map((a) => [a.playState, a.effect.getComputedTiming().iterations, a.effect.getComputedTiming().duration]))
	check(early.length === 4 && early.every(([, iterations, duration]) => iterations === 3 && duration === 900), `the key's four brackets play 3 x 0.9 s and end: ${JSON.stringify(early[0])}`)
	await page.waitForTimeout(3600)
	quiet = await moving(page, 3000)
	is(quiet, { running: [], frames: 0 }, "the key focused and the picture framed, four seconds on: nothing runs and no frame is asked for in 3 s")
	const arms = await page.evaluate(() => [...document.querySelectorAll('#room [data-tv-item="expand"] .tvc-x-arm')].map((arm) => getComputedStyle(arm).transform))
	check(arms.every((transform) => transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)"), "the key's brackets rest open")
	await page.keyboard.press("Enter")
	await arrive(page, RESULTS.to, "the page")
	await until(page, (x) => x.wayBack.length === 1 && x.fixed.length === 0, "the TV button", 10000)
	await page.waitForTimeout(2500)
	quiet = await moving(page, 3000)
	numbers[`${where}: on the page, what runs`] = quiet
	check(!quiet.running.some((name) => /living-room|tv-back|view-transition/.test(name)), `on the page nothing of the motion or of the TV button runs: ${quiet.running.join("; ") || "nothing"}`)
	await page.goBack()
	await until(page, backOn(search), "Back", 60000)
	await page.waitForTimeout(3000)
	quiet = await moving(page, 3000)
	is(quiet, { running: [], frames: 0 }, "back on the TV, three seconds on: nothing runs and no frame is asked for in 3 s")
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// The Explorer page's own address parameter.

async function explorer() {
	where = "the Explorer page's island parameter"
	console.log(where)
	const island = await firstIsland()
	const cases = [
		[`grouping=mood&island=${island}`, `inside ${island}`, (v) => v.inside && v.focus === `mood:${island}` && v.picks.length === 0],
		["grouping=mood", "on the Mood region, in no island", (v) => !v.inside && !v.overview && v.near === "mood"],
		["grouping=mood&island=atlantis", "an island the map lacks: the Mood region", (v) => !v.inside && !v.overview && v.near === "mood"],
		[`island=${island}`, "an island without its grouping: the whole world", (v) => v.overview && v.picks.length === 0],
		[`grouping=mood&island=${island}&mix=mood:${island}`, "with picked islands in the address the pick wins: nothing is opened", (v) => v.picks.length === 1 && v.picks[0] === `mood:${island}`],
	]
	for (const size of [DESKTOP, PHONE]) {
		for (const [query, what, want] of cases) {
			const { ctx, page, logs } = await open(`${ORIGIN}/explorer?${query}`, size, { room: false })
			const view = await explorerAt(page, `${size.join("x")} ?${query}: ${what}`, want, 90000)
			check(Boolean(view), `${size.join("x")} ?${query}: ${what}`)
			if (query === cases[0][0]) {
				// Read once: a pick afterwards, and Back from it, do not fly in again.
				is(new URL(page.url()).search, `?${query}`, "the address keeps the parameter")
				is(noise(logs), [], "nothing in the console")
			}
			await ctx.close()
		}
	}
}

// ---------------------------------------------------------------------------------------------------------
// Two timings of slice 5's script (../tonight-title/drive.mjs), measured in the page instead of from outside.

async function timing() {
	// ---- The Watch key's pulse: when it starts against the end of the transition, and how long it runs.
	for (const size of [DESKTOP, PHONE]) {
		where = `the pulse ${size.join("x")}`
		console.log(where)
		for (let run = 0; run < 3; run += 1) {
			const { ctx, page } = await open(`${GUEST}?tv=title&title=${MATRIX.key}`, size, { storage: { ...FRESH, withStreamingProviders: "8" } })
			await until(page, (x) => /^(Watch on |On )/.test(x.labels.watch ?? ""), "the title screen", 60000)
			await page.evaluate(() => {
				const log = []
				window.__pulse = log
				const html = document.documentElement
				new MutationObserver(() => log.push({ t: performance.now(), mark: html.dataset.tvTransition ?? null })).observe(html, { attributes: true, attributeFilter: ["data-tv-transition"] })
				for (const type of ["animationstart", "animationiteration", "animationend"])
					document.addEventListener(
						type,
						(e) => {
							if (e.animationName !== "gw-watch-glow") return
							const pulse = e.target.getAnimations?.().find((one) => one.animationName === "gw-watch-glow")
							log.push({ t: performance.now(), event: type, ...(pulse && type === "animationstart" && { startTime: pulse.startTime, ...pulse.effect.getComputedTiming() }) })
						},
						true,
					)
			})
			await page.keyboard.press("Enter")
			await page.waitForSelector("#streaming", { timeout: 120000 })
			// As slice 5's script looks: from outside, every 100 ms.
			const seen = []
			const end = Date.now() + 15000
			while (Date.now() < end) {
				const now = await page.evaluate(() => {
					const el = document.getElementById("streaming")
					return el && { t: performance.now(), glow: el.classList.contains("gw-watch-glow"), animation: getComputedStyle(el).animationName }
				})
				if (now) seen.push(now)
				if (now && !now.glow && seen.some((x) => x.glow)) break
				await page.waitForTimeout(100)
			}
			const log = await page.evaluate(() => window.__pulse)
			const cleared = log.find((e) => e.mark === null)?.t
			const startEvent = log.find((e) => e.event === "animationstart")
			// When the pulse really started: its own start time on the document's timeline, the clock of performance.now().
			const started = startEvent?.startTime
			const ended = log.find((e) => e.event === "animationend")?.t
			const pulsing = seen.filter((x) => x.animation === "gw-watch-glow")
			const outside = pulsing.length ? seen.at(-1).t - pulsing[0].t : 0
			const gaps = seen.slice(1).map((x, n) => x.t - seen[n].t)
			numbers[`${where}, run ${run + 1}`] = {
				"the transition's mark cleared at, ms": cleared && Math.round(cleared),
				"the pulse started after the mark cleared, ms": started != null && cleared != null ? Math.round(started - cleared) : null,
				"the pulse runs, by its own clock, ms": startEvent ? Math.round(startEvent.activeDuration) : null,
				"its start event came after its start, ms": startEvent && started != null ? Math.round(startEvent.t - started) : null,
				"from its start event to its end event, ms": startEvent && ended != null ? Math.round(ended - startEvent.t) : null,
				"the pulse ran, as sampled from outside, ms": Math.round(outside),
				"the first sample that saw the pulse came after its start, ms": pulsing.length && started ? Math.round(pulsing[0].t - started) : null,
				"the longest gap between two samples, ms": Math.round(Math.max(...gaps)),
			}
			check(started != null && cleared != null && started >= cleared - 1, `the pulse starts once the transition has ended, never before: ${Math.round((started ?? 0) - (cleared ?? 0))} ms after`)
			is([startEvent?.iterations, startEvent?.duration, Math.round(startEvent?.activeDuration ?? 0)], [3, 1300, 3900], "by its own clock the pulse runs 3 x 1300 ms")
			is(log.filter((e) => e.event).map((e) => e.event.slice(9)), ["start", "iteration", "iteration", "end"], "three pulses")
			await ctx.close()
		}
	}
	// ---- A typed address with #streaming: where the block is before and after the page has measured its header.
	for (const size of [DESKTOP, PHONE]) {
		where = `a typed #streaming address ${size.join("x")}`
		console.log(where)
		for (let run = 0; run < 2; run += 1) {
			const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: size[0] < 768 ? 2 : 1, ...(size[0] < 768 ? { isMobile: true, hasTouch: true } : {}) })
			await guard(ctx)
			await ctx.addInitScript(() => localStorage.setItem("country", "US"))
			const page = await ctx.newPage()
			const t = Date.now()
			await page.goto(`${ORIGIN}${MATRIX.path}#streaming`, { waitUntil: "commit", timeout: 180000 })
			const seen = []
			const end = Date.now() + 40000
			while (Date.now() < end) {
				const now = await page
					.evaluate(() => {
						const el = document.getElementById("streaming")
						const main = document.querySelector("main")
						if (!el) return null
						return { y: Math.round(el.getBoundingClientRect().top), measured: main?.style.getPropertyValue("--details-header-height") || null, header: Math.round(document.querySelector("[data-details-header]")?.getBoundingClientRect().bottom ?? 0), ready: document.readyState }
					})
					.catch(() => null)
				if (now) seen.push({ at: Date.now() - t, ...now })
				if (seen.filter((x) => x.measured).length > 25) break
				await page.waitForTimeout(100)
			}
			const beforeMeasure = seen.filter((x) => !x.measured)
			const after = seen.filter((x) => x.measured)
			numbers[`${where}, run ${run + 1}`] = {
				"before the header is measured: the block's top, px": [...new Set(beforeMeasure.map((x) => x.y))],
				"the header's bottom edge, px": [...new Set(seen.map((x) => x.header))],
				"the header was measured after, ms": after[0]?.at ?? null,
				"measured as": after[0]?.measured ?? null,
				"after it: the block's top, px": [...new Set(after.slice(3).map((x) => x.y))],
				"settled after, ms": after.find((x) => x.y === after.at(-1)?.y)?.at ?? null,
			}
			const final = after.at(-1)
			check(final && final.y >= final.header && final.y - final.header <= 24, `once the page runs the block stands clear under the headers: its top at ${final?.y}, the headers end at ${final?.header}`)
			await ctx.close()
		}
	}
}

// ---------------------------------------------------------------------------------------------------------
// Pictures: the key at rest and focused beside the prototype's shots, and the way out and back as strips and clips.

const shots = join(here, "shots")
async function pictures() {
	mkdirSync(shots, { recursive: true })
	const island = await firstIsland()
	const all = guestScreens(island)
	const pick = (at, storage) => all.find((screen) => screen.at === at && (storage ? screen.storage : !screen.storage))
	const wanted = [
		["tonight", pick("?tv=tonight")],
		["discover-choice", pick("?tv=discover")],
		["discover-results", pick("?tv=discover&mood=funny")],
		["explorer-map", pick("?tv=explorer")],
		["island", pick(`?tv=explorer&island=${island}`)],
		["taste", pick("?tv=taste")],
		["taste-sides", pick("?tv=taste", true)],
		["side", pick("?tv=taste&side=side-1", true)],
		["title", pick(`?tv=title&title=${MATRIX.key}`)],
		["search-results", pick("?tv=search&q=heist")],
		["service", pick("?tv=service&service=8")],
	]
	for (const [size, tag] of [
		[DESKTOP, "desktop"],
		[PHONE, "phone"],
	]) {
		for (const [name, screen] of wanted) {
			const { ctx, page } = await openScreen(GUEST, screen, size)
			await page.waitForTimeout(2500)
			await page.screenshot({ path: join(shots, `${name}-${tag}.png`) })
			if (name === "discover-results" || name === "title" || name === "explorer-map") {
				await reach(page)
				await until(page, (x) => focusIs("expand")(x) && x.framed, "the key has the focus", 8000)
				await page.waitForTimeout(3200)
				await page.screenshot({ path: join(shots, `${name}-focused-${tag}.png`) })
			}
			await ctx.close()
		}
	}
	// The Explorer page, opened inside an island by the key's address.
	for (const [size, tag] of [
		[DESKTOP, "desktop"],
		[PHONE, "phone"],
	]) {
		const { ctx, page } = await open(`${ORIGIN}/explorer?grouping=mood&island=${island}`, size, { room: false })
		await explorerAt(page, "inside the island", (v) => v.inside, 90000)
		await page.waitForTimeout(2500)
		await page.screenshot({ path: join(shots, `explorer-page-island-${tag}.png`) })
		await ctx.close()
	}
	for (const size of [BESIDE, SHORT, LANDSCAPE]) {
		const { ctx, page } = await openScreen(GUEST, RESULTS, size)
		await reach(page)
		await until(page, (x) => focusIs("expand")(x) && x.framed, "the key has the focus", 8000)
		await page.waitForTimeout(3200)
		await page.screenshot({ path: join(shots, `discover-results-focused-${size.join("x")}.png`) })
		await ctx.close()
	}
}

/** Records the way out and back as a clip, and cuts strips of the two motions from it. */
async function clips() {
	const clipsDir = join(here, "clips")
	mkdirSync(clipsDir, { recursive: true })
	const island = await firstIsland()
	const runs = [
		["discover", RESULTS, DESKTOP, "desktop"],
		["discover", RESULTS, PHONE, "phone"],
		["title", guestScreens(island).find((screen) => screen.name === "a title"), DESKTOP, "desktop"],
		["title", guestScreens(island).find((screen) => screen.name === "a title"), PHONE, "phone"],
	]
	for (const [name, screen, size, tag] of runs) {
		// Once without a camera, so the page's code and data are warm.
		let opened = await openScreen(GUEST, screen, size)
		await reach(opened.page)
		await opened.page.keyboard.press("Enter")
		await arrive(opened.page, screen.to, "warm")
		await opened.ctx.close()
		const dir = join(tmpdir(), `tv-expand-clip-${name}-${tag}`)
		rmSync(dir, { recursive: true, force: true })
		opened = await openScreen(GUEST, screen, size, { video: dir, touch: false })
		const { ctx, page, search } = opened
		const t0 = Date.now()
		const at = () => (Date.now() - t0) / 1000
		await page.waitForTimeout(1200)
		await reach(page)
		await until(page, (x) => focusIs("expand")(x) && x.framed, "the key has the focus", 8000)
		await page.waitForTimeout(3000)
		await record(page)
		const pressed = at()
		await page.keyboard.press("Enter")
		await arrive(page, screen.to, "the page")
		await page.waitForTimeout(1800)
		const out = (await recorded(page)).filter((e) => e.what === "mark")
		const landed = at()
		await record(page)
		await page.keyboard.press("Escape")
		await until(page, backOn(search), "back", 60000)
		const home = at()
		await page.waitForTimeout(1500)
		const video = page.video()
		// Where the page's clock stood when the script's did: the record's times are the page's.
		const offset = await page.evaluate(() => performance.now())
		const now = at()
		await ctx.close()
		const raw = await video.path()
		const start = Math.max(0, pressed - 0.6)
		const mp4 = join(clipsDir, `${name}-${tag}.mp4`)
		execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(start), "-i", raw, "-t", String(home - start + 1), "-vf", `scale=${size[0] > 1000 ? 960 : size[0]}:-2`, "-c:v", "libx264", "-crf", "30", "-preset", "slow", "-an", "-movflags", "+faststart", mp4])
		// Strips: six frames of each motion. The way out runs from the mark's start (the press) to 0.2 s past its end.
		const pageAt = (t) => now - (offset - t) / 1000
		const cleared = out.find((e) => e.mark === null)?.t
		const zoomEnd = cleared ? pageAt(cleared) : landed - 1.8
		const frames = (from, to, file) => {
			const times = Array.from({ length: 6 }, (_, n) => from + ((to - from) * n) / 5)
			const parts = times.map((t, n) => {
				const png = join(dir, `${file}-${n}.png`)
				execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", t.toFixed(3), "-i", raw, "-frames:v", "1", "-vf", `scale=${size[0] > 1000 ? 480 : 260}:-2`, png])
				return png
			})
			execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...parts.flatMap((png) => ["-i", png]), "-filter_complex", `hstack=inputs=${parts.length}`, "-q:v", "4", join(here, `${file}.jpg`)])
		}
		frames(zoomEnd - 1.0, zoomEnd + 0.15, `strip-${name}-${tag}-out`)
		frames(home - 0.85, home + 0.1, `strip-${name}-${tag}-back`)
		numbers[`clip ${name} ${tag}: from the press to the page standing, s`] = +(zoomEnd - pressed).toFixed(2)
		rmSync(dir, { recursive: true, force: true })
	}
}

// ---------------------------------------------------------------------------------------------------------

const started = Date.now()
if (guestSide) await keepRanked()
if (only !== "shots") {
	if (PARTS.includes("key")) await theKey()
	if (PARTS.includes("trips")) await trips()
	if (guestSide) {
		for (const size of [DESKTOP, PHONE]) {
			if (PARTS.includes("motion")) await motion(size)
			if (PARTS.includes("cancel")) await cancel(size)
			if (PARTS.includes("calm")) await calm(size)
			if (PARTS.includes("deep")) await deep(size)
			if (PARTS.includes("reload")) await reload(size)
			if (PARTS.includes("rest")) await rest(size)
		}
		if (PARTS.includes("pointer")) await pointer()
		if (PARTS.includes("layouts")) await layouts()
		if (PARTS.includes("explorer")) await explorer()
		if (PARTS.includes("timing")) await timing()
	}
}
if (only !== "checks" && guestSide) {
	if (!process.env.SHOTS || process.env.SHOTS.includes("screens")) await pictures()
	if (!process.env.SHOTS || process.env.SHOTS.includes("clips")) await clips()
}
await browser.close()

console.log(`\n${SIDE}: ${passed} passed, ${failed.length} failed, ${Math.round((Date.now() - started) / 1000)} s`)
for (const line of failed) console.log("FAILED", line)
if (only !== "shots" && !process.env.PARTS) {
	const mine = { passed, failed, numbers }
	if (guestSide) writeFileSync(STOCK, JSON.stringify(mine))
	const guest = guestSide ? mine : existsSync(STOCK) ? JSON.parse(readFileSync(STOCK, "utf8")) : null
	const out = {
		taken: new Date().toISOString(),
		guest: guest && { passed: guest.passed, failed: guest.failed },
		member: guestSide ? null : { passed, failed },
		numbers: { ...(guest?.numbers ?? {}), ...(guestSide ? {} : numbers) },
	}
	writeFileSync(join(here, "checks.json"), `${JSON.stringify(out, null, "\t")}\n`)
} else if (Object.keys(numbers).length) console.log(JSON.stringify(numbers, null, 1))
process.exit(failed.length ? 1 : 0)
