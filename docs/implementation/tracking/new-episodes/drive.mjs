// Drives /prototype/my-library-real with the member `new` (issue #442) in headless Chromium and checks the real
// pages at two sizes: the signal on home's Continue door, on what opens the hub and on the My shows tile; that
// opening My shows clears it and says what was new; the row for the waiting shows, closed and opened to its list
// with the days; and the shows to pick up, between that row and Start.
//   cd goodwatch-webapp
//   node_modules/.bin/remix vite:dev --port 3107 --strictPort --host 127.0.0.1      # without .env
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
const DAY = 86_400_000
const NAV = "[data-harness-navigation]"
const MARK = `${NAV} [data-new-episodes]`

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
	// The member's day is the device's: UTC here, so that the words are the same whenever this runs.
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
		await page.goto(`${base}/prototype/my-library-real?chrome=off&${query}`, { waitUntil: "load" })
		await page.waitForSelector("[data-harness-navigation]", { state: "attached", timeout: 20000 })
		await settle()
	}
	const shot = async (name) => {
		// The dev server's own query tool is not part of any page.
		await page.addStyleTag({ content: ".tsqd-parent-container, .tsqd-open-btn-container { display: none !important }" })
		if (shots) await page.screenshot({ path: `${shots}/${name}-${size}.jpg`, type: "jpeg", quality: 70 })
	}
	const count = (selector) => page.locator(selector).count()
	const text = (selector) => page.locator(`${selector} >> visible=true`).first().innerText()
	const texts = (selector) => page.locator(selector).allInnerTexts()
	const noSideScroll = async (name) => ok(`${name}: no sideways scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
	const door = "[data-tv-item='door:continue']"

	// ------------------------------------------------------------------------------------------- Home, something new
	await open("page=home&member=new&seen=30&reset=1")
	await page.waitForSelector("[data-door-signal]", { timeout: 15000 })
	ok("home: the Continue door says how many shows are new", (await text("[data-door-signal]")) === (phone ? "4 shows" : "4 shows have new episodes"), await text("[data-door-signal]"))
	ok("home: the door is still Tonight's pick", /Continue[\s\S]*The Bear/.test(await text(door)) && /S4 E2/.test(await text(door)), await text(door))
	ok("home: one signal on what opens the hub", (await count(`${MARK} >> visible=true`)) === 1)
	ok("home: it holds the number of shows", /^4/.test(await text(MARK)), await text(MARK))
	ok("home: a screen reader hears what the number means", /4 shows have new episodes/.test(await page.locator(`${MARK} >> visible=true`).first().evaluate((el) => el.textContent)))
	await shot("home")

	// ----------------------------------------------------------------------------------------------------- The hub
	await page.locator(phone ? `${NAV} nav[aria-label=Site] button` : `${NAV} header button[aria-haspopup=dialog][aria-expanded]`).click()
	await page.waitForSelector("#site-hub a[href='/my-shows']")
	await page.waitForTimeout(500)
	const tile = "#site-hub a[href='/my-shows']"
	ok("hub: the My shows tile says what is new, in the place of its line", /New in 4 shows/.test(await text(tile)) && !/tonight/.test(await text(tile)), await text(tile))
	ok("hub: the tile carries the number too", (await text(`${tile} [data-new-episodes]`)).startsWith("4"))
	ok("hub: the tile's line is one line", await page.locator(`${tile} small`).evaluate((el) => el.getBoundingClientRect().height < 22))
	ok("hub: the other tiles have no signal", (await count("#site-hub [data-new-episodes]")) === 1)
	await shot("hub")
	await page.keyboard.press("Escape")
	await page.waitForTimeout(400)

	// ---------------------------------------------------------------------------------------- My shows, on arrival
	await open("page=shows&member=new&seen=30")
	const since = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(Date.now() - 5 * DAY)
	ok("shows: the page says once what was new, the latest to air first", (await text("[data-arrival]")) === `New since ${since}: The White Lotus, Wednesday, Only Murders in the Building and 1 more`, await text("[data-arrival]"))
	ok("shows: opening the page is recorded as the visit", requests.some((r) => r.startsWith("POST") && r.includes("what=new-episodes")), requests.filter((r) => r.startsWith("POST")).join(" | "))
	ok("shows: the signal is gone from what opens the hub", (await count(MARK)) === 0)
	// The rows of Continue: the ones before the row for the waiting shows.
	const continues = await page.evaluate(() => {
		const items = [...document.querySelectorAll("[data-section=tonight] ol > li")]
		return items.slice(0, items.findIndex((li) => li.dataset.waiting !== undefined)).filter((li) => li.dataset.row).map((li) => li.innerText)
	})
	ok("shows: a Watching show with a new Next episode stands beside the Seen shows with new episodes", /Slow Horses/.test(continues[2]) && /NEW/.test(continues[2]) && continues.length === 7 && continues.slice(4).every((row) => /NEW EPISODES/.test(row)), continues.map((row) => row.split("\n").slice(0, 3).join("/")).join(" | "))
	await shot("shows")
	await noSideScroll("shows")

	// ------------------------------------------------------------------- The order of the page, and the shows to pick up
	const order = await page.evaluate(() =>
		[...document.querySelectorAll("[data-section=tonight] ol > li")].map((li) => li.dataset.groupLabel ?? (li.dataset.waiting !== undefined ? "waiting" : li.dataset.tag)).filter(Boolean).filter((name, i, all) => name !== all[i - 1]),
	)
	ok("shows: Continue, the waiting row, Pick up, Start", order.join() === "continue,next,seenNew,waiting,pick-up,next,start", order.join())
	ok("shows: the rule on the page names Pick up", /Then Pick up: shows you started and have not watched for 90 days\. Then Start:/.test((await text("[data-order-rule]")).replace(/\s+/g, " ")), await text("[data-order-rule]"))
	ok("shows: Pick up has a label with its count", /PICK UP\s*4\s*not watched for 90 days/i.test(await text("[data-group-label='pick-up']")), await text("[data-group-label='pick-up']"))
	const facts = Object.fromEntries(await page.locator("[data-row]").evaluateAll((items) => items.map((li) => [li.dataset.row, [...li.querySelectorAll("a > span")].at(-2)?.textContent ?? ""])))
	ok("shows: a show the member moved to Watching two days ago is in Continue and says since when", continues.findIndex((row) => /Star Trek: Picard/.test(row)) === 1 && (phone ? /Watching for 2 days/.test(continues[1]) : facts[219] === "Watching for 2 days"), `${continues[1].split("\n").join("/")} | ${facts[219]}`)
	const pickUps = await page.evaluate(() => {
		const items = [...document.querySelectorAll("[data-section=tonight] ol > li")]
		const from = items.findIndex((li) => li.dataset.groupLabel === "pick-up")
		const to = items.findIndex((li) => li.dataset.groupLabel === "start")
		return items.slice(from + 1, to).map((li) => li.innerText.replace(/\s+/g, " "))
	})
	ok("shows: the shows to pick up are rows as in Continue, the one watched last first", pickUps.length === 4 && /Yellowjackets/.test(pickUps[0]) && /Lost/.test(pickUps[1]) && /Mad Men/.test(pickUps[2]) && pickUps.every((row) => /NEXT EPISODE/i.test(row) && /S\d+ E\d+ · /.test(row)), pickUps.join(" | "))
	ok("shows: a show an import made Watching two days ago is one to pick up", /The Leftovers/.test(pickUps[3]) && /No date for your last watch/.test(pickUps[3]), pickUps[3])
	ok("shows: nothing is collapsed but the shows set aside", (await count("[data-section=tonight] details")) === 1 && (await count("[data-quiet] details")) === 2 && (await count("[data-group=older]")) === 0)

	// ------------------------------------------------------------------------------------------- The waiting row
	ok("waiting: one row, closed, between Continue and Pick up", (await count("[data-waiting]")) === 1 && (await count("details[data-group=waiting]:not([open])")) === 1)
	ok("waiting: it names the show that returns first, and counts the others", (await text("[data-waiting-says]")) === "Shrinking S3 E6 airs tomorrow" && /7 more shows waiting/.test(await text("[data-waiting-more]")), `${await text("[data-waiting-says]")} | ${await text("[data-waiting-more]")}`)
	ok("waiting: closed, it is one row and no taller than a list row", await page.locator("[data-waiting]").evaluate((li) => li.getBoundingClientRect().height <= 64), String(await page.locator("[data-waiting]").evaluate((li) => li.getBoundingClientRect().height)))
	ok("waiting: closed, no show's row is drawn", (await count("[data-waiting-row] >> visible=true")) === 0)
	await page.evaluate(() => {
		const row = document.querySelector("[data-waiting]")
		window.scrollTo({ top: row.getBoundingClientRect().top + window.scrollY - (innerHeight - 320), behavior: "instant" })
	})
	await page.waitForTimeout(500)
	await shot("waiting-closed")
	await page.locator("[data-waiting-summary]").click()
	await page.waitForTimeout(300)
	ok("waiting: the row opens to every waiting show", (await count("[data-waiting-row] >> visible=true")) === 8)

	const rows = await page.locator("[data-waiting-row]").evaluateAll((items) =>
		items.map((li) => ({
			title: li.querySelector("b").textContent,
			day: [...li.querySelector("[data-waiting-day]").children].map((el) => el.textContent),
			left: Math.round(li.getBoundingClientRect().left),
			// The label ends inside its line.
			cut: li.querySelector("[data-waiting-label]").getBoundingClientRect().right > li.querySelector("[data-waiting-label]").parentElement.getBoundingClientRect().right + 0.5,
			name: [...li.querySelectorAll("span.hidden")].some((el) => el.getBoundingClientRect().width > 0),
		})),
	)
	ok("waiting: soonest first, then the shows without a date", rows.map((r) => r.title).join() === "Shrinking,Abbott Elementary,Hacks,Severance,The Diplomat,Fallout,House of the Dragon,Silo", rows.map((r) => r.title).join())
	ok("waiting: the day is in a column of its own", rows[0].day[0] === "Tomorrow" && rows[1].day[0] === "In 3 days" && rows[2].day[0] === "In 4 days" && /^\d+ \w{3}/.test(rows[3].day[0]) && rows[3].day[1] === "in 6 weeks", JSON.stringify(rows.slice(0, 4).map((r) => r.day)))
	ok("waiting: a show without a date says so plainly", rows[6].day.join() === "No date yet" && rows[7].day.join() === "No date yet", JSON.stringify(rows.slice(6).map((r) => r.day)))
	ok("waiting: one column", new Set(rows.map((r) => r.left)).size === 1)
	ok("waiting: Caught up is never cut off", rows.every((r) => !r.cut))
	ok(phone ? "waiting: a phone leaves out the episode's name" : "waiting: a wide screen names the episode", rows.slice(0, 6).every((r) => r.name === !phone))
	ok("waiting: a row opens the show's page", /^\/show\/207-/.test(await page.getAttribute("[data-waiting-row='207'] a", "href")))
	await page.evaluate(() => {
		const group = document.querySelector("[data-group=waiting]")
		window.scrollTo({ top: group.getBoundingClientRect().top + window.scrollY - 90, behavior: "instant" })
	})
	await page.waitForTimeout(600)
	await shot("waiting")
	await noSideScroll("waiting, opened")
	await page.locator("[data-waiting-summary]").click()
	await page.evaluate(() => {
		const row = document.querySelector("[data-waiting]")
		window.scrollTo({ top: row.getBoundingClientRect().top + window.scrollY - 150, behavior: "instant" })
	})
	await page.waitForTimeout(500)
	await shot("pick-up")

	// ------------------------------------------------------------------------------------------------ After the visit
	await open("page=shows&member=new&seen=30")
	ok("shows, opened again: nothing is said to be new", (await count("[data-arrival]")) === 0)
	await open("page=home&member=new&seen=30")
	await page.waitForSelector("[data-home-doors]", { timeout: 15000 })
	await settle()
	ok("home, after the visit: no pill on the door and no signal", (await count("[data-door-signal]")) === 0 && (await count(MARK)) === 0)
	await shot("home-cleared")

	// ------------------------------------------------------------------- One waiting show without a date, and none
	await open("page=shows&member=six&seen=30&reset=1")
	ok("waiting, one show without a date: the row names it and says so", (await text("[data-waiting-says]")) === "The White Lotus is waiting for episodes" && /No date yet$/.test(await text("[data-waiting-more]")), `${await text("[data-waiting-says]")} | ${await text("[data-waiting-more]")}`)
	await open("page=shows&member=many&seen=30&reset=1")
	ok("waiting, no waiting show: no row", (await count("[data-waiting]")) === 0)
	ok("pick up, 17 shows: five are drawn, and a button draws more", /PICK UP\s*17/i.test(await text("[data-group-label='pick-up']")) && /Show 12 more/.test(await text("[data-more-pick-up]")), await text("[data-more-pick-up]"))
	await page.locator("[data-more-pick-up]").click()
	await page.waitForTimeout(300)
	ok("pick up: the button draws the rest", (await count("[data-more-pick-up]")) === 0 && (await count("[data-row][data-tag=next]")) === 25, String(await count("[data-row][data-tag=next]")))

	// ------------------------------------------------------------------------------- A member with nothing to follow
	await open("page=home&member=empty&seen=0")
	ok("a member without shows: nothing is asked and nothing is shown", !requests.some((r) => r.includes("what=new-episodes")) && (await count(MARK)) === 0)

	ok("no page error", errors.length === 0, errors.slice(0, 3).join(" ; "))
	await context.close()
}

// The member's day decides the words: far ahead of UTC, tomorrow's episode (by UTC) airs today or tomorrow.
{
	const zone = "Pacific/Kiritimati"
	const context = await browser.newContext({ ...SIZES.desktop, timezoneId: zone })
	const page = await context.newPage()
	await paint(page)
	await page.goto(`${base}/prototype/my-library-real?chrome=off&page=shows&member=new&seen=30&reset=1`, { waitUntil: "load" })
	await page.waitForSelector("[data-waiting-summary]", { timeout: 20000 })
	await page.waitForTimeout(800)
	await page.locator("[data-waiting-summary]").click()
	const theirs = new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(new Date())
	const utcTomorrow = new Date(Date.now() + DAY).toISOString().slice(0, 10)
	const expected = theirs === utcTomorrow ? "Today" : "Tomorrow"
	const shown = await page.locator("[data-waiting-row='207'] [data-waiting-day] b").innerText()
	check("member's day", `in ${zone} the episode of ${utcTomorrow} airs ${expected.toLowerCase()}`, shown === expected, shown)
	await context.close()
}

await browser.close()
console.log(`${passed} checks passed, ${failed.length} failed`)
for (const line of failed) console.log(`  FAILED ${line}`)
process.exit(failed.length ? 1 : 0)
