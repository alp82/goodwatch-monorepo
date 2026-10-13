// Slice 6 of the new TV (mini Discover): walks home, Discover's three tabs, the titles of one choice, a title and
// Change on /home-preview with the keyboard, both Remotes' keys, the pointer and a finger, as a guest on real data
// and as a member on the tracking harness; asks the pool for the tiles' pictures; compares the TV's four titles
// with Discover's own address for the same person, and follows the Expand key's effect there; measures every key
// and the Expand key's corner on every phone of the room's table; and takes the screenshots in shots/ and the
// sheets beside the prototype's own.
//
//   PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs GUEST=http://localhost:3261 \
//   MEMBER=http://localhost:3262 node drive.mjs [checks|shots]
//
// PARTS=pool,walk,same,sizes,html runs some of the checks.
//
// The repo has no browser driver: install playwright-core outside it. GUEST is a dev server of goodwatch-webapp
// that reads real data; MEMBER is one without any service, for the harness (see README.md here for both
// commands). PROTOTYPE= is the folder of the prototype's notes (docs/prototypes/tv-screen-design on
// prototype/tv-screen-flow), for the sheets.
//
// Nothing here signs in or writes to a server: a guest's country, services and ratings are put into the browser's
// own storage, and requests that would leave the machine are stopped in the browser.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const ORIGIN = process.env.GUEST ?? "http://localhost:3261"
const GUEST = `${ORIGIN}/home-preview`
const MEMBER = `${process.env.MEMBER ?? "http://localhost:3262"}/prototype/my-library-real/tv?member=six`
const prototype = process.env.PROTOTYPE ?? "/home/alper/projects/goodwatch-monorepo-38caebf4/docs/prototypes/tv-screen-design"
const only = process.argv[2]
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")

const DESKTOP = [1920, 1080]
const PHONE = [390, 844]
const BAR = ["bar:back", "bar:search", "bar:menu"]
const TAB_ITEMS = ["tab:moods", "tab:themes", "tab:styles"]
/** The three tabs as decided: the tab, how an option is named in an item and in the TV's URL, Discover's parameter, the six. */
const TABS = [
	{ tab: "moods", kind: "mood", param: "moods", keys: ["funny", "feelgood", "romance", "action", "scary", "mind"], names: ["Funny", "Feel-good", "Romance", "Action", "Scary", "Mind-bending"] },
	{ tab: "themes", kind: "theme", param: "themes", keys: ["crime", "mystery", "family", "growing", "future", "fantasy"], names: ["Crime", "Mystery", "Family", "Growing up", "Future", "Fantasy"] },
	{ tab: "styles", kind: "style", param: "styles", keys: ["animated", "spectacle", "slow", "fast", "talky", "nonlinear"], names: ["Animated", "Spectacle", "Slow burn", "Fast-paced", "Talky", "Nonlinear"] },
]
const optionsOf = (tab) => {
	const { kind, keys } = TABS.find((one) => one.tab === tab)
	return keys.map((key) => `${kind}:${key}`)
}
const choiceItems = (tab) => [...TAB_ITEMS, ...optionsOf(tab), ...BAR]
const TITLE = ["watch", "want-to-see", "seen", ...BAR]
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

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--use-angle=gl", "--ignore-gpu-blocklist"] })

