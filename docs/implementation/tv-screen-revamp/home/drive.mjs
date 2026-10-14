// Slice 3 of the new TV (home, the bar and the menu): walks the home on / with the keyboard and with
// both Remotes' keys, as a guest on real data and as a member on the tracking harness, checks the TV's state after
// every step, and takes the screenshots in shots/ and the sheets beside the prototype's own.
//
//   PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs GUEST=http://localhost:3173 \
//   MEMBER=http://localhost:3174 node drive.mjs [checks|shots]
//
// The repo has no browser driver: install playwright-core outside it. GUEST is a dev server of goodwatch-webapp
// that reads real data; MEMBER is one without any service, for the harness (see README.md here for both
// commands). PROTOTYPE= is the folder of the prototype's notes (docs/prototypes/tv-screen-design on
// prototype/tv-screen-flow), for the sheets. Nothing here signs in, rates or writes: requests that would leave the
// machine for a sign-in are stopped in the browser.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"

const here = dirname(fileURLToPath(import.meta.url))
const GUEST = `${process.env.GUEST ?? "http://localhost:3173"}/`
const MEMBER = `${process.env.MEMBER ?? "http://localhost:3174"}/prototype/my-library-real/tv?member=six`
const prototype = process.env.PROTOTYPE ?? "/home/alper/projects/goodwatch-monorepo-38caebf4/docs/prototypes/tv-screen-design"
const only = process.argv[2]
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")

