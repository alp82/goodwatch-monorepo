// Slice 5 of the new TV (Tonight, the title screen, the rating and the Watch key): walks home, Tonight, a title and
// the rating on /home-preview with the keyboard, both Remotes' keys and the pointer, as a guest on real data and as
// a member on the tracking harness; asks /api/title-cards directly; follows the Watch key to the title page and
// watches its streaming block; and takes the screenshots in shots/ and the sheets beside the prototype's own.
//
//   PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs GUEST=http://localhost:3191 \
//   MEMBER=http://localhost:3192 node drive.mjs [checks|shots]
//
// The repo has no browser driver: install playwright-core outside it. GUEST is a dev server of goodwatch-webapp
// that reads real data; MEMBER is one without any service, for the harness (see README.md here for both
// commands). PROTOTYPE= is the folder of the prototype's notes (docs/prototypes/tv-screen-design on
// prototype/tv-screen-flow), for the sheets.
//
// Nothing here signs in or writes to a server: a guest's Want to See and rating go to the browser's own storage,
// which is what the checks read, and requests that would leave the machine are stopped in the browser.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const ORIGIN = process.env.GUEST ?? "http://localhost:3191"
const GUEST = `${ORIGIN}/home-preview`
const MEMBER = `${process.env.MEMBER ?? "http://localhost:3192"}/prototype/my-library-real/tv?member=six`
const prototype = process.env.PROTOTYPE ?? "/home/alper/projects/goodwatch-monorepo-38caebf4/docs/prototypes/tv-screen-design"
const only = process.argv[2]
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")

