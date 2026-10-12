// Drives /prototype/my-library-real with titles that landed on the sample member's services (issue #456) in headless
// Chromium and checks the real pages at two sizes: the signal on what opens the hub, on the My movies and My shows
// tiles and on home's doors; that opening My movies clears the movies and My shows the shows, and that each page
// says once what landed; and a new episode (#442) and a landed title together.
//   cd goodwatch-webapp
//   REC_TRACKING=on REC_WATCH_NEXT=on REC_NAVIGATION=on REC_TASTE_MATCH=on \
//     node_modules/.bin/remix vite:dev --port 3107 --strictPort --host 127.0.0.1      # without .env
//   HARNESS=http://127.0.0.1:3107 node drive.mjs [screenshot dir]   # with playwright-core beside it, and system Chromium
// Posters and backdrops are painted here: no request leaves for image.tmdb.org.
import { chromium } from "playwright-core"

const base = process.env.HARNESS ?? "http://127.0.0.1:3107"
const shots = process.argv[2] ?? null
const SIZES = {
	phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
	desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
}
const HUES = [12, 32, 48, 140, 172, 200, 222, 262, 292, 330]
const NAV = "[data-harness-navigation]"
const MARK = `${NAV} [data-new-episodes]`
const MOVIES = "#site-hub a[href='/my-movies']"
const SHOWS = "#site-hub a[href='/my-shows']"
const DOOR = { continue: "[data-tv-item='door:continue']", start: "[data-tv-item='door:start']", movie: "[data-tv-item='door:movie']" }

