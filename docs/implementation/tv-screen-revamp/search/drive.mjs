// Slice 10 of the new TV (search): walks the search screen and its results on /home-preview with the keyboard, both
// Remotes' keys and the pointer, as a guest on real data and as a member on the tracking harness; counts every
// request, so that nothing is asked for before OK; compares the TV's search with the Discover page's; measures
// every key on every phone of the room's table; and takes the screenshots in shots/ and the sheets beside the
// prototype's own.
//
//   PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs SIDE=guest GUEST=http://localhost:3310 node drive.mjs
//   PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs SIDE=member MEMBER=http://localhost:3311 node drive.mjs
//
// One dev server at a time: SIDE=guest with the reading server alone, then SIDE=member with the harness's alone
// (see README.md here for both commands). The guest's half keeps what the member's half needs of the reading
// server's answers, and its count of checks, in a file (STOCK=, by default in the system's temporary folder); the
// member's half writes checks.json for both and the sheets. `drive.mjs checks` and `drive.mjs shots` do one of the
// two; PARTS=refused,walk,same,sizes,html runs some of the checks.
//
// THE SEARCH ITSELF IS STOOD IN FOR. A search writes a row of search history and spends the paid inference budget,
// and this machine's reading server points at production. It also refuses every search from a browser: without
// APP_ORIGIN the route answers 403 to any Origin but its default (routes/api.combined-search.ts), which the part
// `refused` checks. So every other part answers `POST /api/combined-search` in the browser with a ranked list of
// real titles: the keys of Discover's own first cards for a theme, taken from the reading server. Everything after
// that is real: the cards come from `/api/discover/results?ranked=`, the title screens from `/api/title-cards`.
// The script never sends a search to a server.
//
// The repo has no browser driver: install playwright-core outside it. PROTOTYPE= is the folder of the prototype's
// notes (docs/prototypes/tv-screen-design on prototype/tv-screen-flow), for the sheets.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { request as httpRequest } from "node:http"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const ORIGIN = process.env.GUEST ?? "http://localhost:3310"
const GUEST = `${ORIGIN}/home-preview`
const MEMBER_ORIGIN = process.env.MEMBER ?? "http://localhost:3311"
const MEMBER = `${MEMBER_ORIGIN}/prototype/my-library-real/tv?member=six&session=on`
const prototype = process.env.PROTOTYPE ?? "/home/alper/projects/goodwatch-monorepo-38caebf4/docs/prototypes/tv-screen-design"
const only = process.argv[2]
const SIDE = process.env.SIDE ?? "guest"
const guestSide = SIDE === "guest"
const STOCK = process.env.STOCK ?? join(tmpdir(), "tv-drive-search-stock.json")
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")
// A dev server on port 3003 is the one address whose searches the route lets through without APP_ORIGIN.
if (new URL(ORIGIN).port === "3003") throw new Error("Not on port 3003: a search from there is not refused, and would be written to the search history")

const DESKTOP = [1920, 1080]
const PHONE = [390, 844]
const IDEAS = ["cozy mystery", "space adventure", "feel-good comedy", "mind-bending thriller"]
const IDEA_ITEMS = IDEAS.map((idea) => `idea:${idea}`)
/** The search screens have no Search key in their bar. */
const BAR = ["bar:back", "bar:menu"]
const QUESTION = [...IDEA_ITEMS, ...BAR]
const TYPED = ["go", ...IDEA_ITEMS.slice(0, 3), ...BAR]
const BUSY = "Search is busy right now. Try again in a moment."
const PROGRESS_KEY = "onboarding_ratings"

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
const json = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
const tvKey = (title) => `${title.media_type}-${title.tmdb_id}`
const rowKey = (title) => `${title.media_type}:${title.tmdb_id}`
/** A title's catalog key, as the results endpoint takes a ranked list (utils/title-key.ts). */
const catalogKey = (title) => (title.media_type === "movie" ? 1e12 : 2e12) + title.tmdb_id

// ---------------------------------------------------------------------------------------------------------
// The stand-in for the search: ranked lists of real titles.

const plain = { interactions: [], country: "US", services: null }
/** Discover's own results from the reading server, asked as a page asks them. */
async function results(query, guest = plain) {
	for (let tries = 0; ; tries += 1) {
		const response = await fetch(`${ORIGIN}/api/discover/results?${query}&page=1`, json({ guest }))
		if (response.ok) return response.json()
		if (tries > 40) throw new Error(`Discover's results did not come: ${response.status}`)
		// The title snapshot loads for a while after a start.
		await sleep(5000)
	}
}
/** What stands in for a search's ranking, by what the query holds. */
const THEMES = { heist: "themes=crime", mystery: "themes=mystery", other: "moods=funny" }
const listFor = (q) => (q.includes("heist") || q.includes("slow") ? "heist" : q.includes("mystery") ? "mystery" : "other")
/** The stock: the stand-in lists, and for the member's half the reading server's cards for them. */
let stock = { lists: {}, answers: {}, guest: null }
async function keepStock() {
	for (const [name, query] of Object.entries(THEMES)) {
		const cards = (await results(query)).cards ?? []
		stock.lists[name] = cards.slice(0, 24).map((card) => ({ media_type: card.media_type, tmdb_id: card.tmdb_id, title: card.title }))
		// The cards of that ranked list for a visitor nobody knows anything about: what the harness cannot answer.
		stock.answers[name] = await results(`ranked=${stock.lists[name].map(catalogKey).join(",")}`)
	}
}
const BATCH = { reading: [], metadata: [], errors: [], mode: "en", elapsedMs: 800, chargedNano: 0, people: [], creditScope: null }
/**
 * Answers every search in the browser, and keeps what was asked. "zz" in the query finds nothing, "busy" gets the
 * search role's busy answer, "slow" takes a while.
 */
