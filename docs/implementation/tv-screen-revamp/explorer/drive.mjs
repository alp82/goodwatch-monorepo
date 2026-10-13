// Slice 7 of the new TV (the mini Explorer): walks home, the map, an island, "Sail to" and a title on /home-preview
// with the keyboard and the pointer, as a guest on real data and as a member on the tracking harness; presses every
// direction on every island; measures every key and the Expand key's corner on every phone of the room's table;
// weighs the map's answer; and takes the screenshots in shots/ and the sheets beside the prototype's own.
//
//   PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs GUEST=http://localhost:3207 \
//   MEMBER=http://localhost:3208 node drive.mjs [checks|shots]
//
// PARTS=walk,person,links,sizes,html runs some of the checks.
//
// On a machine with room for one dev server at a time: SIDE=guest with the reading server alone, then SIDE=member
// with the harness's alone. Each runs the checks of its half; checks.json and the screenshots are a whole run's.
// The guest's half keeps the two maps the member's half plays back, in a file (STOCK=, by default in the system's
// temporary folder).
//
// The repo has no browser driver: install playwright-core outside it. GUEST is a dev server of goodwatch-webapp
// that reads real data; MEMBER is one without any service, for the harness (see README.md here for both
// commands). PROTOTYPE= is the folder of the prototype's notes (docs/prototypes/tv-screen-design on
// prototype/tv-screen-flow), for the sheets.
//
// Nothing here signs in or writes to a server, and requests that would leave the machine are stopped in the
// browser. The harness has no title snapshot, so its Explorer answers nothing: there the script plays back the
// map the reading server gives a person with ratings and two services, which is what a member's map is.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { brotliCompressSync, gzipSync } from "node:zlib"

const here = dirname(fileURLToPath(import.meta.url))
const ORIGIN = process.env.GUEST ?? "http://localhost:3207"
const GUEST = `${ORIGIN}/home-preview`
const MEMBER = `${process.env.MEMBER ?? "http://localhost:3208"}/prototype/my-library-real/tv?member=six`
const prototype = process.env.PROTOTYPE ?? "/home/alper/projects/goodwatch-monorepo-38caebf4/docs/prototypes/tv-screen-design"
const only = process.argv[2]
const SIDE = process.env.SIDE ?? "both"
const guestSide = SIDE !== "member"
const memberSide = SIDE !== "guest"
const STOCK = process.env.STOCK ?? join(tmpdir(), "tv-drive-explorer-stock.json")
const parts = (process.env.PARTS ?? "walk,person,links,sizes,html").split(",")
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")

const DESKTOP = [1920, 1080]
const PHONE = [390, 844]
const BAR = ["bar:back", "bar:search", "bar:menu"]
const MAP_URL = "/api/explorer/map"
const PROGRESS_KEY = "onboarding_ratings"
/** A person with a taste and two services: eight titles they liked, Netflix and Prime Video in the United States. */
const PERSON = {
	interactions: [
		[603, "movie", 9],
		[27205, "movie", 9],
		[680, "movie", 8],
		[155, "movie", 9],
		[13, "movie", 7],
		[1399, "show", 8],
		[550, "movie", 9],
		[157336, "movie", 9],
	].map(([tmdb_id, media_type, score], n) => ({ tmdb_id, media_type, type: "score", score, timestamp: n + 1 })),
	country: "US",
	services: "8,9",
}

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

// ---------------------------------------------------------------------------------------------------------
// What the mini map must show of a map's answer: tv-explorer.ts, said again here so the page is checked against
// the answer and not against its own code.

/** The six places' centres on the desktop's map (`MAP_PLACES`). */
const CENTRES = [
	[125, 74],
	[415, 96],
	[705, 66],
	[245, 274],
	[595, 274],
	[968, 214],
]
const spread = (points) => {
	const axis = (values) => {
		const low = Math.min(...values)
		const range = Math.max(...values) - low
		return values.map((value) => (range ? (value - low) / range : 0.5))
	}
	const xs = axis(points.map((p) => p[0]))
	const ys = axis(points.map((p) => p[1]))
	return points.map((_, n) => [xs[n], ys[n]])
}
const orders = (n) => (n <= 1 ? [n ? [0] : []] : orders(n - 1).flatMap((order) => Array.from({ length: n }, (_, at) => [...order.slice(0, at), n - 1, ...order.slice(at)])))
/** The six islands with the most titles, each at its place. */
function sixOf(map) {
	const six = map.islands
		.map((island, at) => ({ island, at }))
		.filter(({ island }) => island.count > 0)
		.sort((a, b) => b.island.count - a.island.count || a.at - b.at)
		.slice(0, 6)
		.map(({ island }) => island)
	const from = spread(six.map((island) => [island.x, island.y]))
	const to = spread(CENTRES.slice(0, six.length))
	let best = []
	let least = Number.POSITIVE_INFINITY
	for (const order of orders(six.length)) {
		const cost = order.reduce((sum, island, place) => sum + (from[island][0] - to[place][0]) ** 2 + (from[island][1] - to[place][1]) ** 2, 0)
		if (cost < least) {
			least = cost
			best = order
		}
	}
	return best.map((island) => six[island])
}
const nearest = (from, six, max = 2) =>
	six
		.map((island, at) => ({ island, at, far: (island.x - from.x) ** 2 + (island.y - from.y) ** 2 }))
		.filter(({ island }) => island.id !== from.id)
		.sort((a, b) => a.far - b.far || a.at - b.at)
		.slice(0, max)
		.map(({ island }) => island)
const tvKey = (title) => `${title.mediaType}-${title.tmdbId}`
const count = (n) => `${n.toLocaleString("en-US")} ${n === 1 ? "title" : "titles"}`