const DESKTOP = [1920, 1080]
const PHONE = [390, 844]
const BAR = ["bar:back", "bar:search", "bar:menu"]
const TONIGHT = ["details", "another", ...BAR]
const TITLE = ["watch", "want-to-see", "seen", ...BAR]
const RATE = ["level:9", "level:7", "level:5", "level:3", ...BAR]
/** The title the Watch key is followed on: it streams in the United States, and its page is cached. */
const MATRIX = { key: "movie-603", catalog: 1_000_000_000_603, name: "The Matrix", path: "/movie/603-the-matrix" }
const THRONES = 2_000_000_001_399
const PROGRESS_KEY = "onboarding_ratings"
const PULSE_MS = 1300

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
async function open(url, [width, height], { touch = width < 768, tries = 3, reducedMotion, before, room = true, storage } = {}) {
	const ctx = await browser.newContext({
		viewport: { width, height },
		deviceScaleFactor: touch ? 2 : 1,
		reducedMotion,
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
		if (path !== "/api/living-room/picks" && path !== "/api/title-cards") return
		answers.push({ path, status: r.status(), method: r.request().method(), json: await r.json().catch(() => null) })
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
		await page.waitForSelector(room ? "#room:not([data-room=unmeasured]) [data-tv-item]" : "#streaming", { timeout: 180000 })
	} catch (error) {
		await ctx.close().catch(() => {})
		if (tries <= 1) throw error
		console.log("loading again:", String(error.message).split("\n")[0])
		await sleep(4000)
		return open(url, [width, height], { touch, tries: tries - 1, reducedMotion, before, room, storage })
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
		if (!room) return { search: location.search, path: location.pathname, hash: location.hash, room: false, items: [], focus: [], labels: {}, layers: 0 }
		const layers = [...room.querySelectorAll("[data-tv-layer]")]
		const top = layers.at(-1)
		const items = top ? [...top.querySelectorAll("[data-tv-item]")] : []
		const id = (el) => el.getAttribute("data-tv-item")
		const place = top?.querySelector("[data-tv-expand-place]")
		return {
			search: location.search,
			path: location.pathname,
			hash: location.hash,
			room: true,
			layers: layers.length,
			items: items.map(id),
			focus: items.filter((el) => el.getAttribute("aria-current")).map(id),
			labels: Object.fromEntries(items.map((el) => [id(el), el.textContent])),
			name: top?.querySelector(".truncate.font-bold")?.textContent ?? null,
			crumb: top?.querySelector(".truncate.leading-tight")?.textContent ?? null,
			heading: top?.querySelector(".line-clamp-2.font-bold")?.textContent ?? null,
			text: top?.innerText ?? "",
			toast: room.querySelector(".tvc-toast")?.textContent ?? null,
			history: history.length,
			expandPlace: place ? place.childElementCount : null,
			picture: top?.querySelector(":scope > .absolute.inset-0.overflow-hidden img")?.getAttribute("src") ?? null,
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
			check(false, `${what}: still ${JSON.stringify(now && { path: now.path, search: now.search, focus: now.focus, items: now.items, toast: now.toast, heading: now.heading })}`)
			return now ?? { items: [], focus: [], labels: {} }
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
/** An item on the TV, pressed with the pointer or a finger. */
async function point(page, item, touch) {
	const el = page.locator(`#room [data-tv-layer] [data-tv-item="${item}"]`).last()
	if (touch) await el.tap()
	else await el.click()
}

/** A guest's progress, as their browser holds it. */
const progress = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]").map(({ media_type, tmdb_id, type, score }) => ({ media_type, tmdb_id, type, ...(score ? { score } : {}) })), PROGRESS_KEY)
const tvKey = (card) => `${card.media_type}-${card.tmdb_id}`
/** The requests that would have left the machine, without the site's own telemetry. */
const beyondTelemetry = (left) => [...new Set(left.map((u) => new URL(u).hostname))].filter((host) => !/posthog|sentry|googletagmanager|google-analytics|cloudflareinsights/.test(host))
// What a dev server's console says on any page, and one warning of the title page's own carousel on a phone.
const noise = (logs) => logs.filter((l) => !l.includes("Future Flag") && !l.includes("net::ERR_FAILED") && !l.includes("503") && !l.includes("Failed to load resource") && !l.includes("Swiper Loop Warning"))

/** The pool a guest nobody knows anything about gets in the United States, as the page asks for it. */
const guestOf = (rest = {}) => ({ interactions: [], country: "US", services: "", ...rest })
const json = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })

// ---------------------------------------------------------------------------------------------------------
// /api/title-cards, asked directly.

async function endpoint() {
	where = "/api/title-cards"
	console.log(where)
	const api = (keys, init) => fetch(`${ORIGIN}/api/title-cards${keys === null ? "" : `?keys=${keys}`}`, init)

	let response = await api(MATRIX.catalog)
	let answer = await response.json()
	is(response.status, 200, "a GET by key answers")
	is(response.headers.get("cache-control"), "private, no-store", "the answer is never stored")
	is(answer.cards.map((c) => [c.media_type, c.tmdb_id, c.title]), [["movie", 603, MATRIX.name]], "the card of the title asked for")
	const card = answer.cards[0] ?? {}
	check(["backdrop_path", "poster_path", "release_year", "runtime", "tagline", "goodwatch_overall_score_normalized_percent", "match", "services", "seen", "wantToSee"].every((field) => field in card), "the card has what the title screen shows")
	is([card.wantToSee, card.seen, card.match], [false, false, null], "nobody's marks and no match for a viewer nobody knows")
	is(answer.services, [], "and no services of their own")

	answer = await (await api(`${THRONES},${MATRIX.catalog}`)).json()
	is(answer.cards.map((c) => c.tmdb_id), [1399, 603], "several cards come in the order asked")
	answer = await (await api(`${MATRIX.catalog},1000999999999`)).json()
	is(answer.cards.map((c) => c.tmdb_id), [603], "a title the catalog lacks is left out")

	for (const [what, keys, init, status] of [
		["no keys", null, undefined, 400],
		["a key in the TV's form", "movie-603", undefined, 400],
		["61 keys", Array.from({ length: 61 }, (_, i) => 1_000_000_000_001 + i).join(","), undefined, 400],
		["another method", MATRIX.catalog, { method: "DELETE" }, 405],
		["a body that is no guest progress", MATRIX.catalog, json({ guest: { interactions: "all" } }), 400],
	]) {
		response = await api(keys, init)
		is([response.status, response.headers.get("cache-control")], [status, "private, no-store"], `${what} is refused, and the refusal is not stored`)
	}

	// A guest's POST: the card says what their browser's progress says.
	const mark = (type, score) => ({ media_type: "movie", tmdb_id: 603, type, timestamp: Date.now(), ...(score ? { score } : {}) })
	answer = await (await api(MATRIX.catalog, json({ guest: guestOf({ interactions: [mark("plan")] }) }))).json()
	is([answer.cards[0]?.wantToSee, answer.cards[0]?.seen], [true, false], "a guest's Want to See is on the card")
	answer = await (await api(MATRIX.catalog, json({ guest: guestOf({ interactions: [mark("score", 8)] }) }))).json()
	is([answer.cards[0]?.wantToSee, answer.cards[0]?.seen], [false, true], "a guest's score counts as Seen")
	const us = await (await api(MATRIX.catalog, json({ guest: guestOf() }))).json()
	const offers = us.cards[0]?.services ?? []
	check(offers.length > 0, `${MATRIX.name} streams somewhere in the United States: ${offers.map((s) => s.name).join(", ")}`)
	const own = offers[0]
	if (own) {
		answer = await (await api(MATRIX.catalog, json({ guest: guestOf({ services: String(own.id) }) }))).json()
		check(answer.services.some((s) => s.name === own.name), `a guest's saved service comes back as theirs: ${answer.services.map((s) => s.name).join(", ")}`)
		is(answer.cards[0]?.services[0]?.name, own.name, "and leads the title's services")
	}

	// The card is the one the pool holds for the same viewer: a list's first paint and the card agree.
	const pool = await (await fetch(`${ORIGIN}/api/living-room/picks?view=pool`, json({ guest: guestOf() }))).json()
	const best = pool.suggestions?.[0]
	check(Boolean(best), "the pool answers its suggestions")
	if (best) {
		answer = await (await api(best.key, json({ guest: guestOf() }))).json()
		const { moods, ...asCard } = best
		is(answer.cards[0], asCard, `the pool's card of ${best.title} is the card the endpoint answers`)
	}
	return { own, pool }
}

// ---------------------------------------------------------------------------------------------------------
// The walk: home, Tonight, a title, Want to See, Seen it with the rating, and back. The same for a guest and a
// member, on the desktop and on the phone.

async function walk(who, url, size) {
	const member = who === "member"
	const phone = size[0] < 768
	const at = (tv) => (member ? `?member=six${tv ? `&${tv}` : ""}` : tv ? `?${tv}` : "")
	const home = at("")
	// The keys along a row on the desktop stand in a column on the phone.
	const next = phone ? "ArrowDown" : "ArrowRight"
	const previous = phone ? "ArrowUp" : "ArrowLeft"
	where = `${who} ${size.join("x")}`
	console.log(where)
	// The harness's catalog has pictures that lead nowhere, and its page paints real ones into what its loader
	// answers. A card asked for later would bring the dead ones back: paint the same ones in, as the page does.
	const art = new Map()
	const { ctx, page, logs, requests, answers, left } = await open(url, size, {
		storage: member ? undefined : { country: "US" },
		before: member
			? (p) =>
					p.route("**/api/title-cards*", async (route) => {
						const response = await route.fetch()
						const body = await response.json()
						for (const card of body.cards ?? []) Object.assign(card, art.get(`${card.media_type}-${card.tmdb_id}`))
						return route.fulfill({ response, json: body })
					})
			: undefined,
	})
	const asked = (part) => requests.filter((r) => r.url.includes(part))
	const code = (name) => asked(`/tv/screens/${name}`)
	const cards = () => asked("/api/title-cards")
	const writes = () => requests.filter((r) => /\/api\/update-(wishlist|scores|watch-history)/.test(r.url))

	// ---- Arrival: nothing of the three screens is asked for.
	let s = await read(page)
	is(s.focus, ["app:tonight"], "the focus starts on Tonight's tile")
	is(code("Tonight").length + code("Title").length + code("Rate").length, 0, "Tonight's, the title screen's and the rating's code are not in the first view")
	is(cards().length, 0, "no card is asked for on arrival")
	const history = s.history
	// What the member's loader answered, for the pictures and for what Tonight must show.
	const loaded = await page.evaluate(() => Object.values(window.__remixContext.state.loaderData).find((data) => data && Array.isArray(data.tonight)))
	for (const pick of loaded?.tonight ?? []) art.set(`${pick.card.media_type}-${pick.card.tmdb_id}`, { poster_path: pick.card.poster_path, backdrop_path: pick.card.backdrop_path })

	// ---- The first interaction: Tonight's tile has the focus, so its code is asked for, with the title screen's.
	s = await key(page, "ArrowDown", "app:tonight", "Down from the tiles stays")
	await until(page, () => code("Tonight").length > 0 && code("Title").length > 0, "the first interaction asked for Tonight's code, which brings the title screen's")
	is(code("Rate").length, 0, "the rating's code waits for the title screen")

	// ---- Tonight.
	await page.keyboard.press("Enter")
	s = await until(page, screenIs(at("tv=tonight"), "details", TONIGHT), "OK on the Tonight tile opens Tonight on the TV, with its first pick")
	is(s.history, history + 1, "opening Tonight is one history entry")
	is(s.name, "Tonight", "the bar says Tonight")
	if (!member) await until(page, () => answers.some((a) => a.path === "/api/living-room/picks" && a.json?.suggestions), "the pool's answer is read")
	const picks = member ? loaded.tonight.slice(0, 3).map((p) => p.card) : (answers.find((a) => a.path === "/api/living-room/picks" && a.json?.suggestions)?.json.suggestions.slice(0, 3) ?? [])
	check(picks.length >= 2, `there are picks to step through: ${picks.map((p) => p.title).join(", ")}`)
	is(s.heading, picks[0]?.title, member ? "a member's first pick is the loader's" : "a guest's first pick is the pool's best")
	if (member) check(/^Next episode: S\d+ E\d+$/.test(s.crumb ?? ""), `a member's Tonight's pick is their next episode, and the bar names it: ${s.crumb}`)
	else is(s.crumb, "Best rated right now", "a guest's picks are the best rated right now")
	check(s.picture?.includes(`/${phone ? "w780" : "w1280"}/`), `the pick's picture is a ${phone ? "w780" : "w1280"} backdrop: ${s.picture}`)
	if (!phone) check(s.text.toUpperCase().includes(`PICK 1 OF ${picks.length}`), `the desktop says which pick it is: ${s.text.slice(0, 60)}`)
	is(s.expandPlace, 0, "the Expand key's place is kept, and empty until slice 11")
	if (!member) is(asked("/api/living-room/picks").map((r) => r.method), ["POST"], "a guest's pool was asked for once, with their progress")

	// ---- Another one steps through the picks in place and wraps.
	s = await key(page, next, "another")
	s = await key(page, next, "another", "the keys end at Another one")
	for (let n = 1; n <= picks.length; n++) {
		const to = n % picks.length
		await page.keyboard.press("Enter")
		s = await until(page, (x) => screenIs(at(to ? `tv=tonight&pick=${to}` : "tv=tonight"), "another", TONIGHT)(x) && x.heading === picks[to].title, `Another one shows pick ${to + 1}, with the focus still on the key`)
	}
	is(s.history, history + 1, "Another one never adds a history entry")
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.search === at("tv=tonight&pick=1") && x.heading === picks[1].title, "the second pick again")
	if (member && !phone) check(/From your Wishlist/.test(s.crumb ?? ""), `a member's second pick is from their Wishlist: ${s.crumb}`)

	// ---- Details opens the pick's title screen.
	const title = picks[1]
	const titleAt = at(`tv=title&title=${tvKey(title)}`)
	s = await key(page, previous, "details")
	await page.keyboard.press("Enter")
	s = await until(page, screenIs(titleAt, "watch", TITLE), "Details opens the title screen of the pick on show")
	is(s.heading, title.title, "it names the title at once, from what Tonight knew")
	is(s.name, title.media_type === "show" ? "Show" : "Movie", "the bar says whether it is a movie or a show")
	is(s.history, history + 2, "the title screen is one more history entry")
	is(s.expandPlace, 0, "the Expand key's place is kept, and empty until slice 11")
	await until(page, () => answers.some((a) => a.path === "/api/title-cards"), "the title's card arrives")
	const cardAsk = cards()
	is(cardAsk.length, 1, "the card is asked for once")
	is(cardAsk[0]?.method, member ? "GET" : "POST", member ? "a member asks with GET" : "a guest asks with POST")
	check(cardAsk[0]?.url.endsWith(`keys=${(title.media_type === "show" ? 2e12 : 1e12) + title.tmdb_id}`), `by the title's key: ${cardAsk[0]?.url}`)
	if (!member) check(Array.isArray(JSON.parse(cardAsk[0]?.body ?? "{}").guest?.interactions), "a guest's request carries their browser's progress")
	s = await until(page, (x) => /^(Watch on .+|On .+|Not streaming)$/.test(x.labels.watch ?? ""), "the Watch key says where the title streams")
	is([s.labels["want-to-see"], s.labels.seen], ["Want to See", "Seen it"], "Want to See and Seen it, as nothing is marked")
	is(s.heading, title.title, "the card names the same title")
	await until(page, () => code("Rate").length > 0, "on the title screen the rating's code is asked for")

	// ---- The keys: a row on the desktop, a column on the phone, the bar above, the corner free.
	s = await key(page, next, "want-to-see")
	s = await key(page, next, "seen")
	s = await key(page, next, "seen", "the keys end at Seen it")
	s = await key(page, previous, "want-to-see")
	s = await key(page, previous, "watch")
	await page.keyboard.press("ArrowUp")
	s = await until(page, (x) => x.focus[0]?.startsWith("bar:"), "Up from the keys reaches the bar")
	await page.keyboard.press("ArrowDown")
	s = await until(page, (x) => ["watch", "want-to-see", "seen"].includes(x.focus[0]), "Down from the bar returns to the keys")
	const boxes = await page.evaluate(() => {
		const layer = [...document.querySelectorAll("#room [data-tv-layer]")].at(-1)
		const box = (el) => el.getBoundingClientRect()
		const tv = box(layer)
		const place = box(layer.querySelector("[data-tv-expand-place]"))
		const keys = ["watch", "want-to-see", "seen"].map((id) => box(layer.querySelector(`[data-tv-item="${id}"]`)))
		return {
			inside: keys.every((k) => k.left >= tv.left && k.right <= tv.right && k.top >= tv.top && k.bottom <= tv.bottom),
			height: Math.round(Math.min(...keys.map((k) => k.height)) * 10) / 10,
			// The corner: from the Expand key's place 158 canvas px to the left (the prototype's key on the phone).
			clear: keys.every((k) => k.right < place.right - 158 * (tv.width / layer.offsetWidth) || k.bottom < place.bottom - 54 * (tv.width / layer.offsetWidth)),
		}
	})
	check(boxes.inside, "the three keys are inside the picture")
	if (phone) check(boxes.clear, "on the phone the keys leave the Expand key's corner free")
	numbers[`${where}: the title screen's keys, px tall`] = boxes.height

	// ---- Want to See: a toggle, stored in the browser for anyone without a session.
	const mark = (type, score) => ({ media_type: title.media_type, tmdb_id: title.tmdb_id, type, ...(score ? { score } : {}) })
	const marksOf = async () => (await progress(page)).filter((m) => m.tmdb_id === title.tmdb_id && m.media_type === title.media_type)
	for (let n = 0; n < 4 && (await read(page)).focus[0] !== "watch"; n++) {
		await page.keyboard.press(previous)
		await page.waitForTimeout(150)
	}
	s = await key(page, next, "want-to-see")
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.toast === "On your Wishlist" && x.labels["want-to-see"] === "On Wishlist ✓", "Want to See puts the title on the Wishlist, says so, and the key says what is")
	is([s.search, s.focus], [titleAt, ["want-to-see"]], "the screen stays, with the focus on the key")
	is(await marksOf(), [mark("plan")], "the title is on the Wishlist in the browser's progress")
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.toast === "Off your Wishlist" && x.labels["want-to-see"] === "Want to See", "one more press takes it back")
	is(await marksOf(), [], "and the browser's progress has it no more")
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.labels["want-to-see"] === "On Wishlist ✓", "Want to See again")

	// ---- Seen it asks how it was; the answer is stored and returns to the title.
	s = await key(page, next, "seen")
	await page.keyboard.press("Enter")
	s = await until(page, screenIs(at(`tv=rate&title=${tvKey(title)}`), "level:9", RATE), "Seen it opens the rating")
	is(s.history, history + 3, "the rating is one more history entry")
	check(s.heading === `How was ${title.title}?`, `it asks how the title was: ${s.heading}`)
	is([s.labels["level:9"], s.labels["level:7"], s.labels["level:5"], s.labels["level:3"]], ["Excellent", "Good", "Mediocre", "Bad"], "the four answers of the plain version")
	is(s.expandPlace, null, "the rating has no Expand key")
	s = await key(page, "ArrowRight", "level:7")
	await page.keyboard.press("ArrowUp")
	s = await until(page, (x) => x.focus[0]?.startsWith("bar:"), "Up from the answers reaches the bar")
	await page.keyboard.press("ArrowDown")
	s = await until(page, (x) => x.focus[0]?.startsWith("level:"), "Down from the bar returns to the answers")
	// Back to the first answer: along the row on the desktop; on the phone the answers are two by two.
	for (const press of phone ? ["ArrowLeft", "ArrowUp"] : ["ArrowLeft", "ArrowLeft", "ArrowLeft"]) {
		if ((await read(page)).focus[0] === "level:9") break
		await page.keyboard.press(press)
		await page.waitForTimeout(150)
	}
	s = await key(page, "ArrowRight", "level:7")
	await page.keyboard.press("Enter")
	s = await until(page, (x) => screenIs(titleAt, "seen", TITLE)(x) && x.labels.seen === "7 · Good", "an answer stores the score and returns to the title, whose key now says it")
	is(s.toast, "Rated 7 · Good", "the TV says what was stored")
	is(await marksOf(), [mark("score", 7)], "the score is in the browser's progress, where it took the Want to See's place")
	is(s.labels["want-to-see"], "Want to See", "a guest's score replaces their Want to See, as everywhere on the site")
	is(writes().length, 0, "nothing was sent to the server: without a session the marks are the browser's")
	// Rating again changes the score.
	await page.keyboard.press("Enter")
	s = await until(page, screenIs(at(`tv=rate&title=${tvKey(title)}`), "level:9", RATE), "Seen it again opens the rating")
	await page.keyboard.press("Enter")
	s = await until(page, (x) => screenIs(titleAt, "seen", TITLE)(x) && x.labels.seen === "9 · Excellent", "another answer changes the score")
	is(await marksOf(), [mark("score", 9)], "and the browser's progress holds the one score")
	// Back from the rating without an answer changes nothing.
	await page.keyboard.press("Enter")
	s = await until(page, screenIs(at(`tv=rate&title=${tvKey(title)}`), "level:9", RATE), "the rating once more")
	await page.keyboard.press("Escape")
	s = await until(page, (x) => screenIs(titleAt, "seen", TITLE)(x) && x.labels.seen === "9 · Excellent", "Back from the rating returns to the title with nothing changed")

	// ---- Back gives every screen its focus back; Forward and a reload too.
	await page.keyboard.press("Escape")
	s = await until(page, (x) => screenIs(at("tv=tonight&pick=1"), "details", TONIGHT)(x) && x.heading === title.title, "Back from the title returns to Tonight on the same pick, with the focus on Details")
	await page.keyboard.press("Backspace")
	s = await until(page, screenIs(home, "app:tonight"), "Back from Tonight returns to home, with the focus on its tile")
	await page.goForward()
	s = await until(page, screenIs(at("tv=tonight&pick=1"), "details", TONIGHT), "the browser's Forward returns to Tonight")
	await page.goForward()
	s = await until(page, screenIs(titleAt, "seen", TITLE), "and to the title, with the focus it had")
	await page.reload({ waitUntil: "load", timeout: 180000 })
	await page.waitForSelector("#room:not([data-room=unmeasured]) [data-tv-item]", { timeout: 180000 })
	s = await until(page, (x) => screenIs(titleAt, "seen", TITLE)(x) && x.heading === title.title && x.labels.seen === "9 · Excellent", "after a reload the title screen is drawn from its card, with the focus and the score it had", 60000)
	is(s.search, titleAt, "the focus was never written to the address")

	// ---- Both Remotes' keys.
	// A guest's picks are asked for again after the reload, and the title they rated is no longer among them: a
	// rated title counts as Seen.
	await remote(page, "Back", phone)
	s = await until(page, screenIs(at("tv=tonight&pick=1"), "details", TONIGHT), "the Remote's Back returns to Tonight, whose picks are asked for again after the reload", 60000)
	if (member) is(s.heading, title.title, "a member's picks are the loader's, as before")
	else check(s.heading !== title.title, `a guest's rated title has left Tonight's picks: ${s.heading}`)
	const shown = s.heading
	await remote(page, phone ? "Down" : "Next", phone)
	s = await until(page, focusIs("another"), "the Remote's arrow moves to Another one")
	await remote(page, "OK", phone)
	s = await until(page, (x) => x.search !== at("tv=tonight&pick=1") && x.search.includes("tv=tonight") && focusIs("another")(x) && x.heading !== shown, "the Remote's OK shows another pick")
	await remote(page, phone ? "Up" : "Previous", phone)
	s = await until(page, focusIs("details"), "the Remote's arrow moves back to Details")
	await remote(page, "OK", phone)
	s = await until(page, (x) => x.search.includes("tv=title&title=") && focusIs("watch")(x) && same(x.items, TITLE), "the Remote's OK opens the title")
	await remote(page, phone ? "Down" : "Next", phone)
	s = await until(page, focusIs("want-to-see"), "the Remote's arrow moves along the title's keys")
	await remote(page, "Home", phone)
	s = await until(page, screenIs(home, "app:tonight"), "the Remote's Home shows home")

	// ---- The pointer, and a finger.
	await remote(page, "OK", phone)
	s = await until(page, (x) => screenIs(at("tv=tonight"), "details", TONIGHT)(x), "Tonight again")
	await point(page, "another", phone)
	s = await until(page, (x) => x.search === at("tv=tonight&pick=1") && focusIs("another")(x), `${phone ? "a tap" : "a click"} on Another one shows the next pick`)
	await point(page, "details", phone)
	s = await until(page, (x) => x.search.includes("tv=title&title=") && focusIs("watch")(x) && same(x.items, TITLE), `${phone ? "a tap" : "a click"} on Details opens the title`)
	const pointed = s.search
	await point(page, "seen", phone)
	s = await until(page, (x) => x.search === pointed.replace("tv=title", "tv=rate") && focusIs("level:9")(x) && same(x.items, RATE), `${phone ? "a tap" : "a click"} on Seen it opens the rating`)
	await point(page, "level:5", phone)
	s = await until(page, (x) => x.search === pointed && x.labels.seen === "5 · Mediocre", `${phone ? "a tap" : "a click"} on an answer stores it`)
	await point(page, "bar:back", phone)
	s = await until(page, (x) => x.search === at("tv=tonight&pick=1"), "the bar's Back goes back")

	is(noise(logs), [], "nothing in the console")
	is(beyondTelemetry(left), [], "no request left the machine but the site's own telemetry, which was stopped")
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// The Watch key: the title's page on GoodWatch at its streaming block, which is highlighted once.