async function standIn(target) {
	const searches = []
	await target.route("**/api/combined-search", async (route) => {
		const request = route.request()
		const raw = request.postData()
		const body = JSON.parse(raw ?? "null")
		searches.push({ method: request.method(), raw, body, origin: request.headers().origin ?? null })
		const q = String(body?.q ?? "")
		if (q.includes("busy")) return route.fulfill({ status: 503, contentType: "application/json; charset=utf-8", body: JSON.stringify({ error: BUSY }) })
		if (q.includes("slow")) await sleep(3500)
		const rows = q.includes("zz") ? [] : stock.lists[listFor(q)].map((title) => ({ key: rowKey(title) }))
		return route
			.fulfill({
				status: 200,
				contentType: "application/x-ndjson; charset=utf-8",
				body: `${JSON.stringify({ kind: "reading", reading: [] })}\n${JSON.stringify({ kind: "batch", batch: { q, rows, ...BATCH } })}\n`,
			})
			.catch(() => {})
	})
	return searches
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--use-angle=gl", "--ignore-gpu-blocklist"] })

/** What every page of a run gets: nothing leaves the machine but the pictures, and nothing is written. */
async function guard(page, { left = [], writes = [] } = {}) {
	await page.route(
		(u) => !["localhost", "127.0.0.1", "image.tmdb.org"].includes(u.hostname) && u.protocol.startsWith("http"),
		(route) => {
			left.push(route.request().url())
			return route.fulfill({ status: 204, body: "" })
		},
	)
	// The browser's telemetry goes through the dev server to Sentry (/api/e): a drive's page views are no news.
	await page.route("**/api/e", (route) => route.fulfill({ status: 200, body: "" }))
	// A score, a Want to See or a watch on its way to a store: stopped, and counted. The page's poster impressions
	// are stopped too (the reading server refuses them as it refuses a search).
	await page.route(/\/api\/(update-[a-z-]+|poster-impressions)/, (route) => {
		const path = new URL(route.request().url()).pathname
		if (path !== "/api/poster-impressions") writes.push(path)
		return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success" }) })
	})
}

/** Opens a page. A busy machine times a load out now and then: try again, twice. */
async function open(url, [width, height], { touch = width < 768, tries = 3, storage, search = true, member = false, room = true } = {}) {
	const ctx = await browser.newContext({
		viewport: { width, height },
		deviceScaleFactor: touch ? 2 : 1,
		...(touch ? { isMobile: true, hasTouch: true } : {}),
	})
	if (storage)
		await ctx.addInitScript((entries) => {
			if (sessionStorage.getItem("drive:seeded")) return
			sessionStorage.setItem("drive:seeded", "1")
			for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value)
		}, storage)
	const searches = search ? await standIn(ctx) : []
	// The harness has no title snapshot: its Discover answers 503. The reading server's answer for the same ranked
	// list is handed in; the page's own request is kept and checked.
	if (member)
		await ctx.route("**/api/discover/results*", (route) => {
			const ranked = new URL(route.request().url()).searchParams.get("ranked") ?? ""
			const name = Object.keys(stock.lists).find((one) => ranked === stock.lists[one].map(catalogKey).join(","))
			return route.fulfill(name ? { status: 200, contentType: "application/json", body: JSON.stringify(stock.answers[name]) } : { status: 503, body: "{}" })
		})
	const page = await ctx.newPage()
	const logs = []
	const requests = []
	const refusals = []
	page.on("console", (m) => {
		if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text()}`)
	})
	page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`))
	page.on("request", (r) => requests.push({ url: r.url(), path: new URL(r.url()).pathname, method: r.method(), body: r.postData(), origin: r.headers().origin ?? null }))
	page.on("response", async (r) => {
		if (new URL(r.url()).pathname === "/api/combined-search") refusals.push({ status: r.status(), body: await r.text().catch(() => "") })
	})
	const left = []
	const writes = []
	await guard(page, { left, writes })
	try {
		await page.goto(url, { waitUntil: "load", timeout: 180000 })
		if (room) await page.waitForSelector("#room:not([data-room=unmeasured]) [data-tv-item]", { timeout: 180000 })
		// The dev tools' round key is no part of the page.
		await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" })
		await page.waitForTimeout(600)
	} catch (error) {
		await ctx.close().catch(() => {})
		if (tries <= 1) throw error
		console.log("loading again:", String(error.message).split("\n")[0])
		await sleep(4000)
		return open(url, [width, height], { touch, tries: tries - 1, storage, search, member, room })
	}
	return { ctx, page, logs, requests, left, writes, searches, refusals }
}

/** What the TV shows. */
const read = (page) =>
	page.evaluate(() => {
		const room = document.getElementById("room")
		if (!room) return { search: location.search, path: location.pathname, room: false, items: [], focus: [], labels: {}, layers: 0, text: "" }
		const layers = [...room.querySelectorAll("[data-tv-layer]")]
		const top = layers.at(-1)
		// The Expand key is slice 11's, drawn since; ../expand/drive.mjs checks it. Here it is left out, as before.
		const items = top ? [...top.querySelectorAll("[data-tv-item]")].filter((el) => el.getAttribute("data-tv-item") !== "expand") : []
		const id = (el) => el.getAttribute("data-tv-item")
		const place = top?.querySelector("[data-tv-expand-place]")
		const text = (selector) => top?.querySelector(selector)?.textContent ?? null
		const last = (selector) => (top ? [...top.querySelectorAll(selector)].at(-1) : undefined)
		const line = top?.querySelector("[data-tv-input]")
		const active = document.activeElement
		return {
			search: location.search,
			path: location.pathname,
			room: true,
			edition: room.dataset.room,
			layers: layers.length,
			items: items.map(id),
			focus: items.filter((el) => el.getAttribute("aria-current")).map(id),
			labels: Object.fromEntries(items.map((el) => [id(el), el.textContent])),
			name: last(".truncate.font-bold.leading-none")?.textContent ?? null,
			crumb: text(".mt-1\\.5.truncate.leading-tight"),
			heading: text(".tvc-fade .tracking-tight"),
			facts: text(".tvc-fade .text-white\\/75"),
			text: top?.innerText ?? "",
			history: history.length,
			expandPlace: place ? place.querySelectorAll(':scope > :not([data-tv-item="expand"])').length : null,
			picture: last(":scope > .absolute.inset-0.overflow-hidden img")?.getAttribute("src") ?? null,
			posters: items.filter((el) => id(el).startsWith("title:")).map((el) => el.querySelector("img")?.getAttribute("src") ?? null),
			// The line to type on: what it holds, what it asks, and whether the browser's focus is in it.
			line: line ? { value: line.value, asks: line.placeholder, focused: active === line, hint: line.getAttribute("enterkeyhint"), tag: line.tagName } : null,
			says: text(".text-white\\/80"),
			// Where the browser's own focus is: the line, an item, or elsewhere.
			active: active?.hasAttribute?.("data-tv-input") ? "line" : (active?.getAttribute?.("data-tv-item") ?? active?.tagName ?? null),
			searchKey: [...room.querySelectorAll('[aria-label="Remote control"] button[aria-label="Search"]')].map((b) => b.getAttribute("aria-pressed")),
		}
	})

/** Waits until the TV's state says `want`, then returns the state. */
async function until(page, want, what, timeout = 30000) {
	const end = Date.now() + timeout
	let now
	for (;;) {
		now = await read(page).catch(() => null)
		if (now && want(now)) return now
		if (Date.now() > end) {
			check(false, `${what}: still ${JSON.stringify(now && { path: now.path, search: now.search, focus: now.focus, items: now.items, line: now.line, says: now.says, heading: now.heading, active: now.active })}`)
			return now ?? { items: [], focus: [], labels: {}, text: "", posters: [] }
		}
		await page.waitForTimeout(60)
	}
}
async function eventually(page, want, what, timeout = 30000) {
	const end = Date.now() + timeout
	for (;;) {
		const got = await want()
		if (got) return got
		if (Date.now() > end) {
			check(false, what)
			return null
		}
		await page.waitForTimeout(80)
	}
}
const focusIs = (item) => (s) => s.focus.length === 1 && s.focus[0] === item
const screenIs = (search, item, items) => (s) => s.room && s.search === search && s.layers === 1 && focusIs(item)(s) && (!items || same(s.items, items))
const titlesOf = (s) => s.items.filter((item) => item.startsWith("title:")).map((item) => item.slice(6))
const found = (count = 4) => (s) => titlesOf(s).length === count && Boolean(s.heading)

async function key(page, name, item, what = `${name} moves the focus to ${item}`) {
	await page.keyboard.press(name)
	return until(page, focusIs(item), what)
}
const remoteKey = (page, label) =>
	label === "OK"
		? page.locator('#room [aria-label="Remote control"] button', { hasText: /^OK$/ })
		: page.locator(`#room [aria-label="Remote control"] button[aria-label="${label}"]`)
async function remote(page, label, touch) {
	const button = remoteKey(page, label)
	if (touch) await button.tap()
	else await button.click()
}
const item = (page, id) => page.locator(`#room [data-tv-layer] [data-tv-item="${id}"]`).last()
async function point(page, id, touch) {
	if (touch) await item(page, id).tap()
	else await item(page, id).click()
}
const lineOf = (page) => page.locator("#room [data-tv-layer] [data-tv-input]").last()
const beyondTelemetry = (left) => [...new Set(left.map((u) => new URL(u).hostname))].filter((host) => !/posthog|sentry|googletagmanager|google-analytics|cloudflareinsights/.test(host))
// What a dev server's console says on any page.
const noise = (logs) => logs.filter((l) => !l.includes("Future Flag") && !l.includes("net::ERR_FAILED") && !l.includes("503") && !l.includes("Failed to load resource") && !l.includes("Swiper Loop Warning"))
/** The requests a search screen may cause, by path: the search, its cards, a title's card, the site's own palette. */
const DATA = ["/api/combined-search", "/api/discover/results", "/api/title-cards", "/api/command-palette"]

// ---------------------------------------------------------------------------------------------------------
// The reading server refuses a search from a browser: no history row, no paid call. Without the stand-in.