/**
 * Where every direction goes on the desktop's map, by place: up, down, left, right, as tv-explorer.test.ts pins
 * it. The Expand key is slice 11's and is not drawn yet, so where the pinned table says "expand" the focus stays.
 */
const MAP_MOVES = [
	["bar:back", 3, null, 1],
	["bar:back", 3, 0, 2],
	["bar:back", 4, 1, 5],
	[0, null, null, 4],
	[2, null, 3, 5],
	["bar:menu", null, 2, null],
]
/** The phone's map is three by two. An island is more than twice as wide as a key of the bar: Up starts at the bar's left end. */
const PHONE_MOVES = [
	["bar:back", 3, null, 1],
	["bar:back", 4, 0, 2],
	["bar:back", 5, 1, null],
	[0, null, null, 4],
	[1, null, 3, 5],
	[2, null, 4, null],
]
const ARROWS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]

// ---------------------------------------------------------------------------------------------------------

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--use-angle=gl", "--ignore-gpu-blocklist"] })

/** Opens a page. A busy machine times a load out now and then: try again, twice. */
async function open(url, [width, height], { touch = width < 768 || height < 541, tries = 3, storage, playback } = {}) {
	const ctx = await browser.newContext({
		viewport: { width, height },
		deviceScaleFactor: touch ? 2 : 1,
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
	page.on("console", (m) => {
		if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text()}`)
	})
	page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`))
	page.on("request", (r) => requests.push({ url: r.url(), path: new URL(r.url()).pathname, method: r.method(), body: r.postData() }))
	// Nothing may leave the machine but the pictures: a request to another host is stopped.
	await page.route(
		(u) => !["localhost", "127.0.0.1", "image.tmdb.org"].includes(u.hostname) && u.protocol.startsWith("http"),
		(route) => route.fulfill({ status: 204, body: "" }),
	)
	// The browser's telemetry goes through the dev server to Sentry (/api/e): a drive's page views are no news.
	await page.route("**/api/e", (route) => route.fulfill({ status: 200, body: "" }))
	// The harness has no Explorer: the map of a person with a taste is played back.
	if (playback) await page.route(`**${MAP_URL}*`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(playback) }))
	try {
		await page.goto(url, { waitUntil: "load", timeout: 240000 })
		await page.waitForSelector("#room:not([data-room=unmeasured]) [data-tv-item]", { timeout: 240000 })
	} catch (error) {
		await ctx.close().catch(() => {})
		if (tries <= 1) throw error
		console.log("loading again:", String(error.message).split("\n")[0])
		await sleep(4000)
		return open(url, [width, height], { touch, tries: tries - 1, storage, playback })
	}
	// The dev tools' round key is no part of the page.
	await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" })
	await page.waitForTimeout(600)
	return { ctx, page, logs, requests, touch }
}

/** What the TV shows. */
const read = (page) =>
	page.evaluate(() => {
		const room = document.getElementById("room")
		if (!room) return { search: location.search, path: location.pathname, room: false, items: [], focus: [], labels: {}, layers: 0 }
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
			labels: Object.fromEntries(items.map((el) => [id(el), el.textContent])),
			aria: Object.fromEntries(items.map((el) => [id(el), el.getAttribute("aria-label")])),
			name: top?.querySelector(".truncate.font-bold")?.textContent ?? null,
			crumb: top?.querySelector(".truncate.leading-tight.text-white\\/70")?.textContent ?? null,
			text: top?.innerText ?? "",
			history: history.length,
			expandPlace: place ? place.childElementCount : null,
			// The pictures on show: the last one in the stack is the one fading in.
			picture: [...(top?.querySelectorAll(":scope > .absolute.inset-0.overflow-hidden img") ?? [])].at(-1)?.getAttribute("src") ?? null,
			lines: top?.querySelectorAll("svg line").length ?? 0,
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
			check(false, `${what}: still ${JSON.stringify(now && { path: now.path, search: now.search, focus: now.focus, items: now.items, crumb: now.crumb })}`)
			return now ?? { items: [], focus: [], labels: {}, aria: {}, text: "" }
		}
		await page.waitForTimeout(60)
	}
}
const focusIs = (item) => (s) => s.focus.length === 1 && s.focus[0] === item
const screenIs = (search, item, items) => (s) => s.room && s.search === search && s.layers === 1 && focusIs(item)(s) && (!items || same(s.items, items))

/**
 * A key, and the state once the focus is on `item` and at rest. A focused key grows for 0.18 s and the one left
 * shrinks; a direction pressed in that moment measures both on their way, and where two keys are equally far it
 * can then pick the one just left.
 */
async function key(page, name, item, what = `${name} moves the focus to ${item}`) {
	await page.keyboard.press(name)
	const state = await until(page, focusIs(item), what)
	await page.waitForTimeout(240)
	return state
}
/** An item on the TV, pressed with the pointer or a finger. */
async function point(page, item, touch) {
	const el = page.locator(`#room [data-tv-layer] [data-tv-item="${item}"]`).last()
	if (touch) await el.tap()
	else await el.click()
}
/** Puts the focus on an item the way the pointer does: by moving over it. */
async function hover(page, item) {
	const box = await page.locator(`#room [data-tv-layer] [data-tv-item="${item}"]`).last().boundingBox()
	await page.mouse.move(box.x + box.width / 2 - 3, box.y + box.height / 2 - 3)
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
	const state = await until(page, focusIs(item), `pointing at ${item} gives it the focus`)
	await page.waitForTimeout(240)
	return state
}

/** What a dev server's console says on any page. */
const noise = (logs) => logs.filter((l) => !l.includes("Future Flag") && !l.includes("net::ERR_FAILED") && !l.includes("503") && !l.includes("Failed to load resource"))
/** The Explorer's code, as a dev server names its modules. */
const explorerCode = (requests) => requests.filter((r) => /living-room\/tv\/(screens\/Explorer|use-tv-explorer|tv-explorer)\.tsx?/.test(r.path))
const mapRequests = (requests) => requests.filter((r) => r.path === MAP_URL)
const explorerRequests = (requests) => requests.filter((r) => r.path.startsWith("/api/explorer/"))

