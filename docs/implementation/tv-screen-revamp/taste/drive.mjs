// Slice 8 of the new TV (mini Taste, the taste quiz and the rating strip): walks Taste, the quiz, a side's screen
// and the rating on /home-preview with the keyboard, both Remotes' keys and the pointer, as a guest on real data
// and as a member on the tracking harness; follows every score to where it is stored; measures every key on every
// phone of the room's table; and takes the screenshots in shots/ and the sheets beside the prototype's own.
//
//   PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs GUEST=http://localhost:3281 \
//   MEMBER=http://localhost:3282 node drive.mjs [checks|shots]
//
// PARTS=walk,sides,rate,member,sizes,html runs some of the checks.
//
// The repo has no browser driver: install playwright-core outside it. GUEST is a dev server of goodwatch-webapp
// that reads real data; MEMBER is one without any service, for the harness (see README.md here for both
// commands). PROTOTYPE= is the folder of the prototype's notes (docs/prototypes/tv-screen-design on
// prototype/tv-screen-flow), for the sheets.
//
// A score is a write, and none of this run's scores reaches a real account or database:
// - a guest's score goes to the browser's own storage, which is what the checks read;
// - the member is the harness's, who does not exist: their score goes through the app's own `updateScores` into
//   the memory of the dev server without services, and is read back from there;
// - every request to /api/update-* is stopped in the browser and counted, on both servers, and requests that
//   would leave the machine are stopped too.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const ORIGIN = process.env.GUEST ?? "http://localhost:3281"
const GUEST = `${ORIGIN}/home-preview`
const MEMBER_ORIGIN = process.env.MEMBER ?? "http://localhost:3282"
const SETUP = "member=six&seen=30&landed=none"
const MEMBER = `${MEMBER_ORIGIN}/prototype/my-library-real/tv?member=six&session=on`
const HARNESS_API = `${MEMBER_ORIGIN}/prototype/my-library-real/api`
const prototype = process.env.PROTOTYPE ?? "/home/alper/projects/goodwatch-monorepo-38caebf4/docs/prototypes/tv-screen-design"
const only = process.argv[2]
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")

const DESKTOP = [1920, 1080]
const PHONE = [390, 844]
const BAR = ["bar:back", "bar:search", "bar:menu"]
const LEVELS = ["level:3", "level:5", "level:7", "level:9"]
const SCORES = Array.from({ length: 10 }, (_, at) => `score:${at + 1}`)
/** The app's rating levels, as ui/taste-quiz/quiz-flow.ts lists them on the integration branch. */
const LEVEL = [
	{ name: "Bad", lo: 1, hi: 4, score: 3 },
	{ name: "Mediocre", lo: 5, hi: 6, score: 5 },
	{ name: "Good", lo: 7, hi: 8, score: 7 },
	{ name: "Excellent", lo: 9, hi: 10, score: 9 },
]
const SCORE_NAME = ["", "Unwatchable", "Terrible", "Bad", "Weak", "Mediocre", "Decent", "Good", "Great", "Excellent", "Masterpiece"]
const MATRIX = { key: "movie-603", name: "The Matrix" }
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

/** What a guest's browser holds: their country, and their scores when they have some. */
const t0 = Date.UTC(2026, 9, 1)
const scored = (rows) => JSON.stringify(rows.map(([media_type, tmdb_id, score], at) => ({ media_type, tmdb_id, type: "score", score, timestamp: t0 + at * 60000 })))
/** Eighteen scores in three kinds (crime, comedy, big ideas) and one dislike: enough loved titles for sides. */
const WITH_SIDES = {
	country: "US",
	// From a guest's tenth score the site's own notice about their progress stands over the room, until they
	// dismiss it. It is no part of the TV: here it is dismissed.
	guest_progress_reminder_dismissed: "yes",
	[PROGRESS_KEY]: scored([
		["show", 1396, 10], ["show", 60059, 9], ["show", 1398, 9], ["show", 1438, 10], ["show", 46648, 9], ["show", 67744, 8], ["show", 60622, 9],
		["show", 2316, 9], ["show", 8592, 9], ["show", 48891, 8], ["show", 97546, 9], ["movie", 346648, 9],
		["movie", 157336, 10], ["movie", 329865, 9], ["movie", 27205, 9], ["movie", 335984, 9], ["movie", 264660, 8],
		["movie", 19995, 4],
	]),
}
/** Five scores and nothing loved: a taste without sides, so Taste shows the quiz's picks. */
const WITH_PICKS = {
	country: "US",
	guest_progress_reminder_dismissed: "yes",
	[PROGRESS_KEY]: scored([["movie", 27205, 6], ["movie", 157336, 6], ["show", 1396, 5], ["movie", 19995, 5], ["show", 2316, 6]]),
}
const FRESH = { country: "US", guest_progress_reminder_dismissed: "yes" }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--use-angle=gl", "--ignore-gpu-blocklist"] })

/** Opens a page. A busy machine times a load out now and then: try again, twice. */
async function open(url, [width, height], { touch = width < 768, tries = 3, storage, before } = {}) {
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
		if (!["/api/smart-titles", "/api/taste/portrait", "/api/guest-recommendations", "/prototype/my-library-real/api"].includes(path)) return
		answers.push({ path, url: r.url(), status: r.status(), method: r.request().method(), body: r.request().postData(), json: await r.json().catch(() => null) })
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
	// A score, a skip, a Want to See or a watch on its way to a server's store: stopped here, and counted.
	const writes = []
	await page.route(/\/api\/update-[a-z-]+/, (route) => {
		const request = route.request()
		writes.push({ path: new URL(request.url()).pathname, method: request.method(), body: JSON.parse(request.postData() ?? "null") })
		return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success" }) })
	})
	await before?.(page)
	try {
		await page.goto(url, { waitUntil: "load", timeout: 180000 })
		await page.waitForSelector("#room:not([data-room=unmeasured]) [data-tv-item]", { timeout: 180000 })
		// The dev tools' round key is no part of the page.
		await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" })
		await page.waitForTimeout(600)
	} catch (error) {
		await ctx.close().catch(() => {})
		if (tries <= 1) throw error
		console.log("loading again:", String(error.message).split("\n")[0])
		await sleep(4000)
		return open(url, [width, height], { touch, tries: tries - 1, storage, before })
	}
	return { ctx, page, logs, requests, answers, left, writes }
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
		const place = top?.querySelector("[data-tv-expand-place]")
		const text = (selector) => top?.querySelector(selector)?.textContent ?? null
		// The bar is last in the markup, and a picture that takes another's place lies over it.
		const last = (selector) => (top ? [...top.querySelectorAll(selector)].at(-1) : undefined)
		return {
			search: location.search,
			path: location.pathname,
			room: true,
			edition: room.dataset.room,
			layers: layers.length,
			items: items.map(id),
			focus: items.filter((el) => el.getAttribute("aria-current")).map(id),
			labels: Object.fromEntries(items.map((el) => [id(el), el.textContent])),
			aria: Object.fromEntries(items.map((el) => [id(el), el.getAttribute("aria-label")])),
			name: last(".truncate.font-bold.leading-none")?.textContent ?? null,
			crumb: text(".mt-1\\.5.truncate.leading-tight"),
			// The rating screen: what stands over the question, the question, and the line under it.
			kicker: text(".uppercase.font-bold"),
			heading: text(".line-clamp-2.font-bold"),
			says: text('[class*="h-[40px]"], [class*="h-[24px]"]'),
			text: top?.innerText ?? "",
			toast: room.querySelector(".tvc-toast")?.textContent ?? null,
			history: history.length,
			expandPlace: place ? place.childElementCount : null,
			picture: last(":scope > .absolute.inset-0.overflow-hidden img")?.getAttribute("src") ?? null,
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
			check(false, `${what}: still ${JSON.stringify(now && { path: now.path, search: now.search, focus: now.focus, items: now.items, toast: now.toast, heading: now.heading, kicker: now.kicker, says: now.says, name: now.name })}`)
			return now ?? { items: [], focus: [], labels: {}, text: "" }
		}
		await page.waitForTimeout(60)
	}
}
/** Waits for something outside the TV's state. */
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
const item = (page, id) => page.locator(`#room [data-tv-layer] [data-tv-item="${id}"]`).last()
/** An item on the TV, pressed with the pointer or a finger. */
async function point(page, id, touch) {
	if (touch) await item(page, id).tap()
	else await item(page, id).click()
}