/** What the title page's streaming block looks like right now. */
const block = (page) =>
	page.evaluate(() => {
		const el = document.getElementById("streaming")
		if (!el) return null
		const b = el.getBoundingClientRect()
		const style = getComputedStyle(el)
		const top = document.elementFromPoint(b.left + b.width / 2, b.top + 6)
		return {
			t: performance.now(),
			path: location.pathname,
			hash: location.hash,
			glow: el.classList.contains("gw-watch-glow"),
			animation: style.animationName,
			outline: `${style.outlineStyle} ${style.outlineColor}`,
			background: style.backgroundColor,
			transition: document.documentElement.dataset.tvTransition ?? null,
			y: Math.round(b.top),
			// The block's top edge is in the window and nothing lies over it.
			visible: b.top >= 0 && b.bottom <= innerHeight && Boolean(top && el.contains(top)),
			focused: document.activeElement === el,
			tabindex: el.getAttribute("tabindex"),
			rules: el.querySelectorAll("style").length,
			wish: history.state?.usr?.highlight ?? null,
			events: window.__glow ?? null,
		}
	})

/** Counts the pulse's animation events from now on, also on the page a navigation inside the app opens. */
const countPulses = (page) =>
	page.evaluate(() => {
		window.__glow = { start: 0, iteration: 0, end: 0 }
		for (const [type, name] of [
			["animationstart", "start"],
			["animationiteration", "iteration"],
			["animationend", "end"],
		])
			document.addEventListener(type, (e) => e.animationName === "gw-watch-glow" && window.__glow[name]++, true)
	})