async function refused() {
	where = "the reading server refuses a search"
	console.log(where)
	// Asked directly, with the Origin a browser on this server sends, written into the request by hand: the route
	// lets a request without an Origin header through, so it is never sent without one.
	const direct = await new Promise((resolve, reject) => {
		const data = JSON.stringify({ q: "heist", filters: {}, allTitles: false, discover: true })
		const request = httpRequest(`${ORIGIN}/api/combined-search`, { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data), Origin: ORIGIN } }, (response) => {
			let text = ""
			response.on("data", (chunk) => {
				text += chunk
			})
			response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, text }))
		})
		request.on("error", reject)
		request.end(data)
	})
	is([direct.status, direct.text], [403, JSON.stringify({ error: "Invalid origin" })], "a search with this server's own Origin is refused before any search work")
	is(direct.headers["cache-control"], "private, no-store", "and the refusal is never stored")
	// A server that does not refuse would run the search for real: the browser is not asked to send one.
	if (direct.status !== 403) return
	const { ctx, page, requests, refusals, searches } = await open(`${GUEST}?tv=search`, DESKTOP, { storage: { country: "US" }, search: false })
	await until(page, (x) => Boolean(x.line?.focused), "the search screen", 60000)
	await page.keyboard.type("heist")
	await page.keyboard.press("Enter")
	let s = await until(page, (x) => x.search === "?tv=search&q=heist" && x.text.includes("Invalid origin"), "the TV says what the server answered", 60000)
	await page.waitForTimeout(2500)
	const sent = requests.filter((r) => r.path === "/api/combined-search")
	is(sent.length, 1, "the browser sent the one search, and did not try again")
	is(sent[0]?.origin, ORIGIN, "with this server's address as its Origin")
	is(refusals.map((r) => r.status), [403], "the server answered 403")
	is(searches.length, 0, "nothing stood in for it")
	is(requests.filter((r) => r.path === "/api/discover/results").length, 0, "no cards were asked for")
	is(titlesOf(s), [], "and the TV shows no title")
	is(s.focus, ["bar:back"], "the way back has the focus")
	numbers["the reading server's answer to a search from the browser"] = refusals.map((r) => `${r.status} ${r.body}`)
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// The walk.