/** A guest's progress, as their browser holds it. */
const progress = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]").map(({ media_type, tmdb_id, type, score }) => ({ media_type, tmdb_id, type, ...(score ? { score } : {}) })), PROGRESS_KEY)
const tvKey = (title) => `${title.media_type}-${title.tmdb_id}`
/** The requests that would have left the machine, without the site's own telemetry. */
const beyondTelemetry = (left) => [...new Set(left.map((u) => new URL(u).hostname))].filter((host) => !/posthog|sentry|googletagmanager|google-analytics|cloudflareinsights/.test(host))
// What a dev server's console says on any page.
const noise = (logs) => logs.filter((l) => !l.includes("Future Flag") && !l.includes("net::ERR_FAILED") && !l.includes("503") && !l.includes("Failed to load resource") && !l.includes("Swiper Loop Warning"))
const json = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
const guestOf = (storage) => ({ interactions: JSON.parse(storage[PROGRESS_KEY] ?? "[]"), country: storage.country, services: null })

// ---------------------------------------------------------------------------------------------------------
// The walk: home, Taste, the quiz on the strip until its fifth score, what Taste then shows, and rating more.
// A guest on real data, on the desktop and on the phone.

async function walk(size) {
	const phone = size[0] < 768
	where = `guest ${size.join("x")}`
	console.log(where)
	const { ctx, page, logs, requests, answers, left, writes } = await open(GUEST, size, { storage: FRESH })
	const asked = (part) => requests.filter((r) => r.url.includes(part))
	const code = (name) => asked(`/tv/screens/${name}`)
	const strip = phone ? LEVELS : [...LEVELS, ...SCORES]
	const QUIZ = [...strip, "skip", ...BAR]
	/** The titles the quiz asks about, by name, from the page's own request. */
	const titles = () => new Map(answers.filter((a) => a.path === "/api/smart-titles").flatMap((a) => a.json?.smartTitles ?? []).map((t) => [t.title, t]))
	const portraits = () => answers.filter((a) => a.path === "/api/taste/portrait")

	// ---- Arrival: nothing of Taste or the quiz is asked for.
	let s = await read(page)
	is(s.focus, ["app:tonight"], "the focus starts on Tonight's tile")
	is(code("Taste").length + code("Quiz").length + asked("/tv/RatingStrip").length, 0, "Taste's, the quiz's and the strip's code are not in the first view")
	is(asked("/tv/use-tv-taste").length + asked("/taste-quiz/use-taste-quiz").length + asked("/tv/tv-taste.ts").length, 0, "nor is Taste's data hook, with the quiz's hook and its words")
	is(asked("/api/smart-titles").length + asked("/api/taste/portrait").length + asked("/api/guest-recommendations").length, 0, "no quiz title, no portrait and no pick is asked for on arrival")
	const history = s.history

	// ---- Home: the Taste tile. Its code is asked for while it has the focus.
	for (const tile of ["app:discover", "app:explorer", "app:taste"]) s = await key(page, "ArrowRight", tile)
	check(s.text.includes("Rate 5 titles, get picks made for you."), "home says what Taste is for a person without a taste")
	await eventually(page, () => code("Taste").length > 0, "Taste's code is asked for while its tile has the focus")
	is(code("Quiz").length, 0, "the quiz's code waits for Taste")
	await eventually(page, () => asked("/tv/use-tv-taste").length > 0, "Taste's data hook arrives with Taste's code")
	is(asked("/api/smart-titles").length + asked("/api/taste/portrait").length, 0, "its code alone asks for no data")

	// ---- Taste, before five scores.
	await page.keyboard.press("Enter")
	s = await until(page, screenIs("?tv=taste", "start-quiz", ["start-quiz", ...BAR]), "OK on the Taste tile opens Taste on the TV", 60000)
	is(s.history, history + 1, "opening Taste is one history entry")
	is(s.name, "Taste", "the bar says Taste")
	check(s.text.includes("Rate 5 titles you've seen.") && s.text.includes("0 of 5 rated. Then GoodWatch knows your taste."), `Taste says what to do and how far the person is: ${JSON.stringify(s.text.split("\n").slice(0, 2))}`)
	is(s.labels["start-quiz"], "Start rating", "its one key is the way into the quiz")
	is(s.expandPlace, 0, "the Expand key's place is kept, and empty until slice 11")
	await eventually(page, () => asked("/api/smart-titles").length > 0, "the titles to ask about are fetched while Taste offers only the quiz", 60000)
	await eventually(page, () => code("Quiz").length > 0, "the quiz's code is asked for on Taste")
	await eventually(page, () => asked("/tv/RatingStrip").length > 0, "and the strip's with it")
	await page.waitForTimeout(1500)
	is(portraits().length, 0, "a guest under five scores is not asked for a portrait: the answer would be the sample taste")
	is(asked("/api/guest-recommendations").length, 0, "and no pick is asked for")
	// The first title the quiz will ask about is Taste's picture.
	s = await until(page, (x) => Boolean(x.picture), "Taste's picture is the first title of the quiz", 60000)
	check(new RegExp(phone ? "/t/p/w780/" : "/t/p/w1280/").test(s.picture ?? ""), `in the size of the edition: ${s.picture}`)

	// ---- The quiz: one title on the strip.
	await page.keyboard.press("Enter")
	s = await until(page, screenIs("?tv=quiz", "level:7", QUIZ), "OK on Start rating opens the quiz, with the focus on Good", 60000)
	is(s.history, history + 2, "the quiz is one more history entry")
	is(s.kicker, "Taste · 0 of 5 rated", "the quiz says how far the person is")
	check(titles().has(s.heading), `it asks about one title of the list it fetched: ${s.heading}`)
	is(s.expandPlace, null, "the quiz has no Expand key")
	is(asked("/api/smart-titles").length, 1, "the titles were fetched once, on Taste")
	is(LEVELS.map((id) => s.aria[id]), LEVEL.map((l) => `${l.name}, ${l.score}`), "the levels are the app's, low on the left to high on the right")
	if (phone) {
		is(LEVELS.map((id) => s.labels[id]), LEVEL.map((l) => l.name), "the phone's levels say their names alone")
		is(s.items.filter((id) => id.startsWith("score:")), [], "the phone has no exact score")
		is(s.says, "Good · gives 7", "a line says what the focus would give")
	} else {
		is(LEVELS.map((id) => s.labels[id]), LEVEL.map((l) => `${l.name}${l.lo}–${l.hi}`), "each level says its name and the scores it spans")
		is(SCORES.map((id) => s.labels[id]), SCORES.map((id) => id.slice(6)), "under them the ten exact scores")
		is(SCORES.map((id) => s.aria[id]), SCORES.map((id) => `${id.slice(6)}, ${SCORE_NAME[id.slice(6)]}`), "each with the app's name for it")
		is(s.says, "Good · OK gives it 7", "a line says what the focus would give")
	}
	is(s.labels.skip, "Haven't seen it", "Haven't seen it is its own key")

	// ---- Where the keys of the strip are.
	const boxes = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#room [data-tv-layer] [data-tv-item]")].map((el) => [el.getAttribute("data-tv-item"), el.getBoundingClientRect().toJSON()])))
	const centre = (id) => boxes[id].left + boxes[id].width / 2
	check(LEVELS.every((id, n) => n === 0 || boxes[id].left > boxes[LEVELS[n - 1]].left) && LEVELS.every((id) => Math.abs(boxes[id].top - boxes["level:3"].top) < 12), "the four levels stand in one row, low to high")
	if (phone) {
		const widths = LEVELS.map((id) => Math.round(boxes[id].width))
		check(Math.max(...widths) - Math.min(...widths) <= 6, `as equal keys: ${widths.join(", ")} px wide`)
		check(boxes.skip.top > boxes["level:3"].bottom - 4, "Haven't seen it stands under them")
	} else {
		for (const level of LEVEL) {
			const span = SCORES.slice(level.lo - 1, level.hi)
			check(Math.abs(boxes[`level:${level.score}`].left - boxes[span[0]].left) < 12 && Math.abs(boxes[`level:${level.score}`].right - boxes[span.at(-1)].right) < 12, `${level.name} is as wide as its scores ${level.lo} to ${level.hi}`)
		}
		check(SCORES.every((id) => boxes[id].top > boxes["level:3"].bottom - 4) && SCORES.every((id, n) => n === 0 || centre(id) > centre(SCORES[n - 1])), "the ten scores stand in one row under the levels, low to high")
		check(boxes.skip.top > boxes["score:1"].bottom - 4, "Haven't seen it stands under the scores")
	}

	// ---- The focus on the strip.
	const next = "ArrowRight"
	const previous = "ArrowLeft"
	s = await key(page, next, "level:9")
	s = await key(page, next, "level:9", "Right of Excellent the focus stays")
	for (const level of ["level:7", "level:5", "level:3"]) s = await key(page, previous, level)
	s = await key(page, previous, "level:3", "Left of the first level the focus stays")
	is(s.says, phone ? "Bad · gives 3" : "Bad · OK gives it 3", "the line follows the focus")
	if (phone) {
		s = await key(page, "ArrowDown", "skip", "Down from a level reaches Haven't seen it")
		check(s.says?.endsWith("Have you seen it?"), `off the strip the line asks the quiz's question: ${s.says}`)
		await page.keyboard.press("ArrowUp")
		s = await until(page, (x) => x.focus[0]?.startsWith("level:"), "Up from Haven't seen it returns to the levels")
	} else {
		// Down from each level lands on its lowest exact score, and Up returns to the level.
		for (const level of LEVEL) {
			const id = `level:${level.score}`
			if ((await read(page)).focus[0] !== id) s = await key(page, next, id)
			s = await key(page, "ArrowDown", `score:${level.lo}`, `Down from ${level.name} lands on its lowest score, ${level.lo}`)
			is(s.says, `${level.lo} · ${SCORE_NAME[level.lo]}`, "the line names the exact score")
			s = await key(page, next, `score:${level.lo + 1}`, "Right moves along the scores")
			s = await key(page, "ArrowUp", id, `Up from ${level.lo + 1} returns to ${level.name}`)
		}
		// Along all ten, across the levels' edges.
		s = await key(page, "ArrowDown", "score:9")
		for (let score = 8; score >= 1; score--) s = await key(page, previous, `score:${score}`)
		s = await key(page, previous, "score:1", "Left of 1 the focus stays")
		s = await key(page, "ArrowDown", "skip", "Down again reaches Haven't seen it")
		check(s.says?.endsWith("Have you seen it?"), `off the strip the line asks the quiz's question: ${s.says}`)
		await page.keyboard.press("ArrowUp")
		s = await until(page, (x) => x.focus[0]?.startsWith("score:"), "Up from Haven't seen it returns to the scores")
		s = await key(page, "ArrowUp", "level:3", "and Up again to the level over that score")
	}
	await page.keyboard.press("ArrowUp")
	s = await until(page, (x) => x.focus[0]?.startsWith("bar:"), "Up from a level reaches the bar")
	await page.keyboard.press("ArrowDown")
	s = await until(page, (x) => x.focus[0]?.startsWith("level:"), "Down from the bar returns to the levels")
	while ((await read(page)).focus[0] !== "level:3") await page.keyboard.press(previous)
	is((await read(page)).history, history + 2, "no focus move added a history entry")
	is(await progress(page), [], "and none stored anything")

	// ---- A score: stored for the title on show, and the focus stays for the next title.
	const stored = []
	/** Presses `press` with the focus on `at`: the title on show gets `score`, and another title follows. */
	const rate = async (at, score, press, what) => {
		const before = await read(page)
		const title = titles().get(before.heading)
		await press()
		stored.push({ media_type: title?.media_type, tmdb_id: title?.tmdb_id, type: "score", score })
		const s = await until(page, (x) => x.search === "?tv=quiz" && x.heading !== before.heading && focusIs(at)(x) && x.kicker === `Taste · ${stored.length} of 5 rated`, `${what}: the next title, with the focus where it was`, 30000)
		is(await progress(page).then((all) => all.filter((i) => i.type === "score")), stored, `${what} stored ${score} for ${before.heading}, in the browser`)
		return s
	}
	s = await rate("level:3", 3, () => page.keyboard.press("Enter"), "OK on Bad")
	s = await key(page, next, "level:5")
	s = await rate("level:5", 5, () => page.keyboard.press("Enter"), "OK on Mediocre")
	// A reload in the middle of the quiz: it resumes from the browser's progress, with the focus it had.
	await page.reload({ waitUntil: "load" })
	await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" })
	s = await until(page, (x) => x.search === "?tv=quiz" && x.kicker === "Taste · 2 of 5 rated" && focusIs("level:5")(x) && same(x.items, QUIZ), "after a reload the quiz resumes: two scores, the strip, and the focus it had", 120000)
	check(!stored.some((one) => titles().get(s.heading)?.tmdb_id === one.tmdb_id), `and asks about a title that has no score yet: ${s.heading}`)
	s = await key(page, next, "level:7")
	// The Remote's OK key gives the level's score too.
	s = await rate("level:7", 7, () => remote(page, "OK", phone), "the Remote's OK on Good")
	await remote(page, "Next", phone)
	s = await until(page, focusIs("level:9"), "the Remote's arrow moves along the levels")

	// ---- Haven't seen it: the next title, no score, and the quiz goes on.
	let before = s
	await point(page, "skip", phone)
	s = await until(page, (x) => x.heading !== before.heading && focusIs("skip")(x) && x.kicker === "Taste · 3 of 5 rated", `${phone ? "a tap" : "a click"} on Haven't seen it shows the next title, and counts nothing`)
	let all = await progress(page)
	const skipped = titles().get(before.heading)
	is(all.at(-1), { media_type: skipped?.media_type, tmdb_id: skipped?.tmdb_id, type: "skip" }, `${before.heading} is passed in the browser's progress, without a score`)
	before = s
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.heading !== before.heading && focusIs("skip")(x), "OK again passes the next title: the focus stayed on the key")
	is((await progress(page)).filter((i) => i.type === "skip").length, 2, "two titles passed")
	is(s.search, "?tv=quiz", "passing never ends the quiz")

	// ---- The pointer and a finger: over a key gives it the focus, a click or a tap gives the score.
	if (phone) {
		s = await rate("level:9", 9, () => point(page, "level:9", true), "a tap on Excellent")
	} else {
		await item(page, "score:6").hover()
		s = await until(page, focusIs("score:6"), "the pointer over an exact score gives it the focus")
		is((await progress(page)).filter((i) => i.type === "score").length, 3, "and stores nothing")
		await item(page, "level:9").hover()
		s = await until(page, focusIs("level:9"), "the pointer over a level gives it the focus")
		s = await rate("level:9", 9, () => point(page, "level:9", false), "a click on Excellent")
	}
	is(writes, [], "none of the guest's four scores and two passes was sent to a server")

	// ---- The fifth score ends the quiz: Taste shows what the person's taste then is.
	before = s
	const last = titles().get(before.heading)
	if (phone) {
		await remote(page, "Previous", true)
		await until(page, focusIs("level:7"), "the Remote's arrow moves back to Good")
		await remote(page, "OK", true)
		stored.push({ media_type: last?.media_type, tmdb_id: last?.tmdb_id, type: "score", score: 7 })
	} else {
		// An exact score, with the keys: Down from Excellent is 9, Left is 8.
		s = await key(page, "ArrowDown", "score:9")
		s = await key(page, previous, "score:8")
		is(s.says, "8 · Great", "the line names the exact score")
		await page.keyboard.press("Enter")
		stored.push({ media_type: last?.media_type, tmdb_id: last?.tmdb_id, type: "score", score: 8 })
	}
	s = await until(page, (x) => x.search === "?tv=taste" && x.layers === 1, "the fifth score returns to Taste", 30000)
	is(s.history, history + 2, "by going back: the quiz's entry is not added to")
	is((await progress(page)).filter((i) => i.type === "score"), stored, `the fifth score is stored as given: ${JSON.stringify(stored.at(-1))}`)
	is(stored.map((one) => one.score), phone ? [3, 5, 7, 9, 7] : [3, 5, 7, 9, 8], "OK on the four levels stored 3, 5, 7 and 9")
	s = await until(page, (x) => x.search === "?tv=taste" && (x.crumb === "Made for you" || / sides? of you$/.test(x.crumb ?? "")), "Taste now shows the person's taste: their picks, or their sides", 120000)
	numbers[`${where}: after five scores Taste shows`] = s.crumb
	is(portraits().map((a) => [a.method, a.status]), [["POST", 200]], "now the portrait is asked for, once, with the guest's progress")
	const sent = JSON.parse(portraits()[0]?.body ?? "{}").guest
	is((sent?.interactions ?? []).filter((i) => i.type === "score").map((i) => i.score), stored.map((one) => one.score), "the request carries the five scores from the browser")
	const view = portraits()[0]?.json
	numbers[`${where}: the portrait after five scores`] = view && { status: view.status, subject: view.subject.kind, sides: view.sides.length }
	if (s.crumb === "Made for you") {
		s = await until(page, (x) => x.items.some((id) => id.startsWith("title:")), "the quiz's picks arrive", 120000)
		const picks = s.items.filter((id) => id.startsWith("title:"))
		check(picks.length >= 1 && picks.length <= 4, `up to four picks: ${picks.length}`)
		is(s.items, [...picks, "start-quiz", ...BAR], "the picks, then Rate more")
		// Back gives a screen its focus back: the key the person left Taste by, which now reads Rate more.
		is(s.focus, ["start-quiz"], "the focus is where it was when the person left for the quiz")
		check(s.text.startsWith(`${s.aria[picks[0]]}\n`), `the screen names its first pick: ${s.text.split("\n")[0]}`)
		const done = new Set((await progress(page)).map(tvKey))
		check(picks.every((id) => !done.has(id.slice(6))), "none of them is a title the person scored or passed")
		check(asked("/api/guest-recommendations").length >= 2, "they come from the recommendations for the person's scores, movies and shows")
		check(/ · \d+% match$/.test(s.text.split("\n")[1] ?? ""), `the focused pick says its match: ${s.text.split("\n")[1]}`)
	} else {
		is(s.items, [...(view?.sides ?? []).slice(0, 4).map((side) => `side:${side.id}`), "start-quiz", ...BAR], "the portrait's sides, then Rate more")
	}
	is(s.labels["start-quiz"], "Rate more", "the way back into the quiz says Rate more")
	is(s.expandPlace, 0, "the Expand key's place is kept, and empty until slice 11")

	// ---- Rating more: the quiz goes on past the goal, and Back returns.
	await point(page, "start-quiz", phone)
	s = await until(page, screenIs("?tv=quiz", "level:7", QUIZ), `${phone ? "a tap" : "a click"} on Rate more opens the quiz again`, 60000)
	is(s.kicker, "Taste · 5 rated", "past the goal the quiz says how many are rated")
	before = s
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.search === "?tv=quiz" && x.heading !== before.heading && x.kicker === "Taste · 6 rated" && focusIs("level:7")(x), "a sixth score does not end the quiz")
	// The same answer for the next title is one press: the focus stayed on Good.
	before = s
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.search === "?tv=quiz" && x.heading !== before.heading && x.kicker === "Taste · 7 rated" && focusIs("level:7")(x), "OK again gives the next title the same answer")
	is((await progress(page)).filter((i) => i.type === "score").slice(5).map((i) => i.score), [7, 7], "both are stored, as Good's score")
	await page.keyboard.press("Escape")
	s = await until(page, (x) => x.search === "?tv=taste" && focusIs("start-quiz")(x), "Back returns to Taste, with the focus on Rate more", 30000)

	// ---- Back, Forward and a reload.
	await page.goBack()
	s = await until(page, screenIs("", "app:taste"), "the browser's Back shows home with the focus on Taste's tile")
	await page.goForward()
	s = await until(page, (x) => x.search === "?tv=taste" && focusIs("start-quiz")(x), "the browser's Forward shows Taste with the focus it had", 60000)
	await page.reload({ waitUntil: "load" })
	await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" })
	s = await until(page, (x) => x.search === "?tv=taste" && focusIs("start-quiz")(x) && x.labels["start-quiz"] === "Rate more", "after a reload Taste is drawn from the browser's progress, with its focus", 120000)

	is(writes, [], "nothing of the whole walk was sent to a server's store")
	is(noise(logs), [], "nothing in the console")
	is(beyondTelemetry(left), [], "no request left the machine but the site's own telemetry, which was stopped")
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// The sides: a guest whose browser holds eighteen scores, on real data. Taste's tiles, a side's titles, a title.