/** Opens The Matrix's title screen as a guest in the United States, with `services` saved, and waits for its card. */
async function openTitle(size, { services = "", reducedMotion, focus } = {}) {
	const opened = await open(`${GUEST}?tv=title&title=${MATRIX.key}${focus ? `&focus=${focus}` : ""}`, size, { reducedMotion, storage: { country: "US", withStreamingProviders: services } })
	const s = await until(opened.page, (x) => x.heading === MATRIX.name && /^(Watch on |On )/.test(x.labels.watch ?? ""), "the title screen of a link straight to a title is drawn from its card", 60000)
	return { ...opened, s }
}

/** Samples the block every 100 ms until `done` says so, at most `ms`. */
async function sample(page, ms, done = () => false) {
	const samples = []
	const end = Date.now() + ms
	while (Date.now() < end) {
		const now = await block(page).catch(() => null)
		if (now) samples.push(now)
		if (now && done(now, samples)) break
		await page.waitForTimeout(100)
	}
	return samples
}

async function watch(size, own) {
	const phone = size[0] < 768
	where = `the Watch key ${size.join("x")}`
	console.log(where)
	const { ctx, page, s, logs, left } = await openTitle(size, { services: String(own.id) })
	check(s.labels.watch?.startsWith("Watch on "), `on one of the person's services the key says Watch on: ${s.labels.watch}`)
	is(s.focus, ["watch"], "the focus starts on the Watch key")
	await countPulses(page)
	await page.keyboard.press("Enter")
	await page.waitForSelector("#streaming", { timeout: 120000 })
	// From arrival until the highlight has ended.
	const samples = await sample(page, 12000, (now, all) => !now.glow && all.some((x) => x.glow))
	const first = samples[0]
	is([first?.path, first?.hash], [MATRIX.path, "#streaming"], "the key opens the title's page on GoodWatch, at its streaming block")
	check(first?.glow, "the block is highlighted on arrival")
	is(first?.wish, null, "the wish to highlight has left the history entry by then")
	check(samples.some((x) => x.focused), "the block has the focus, for a screen reader")
	const during = samples.filter((x) => x.transition)
	numbers[`${where}: samples taken during the transition from the TV`] = during.length
	check(during.every((x) => x.animation === "none"), "nothing pulses while the TV's picture grows into the page")
	const pulsing = samples.filter((x) => x.animation === "gw-watch-glow")
	check(pulsing.length > 0 && pulsing.every((x) => !x.transition), "the pulse starts once the transition has ended")
	// While the transition's own layers are still being taken down, the window answers no hit test: the last
	// samples of the pulse say what lies over the block.
	check(pulsing.slice(-10).every((x) => x.visible), `the block is in the window, clear of the site's bar and the title's header, at y ${pulsing.at(-1)?.y}`)
	numbers[`${where}: the block's top on arrival, px`] = pulsing.at(-1)?.y
	check(pulsing.every((x) => x.background === "rgba(251, 191, 36, 0.28)"), `the tutorial's amber tint: ${pulsing[0]?.background}`)
	const last = samples.at(-1)
	check(last && !last.glow && last.animation === "none" && last.rules === 0, "the highlight ends by itself, and its rules leave the page")
	is(last?.events, { start: 1, iteration: 2, end: 1 }, "it pulsed exactly three times")
	const lasted = pulsing.length ? last.t - pulsing[0].t : 0
	numbers[`${where}: the pulse lasted, ms`] = Math.round(lasted)
	check(lasted > 3 * PULSE_MS - 400 && lasted < 3 * PULSE_MS + 600, `three pulses of ${PULSE_MS} ms: ${Math.round(lasted)} ms`)
	const rest = await sample(page, 1500)
	check(rest.every((x) => !x.glow && x.animation === "none"), "nothing animates at rest afterwards")
	is(await page.evaluate(() => document.getElementById("streaming").getAnimations().length), 0, "the block has no animation left")

	// A reload, and Back and Forward to the page, do not highlight again.
	await page.reload({ waitUntil: "load", timeout: 180000 })
	await page.waitForSelector("#streaming", { timeout: 120000 })
	let again = await sample(page, 2500)
	check(again.length > 0 && again.every((x) => !x.glow && x.rules === 0), "a reload does not highlight the block again")
	check(again.at(-1)?.visible, "a reload scrolls to the block, as its address says")
	await page.goBack()
	const back = await until(page, (x) => x.room && x.search === `?tv=title&title=${MATRIX.key}` && focusIs("watch")(x) && x.heading === MATRIX.name, "Back from the page returns to the title's TV screen with the Watch key focused", 60000)
	is(back.items, TITLE, "the title screen is as it was")
	await page.goForward()
	await page.waitForSelector("#streaming", { timeout: 120000 })
	again = await sample(page, 2500)
	check(again.length > 0 && again.every((x) => !x.glow), "Forward to the page does not highlight the block again")
	// Leaving the page through one of its own links and coming back.
	await page.evaluate(() => document.querySelector('a[href="/"]').click())
	await page.waitForFunction(() => location.pathname === "/" && document.getElementById("room"), null, { timeout: 120000 })
	await page.waitForLoadState("load")
	await page.waitForTimeout(1500)
	await page.goBack()
	await page.waitForSelector("#streaming", { timeout: 120000 })
	again = await sample(page, 2500)
	check(again.length > 0 && again.every((x) => !x.glow), "Back to the page from another page does not highlight the block again")
	is(noise(logs), [], "nothing in the console")
	is(beyondTelemetry(left), [], "no request left for a streaming service: the key opens GoodWatch")
	await ctx.close()
}