let passed = 0
const failed = []
const check = (size, name, ok, detail = "") => {
	if (ok) passed++
	else failed.push(`${size}: ${name}${detail ? ` (${detail})` : ""}`)
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--no-sandbox"] })

async function paint(page) {
	await page.route("https://image.tmdb.org/**", (route) => {
		const path = new URL(route.request().url()).pathname
		const n = Number(path.match(/(\d+)\.jpg$/)?.[1] ?? 0)
		const [w, h] = path.includes("backdrop") ? [500, 281] : [200, 300]
		const hue = HUES[n % HUES.length]
		route.fulfill({
			contentType: "image/svg+xml",
			body: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 55% 42%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 60% 16%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${w * 0.7}" cy="${h * 0.3}" r="${h * 0.22}" fill="hsl(${hue} 70% 70% / .25)"/></svg>`,
		})
	})
}

for (const [size, options] of Object.entries(SIZES)) {
	const phone = size === "phone"
	const context = await browser.newContext({ ...options, timezoneId: "UTC" })
	const page = await context.newPage()
	const errors = []
	const requests = []
	page.on("pageerror", (error) => errors.push(String(error)))
	page.on("request", (request) => requests.push(`${request.method()} ${new URL(request.url()).search}`))
	await paint(page)
	const ok = (name, value, detail) => check(size, name, Boolean(value), detail)
	const under = new Set()
	let quietSince = Date.now()
	const done = (request) => {
		under.delete(request)
		quietSince = Date.now()
	}
	page.on("request", (request) => {
		if (["fetch", "xhr"].includes(request.resourceType())) under.add(request)
	})
	page.on("requestfinished", done)
	page.on("requestfailed", done)
	page.on("framenavigated", () => under.clear())
	const settle = async () => {
		await page.waitForTimeout(200)
		for (let i = 0; i < 200 && (under.size > 0 || Date.now() - quietSince < 400); i++) await page.waitForTimeout(50)
		await page.waitForTimeout(200)
	}
	const open = async (query) => {
		requests.length = 0
		// Not "networkidle": the dev server's telemetry keeps a connection open now and then.
		await page.goto(`${base}/prototype/my-library-real?chrome=off&seen=30&${query}`, { waitUntil: "load" })
		await page.waitForSelector(NAV, { state: "attached", timeout: 20000 })
		await settle()
	}
	const home = async (query) => {
		await open(`page=home&${query}`)
		await page.waitForSelector("[data-home-doors]", { timeout: 15000 })
		await settle()
	}
	const shot = async (name) => {
		// The dev server's own query tool is not part of any page.
		await page.addStyleTag({ content: ".tsqd-parent-container, .tsqd-open-btn-container { display: none !important }" })
		if (shots) await page.screenshot({ path: `${shots}/${name}-${size}.jpg`, type: "jpeg", quality: 70 })
	}
	const count = (selector) => page.locator(selector).count()
	const text = async (selector) => ((await count(`${selector} >> visible=true`)) ? page.locator(`${selector} >> visible=true`).first().innerText() : "")
	const pill = (door) => text(`${DOOR[door]} [data-door-signal]`)
	const opener = () => text(MARK)
	const openHub = async () => {
		await page.locator(phone ? `${NAV} nav[aria-label=Site] button` : `${NAV} header button[aria-haspopup=dialog][aria-expanded]`).click()
		await page.waitForSelector(SHOWS)
		await page.waitForTimeout(500)
	}
	const closeHub = async () => {
		await page.keyboard.press("Escape")
		await page.waitForTimeout(400)
	}
	const oneLine = (tile) => page.locator(`${tile} small`).evaluate((el) => el.getBoundingClientRect().height < 22)
	const noSideScroll = async (name) => ok(`${name}: no sideways scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
	const posted = (what) => requests.some((r) => r.startsWith("POST") && r.includes(`what=${what}`))

	// ------------------------------------------------------------------------------------------------- Nothing new
	await home("member=six&landed=none&reset=1")
	ok("nothing: no signal on what opens the hub and no pill on a door", (await count(MARK)) === 0 && (await count("[data-door-signal]")) === 0)
	ok("nothing: no request is added for it", !requests.some((r) => r.includes("what=newly-available")))
	await shot("nothing-home")
	await openHub()
	ok("nothing: the tiles keep their lines", /Movies you want to see/.test(await text(MOVIES)) && (await count("#site-hub [data-new-episodes]")) === 0, await text(MOVIES))
	await shot("nothing-hub")
	await closeHub()
	await open("page=movies&member=six&landed=none")
	ok("nothing: My movies says nothing landed", (await count("[data-landed]")) === 0)

	// --------------------------------------------------------------------------------------------------- One movie
	await home("member=six&landed=movie&reset=1")
	await page.waitForSelector("[data-door-signal]", { timeout: 15000 })
	ok("one movie: the A movie door names the movie and the service", (await pill("movie")) === (phone ? "1 movie" : "Dune: Part Two is now on Netflix"), await pill("movie"))
	ok("one movie: the other doors have no pill", (await count("[data-door-signal]")) === 1)
	ok("one movie: what opens the hub says 1", (await opener()).startsWith("1"), await opener())
	await shot("one-movie-home")
	await openHub()
	ok("one movie: the My movies tile names it, in the place of its line", /Now on Netflix: Dune: Part Two/.test(await page.locator(`${MOVIES} small`).evaluate((el) => el.textContent)), await text(MOVIES))
	ok("one movie: the tile's line is one line", await oneLine(MOVIES))
	ok("one movie: the tile carries the number, and My shows none", (await text(`${MOVIES} [data-new-episodes]`)).startsWith("1") && (await count(`${SHOWS} [data-new-episodes]`)) === 0)
	await shot("one-movie-hub")
	await closeHub()

	await open("page=movies&member=six&landed=movie")
	ok("one movie: My movies says once what landed", (await text("[data-landed]")) === "Dune: Part Two is now on Netflix", await text("[data-landed]"))
	ok("one movie: opening My movies is stored as the visit", posted("newly-available"), requests.filter((r) => r.startsWith("POST")).join(" | "))
	ok("one movie: the signal is gone from what opens the hub", (await count(MARK)) === 0)
	await shot("one-movie-page")
	await noSideScroll("My movies")
	await open("page=movies&member=six&landed=movie")
	ok("one movie: opened again, nothing is said to have landed", (await count("[data-landed]")) === 0)
	await home("member=six&landed=movie")
	ok("one movie: home after the visit has no pill and no signal", (await count("[data-door-signal]")) === 0 && (await count(MARK)) === 0)

	// ---------------------------------------------------------------------------------------------------- One show
	await home("member=six&landed=show&reset=1")
	await page.waitForSelector("[data-door-signal]", { timeout: 15000 })
	ok("one show: the Continue door names the show and the service", (await pill("continue")) === (phone ? "1 show" : "Station Eleven is now on Disney Plus"), await pill("continue"))
	ok("one show: the other doors have no pill", (await count("[data-door-signal]")) === 1)
	await shot("one-show-home")
	await openHub()
	ok("one show: the My shows tile names it", /Now on Disney Plus: Station Eleven/.test(await page.locator(`${SHOWS} small`).evaluate((el) => el.textContent)), await text(SHOWS))
	ok("one show: the tile's line is one line", await oneLine(SHOWS))
	ok("one show: My movies has no signal", (await count(`${MOVIES} [data-new-episodes]`)) === 0)
	await shot("one-show-hub")
	await closeHub()
	await open("page=shows&member=six&landed=show")
	ok("one show: My shows says once what landed", (await text("[data-landed]")) === "Station Eleven is now on Disney Plus", await text("[data-landed]"))
	ok("one show: nothing aired, so no line about episodes", (await count("[data-arrival]")) === 0)
	ok("one show: the visit of My shows is the one that is stored", posted("new-episodes") && !posted("newly-available"))
	ok("one show: the signal is gone", (await count(MARK)) === 0)
	await shot("one-show-page")
	await open("page=shows&member=six&landed=show")
	ok("one show: opened again, nothing is said to have landed", (await count("[data-landed]")) === 0)

	// A member without a show to continue: the door that opens My shows is Start a show.
	await home("member=none&landed=show&reset=1")
	await page.waitForSelector("[data-door-signal]", { timeout: 15000 })
	ok("one show, nothing to continue: the Start door carries the pill", (await count(DOOR.continue)) === 0 && (await pill("start")) === (phone ? "1 show" : "Station Eleven is now on Disney Plus"), await pill("start"))

	// ----------------------------------------------------------------------------------------------------- Several
	await home("member=six&landed=several&reset=1")
	await page.waitForSelector("[data-door-signal]", { timeout: 15000 })
	ok("several: the A movie door counts the movies", (await pill("movie")) === (phone ? "4 movies" : "4 movies are now on your services"), await pill("movie"))
	ok("several: the Continue door counts the shows", (await pill("continue")) === (phone ? "2 shows" : "2 shows are now on your services"), await pill("continue"))
	ok("several: what opens the hub shows the sum", (await opener()).startsWith("6"), await opener())
	await shot("several-home")
	await openHub()
	ok("several: the My movies tile counts", /4 now on your services/.test(await text(MOVIES)) && (await text(`${MOVIES} [data-new-episodes]`)).startsWith("4"), await text(MOVIES))
	ok("several: the My shows tile counts", /2 now on your services/.test(await text(SHOWS)) && (await text(`${SHOWS} [data-new-episodes]`)).startsWith("2"), await text(SHOWS))
	ok("several: both lines are one line", (await oneLine(MOVIES)) && (await oneLine(SHOWS)))
	await shot("several-hub")
	await closeHub()
	await open("page=movies&member=six&landed=several")
	ok("several: My movies names three and counts the rest, the latest to land first", (await text("[data-landed]")) === "Now on your services: Dune: Part Two, The Holdovers, Aftersun and 1 more", await text("[data-landed]"))
	await settle()
	ok("several: opening My movies clears the movies and leaves the shows", (await opener()).startsWith("2"), await opener())
	await shot("several-page")
	await noSideScroll("My movies, several")
	await home("member=six&landed=several")
	ok("several: home then has the pill on Continue alone", (await count("[data-door-signal]")) === 1 && (await pill("continue")) !== "")

	// ------------------------------------------------------------------------- A new episode and a landing together
	await home("member=new&landed=several&reset=1")
	await page.waitForSelector(`${DOOR.continue} [data-door-signal]`, { timeout: 15000 })
	await settle()
	ok("together: the Continue door counts the shows with something new", (await pill("continue")) === (phone ? "6 shows" : "6 shows have something new"), await pill("continue"))
	ok("together: the A movie door counts the movies", (await pill("movie")) === (phone ? "4 movies" : "4 movies are now on your services"), await pill("movie"))
	ok("together: what opens the hub shows the sum of everything new", (await opener()).startsWith("10"), await opener())
	ok("together: a screen reader hears what the number means", /10 new in your shows and movies/.test(await page.locator(`${MARK} >> visible=true`).first().evaluate((el) => el.textContent)))
	await shot("together-home")
	await openHub()
	ok("together: the My shows tile counts new episodes and landed shows", /New in 6 shows/.test(await text(SHOWS)) && (await text(`${SHOWS} [data-new-episodes]`)).startsWith("6"), await text(SHOWS))
	ok("together: the My movies tile counts the movies", /4 now on your services/.test(await text(MOVIES)), await text(MOVIES))
	await shot("together-hub")
	await closeHub()
	await open("page=shows&member=new&landed=several")
	ok("together: My shows says what aired", /^New since .*: The White Lotus, Wednesday, Only Murders in the Building and 1 more$/.test(await text("[data-arrival]")), await text("[data-arrival]"))
	ok("together: and under it what landed", (await text("[data-landed]")) === "Now on your services: Station Eleven, Mr. Robot", await text("[data-landed]"))
	await settle()
	ok("together: opening My shows leaves the movies", (await opener()).startsWith("4"), await opener())
	await shot("together-page")
	await noSideScroll("My shows, together")

	// One new episode beside one landed movie.
	await home("member=new&landed=movie&reset=1")
	await page.waitForSelector(`${DOOR.movie} [data-door-signal]`, { timeout: 15000 })
	await settle()
	ok("an episode and a movie: each door says its own", (await pill("continue")) === (phone ? "4 shows" : "4 shows have new episodes") && (await pill("movie")) === (phone ? "1 movie" : "Dune: Part Two is now on Netflix"), `${await pill("continue")} | ${await pill("movie")}`)
	ok("an episode and a movie: what opens the hub says 5", (await opener()).startsWith("5"), await opener())

	// ------------------------------------------------------------------------------- A member with nothing at all
	await home("member=empty&seen=0&landed=several&reset=1")
	ok("a member without titles: nothing is shown", (await count(MARK)) === 0 && (await count("[data-door-signal]")) === 0)

	ok("no page error", errors.length === 0, errors.slice(0, 3).join(" ; "))
	await context.close()
}

await browser.close()
console.log(`${passed} checks passed, ${failed.length} failed`)
for (const line of failed) console.log(`  FAILED ${line}`)
process.exit(failed.length ? 1 : 0)