async function sides(size) {
	const phone = size[0] < 768
	where = `sides ${size.join("x")}`
	console.log(where)
	const { ctx, page, logs, requests, answers, writes } = await open(`${GUEST}?tv=taste`, size, { storage: WITH_SIDES })
	const asked = (part) => requests.filter((r) => r.url.includes(part))
	let s = await until(page, (x) => / sides? of you$/.test(x.crumb ?? ""), "a link straight to Taste shows the sides of a guest with a taste", 120000)
	const portrait = answers.find((a) => a.path === "/api/taste/portrait")
	const view = portrait?.json
	is([portrait?.method, view?.status, view?.subject.kind], ["POST", "ready", "guest"], "the portrait is the guest's own, from their browser's progress")
	const shown = (view?.sides ?? []).slice(0, 4)
	check(shown.length >= 2 && shown.length <= 4, `there are two to four sides: ${shown.length}`)
	is(s.crumb, `${["", "One", "Two", "Three", "Four"][shown.length]} sides of you`, "the bar counts them")
	is(s.items, [...shown.map((side) => `side:${side.id}`), "start-quiz", ...BAR], "each side is a tile, then Rate more")
	is(s.focus, [`side:${shown[0].id}`], "the focus starts on the first side")
	check(shown.every((side) => s.labels[`side:${side.id}`].startsWith(side.name)), `each tile says its side's name: ${shown.map((side) => side.name).join(" / ")}`)
	is(asked("/api/smart-titles").length + asked("/api/guest-recommendations").length, 0, "looking at the sides asks for no quiz title and no pick")
	is(s.expandPlace, 0, "the Expand key's place is kept, and empty until slice 11")
	numbers[`${where}: the sides`] = shown.map((side) => side.name)
	// The picture follows the focused side.
	const first = s.picture
	s = await key(page, "ArrowRight", `side:${shown[1].id}`)
	s = await until(page, (x) => x.picture && x.picture !== first, "the picture follows the focus to the second side", 30000)
	s = await key(page, "ArrowDown", "start-quiz", "Down from the sides reaches Rate more")
	await page.keyboard.press("ArrowUp")
	s = await until(page, (x) => x.focus[0]?.startsWith("side:"), "Up returns to the sides")
	while ((await read(page)).focus[0] !== `side:${shown[0].id}`) await page.keyboard.press("ArrowLeft")

	// ---- A side: the titles of it the person rated.
	const side = shown[0]
	const here_ = side.here.map((k) => view.titles[k]).filter(Boolean).slice(0, 4)
	const sideAt = `?tv=taste&side=${side.id}`
	const titleIds = here_.map((t) => `title:${t.mediaType}-${t.tmdbId}`)
	await page.keyboard.press("Enter")
	s = await until(page, screenIs(sideAt, titleIds[0], [...titleIds, ...BAR]), "OK on a side opens its titles: up to four the person rated", 30000)
	is([s.name, s.crumb], ["Taste", side.name], "under the side's name")
	check(s.text.startsWith(`${here_[0].title}\n`) && s.text.includes(`You gave it ${here_[0].mine}`), `the focused title says its name and the person's score: ${JSON.stringify(s.text.split("\n").slice(0, 2))}`)
	is(s.expandPlace, 0, "the Expand key's place is kept, and empty until slice 11")
	if (titleIds.length > 1) {
		s = await key(page, "ArrowRight", titleIds[1])
		check(s.text.startsWith(`${here_[1].title}\n`), "the name follows the focus")
	}
	// A title of the list: named at once from what the list knew, then its card.
	const at = titleIds.length > 1 ? 1 : 0
	const cardsBefore = asked("/api/title-cards").length
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.search === `?tv=title&title=${titleIds[at].slice(6)}` && x.heading === here_[at].title, "OK on a title opens its screen, named from what the side's list knew", 60000)
	await eventually(page, () => asked("/api/title-cards").length === cardsBefore + 1, "its card is asked for once", 30000)
	s = await until(page, (x) => x.labels.seen === `${here_[at].mine} · ${SCORE_NAME[here_[at].mine]}`, "its Seen it key reads the score the person gave it", 60000)
	await page.keyboard.press("Escape")
	s = await until(page, screenIs(sideAt, titleIds[at], [...titleIds, ...BAR]), "Back returns to the side, with the focus on that title", 60000)
	await page.keyboard.press("Escape")
	s = await until(page, (x) => x.search === "?tv=taste" && focusIs(`side:${side.id}`)(x), "Back again returns to Taste, with the focus on that side", 60000)

	// ---- The Expand key's effect (the key itself is slice 11's): the Taste page.
	is(writes, [], "nothing was sent to a server's store")
	is(noise(logs), [], "nothing in the console")
	await page.goto(`${GUEST}?tv=taste&focus=expand`, { waitUntil: "load", timeout: 180000 })
	await page.waitForSelector("#room:not([data-room=unmeasured]) [data-tv-item]", { timeout: 180000 })
	await until(page, (x) => / sides? of you$/.test(x.crumb ?? ""), "Taste again, by a link that puts the focus on the Expand key", 120000)
	await page.keyboard.press("Enter")
	// The page changes under the script: a look that falls into the change is no answer yet.
	const landed = await eventually(page, () => page.evaluate(() => location.pathname === "/taste").catch(() => false), "OK on the Expand key opens the Taste page", 120000)
	if (landed) check(true, "the Expand key's effect opens the Taste page")
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// The rating after Seen it: the same strip, for a title. A guest on real data.