async function watchEdges(own, pool) {
	// ---- A press inside the block ends the highlight at once, and still does what it is for.
	where = "the Watch key, a press inside the block"
	console.log(where)
	let opened = await openTitle(DESKTOP, { services: String(own.id) })
	let { page } = opened
	await page.keyboard.press("Enter")
	await page.waitForSelector("#streaming", { timeout: 120000 })
	let samples = await sample(page, 8000, (now) => now.animation === "gw-watch-glow")
	check(samples.at(-1)?.animation === "gw-watch-glow", "the block pulses")
	const tab = page.locator('#streaming [role="tab"]').nth(1)
	const before = await tab.getAttribute("aria-selected")
	await tab.click()
	await page.waitForTimeout(150)
	let now = await block(page)
	check(now && !now.glow && now.animation === "none", "a press inside the block ends the highlight at once")
	is([before, await tab.getAttribute("aria-selected")], ["false", "true"], "and the press still chose the tab")
	await opened.ctx.close()

	// ---- So does a key inside it.
	where = "the Watch key, a key inside the block"
	console.log(where)
	opened = await openTitle(DESKTOP, { services: String(own.id) })
	page = opened.page
	await page.keyboard.press("Enter")
	await page.waitForSelector("#streaming", { timeout: 120000 })
	samples = await sample(page, 8000, (x) => x.animation === "gw-watch-glow")
	check(samples.at(-1)?.focused, "the block has the focus")
	await page.keyboard.press("Tab")
	await page.waitForTimeout(150)
	now = await block(page)
	check(now && !now.glow && now.animation === "none", "a key inside the block ends the highlight at once")
	check(await page.evaluate(() => document.getElementById("streaming").contains(document.activeElement) && document.activeElement.id !== "streaming"), "and Tab moved on to the block's first control")
	await opened.ctx.close()

	// ---- Reduced motion: plain navigation, a still outline for the same time, no pulse.
	where = "the Watch key, reduced motion"
	console.log(where)
	opened = await openTitle(DESKTOP, { services: String(own.id), reducedMotion: "reduce" })
	page = opened.page
	await countPulses(page)
	await page.keyboard.press("Enter")
	await page.waitForSelector("#streaming", { timeout: 120000 })
	samples = await sample(page, 9000, (x, all) => !x.glow && all.some((y) => y.glow))
	const lit = samples.filter((x) => x.glow)
	check(lit.length > 0 && lit.every((x) => x.animation === "none" && !x.transition), "with reduced motion nothing pulses and the navigation is plain")
	check(lit.every((x) => x.outline === "solid rgb(251, 191, 36)"), `the block has a still amber outline: ${lit[0]?.outline}`)
	const still = lit.length ? samples.at(-1).t - lit[0].t : 0
	numbers["reduced motion: the outline stayed, ms"] = Math.round(still)
	check(still > 3 * PULSE_MS - 500 && still < 3 * PULSE_MS + 600, `for as long as three pulses: ${Math.round(still)} ms`)
	check(!samples.at(-1).glow && samples.at(-1).outline.startsWith("none"), "then the outline is gone")
	is(samples.at(-1).events, { start: 0, iteration: 0, end: 0 }, "no pulse ever ran")
	await page.goBack()
	await until(page, (x) => x.room && x.search === `?tv=title&title=${MATRIX.key}` && focusIs("watch")(x), "Back returns to the title's TV screen with the Watch key focused", 60000)
	await opened.ctx.close()

	// ---- An address with #streaming that somebody typed or was sent: it scrolls, and nothing glows.
	where = "a typed address with #streaming"
	console.log(where)
	for (const size of [DESKTOP, PHONE]) {
		opened = await open(`${ORIGIN}${MATRIX.path}#streaming`, size, { room: false, storage: { country: "US" } })
		samples = await sample(opened.page, 3000)
		check(samples.length > 0 && samples.every((x) => !x.glow && x.rules === 0 && x.animation === "none"), `${size.join("x")}: the block does not glow`)
		check(samples.every((x) => x.tabindex === null && !x.focused), `${size.join("x")}: the block is not focused and takes no focus`)
		check(samples.at(-1)?.visible, `${size.join("x")}: the page scrolled to the block, clear of the headers, at y ${samples.at(-1)?.y}`)
		numbers[`a typed address ${size.join("x")}: the block's top, px`] = samples.at(-1)?.y
		await opened.ctx.close()
	}

	// ---- On somebody else's service the key says On; on no service it does nothing.
	where = "the Watch key, not the person's service"
	console.log(where)
	opened = await openTitle(DESKTOP)
	check(opened.s.labels.watch?.startsWith("On "), `without that service saved the key says On: ${opened.s.labels.watch}`)
	await opened.page.keyboard.press("Enter")
	await opened.page.waitForSelector("#streaming", { timeout: 120000 })
	samples = await sample(opened.page, 6000, (x) => x.animation === "gw-watch-glow")
	check(samples.at(-1)?.glow, "it opens the title's page at the highlighted block all the same")
	await opened.ctx.close()

	where = "the Watch key, a title that streams nowhere"
	console.log(where)
	const nowhere = (pool.suggestions ?? []).find((card) => card.services && card.services.length === 0)
	numbers["a title of the pool that streams nowhere in the United States"] = nowhere?.title ?? "none in the pool today: not checked"
	if (nowhere) {
		opened = await open(`${GUEST}?tv=title&title=${tvKey(nowhere)}`, DESKTOP, { storage: { country: "US" } })
		let s = await until(opened.page, (x) => x.labels.watch === "Not streaming", `${nowhere.title}'s key says Not streaming`, 60000)
		check(s.text.includes("Not streaming"), "and so does its line of facts")
		await opened.page.keyboard.press("Enter")
		await opened.page.waitForTimeout(900)
		s = await read(opened.page)
		is([s.room, s.search, s.focus], [true, `?tv=title&title=${tvKey(nowhere)}`, ["watch"]], "the key does nothing")
		await opened.ctx.close()
	}

	// ---- A title the catalog lacks.
	where = "a title the catalog lacks"
	console.log(where)
	opened = await open(`${GUEST}?tv=title&title=movie-999999999`, DESKTOP, { storage: { country: "US" } })
	let s = await until(opened.page, (x) => x.heading === "GoodWatch doesn't have this title.", "the screen says so", 60000)
	is(s.items, TITLE, "its items are still the machine's, so the focus and the bar work")
	for (const item of ["watch", "want-to-see"]) {
		await opened.page.keyboard.press("Enter")
		await opened.page.waitForTimeout(500)
		s = await read(opened.page)
		is([s.room, s.toast, s.search], [true, null, "?tv=title&title=movie-999999999"], `${item} does nothing`)
		await opened.page.keyboard.press("ArrowRight")
	}
	is(await progress(opened.page), [], "nothing was marked")
	await opened.page.keyboard.press("Escape")
	await until(opened.page, (x) => x.search === "" && x.items.includes("app:tonight"), "Back shows home in its place")
	await opened.ctx.close()

	// ---- The Expand key's effect (the key itself is slice 11's): the title's page, plainly, and no highlight.
	where = "the Expand effect"
	console.log(where)
	opened = await openTitle(DESKTOP, { services: String(own.id), focus: "expand" })
	await opened.page.keyboard.press("Enter")
	await opened.page.waitForSelector("#streaming", { timeout: 120000 })
	samples = await sample(opened.page, 2500)
	is([samples[0]?.path, samples[0]?.hash], [MATRIX.path, ""], "OK on the Expand key opens the title's page, with no fragment")
	check(samples.every((x) => !x.glow), "and the streaming block does not glow")
	await opened.page.goBack()
	await until(opened.page, (x) => x.room && x.search.includes(`tv=title&title=${MATRIX.key}`), "Back returns to the title's TV screen", 60000)
	await opened.ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// The server's HTML.

async function html() {
	where = "the server's HTML"
	console.log(where)
	const get = async (url) => (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36", "Accept-Language": "en-US" } })).text()
	const ids = (text) => [...text.matchAll(/data-tv-item="([^"]+)"/g)].map((m) => m[1])
	for (const [what, query] of [
		["Tonight", "?tv=tonight"],
		["a title", `?tv=title&title=${MATRIX.key}`],
		["the rating", `?tv=rate&title=${MATRIX.key}`],
	]) {
		const page = await get(`${GUEST}${query}`)
		const room = page.slice(0, page.indexOf('<section id="browse"'))
		is(ids(room), [...BAR, ...BAR], `a link straight to ${what}: the server draws the bar alone, once per edition`)
		check(!room.includes(MATRIX.name) && !room.includes("Pick 1"), `nothing of ${what} is in a guest's HTML, which is the same for every guest`)
	}
	// The title page, as everybody gets it: the block has its scroll margin and nothing of the highlight.
	const page = await get(`${ORIGIN}${MATRIX.path}`)
	const tag = /<div[^>]*id="streaming"[^>]*>/.exec(page)?.[0] ?? ""
	check(tag.includes("scroll-margin-top:calc(var(--details-header-height, 112px) + 80px)"), `the streaming block lands clear of the headers: ${tag}`)
	check(!tag.includes("tabindex") && !tag.includes("gw-watch") && !tag.includes("outline-none"), "its markup has nothing of the highlight")
	check(!page.includes("gw-watch-glow"), "and the page's HTML has none of the highlight's rules")
	numbers["the title page's HTML, bytes (dev server)"] = Buffer.byteLength(page)
	numbers["the streaming block's opening tag, bytes"] = Buffer.byteLength(tag)
}

// ---------------------------------------------------------------------------------------------------------
// Screenshots, and the sheets beside the prototype's.

async function shots(own, pool) {
	const dir = join(here, "shots")
	mkdirSync(dir, { recursive: true })
	const settle = async (page) => {
		// A screen's picture joins the page once it is decoded: wait for it, as long as a large file may take.
		const end = Date.now() + 15000
		while (Date.now() < end && !(await read(page)).picture) await page.waitForTimeout(150)
		await page.evaluate(() => Promise.all([...document.querySelectorAll("#room img")].map((img) => img.decode().catch(() => {}))))
		await page.waitForTimeout(900)
	}
	const shot = async (page, name) => {
		await settle(page)
		await page.screenshot({ path: join(dir, `${name}.jpg`), quality: 82 })
	}
	// A title of the pool that streams somewhere, for a title screen that says Watch on.
	const streams = (pool.suggestions ?? []).find((card) => card.services?.length) ?? { media_type: "movie", tmdb_id: 603, services: [own] }
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
			const art = new Map()
			const { ctx, page } = await open(url, size, {
				storage: member ? undefined : { country: "US", withStreamingProviders: String(streams.services[0].id) },
				before: member
					? (p) =>
							p.route("**/api/title-cards*", async (route) => {
								const response = await route.fetch()
								const body = await response.json()
								for (const card of body.cards ?? []) Object.assign(card, art.get(`${card.media_type}-${card.tmdb_id}`))
								return route.fulfill({ response, json: body })
							})
					: undefined,
			})
			const loaded = await page.evaluate(() => Object.values(window.__remixContext.state.loaderData).find((data) => data && Array.isArray(data.tonight)))
			for (const pick of loaded?.tonight ?? []) art.set(`${pick.card.media_type}-${pick.card.tmdb_id}`, { poster_path: pick.card.poster_path, backdrop_path: pick.card.backdrop_path })
			await page.keyboard.press("Enter")
			await until(page, (x) => x.search.includes("tv=tonight") && focusIs("details")(x) && same(x.items, TONIGHT), "Tonight")
			await shot(page, `tonight-${who}-${device}`)
			if (member) {
				// The member's second pick: a movie from their Wishlist.
				await page.keyboard.press(phone ? "ArrowDown" : "ArrowRight")
				await page.keyboard.press("Enter")
				await until(page, (x) => x.search.includes("pick=1"), "the second pick")
				await shot(page, `tonight-member-second-${device}`)
				await page.keyboard.press(phone ? "ArrowUp" : "ArrowLeft")
				await page.keyboard.press("Enter")
			} else {
				// A title that streams on the guest's saved service.
				await page.goto(`${GUEST}?tv=title&title=${tvKey(streams)}`, { waitUntil: "load", timeout: 180000 })
				await page.waitForSelector("#room:not([data-room=unmeasured]) [data-tv-item]", { timeout: 180000 })
				await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" })
			}
			await until(page, (x) => x.search.includes("tv=title") && /^(Watch on |On |Not streaming)/.test(x.labels.watch ?? ""), "the title screen", 60000)
			await shot(page, `title-${who}-${device}`)
			await page.keyboard.press(phone ? "ArrowDown" : "ArrowRight")
			await page.keyboard.press("Enter")
			await until(page, (x) => x.toast === "On your Wishlist", "Want to See")
			await shot(page, `title-wishlist-${who}-${device}`)
			await page.keyboard.press(phone ? "ArrowDown" : "ArrowRight")
			await page.keyboard.press("Enter")
			await until(page, (x) => x.search.includes("tv=rate") && focusIs("level:9")(x), "the rating")
			await page.waitForTimeout(2600)
			await shot(page, `rate-${who}-${device}`)
			await page.keyboard.press("ArrowRight")
			await page.keyboard.press("Enter")
			await until(page, (x) => x.search.includes("tv=title") && x.labels.seen === "7 · Good", "rated")
			await shot(page, `title-rated-${who}-${device}`)
			await ctx.close()
		}

	// The Watch key: the TV's title screen, and the title page it opens, mid pulse.
	for (const [size, device] of [
		[DESKTOP, "desktop"],
		[PHONE, "phone"],
	]) {
		where = `shots the Watch key ${device}`
		console.log(where)
		const { ctx, page } = await openTitle(size, { services: String(own.id) })
		await shot(page, `watch-key-${device}`)
		await page.keyboard.press("Enter")
		await page.waitForSelector("#streaming", { timeout: 120000 })
		await sample(page, 8000, (x) => x.animation === "gw-watch-glow")
		// 60% into a pulse the ring is at its widest.
		await page.waitForTimeout(650)
		await page.screenshot({ path: join(dir, `watch-arrival-${device}.jpg`), quality: 82 })
		await sample(page, 8000, (x) => !x.glow)
		await page.screenshot({ path: join(dir, `watch-rest-${device}.jpg`), quality: 82 })
		await ctx.close()
	}
	{
		where = "shots the Watch key, reduced motion"
		const { ctx, page } = await openTitle(DESKTOP, { services: String(own.id), reducedMotion: "reduce" })
		await page.keyboard.press("Enter")
		await page.waitForSelector("#streaming", { timeout: 120000 })
		await sample(page, 4000, (x) => x.glow)
		await page.waitForTimeout(500)
		await page.screenshot({ path: join(dir, "watch-arrival-reduced-motion-desktop.jpg"), quality: 82 })
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
			pair("1920 x 1080, Tonight as a guest", "02-tonight-desktop", "tonight-guest-desktop", "slice 5: real data, the pool's best for a guest in the United States. The Expand key is slice 11's; its corner is kept free", 956),
			pair("A title", "10-title-desktop", "title-guest-desktop", "slice 5: real data, a guest with that service saved", 956),
			pair("The rating after Seen it", "11-rate-desktop", "rate-guest-desktop", "slice 5: the plain version behind the seam. The prototype's shot is the strip that is still being designed", 956),
			row(
				"A member (the harness's sample member, pictures painted in): Tonight's pick, the second pick, its title screen",
				[
					["tonight-member-desktop", "their next episode leads"],
					["tonight-member-second-desktop", "then their Wishlist"],
					["title-member-desktop", "the title screen (the harness has no session: the card is a guest's)"],
				],
				636,
			),
			row(
				"The keys say what is: on the Wishlist, rated",
				[
					["title-wishlist-guest-desktop", "Want to See, with the TV's toast"],
					["title-rated-guest-desktop", "after an answer: the score on the key"],
				],
				956,
			),
		].join(""),
	)
	await sheet(
		"phone-beside-prototype",
		1720,
		`<h2>390 x 844: the prototype (left of each pair) and slice 5 (right). Tonight, a title, the rating (the prototype's is the strip still being designed)</h2><div>${[
			["02-tonight-phone", "tonight-guest-phone"],
			["10-title-phone", "title-guest-phone"],
			["11-rate-phone", "rate-guest-phone"],
		]
			.map(([their, our]) => cell(theirs(their), "prototype", 270) + cell(ours(our), "slice 5", 270))
			.join("")}</div>${row(
			"A member on the phone: Tonight's pick, the second pick, its title, on the Wishlist, rated",
			[
				["tonight-member-phone", "next episode"],
				["tonight-member-second-phone", "from the Wishlist"],
				["title-member-phone", "the title"],
				["title-wishlist-member-phone", "on the Wishlist"],
				["title-rated-member-phone", "rated"],
			],
			270,
		)}`,
	)
	await sheet(
		"watch-key",
		1960,
		[
			row(
				"The Watch key at 1920 x 1080: the TV's title screen, the title's page at its streaming block mid pulse, and at rest four seconds later",
				[
					["watch-key-desktop", "Watch on the person's service"],
					["watch-arrival-desktop", "the Explorer tutorial's amber tint and ring, around the block"],
					["watch-rest-desktop", "after three pulses"],
				],
				636,
			),
			row(
				"With reduced motion: a still outline, no pulse. And on the phone",
				[
					["watch-arrival-reduced-motion-desktop", "reduced motion"],
					["watch-key-phone", "390 x 844", 270],
					["watch-arrival-phone", "mid pulse", 270],
					["watch-rest-phone", "at rest", 270],
				],
				636,
			),
		].join(""),
	)
}