/** Asks the reading server for the map, as a browser with this progress would. */
async function askMap(guest = { interactions: [], country: "US", services: "" }) {
	const started = Date.now()
	const response = await fetch(`${ORIGIN}${MAP_URL}?grouping=mood`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guest }) })
	const text = await response.text()
	return { status: response.status, text, map: JSON.parse(text), ms: Date.now() - started, headers: response.headers }
}

const facts = (title, services) => {
	const service = services.find((one) => title.services.includes(one.id))
	return [title.year, title.mediaType === "show" ? "Show" : "Movie", title.score != null && `${Math.round(title.score)} score`, title.match != null && `${title.match}% match`, service && `On ${service.name}`].filter(Boolean).join(" · ")
}

// ---------------------------------------------------------------------------------------------------------
// The walk: home, the map, every direction, an island, Sail to, a title, and back.

async function walk(who, url, size, { map, storage, playback } = {}) {
	const phone = size[0] < 768
	where = `${who} ${size.join("x")}`
	console.log(where)
	const six = sixOf(map)
	const islands = six.map((island) => `island:${island.id}`)
	const { ctx, page, logs, requests, touch } = await open(url, size, { storage, playback })
	const query = (search) => {
		const base = new URL(url).search
		return base ? `${base}${search ? `&${search}` : ""}` : search ? `?${search}` : ""
	}

	// ---- Nothing of the Explorer is in the first view.
	let s = await until(page, screenIs(query(""), "app:tonight"), "home, with the focus on Tonight")
	is(explorerCode(requests).length, 0, "the Explorer's code is not asked for on arrival")
	is(explorerRequests(requests).length, 0, "the map is not asked for on arrival")
	const start = s.history

	// ---- The first interaction asks for neither; the Explorer's tile does, once.
	await key(page, "ArrowRight", "app:discover")
	await page.waitForTimeout(500)
	is(explorerCode(requests).length, 0, "the first key press does not ask for the Explorer's code")
	is(explorerRequests(requests).length, 0, "nor for the map")
	s = await key(page, "ArrowRight", "app:explorer")
	check(/Sail a small map of islands\./.test(s.text), "home says what the Explorer is")
	const asked = Date.now()
	while (!mapRequests(requests).length && Date.now() - asked < 30000) await page.waitForTimeout(50)
	check(explorerCode(requests).length > 0, "the Explorer's code is asked for while its tile has the focus")
	is(mapRequests(requests).length, 1, "and the map, once")
	const first = mapRequests(requests)[0]
	check(new URL(first.url).search === "?grouping=mood", `the map is the mood map with the Explorer's default filters: ${new URL(first.url).search}`)
	if (who === "member") is(first.method, "GET", "a member asks with GET")
	else {
		is(first.method, "POST", "a guest asks with POST")
		const sent = JSON.parse(first.body ?? "{}").guest
		is(Object.keys(sent ?? {}).sort(), ["country", "interactions", "services"], "and sends their browser's progress, and nothing else of it")
		is(sent?.interactions?.length ?? 0, storage ? PERSON.interactions.length : 0, "with their ratings")
	}
	is(s.history, start, "no focus move adds a history entry")
	is(s.search, query(""), "nor changes the address")

	// ---- OK opens the map on the TV.
	await page.keyboard.press("Enter")
	s = await until(page, screenIs(query("tv=explorer"), islands[0], [...islands, ...BAR]), "the map: six islands in their places, the focus on the first")
	is(s.history, start + 1, "the map is one history entry")
	is(s.name, "Explorer", "the bar names the screen")
	is(s.crumb, "Six islands", "and counts the islands")
	is(
		six.map((island) => s.labels[`island:${island.id}`]),
		six.map((island) => island.name),
		"every island carries its name inside",
	)
	is(s.expandPlace, 0, "the Expand key's place is kept, and empty until slice 11")
	if (!phone) is(s.lines, new Set(six.map((island) => [island.id, nearest(island, six, 1)[0].id].sort().join("-"))).size, "each island is joined to its nearest by a bridge")
	numbers[`${where} islands`] = six.map((island) => `${island.name} ${island.count}`).join(", ")

	// ---- Every direction from every island.
	const table = phone ? PHONE_MOVES : MAP_MOVES
	const target = (to, from) => (to === null ? islands[from] : typeof to === "number" ? islands[to] : to)
	for (let from = 0; from < islands.length; from++) {
		for (let d = 0; d < 4; d++) {
			// The focus is put on the island as the pointer puts it, then the arrow is pressed.
			await hover(page, islands[from])
			const want = target(table[from][d], from)
			await page.keyboard.press(ARROWS[d])
			await page.waitForTimeout(140)
			const now = await read(page)
			check(focusIs(want)(now), `${ARROWS[d]} from ${islands[from]} (place ${from}): got ${now.focus}, want ${want}`)
		}
	}
	// Down from the bar lands on the map's top row.
	await hover(page, islands[1])
	await page.keyboard.press("ArrowUp")
	s = await until(page, (x) => x.focus[0]?.startsWith("bar:"), "Up from the top row is the bar")
	await page.keyboard.press("ArrowDown")
	s = await until(page, (x) => islands.slice(0, 3).includes(x.focus[0]), "Down from the bar is the top row")
	is(s.search, query("tv=explorer"), "no move changed the address")
	is(s.history, start + 1, "nor added a history entry")

	// ---- The map says what the focused island is, and shows its picture.
	for (const at of [0, 5]) {
		const island = six[at]
		await hover(page, islands[at])
		// A picture fades in once it is decoded.
		const picture = island.titles.find((title) => title.backdrop)?.backdrop
		s = await until(page, (x) => Boolean(picture) && x.picture?.endsWith(picture), `the picture is ${island.name}'s first title's`)
		check(s.picture?.includes(phone ? "/w780/" : "/w1280/"), `in the edition's size: ${s.picture}`)
		check(s.text.includes(island.apart), `the map says what sets ${island.name} apart: ${island.apart}`)
		check(s.text.includes(count(island.count)), `and how many titles it has: ${count(island.count)}`)
	}

	// ---- OK steps onto an island: its first four titles, and the two nearest islands to sail to.
	const onto = six[1]
	const titles = onto.titles.slice(0, 4)
	const titleItems = titles.map((title) => `title:${tvKey(title)}`)
	const hops = nearest(onto, six)
	const hopItems = hops.map((hop) => `hop:${hop.id}`)
	await hover(page, islands[1])
	const before = explorerRequests(requests).length
	await page.keyboard.press("Enter")
	s = await until(page, screenIs(query(`tv=explorer&island=${onto.id}`), titleItems[0], [...titleItems, ...hopItems, ...BAR]), `${onto.name}: four titles and two islands to sail to`)
	is(s.history, start + 2, "an island is one more history entry")
	is(explorerRequests(requests).length, before, "an island asks the server for nothing")
	check(s.crumb?.startsWith(onto.name), `the bar names the island: ${s.crumb}`)
	check(s.text.includes(titles[0].title) && s.text.includes(facts(titles[0], map.services)), `it shows the first title's name and facts: ${facts(titles[0], map.services)}`)
	is(hopItems.map((item) => s.labels[item]), hops.map((hop) => hop.name), "Sail to offers the two nearest of the six, nearest first")
	is(hopItems.map((item) => s.aria[item]), hops.map((hop) => `Sail to ${hop.name}`), "and each key says so to a screen reader")
	is(titleItems.map((item) => s.aria[item]), titles.map((title) => title.title), "every poster is named")
	is(s.expandPlace, 0, "the Expand key's place is kept")

	// ---- Along the titles, to Sail to and back.
	await key(page, "ArrowRight", titleItems[1])
	s = await until(page, (x) => Boolean(titles[1].backdrop) && x.picture?.endsWith(titles[1].backdrop), "the picture follows the focus")
	check(s.text.includes(titles[1].title) && s.text.includes(facts(titles[1], map.services)), "and the name and the facts")
	await key(page, "ArrowLeft", titleItems[0])
	await key(page, "ArrowLeft", titleItems[0], "Left of the first title: the focus stays")
	await key(page, "ArrowUp", "bar:back", "Up from the titles is the bar")
	// Back stands over the last poster on the desktop, over the third on the phone.
	await key(page, "ArrowDown", titleItems.at(phone ? -2 : -1), "Down from Back is the title under it")
	if (phone) {
		// The phone: the islands to sail to stand under the posters, beside the Expand key's corner.
		await key(page, "ArrowDown", hopItems[1], "Down from a title is the key nearest under it")
		await key(page, "ArrowLeft", hopItems[0])
		await key(page, "ArrowUp", titleItems[0], "Up from a key is the poster over it")
		await key(page, "ArrowDown", hopItems[0])
		await key(page, "ArrowRight", hopItems[1])
		await key(page, "ArrowRight", hopItems[1], "Right of the last key is the Expand key's corner: the focus stays")
	} else {
		await key(page, "ArrowRight", hopItems[0], "Right of the last title is Sail to")
		await key(page, "ArrowDown", hopItems[1])
		await key(page, "ArrowDown", hopItems[1], "Down from the last key is the Expand key's corner: the focus stays")
		await key(page, "ArrowLeft", titleItems.at(-1), "Left of Sail to is the last title")
		await key(page, "ArrowRight", hopItems[0])
		await key(page, "ArrowUp", "bar:menu", "Up from Sail to is the bar")
		await key(page, "ArrowDown", titleItems.at(-1))
		await key(page, "ArrowRight", hopItems[0])
		await key(page, "ArrowDown", hopItems[1])
	}
	is((await read(page)).history, start + 2, "no move added a history entry")

	// ---- Sail to: the island next door takes this island's place.
	const next = hops[1]
	const nextTitles = next.titles.slice(0, 4).map((title) => `title:${tvKey(title)}`)
	const nextHops = nearest(next, six).map((hop) => `hop:${hop.id}`)
	await page.keyboard.press("Enter")
	s = await until(page, screenIs(query(`tv=explorer&island=${next.id}`), nextTitles[0], [...nextTitles, ...nextHops, ...BAR]), `Sail to ${next.name}: its titles and its own two nearest`)
	is(s.history, start + 2, "sailing adds no history entry")
	check(s.crumb?.startsWith(next.name), `the bar names ${next.name}`)
	is(explorerRequests(requests).length, before, "and asks the server for nothing")

	// ---- Back is the map, on the island the person stepped onto.
	await page.keyboard.press("Escape")
	s = await until(page, screenIs(query("tv=explorer"), islands[1], [...islands, ...BAR]), "Back from an island is the map, with the focus on the island left for")
	await page.goForward()
	s = await until(page, screenIs(query(`tv=explorer&island=${next.id}`), nextTitles[0]), "Forward is the island sailed to")

	// ---- A title opens its screen, named at once from what the map knows.
	const opened = next.titles[1]
	await key(page, "ArrowRight", nextTitles[1])
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.search === query(`tv=title&title=${tvKey(opened)}`) && x.text.includes(opened.title), `OK on a title opens its screen, named from the map: ${opened.title}`)
	is(s.history, start + 3, "a title is one more history entry")
	await page.keyboard.press("Backspace")
	s = await until(page, screenIs(query(`tv=explorer&island=${next.id}`), nextTitles[1]), "Back from the title is the island, with the focus on the title")

	// ---- The pointer and a finger.
	if (!touch) {
		await hover(page, nextHops[0])
		await hover(page, nextTitles[2])
	}
	await point(page, nextHops[0], touch)
	const third = six.find((island) => `hop:${island.id}` === nextHops[0])
	const thirdTitles = third.titles.slice(0, 4).map((title) => `title:${tvKey(title)}`)
	s = await until(page, (x) => x.search === query(`tv=explorer&island=${third.id}`) && same(x.items.slice(0, thirdTitles.length), thirdTitles), `${touch ? "a tap" : "a click"} on a Sail to key sails`)
	// The title's entry is still ahead of this one; sailing puts nothing on top of it.
	is(s.history, start + 3, "in place")
	await point(page, "bar:back", touch)
	s = await until(page, (x) => x.search === query("tv=explorer") && same(x.items, [...islands, ...BAR]), "the bar's Back is the map")
	await point(page, islands[4], touch)
	s = await until(page, screenIs(query(`tv=explorer&island=${six[4].id}`), `title:${tvKey(six[4].titles[0])}`), `${touch ? "a tap" : "a click"} on an island steps onto it`)

	// ---- A reload gives the island its focus back, and the map is asked for again, once.
	await key(page, "ArrowRight", `title:${tvKey(six[4].titles[1])}`)
	const reloaded = mapRequests(requests).length
	await page.reload({ waitUntil: "load", timeout: 240000 })
	await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" })
	s = await until(page, screenIs(query(`tv=explorer&island=${six[4].id}`), `title:${tvKey(six[4].titles[1])}`), "after a reload the island is back, with its focus", 120000)
	is(mapRequests(requests).length, reloaded + 1, "a link straight to an island asks for the map, once")
	// The Home key leaves for home; Back returns.
	await page.keyboard.press("h")
	await until(page, screenIs(query(""), "app:tonight"), "H is home")
	await page.goBack()
	await until(page, screenIs(query(`tv=explorer&island=${six[4].id}`), `title:${tvKey(six[4].titles[1])}`), "Back from home is the island")

	is(noise(logs), [], "nothing in the console")
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// Links: an island that is not among the six, one the map lacks, and Back on a link.