async function walk(who, url, size) {
	const phone = size[0] < 768
	const member = who === "member"
	where = `${who} ${size.join("x")}`
	console.log(where)
	const { ctx, page, logs, requests, left, writes, searches } = await open(url, size, { storage: member ? undefined : { country: "US" }, member })
	const at = (query) => (member ? `?member=six&session=on${query ? `&${query}` : ""}` : query ? `?${query}` : "")
	const asked = (part) => requests.filter((r) => r.url.includes(part))
	const data = () => requests.filter((r) => DATA.includes(r.path))
	const cardsAsked = () => requests.filter((r) => r.path === "/api/discover/results")
	const loaded = await page.evaluate(() => Object.values(window.__remixContext.state.loaderData).find((one) => one && Array.isArray(one.tonight)))

	// ---- Arrival: nothing of search.
	let s = await read(page)
	is(s.focus, ["app:tonight"], "the focus starts on Tonight's tile")
	is(asked("/tv/screens/Search").length + asked("/tv/use-tv-search").length + asked("/tv/tv-search").length + asked("/search/search-request").length, 0, "search's code, its data hook, its rules and the request's code are not in the first view")
	is(data().length, 0, "nothing of a search is asked for on arrival")
	is(s.searchKey.every((pressed) => pressed !== "true"), true, "the Remote's Search key is not lit")
	const history = s.history

	// ---- The first sign of a person: the screens any key can open are asked for, search among them.
	s = await key(page, "ArrowRight", "app:discover")
	await eventually(page, () => asked("/tv/screens/Search").length > 0, "search's code is asked for at the first interaction")
	await eventually(page, () => asked("/tv/use-tv-search").length > 0, "its data hook arrives with it")
	is(data().length, 0, "its code alone asks for no data")
	s = await key(page, "ArrowLeft", "app:tonight")

	// ---- The Remote's Search key opens it.
	await remote(page, "Search", phone)
	s = await until(page, (x) => screenIs(at("tv=search"), IDEA_ITEMS[0], QUESTION)(x) && Boolean(x.line?.focused), "the Remote's Search key opens the search screen, with the line focused", 60000)
	is(s.history, history + 1, "opening search is one history entry")
	is(s.line?.tag, "INPUT", "the line is a real input")
	is([s.line?.value, s.line?.asks], ["", "What are you looking for?"], "it is empty and asks its question")
	is(s.line?.focused, true, "it has the browser's focus on arrival: what is typed lands in it, and a phone's keyboard can open")
	is(s.line?.hint, "search", "a phone's keyboard shows a search key")
	is(s.says, phone ? "Tap the line to type, or pick one." : "Type on the keyboard, or pick one.", "the line under it says what to do")
	is(IDEA_ITEMS.map((id) => s.labels[id]), IDEAS, "the four ideas say their words")
	is(s.expandPlace, null, "the question has no page to grow into: no Expand key and no place for one")
	is(s.searchKey.includes("true"), true, "the Remote's Search key is lit")
	await eventually(page, () => asked("/search/search-request").length > 0, "the code for the request is asked for while the line shows, so OK does not wait for it")
	is(data().length, 0, "opening search asks for nothing")
	// A tap on the line gives it the browser's focus, which is what opens a phone's keyboard.
	await page.evaluate(() => document.activeElement?.blur())
	s = await until(page, (x) => x.line && !x.line.focused, "the line without the browser's focus")
	if (phone) await lineOf(page).tap()
	else await lineOf(page).click()
	s = await until(page, (x) => Boolean(x.line?.focused), phone ? "a tap on the line gives it the browser's focus" : "a click on the line gives it the browser's focus")
	is(s.search, at("tv=search"), "and changes nothing else")
	// The word over the line and the hint under it are part of the same target.
	for (const part of ["first", "last"]) {
		await page.evaluate(() => document.activeElement?.blur())
		await until(page, (x) => x.line && !x.line.focused, "the line without the browser's focus")
		const words = page.locator("#room [data-tv-layer] label > span")[part]()
		if (phone) await words.tap()
		else await words.click()
		s = await until(page, (x) => Boolean(x.line?.focused), `a press on the ${part === "first" ? "word over the line" : "hint under it"} gives the line the browser's focus`)
	}
	is([s.search, s.focus], [at("tv=search"), [IDEA_ITEMS[0]]], "and changes nothing else")

	// ---- Typing: no request, and the focus on the key that searches.
	const before = requests.length
	await page.keyboard.type("h")
	s = await until(page, (x) => same(x.items, TYPED) && focusIs("go")(x), "one character has its own key, in an idea's place, with the focus")
	is(s.labels.go, "Search “h”", "the key names what is typed")
	is(s.says, "Two letters or more.", "the line says that one character is too few")
	await page.keyboard.press("Enter")
	await page.waitForTimeout(700)
	s = await read(page)
	is([s.search, searches.length], [at("tv=search"), 0], "OK on one character searches for nothing")
	await page.keyboard.type("eist")
	s = await until(page, (x) => x.line?.value === "heist" && x.labels.go === "Search “heist”", "what is typed is in the line and on its key")
	is(s.says, "OK searches for it.", "the line says that OK searches")
	is(s.focus, ["go"], "the focus is on the key")
	is(s.line?.focused, true, "the line keeps the browser's focus while the TV's focus is on the key")
	// H, M and S are letters here, not Home, Menu and Search.
	await page.keyboard.type(" mash")
	s = await until(page, (x) => x.line?.value === "heist mash", "h, m and s are typed")
	is([s.search, s.layers], [at("tv=search"), 1], "and did not go home, open the menu or leave search")
	for (let n = 0; n < 5; n += 1) await page.keyboard.press("Backspace")
	s = await until(page, (x) => x.line?.value === "heist", "Backspace deletes what was typed")
	is(s.search, at("tv=search"), "and is not Back while there is something to delete")

	// ---- The arrows, Enter and Escape stay the Remote's while the line has the browser's focus.
	s = await key(page, "ArrowRight", IDEA_ITEMS[0], "Right moves the TV's focus to the first idea")
	is([s.line?.focused, s.line?.value], [true, "heist"], "the line keeps the browser's focus and what is typed")
	// The desktop's keys are one row; the phone's stand two to a row.
	if (phone) {
		s = await key(page, "ArrowDown", IDEA_ITEMS[2], "Down moves to the key under it")
		s = await key(page, "ArrowLeft", IDEA_ITEMS[1])
		s = await key(page, "ArrowUp", "go")
	} else s = await key(page, "ArrowRight", IDEA_ITEMS[1])
	await page.keyboard.press("ArrowUp")
	s = await until(page, (x) => x.focus.length === 1 && x.focus[0].startsWith("bar:"), "Up reaches the top bar")
	is(s.line?.focused, true, "with the browser's focus still in the line")
	await page.keyboard.press("ArrowDown")
	s = await until(page, (x) => x.focus.length === 1 && TYPED.slice(0, 4).includes(x.focus[0]), "Down returns to the keys under the line")
	// Typing again puts the focus back on the key that searches for what is typed.
	await page.keyboard.type("s")
	s = await until(page, (x) => x.line?.value === "heists" && focusIs("go")(x), "typing puts the focus back on the key for what is typed")
	await page.keyboard.press("Backspace")
	s = await until(page, (x) => x.line?.value === "heist" && focusIs("go")(x), "and so does deleting")
	// The pointer over an idea gives it the focus and asks for nothing.
	if (!phone) {
		await item(page, IDEA_ITEMS[1]).hover()
		await page.mouse.move(900, 620)
		await item(page, IDEA_ITEMS[1]).hover()
		s = await until(page, focusIs(IDEA_ITEMS[1]), "the pointer over an idea gives it the focus")
		// What is typed with the browser's focus elsewhere still lands in the line: Tab moves it to a key.
		await page.keyboard.press("Tab")
		s = await until(page, (x) => x.active !== "line", "Tab moves the browser's focus off the line")
		await page.keyboard.type("x")
		s = await until(page, (x) => x.line?.value === "heistx" && x.line.focused && focusIs("go")(x), "a letter typed with the browser's focus on a key lands in the line, which takes the focus back")
		await page.evaluate(() => document.activeElement?.blur())
		await page.keyboard.press("Backspace")
		s = await until(page, (x) => x.line?.value === "heist" && x.line.focused, "and Backspace from elsewhere deletes in the line")
		is(s.search, at("tv=search"), "without leaving search")
	}
	// What the page asked a server for while the person typed, moved and pointed, without its own telemetry.
	const since = requests.slice(before).filter((r) => (r.path.startsWith("/api/") || r.path.includes("/prototype/my-library-real/api")) && r.path !== "/api/e")
	is(since.filter((r) => DATA.includes(r.path)).map((r) => r.path), [], "typing, moving and pointing asked for no search, no suggestion and no card")
	// On the harness the pool answers 503 and is asked for again by itself, whatever the person does; a guest's page
	// on the reading server asks for nothing.
	if (member) numbers[`${where}: what else the page asked for meanwhile`] = [...new Set(since.map((r) => `${r.method} ${r.path}`))]
	else is(since.map((r) => `${r.method} ${r.path}`), [], "and for nothing else")
	is(searches.length, 0, "no search before OK")
	is(s.history, history + 1, "and added no history entry")

	// ---- OK: the one search, then its cards.
	if (phone) await remote(page, "OK", true)
	else await page.keyboard.press("Enter")
	s = await until(page, (x) => x.search === at("tv=search&q=heist") && found()(x), "OK searches, and the results take the question's place", 90000)
	is(s.history, history + 1, "the results take the search screen's place: no history entry more")
	is(searches.length, 1, "exactly one search was sent")
	is(searches[0]?.method, "POST", "by POST")
	const scope = member ? loaded?.scope : null
	const narrowed = scope?.services?.length && /^[A-Z]{2}$/.test(scope.country ?? "") ? { streaming: { country: scope.country, providerIds: [...new Set(scope.services)].slice(0, 50) } } : {}
	is(searches[0]?.body, { q: "heist", filters: narrowed, allTitles: false, discover: true }, member ? "with the Discover page's body, narrowed to the member's own services when they have some" : "with the Discover page's body for a guest without services")
	if (member) numbers[`${where}: the member's scope from the loader, and the search's filters`] = [scope ?? null, searches[0]?.body?.filters]
	const list = stock.lists.heist
	const sent = cardsAsked()
	is(sent.length, 1, "its cards were asked for once")
	const cardsUrl = new URL(sent[0]?.url ?? "http://x")
	is([...cardsUrl.searchParams.keys()], ["ranked", "page"], "from Discover's results, with the ranked list and nothing else")
	is(cardsUrl.searchParams.get("ranked"), list.map(catalogKey).join(","), "the ranked list is the search's, in its order")
	is(sent[0]?.method, member ? "GET" : "POST", member ? "a member asks with GET" : "a guest asks with POST")
	if (!member) is(Object.keys(JSON.parse(sent[0]?.body ?? "{}").guest ?? {}).sort(), ["country", "interactions", "services"], "and sends their browser's progress, country and services, as the Discover page does")
	const answer = member ? stock.answers.heist : await results(`ranked=${list.map(catalogKey).join(",")}`)
	const want = (answer.cards ?? []).slice(0, 4)
	is(titlesOf(s), want.map(tvKey), "the four titles are the first four cards of that answer, in its order")
	is([s.name, s.crumb], ["Search", "“heist”"], "the bar says Search and what was searched for")
	is(s.focus, [`title:${tvKey(want[0])}`], "the focus is on the first title")
	is(s.heading, want[0]?.title, "the screen names the focused title")
	check(/\d{4} · (Movie|Show)/.test(s.facts ?? ""), `with its facts: ${s.facts}`)
	is(s.line, null, "there is no line to type on here")
	is(s.expandPlace, 0, "the Expand key's place is kept, and empty until slice 11")
	check(new RegExp(phone ? "/t/p/w780/" : "/t/p/w1280/").test(s.picture ?? ""), `the focused title's picture is behind the list, in the size of the edition: ${s.picture}`)
	check(s.posters.every((src) => new RegExp(phone ? "/t/p/w185/" : "/t/p/w342/").test(src ?? "")), "each title shows its poster")
	numbers[`${where}: “heist” on the TV`] = want.map((card) => card.title)

	// ---- Along the titles.
	s = await key(page, "ArrowRight", `title:${tvKey(want[1])}`)
	s = await until(page, (x) => x.heading === want[1].title, "the name follows the focus")
	is(searches.length, 1, "a move searches for nothing")

	// ---- A title leads to its title screen, and Back to the results as they were.
	if (phone) await point(page, `title:${tvKey(want[1])}`, true)
	else await page.keyboard.press("Enter")
	s = await until(page, (x) => x.search === at(`tv=title&title=${tvKey(want[1])}`) && x.items.includes("watch"), "OK on a title opens its title screen", 60000)
	is(s.history, history + 2, "one more history entry")
	check(s.text.includes(want[1].title), `named from what the results knew: ${want[1].title}`)
	await eventually(page, () => requests.filter((r) => r.path === "/api/title-cards").length > 0, "its card is asked for", 60000)
	await page.waitForTimeout(800)
	is(requests.filter((r) => r.path === "/api/title-cards").length, 1, "once")
	if (phone) await remote(page, "Back", true)
	else await page.keyboard.press("Escape")
	s = await until(page, (x) => x.search === at("tv=search&q=heist") && focusIs(`title:${tvKey(want[1])}`)(x) && found()(x), "Back returns to the results, with the focus on the title that was chosen", 60000)
	is(titlesOf(s), want.map(tvKey), "the same four titles")
	is([searches.length, cardsAsked().length], [1, 1], "nothing was searched or asked for again")

	// ---- The Search key on the results: a new question, with an empty line. The key again: back.
	await remote(page, "Search", phone)
	s = await until(page, (x) => screenIs(at("tv=search"), IDEA_ITEMS[0], QUESTION)(x) && Boolean(x.line?.focused), "the Search key on the results opens the question again")
	is([s.history, s.line?.value], [history + 2, ""], "as one more history entry, with an empty line")
	await remote(page, "Search", phone)
	s = await until(page, (x) => x.search === at("tv=search&q=heist") && found()(x), "the Search key on the question goes back")
	is([searches.length, cardsAsked().length], [1, 1], "and the results are there without a search")

	// ---- Back from the results is one step: home.
	if (phone) await point(page, "bar:back", true)
	else await page.keyboard.press("Escape")
	s = await until(page, (x) => x.search === at("") && x.items.includes("app:tonight"), "Back from the results shows home")
	is(s.focus, ["app:tonight"], "with the focus where it was")
	is(s.searchKey.every((pressed) => pressed !== "true"), true, "the Search key is no longer lit")

	// ---- The top bar's Search key opens it too, and an idea is searched for with OK.
	await key(page, "ArrowRight", "app:discover")
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.search === at("tv=discover") && x.items.includes("bar:search"), "Discover, for its top bar", 60000)
	await point(page, "bar:search", phone)
	s = await until(page, (x) => screenIs(at("tv=search"), IDEA_ITEMS[0], QUESTION)(x) && Boolean(x.line?.focused), "the top bar's Search key opens the search screen")
	is(s.line?.value, "", "with an empty line")
	if (phone) await point(page, IDEA_ITEMS[0], true)
	else await page.keyboard.press("Enter")
	s = await until(page, (x) => x.search === at("tv=search&q=cozy+mystery") && found()(x), "OK on an idea searches for its words", 90000)
	is(searches.length, 2, "one search more")
	is(searches[1]?.body?.q, "cozy mystery", "for the idea's words")
	is(s.crumb, "“cozy mystery”", "which the bar names")
	const mystery = member ? stock.answers.mystery : await results(`ranked=${stock.lists.mystery.map(catalogKey).join(",")}`)
	is(titlesOf(s), (mystery.cards ?? []).slice(0, 4).map(tvKey), "with its own four titles")

	// ---- The menu's Search, and S on the keyboard.
	if (phone) await remote(page, "Menu", true)
	else await page.keyboard.press("m")
	s = await until(page, (x) => x.layers === 2 && x.items.includes("menu:search"), "the menu")
	await point(page, "menu:search", phone)
	s = await until(page, (x) => screenIs(at("tv=search"), IDEA_ITEMS[0], QUESTION)(x) && Boolean(x.line?.focused), "the menu's Search opens the search screen")
	if (!phone) {
		await page.keyboard.press("Escape")
		s = await until(page, (x) => x.search === at("tv=search&q=cozy+mystery") && found()(x) && x.line === null, "Escape on the question is Back")
		await page.keyboard.press("s")
		s = await until(page, (x) => screenIs(at("tv=search"), IDEA_ITEMS[0], QUESTION)(x) && Boolean(x.line?.focused), "S on the results opens the search screen")
	}

	// ---- Nothing found, the busy answer, and a search that takes a while.
	await page.keyboard.type("zz nothing")
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.search === at("tv=search&q=zz+nothing") && x.text.includes("Nothing found."), "a search that finds nothing says so", 60000)
	is([titlesOf(s), s.focus], [[], ["bar:back"]], "with no title, and the focus on the way back")
	const cardsBefore = cardsAsked().length
	await page.waitForTimeout(600)
	is(cardsAsked().length, cardsBefore, "and asks for no cards")
	await remote(page, "Search", phone)
	await until(page, (x) => Boolean(x.line?.focused), "the question again")
	await page.keyboard.type("busy now")
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.search === at("tv=search&q=busy+now") && x.text.includes(BUSY), "the search role's busy answer is said in its own words", 60000)
	const sentBefore = searches.length
	await page.waitForTimeout(3000)
	is(searches.length, sentBefore, "a search that failed is not tried again by itself")
	await remote(page, "Search", phone)
	await until(page, (x) => Boolean(x.line?.focused), "the question once more")
	await page.keyboard.type("slow heist")
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.search === at("tv=search&q=slow+heist") && x.text.includes("Searching…"), "while a search runs the results say so", 30000)
	is([titlesOf(s), s.focus], [[], ["bar:back"]], "with the way back focused")
	s = await until(page, found(), "then its titles are there", 60000)
	is(s.focus, [`title:${titlesOf(s)[0]}`], "and the focus is on the first")

	// ---- A reload of the results asks again, as a reload of the Discover page does: the address names the query.
	const sentNow = searches.length
	await page.reload({ waitUntil: "load", timeout: 180000 })
	s = await until(page, (x) => x.search === at("tv=search&q=slow+heist") && found()(x), "a reload shows the results again", 90000)
	is(searches.length, sentNow + 1, "with one search for the address's query")

	is(writes, [], "nothing was sent to a server's store")
	is(noise(logs), [], "nothing in the console")
	is(beyondTelemetry(left), [], "no request left the machine but the site's own telemetry, which was stopped")
	numbers[`${where}: searches sent in the walk, all answered in the browser`] = searches.map((one) => one.body?.q)
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// The TV's search is the Discover page's for the same person: the same request, the same four titles, and the
// page behind the Expand key draws from the TV's answer.