async function rating(size) {
	const phone = size[0] < 768
	where = `rate ${size.join("x")}`
	console.log(where)
	const titleAt = `?tv=title&title=${MATRIX.key}`
	const rateAt = `?tv=rate&title=${MATRIX.key}`
	const strip = phone ? LEVELS : [...LEVELS, ...SCORES]
	const { ctx, page, logs, writes } = await open(`${GUEST}${titleAt}`, size, { storage: FRESH })
	let s = await until(page, (x) => x.heading === MATRIX.name && x.items.includes("seen"), "the title screen", 90000)
	await point(page, "seen", phone)
	s = await until(page, screenIs(rateAt, "level:7", [...strip, ...BAR]), "Seen it opens the rating: the strip, without Haven't seen it, with the focus on Good", 60000)
	is([s.kicker, s.heading], ["Seen it", `How was ${MATRIX.name}?`], "it asks how the title was")
	is(s.says, phone ? "Good · gives 7" : "Good · OK gives it 7", "and says what the focus would give")
	is(s.expandPlace, null, "the rating has no Expand key")
	if (phone) {
		is(s.items.filter((id) => id.startsWith("score:")), [], "the phone has no exact score")
		s = await key(page, "ArrowRight", "level:9")
		await page.keyboard.press("ArrowDown")
		await page.waitForTimeout(400)
		is((await read(page)).focus, ["level:9"], "a rating has nothing under the levels: Down stays")
		await page.keyboard.press("Enter")
		s = await until(page, (x) => x.search === titleAt && x.labels.seen === "9 · Excellent", "OK on Excellent stores 9 and returns to the title, whose key reads it", 30000)
		is(s.toast, "Rated 9 · Excellent", "the TV says what was stored")
	} else {
		s = await key(page, "ArrowDown", "score:7", "Down from Good lands on 7")
		s = await key(page, "ArrowRight", "score:8")
		is(s.says, "8 · Great", "the line names the exact score")
		await page.keyboard.press("ArrowDown")
		await page.waitForTimeout(400)
		is((await read(page)).focus, ["score:8"], "a rating has nothing under the scores: Down stays")
		await page.keyboard.press("Enter")
		s = await until(page, (x) => x.search === titleAt && x.labels.seen === "8 · Great", "OK on 8 stores the exact score and returns to the title, whose key reads it", 30000)
		is(s.toast, "Rated 8 · Great", "the TV says what was stored")
	}
	const given = phone ? 9 : 8
	is(s.focus, ["seen"], "with the focus on the key")
	is(await progress(page), [{ media_type: "movie", tmdb_id: 603, type: "score", score: given }], "the score is in the browser's progress, as given")
	// Rating again: the strip marks the score the title has.
	await page.keyboard.press("Enter")
	s = await until(page, screenIs(rateAt, "level:7", [...strip, ...BAR]), "Seen it again opens the rating", 60000)
	const marks = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#room [data-tv-layer] [data-tv-item]")].map((el) => [el.getAttribute("data-tv-item"), el.style.boxShadow])))
	const marked = Object.entries(marks).filter(([, shadow]) => shadow.includes("inset")).map(([id]) => id)
	is(marked, phone ? ["level:9"] : ["score:8"], "the score the title has is marked on the strip (its level too, once the focus is elsewhere)")
	// A level, with the pointer or a finger.
	await point(page, "level:5", phone)
	s = await until(page, (x) => x.search === titleAt && x.labels.seen === "5 · Mediocre", `${phone ? "a tap" : "a click"} on Mediocre changes the score to 5`, 30000)
	is(await progress(page), [{ media_type: "movie", tmdb_id: 603, type: "score", score: 5 }], "one score for the title, the last one")
	// Back from the rating changes nothing.
	await page.keyboard.press("Enter")
	await until(page, screenIs(rateAt, "level:7", [...strip, ...BAR]), "the rating once more", 60000)
	await page.keyboard.press("Escape")
	s = await until(page, (x) => x.search === titleAt && x.labels.seen === "5 · Mediocre", "Back from the rating returns to the title with nothing changed", 30000)
	is(writes, [], "a guest's rating was sent to no server")
	is(noise(logs), [], "nothing in the console")
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// A member, on the harness: the sample member's session, the TV's own reads stood in for from real answers, and
// their scores written through the app's own `updateScores` into the dev server's memory.

/** Real answers of the guest server, to stand in for what a server without services cannot answer. */
async function fixtures() {
	const quiz = await (await fetch(`${ORIGIN}/api/smart-titles?count=20`)).json()
	const portrait = await (await fetch(`${ORIGIN}/api/taste/portrait?tab=sides`, json({ guest: guestOf(WITH_SIDES) }))).json()
	// The portrait of eighteen sample scores, as a member's.
	return { quiz, portrait: { ...portrait, subject: { ...portrait.subject, kind: "member" } } }
}
const standIn = (stock) => async (page) => {
	await page.route("**/api/smart-titles*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(stock.quiz) }))
	await page.route("**/api/taste/portrait*", (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "Cache-Control": "private, no-store" }, body: JSON.stringify(stock.portrait) }))
	await page.route("**/api/guest-recommendations*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ recommendations: [] }) }))
}
const memberData = async () => (await fetch(`${HARNESS_API}?what=user-data&${SETUP}`)).json()

async function member(size, stock) {
	const phone = size[0] < 768
	where = `member ${size.join("x")}`
	console.log(where)
	// The sample member starts over, so a run before this one left nothing.
	const { ctx, page, logs, requests, answers, writes, left } = await open(`${MEMBER}&reset=1&tv=taste`, size, { before: standIn(stock) })
	const asked = (part) => requests.filter((r) => r.url.includes(part))
	const at = (tv) => `?member=six&session=on&reset=1${tv ? `&${tv}` : ""}`
	const strip = phone ? LEVELS : [...LEVELS, ...SCORES]
	const QUIZ = [...strip, "skip", ...BAR]
	const harness = () => answers.filter((a) => a.path === "/prototype/my-library-real/api")
	const rates = () => harness().filter((a) => a.url.includes("what=rate"))
	const start = await memberData()
	const had = Object.keys(start.scores).length
	check(had >= 5, `the sample member has scores on their account: ${had}`)

	// ---- Taste: the member's sides.
	const shown = stock.portrait.sides.slice(0, 4)
	let s = await until(page, (x) => / sides? of you$/.test(x.crumb ?? "") && x.items.includes("start-quiz"), "a member's Taste shows their sides", 120000)
	is(s.items, [...shown.map((side) => `side:${side.id}`), "start-quiz", ...BAR], "each side, then Rate more")
	const portrait = requests.filter((r) => r.url.includes("/api/taste/portrait"))
	is(portrait.map((r) => [r.method, r.body]), [["GET", null]], "a member's portrait is asked for with GET, once, with nothing of a guest's progress")
	check(harness().some((a) => a.url.includes("what=user-data") && a.status === 200), "the member's marks are read from their account (the harness's)")
	is(asked("/api/smart-titles").length, 0, "looking at the sides asks for no quiz title")

	// ---- The quiz: a member's score goes to their account.
	s = await key(page, "ArrowDown", "start-quiz")
	await page.keyboard.press("Enter")
	s = await until(page, screenIs(at("tv=quiz"), "level:7", QUIZ), "Rate more opens the quiz", 60000)
	is(s.kicker, `Taste · ${had} rated`, "the quiz counts the scores on the member's account")
	const byName = new Map(stock.quiz.smartTitles.map((t) => [t.title, t]))
	const scores = []
	const rate = async (focus, score, press, what) => {
		const before = await read(page)
		const title = byName.get(before.heading)
		const sentBefore = rates().length
		await press()
		scores.push({ key: tvKey(title), score })
		await until(page, (x) => x.heading !== before.heading && focusIs(focus)(x) && x.kicker === `Taste · ${had + scores.length} rated`, `${what}: the next title, the focus where it was, one more score counted`, 30000)
		const sent = await eventually(page, () => rates()[sentBefore], `${what}: the score is sent`, 30000)
		is([sent?.method, JSON.parse(sent?.body ?? "null")], ["POST", { tmdb_id: title.tmdb_id, media_type: title.media_type, score, by_hand: false }], `${what} sends ${score} for ${before.heading}, as a quiz's score`)
		is([sent?.status, sent?.json?.status], [200, "success"], "and the app's own updateScores stored it")
		const now = await memberData()
		is(now.scores[tvKey(title)]?.score, score, `read back from the member's account: ${before.heading} has ${score}`)
	}
	await rate("level:7", 7, () => page.keyboard.press("Enter"), "OK on Good")
	if (phone) {
		await key(page, "ArrowLeft", "level:5")
		await rate("level:5", 5, () => remote(page, "OK", true), "the Remote's OK on Mediocre")
		await rate("level:9", 9, () => point(page, "level:9", true), "a tap on Excellent")
	} else {
		await key(page, "ArrowDown", "score:7")
		await key(page, "ArrowRight", "score:8")
		await rate("score:8", 8, () => page.keyboard.press("Enter"), "OK on the exact score 8")
		await rate("score:2", 2, () => point(page, "score:2", false), "a click on the exact score 2")
	}
	is((await read(page)).search, at("tv=quiz"), "a member with a taste goes on rating: the quiz does not end")
	// Haven't seen it: a member's pass is a request too. No server here knows it: it is stopped and read.
	const before = await read(page)
	const passed_ = byName.get(before.heading)
	await point(page, "skip", phone)
	await until(page, (x) => x.heading !== before.heading && focusIs("skip")(x) && x.kicker === `Taste · ${had + scores.length} rated`, "Haven't seen it shows the next title and counts nothing", 30000)
	is(writes, [{ path: "/api/update-skipped", method: "POST", body: { tmdb_id: passed_.tmdb_id, media_type: passed_.media_type, action: "add" } }], `the pass of ${before.heading} is the one request to /api/update-*, stopped in the browser`)
	const end = await memberData()
	is(Object.keys(end.scores).length, had + scores.length, `the member's account has ${scores.length} scores more, and nothing else changed`)
	is(scores.map((one) => end.scores[one.key]?.score), scores.map((one) => one.score), "each as it was given")
	is(await progress(page), [], "nothing of a member's scores is kept as a guest's progress in the browser")

	// ---- Back to Taste: the portrait is read again, for the member who has scored.
	await page.keyboard.press("Escape")
	s = await until(page, (x) => x.search === at("tv=taste") && focusIs("start-quiz")(x), "Back returns to Taste", 30000)
	await eventually(page, () => requests.filter((r) => r.url.includes("/api/taste/portrait")).length === 2, "the member's portrait is asked for again after their scores", 30000)

	// ---- The rating after Seen it, for a member: the same strip, the same account. A title of the harness's own
	// catalog (the quiz's titles above are real ones, which it lacks): a movie of the member's Tonight.
	const loaded = await page.evaluate(() => Object.values(window.__remixContext.state.loaderData).find((data) => data && Array.isArray(data.tonight)))
	const rated = (loaded?.tonight ?? []).map((pick) => pick.card).find((card) => card.media_type === "movie" && !(tvKey(card) in start.scores))
	check(Boolean(rated), `the member's Tonight has a movie without a score: ${rated?.title}`)
	if (!rated) return ctx.close()
	await page.goto(`${MEMBER}&tv=rate&title=${tvKey(rated)}`, { waitUntil: "load", timeout: 180000 })
	await page.waitForSelector("#room:not([data-room=unmeasured]) [data-tv-item]", { timeout: 180000 })
	s = await until(page, (x) => x.search.includes("tv=rate") && focusIs("level:7")(x) && same(x.items, [...strip, ...BAR]) && x.heading === `How was ${rated.title}?`, "a link straight to a title's rating shows the strip", 90000)
	const sentBefore = rates().length
	await key(page, "ArrowRight", "level:9")
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.search.includes("tv=title") && x.toast === "Rated 9 · Excellent", "OK on Excellent rates the title and returns to it", 30000)
	const sent = await eventually(page, () => rates()[sentBefore], "the rating is sent", 30000)
	is(JSON.parse(sent?.body ?? "null"), { tmdb_id: rated.tmdb_id, media_type: rated.media_type, score: 9 }, "as a score given by hand")
	is((await memberData()).scores[tvKey(rated)]?.score, 9, "and read back from the member's account")

	is(noise(logs).filter((l) => !l.includes("title-cards")), [], "nothing in the console")
	is(beyondTelemetry(left), [], "no request left the machine but the site's own telemetry, which was stopped")
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// What is where on the TV: every key's box and the Expand key's corner, on every phone of the room's table.

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
		const heading = layer.querySelector(".line-clamp-2.font-bold")
		return {
			k,
			tv: { left: tv.left, top: tv.top, right: tv.right, bottom: tv.bottom },
			items: [...layer.querySelectorAll("[data-tv-item]")].map((el) => ({
				id: el.getAttribute("data-tv-item"),
				...rest(el),
				// What a key says is cut short where it does not fit.
				cut: [...el.querySelectorAll(".truncate")].some((text) => text.scrollWidth > text.clientWidth + 1) || el.scrollWidth > el.clientWidth + 1,
			})),
			// A box that cuts off what does not fit (the Frame's content on the phone) holds more than it shows.
			clipped: [...layer.querySelectorAll(".overflow-hidden")].filter((el) => !el.hasAttribute("data-tv-row") && !el.hasAttribute("data-tv-item") && el.scrollHeight > el.clientHeight + 1).length,
			heading: heading ? rest(heading) : null,
			place: place ? rest(place) : null,
		}
	})