const DESKTOP = [1920, 1080]
const PHONE = [390, 844]
const APPS = ["app:tonight", "app:discover", "app:explorer", "app:taste"]
const BAR = ["bar:search", "bar:menu"]
const MENU = { guest: ["menu:home", "menu:search", "menu:sign-in", "menu:about", "menu:off"], member: ["menu:home", "menu:search", "menu:about", "menu:off"] }
const HEADLINE = "Let's find something good for tonight."

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
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const is = (got, want, what) => check(same(got, want), `${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--use-angle=gl", "--ignore-gpu-blocklist"] })

/** Opens a page. A busy machine times a load out now and then: try again, twice. */
async function open(url, [width, height], { touch = width < 768, tries = 3, script = true, reducedMotion, before } = {}) {
	const ctx = await browser.newContext({
		viewport: { width, height },
		deviceScaleFactor: touch ? 2 : 1,
		javaScriptEnabled: script,
		reducedMotion,
		...(touch ? { isMobile: true, hasTouch: true } : {}),
	})
	const page = await ctx.newPage()
	const logs = []
	const requests = []
	page.on("console", (m) => {
		if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text()}`)
	})
	page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`))
	page.on("request", (r) => requests.push({ url: r.url(), method: r.method() }))
	// Nothing may leave for a sign-in: a request to another host than the server's and the image host is stopped.
	const left = []
	await page.route(
		(u) => !["localhost", "127.0.0.1", "image.tmdb.org"].includes(u.hostname) && u.protocol.startsWith("http"),
		(route) => {
			left.push(route.request().url())
			// "No content" keeps the page where it is, also when the request was a navigation.
			return route.fulfill({ status: 204, body: "" })
		},
	)
	// The browser's telemetry goes through the dev server to Sentry (/api/e): a drive's page views are no news.
	await page.route("**/api/e", (route) => route.fulfill({ status: 200, body: "" }))
	await before?.(page)
	try {
		await page.goto(url, { waitUntil: "load", timeout: 180000 })
		if (script) await page.waitForSelector("#room:not([data-room=unmeasured]) [data-tv-item]", { timeout: 180000 })
	} catch (error) {
		await ctx.close().catch(() => {})
		if (tries <= 1) throw error
		console.log("loading again:", String(error.message).split("\n")[0])
		await new Promise((done) => setTimeout(done, 4000))
		return open(url, [width, height], { touch, tries: tries - 1, script, reducedMotion, before })
	}
	if (script) {
		// The dev tools' round key is no part of the page.
		await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" })
		await page.waitForTimeout(600)
	}
	return { ctx, page, logs, requests, left }
}

/** What the TV shows. */
const read = (page) =>
	page.evaluate(() => {
		const room = document.getElementById("room")
		const layers = [...room.querySelectorAll("[data-tv-layer]")]
		const top = layers.at(-1)
		// The Expand key is slice 11's, drawn since; ../expand/drive.mjs checks it. Here it is left out, as before.
		const items = top ? [...top.querySelectorAll("[data-tv-item]")].filter((el) => el.getAttribute("data-tv-item") !== "expand") : []
		const id = (el) => el.getAttribute("data-tv-item")
		const active = document.activeElement
		return {
			search: location.search,
			power: room.dataset.tvPower,
			away: room.hasAttribute("inert"),
			layers: layers.length,
			under: layers.length > 1 ? layers[0].hasAttribute("inert") : false,
			items: items.map(id),
			focus: items.filter((el) => el.getAttribute("aria-current")).map(id),
			marked: room.querySelectorAll("[data-tv-item][aria-current]").length,
			active: active?.hasAttribute?.("data-tv-item") ? id(active) : (active?.tagName ?? null),
			h1: [...document.querySelectorAll("h1")].map((h) => h.textContent),
			large: room.querySelector("h1 + div > div")?.textContent ?? null,
			line: room.querySelector("h1 + div > div + div")?.textContent ?? null,
			name: top?.querySelector(".truncate")?.textContent ?? null,
			boot: Boolean(room.querySelector(".lr-boot")),
			toast: room.querySelector(".tvc-toast")?.textContent ?? null,
			history: history.length,
			picture: (() => {
				const whole = room.querySelector("[data-tv-layer] > .absolute.inset-0.overflow-hidden")
				const last = whole?.lastElementChild
				return last?.querySelector("img")?.getAttribute("src") ?? last?.querySelector("svg rect")?.getAttribute("fill") ?? null
			})(),
		}
	})

/** Waits until the TV's state says `want` (a function of `read`'s result, as a string), then returns the state. */
async function until(page, want, what, timeout = 15000) {
	const end = Date.now() + timeout
	let now
	for (;;) {
		now = await read(page)
		if (want(now)) return now
		if (Date.now() > end) {
			check(false, `${what}: still ${JSON.stringify({ search: now.search, focus: now.focus, items: now.items, layers: now.layers, power: now.power })}`)
			return now
		}
		await page.waitForTimeout(60)
	}
}
const focusIs = (item) => (s) => s.focus.length === 1 && s.focus[0] === item
/** Where the focus starts on a screen that is drawn with its machine's items alone. */
const STARTS = { search: "idea:cozy mystery", quiz: "answer:loved", discover: "mood:any", taste: "start-quiz", explorer: "bar:back" }
/** The screen of an address is on show, with the focus on `item` (by default where that screen's focus starts). */
const screenIs = (search, item) => (s) => {
	const name = /[?&]tv=(\w+)/.exec(search)?.[1]
	const want = item ?? (name ? STARTS[name] : null)
	return s.search === search && s.layers === 1 && (want ? focusIs(want)(s) : name ? s.items.includes("bar:back") : s.items.includes("app:tonight"))
}

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

// ---------------------------------------------------------------------------------------------------------
// The walk, the same for a guest and a member, on the desktop and on the phone.

async function walk(who, url, size) {
	const member = who === "member"
	const phone = size[0] < 768
	const apps = member ? [...APPS, "app:shows"] : APPS
	const home = member ? "?member=six" : ""
	const at = (tv) => (member ? `?member=six${tv ? `&${tv}` : ""}` : tv ? `?${tv}` : "")
	where = `${who} ${size.join("x")}`
	console.log(where)
	const { ctx, page, logs, requests, left } = await open(url, size)
	const pool = () => requests.filter((r) => r.url.includes("/api/living-room/picks"))
	const code = (name) => requests.filter((r) => r.url.includes(`/tv/screens/${name}`))

	// ---- Arrival.
	let s = await read(page)
	// Slice 6b: after the apps, a tile for each of the person's two streaming services, which are the Remote's two
	// keys (services/drive.mjs walks them).
	const services = await page.evaluate(() => [...document.querySelectorAll('#room [aria-label="Remote control"] [data-service-key]')].map((el) => `service:${el.dataset.serviceKey}`))
	const tiles = [...apps, ...services]
	const items = [...tiles, ...BAR]
	is(services.length, 2, "the Remote has two streaming keys")
	is(s.items, items, "home's items are the machine's, in its order")
	is(s.focus, ["app:tonight"], "the focus starts on the first app")
	is(s.h1, [HEADLINE], "one H1, the home's headline")
	is(s.large, "Tonight", "the home shows the focused app large")
	is(s.search, home, "home has no tv in its address")
	check(s.picture?.includes(`/${phone ? "w780" : "w1280"}/`), `the first picture is a ${phone ? "w780" : "w1280"} backdrop: ${s.picture}`)
	if (!member) is(pool().length, 0, "nothing asked for the pool before the first interaction")
	is(code("Menu").length + code("About").length, 0, "the menu's and What is GoodWatch?'s code are not in the first view")
	const history = s.history

	// ---- The arrows along the tiles, and the picture that follows.
	for (const [n, app] of apps.entries()) {
		if (n) s = await key(page, "ArrowRight", app)
		is(s.marked, 1, `exactly one item is marked as focused on ${app}`)
	}
	is(s.large, member ? "My shows" : "Taste", "the last app is shown large")
	for (const tile of services) s = await key(page, "ArrowRight", tile)
	s = await key(page, "ArrowRight", tiles.at(-1), "Right on the last tile stays")
	{
		// The row pages sideways: the focused tile is inside the picture.
		const inside = await page.evaluate(() => {
			const tv = document.querySelector("[data-tv-screen]").getBoundingClientRect()
			const b = document.querySelector("#room [data-tv-item][aria-current]").getBoundingClientRect()
			return b.left >= tv.left - 1 && b.right <= tv.right + 1
		})
		check(inside, "the row paged the last tile into the picture")
	}
	for (const tile of [...tiles].reverse().slice(1)) s = await key(page, "ArrowLeft", tile)
	s = await key(page, "ArrowLeft", "app:tonight", "Left on the first tile stays")
	s = await key(page, "ArrowDown", "app:tonight", "Down from the tiles stays")
	if (!member) {
		const asked = pool()
		is(asked.map((r) => r.method), ["POST"], "a guest's first interaction asked for the pool once, with their progress")
	} else check(pool().length >= 1 && pool().every((r) => r.method === "GET"), `a member's pool was asked for with GET once the Discover tile had the focus (the harness answers 503, and the query tries again): ${pool().length}`)
	check(code("Menu").length > 0 && code("About").length > 0, "the first interaction asked for the menu's and What is GoodWatch?'s code")

	// ---- Explorer's and Taste's drawings, Discover's posters.
	s = await key(page, "ArrowRight", "app:discover")
	s = await until(page, (x) => x.picture?.includes("/w342/"), "Discover's picture is its posters")
	is(s.large, "Discover", "Discover is shown large")
	s = await key(page, "ArrowRight", "app:explorer")
	s = await until(page, (x) => x.picture === "#0d2a3a", "Explorer's picture is the map")
	s = await key(page, "ArrowRight", "app:taste")
	s = await until(page, (x) => x.picture === "#241538", "Taste's picture is the fingerprint")

	// ---- Up to the bar, along it, and back down.
	s = await key(page, "ArrowUp", "bar:search", "Up from Taste reaches the bar")
	is(s.large, "Taste", "with the focus on the bar the home keeps the app it showed")
	s = await key(page, "ArrowRight", "bar:menu")
	s = await key(page, "ArrowRight", "bar:menu", "Right on the last key stays")
	s = await key(page, "ArrowUp", "bar:menu", "Up on the bar stays")
	s = await key(page, "ArrowLeft", "bar:search")
	s = await key(page, "ArrowLeft", "bar:search", "Left on the first key stays (home has no Back)")
	await page.keyboard.press("ArrowDown")
	s = await until(page, (x) => x.focus[0]?.startsWith("app:"), "Down from the bar returns to the tiles")
	// The Search key stands over Taste's tile and the first service's: the nearer of the two.
	if (!phone) check(["app:taste", services[0]].includes(s.focus[0]), `Down from the Search key reaches the tile under it: ${s.focus}`)
	is(s.search, home, "no focus move changed the address")
	is(s.history, history, "no focus move added a history entry")

	// ---- An app opens on the TV, and Back gives the focus back.
	for (let n = 0; n < 6 && (await read(page)).focus[0] !== "app:tonight"; n++) await page.keyboard.press("ArrowLeft")
	s = await key(page, "ArrowRight", "app:discover")
	s = await key(page, "ArrowRight", "app:explorer")
	await page.keyboard.press("Enter")
	s = await until(page, screenIs(at("tv=explorer"), "bar:back"), "OK on Explorer opens it on the TV")
	is(s.items, ["bar:back", "bar:search", "bar:menu"], "a screen that is not built yet has its bar")
	is(s.name, "Explorer", "it says which screen it is")
	is(s.h1, [], "only home has the H1")
	is(s.history, history + 1, "opening an app is one history entry")
	check(await page.locator("#room [data-tv-expand-place]").count(), "the Expand key's place is there")
	await page.keyboard.press("Escape")
	s = await until(page, screenIs(home, "app:explorer"), "Escape goes back to home, with the focus on Explorer")
	await page.keyboard.press("Enter")
	s = await until(page, screenIs(at("tv=explorer"), "bar:back"), "OK opens Explorer again")
	s = await key(page, "ArrowRight", "bar:search")
	await page.keyboard.press("Backspace")
	s = await until(page, screenIs(home, "app:explorer"), "Backspace goes back too")
	await page.goForward()
	s = await until(page, screenIs(at("tv=explorer"), "bar:search"), "the browser's Forward returns to Explorer with the focus it had")
	await page.goBack()
	s = await until(page, screenIs(home, "app:explorer"), "the browser's Back is the TV's Back")

	// ---- The keys H, S and M.
	await page.keyboard.press("s")
	s = await until(page, screenIs(at("tv=search")), "S opens search")
	is(s.items.filter((item) => item.startsWith("bar:")), ["bar:back", "bar:menu"], "the search screen's bar has no Search key")
	await page.keyboard.press("s")
	s = await until(page, screenIs(home, "app:explorer"), "S on the search screen goes back")
	await page.keyboard.press("s")
	s = await until(page, screenIs(at("tv=search")), "S opens search again")
	await page.keyboard.press("h")
	s = await until(page, screenIs(home, "app:tonight"), "H goes home, a new entry with the focus at its start")
	await page.keyboard.press("h")
	await page.waitForTimeout(250)
	s = await read(page)
	is([s.search, s.history], [home, history + 2], "H on home does nothing")

	// ---- The menu.
	const menu = MENU[who]
	await page.keyboard.press("m")
	s = await until(page, (x) => x.layers === 2 && focusIs("menu:home")(x) && x.items.length === menu.length, "M opens the menu")
	is(s.items, menu, `the menu's items for a ${who}`)
	check(s.under, "the screen under the menu takes no input")
	is(s.search, home, "the menu is not in the address")
	for (const item of menu.slice(1)) s = await key(page, "ArrowDown", item)
	s = await key(page, "ArrowDown", menu.at(-1), "Down on the last entry stays")
	for (const item of [...menu].reverse().slice(1)) s = await key(page, "ArrowUp", item)
	s = await key(page, "ArrowLeft", "menu:home", "Left in the menu stays")
	await page.keyboard.press("Escape")
	s = await until(page, (x) => x.layers === 1 && focusIs("app:tonight")(x), "Escape closes the menu, and the screen has its focus")
	await page.keyboard.press("m")
	s = await until(page, (x) => x.layers === 2, "M opens it")
	await page.keyboard.press("m")
	s = await until(page, (x) => x.layers === 1, "M closes it")
	// From the bar, with OK.
	s = await key(page, "ArrowUp", "bar:search")
	s = await key(page, "ArrowRight", "bar:menu")
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.layers === 2 && focusIs("menu:home")(x), "OK on the bar's Menu key opens the menu")
	// What is GoodWatch?
	for (const item of menu.slice(1, menu.indexOf("menu:about") + 1)) s = await key(page, "ArrowDown", item)
	await page.keyboard.press("Enter")
	s = await until(page, (x) => screenIs(at("tv=about"), "got-it")(x) && x.items.length === 5, "What is GoodWatch? opens from the menu")
	is(s.items, ["got-it", "rate", "bar:back", "bar:search", "bar:menu"], "its items")
	s = await key(page, "ArrowRight", "rate")
	await page.keyboard.press("ArrowUp")
	s = await until(page, (x) => x.focus[0]?.startsWith("bar:"), "Up from an answer reaches the bar")
	await page.keyboard.press("ArrowDown")
	s = await until(page, (x) => ["got-it", "rate"].includes(x.focus[0]), "Down from the bar returns to the answers")
	s = await key(page, "ArrowLeft", "got-it")
	await page.keyboard.press("Enter")
	s = await until(page, screenIs(home, "bar:menu"), "Got it goes back to home, where the Menu key had the focus")
	// Rate what I've seen: the quiz takes its place.
	await page.keyboard.press("m")
	s = await until(page, (x) => x.layers === 2 && focusIs("menu:home")(x), "the menu again")
	for (const item of menu.slice(1, menu.indexOf("menu:about") + 1)) s = await key(page, "ArrowDown", item)
	await page.keyboard.press("Enter")
	s = await until(page, (x) => screenIs(at("tv=about"), "got-it")(x) && x.items.length === 5, "What is GoodWatch? again")
	const before = s.history
	s = await key(page, "ArrowRight", "rate")
	await page.keyboard.press("Enter")
	s = await until(page, screenIs(at("tv=quiz")), "Rate what I've seen opens the quiz")
	is(s.history, before, "the quiz took What is GoodWatch?'s place: no new entry")
	await page.keyboard.press("Escape")
	s = await until(page, screenIs(home, "bar:menu"), "Back from the quiz is home")
	// Search and Home from the menu.
	await page.keyboard.press("m")
	s = await until(page, (x) => x.layers === 2 && focusIs("menu:home")(x), "the menu")
	s = await key(page, "ArrowDown", "menu:search")
	await page.keyboard.press("Enter")
	s = await until(page, screenIs(at("tv=search")), "Search in the menu opens search")
	await page.keyboard.press("m")
	s = await until(page, (x) => x.layers === 2 && focusIs("menu:home")(x), "the menu over search")
	await page.keyboard.press("Enter")
	s = await until(page, screenIs(home, "app:tonight"), "Home in the menu goes home")

	// ---- Power: Turn off is in the menu; any key turns a dark TV on, which boots and shows home.
	await page.keyboard.press("m")
	s = await until(page, (x) => x.layers === 2 && focusIs("menu:home")(x), "the menu")
	for (const item of menu.slice(1)) s = await key(page, "ArrowDown", item)
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.power === "off" && x.layers === 0, "Turn off darkens the TV")
	is(s.items, [], "a dark TV has no items")
	await page.keyboard.press("ArrowRight")
	s = await until(page, (x) => x.power === "on" && x.boot, "any key turns it on: it boots")
	is(s.items, [], "the boot screen has no items")
	s = await until(page, (x) => !x.boot && screenIs(home, "app:tonight")(x), "after the boot, home", 6000)

	// ---- The pointer: hovering focuses, a press chooses. (The ring and touch pointing are slice 4.)
	if (!phone) {
		await page.locator('#room [data-tv-item="app:taste"]').hover()
		s = await until(page, focusIs("app:taste"), "pointing at a tile focuses it")
		await page.locator('#room [data-tv-item="app:taste"]').click()
		s = await until(page, screenIs(at("tv=taste"), "start-quiz"), "a click chooses it")
		await page.locator('#room [data-tv-item="bar:back"]').click()
		// The cursor rests where the Back key was.
		s = await until(page, screenIs(home, "app:taste"), "a click on Back goes back")
		is(s.active, "app:taste", "the browser's focus follows the TV's onto the new screen")
		// Enter on the item the browser has focused chooses the item the TV shows as focused.
		s = await key(page, "ArrowLeft", "app:explorer")
		is(s.active, "app:explorer", "the browser's focus moved with the arrows")
		await page.keyboard.press("Enter")
		s = await until(page, screenIs(at("tv=explorer"), "bar:back"), "Enter chooses the focused item, not the one clicked before")
		await page.keyboard.press("Escape")
		s = await until(page, screenIs(home, "app:explorer"), "and back")
		// The Tab key walks the items in reading order, and the TV's focus follows.
		await page.keyboard.press("Tab")
		s = await until(page, focusIs("app:taste"), "Tab moves to the next item")
		await page.keyboard.press("Shift+Tab")
		s = await until(page, focusIs("app:explorer"), "Shift+Tab moves back")
	} else {
		await page.locator('#room [data-tv-item="app:discover"]').tap()
		s = await until(page, screenIs(at("tv=discover"), "mood:any"), "a tap on a tile opens it")
		await page.locator('#room [data-tv-item="bar:back"]').tap()
		s = await until(page, screenIs(home, "app:discover"), "a tap on Back goes back")
	}

	// ---- The Remote's keys do the same.
	for (let n = 0; n < 6 && (await read(page)).focus[0] !== "app:tonight"; n++) await remote(page, "Previous", phone)
	s = await until(page, focusIs("app:tonight"), "the Remote's Left walks back to the first tile")
	await remote(page, "Next", phone)
	s = await until(page, focusIs("app:discover"), "the Remote's Right")
	await remote(page, "Up", phone)
	s = await until(page, (x) => x.focus[0]?.startsWith("bar:"), "the Remote's Up reaches the bar")
	await remote(page, "Down", phone)
	s = await until(page, (x) => x.focus[0]?.startsWith("app:"), "the Remote's Down returns to the tiles")
	const tile = s.focus[0]
	await remote(page, "OK", phone)
	s = await until(page, (x) => x.search === at(`tv=${tile.slice(4)}`) && x.items.includes("bar:back"), "the Remote's OK opens the focused app")
	await remote(page, "Back", phone)
	s = await until(page, screenIs(home, tile), "the Remote's Back, with the focus given back")
	await remote(page, "Search", phone)
	s = await until(page, screenIs(at("tv=search")), "the Remote's Search")
	check((await remoteKey(page, "Search").getAttribute("aria-pressed")) === "true", "the Remote's Search key is lit on the search screen")
	await remote(page, "Home", phone)
	s = await until(page, screenIs(home, "app:tonight"), "the Remote's Home")
	await remote(page, "Menu", phone)
	s = await until(page, (x) => x.layers === 2 && focusIs("menu:home")(x), "the Remote's Menu opens the menu")
	await remote(page, "Down", phone)
	s = await until(page, focusIs("menu:search"), "the Remote's Down moves in the menu")
	await remote(page, "Back", phone)
	s = await until(page, (x) => x.layers === 1, "the Remote's Back closes the menu")
	// Slice 6b: a streaming key opens its service's screen, and the same key again leaves it.
	const streaming = page.locator(`#room [aria-label="Remote control"] [data-service-key="${services[0].slice(8)}"]`)
	await (phone ? streaming.tap() : streaming.click())
	s = await until(page, (x) => x.search === at(`tv=service&service=${services[0].slice(8)}`) && x.layers === 1, "a streaming key opens its service's screen")
	await (phone ? streaming.tap() : streaming.click())
	s = await until(page, screenIs(home, "app:tonight"), "and the same key again returns to home")
	is([s.toast, s.layers], [null, 1], "without a toast")
	if (!phone) {
		await remote(page, "Turn off", false)
		s = await until(page, (x) => x.power === "off", "the Remote's power key turns the TV off")
		await remote(page, "Turn on", false)
		s = await until(page, (x) => x.power === "on" && x.boot, "and on: it boots")
		s = await until(page, (x) => !x.boot && screenIs(home, "app:tonight")(x), "then home", 6000)
		// Scrolling over the wheel steps through the items in reading order, the bar included.
		await page.locator('#room [aria-label="Remote control"] button', { hasText: "OK" }).hover()
		for (const item of [...items.slice(1), items[0]]) {
			await page.mouse.wheel(0, 120)
			s = await until(page, focusIs(item), `the wheel steps to ${item}`)
			await page.waitForTimeout(160)
		}
	} else {
		// The phone's Remote has no power key: Turn off is in the menu, and any key of the Remote turns the TV on.
		is(await remoteKey(page, "Turn off").count(), 0, "the phone's Remote has no power key")
	}

	// ---- A reload gives the focus back; a link can name it.
	s = await key(page, "ArrowRight", "app:discover")
	s = await key(page, "ArrowRight", "app:explorer")
	await page.reload({ waitUntil: "load", timeout: 180000 })
	await page.waitForSelector("#room:not([data-room=unmeasured]) [data-tv-item]", { timeout: 180000 })
	s = await until(page, focusIs("app:explorer"), "after a reload the focus is where it was")
	is(s.search, home, "and it was never written to the address")

	is(
		logs.filter((l) => !l.includes("Future Flag") && !l.includes("net::ERR_FAILED") && !l.includes("503") && !l.includes("Failed to load resource")),
		[],
		"nothing in the console",
	)
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// Links, deep links and the room away.