/** Opens a page. A busy machine times a load out now and then: try again, twice. */
async function open(url, [width, height], { touch = width < 768, tries = 3, reducedMotion, before, room = true, storage, userAgent } = {}) {
	const ctx = await browser.newContext({
		viewport: { width, height },
		deviceScaleFactor: touch ? 2 : 1,
		reducedMotion,
		userAgent,
		...(touch ? { isMobile: true, hasTouch: true } : {}),
	})
	// What a guest's browser holds before the page loads: their country and services, their progress.
	if (storage)
		await ctx.addInitScript((entries) => {
			if (sessionStorage.getItem("drive:seeded")) return
			sessionStorage.setItem("drive:seeded", "1")
			for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value)
		}, storage)
	const page = await ctx.newPage()
	const logs = []
	const requests = []
	const answers = []
	page.on("console", (m) => {
		if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text()}`)
	})
	page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`))
	page.on("request", (r) => requests.push({ url: r.url(), method: r.method(), body: r.postData() }))
	page.on("response", async (r) => {
		const path = new URL(r.url()).pathname
		if (path !== "/api/living-room/picks" && path !== "/api/discover/results") return
		answers.push({ path, search: new URL(r.url()).search, status: r.status(), method: r.request().method(), json: await r.json().catch(() => null) })
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
	await before?.(page)
	try {
		await page.goto(url, { waitUntil: "load", timeout: 180000 })
		await page.waitForSelector(room ? "#room:not([data-room=unmeasured]) [data-tv-item]" : "h1", { timeout: 180000 })
	} catch (error) {
		await ctx.close().catch(() => {})
		if (tries <= 1) throw error
		console.log("loading again:", String(error.message).split("\n")[0])
		await sleep(4000)
		return open(url, [width, height], { touch, tries: tries - 1, reducedMotion, before, room, storage, userAgent })
	}
	// The dev tools' round key is no part of the page.
	await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" })
	await page.waitForTimeout(600)
	return { ctx, page, logs, requests, answers, left }
}

/** What the TV shows. */
const read = (page) =>
	page.evaluate(() => {
		const room = document.getElementById("room")
		if (!room) return { search: location.search, path: location.pathname, room: false, items: [], focus: [], open: [], labels: {}, layers: 0, text: "" }
		const layers = [...room.querySelectorAll("[data-tv-layer]")]
		const top = layers.at(-1)
		const items = top ? [...top.querySelectorAll("[data-tv-item]")] : []
		const id = (el) => el.getAttribute("data-tv-item")
		const place = top?.querySelector("[data-tv-expand-place]")
		return {
			search: location.search,
			path: location.pathname,
			room: true,
			layers: layers.length,
			items: items.map(id),
			focus: items.filter((el) => el.getAttribute("aria-current")).map(id),
			// The tabs that say they are open.
			open: items.filter((el) => el.getAttribute("aria-pressed") === "true").map(id),
			// What an item says: its label for a screen reader, else its name (a tile's first line), else its words.
			labels: Object.fromEntries(items.map((el) => [id(el), el.getAttribute("aria-label") ?? el.querySelector("span.block")?.textContent ?? el.textContent])),
			// A tile's picture, and what it is painted with under or in place of it.
			tiles: Object.fromEntries(
				items
					.filter((el) => el.classList.contains("tvc-tile"))
					.map((el) => [id(el), { img: el.querySelector("img")?.getAttribute("src") ?? null, loaded: Boolean(el.querySelector("img")?.naturalWidth), paint: el.querySelector("span.absolute.inset-0")?.style.background ?? null }]),
			),
			// The top bar's name and what stands under it.
			name: top?.querySelector(".justify-between .truncate.font-bold")?.textContent ?? null,
			crumb: top?.querySelector(".justify-between .truncate.leading-tight")?.textContent ?? null,
			// The list's focused title: its name and its line of facts.
			heading: top?.querySelector(".tvc-fade .tracking-tight")?.textContent ?? null,
			facts: top?.querySelector(".tvc-fade .text-white\\/75")?.textContent ?? null,
			text: top?.innerText ?? "",
			toast: room.querySelector(".tvc-toast")?.textContent ?? null,
			history: history.length,
			expandPlace: place ? place.childElementCount : null,
			// The picture behind the screen: the last one, once a cross-fade has brought it in.
			picture: [...(top?.querySelectorAll(":scope > .absolute.inset-0.overflow-hidden img") ?? [])].at(-1)?.getAttribute("src") ?? null,
			// The screen's own element carries the script's mark for as long as it is the same screen.
			marked: top?.dataset.driveMark === "1",
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
			check(false, `${what}: still ${JSON.stringify(now && { path: now.path, search: now.search, focus: now.focus, open: now.open, items: now.items, heading: now.heading })}`)
			return now ?? { items: [], focus: [], open: [], labels: {}, tiles: {}, text: "" }
		}
		await page.waitForTimeout(60)
	}
}
const focusIs = (item) => (s) => s.focus.length === 1 && s.focus[0] === item
/** The screen of an address is on show with all of `items`, and the focus on `item`. */
const screenIs = (search, item, items) => (s) => s.room && s.search === search && s.layers === 1 && focusIs(item)(s) && (!items || same(s.items, items))

/** A key of the keyboard, and the state once the focus is on `item`. */
async function key(page, name, item, what = `${name} moves the focus to ${item}`) {
	await page.keyboard.press(name)
	return until(page, focusIs(item), what)
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

/** From a tab down into its options, and along the row to `item`. */
async function into(page, item) {
	await page.keyboard.press("ArrowDown")
	await until(page, (x) => /^(mood|theme|style):/.test(x.focus[0] ?? ""), "Down from a tab reaches its options")
	for (let n = 0; n < 3 && (await read(page)).focus[0] !== item; n++) await page.keyboard.press("ArrowLeft")
	return until(page, focusIs(item), `the focus on ${item}`)
}

const tvKey = (card) => `${card.media_type}-${card.tmdb_id}`
/** A title's key from its page's address: `/show/108978-reacher`. */
const keyOfHref = (href) => /^\/(movie|show)\/(\d+)/.exec(href)?.slice(1).join("-")
/** The requests that would have left the machine, without the site's own telemetry. */
const beyondTelemetry = (left) => [...new Set(left.map((u) => new URL(u).hostname))].filter((host) => !/posthog|sentry|googletagmanager|google-analytics|cloudflareinsights/.test(host))
// What a dev server's console says on any page.
const noise = (logs) => logs.filter((l) => !l.includes("Future Flag") && !l.includes("net::ERR_FAILED") && !l.includes("503") && !l.includes("Failed to load resource") && !l.includes("Swiper Loop Warning"))

const guestOf = (rest = {}) => ({ interactions: [], country: "US", services: null, ...rest })
const json = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
/** Discover's own results for a filter bar query and a guest, as the Discover page asks for them. */
const results = async (query, guest = guestOf()) => (await fetch(`${ORIGIN}/api/discover/results?${query}&page=1`, json({ guest }))).json()

// ---------------------------------------------------------------------------------------------------------
// The pool's pictures for the tiles, asked directly.

async function pool() {
	where = "the pool's tile pictures"
	console.log(where)
	const ask = async (guest) => {
		const start = performance.now()
		const response = await fetch(`${ORIGIN}/api/living-room/picks?view=pool`, json({ guest }))
		return { answer: await response.json(), ms: Math.round(performance.now() - start), status: response.status, cache: response.headers.get("cache-control") }
	}
	const nobody = await ask(guestOf())
	is(nobody.status, 200, "the pool answers")
	const art = nobody.answer.choiceArt ?? {}
	const all = TABS.flatMap((one) => optionsOf(one.tab))
	is(Object.keys(art).sort(), [...all].sort(), "a picture for each of the eighteen options, and for nothing else")
	check(Object.values(art).every((path) => /^\/[\w-]+\.(jpg|png)$/.test(path)), "each is a backdrop's path, and nothing else of a title")
	is(new Set(Object.values(art)).size, Object.keys(art).length, "eighteen options show eighteen pictures")
	// The same for everyone: another country, saved services, ratings.
	const rated = [
		{ media_type: "movie", tmdb_id: 603, type: "score", score: 9, timestamp: 1 },
		{ media_type: "movie", tmdb_id: 27205, type: "score", score: 8, timestamp: 2 },
	]
	const other = await ask(guestOf({ country: "DE", services: "8,337", interactions: rated }))
	is(other.answer.choiceArt, art, "the pictures are the same for a guest in another country with services and ratings")
	numbers["the pool's answer, bytes"] = JSON.stringify(nobody.answer).length
	numbers["of which the tile pictures, bytes"] = JSON.stringify(art).length + '"choiceArt":,'.length
	// The pictures are worked out once; a pool request after that reads them from memory.
	const times = []
	for (let n = 0; n < 5; n++) times.push((await ask(guestOf())).ms)
	numbers["five pool requests in a row, ms"] = times
	return art
}

// ---------------------------------------------------------------------------------------------------------
// The walk: home, Discover's tabs, one choice, its titles, a title, Change. The same for a guest and a member, on
// the desktop and on the phone.

async function walk(who, url, size) {
	const member = who === "member"
	const phone = size[0] < 768
	const at = (tv) => (member ? `?member=six${tv ? `&${tv}` : ""}` : tv ? `?${tv}` : "")
	const press = phone ? "a tap" : "a click"
	where = `${who} ${size.join("x")}`
	console.log(where)
	const { ctx, page, logs, requests, answers, left } = await open(url, size, {
		storage: member ? undefined : { country: "US" },
		// The harness has no title snapshot, so its Discover answers 503. The list's answer there is the real-data
		// server's for a visitor nobody knows anything about, handed to the page; the page's own request is kept.
		before: member
			? (p) =>
					p.route("**/api/discover/results*", async (route) => {
						const { search } = new URL(route.request().url())
						const response = await fetch(`${ORIGIN}/api/discover/results${search}`)
						return route.fulfill({ status: response.status, contentType: "application/json", body: await response.text() })
					})
			: undefined,
	})
	const asked = (part) => requests.filter((r) => r.url.includes(part))
	const code = () => asked("/tv/screens/Discover")
	const lists = () => asked("/api/discover/results")

	// ---- Arrival: nothing of Discover is asked for.
	let s = await read(page)
	is(s.focus, ["app:tonight"], "the focus starts on Tonight's tile")
	is(code().length, 0, "Discover's code is not in the first view")
	is(asked("/tv/use-tv-discover").length + asked("/tv/tv-discover.ts").length + asked("/domain/themes-styles").length, 0, "nor are its data hook, its words and the themes' and styles' rules")
	is(lists().length, 0, "no results are asked for on arrival")
	const history = s.history

	// ---- The tile, and the app.
	s = await key(page, "ArrowRight", "app:discover")
	await until(page, () => code().length > 0, "Discover's code is asked for while its tile has the focus")
	await page.keyboard.press("Enter")
	s = await until(page, screenIs(at("tv=discover"), "mood:funny", choiceItems("moods")), "OK on the tile opens Discover: three tabs, Moods open, the focus on its first option")
	is(s.history, history + 1, "one history entry")
	is(s.open, ["tab:moods"], "Moods says it is open")
	is(s.name, "Discover", "the bar names the screen")
	is(TAB_ITEMS.map((item) => s.labels[item]), ["Moods", "Themes", "Styles"], "the tabs' names")
	is(optionsOf("moods").map((item) => s.labels[item]), TABS[0].names, "the six moods, by the app's names")
	is(s.expandPlace, 0, "the Expand key's corner is there and empty")
	is(lists().length, 0, "the choice screen asks for no results")
	if (member) {
		// The harness has no pool: every tile is its option's colour alone.
		check(Object.values(s.tiles).every((tile) => !tile.img && /linear-gradient\(160deg/.test(tile.paint ?? "")), "without the pool every tile is its option's colour alone")
		is(s.picture, null, "and nothing is behind the screen")
	} else {
		s = await until(page, (x) => Object.values(x.tiles).length === 6 && Object.values(x.tiles).every((tile) => tile.loaded), "every tile shows a picture once the pool is there", 40000)
		check(Object.values(s.tiles).every((tile) => /\/t\/p\/w780\//.test(tile.img)), "a tile's picture is a w780 backdrop")
		is(new Set(Object.values(s.tiles).map((tile) => tile.img)).size, 6, "six tiles, six pictures")
		check(Object.values(s.tiles).every((tile) => /color-mix/.test(tile.paint ?? "")), "each under its option's own colour")
		s = await until(page, (x) => Boolean(x.picture), "the focused option's picture is behind the screen", 20000)
		const wide = phone ? "w780" : "w1280"
		check(s.picture.includes(`/${wide}/`) && s.picture.split("/").at(-1) === s.tiles["mood:funny"].img.split("/").at(-1), `it is Funny's, as a ${wide} backdrop`)
		const pool = answers.find((a) => a.path === "/api/living-room/picks")
		is(Object.fromEntries(optionsOf("moods").map((item) => [item, s.tiles[item].img.split("/").at(-1)])), Object.fromEntries(optionsOf("moods").map((item) => [item, pool?.json?.choiceArt?.[item]?.slice(1)])), "the pictures are the pool's")
	}

	// ---- The options: three by three.
	s = await key(page, "ArrowRight", "mood:feelgood")
	if (!member) await until(page, (x) => x.picture?.split("/").at(-1) === x.tiles["mood:feelgood"].img.split("/").at(-1), "the picture behind follows the focus")
	s = await key(page, "ArrowRight", "mood:romance")
	await page.keyboard.press("ArrowRight")
	await page.waitForTimeout(250)
	is((await read(page)).focus, ["mood:romance"], "Right at the row's end stays")
	s = await key(page, "ArrowDown", "mood:mind")
	s = await key(page, "ArrowLeft", "mood:scary")
	s = await key(page, "ArrowLeft", "mood:action")
	s = await key(page, "ArrowUp", "mood:funny")
	is(s.search, at("tv=discover"), "no focus move changes the address")
	is(s.history, history + 1, "or adds a history entry")
	if (phone) check(/Comedy leads/.test(s.text), "the phone says the focused option's line in its last row")
	else check(/Comedy leads: wit, slapstick or the absurd\./.test(s.text) && /Surreal or layered; keeps you thinking\./.test(s.text), "the desktop says each option's line on its tile")

	// ---- The tabs: Up from the options lands on the open one; along the tabs the direction keys open them.
	s = await key(page, "ArrowRight", "mood:feelgood")
	s = await key(page, "ArrowRight", "mood:romance")
	s = await key(page, "ArrowUp", "tab:moods", "Up from the last option of the row lands on the open tab, not on the nearest one")
	is(s.open, ["tab:moods"], "Moods is still the open one")
	await page.evaluate(() => {
		;[...document.querySelectorAll("#room [data-tv-layer]")].at(-1).dataset.driveMark = "1"
	})
	await page.keyboard.press("ArrowRight")
	s = await until(page, screenIs(at("tv=discover&tab=themes"), "tab:themes", choiceItems("themes")), "Right along the tabs opens Themes, with its six options, and the focus stays on the tab")
	is(s.open, ["tab:themes"], "Themes says it is open")
	is(s.history, history + 1, "a change of tab adds no history entry")
	is(optionsOf("themes").map((item) => s.labels[item]), TABS[1].names, "the six themes, by the app's names")
	check(s.marked, "a change of tab is no new screen: the screen stays and its options change")
	if (!member) {
		s = await until(page, (x) => Object.values(x.tiles).length === 6 && Object.values(x.tiles).every((tile) => tile.loaded), "the themes' tiles show their pictures", 40000)
		// #c2413a, as the browser writes it.
		check(/194, 65, 58/.test(s.tiles["theme:crime"].paint), `Crime's tile is under Crime's own colour: ${s.tiles["theme:crime"].paint}`)
	}
	await page.keyboard.press("ArrowRight")
	s = await until(page, screenIs(at("tv=discover&tab=styles"), "tab:styles", choiceItems("styles")), "Right again opens Styles")
	is(optionsOf("styles").map((item) => s.labels[item]), TABS[2].names, "the six styles, by the app's names")
	check(s.marked, "still the same screen")
	await page.keyboard.press("ArrowRight")
	await page.waitForTimeout(300)
	s = await read(page)
	is([s.search, s.focus], [at("tv=discover&tab=styles"), ["tab:styles"]], "Right on the last tab stays")
	await page.keyboard.press("ArrowLeft")
	s = await until(page, screenIs(at("tv=discover&tab=themes"), "tab:themes", choiceItems("themes")), "Left opens Themes again")
	is(s.history, history + 1, "still one history entry")
	is(lists().length, 0, "the tabs ask for no results")

	// ---- Down into the options, Up to the open tab from every column, Up to the bar, Down to the open tab.
	await page.keyboard.press("ArrowDown")
	s = await until(page, (x) => x.focus[0]?.startsWith("theme:"), "Down from a tab reaches its options")
	numbers[`${where}: Down from Themes lands on`] = s.focus[0]
	for (const option of ["theme:crime", "theme:mystery", "theme:family"]) {
		await page.goto(`${url}${member ? "&" : "?"}tv=discover&tab=themes&focus=${encodeURIComponent(option)}`, { waitUntil: "load", timeout: 180000 })
		await until(page, screenIs(at(`tv=discover&tab=themes&focus=${encodeURIComponent(option)}`), option), `a link to Themes with the focus on ${option}`, 60000)
		s = await key(page, "ArrowUp", "tab:themes", `Up from ${option} lands on the open tab`)
	}
	await page.keyboard.press("ArrowUp")
	s = await until(page, (x) => x.focus[0]?.startsWith("bar:"), "Up again reaches the top bar")
	numbers[`${where}: Up from the tabs lands on`] = s.focus[0]
	// From each of the bar's keys.
	for (const to of BAR) {
		for (let n = 0; n < 3 && (await read(page)).focus[0] !== "bar:back"; n++) await page.keyboard.press("ArrowLeft")
		for (let n = 0; n < BAR.indexOf(to); n++) await page.keyboard.press("ArrowRight")
		await until(page, focusIs(to), `the focus on ${to}`)
		s = await key(page, "ArrowDown", "tab:themes", `Down from ${to} lands on the open tab`)
		await page.keyboard.press("ArrowUp")
		await until(page, (x) => x.focus[0]?.startsWith("bar:"), "Up to the bar")
	}
	s = await key(page, "ArrowDown", "tab:themes", "and down again")
	// The focus was never in the address but for the link's own `focus=`, which the TV does not rewrite.
	check(!s.search.includes("focus=tab"), "the focus is not written into the address")

	// ---- The pointer and a finger: over a tab is the focus only, a press opens it.
	await page.goto(`${url}${member ? "&" : "?"}tv=discover`, { waitUntil: "load", timeout: 180000 })
	s = await until(page, screenIs(at("tv=discover"), "mood:funny", choiceItems("moods")), "Discover by its link: Moods open", 60000)
	const direct = s.history
	if (!phone) {
		await itemOf(page, "tab:styles").hover()
		s = await until(page, focusIs("tab:styles"), "the pointer over Styles gives it the focus")
		await page.waitForTimeout(500)
		s = await read(page)
		is([s.search, s.open, s.items], [at("tv=discover"), ["tab:moods"], choiceItems("moods")], "and does not open it: Moods stays open with its options")
		// OK on a tab that has the focus opens it.
		await page.keyboard.press("Enter")
		s = await until(page, screenIs(at("tv=discover&tab=styles"), "tab:styles", choiceItems("styles")), "OK on the focused tab opens it")
		await itemOf(page, "tab:themes").hover()
		s = await until(page, focusIs("tab:themes"), "the pointer over Themes gives it the focus")
		is(s.open, ["tab:styles"], "Styles stays open")
	}
	await point(page, "tab:themes", phone)
	s = await until(page, screenIs(at("tv=discover&tab=themes"), "tab:themes", choiceItems("themes")), `${press} on Themes opens it`)
	await point(page, "tab:moods", phone)
	s = await until(page, screenIs(at("tv=discover"), "tab:moods", choiceItems("moods")), `${press} on Moods opens it`)
	is(s.history, direct, "no press on a tab adds a history entry")
	await point(page, "tab:moods", phone)
	await page.waitForTimeout(300)
	is((await read(page)).search, at("tv=discover"), `${press} on the open tab changes nothing`)

	// ---- Both Remotes' keys do the same.
	await remote(page, "Next", phone)
	s = await until(page, screenIs(at("tv=discover&tab=themes"), "tab:themes", choiceItems("themes")), "the Remote's Right along the tabs opens Themes")
	await remote(page, "Down", phone)
	s = await until(page, (x) => x.focus[0]?.startsWith("theme:"), "the Remote's Down reaches the options")
	await remote(page, "Up", phone)
	s = await until(page, focusIs("tab:themes"), "the Remote's Up lands on the open tab")

	// ---- One choice leads to its titles.
	s = await into(page, "theme:crime")
	const before = s.history
	await remote(page, "OK", phone)
	s = await until(page, (x) => x.search === at("tv=discover&theme=crime") && x.items.filter((item) => item.startsWith("title:")).length > 0, "OK on Crime opens its titles", 60000)
	is(s.history, before + 1, "one history entry")
	const titles = s.items.filter((item) => item.startsWith("title:"))
	is(s.items, [...titles, "change", ...BAR], "the titles, then Change, then the bar")
	is(titles.length, 4, "four titles")
	is(s.focus, [titles[0]], "the focus on the first title")
	is([s.name, s.crumb], ["Discover", "Crime"], "the bar says whose titles these are")
	is(s.expandPlace, 0, "the Expand key's corner is there and empty")
	check(Boolean(s.heading) && s.heading === s.labels[titles[0]], `the screen names the focused title: ${s.heading}`)
	check(/\d{4} · (Movie|Show)/.test(s.facts ?? ""), `with its facts: ${s.facts}`)
	numbers[`${where}: Crime's titles`] = titles.map((item) => s.labels[item])
	// One request, as the Discover page makes it for this one filter.
	const list = lists()
	is(list.length, 1, "one request for the titles")
	is(new URL(list[0]?.url ?? ORIGIN).search, "?themes=crime&page=1", "Discover's own results for the one theme, and nothing else in the query")
	if (member) is([list[0]?.method, list[0]?.body], ["GET", null], "a member asks with GET")
	else {
		is(list[0]?.method, "POST", "a guest asks with POST")
		is(Object.keys(JSON.parse(list[0]?.body ?? "{}").guest ?? {}).sort(), ["country", "interactions", "services"], "with their browser's progress, country and services, as the Discover page sends them")
		const answer = answers.find((a) => a.path === "/api/discover/results")
		is(titles, (answer?.json?.cards ?? []).slice(0, 4).map((card) => `title:${tvKey(card)}`), "the four titles are the first four cards of the answer, in its order")
		numbers[`${where}: Discover's answer for Crime, titles in all`] = answer?.json?.total
	}
	s = await until(page, (x) => Boolean(x.picture) && Object.values(x.tiles).every((tile) => tile.loaded), "the posters and the picture behind them", 30000)
	check(Object.values(s.tiles).every((tile) => new RegExp(`/t/p/${phone ? "w185" : "w342"}/`).test(tile.img)), `a poster is a ${phone ? "w185" : "w342"} file`)
	check(s.picture.includes(phone ? "/w780/" : "/w1280/"), "the focused title's backdrop is behind them")

	// ---- Along the titles, to Change, and back.
	const first = s.picture
	s = await key(page, "ArrowRight", titles[1])
	s = await until(page, (x) => x.heading === x.labels[titles[1]], "the name follows the focus")
	await until(page, (x) => x.picture && x.picture !== first, "and so does the picture", 20000)
	s = await key(page, "ArrowRight", titles[2])
	s = await key(page, "ArrowRight", titles[3])
	if (phone) {
		await page.keyboard.press("ArrowRight")
		await page.waitForTimeout(250)
		is((await read(page)).focus, [titles[3]], "Right at the row's end stays")
		s = await key(page, "ArrowDown", "change", "Down from the titles reaches Change")
		s = await key(page, "ArrowUp", titles[0], "Up from Change returns to the titles")
	} else {
		s = await key(page, "ArrowRight", "change", "Right from the last title reaches Change")
		is(s.heading, s.labels[titles[3]], "the screen keeps naming the last focused title")
		s = await key(page, "ArrowLeft", titles[3], "Left from Change returns to the titles")
	}
	is(s.labels.change, "Change", "Change says Change")
	await page.keyboard.press("ArrowUp")
	s = await until(page, (x) => x.focus[0]?.startsWith("bar:"), "Up reaches the bar")
	await page.keyboard.press("ArrowDown")
	s = await until(page, (x) => x.focus[0]?.startsWith("title:"), "Down returns to the titles")
	is(s.search, at("tv=discover&theme=crime"), "no focus move changes the address")
	is(lists().length, 1, "or asks again")

	// ---- A title leads to its title screen, which names it at once.
	const chosen = s.focus[0]
	const name = s.labels[chosen]
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.search === at(`tv=title&title=${chosen.slice(6)}`) && x.text.includes(name), "OK on a title opens its title screen, named at once from what the list knew")
	is(s.history, before + 2, "one more history entry")
	s = await until(page, (x) => same(x.items, TITLE) && focusIs("watch")(x), "the title screen with its three keys", 60000)
	check(s.text.includes(name), `it shows ${name}`)

	// ---- Back gives every screen its focus back: the list, the tabs with the tab that was open.
	await page.keyboard.press("Escape")
	s = await until(page, screenIs(at("tv=discover&theme=crime"), chosen), "Back returns to the list with the focus on the title", 30000)
	is(s.items, [...titles, "change", ...BAR], "the same four titles")
	is(lists().length, 1, "from memory: nothing is asked again")
	await page.keyboard.press("Backspace")
	s = await until(page, screenIs(at("tv=discover&tab=themes"), "theme:crime", choiceItems("themes")), "Back from the titles finds Themes still open, with the focus on Crime")
	is(s.open, ["tab:themes"], "Themes says it is open")
	await page.goForward()
	s = await until(page, screenIs(at("tv=discover&theme=crime"), chosen), "the browser's Forward returns to the list with its focus", 30000)

	// ---- Change is one step back to the tabs.
	if (phone) await key(page, "ArrowDown", "change")
	else for (let n = 0; n < 4 && (await read(page)).focus[0] !== "change"; n++) await page.keyboard.press("ArrowRight")
	s = await until(page, focusIs("change"), "the focus on Change")
	await page.keyboard.press("Enter")
	s = await until(page, screenIs(at("tv=discover&tab=themes"), "theme:crime", choiceItems("themes")), "Change leads back to the tabs, Themes open, the focus on Crime")
	is(s.history, before + 2, "by going back: no history entry is added")
	// With the pointer or a finger: another choice, a title, Change.
	await point(page, "theme:future", phone)
	s = await until(page, (x) => x.search === at("tv=discover&theme=future") && x.items.filter((item) => item.startsWith("title:")).length > 0 && x.crumb === "Future", `${press} on Future opens its titles`, 60000)
	const future = s.items.filter((item) => item.startsWith("title:"))
	check(!same(future, titles), "another choice has other titles")
	numbers[`${where}: Future's titles`] = future.map((item) => s.labels[item])
	is(lists().length, 2, "one more request")
	await point(page, future[1], phone)
	s = await until(page, (x) => x.search === at(`tv=title&title=${future[1].slice(6)}`), `${press} on a title opens its title screen`)
	await point(page, "bar:back", phone)
	s = await until(page, (x) => x.search === at("tv=discover&theme=future") && focusIs(future[1])(x), "the bar's Back returns to the list")
	await point(page, "change", phone)
	s = await until(page, screenIs(at("tv=discover&tab=themes"), "theme:future", choiceItems("themes")), `${press} on Change leads back to the tabs`)

	// ---- A reload keeps the tab and the focus.
	await page.reload({ waitUntil: "load", timeout: 180000 })
	s = await until(page, screenIs(at("tv=discover&tab=themes"), "theme:future", choiceItems("themes")), "a reload keeps the open tab and gives the focus back", 60000)

	// ---- A link straight to a choice: its titles; Change shows the tabs in its place; Back then shows home.
	await page.goto(`${url}${member ? "&" : "?"}tv=discover&style=slow`, { waitUntil: "load", timeout: 180000 })
	s = await until(page, (x) => x.search === at("tv=discover&style=slow") && x.items.filter((item) => item.startsWith("title:")).length > 0 && x.crumb === "Slow burn", "a link to a style shows its titles", 60000)
	numbers[`${where}: Slow burn's titles`] = s.items.filter((item) => item.startsWith("title:")).map((item) => s.labels[item])
	const linked = s.history
	if (phone) await key(page, "ArrowDown", "change")
	else for (let n = 0; n < 4 && (await read(page)).focus[0] !== "change"; n++) await page.keyboard.press("ArrowRight")
	await page.keyboard.press("Enter")
	s = await until(page, screenIs(at("tv=discover&tab=styles"), "style:animated", choiceItems("styles")), "Change on a link shows the tabs in its place, Styles open")
	is(s.history, linked, "without a new history entry")
	await page.keyboard.press("Escape")
	s = await until(page, (x) => x.search === at("") && x.items.includes("app:discover"), "Back then shows home")
	// An option the TV does not offer: its tab.
	await page.goto(`${url}${member ? "&" : "?"}tv=discover&theme=war`, { waitUntil: "load", timeout: 180000 })
	s = await until(page, (x) => same(x.items, choiceItems("themes")) && same(x.open, ["tab:themes"]), "a theme the TV does not offer shows the Themes tab", 60000)
	await page.goto(`${url}${member ? "&" : "?"}tv=moods`, { waitUntil: "load", timeout: 180000 })
	s = await until(page, (x) => same(x.items, choiceItems("moods")) && same(x.open, ["tab:moods"]), "the old TV's moods address shows Discover's Moods", 60000)

	is(noise(logs), [], "nothing in the console")
	is(beyondTelemetry(left), [], "no request left the machine but the site's own telemetry, which was stopped")
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// The TV's four titles are the first four of Discover's own address for the same person, and the Expand key's
// effect opens that address with the filter shown as chosen.

/** The first titles on the Discover page, by key, and what it shows as chosen. */
const discoverPage = (page) =>
	page.evaluate(() => {
		const links = [...(document.querySelector("main") ?? document.body).querySelectorAll('a[href^="/movie/"], a[href^="/show/"]')].map((a) => a.getAttribute("href"))
		return {
			path: location.pathname,
			search: location.search,
			titles: [...new Set(links)],
			// A chosen filter is a chip that can be removed.
			chips: [...new Set([...document.querySelectorAll("button[aria-label^='Remove ']")].map((button) => button.getAttribute("aria-label").slice(7)))],
		}
	})

/**
 * The Discover page once it shows `want` as its first four titles. The page draws its loader's titles first, which
 * are a visitor's nobody knows anything about, and asks again with the person's progress and services once it has
 * read them: wait for that answer, as long as a busy dev server may take.
 */
async function settled(page, want, timeout = 45000) {
	const end = Date.now() + timeout
	let now
	for (;;) {
		now = await discoverPage(page).catch(() => null)
		if (now && same(now.titles.slice(0, 4).map(keyOfHref), want)) return now
		if (Date.now() > end) return now ?? { titles: [], chips: [], path: "", search: "" }
		await page.waitForTimeout(250)
	}
}

async function sameAsDiscover() {
	// Three people: nobody; a guest with a saved service, where On my services narrows the list; a guest with a
	// service and ratings, where Not seen yet does too.
	const rated = [
		{ media_type: "show", tmdb_id: 1396, type: "score", score: 9, timestamp: 1 },
		{ media_type: "show", tmdb_id: 108978, type: "score", score: 8, timestamp: 2 },
		{ media_type: "movie", tmdb_id: 603, type: "score", score: 9, timestamp: 3 },
	]
	const people = [
		{ who: "a guest nobody knows", storage: { country: "US" }, guest: guestOf() },
		{ who: "a guest with Netflix saved", storage: { country: "US", withStreamingProviders: "8" }, guest: guestOf({ services: "8" }) },
		{ who: "a guest with Netflix saved and three ratings", storage: { country: "US", withStreamingProviders: "8", [PROGRESS_KEY]: JSON.stringify(rated) }, guest: guestOf({ services: "8", interactions: rated }) },
	]
	const samples = [
		[people[0], "moods", "funny", "Funny"],
		[people[1], "themes", "crime", "Crime"],
		[people[2], "styles", "slow", "Slow burn"],
		[people[2], "themes", "crime", "Crime"],
	]
	for (const [person, tab, option, name] of samples) {
		const { kind, param } = TABS.find((one) => one.tab === tab)
		where = `${name} for ${person.who}`
		console.log(where)
		const { ctx, page } = await open(`${GUEST}?tv=discover&${kind}=${option}`, DESKTOP, { storage: person.storage })
		let s = await until(page, (x) => x.items.filter((item) => item.startsWith("title:")).length === 4, "the TV's four titles", 60000)
		const tv = s.items.filter((item) => item.startsWith("title:")).map((item) => item.slice(6))
		numbers[`${where}: on the TV`] = tv.map((item) => s.labels[`title:${item}`])
		// Discover's results, asked as the page asks.
		const answer = await results(`${param}=${option}`, person.guest)
		is(tv, (answer.cards ?? []).slice(0, 4).map(tvKey), "they are the first four of /api/discover/results for the same person")
		numbers[`${where}: Discover has`] = answer.total

		// The Discover page at the address the Expand key opens, in the same browser.
		const other = await ctx.newPage()
		await other.route((u) => !["localhost", "127.0.0.1", "image.tmdb.org"].includes(u.hostname) && u.protocol.startsWith("http"), (route) => route.fulfill({ status: 204, body: "" }))
		await other.route("**/api/e", (route) => route.fulfill({ status: 200, body: "" }))
		await other.goto(`${ORIGIN}/discover?${param}=${option}`, { waitUntil: "load", timeout: 180000 })
		await other.waitForSelector('a[href^="/movie/"], a[href^="/show/"]', { timeout: 120000 })
		let d = await settled(other, tv)
		is(d.titles.slice(0, 4).map(keyOfHref), tv, "they are the first four titles on the Discover page for the same filter, in the same order")
		check(d.chips.includes(name), `the Discover page shows ${name} as chosen: ${d.chips.join(", ")}`)
		await other.close()

		// The Expand key's effect on the TV: that page. The key itself is slice 11's and is not drawn; the script
		// reaches it with `focus=expand`.
		await page.goto(`${GUEST}?tv=discover&${kind}=${option}&focus=expand`, { waitUntil: "load", timeout: 180000 })
		await until(page, (x) => x.items.filter((item) => item.startsWith("title:")).length === 4, "the list again", 60000)
		await page.keyboard.press("Enter")
		await page.waitForURL((u) => u.pathname === "/discover", { timeout: 120000 })
		await page.waitForSelector('a[href^="/movie/"], a[href^="/show/"]', { timeout: 120000 })
		d = await settled(page, tv)
		is([d.path, d.search], ["/discover", `?${param}=${option}`], "the Expand key's effect opens Discover with the one filter")
		is(d.titles.slice(0, 4).map(keyOfHref), tv, "and the page it opens starts with the TV's four titles")
		check(d.chips.includes(name), `with ${name} shown as chosen`)
		await page.goBack()
		s = await until(page, (x) => x.room && x.search === `?tv=discover&${kind}=${option}&focus=expand` && x.items.filter((item) => item.startsWith("title:")).length === 4, "Back returns to the list on the TV", 60000)
		is(s.items.filter((item) => item.startsWith("title:")).map((item) => item.slice(6)), tv, "with the same four titles")
		await ctx.close()
	}
	// The choice screen's Expand: Discover, and nothing travels.
	where = "the choice screen's Expand"
	const { ctx, page } = await open(`${GUEST}?tv=discover&tab=styles&focus=expand`, DESKTOP, { storage: { country: "US" } })
	await until(page, (x) => same(x.items, choiceItems("styles")), "the choice screen", 60000)
	await page.keyboard.press("Enter")
	await page.waitForURL((u) => u.pathname === "/discover", { timeout: 120000 })
	is(new URL(page.url()).search, "", "the choice screen's Expand opens Discover without a filter")
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// What is where on the TV: every key's box and the Expand key's corner.

/** The boxes of the topmost layer on the window, as they are drawn at rest (a focused key grows a little). */
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
		return {
			k,
			tv: { left: tv.left, top: tv.top, right: tv.right, bottom: tv.bottom },
			items: [...layer.querySelectorAll("[data-tv-item]")].map((el) => ({
				id: el.getAttribute("data-tv-item"),
				...rest(el),
				// What a key says is cut short where it does not fit: a line that is cut off, or words wider than their key.
				cut: [...el.querySelectorAll(".truncate")].some((text) => text.scrollWidth > text.clientWidth + 1) || [...el.querySelectorAll("span.block")].some((text) => text.scrollWidth > text.clientWidth + 1),
			})),
			// A box that cuts off what does not fit (the Frame's content on the phone) holds more than it shows.
			clipped: [...layer.querySelectorAll(".overflow-hidden")].filter((el) => !el.hasAttribute("data-tv-row") && el.scrollHeight > el.clientHeight + 1).length,
			heading: heading ? rest(heading) : null,
			place: place ? rest(place) : null,
			// The smallest type on the screen, in canvas pixels.
			type: Math.min(...[...layer.querySelectorAll("*")].filter((el) => [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())).map((el) => Number.parseFloat(getComputedStyle(el).fontSize))),
		}
	})

const meet = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5
const within = (a, b) => a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5

/** A screen holds what it shows: touch targets, nothing over anything, nothing cut off, the corner free. */
function fits(l, what, { touch = false } = {}) {
	const small = l.items.filter((item) => Math.min(item.width, item.height) < 44 - 0.05)
	if (touch) check(small.length === 0, `${what}: every key is 44 px or more on the phone's screen: ${small.map((item) => `${item.id} ${item.width.toFixed(1)} x ${item.height.toFixed(1)}`).join(", ") || "all"}`)
	const out = l.items.filter((item) => !within(item, l.tv))
	check(out.length === 0, `${what}: every key is inside the picture: ${out.map((item) => item.id).join(", ") || "all"}`)
	const over = l.items.flatMap((a, n) => l.items.slice(n + 1).filter((b) => meet(a, b)).map((b) => `${a.id} and ${b.id}`))
	check(over.length === 0, `${what}: no key lies over another: ${over.join(", ") || "none"}`)
	check(l.clipped === 0, `${what}: nothing is cut off by its box`)
	const cut = l.items.filter((item) => item.cut)
	check(cut.length === 0, `${what}: every key says its words in full: ${cut.map((item) => item.id).join(", ") || "all"}`)
	if (l.heading) check(within(l.heading, l.tv) && !l.items.some((item) => meet(item, l.heading)), `${what}: the focused title's name is inside the picture and under no key`)
	check(l.type >= 20, `${what}: no type under 20 canvas px: ${l.type}`)
	if (l.place) {
		// The Expand key's cell: 158 canvas px wide on the phone, 220 on the desktop, as tall as a key.
		const size = touch ? [158, 54] : [220, 64]
		const corner = { right: l.place.right, bottom: l.place.bottom, left: l.place.right - size[0] * l.k, top: l.place.bottom - Math.max(size[1] * l.k, touch ? 44 : 0) }
		const inCorner = l.items.filter((item) => meet(item, corner))
		check(inCorner.length === 0, `${what}: the Expand key's corner is free: ${inCorner.map((item) => item.id).join(", ") || "free"}`)
	} else check(false, `${what}: the Expand key's corner is there`)
	return { key: Math.min(...l.items.map((item) => Math.min(item.width, item.height))) }
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

async function sizes() {
	for (const size of [...PHONES, DESKTOP]) {
		const touch = size !== DESKTOP
		where = `sizes ${size.join("x")}`
		console.log(where)
		const smallest = {}
		// The worst case of a list: its first title has a long name, set by the script in Discover's own answer.
		const { ctx, page } = await open(`${GUEST}?tv=discover`, size, {
			touch,
			storage: { country: "US" },
			before: (p) =>
				p.route((u) => u.pathname === "/api/discover/results" && u.searchParams.has("styles"), async (route) => {
					const response = await route.fetch()
					const body = await response.json()
					if (body.cards?.[0]) body.cards[0].title = LONG
					return route.fulfill({ response, json: body })
				}),
		})
		numbers[`${where}: the room`] = await page.evaluate(() => {
			const room = document.getElementById("room")
			return [room.dataset.room, room.dataset.remotePlace].filter(Boolean).join(", ")
		})
		// Each tab, with the pictures the pool sends.
		await page.keyboard.press("ArrowUp")
		for (const { tab, kind, keys } of TABS) {
			if (tab !== "moods") await page.keyboard.press("ArrowRight")
			let s = await until(page, (x) => same(x.items, choiceItems(tab)) && focusIs(`tab:${tab}`)(x), `the ${tab} tab`, 30000)
			s = await until(page, (x) => Object.values(x.tiles).length === 6 && Object.values(x.tiles).every((tile) => tile.loaded), `the ${tab} tab's pictures`, 40000)
			const l = await layout(page)
			smallest[tab] = fits(l, `the ${tab} tab`, { touch }).key
			// The tiles stand three by three, each the size of the others.
			const tiles = keys.map((one) => l.items.find((item) => item.id === `${kind}:${one}`))
			check(tiles.every((tile) => Math.abs(tile.width - tiles[0].width) < 0.6 && Math.abs(tile.height - tiles[0].height) < 0.6), `the ${tab} tab: six tiles of one size`)
			check(tiles.slice(0, 3).every((tile) => Math.abs(tile.top - tiles[0].top) < 0.6) && tiles.slice(3).every((tile) => Math.abs(tile.top - tiles[3].top) < 0.6) && tiles[3].top > tiles[0].bottom, `the ${tab} tab: three by three`)
			if (tab === "themes") numbers[`${where}: a tab and a tile, px`] = [l.items.find((item) => item.id === "tab:themes"), tiles[0]].map((item) => `${Math.round(item.width)} x ${Math.round(item.height)}`)
		}
		// A list: real titles, with a long name first.
		await page.goto(`${GUEST}?tv=discover&style=slow`, { waitUntil: "load", timeout: 180000 })
		await page.waitForSelector("#room:not([data-room=unmeasured]) [data-tv-item]", { timeout: 180000 })
		let s = await until(page, (x) => x.items.filter((item) => item.startsWith("title:")).length === 4 && Object.values(x.tiles).every((tile) => tile.loaded) && Boolean(x.picture), "a list", 60000)
		is(s.heading, LONG, "the list names its first title, a long name")
		let l = await layout(page)
		smallest.list = fits(l, "a list with a long name", { touch }).key
		const posters = l.items.filter((item) => item.id.startsWith("title:"))
		check(posters.every((poster) => within(poster, l.tv)), "the four posters are inside the picture")
		numbers[`${where}: a poster and Change, px`] = [posters[0], l.items.find((item) => item.id === "change")].map((item) => `${Math.round(item.width)} x ${Math.round(item.height)}`)
		// The focus on the last title: the row has not paged anything out of the picture.
		for (const press of ["ArrowRight", "ArrowRight", "ArrowRight"]) await page.keyboard.press(press)
		s = await until(page, (x) => x.focus[0] === x.items[3], "the focus on the fourth title")
		await page.waitForTimeout(500)
		l = await layout(page)
		fits(l, "a list with the focus on its last title", { touch })
		await ctx.close()
		numbers[`${where}: the smallest key, px`] = Object.fromEntries(Object.entries(smallest).map(([screen, px]) => [screen, Math.round(px * 10) / 10]))
	}

	// Before the pool is there: the tiles are their options' colours, and hold their names the same way.
	where = "sizes, without pictures"
	console.log(where)
	for (const size of [PHONES[1], DESKTOP]) {
		const { ctx, page } = await open(`${GUEST}?tv=discover&tab=styles`, size, { touch: size !== DESKTOP, storage: { country: "US" }, before: (p) => p.route("**/api/living-room/picks*", (route) => route.fulfill({ status: 503, body: "{}" })) })
		const s = await until(page, (x) => same(x.items, choiceItems("styles")), "the Styles tab", 30000)
		check(Object.values(s.tiles).every((tile) => !tile.img && /linear-gradient\(160deg/.test(tile.paint ?? "")), `${size.join("x")}: without the pool every tile is its option's colour alone`)
		fits(await layout(page), `${size.join("x")}: the Styles tab without pictures`, { touch: size !== DESKTOP })
		await ctx.close()
	}

	// A list without titles: while they are on their way, and when nothing fits.
	where = "a list without titles"
	console.log(where)
	for (const [status, body, line] of [
		[200, JSON.stringify({ cards: [], total: 0 }), "Nothing fits."],
		[503, JSON.stringify({ error: "Starting up, try again shortly" }), "Nothing fits."],
	]) {
		let release
		const held = new Promise((done) => {
			release = done
		})
		const { ctx, page } = await open(`${GUEST}?tv=discover&mood=scary`, DESKTOP, {
			storage: { country: "US" },
			before: (p) =>
				p.route("**/api/discover/results*", async (route) => {
					await held
					return route.fulfill({ status, contentType: "application/json", body })
				}),
		})
		let s = await until(page, (x) => x.text.includes("Titles are on their way."), "the list says its titles are on their way", 30000)
		is([s.items, s.focus], [["change", ...BAR], ["change"]], "with Change and the bar, and the focus on Change")
		release()
		s = await until(page, (x) => x.text.includes(line), `an answer of ${status} without titles: the list says "${line}"`, 60000)
		is(s.items, ["change", ...BAR], "and keeps Change and the bar")
		await ctx.close()
	}
}

// ---------------------------------------------------------------------------------------------------------
// The server's HTML: the bar alone, the same for every guest.

async function html() {
	where = "the server's HTML"
	console.log(where)
	const agents = {
		browser: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
		googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
		iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
	}
	const page = async (query, agent) => (await fetch(`${GUEST}${query}`, { headers: { "User-Agent": agents[agent] } })).text()
	const ids = (text) => [...text.matchAll(/data-tv-item="([^"]+)"/g)].map((m) => m[1])
	const home = await page("", "browser")
	numbers["the guest's HTML of /home-preview, bytes"] = home.length
	for (const query of ["?tv=discover", "?tv=discover&tab=themes", "?tv=discover&theme=crime"]) {
		const texts = await Promise.all(Object.keys(agents).map((agent) => page(query, agent)))
		check(texts.every((text) => text === texts[0]), `${query}: the same HTML for a browser, Googlebot and an iPhone`)
		// Both editions are in the HTML: the bar alone, twice.
		is(ids(texts[0]), [...BAR, ...BAR], `${query}: the server draws the bar alone, once per edition`)
		check(!/Heists|Mind-bending|Slow burn|Comedy leads/.test(texts[0]), `${query}: and nothing of the options`)
		numbers[`the guest's HTML of ${query}, bytes`] = texts[0].length
	}
}

// ---------------------------------------------------------------------------------------------------------
// Screenshots, and the sheets beside the prototype's.

async function shots() {
	const dir = join(here, "shots")
	mkdirSync(dir, { recursive: true })
	const settle = async (page) => {
		await page.evaluate(() => Promise.all([...document.querySelectorAll("#room img")].map((img) => img.decode().catch(() => {}))))
		await page.waitForTimeout(1100)
	}
	const shot = async (page, name) => {
		await settle(page)
		await page.screenshot({ path: join(dir, `${name}.jpg`), quality: 82 })
	}
	const pictured = (page, tab) => until(page, (x) => same(x.items, choiceItems(tab)) && Object.values(x.tiles).every((tile) => tile.loaded) && Boolean(x.picture), `the ${tab} tab with its pictures`, 60000)
	const listed = (page) => until(page, (x) => x.items.filter((item) => item.startsWith("title:")).length === 4 && Object.values(x.tiles).every((tile) => tile.loaded) && Boolean(x.picture), "a list with its pictures", 60000)
	for (const [who, url] of [
		["guest", GUEST],
		["member", MEMBER],
	])
		for (const [size, device] of [
			[DESKTOP, "desktop"],
			[PHONE, "phone"],
		]) {
			where = `shots ${who} ${device}`
			console.log(where)
			const phone = device === "phone"
			const member = who === "member"
			const { ctx, page } = await open(url, size, {
				storage: member ? undefined : { country: "US" },
				before: member
					? (p) =>
							p.route("**/api/discover/results*", async (route) => {
								const { search } = new URL(route.request().url())
								const response = await fetch(`${ORIGIN}/api/discover/results${search}`)
								return route.fulfill({ status: response.status, contentType: "application/json", body: await response.text() })
							})
					: undefined,
			})
			await key(page, "ArrowRight", "app:discover")
			await shot(page, `home-discover-${who}-${device}`)
			await page.keyboard.press("Enter")
			await until(page, (x) => same(x.items, choiceItems("moods")) && focusIs("mood:funny")(x), "Discover")
			if (member) {
				// The harness has no pool: the tiles are their options' colours.
				await shot(page, `moods-${who}-${device}`)
				await key(page, "ArrowUp", "tab:moods")
				await page.keyboard.press("ArrowRight")
				await until(page, (x) => same(x.items, choiceItems("themes")), "Themes")
				await into(page, "theme:crime")
				await shot(page, `themes-${who}-${device}`)
			} else {
				await pictured(page, "moods")
				await shot(page, `moods-${who}-${device}`)
				await key(page, "ArrowUp", "tab:moods")
				await shot(page, `moods-on-tab-${who}-${device}`)
				await page.keyboard.press("ArrowRight")
				await until(page, (x) => same(x.items, choiceItems("themes")), "Themes")
				await shot(page, `themes-on-tab-${who}-${device}`)
				await into(page, "theme:crime")
				await pictured(page, "themes")
				await shot(page, `themes-${who}-${device}`)
				await key(page, "ArrowUp", "tab:themes")
				await page.keyboard.press("ArrowRight")
				await until(page, (x) => same(x.items, choiceItems("styles")), "Styles")
				await into(page, "style:animated")
				await pictured(page, "styles")
				await shot(page, `styles-${who}-${device}`)
				if (!phone) {
					// The pointer over a tab: the focus, and nothing opens.
					await itemOf(page, "tab:moods").hover()
					await until(page, focusIs("tab:moods"), "the pointer over Moods")
					await shot(page, `styles-pointer-on-moods-${who}-${device}`)
				}
				await page.goto(`${GUEST}?tv=discover&tab=themes&focus=theme%3Acrime`, { waitUntil: "load", timeout: 180000 })
				await page.waitForSelector("#room:not([data-room=unmeasured]) [data-tv-item]", { timeout: 180000 })
				await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" })
				await until(page, (x) => same(x.items, choiceItems("themes")) && focusIs("theme:crime")(x), "Themes again", 60000)
			}
			await page.keyboard.press("Enter")
			await listed(page)
			await shot(page, `theme-results-${who}-${device}`)
			if (!member) {
				await page.keyboard.press("ArrowRight")
				await page.keyboard.press("ArrowRight")
				await page.waitForTimeout(600)
				await listed(page)
				await shot(page, `theme-results-third-${who}-${device}`)
				if (phone) await key(page, "ArrowDown", "change")
				else for (let n = 0; n < 3 && (await read(page)).focus[0] !== "change"; n++) await page.keyboard.press("ArrowRight")
				await until(page, focusIs("change"), "Change")
				await shot(page, `theme-results-change-${who}-${device}`)
				for (const [kind, option] of [
					["mood", "funny"],
					["style", "slow"],
				]) {
					await page.goto(`${GUEST}?tv=discover&${kind}=${option}`, { waitUntil: "load", timeout: 180000 })
					await page.waitForSelector("#room:not([data-room=unmeasured]) [data-tv-item]", { timeout: 180000 })
					await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" })
					await listed(page)
					await shot(page, `${kind}-results-${who}-${device}`)
				}
			}
			await ctx.close()
		}

	// Before the pool is there, and a list without titles.
	for (const [size, device] of [
		[DESKTOP, "desktop"],
		[PHONE, "phone"],
	]) {
		where = `shots without ${device}`
		let { ctx, page } = await open(`${GUEST}?tv=discover&tab=themes`, size, { storage: { country: "US" }, before: (p) => p.route("**/api/living-room/picks*", (route) => route.fulfill({ status: 503, body: "{}" })) })
		await until(page, (x) => same(x.items, choiceItems("themes")), "Themes", 60000)
		await shot(page, `themes-colours-guest-${device}`)
		await ctx.close()
		;({ ctx, page } = await open(`${GUEST}?tv=discover&mood=scary`, size, { storage: { country: "US" }, before: (p) => p.route("**/api/discover/results*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ cards: [], total: 0 }) })) }))
		await until(page, (x) => x.text.includes("Nothing fits."), "an empty list", 60000)
		await shot(page, `results-none-guest-${device}`)
		await ctx.close()
	}

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
			pair("1920 x 1080, Discover's Themes tab as a guest", "20-discover-themes-desktop", "themes-guest-desktop", "slice 6: the app's names and colours, a picture per option from the pool. The Expand key is slice 11's; its corner is kept free", 956),
			pair("The Styles tab", "21-discover-styles-desktop", "styles-guest-desktop", "slice 6: real data", 956),
			pair("The titles of one theme", "22-theme-results-desktop", "theme-results-guest-desktop", "slice 6: the first four of /discover?themes=crime for a guest in the United States", 956),
			row(
				"The Moods tab; the focus on a tab; the pointer over a tab that is not open (the focus only)",
				[
					["moods-guest-desktop", "Moods, the focus on Funny"],
					["themes-on-tab-guest-desktop", "the direction keys landed on Themes: it is open"],
					["styles-pointer-on-moods-guest-desktop", "the pointer over Moods: Styles stays open"],
				],
				636,
			),
			row(
				"A list: the focus on the third title, on Change; a mood's and a style's titles",
				[
					["theme-results-third-guest-desktop", "the name and the picture follow the focus"],
					["theme-results-change-guest-desktop", "Change"],
					["mood-results-guest-desktop", "Funny"],
					["style-results-guest-desktop", "Slow burn"],
				],
				476,
			),
			row(
				"Until the pool is there: the options' colours. A list without titles. A member (the harness has no pool and no snapshot: colours, and the list's answer handed in)",
				[
					["themes-colours-guest-desktop", "no pictures yet"],
					["results-none-guest-desktop", "nothing fits"],
					["themes-member-desktop", "a member's Themes"],
					["theme-results-member-desktop", "a member's list"],
				],
				476,
			),
		].join(""),
	)
	await sheet(
		"phone-beside-prototype",
		1720,
		`<h2>390 x 844: the prototype (left of each pair) and slice 6 (right). Themes, Styles, the titles of one theme</h2><div>${[
			["20-discover-themes-phone", "themes-guest-phone"],
			["21-discover-styles-phone", "styles-guest-phone"],
			["22-theme-results-phone", "theme-results-guest-phone"],
		]
			.map(([their, our]) => cell(theirs(their), "prototype", 270) + cell(ours(our), "slice 6", 270))
			.join("")}</div>${row(
			"Moods; the focus on a tab; a list with the focus on Change; a mood's and a style's titles",
			[
				["moods-guest-phone", "Moods"],
				["themes-on-tab-guest-phone", "the focus on Themes"],
				["theme-results-change-guest-phone", "Change"],
				["mood-results-guest-phone", "Funny"],
				["style-results-guest-phone", "Slow burn"],
			],
			270,
		)}${row(
			"Until the pool is there; a list without titles; a member's Themes and list; home with the focus on Discover",
			[
				["themes-colours-guest-phone", "no pictures yet"],
				["results-none-guest-phone", "nothing fits"],
				["themes-member-phone", "a member's Themes"],
				["theme-results-member-phone", "a member's list"],
				["home-discover-guest-phone", "home"],
			],
			270,
		)}`,
	)
}

// A dev server's first page load after a start reloads itself once Vite has optimized its dependencies, which
// would cut a walk short: load each page once before the real run, through Discover, a list, a title and the
// Discover page.
for (const url of [GUEST, MEMBER]) {
	where = "warming the dev server"
	const { ctx, page } = await open(url, DESKTOP)
	await page.keyboard.press("ArrowRight")
	await page.waitForTimeout(1500)
	await page.keyboard.press("Enter")
	await page.waitForTimeout(5000)
	await page.keyboard.press("Enter")
	await page.waitForTimeout(6000)
	await page.keyboard.press("Enter")
	await page.waitForTimeout(5000)
	await ctx.close()
}
{
	const { ctx } = await open(`${ORIGIN}/discover?themes=crime`, DESKTOP, { room: false })
	await ctx.close()
}
passed = 0
failed.length = 0

if (only !== "shots") {
	// PARTS=pool,walk,same,sizes,html runs some of the checks; checks.json is written by a whole run only.
	const parts = process.env.PARTS?.split(",")
	const part = (name) => !parts || parts.includes(name)
	if (part("pool")) await pool()
	if (part("walk")) {
		for (const size of [DESKTOP, PHONE]) await walk("guest", GUEST, size)
		for (const size of [DESKTOP, PHONE]) await walk("member", MEMBER, size)
	}
	if (part("same")) await sameAsDiscover()
	if (part("sizes")) await sizes()
	if (part("html")) await html()
	if (!parts) writeFileSync(join(here, "checks.json"), `${JSON.stringify({ passed, failed, numbers }, null, "\t")}\n`)
	else console.log(JSON.stringify(numbers, null, 1))
}
if (only !== "checks") await shots()
await browser.close()
console.log(`${passed} checks passed, ${failed.length} failed`)
for (const line of failed) console.log(" -", line)
process.exit(failed.length ? 1 : 0)