/** The first titles on the Discover page, by key. */
const discoverPage = (page) =>
	page.evaluate(() => {
		const links = [...(document.querySelector("main") ?? document.body).querySelectorAll('a[href^="/movie/"], a[href^="/show/"]')].map((a) => a.getAttribute("href"))
		return { path: location.pathname, search: location.search, titles: [...new Set(links)] }
	})
const keyOfHref = (href) => {
	const [, kind, id] = /^\/(movie|show)\/(\d+)/.exec(href ?? "") ?? []
	return kind ? `${kind}-${id}` : null
}
async function settled(page, want, timeout = 60000) {
	const end = Date.now() + timeout
	let now
	for (;;) {
		now = await discoverPage(page).catch(() => null)
		if (now && same(now.titles.slice(0, 4).map(keyOfHref), want)) return now
		if (Date.now() > end) return now ?? { titles: [], path: "", search: "" }
		await page.waitForTimeout(250)
	}
}

async function sameAsDiscover() {
	const rated = [
		{ media_type: "show", tmdb_id: 1396, type: "score", score: 9, timestamp: 1 },
		{ media_type: "movie", tmdb_id: 603, type: "score", score: 9, timestamp: 2 },
	]
	const people = [
		{ who: "a guest nobody knows", storage: { country: "US" }, guest: plain, filters: {} },
		{
			who: "a guest with Netflix saved",
			storage: { country: "US", withStreamingProviders: "8" },
			guest: { ...plain, services: "8" },
			filters: { streaming: { country: "US", providerIds: [8] } },
		},
		{
			who: "a guest in Germany with two services and two ratings",
			storage: { country: "DE", withStreamingProviders: "337,8", [PROGRESS_KEY]: JSON.stringify(rated) },
			guest: { interactions: rated, country: "DE", services: "337,8" },
			filters: { streaming: { country: "DE", providerIds: [337, 8] } },
		},
	]
	for (const person of people) {
		where = `“heist” for ${person.who}`
		console.log(where)
		// Discover's results for the stand-in's ranked list, asked as the page asks.
		const answer = await results(`ranked=${stock.lists.heist.map(catalogKey).join(",")}`, person.guest)
		const wanted = (answer.cards ?? []).slice(0, 4)
		numbers[`${where}: of the ranked 24, Discover keeps`] = answer.total
		check(wanted.length > 0, `Discover keeps some of the ranked list for this person: ${answer.total}`)
		const { ctx, page, searches, requests } = await open(`${GUEST}?tv=search&q=heist`, DESKTOP, { storage: person.storage })
		let s = await until(page, (x) => titlesOf(x).length === wanted.length && Boolean(x.heading), "the TV's titles", 90000)
		const tv = titlesOf(s)
		numbers[`${where}: on the TV`] = wanted.map((card) => card.title)
		is(searches.length, 1, "a link to the results searches once")
		is(searches[0]?.body, { q: "heist", filters: person.filters, allTitles: false, discover: true }, "the search is narrowed to the person's own services in their country, and to nothing else")
		is(tv, wanted.map(tvKey), "the TV's titles are the first four of /api/discover/results for the same person")

		// The Discover page at the address the Expand key opens, loaded by itself in the same browser.
		const other = await ctx.newPage()
		await guard(other)
		await other.goto(`${ORIGIN}/discover?q=heist`, { waitUntil: "load", timeout: 180000 })
		await eventually(other, () => searches.length > 1, "the Discover page sends its own search", 90000)
		is(searches[1]?.raw, searches[0]?.raw, "the page's request body is the TV's, byte for byte")
		const d = await settled(other, tv)
		is(d.titles.slice(0, tv.length).map(keyOfHref), tv, "the page's first titles are the TV's, in the same order")
		await other.close()

		// The Expand key's effect on the TV: that page, drawn from the TV's answer. The key itself is slice 11's and
		// is not drawn; the script reaches it with `focus=expand`.
		await page.goto(`${GUEST}?tv=search&q=heist&focus=expand`, { waitUntil: "load", timeout: 180000 })
		await until(page, (x) => titlesOf(x).length === tv.length && Boolean(x.heading), "the results again", 90000)
		const sent = searches.length
		const cards = requests.filter((r) => r.path === "/api/discover/results").length
		await page.keyboard.press("Enter")
		await page.waitForURL((u) => u.pathname === "/discover", { timeout: 120000 })
		await page.waitForSelector('a[href^="/movie/"], a[href^="/show/"]', { timeout: 120000 })
		const e = await settled(page, tv)
		is([e.path, e.search], ["/discover", "?q=heist"], "the Expand key's effect opens Discover with the query")
		is(e.titles.slice(0, tv.length).map(keyOfHref), tv, "and the page it opens starts with the TV's titles")
		await page.waitForTimeout(2500)
		is(searches.length, sent, "the page behind Expand draws from the TV's answer: it does not search a second time")
		numbers[`${where}: requests for cards the page behind Expand made`] = requests.filter((r) => r.path === "/api/discover/results").length - cards
		await page.goBack()
		s = await until(page, (x) => x.room && x.search === "?tv=search&q=heist&focus=expand" && titlesOf(x).length === tv.length, "Back returns to the results on the TV", 90000)
		is(titlesOf(s), tv, "with the same titles")
		is(searches.length, sent, "and without a search")
		await ctx.close()
	}
	// A guest with services and no country in their browser: the page narrows the ranking by its own guess of the
	// country, which the TV does not know. The TV leaves the ranking wide; the results are narrowed all the same.
	where = "a guest with a service and no country in their browser"
	console.log(where)
	const { ctx, page, searches } = await open(`${GUEST}?tv=search&q=heist`, DESKTOP, { storage: { withStreamingProviders: "8" } })
	const narrowed = await results(`ranked=${stock.lists.heist.map(catalogKey).join(",")}`, { interactions: [], country: null, services: "8" })
	const kept = (narrowed.cards ?? []).slice(0, 4)
	const s = await until(page, (x) => titlesOf(x).length === kept.length && (kept.length === 0 || Boolean(x.heading)), "the TV's titles", 90000)
	is(searches[0]?.body?.filters, {}, "the TV's search leaves the ranking wide")
	is(titlesOf(s), kept.map(tvKey), "and its titles are still Discover's for that guest, narrowed to their service")
	const other = await ctx.newPage()
	await guard(other)
	await other.goto(`${ORIGIN}/discover?q=heist`, { waitUntil: "load", timeout: 180000 })
	await eventually(other, () => searches.length > 1, "the Discover page sends its own search", 90000)
	numbers[`${where}: the page's filters, where the TV's are empty`] = searches[1]?.body?.filters ?? null
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// What is where on the TV: every key's box, the line, and the Expand key's corner.

const layout = (page) =>
	page.evaluate(() => {
		const room = document.getElementById("room")
		const layer = [...room.querySelectorAll("[data-tv-layer]")].at(-1)
		const tv = layer.getBoundingClientRect()
		const k = tv.width / layer.offsetWidth
		const rest = (el) => {
			const b = el.getBoundingClientRect()
			const [w, h] = [el.offsetWidth * k, el.offsetHeight * k]
			const [x, y] = [b.left + b.width / 2 - w / 2, b.top + b.height / 2 - h / 2]
			return { left: x, top: y, right: x + w, bottom: y + h, width: w, height: h }
		}
		const place = layer.querySelector("[data-tv-expand-place]")
		const heading = layer.querySelector(".tvc-fade .tracking-tight")
		const line = layer.querySelector("[data-tv-input]")
		const says = line ? [...layer.querySelectorAll(".text-white\\/80")].at(0) : null
		// What a finger can tap to type: the word, the line and the hint are one label.
		const tap = line?.closest("label")
		return {
			k,
			tv: { left: tv.left, top: tv.top, right: tv.right, bottom: tv.bottom },
			items: [...layer.querySelectorAll("[data-tv-item]")].filter((el) => el.getAttribute("data-tv-item") !== "expand").map((el) => ({
				id: el.getAttribute("data-tv-item"),
				...rest(el),
				// What a key says is cut short where it does not fit: a line that is cut off, or words taller than their key.
				cut: [...el.querySelectorAll(".truncate")].some((text) => text.scrollWidth > text.clientWidth + 1) || [...el.querySelectorAll(".line-clamp-2")].some((text) => text.scrollHeight > text.clientHeight + 1 || text.offsetHeight > el.clientHeight + 1),
			})),
			clipped: [...layer.querySelectorAll(".overflow-hidden")].filter((el) => !el.hasAttribute("data-tv-row") && el.scrollHeight > el.clientHeight + 1).length,
			heading: heading ? rest(heading) : null,
			line: line ? rest(line) : null,
			says: says ? rest(says) : null,
			tap: tap ? rest(tap) : null,
			place: place ? rest(place) : null,
			type: Math.min(...[...layer.querySelectorAll("*")].filter((el) => el.tagName === "INPUT" || [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())).map((el) => Number.parseFloat(getComputedStyle(el).fontSize))),
		}
	})

const meet = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5
const within = (a, b) => a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5

/** A screen holds what it shows: touch targets, nothing over anything, nothing cut off, the corner free. */
function fits(l, what, { touch = false, expand = true, cutAllowed = [] } = {}) {
	const small = l.items.filter((one) => Math.min(one.width, one.height) < 44 - 0.05)
	if (touch) check(small.length === 0, `${what}: every key is 44 px or more on the phone's screen: ${small.map((one) => `${one.id} ${one.width.toFixed(1)} x ${one.height.toFixed(1)}`).join(", ") || "all"}`)
	const out = l.items.filter((one) => !within(one, l.tv))
	check(out.length === 0, `${what}: every key is inside the picture: ${out.map((one) => one.id).join(", ") || "all"}`)
	const over = l.items.flatMap((a, n) => l.items.slice(n + 1).filter((b) => meet(a, b)).map((b) => `${a.id} and ${b.id}`))
	check(over.length === 0, `${what}: no key lies over another: ${over.join(", ") || "none"}`)
	check(l.clipped === 0, `${what}: nothing is cut off by its box`)
	const cut = l.items.filter((one) => one.cut && !cutAllowed.includes(one.id))
	check(cut.length === 0, `${what}: every key says its words in full: ${cut.map((one) => one.id).join(", ") || "all"}`)
	if (l.heading) check(within(l.heading, l.tv) && !l.items.some((one) => meet(one, l.heading)), `${what}: the focused title's name is inside the picture and under no key`)
	if (l.line) {
		check(within(l.line, l.tv) && !l.items.some((one) => meet(one, l.line)), `${what}: the line to type on is inside the picture and under no key`)
		if (touch) check(l.tap && l.tap.height >= 44 && l.tap.width >= 200 && within(l.tap, l.tv) && !l.items.some((one) => meet(one, l.tap)), `${what}: the word, the line and its hint are one target for a tap, 44 px or more tall: ${l.tap?.width.toFixed(0)} x ${l.tap?.height.toFixed(0)}`)
		check(l.says && within(l.says, l.tv) && !l.items.some((one) => meet(one, l.says)), `${what}: the line under it is inside the picture and under no key`)
	}
	check(l.type >= 20, `${what}: no type under 20 canvas px: ${l.type}`)
	if (expand) {
		if (l.place) {
			// The Expand key's cell: 158 canvas px wide on the phone, 220 on the desktop, as tall as a key.
			const size = touch ? [158, 54] : [220, 64]
			const corner = { right: l.place.right, bottom: l.place.bottom, left: l.place.right - size[0] * l.k, top: l.place.bottom - Math.max(size[1] * l.k, touch ? 44 : 0) }
			const inCorner = l.items.filter((one) => meet(one, corner))
			check(inCorner.length === 0, `${what}: the Expand key's corner is free: ${inCorner.map((one) => one.id).join(", ") || "free"}`)
		} else check(false, `${what}: the Expand key's corner is there`)
	} else check(l.place === null, `${what}: no Expand key's place on a screen without a page`)
	return { key: Math.min(...l.items.map((one) => Math.min(one.width, one.height))) }
}

/** The phones of the room's table: the Remote in the hand on the tall ones, on the table on the short, and landscape. */
const PHONES = [
	[360, 740],
	[375, 667],
	[390, 700],
	[390, 844],
	[430, 932],
	[844, 390],
]
const LONG = "The Lord of the Rings: The Fellowship of the Ring"
const LONG_QUERY = "a long evening with something quiet and strange from the seventies"

async function sizes() {
	for (const size of [...PHONES, DESKTOP]) {
		const touch = size !== DESKTOP
		where = `sizes ${size.join("x")}`
		console.log(where)
		const smallest = {}
		const { ctx, page } = await open(`${GUEST}?tv=search`, size, { touch, storage: { country: "US" } })
		// The worst case of the results: their first title has a long name, set by the script in Discover's answer.
		await ctx.route(
			(u) => u.pathname === "/api/discover/results" && u.searchParams.has("ranked"),
			async (route) => {
				const response = await route.fetch()
				const body = await response.json()
				if (body.cards?.[0]) body.cards[0].title = LONG
				return route.fulfill({ response, json: body })
			},
		)
		numbers[`${where}: the room`] = await page.evaluate(() => {
			const room = document.getElementById("room")
			return [room.dataset.room, room.dataset.remotePlace].filter(Boolean).join(", ")
		})
		let s = await until(page, (x) => same(x.items, QUESTION) && Boolean(x.line), "the question", 60000)
		let l = await layout(page)
		smallest.question = fits(l, "the question", { touch, expand: false }).key
		const ideas = IDEA_ITEMS.map((id) => l.items.find((one) => one.id === id))
		check(ideas.every((one) => Math.abs(one.width - ideas[0].width) < 0.6 && Math.abs(one.height - ideas[0].height) < 0.6), "the question: four keys of one size")
		if (touch) check(Math.abs(ideas[0].top - ideas[1].top) < 0.6 && ideas[2].top > ideas[0].bottom, "the question: the keys stand two to a row on the phone's canvas")
		else check(ideas.every((one) => Math.abs(one.top - ideas[0].top) < 0.6), "the question: the keys are one row on the desktop")
		numbers[`${where}: the line's target for a tap and an idea's key, px`] = [l.tap, ideas[0]].map((one) => `${Math.round(one.width)} x ${Math.round(one.height)}`)
		// Something long typed: its key names it on two lines, and nothing moves out of the picture.
		await lineOf(page).fill(LONG_QUERY)
		s = await until(page, (x) => same(x.items, TYPED) && focusIs("go")(x), "a long query typed")
		l = await layout(page)
		// The key for a long query says its start and ends in an ellipsis, on purpose.
		smallest.typed = fits(l, "a long query typed", { touch, expand: false, cutAllowed: ["go"] }).key
		// Its results, with a long name first.
		await page.keyboard.press("Enter")
		s = await until(page, (x) => found()(x) && x.heading === LONG, "the results with a long name", 90000)
		l = await layout(page)
		smallest.results = fits(l, "the results", { touch }).key
		const posters = l.items.filter((one) => one.id.startsWith("title:"))
		check(posters.length === 4 && posters.every((one) => within(one, l.tv)), "the results: four posters inside the picture")
		numbers[`${where}: a poster, px`] = `${Math.round(posters[0].width)} x ${Math.round(posters[0].height)}`
		// The focus on the last title: the row pages, and still nothing is in the corner.
		for (const id of titlesOf(s).slice(1)) s = await key(page, "ArrowRight", `title:${id}`)
		await page.waitForTimeout(500)
		l = await layout(page)
		fits(l, "the results with the focus on the last title", { touch })
		numbers[`${where}: the smallest key, px`] = Object.fromEntries(Object.entries(smallest).map(([name, px]) => [name, Number(px.toFixed(1))]))
		await ctx.close()
	}
}

// ---------------------------------------------------------------------------------------------------------
// The server's HTML: the bar alone, nothing typed or found, the same for every guest.

async function html() {
	where = "the server's HTML"
	console.log(where)
	const agents = {
		browser: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
		Googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
		iPhone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
	}
	// What a dev server writes into every answer anew.
	const stable = (text) => text.replace(/nonce="[^"]*"/g, "").replace(/\?t=\d+/g, "").replace(/"sentry-trace[^>]*>/g, "").replace(/"baggage[^>]*>/g, "").replace(/sentry-trace" content="[^"]*"/g, "").replace(/baggage" content="[^"]*"/g, "")
	for (const query of ["tv=search", "tv=search&q=heist"]) {
		const pages = {}
		for (const [name, agent] of Object.entries(agents)) {
			const response = await fetch(`${GUEST}?${query}`, { headers: { "User-Agent": agent } })
			pages[name] = await response.text()
		}
		const room = (text) => text.slice(text.indexOf('id="room"'), text.indexOf("lrb-lip") > 0 ? text.indexOf("lrb-lip") : undefined)
		const first = room(pages.browser)
		const ids = [...first.matchAll(/data-tv-item="([^"]+)"/g)].map((m) => m[1])
		is([...new Set(ids)], BAR, `${query}: the server draws the bar alone`)
		is(ids.length, 4, `${query}: once per edition`)
		check(!first.includes("data-tv-input") && !first.includes("<input"), `${query}: no line to type on is in the server's room`)
		check(!first.includes("heist") && !first.includes("cozy mystery"), `${query}: nothing typed, found or offered is in it`)
		is([same(stable(room(pages.Googlebot)), stable(first)), same(stable(room(pages.iPhone)), stable(first))], [true, true], `${query}: the room's HTML is the same for a browser, Googlebot and an iPhone`)
		numbers[`${query}: the guest's HTML, bytes`] = Object.fromEntries(Object.entries(pages).map(([name, text]) => [name, Buffer.byteLength(text)]))
	}
	numbers["the guest's HTML of /home-preview, bytes"] = Buffer.byteLength(await (await fetch(GUEST, { headers: { "User-Agent": agents.browser } })).text())
}