async function links() {
	where = "links 1920x1080"
	console.log(where)
	// A link names the focus, and it is not rewritten.
	let { ctx, page } = await open(`${GUEST}?focus=app:taste`, DESKTOP)
	let s = await until(page, focusIs("app:taste"), "a link's focus= puts the focus there")
	is(s.search, "?focus=app:taste", "the link is left as it is")
	await page.keyboard.press("ArrowLeft")
	s = await until(page, focusIs("app:explorer"), "and the focus moves from there")
	is(s.search, "?focus=app:taste", "a move does not write the focus")
	await ctx.close()

	// A deep link has no history of its own: Back takes home in its place, then does nothing.
	;({ ctx, page } = await open(`${GUEST}?tv=explorer`, DESKTOP))
	s = await until(page, screenIs("?tv=explorer", "bar:back"), "a deep link opens its screen")
	const depth = s.history
	await page.keyboard.press("Escape")
	s = await until(page, screenIs("", "app:tonight"), "Back on a deep link shows home")
	is(s.history, depth, "home took the screen's place")
	await page.keyboard.press("Escape")
	await page.waitForTimeout(300)
	s = await read(page)
	is([s.search, s.history], ["", depth], "Back on home does nothing")
	await ctx.close()

	// What is GoodWatch? as a deep link: the server draws its bar, the screen follows.
	;({ ctx, page } = await open(`${GUEST}?tv=about`, DESKTOP))
	s = await until(page, (x) => screenIs("?tv=about", "got-it")(x) && x.items.length === 5, "a deep link to What is GoodWatch?")
	await ctx.close()

	// What the old TV wrote lands on the mapped screen, and an unknown screen and a guest's My shows are home.
	for (const [old, items] of [
		["?tv=moods", ["mood:any", "bar:back", "bar:search", "bar:menu"]],
		["?tv=nothing", [...APPS, ...BAR]],
		["?tv=shows", [...APPS, ...BAR]],
	]) {
		;({ ctx, page } = await open(`${GUEST}${old}`, DESKTOP))
		s = await read(page)
		is(s.items, items, `${old} shows ${items.length === 4 ? "Discover, where the old TV's moods are" : "home"}`)
		await ctx.close()
	}

	// A guest's Sign in: Continue with Google, back to the same TV screen. The request is stopped in the browser,
	// so nothing reaches the sign-in service.
	let left
	;({ ctx, page, left } = await open(`${GUEST}?tv=discover`, DESKTOP))
	await page.keyboard.press("m")
	s = await until(page, (x) => x.layers === 2 && focusIs("menu:home")(x) && x.items.length === 5, "the menu over Discover")
	s = await key(page, "ArrowDown", "menu:search")
	s = await key(page, "ArrowDown", "menu:sign-in")
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.layers === 1, "Sign in closes the menu")
	await page.waitForTimeout(2500)
	const authorize = left.find((u) => u.includes("/auth/v1/authorize"))
	const toast = authorize ? null : (await read(page)).toast
	check(
		authorize ? decodeURIComponent(authorize).includes("/?tv=discover") && authorize.includes("provider=google") : toast === "Sign in isn't working right now",
		`Sign in starts Continue with Google back to this TV screen, or says it can't: ${authorize ? "it asked for /auth/v1/authorize with redirect_to=/?tv=discover" : toast}`,
	)
	await ctx.close()

	// Scrolled out of the window, the room takes no input: the keys are the page's.
	;({ ctx, page } = await open(GUEST, DESKTOP))
	await page.locator(".lrb-lip").click()
	s = await until(page, (x) => x.away, "after the lip the room is away")
	await page.keyboard.press("ArrowRight")
	await page.keyboard.press("m")
	await page.waitForTimeout(300)
	s = await read(page)
	is([s.focus, s.layers], [["app:tonight"], 1], "away, the keys do nothing on the TV")
	await page.goBack()
	s = await until(page, (x) => !x.away, "back in the room")
	s = await key(page, "ArrowRight", "app:discover", "the keys are the TV's again")
	await ctx.close()

	// Reduced motion: screens cut, the picture cuts, nothing transitions.
	;({ ctx, page } = await open(GUEST, DESKTOP, { reducedMotion: "reduce" }))
	await page.keyboard.press("ArrowRight")
	await page.keyboard.press("Enter")
	s = await until(page, screenIs("?tv=discover"), "Discover opens with reduced motion")
	const still = await page.evaluate(() => {
		const layer = document.querySelector("#room [data-tv-layer]")
		const item = document.querySelector("#room [data-tv-item]")
		return [getComputedStyle(layer).animationName, getComputedStyle(item).transitionDuration]
	})
	is(still, ["none", "0s"], "with reduced motion the screen cuts and no item transitions")
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// The guest's HTML.