const meet = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5
const within = (a, b) => a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5

/** A screen holds what it shows: touch targets, nothing over anything, nothing cut off, the corner free. */
function fits(l, what, { touch = false } = {}) {
	const small = l.items.filter((one) => Math.min(one.width, one.height) < 44 - 0.05)
	if (touch) check(small.length === 0, `${what}: every key is 44 px or more on the phone's screen: ${small.map((one) => `${one.id} ${one.width.toFixed(1)} x ${one.height.toFixed(1)}`).join(", ") || "all"}`)
	const out = l.items.filter((one) => !within(one, l.tv))
	check(out.length === 0, `${what}: every key is inside the picture: ${out.map((one) => one.id).join(", ") || "all"}`)
	const over = l.items.flatMap((a, n) => l.items.slice(n + 1).filter((b) => meet(a, b)).map((b) => `${a.id} and ${b.id}`))
	check(over.length === 0, `${what}: no key lies over another: ${over.join(", ") || "none"}`)
	check(l.clipped === 0, `${what}: nothing is cut off by its box`)
	const cut = l.items.filter((one) => one.cut)
	check(cut.length === 0, `${what}: every key says its words in full: ${cut.map((one) => one.id).join(", ") || "all"}`)
	if (l.heading) check(within(l.heading, l.tv) && !l.items.some((one) => meet(one, l.heading)), `${what}: its large line is inside the picture and under no key`)
	if (l.place) {
		// The Expand key's cell: 158 canvas px wide on the phone, 220 on the desktop, as tall as a key.
		const size = touch ? [158, 54] : [220, 64]
		const corner = { right: l.place.right, bottom: l.place.bottom, left: l.place.right - size[0] * l.k, top: l.place.bottom - Math.max(size[1] * l.k, touch ? 44 : 0) }
		const inCorner = l.items.filter((one) => meet(one, corner))
		check(inCorner.length === 0, `${what}: the Expand key's corner is free: ${inCorner.map((one) => one.id).join(", ") || "free"}`)
	}
	return Math.min(...l.items.map((one) => Math.min(one.width, one.height)))
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
/** A long name, for the worst case of a rating's question. */
const LONG = "movie-120"

async function sizes() {
	for (const size of [...PHONES, DESKTOP]) {
		const touch = size !== DESKTOP
		where = `sizes ${size.join("x")}`
		console.log(where)
		const smallest = {}
		const strip = touch ? LEVELS : [...LEVELS, ...SCORES]

		// A guest without scores: Taste before the quiz, and the quiz.
		let { ctx, page } = await open(`${GUEST}?tv=taste`, size, { touch, storage: FRESH })
		await until(page, (x) => x.items.includes("start-quiz") && Boolean(x.picture), "Taste before five scores", 120000)
		smallest["Taste, before five scores"] = fits(await layout(page), "Taste before five scores", { touch })
		numbers[`${where}: the room`] = await page.evaluate(() => {
			const room = document.getElementById("room")
			return [room.dataset.room, room.dataset.remotePlace].filter(Boolean).join(", ")
		})
		await page.keyboard.press("Enter")
		let s = await until(page, (x) => x.search === "?tv=quiz" && same(x.items, [...strip, "skip", ...BAR]), `the quiz: ${touch ? "four levels and no exact score" : "four levels and ten exact scores"}`, 90000)
		smallest["the quiz"] = fits(await layout(page), "the quiz", { touch })
		if (touch) {
			const l = await layout(page)
			const levels = l.items.filter((one) => one.id.startsWith("level:"))
			numbers[`${where}: a level of the strip`] = `${levels[0].width.toFixed(1)} x ${levels[0].height.toFixed(1)} px`
			check(levels.length === 4 && levels.every((one) => Math.abs(one.top - levels[0].top) < 1), "the four levels stand in one row")
		}
		// The rating of a title with a name of two lines.
		await page.goto(`${GUEST}?tv=rate&title=${LONG}`, { waitUntil: "load", timeout: 180000 })
		await page.waitForSelector("#room:not([data-room=unmeasured]) [data-tv-item]", { timeout: 180000 })
		s = await until(page, (x) => same(x.items, [...strip, ...BAR]) && x.heading?.startsWith("How was The Lord"), "the rating of a title with a long name", 120000)
		smallest["the rating"] = fits(await layout(page), "the rating, a name of two lines", { touch })
		await ctx.close()

		// A guest with a taste: the sides, and a side's titles.
		;({ ctx, page } = await open(`${GUEST}?tv=taste`, size, { touch, storage: WITH_SIDES }))
		s = await until(page, (x) => / sides? of you$/.test(x.crumb ?? "") && Boolean(x.picture), "the sides", 120000)
		smallest["Taste, the sides"] = fits(await layout(page), `Taste with ${s.items.filter((id) => id.startsWith("side:")).length} sides`, { touch })
		await page.keyboard.press("Enter")
		s = await until(page, (x) => x.search.includes("side=") && x.items.some((id) => id.startsWith("title:")) && Boolean(x.picture), "a side's titles", 60000)
		await page.waitForTimeout(500)
		smallest["a side's titles"] = fits(await layout(page), `a side with ${s.items.filter((id) => id.startsWith("title:")).length} titles`, { touch })
		await ctx.close()

		// A guest with five scores and no sides: the quiz's picks.
		;({ ctx, page } = await open(`${GUEST}?tv=taste`, size, { touch, storage: WITH_PICKS }))
		s = await until(page, (x) => x.crumb === "Made for you" && x.items.some((id) => id.startsWith("title:")) && Boolean(x.picture), "Made for you", 180000)
		await page.waitForTimeout(500)
		smallest["Made for you"] = fits(await layout(page), `Made for you with ${s.items.filter((id) => id.startsWith("title:")).length} picks`, { touch })
		await ctx.close()
		numbers[`${where}: the smallest key, px`] = Object.fromEntries(Object.entries(smallest).map(([screen, px]) => [screen, Number(px.toFixed(1))]))
	}
}

// ---------------------------------------------------------------------------------------------------------
// The server's HTML.

async function html() {
	where = "the server's HTML"
	console.log(where)
	const get = async (url, agent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36") => (await fetch(url, { headers: { "User-Agent": agent, "Accept-Language": "en-US" } })).text()
	const ids = (text) => [...text.matchAll(/data-tv-item="([^"]+)"/g)].map((m) => m[1])
	for (const [what, query] of [
		["Taste", "?tv=taste"],
		["a side", "?tv=taste&side=side-1"],
		["the quiz", "?tv=quiz"],
	]) {
		const page = await get(`${GUEST}${query}`)
		const room = page.slice(0, page.indexOf('<section id="browse"'))
		is(ids(room), [...BAR, ...BAR], `a link straight to ${what}: the server draws the bar alone, once per edition`)
		check(!room.includes("Rate 5 titles") && !room.includes("sides of you") && !room.includes("Haven't seen it") && !room.includes("Haven&#x27;t seen it"), `nothing of ${what} is in a guest's HTML, which is the same for every guest`)
		const phone = await get(`${GUEST}${query}`, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1")
		// The dev server writes a nonce and a time into each answer: the room's markup is what is compared.
		is(phone.slice(0, phone.indexOf('<section id="browse"')).replace(/nonce="[^"]*"/g, "").length, room.replace(/nonce="[^"]*"/g, "").length, `and as long for a phone as for a desktop browser`)
	}
	const home = await get(GUEST)
	numbers["the guest's HTML of /home-preview, bytes (dev server)"] = Buffer.byteLength(home)
	check(!home.includes("tvc-lvl") && !home.includes("Rate 5 titles you"), "home's HTML has nothing of the strip or of Taste's screens")
}

// ---------------------------------------------------------------------------------------------------------
// Screenshots, and the sheets beside the prototype's.

async function shots(stock) {
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
	for (const [size, device] of [
		[DESKTOP, "desktop"],
		[PHONE, "phone"],
	]) {
		const phone = device === "phone"
		where = `shots guest ${device}`
		console.log(where)
		// A guest without scores: Taste, the quiz, the quiz on another level and on an exact score.
		let { ctx, page } = await open(`${GUEST}?tv=taste`, size, { storage: FRESH })
		await until(page, (x) => x.items.includes("start-quiz") && Boolean(x.picture), "Taste", 120000)
		await shot(page, `taste-start-guest-${device}`)
		await page.keyboard.press("Enter")
		await until(page, (x) => x.search === "?tv=quiz" && focusIs("level:7")(x), "the quiz", 90000)
		await shot(page, `quiz-guest-${device}`)
		if (phone) {
			await page.keyboard.press("ArrowRight")
			await until(page, focusIs("level:9"), "Excellent")
			await shot(page, `quiz-level-guest-${device}`)
			await page.keyboard.press("ArrowDown")
			await until(page, focusIs("skip"), "Haven't seen it")
			await shot(page, `quiz-skip-guest-${device}`)
		} else {
			await page.keyboard.press("ArrowDown")
			await page.keyboard.press("ArrowRight")
			await until(page, focusIs("score:8"), "8")
			await shot(page, `quiz-exact-guest-${device}`)
			await page.keyboard.press("ArrowDown")
			await until(page, focusIs("skip"), "Haven't seen it")
			await shot(page, `quiz-skip-guest-${device}`)
		}
		// Two scores in, the quiz counts them.
		await page.keyboard.press("ArrowUp")
		await page.keyboard.press("Enter")
		await page.waitForTimeout(1500)
		await page.keyboard.press("Enter")
		await until(page, (x) => x.kicker === "Taste · 2 of 5 rated", "two scores", 30000)
		await page.keyboard.press("Escape")
		await until(page, (x) => x.search === "?tv=taste" && x.labels["start-quiz"] === "Keep rating", "Taste, two scores in", 30000)
		await shot(page, `taste-started-guest-${device}`)
		// The rating after Seen it, and the title once it is rated.
		await page.goto(`${GUEST}?tv=rate&title=${MATRIX.key}`, { waitUntil: "load", timeout: 180000 })
		await page.waitForSelector("#room:not([data-room=unmeasured]) [data-tv-item]", { timeout: 180000 })
		await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" })
		await until(page, (x) => x.heading === `How was ${MATRIX.name}?` && focusIs("level:7")(x), "the rating", 120000)
		await shot(page, `rate-guest-${device}`)
		if (!phone) {
			await page.keyboard.press("ArrowDown")
			await page.keyboard.press("ArrowRight")
			await until(page, focusIs("score:8"), "8")
			await shot(page, `rate-exact-guest-${device}`)
		}
		await page.keyboard.press("Enter")
		await until(page, (x) => x.search.includes("tv=title") && /^\d+ · /.test(x.labels.seen ?? ""), "rated", 60000)
		await shot(page, `title-rated-guest-${device}`)
		await page.waitForTimeout(2600)
		// The rating was opened by its link, so the title took its place with the focus on its first key.
		await point(page, "seen", phone)
		await until(page, (x) => x.search.includes("tv=rate") && focusIs("level:7")(x), "the rating again", 60000)
		// With the focus on the bar, the level of the score the title has shows its mark.
		await page.keyboard.press("ArrowUp")
		await until(page, (x) => x.focus[0]?.startsWith("bar:"), "the focus on the bar")
		await shot(page, `rate-again-guest-${device}`)
		await ctx.close()

		// A guest with a taste, on real data: the sides, and a side.
		;({ ctx, page } = await open(`${GUEST}?tv=taste`, size, { storage: WITH_SIDES }))
		await until(page, (x) => / sides? of you$/.test(x.crumb ?? "") && Boolean(x.picture), "the sides", 120000)
		await shot(page, `taste-sides-guest-${device}`)
		await page.keyboard.press("ArrowRight")
		await page.keyboard.press("Enter")
		await until(page, (x) => x.search.includes("side=") && x.items.some((id) => id.startsWith("title:")), "a side", 60000)
		await shot(page, `side-guest-${device}`)
		await ctx.close()

		// A guest with five scores and no sides: Made for you.
		;({ ctx, page } = await open(`${GUEST}?tv=taste`, size, { storage: WITH_PICKS }))
		await until(page, (x) => x.crumb === "Made for you" && x.items.some((id) => id.startsWith("title:")) && Boolean(x.picture), "Made for you", 180000)
		await shot(page, `taste-picks-guest-${device}`)
		await ctx.close()

		// A member, on the harness.
		where = `shots member ${device}`
		console.log(where)
		;({ ctx, page } = await open(`${MEMBER}&reset=1&tv=taste`, size, { before: standIn(stock) }))
		await until(page, (x) => / sides? of you$/.test(x.crumb ?? "") && Boolean(x.picture), "a member's sides", 120000)
		await shot(page, `taste-sides-member-${device}`)
		await page.keyboard.press("Enter")
		await until(page, (x) => x.search.includes("side=") && x.items.some((id) => id.startsWith("title:")), "a member's side", 60000)
		await shot(page, `side-member-${device}`)
		await page.keyboard.press("Escape")
		await until(page, (x) => !x.search.includes("side=") && x.items.includes("start-quiz"), "Taste", 30000)
		await page.keyboard.press("ArrowDown")
		await page.keyboard.press("Enter")
		await until(page, (x) => x.search.includes("tv=quiz") && focusIs("level:7")(x), "a member's quiz", 60000)
		await shot(page, `quiz-member-${device}`)
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
			pair("1920 x 1080, Taste before a taste, as a guest", "08-taste-start-desktop", "taste-start-guest-desktop", "slice 8: real data; the picture is the first title the quiz will ask about. The Expand key is slice 11's; its corner is kept free", 956),
			pair("The quiz on the rating strip", "09-quiz-desktop", "quiz-guest-desktop", "slice 8: real data. The levels' names are the app's of today: Bad, Mediocre, Good, Excellent", 956),
			pair("The quiz on an exact score", "26-quiz-exact-score-desktop", "quiz-exact-guest-desktop", "slice 8: Down from Good lands on 7; here one to the right", 956),
			pair("The rating after Seen it: the same strip", "11-rate-desktop", "rate-guest-desktop", "slice 8: the strip replaces slice 5's four plain answers", 956),
			pair("Taste with a taste, as a member", "17-taste-sides-desktop", "taste-sides-member-desktop", "slice 8: the harness's sample member; the sides are the real portrait of eighteen sample scores, and there are as many as the portrait has", 956),
			pair("A side", "18-side-desktop", "side-member-desktop", "slice 8: the titles of the side the person rated, up to four, each with their score", 956),
			row(
				"The same two as a guest whose browser holds those eighteen scores, on real data; and the third state, five scores and no sides yet",
				[
					["taste-sides-guest-desktop", "a guest's sides"],
					["side-guest-desktop", "a guest's side"],
					["taste-picks-guest-desktop", "Made for you: the quiz's picks, with Rate more"],
				],
				636,
			),
			row(
				"The strip: Haven't seen it, an exact score for a title, the title's key after it, and rating again with the score marked",
				[
					["quiz-skip-guest-desktop", "Haven't seen it, its own key under the strip"],
					["rate-exact-guest-desktop", "an exact score for a title"],
					["title-rated-guest-desktop", "the Seen it key reads the score"],
					["rate-again-guest-desktop", "rating again: the 8 and its level are marked"],
					["taste-started-guest-desktop", "Taste two scores in"],
					["quiz-member-desktop", "a member's quiz counts their account's scores"],
				],
				636,
			),
		].join(""),
	)
	await sheet(
		"phone-beside-prototype",
		1720,
		`<h2>390 x 844: the prototype (left of each pair) and slice 8 (right). Taste before a taste, the quiz, the rating, the sides, a side. On the phone the strip is the four levels alone (the owner's decision after the prototype, which had the ten scores in two rows)</h2><div>${[
			["08-taste-start-phone", "taste-start-guest-phone"],
			["09-quiz-phone", "quiz-guest-phone"],
			["11-rate-phone", "rate-guest-phone"],
			["17-taste-sides-phone", "taste-sides-member-phone"],
			["18-side-phone", "side-member-phone"],
		]
			.map(([their, our]) => cell(theirs(their), "prototype", 270) + cell(ours(our), "slice 8", 270))
			.join("")}</div>${row(
			"More of the phone: another level, Haven't seen it, the title after a rating, rating again, Taste two scores in, a guest's sides and side on real data, Made for you, a member's quiz",
			[
				["quiz-level-guest-phone", "Excellent"],
				["quiz-skip-guest-phone", "Haven't seen it"],
				["title-rated-guest-phone", "rated"],
				["rate-again-guest-phone", "rating again"],
				["taste-started-guest-phone", "two scores in"],
				["taste-sides-guest-phone", "a guest's sides"],
				["side-guest-phone", "a guest's side"],
				["taste-picks-guest-phone", "Made for you"],
				["quiz-member-phone", "a member's quiz"],
			],
			270,
		)}`,
	)
}

// A dev server's first page load after a start reloads itself once Vite has optimized its dependencies, which
// would cut a walk short: load each page once before the real run, through Taste and the quiz.
const stock = await fixtures()
for (const [url, before] of [
	[`${GUEST}?tv=taste`, undefined],
	[`${MEMBER}&tv=taste`, standIn(stock)],
]) {
	where = "warming the dev server"
	const { ctx, page } = await open(url, DESKTOP, { before, storage: FRESH })
	await page.waitForTimeout(5000)
	await page.keyboard.press("ArrowDown")
	await page.keyboard.press("Enter")
	await page.waitForTimeout(6000)
	await ctx.close()
}
{
	const { ctx, page } = await open(`${GUEST}?tv=rate&title=${MATRIX.key}`, DESKTOP, { storage: FRESH })
	await page.waitForTimeout(5000)
	await ctx.close()
}
passed = 0
failed.length = 0

if (only !== "shots") {
	// PARTS=walk,sides,rate,member,sizes,html runs some of the checks; checks.json is written by a whole run only.
	const parts = process.env.PARTS?.split(",")
	const part = (name) => !parts || parts.includes(name)
	if (part("walk")) for (const size of [DESKTOP, PHONE]) await walk(size)
	if (part("sides")) for (const size of [DESKTOP, PHONE]) await sides(size)
	if (part("rate")) for (const size of [DESKTOP, PHONE]) await rating(size)
	if (part("member")) for (const size of [DESKTOP, PHONE]) await member(size, stock)
	if (part("sizes")) await sizes()
	if (part("html")) await html()
	if (!parts) writeFileSync(join(here, "checks.json"), `${JSON.stringify({ passed, failed, numbers }, null, "\t")}\n`)
	else console.log(JSON.stringify(numbers, null, 1))
}
if (only !== "checks") await shots(stock)
await browser.close()
console.log(`${passed} checks passed, ${failed.length} failed`)
for (const line of failed) console.log(" -", line)
process.exit(failed.length ? 1 : 0)