// ---------------------------------------------------------------------------------------------------------
// Screenshots, and the sheets beside the prototype's.

const dir = join(here, "shots")
async function shots(who, url) {
	mkdirSync(dir, { recursive: true })
	const member = who === "member"
	const at = (query) => `${url}${member ? "&" : "?"}${query}`
	const settle = async (page) => {
		await page.evaluate(() => Promise.all([...document.querySelectorAll("#room img")].map((img) => img.decode().catch(() => {}))))
		await page.waitForTimeout(1100)
	}
	const shot = async (page, name) => {
		await settle(page)
		await page.screenshot({ path: join(dir, `${name}.jpg`), quality: 82 })
	}
	for (const [size, device] of [
		[DESKTOP, "desktop"],
		[PHONE, "phone"],
	]) {
		where = `shots ${who} ${device}`
		console.log(where)
		const phone = device === "phone"
		const { ctx, page } = await open(url, size, { storage: member ? undefined : { country: "US" }, member })
		await remote(page, "Search", phone)
		await until(page, (x) => same(x.items, QUESTION) && Boolean(x.line?.focused), "the question", 60000)
		await shot(page, `search-${who}-${device}`)
		if (!member) {
			await page.keyboard.type("h")
			await until(page, (x) => x.says === "Two letters or more.", "one character")
			await shot(page, `search-one-${who}-${device}`)
			await page.keyboard.press("Backspace")
		}
		await page.keyboard.type("heist")
		await until(page, (x) => x.labels.go === "Search “heist”", "typed")
		await shot(page, `search-typed-${who}-${device}`)
		if (!member) {
			await key(page, "ArrowRight", IDEA_ITEMS[0])
			await shot(page, `search-idea-${who}-${device}`)
			await page.keyboard.type("s")
			await page.keyboard.press("Backspace")
			await until(page, focusIs("go"), "the focus on the key again")
		}
		await page.keyboard.press("Enter")
		let s = await until(page, (x) => found()(x) && Boolean(x.picture), "the results", 90000)
		await shot(page, `results-${who}-${device}`)
		if (!member) {
			const ids = titlesOf(s)
			await key(page, "ArrowRight", `title:${ids[1]}`)
			await key(page, "ArrowRight", `title:${ids[2]}`)
			await until(page, (x) => Boolean(x.picture), "the third title's picture")
			await shot(page, `results-third-${who}-${device}`)
			await page.keyboard.press("Enter")
			await until(page, (x) => x.items.includes("watch") && Boolean(x.picture), "the title screen", 60000)
			await page.waitForTimeout(1500)
			await shot(page, `results-title-${who}-${device}`)
			for (const [query, name, wait] of [
				["slow heist", "searching", (x) => x.text.includes("Searching…")],
				["zz nothing", "nothing", (x) => x.text.includes("Nothing found.")],
				["busy now", "busy", (x) => x.text.includes(BUSY)],
			]) {
				await page.goto(at(`tv=search&q=${encodeURIComponent(query)}`), { waitUntil: "load", timeout: 180000 })
				await until(page, wait, name, 60000)
				await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" })
				await page.screenshot({ path: join(dir, `results-${name}-${who}-${device}.jpg`), quality: 82 })
			}
		}
		await ctx.close()
	}
}