async function html() {
	where = "the guest's HTML"
	console.log(where)
	const agents = {
		browser: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
		Googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
		iPhone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
	}
	const get = async (url, agent) => {
		const response = await fetch(url, { headers: { "User-Agent": agent } })
		return { status: response.status, cache: response.headers.get("cache-control"), robots: null, body: await response.text() }
	}
	const pages = {}
	for (const [name, agent] of Object.entries(agents)) pages[name] = await get(GUEST, agent)
	const bodies = Object.values(pages).map((p) => p.body)
	check(bodies[0] === bodies[1] && bodies[1] === bodies[2], "the HTML is the same, byte for byte, for a browser, Googlebot and an iPhone")
	const body = pages.browser.body
	const count = (part) => body.split(part).length - 1
	is(pages.browser.status, 200, "the start page answers")
	is(count("<h1"), 2, "two H1s in the source, one per edition")
	is(count("Let&#x27;s find something good for tonight.</h1>"), 2, "both are the home's headline")
	check(!/<meta name="robots" content="noindex/.test(body), "the start page is not noindex")
	check(body.includes('<link rel="canonical" href="https://goodwatch.app/"'), "its canonical is the start page's")
	const titles = count('href="/movie/') + count('href="/show/')
	// Without start titles (a server without the title snapshot) the page is incomplete and never stored.
	is(!pages.browser.cache?.includes("no-store"), titles > 0, `a guest's page is stored exactly when it has its start titles: ${pages.browser.cache}`)
	if (titles) is(titles, 16, "the 16 start titles are linked below the room")
	console.log(`  the HTML: / ${Buffer.byteLength(body)} bytes (${gzipSync(body).length} gzip); the dev server's, not a build's`)

	// Which H1 a window gets before any script runs: CSS shows one edition.
	for (const size of [DESKTOP, PHONE, [844, 390]]) {
		const { ctx, page } = await open(GUEST, size, { script: false, touch: size[0] < 768 || size[1] <= 540 })
		const shown = await page.evaluate(() => [...document.querySelectorAll("h1")].filter((h) => h.getClientRects().length > 0).map((h) => h.closest("[data-tv-canvas]").dataset.tvCanvas))
		is(shown, [size[0] >= 768 && size[1] > 540 ? "desktop" : "phone"], `without script a ${size.join(" x ")} window has one H1 laid out, its edition's`)
		await ctx.close()
	}
	// Hydrated: one H1 in the document, and the pictures of the window's own edition only. (The edition CSS hides
	// before hydration has lazy pictures; a browser without script loads lazy pictures at once, so this is checked
	// with script.)
	for (const size of [DESKTOP, PHONE]) {
		const { ctx, page } = await open(GUEST, size)
		is((await read(page)).h1, [HEADLINE], `hydrated at ${size.join(" x ")}: one H1`)
		const asked = await page.evaluate(() =>
			performance
				.getEntriesByType("resource")
				.filter((r) => r.name.includes("image.tmdb.org"))
				.map((r) => r.name.split("/t/p/")[1].split("/")[0]),
		)
		const backdrops = asked.filter((size) => size === "w780" || size === "w1280")
		is(backdrops, [size[0] >= 768 ? "w1280" : "w780"], `at ${size.join(" x ")} the TV asked for one backdrop, its edition's`)
		is(asked.filter((size) => size === "w154").length, 4, "and for the Discover tile's four posters")
		await ctx.close()
	}
	return bytes
}

// ---------------------------------------------------------------------------------------------------------
// Screenshots.

async function shots() {
	const dir = join(here, "shots")
	mkdirSync(dir, { recursive: true })
	const settle = async (page) => {
		await page.evaluate(() => Promise.all([...document.querySelectorAll("#room img")].map((img) => img.decode().catch(() => {}))))
		await page.waitForTimeout(900)
	}
	const shot = async (page, name) => {
		await settle(page)
		await page.screenshot({ path: join(dir, `${name}.jpg`), quality: 82 })
	}
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
			const { ctx, page } = await open(url, size)
			await shot(page, `home-${who}-${device}`)
			if (who === "member") {
				for (let n = 0; n < 4; n++) await page.keyboard.press("ArrowRight")
				await until(page, focusIs("app:shows"), "My shows has the focus")
				await shot(page, `home-member-shows-${device}`)
				await ctx.close()
				continue
			}
			await page.keyboard.press("ArrowRight")
			await until(page, focusIs("app:discover"), "Discover has the focus")
			await shot(page, `home-guest-discover-${device}`)
			await page.keyboard.press("ArrowRight")
			await until(page, focusIs("app:explorer"), "Explorer has the focus")
			await shot(page, `home-guest-explorer-${device}`)
			await page.keyboard.press("ArrowRight")
			await until(page, focusIs("app:taste"), "Taste has the focus")
			await shot(page, `home-guest-taste-${device}`)
			await page.keyboard.press("ArrowUp")
			await until(page, focusIs("bar:search"), "the bar has the focus")
			await shot(page, `home-guest-bar-${device}`)
			// The menu over Discover, as in the prototype's shot.
			await page.keyboard.press("ArrowDown")
			for (let n = 0; n < 3; n++) await page.keyboard.press("ArrowLeft")
			await page.keyboard.press("ArrowRight")
			await page.keyboard.press("Enter")
			await until(page, screenIs("?tv=discover"), "Discover")
			await shot(page, `not-built-${device}`)
			await page.keyboard.press("m")
			await until(page, (x) => x.layers === 2 && x.items.length === 5, "the menu")
			await shot(page, `menu-${device}`)
			for (let n = 0; n < 3; n++) await page.keyboard.press("ArrowDown")
			await until(page, focusIs("menu:about"), "What is GoodWatch? has the focus")
			await page.keyboard.press("Enter")
			await until(page, (x) => screenIs("?tv=about", "got-it")(x) && x.items.length === 5, "What is GoodWatch?")
			await shot(page, `about-${device}`)
			await page.keyboard.press("m")
			await until(page, (x) => x.layers === 2 && x.items.length === 5, "the menu")
			for (let n = 0; n < 4; n++) await page.keyboard.press("ArrowDown")
			await until(page, focusIs("menu:off"), "Turn off has the focus")
			await page.keyboard.press("Enter")
			await until(page, (x) => x.power === "off", "off")
			await page.waitForTimeout(900)
			await shot(page, `off-${device}`)
			await page.keyboard.press("Enter")
			await until(page, (x) => x.boot, "booting")
			await page.waitForTimeout(1300)
			await page.screenshot({ path: join(dir, `boot-${device}.jpg`), quality: 82 })
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
		await page.setContent(`<style>body{margin:0;padding:16px;background:#14161b;color:#fff;font:15px system-ui}h2{font-size:18px;margin:18px 0 8px}div{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start}figure{margin:0}img{display:block}figcaption{padding:4px 0 0;color:#cbd5e1}</style>${body}`)
		await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode())))
		await page.screenshot({ path: join(here, `${name}.jpg`), quality: 80, fullPage: true })
		await ctx.close()
	}
	const pair = (title, their, our, note, width) => `<h2>${title}</h2><div>${cell(theirs(their), "prototype (sample data)", width)}${cell(ours(our), note, width)}</div>`
	await sheet(
		"desktop-beside-prototype",
		1960,
		[
			pair("1920 x 1080, a guest's home", "01-home-desktop", "home-guest-desktop", "slice 3: real data, the first start title", 956),
			pair("A member's home", "16-home-member-desktop", "home-member-desktop", "slice 3: the harness's sample member, pictures painted in", 956),
			pair("The menu, over Discover", "14-menu-desktop", "menu-desktop", "slice 3: over the screen that is not built yet", 956),
			pair("What is GoodWatch?", "15-about-desktop", "about-desktop", "slice 3", 956),
		].join(""),
	)
	await sheet(
		"phone-beside-prototype",
		1720,
		`<h2>390 x 844: the prototype (left of each pair) and slice 3 (right). A guest's home, a member's home, the menu, What is GoodWatch?</h2><div>${[
			["01-home-phone", "home-guest-phone"],
			["16-home-member-phone", "home-member-phone"],
			["14-menu-phone", "menu-phone"],
			["15-about-phone", "about-phone"],
		]
			.map(([their, our]) => cell(theirs(their), "prototype", 195) + cell(ours(our), "slice 3", 195))
			.join("")}</div>`,
	)
	await sheet(
		"focus-desktop",
		1990,
		`<h2>1920 x 1080: the picture follows the focus. Discover, Explorer, Taste, the bar; a member's My shows; the TV off and booting</h2><div>${["home-guest-discover-desktop", "home-guest-explorer-desktop", "home-guest-taste-desktop", "home-guest-bar-desktop", "home-member-shows-desktop", "not-built-desktop", "off-desktop", "boot-desktop"].map((name) => cell(ours(name), name.replace(/-desktop$/, ""), 636)).join("")}</div>`,
	)
	await sheet(
		"focus-phone",
		1720,
		`<h2>390 x 844: Discover, Explorer, Taste, the bar; a member's My shows; a screen not built yet; off; booting</h2><div>${["home-guest-discover-phone", "home-guest-explorer-phone", "home-guest-taste-phone", "home-guest-bar-phone", "home-member-shows-phone", "not-built-phone", "off-phone", "boot-phone"].map((name) => cell(ours(name), name.replace(/-phone$/, ""), 195)).join("")}</div>`,
	)
}

// A dev server's first page load after a start reloads itself once Vite has optimized its dependencies, which
// would cut a walk short: load each page once before the real run.
for (const url of [GUEST, MEMBER]) {
	const { ctx, page } = await open(url, DESKTOP)
	await page.keyboard.press("m")
	await page.waitForTimeout(3000)
	await ctx.close()
}

let bytes = null
if (only !== "shots") {
	for (const size of [DESKTOP, PHONE]) await walk("guest", GUEST, size)
	for (const size of [DESKTOP, PHONE]) await walk("member", MEMBER, size)
	await links()
	bytes = await html()
	writeFileSync(join(here, "checks.json"), `${JSON.stringify({ passed, failed, html: bytes }, null, "\t")}\n`)
}
if (only !== "checks") await shots()
await browser.close()
console.log(`${passed} checks passed, ${failed.length} failed`)
for (const what of failed) console.log("FAILED", what)
process.exit(failed.length ? 1 : 0)