async function links(map) {
	where = "links"
	console.log(where)
	const six = sixOf(map)
	const other = map.islands.find((island) => island.count > 0 && !six.includes(island))
	const { ctx, page, logs, requests } = await open(`${GUEST}?tv=explorer&island=${other.id}`, DESKTOP)
	const titles = other.titles.slice(0, 4).map((title) => `title:${tvKey(title)}`)
	const hops = nearest(other, six).map((hop) => `hop:${hop.id}`)
	let s = await until(page, screenIs(`?tv=explorer&island=${other.id}`, titles[0], [...titles, ...hops, ...BAR]), `${other.name}, an island of the map that is not among the six: its titles, and the two nearest of the six`, 120000)
	is(mapRequests(requests).length, 1, "a link asks for the map once, without waiting for a sign of the person")
	// A link has no history of its own: Back shows home in its place, then does nothing.
	await page.keyboard.press("Escape")
	s = await until(page, screenIs("", "app:tonight"), "Back on a link is home")
	await page.goto(`${GUEST}?tv=explorer&island=atlantis`, { waitUntil: "load", timeout: 240000 })
	s = await until(page, (x) => x.search === "?tv=explorer&island=atlantis" && x.text.includes("This island isn't on the map."), "an island the map lacks says so", 120000)
	is(s.items, BAR, "and has its bar")
	await page.goto(`${GUEST}?tv=explorer&focus=${encodeURIComponent(`island:${six[5].id}`)}`, { waitUntil: "load", timeout: 240000 })
	s = await until(page, screenIs(`?tv=explorer&focus=${encodeURIComponent(`island:${six[5].id}`)}`, `island:${six[5].id}`), "focus= puts the focus on an island, and is not rewritten", 120000)
	is(noise(logs), [], "nothing in the console")
	await ctx.close()

	// The map does not come: the screen says so and keeps its bar.
	const failing = await open(GUEST, DESKTOP)
	await failing.page.route(`**${MAP_URL}*`, (route) => route.fulfill({ status: 503, contentType: "application/json", headers: { "Retry-After": "5" }, body: '{"error":"loading"}' }))
	await failing.page.goto(`${GUEST}?tv=explorer`, { waitUntil: "load", timeout: 240000 })
	s = await until(failing.page, (x) => x.text.includes("The map is on its way."), "while the map is on its way the screen says so", 120000)
	is(s.items, BAR, "with its bar")
	s = await until(failing.page, (x) => x.text.includes("The map isn't here right now."), "and once it has not come, after the query's retries", 60000)
	await failing.ctx.close()
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
		const words = (el) => {
			const range = document.createRange()
			range.selectNodeContents(el)
			const b = range.getBoundingClientRect()
			return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }
		}
		return {
			k,
			tv: { left: tv.left, top: tv.top, right: tv.right, bottom: tv.bottom },
			items: [...layer.querySelectorAll("[data-tv-item]")].map((el) => ({
				id: el.getAttribute("data-tv-item"),
				...rest(el),
				// What a key says is cut short where it does not fit.
				cut: [...el.querySelectorAll(".truncate")].some((text) => text.scrollWidth > text.clientWidth + 1),
				// An island's name is inside its island.
				name: el.getAttribute("data-tv-item").startsWith("island:") ? words(el.querySelector("span")) : null,
				type: el.getAttribute("data-tv-item").startsWith("island:") ? Number.parseFloat(getComputedStyle(el.querySelector("span")).fontSize) * k : null,
				row: Boolean(el.closest("[data-tv-row]")),
			})),
			// A box that cuts off what does not fit (the Frame's content on the phone) holds more than it shows.
			clipped: [...layer.querySelectorAll(".overflow-hidden")].filter((el) => !el.hasAttribute("data-tv-row") && !el.hasAttribute("data-tv-item") && el.scrollHeight > el.clientHeight + 1).length,
			// The smallest type on the screen, on the window.
			type: Math.min(...[...layer.querySelectorAll("*")].filter((el) => [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())).map((el) => Number.parseFloat(getComputedStyle(el).fontSize) * k)),
			canvasType: Math.min(...[...layer.querySelectorAll("*")].filter((el) => [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())).map((el) => Number.parseFloat(getComputedStyle(el).fontSize))),
			place: place ? rest(place) : null,
			text: [...layer.querySelectorAll(".tvc-fade, .text-white\\/70, .text-white\\/75")].filter((el) => !el.closest("[data-tv-item]") && el.textContent.trim()).map((el) => ({ words: el.textContent.slice(0, 40), ...words(el) })),
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
	check(!l.items.some((item) => item.cut), `${what}: every key says its words in full`)
	const covered = l.text.filter((text) => l.items.some((item) => meet(item, text)))
	check(covered.length === 0, `${what}: no key lies over a line of type: ${covered.map((text) => text.words).join(", ") || "none"}`)
	const outside = l.text.filter((text) => !within(text, l.tv))
	check(outside.length === 0, `${what}: every line of type is inside the picture: ${outside.map((text) => text.words).join(", ") || "all"}`)
	const names = l.items.filter((item) => item.name)
	check(names.every((item) => within(item.name, item)), `${what}: every island's name is inside its island`)
	check(l.canvasType >= 20, `${what}: no type under 20 canvas px: ${l.canvasType}`)
	// The Expand key's cell: 158 canvas px wide on the phone, 220 on the desktop, as tall as a key.
	const size = touch ? [158, 54] : [220, 64]
	const corner = { right: l.place.right, bottom: l.place.bottom, left: l.place.right - size[0] * l.k, top: l.place.bottom - Math.max(size[1] * l.k, touch ? 44 : 0) }
	const inCorner = [...l.items, ...l.text].filter((item) => meet(item, corner))
	check(inCorner.length === 0, `${what}: the Expand key's corner is free: ${inCorner.map((item) => item.id ?? item.words).join(", ") || "free"}`)
	return {
		key: Math.min(...l.items.map((item) => Math.min(item.width, item.height))),
		island: names.length ? `${Math.min(...names.map((item) => item.width)).toFixed(0)} x ${Math.min(...names.map((item) => item.height)).toFixed(0)}` : null,
		name: names.length ? Math.min(...names.map((item) => item.type)) : null,
		type: l.type,
	}
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
/** The desktop sizes of the room's table: the Remote under the TV, and beside it in a small window. */
const DESKTOPS = [
	[1920, 1080],
	[1366, 650],
	[1280, 720],
]

async function sizes(map, person) {
	const six = sixOf(person)
	// The island with the longest name among its first titles: the worst case of an island's screen.
	const long = [...person.islands].sort((a, b) => Math.max(...b.titles.slice(0, 4).map((t) => t.title.length)) - Math.max(...a.titles.slice(0, 4).map((t) => t.title.length)))[0]
	const storage = { [PROGRESS_KEY]: JSON.stringify(PERSON.interactions), country: PERSON.country, withStreamingProviders: PERSON.services }
	for (const size of [...PHONES, ...DESKTOPS]) {
		const touch = size[0] < 768 || size[1] < 541
		where = `sizes ${size.join("x")}`
		console.log(where)
		const { ctx, page } = await open(`${GUEST}?tv=explorer`, size, { storage })
		await until(page, (x) => x.items.filter((item) => item.startsWith("island:")).length === 6, "the map", 120000)
		await page.waitForTimeout(700)
		const onMap = fits(await layout(page), "the map", { touch })
		// With the focus on the last island too: the focused one is the largest.
		await page.goto(`${GUEST}?tv=explorer&island=${long.id}`, { waitUntil: "load", timeout: 240000 })
		await until(page, (x) => x.items.some((item) => item.startsWith("title:")) && x.items.some((item) => item.startsWith("hop:")), `${long.name}`, 120000)
		await page.waitForTimeout(700)
		const l = await layout(page)
		const onIsland = fits(l, `an island with a long name (${long.name})`, { touch })
		// All four posters stand side by side.
		const posters = l.items.filter((item) => item.row)
		check(posters.every((item) => within(item, l.tv)), `all ${posters.length} posters are in the picture at once`)
		numbers[`sizes ${size.join("x")}`] = {
			canvasShownAt: Number(l.k.toFixed(3)),
			map: { smallestKey: Number(onMap.key.toFixed(1)), island: onMap.island, islandName: Number(onMap.name.toFixed(1)), smallestType: Number(onMap.type.toFixed(1)) },
			island: { smallestKey: Number(onIsland.key.toFixed(1)), poster: `${posters[0].width.toFixed(0)} x ${posters[0].height.toFixed(0)}`, smallestType: Number(onIsland.type.toFixed(1)) },
		}
		await ctx.close()
	}
	void six
}

// ---------------------------------------------------------------------------------------------------------
// The server's HTML of a link straight to the map: the bar alone, and the same for every guest.

async function html() {
	where = "the server's HTML"
	console.log(where)
	const get = async (path, agent) => (await fetch(`${ORIGIN}${path}`, { headers: { "User-Agent": agent } })).text()
	const chrome = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36"
	const googlebot = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
	const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
	for (const path of ["/home-preview?tv=explorer", "/home-preview?tv=explorer&island=funny"]) {
		const pages = [await get(path, chrome), await get(path, googlebot), await get(path, iphone)]
		check(pages[0] === pages[1] && pages[0] === pages[2], `${path}: the same HTML for a browser, Googlebot and an iPhone`)
		const items = [...pages[0].matchAll(/data-tv-item="([^"]+)"/g)].map((m) => m[1])
		is(items, [...BAR, ...BAR], `${path}: the server draws the bar alone, once per edition`)
		check(!/Sail to|Six islands|tvc-tile/.test(pages[0]), `${path}: and nothing of the map`)
		numbers[`html ${path}`] = pages[0].length
	}
	numbers["html /home-preview"] = (await get("/home-preview", chrome)).length
}

// ---------------------------------------------------------------------------------------------------------

/**
 * A dev server finds a page's dependencies the first time the page is asked for and then loads the page anew.
 * Each server is walked once before anything is checked, so that happens here.
 */
async function warm(url, options) {
	const join = (search) => (url.includes("?") ? `${url}&${search}` : `${url}?${search}`)
	for (const search of ["tv=explorer", "tv=explorer&island=funny", "tv=title&title=movie-603"]) {
		const { ctx, page } = await open(join(search), DESKTOP, options)
		await page.waitForTimeout(4000)
		await ctx.close()
	}
}

// The member's half alone plays back the maps the guest's half kept.
const kept = guestSide ? null : JSON.parse(readFileSync(STOCK, "utf8"))
const answer = kept ? { map: kept.answer } : await askMap()
if (guestSide) check(answer.status === 200, `the map answers: ${answer.status}`)
const person = kept ? { map: kept.person } : await askMap(PERSON)
if (SIDE === "guest") writeFileSync(STOCK, JSON.stringify({ answer: answer.map, person: person.map }))
const weigh = (text) => ({ bytes: Buffer.byteLength(text), gzip: gzipSync(text).length, brotli: brotliCompressSync(text).length })
const storage = { [PROGRESS_KEY]: JSON.stringify(PERSON.interactions), country: PERSON.country, withStreamingProviders: PERSON.services }

if (only !== "shots") {
	if (guestSide) {
		where = "the map's answer"
		console.log(where)
		is(answer.headers.get("cache-control"), "private, no-store", "the map is never stored by a cache")
		is(answer.map.grouping, "mood", "it is the mood map")
		check(answer.map.islands.length >= 6, `it has ${answer.map.islands.length} islands`)
		check(answer.map.islands.every((island) => island.titles.length >= 4), "every island carries at least four titles")
		check(person.map.taste.signal === "some" && person.map.filters.onMyServices, "a person with ratings and services gets their own map: a taste, and On my services")
		check(!same(sixOf(answer.map).map((i) => i.id).sort(), sixOf(person.map).map((i) => i.id).sort()), `their six are their own: ${sixOf(person.map).map((i) => i.id)} against ${sixOf(answer.map).map((i) => i.id)}`)
		// Three more times, warm, for the time it takes.
		const times = []
		for (let n = 0; n < 3; n++) times.push((await askMap()).ms)
		numbers["the map"] = {
			"a guest nobody knows": { ...weigh(answer.text), islands: answer.map.islands.length, titlesPerIsland: `${Math.min(...answer.map.islands.map((i) => i.titles.length))} to ${Math.max(...answer.map.islands.map((i) => i.titles.length))}` },
			"a person with a taste and two services": { ...weigh(person.text), islands: person.map.islands.length, titlesPerIsland: `${Math.min(...person.map.islands.map((i) => i.titles.length))} to ${Math.max(...person.map.islands.map((i) => i.titles.length))}` },
			warmMs: times,
		}

	}

	if (guestSide) await warm(GUEST)
	if (memberSide) await warm(MEMBER, { playback: person.map })
	if (parts.includes("walk")) {
		if (guestSide) for (const size of [DESKTOP, PHONE]) await walk("guest", GUEST, size, { map: answer.map })
		if (memberSide) for (const size of [DESKTOP, PHONE]) await walk("member", MEMBER, size, { map: person.map, playback: person.map })
	}
	if (guestSide) {
		// A guest with ratings and services of their own: their six, with the match and where each title streams.
		if (parts.includes("person")) for (const size of [DESKTOP, PHONE]) await walk("guest with a taste", GUEST, size, { map: person.map, storage })
		if (parts.includes("links")) await links(answer.map)
		if (parts.includes("sizes")) await sizes(answer.map, person.map)
		if (parts.includes("html")) await html()
	}

	console.log(`${passed} checks pass, ${failed.length} fail`)
	for (const line of failed) console.log("  ", line)
	if (!process.env.PARTS && SIDE === "both") writeFileSync(join(here, "checks.json"), `${JSON.stringify({ passed, failed, numbers }, null, "\t")}\n`)
	else console.log(JSON.stringify(numbers, null, 1))
}

if (only !== "checks" && SIDE === "both") {
	const dir = join(here, "shots")
	mkdirSync(dir, { recursive: true })
	const settle = async (page) => {
		await page.waitForFunction(() => [...document.querySelectorAll("#room img")].filter((img) => img.getBoundingClientRect().width > 0).every((img) => img.complete && img.naturalWidth > 0), null, { timeout: 60000 }).catch(() => {})
		await page.waitForTimeout(1100)
	}
	const shot = async (page, name) => {
		await settle(page)
		await page.screenshot({ path: join(dir, `${name}.jpg`), quality: 82 })
	}
	for (const [who, url, map, options] of [
		["guest", GUEST, answer.map, {}],
		["member", MEMBER, person.map, { playback: person.map }],
	]) {
		const six = sixOf(map)
		for (const [size, device] of [
			[DESKTOP, "desktop"],
			[PHONE, "phone"],
		]) {
			where = `shots ${who} ${device}`
			console.log(where)
			const join2 = (search) => (url.includes("?") ? `${url}&${search}` : `${url}?${search}`)
			const { ctx, page } = await open(join2("tv=explorer"), size, options)
			await until(page, (x) => x.items.filter((item) => item.startsWith("island:")).length === 6, "the map", 120000)
			await shot(page, `map-${who}-${device}`)
			// The far right island on the desktop, the last of the six on the phone.
			await hover(page, `island:${six[5].id}`)
			await shot(page, `map-far-${who}-${device}`)
			await hover(page, `island:${six[1].id}`)
			await page.keyboard.press("Enter")
			await until(page, (x) => x.search.includes(`island=${six[1].id}`) && x.items.some((item) => item.startsWith("title:")), "an island")
			await shot(page, `island-${who}-${device}`)
			await page.keyboard.press("ArrowRight")
			await page.keyboard.press("ArrowRight")
			await shot(page, `island-third-${who}-${device}`)
			if (device === "desktop") {
				await page.keyboard.press("ArrowRight")
				await page.keyboard.press("ArrowRight")
			} else await page.keyboard.press("ArrowDown")
			await until(page, (x) => x.focus[0]?.startsWith("hop:"), "Sail to")
			await shot(page, `island-sail-${who}-${device}`)
			await ctx.close()
		}
	}
	// The map on the other sizes of the room's table.
	for (const size of [[1366, 650], [375, 667], [844, 390]]) {
		where = `shots ${size.join("x")}`
		console.log(where)
		const { ctx, page } = await open(`${GUEST}?tv=explorer`, size)
		await until(page, (x) => x.items.filter((item) => item.startsWith("island:")).length === 6, "the map", 120000)
		await shot(page, `map-${size.join("x")}`)
		await ctx.close()
	}

	// The sheets: ours beside the prototype's shot of the same screen.
	const uri = (file) => `data:image/jpeg;base64,${readFileSync(file).toString("base64")}`
	const ours = (name) => uri(join(dir, `${name}.jpg`))
	const theirs = (name) => uri(join(prototype, name))
	const cell = (src, caption, width) => `<figure><img src="${src}" width="${width}"><figcaption>${caption}</figcaption></figure>`
	const sheet = async (name, width, body) => {
		const ctx = await browser.newContext({ viewport: { width, height: 600 }, deviceScaleFactor: 1 })
		const page = await ctx.newPage()
		await page.setContent(`<style>body{margin:0;padding:16px;background:#14161b;color:#fff;font:15px system-ui}h2{font-size:18px;margin:18px 0 8px}div{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start}figure{margin:0}img{display:block}figcaption{padding:4px 0 0;color:#cbd5e1;max-width:940px}</style>${body}`)
		await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode())))
		await page.screenshot({ path: join(here, `${name}.jpg`), quality: 80, fullPage: true })
		await ctx.close()
	}
	const pair = (title, their, our, note, width) => `<h2>${title}</h2><div>${cell(theirs(`screens/cinema/${their}.jpg`), "prototype, Cinema (sample data)", width)}${cell(ours(our), note, width)}</div>`
	const row = (title, names, width) => `<h2>${title}</h2><div>${names.map(([name, note, own]) => cell(ours(name), note, own ?? width)).join("")}</div>`
	const memberNote = "the harness's sample member; the map is the reading server's for a person with eight ratings, Netflix and Prime Video"
	await sheet(
		"desktop-beside-prototype",
		1960,
		[
			pair("1920 x 1080, the map as a guest", "06-explorer-map-desktop", "map-guest-desktop", "slice 7: the real mood map's six largest islands for a guest in the United States, as flat islands with their names inside. The Expand key is slice 11's; its corner is kept free", 956),
			pair("1920 x 1080, an island as a guest", "07-island-desktop", "island-guest-desktop", "slice 7: the island's first four titles, and Sail to its two nearest of the six", 956),
			row("A guest: the far right island focused, the third title, Sail to", [["map-far-guest-desktop", "the focus on the far right island"], ["island-third-guest-desktop", "the picture and the name follow the focus"], ["island-sail-guest-desktop", "the focus on Sail to"]], 630),
			row(`A member (${memberNote})`, [["map-member-desktop", "their six: On my services counts"], ["island-member-desktop", "with the match and where it streams"], ["island-sail-member-desktop", "Sail to"]], 630),
			`<h2>The design round's three maps: the owner preferred the middle one's idea, flat named islands, in the first one's look</h2><div>${cell(theirs("compare/explorer.jpg"), "prototype: Cinema, Marquee, Glow", 520)}${cell(ours("map-1366x650"), "slice 7 at 1366 x 650, the Remote beside the TV", 900)}</div>`,
		].join(""),
	)
	await sheet(
		"phone-beside-prototype",
		1660,
		[
			`<h2>390 x 844, as a guest: the map and an island, each beside the prototype's</h2><div>${cell(theirs("screens/cinema/06-explorer-map-phone.jpg"), "prototype, Cinema", 390)}${cell(ours("map-guest-phone"), "slice 7: the map", 390)}${cell(theirs("screens/cinema/07-island-phone.jpg"), "prototype, Cinema", 390)}${cell(ours("island-guest-phone"), "slice 7: an island", 390)}</div>`,
			row("A guest: the last island focused, the third title, Sail to", [["map-far-guest-phone", "the focus on the last island"], ["island-third-guest-phone", "the third title"], ["island-sail-guest-phone", "the focus on a Sail to key"]], 390),
			row(`A member (${memberNote})`, [["map-member-phone", "their six"], ["island-member-phone", "an island"], ["island-sail-member-phone", "Sail to"]], 390),
			row("The shortest phone and landscape", [["map-375x667", "375 x 667, the Remote on the table", 375], ["map-844x390", "844 x 390", 844]], 390),
		].join(""),
	)
}

await browser.close()
if (failed.length) process.exit(1)