async function sheets() {
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
			pair("1920 x 1080, search as a guest", "12-search-desktop", "search-guest-desktop", "slice 10: the question is a real input with the browser's focus; the ideas are the TV's own six, four of them", 956),
			pair("The results", "13-search-results-desktop", "results-guest-desktop", "slice 10: real cards from Discover's results for a ranked list that stands in for the search (see README). The Expand key is slice 11's; its corner is kept free", 956),
			row(
				"Typing: one character, a query, and the focus moved to an idea with Right (the line keeps what is typed)",
				[
					["search-one-guest-desktop", "one character: its key is there and does nothing yet"],
					["search-typed-guest-desktop", "OK searches for it"],
					["search-idea-guest-desktop", "the focus on an idea"],
				],
				636,
			),
			row(
				"The results: the focus on the third title; a title's screen; while the search runs; nothing found; the search role's busy answer",
				[
					["results-third-guest-desktop", "the name and the picture follow the focus"],
					["results-title-guest-desktop", "a found title's screen"],
					["results-searching-guest-desktop", "searching"],
					["results-nothing-guest-desktop", "nothing found"],
					["results-busy-guest-desktop", "busy"],
				],
				380,
			),
			row(
				"A member (the harness; its Discover has no snapshot, so the cards are handed in)",
				[
					["search-member-desktop", "a member's question"],
					["search-typed-member-desktop", "typed"],
					["results-member-desktop", "a member's results"],
				],
				636,
			),
		].join(""),
	)
	await sheet(
		"phone-beside-prototype",
		1720,
		`<h2>390 x 844: the prototype (left of each pair) and slice 10 (right). Search, and its results</h2><div>${[
			["12-search-phone", "search-guest-phone"],
			["13-search-results-phone", "results-guest-phone"],
		]
			.map(([their, our]) => cell(theirs(their), "prototype", 270) + cell(ours(our), "slice 10", 270))
			.join("")}</div>${row(
			"One character; a query; the focus on an idea; the focus on the third title; a title's screen",
			[
				["search-one-guest-phone", "one character"],
				["search-typed-guest-phone", "a query"],
				["search-idea-guest-phone", "the focus on an idea"],
				["results-third-guest-phone", "the third title"],
				["results-title-guest-phone", "a found title's screen"],
			],
			270,
		)}${row(
			"While the search runs; nothing found; busy; a member's question and results",
			[
				["results-searching-guest-phone", "searching"],
				["results-nothing-guest-phone", "nothing found"],
				["results-busy-guest-phone", "busy"],
				["search-member-phone", "a member's question"],
				["results-member-phone", "a member's results"],
			],
			270,
		)}`,
	)
}