// A dev server's first page load after a start reloads itself once Vite has optimized its dependencies, which
// would cut a walk short: load each page once before the real run, through every screen and the title page.
for (const url of [GUEST, MEMBER]) {
	where = "warming the dev server"
	const { ctx, page } = await open(url, DESKTOP)
	await page.keyboard.press("Enter")
	await page.waitForTimeout(4000)
	await page.keyboard.press("Enter")
	await page.waitForTimeout(4000)
	await page.keyboard.press("ArrowRight")
	await page.keyboard.press("ArrowRight")
	await page.keyboard.press("Enter")
	await page.waitForTimeout(4000)
	await ctx.close()
}
{
	const { ctx } = await open(`${ORIGIN}${MATRIX.path}`, DESKTOP, { room: false })
	await ctx.close()
}
passed = 0
failed.length = 0

const { own, pool } = await endpoint()
if (only !== "shots") {
	for (const size of [DESKTOP, PHONE]) await walk("guest", GUEST, size)
	for (const size of [DESKTOP, PHONE]) await walk("member", MEMBER, size)
	for (const size of [DESKTOP, PHONE]) await watch(size, own)
	await watchEdges(own, pool)
	await html()
	writeFileSync(join(here, "checks.json"), `${JSON.stringify({ passed, failed, numbers }, null, "\t")}\n`)
}
if (only !== "checks") await shots(own, pool)
await browser.close()
console.log(`${passed} checks passed, ${failed.length} failed`)
for (const line of failed) console.log(" -", line)
process.exit(failed.length ? 1 : 0)