// ---------------------------------------------------------------------------------------------------------

if (guestSide) await keepStock()
else stock = JSON.parse(readFileSync(STOCK, "utf8"))

// A dev server's first page load after a start reloads itself once Vite has optimized its dependencies, which
// would cut a walk short: load each page once before the real run, through search, its results and a title.
{
	where = "warming the dev server"
	console.log(where)
	const { ctx, page } = await open(guestSide ? GUEST : MEMBER, DESKTOP, { member: !guestSide })
	await page.keyboard.press("s")
	await page.waitForTimeout(6000)
	await page.keyboard.type("heist")
	await page.keyboard.press("Enter")
	await page.waitForTimeout(8000)
	await page.keyboard.press("Enter")
	await page.waitForTimeout(6000)
	await ctx.close()
	if (guestSide) {
		const warm = await open(`${ORIGIN}/discover?q=heist`, DESKTOP, { room: false })
		await warm.page.waitForTimeout(6000)
		await warm.ctx.close()
	}
}
passed = 0
failed.length = 0

const parts = process.env.PARTS?.split(",")
const part = (name) => !parts || parts.includes(name)
if (only !== "shots") {
	if (guestSide) {
		if (part("refused")) await refused()
		if (part("walk")) for (const size of [DESKTOP, PHONE]) await walk("guest", GUEST, size)
		if (part("same")) await sameAsDiscover()
		if (part("sizes")) await sizes()
		if (part("html")) await html()
	} else if (part("walk")) for (const size of [DESKTOP, PHONE]) await walk("member", MEMBER, size)
}
if (only !== "checks") {
	await shots(guestSide ? "guest" : "member", guestSide ? GUEST : MEMBER)
	if (!guestSide) await sheets()
}
await browser.close()
// The guest's half keeps its count and numbers for the member's half, which writes checks.json for both.
const whole = !parts && only !== "shots"
if (guestSide) {
	// A run of some parts keeps the count of the last whole one.
	const kept = existsSync(STOCK) ? JSON.parse(readFileSync(STOCK, "utf8")).guest : null
	writeFileSync(STOCK, JSON.stringify({ ...stock, guest: whole ? { passed, failed, numbers } : kept }))
}
if (whole) {
	if (!guestSide) {
		const guest = stock.guest ?? { passed: 0, failed: ["the guest's half was not run"], numbers: {} }
		writeFileSync(
			join(here, "checks.json"),
			`${JSON.stringify({ passed: guest.passed + passed, failed: [...guest.failed, ...failed], halves: { guest: guest.passed, member: passed }, numbers: { ...guest.numbers, ...numbers } }, null, "\t")}\n`,
		)
	}
}
if (!whole || guestSide) console.log(JSON.stringify(numbers, null, 1))
console.log(`${passed} checks passed, ${failed.length} failed`)
for (const line of failed) console.log(" -", line)
process.exit(failed.length ? 1 : 0)
