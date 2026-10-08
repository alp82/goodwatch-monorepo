// Drives /prototype/my-library-real (issue #385) in headless Chromium and checks the real pages at two sizes.
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

let passed = 0
const failed = []
const check = (size, name, ok, detail = "") => {
	if (ok) passed++
	else failed.push(`${size}: ${name}${detail ? ` (${detail})` : ""}`)
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--no-sandbox"] })

for (const [size, options] of Object.entries(SIZES)) {
	const phone = size === "phone"
	const context = await browser.newContext(options)
	const page = await context.newPage()
	const errors = []
	const writes = []
	page.on("pageerror", (error) => errors.push(String(error)))
	page.on("request", (request) => {
		if (request.method() !== "GET") writes.push(`${request.method()} ${new URL(request.url()).pathname}${new URL(request.url()).search}`)
	})
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
	const ok = (name, value, detail) => check(size, name, Boolean(value), detail)
	const open = async (query, hash = "") => {
		await page.goto(`${base}/prototype/my-library-real?chrome=off&${query}${hash}`, { waitUntil: "networkidle" })
		await page.waitForTimeout(500)
	}
	const shot = async (name) => {
		if (shots) await page.screenshot({ path: `${shots}/${name}-${size}.jpg`, type: "jpeg", quality: 62 })
	}
	// Until no request of the page has been under way for 300 ms.
	// Only the page's own fetches count: a navigation drops its requests without a word.
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
		await page.waitForTimeout(150)
		for (let i = 0; i < 200 && (under.size > 0 || Date.now() - quietSince < 300 || (await page.locator("[aria-busy=true]").count())); i++) await page.waitForTimeout(50)
		await page.waitForTimeout(150)
	}
	const count = (selector) => page.locator(selector).count()
	const text = (selector) => page.locator(selector).first().innerText()
	const texts = (selector) => page.locator(selector).allInnerTexts()
	const noSideScroll = async (name) =>
		ok(`${name}: no sideways scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
	const param = (key) => new URL(page.url()).searchParams.get(key)

	// ---------------------------------------------------------------------------------------------- My library
	await open("page=library&member=six&seen=30&reset=1")
	ok("library: the page is My library", (await text("h1")) === "My library")
	const tabs = await texts("[data-status-choice] [role=tab]")
	ok("library: Want to see and Seen are the two shown, with counts", tabs.length === 2 && /Want to see\s*26/.test(tabs[0]) && /Seen\s*34/.test(tabs[1]), tabs.join(" | "))
	ok("library: Want to see is chosen first", (await page.getAttribute("[role=tab][data-status=want]", "aria-selected")) === "true")
	ok("library: the drop-down is closed and reads More", (await count("[data-status-menu]")) === 0 && (await text("[data-status-more]")).trim() === "More")
	ok("library: the status row fits one line", await page.evaluate(() => {
		const row = document.querySelector("[data-status-choice]")
		const tops = [...row.querySelectorAll("button")].map((b) => Math.round(b.getBoundingClientRect().top / 30))
		const labels = [...row.querySelectorAll("[role=tab] .truncate")]
		return new Set(tops).size === 1 && labels.every((l) => l.scrollWidth <= l.clientWidth)
	}))
	ok("library: Want to see lists the Wishlist, last added first", (await count("[data-rows=want] [data-item]")) === 26 && (await text("[data-item] b")) === "Past Lives")
	await shot("library-want")
	await noSideScroll("library, Want to see")

	await page.click("[role=tab][data-status=seen]")
	await settle()
	ok("library: Seen is in the URL and lit", param("status") === "seen" && (await page.getAttribute("[role=tab][data-status=seen]", "aria-selected")) === "true")
	ok("library: Seen lists 34 titles", (await count("[data-rows=seen] [data-item]")) === 34 && /34 titles/.test(await text("[data-result]")))
	ok("library: a Seen row has a score or a Rate key", (await count("[data-item] [data-score], [data-item] [data-rate]")) === 34)
	ok("library: the quiet way to the titles without a score", /7 not rated/.test(await text("[data-to-unrated]")))
	await shot("library-seen")

	await page.click("[data-status-more]")
	const entries = await texts("[data-status-menu] [role=menuitemradio]")
	ok("library: the drop-down holds Watching, On hold, Dropped and Not rated, with counts",
		entries.length === 4 && /Watching\s*6/.test(entries[0]) && /On hold\s*1/.test(entries[1]) && /Dropped\s*1/.test(entries[2]) && /Not rated[\s\S]*7/.test(entries[3]), entries.join(" | "))
	ok("library: the open drop-down stays on screen", await page.evaluate(() => {
		const r = document.querySelector("[data-status-menu]").getBoundingClientRect()
		return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight
	}))
	ok("library: its entries are at least 44 px high", await page.evaluate(() => [...document.querySelectorAll("[data-status-menu] button")].every((b) => b.getBoundingClientRect().height >= 44)))
	await shot("library-more-open")
	await page.keyboard.press("Escape")
	ok("library: Escape closes the drop-down and returns to its button", (await count("[data-status-menu]")) === 0 && (await page.evaluate(() => document.activeElement?.hasAttribute("data-status-more"))))
	await page.click("[data-status-more]")
	await page.mouse.click(5, 300)
	ok("library: a press outside closes the drop-down", (await count("[data-status-menu]")) === 0)

	await page.click("[data-status-more]")
	await page.click("[data-status-menu] [data-status=watching]")
	await settle()
	ok("library: Watching is in the URL, and the drop-down's button carries its name", param("status") === "watching" && /Watching/.test(await text("[data-status-more]")))
	ok("library: neither main choice is lit then", (await count("[data-status-choice] [role=tab][aria-selected=true]")) === 0)
	ok("library: Watching lists the 6 shows with their progress", (await count("[data-rows=watching] [data-item]")) === 6 && /Show · \d+ · 3 of 6 episodes/.test(await text("[data-item='show-101']")))
	ok("library: a show status has no movies and shows filter", (await count("[data-kind-filter]")) === 0)
	ok("library: a row opens the title's page", (await page.getAttribute("[data-item='show-101'] a", "href")) === "/show/101-slow-horses")
	await shot("library-watching")
	await noSideScroll("library, Watching")
	for (const [status, n] of [["on_hold", 1], ["dropped", 1]]) {
		await page.click("[data-status-more]")
		await page.click(`[data-status-menu] [data-status=${status}]`)
		await settle()
		ok(`library: ${status} lists its show`, (await count(`[data-rows=${status}] [data-item]`)) === n)
	}

	// Sorts, the filter and the search, on Seen.
	await page.click("[role=tab][data-status=seen]")
	await settle()
	ok("library: Seen has the sorts Last watched, My score and Title", (await texts("[data-sort] option")).join() === "Last watched,My score,Title")
	await page.selectOption("[data-sort]", "score")
	await settle()
	const scores = await page.evaluate(() => [...document.querySelectorAll("[data-item]")].map((li) => Number(li.querySelector("[data-score]")?.textContent ?? -1)))
	ok("library: My score orders by score, the titles without one last", param("sort") === "score" && scores.every((s, i) => i === 0 || scores[i - 1] >= s) && scores.at(-1) === -1, scores.join())
	await page.selectOption("[data-sort]", "title")
	await settle()
	const names = await texts("[data-item] b")
	const plain = (s) => s.toLowerCase().replace(/^(the|an|a) /, "")
	ok("library: Title orders by title without its article", names.length === 34 && names.every((n, i) => i === 0 || plain(names[i - 1]).localeCompare(plain(n)) <= 0), names.slice(0, 4).join())
	await page.selectOption("[data-sort]", "last")
	await settle()
	ok("library: the default sort leaves the URL", param("sort") === null)
	await page.click("[data-kind=movie]")
	await settle()
	ok("library: Movies keeps the 24 movies", param("type") === "movie" && (await count("[data-item]")) === 24 && (await count("[data-item^='show-']")) === 0)
	await page.click("[data-kind=all]")
	await settle()
	await page.fill("[data-search]", "harbor")
	await page.waitForTimeout(500)
	await settle()
	const found = await texts("[data-item] b")
	ok("library: the search narrows the list and is in the URL", param("q") === "harbor" && found.length >= 1 && found.every((n) => /harbor/i.test(n)), found.join())
	await page.fill("[data-search]", "zzzz")
	await page.waitForTimeout(500)
	await settle()
	ok("library: a search without a match says so", (await count("[data-no-match]")) === 1)
	await page.fill("[data-search]", "")
	await page.waitForTimeout(500)
	await settle()

	// Not rated, and a score given from the list (the app's own score writer, against the in-memory Crate).
	await page.click("[data-to-unrated]")
	await settle()
	ok("library: Not rated lists the 7 Seen titles without a score", param("status") === "unrated" && (await count("[data-rows=unrated] [data-item]")) === 7 && (await count("[data-rate]")) === 7)
	ok("library: Not rated has no My score sort", (await texts("[data-sort] option")).join() === "Last watched,Title")
	await shot("library-not-rated")
	const rated = await page.getAttribute("[data-item]", "data-item")
	await page.click("[data-rate]")
	await page.waitForSelector("[data-rate-bar]")
	ok("library: Rate opens the bar with ten keys", (await count("[data-rate-bar] [data-give]")) === 10)
	await shot("library-rate-bar")
	await page.click("[data-rate-bar] [data-give='8']")
	await page.waitForTimeout(400)
	await settle()
	ok("library: a score takes the title off Not rated, and the count follows", (await count(`[data-item='${rated}']`)) === 0 && (await count("[data-item]")) === 6 && /Not rated/.test(await text("[data-status-more]")))
	await page.click("[role=tab][data-status=seen]")
	await settle()
	// Seen was read before the score: it shows what it had, and its count follows once it has been read again.
	await page.waitForFunction(() => /6 not rated/.test(document.querySelector("[data-to-unrated]")?.textContent ?? ""), null, { timeout: 8000 }).catch(() => {})
	const after = [await text(`[data-item='${rated}'] [data-score]`), await text("[data-to-unrated]")]
	ok("library: the title is in Seen with its score", after[0] === "8" && /6 not rated/.test(after[1]), after.join(" / "))
	ok("library: the only write was the score", writes.filter((w) => !w.includes("/api/e")).length === 1 && writes.some((w) => w.includes("what=rate")), writes.join(" ; "))

	// 1,500 Seen titles.
	await open("page=library&member=six&seen=1500&status=seen")
	ok("library, 1,500: the count is on the switch", /Seen\s*1,504/.test((await texts("[data-status-choice] [role=tab]"))[1]))
	ok("library, 1,500: the first step is 60 rows", (await count("[data-item]")) === 60)
	ok("library, 1,500: the key for the next step says what is left", /Show 60 more\s*· 1,444 left/.test(await text("[data-more]")))
	await page.click("[data-more]")
	await settle()
	ok("library, 1,500: a step adds 60", (await count("[data-item]")) === 120)
	ok("library, 1,500: the page stays small", (await page.evaluate(() => document.querySelectorAll("[data-my-library] *").length)) < 4000)
	await shot("library-seen-1500")
	const started = Date.now()
	await page.selectOption("[data-sort]", "title")
	await settle()
	ok("library, 1,500: Title sorts all of them and shows the first 60", (await count("[data-item]")) === 60 && Date.now() - started < 4000, `${Date.now() - started} ms`)
	await page.fill("[data-search]", "velvet")
	await page.waitForTimeout(500)
	await settle()
	ok("library, 1,500: the search finds across the whole list", (await count("[data-item]")) > 20 && (await texts("[data-item] b")).every((n) => /velvet/i.test(n)))
	await noSideScroll("library, 1,500")

	await open("page=library&member=empty&seen=0")
	ok("library, nothing marked: both counts are 0 and the list says what puts a title here", /Want to see\s*0/.test((await texts("[data-status-choice] [role=tab]"))[0]) && (await count("[data-empty]")) === 1)
	await shot("library-empty")

	// ---------------------------------------------------------------------------------------------- My shows
	await open("page=shows&member=six&seen=30")
	ok("shows: the page is My shows", (await text("h1")) === "My shows")
	ok("shows: the rule is stated on the page", /Continue comes first, the show you watched last on top\. Then Start: the shows you want to see, best taste match first\. A row opens the show\./.test((await text("[data-order-rule]")).replace(/\s+/g, " ")))
	ok("shows: each group has a label with its count", /CONTINUE\s*5\s*last watched first/i.test(await text("[data-group-label=continue]")) && /START\s*9\s*best taste match first/i.test(await text("[data-group-label=start]")))
	const tags = await page.evaluate(() => [...document.querySelectorAll("[data-row]")].map((li) => li.dataset.tag))
	ok("shows: one list, Continue before Start", tags.join() === [...Array(4).fill("next"), "seenNew", ...Array(9).fill("start")].join(), tags.join())
	ok("shows: the show watched last leads, with its Next episode", /Slow Horses[\s\S]*S1 E4 · /.test(await text("[data-row]")) && /Watched yesterday/.test(await text("[data-row]")))
	ok("shows: a Seen show with new episodes ends Continue", /NEW EPISODES[\s\S]*Only Murders in the Building[\s\S]*2 new since you saw it/i.test(await text("[data-row='107']")))
	const matches = (await texts("[data-tag=start]")).map((t) => Number(t.match(/(\d+)% taste match/)?.[1]))
	ok("shows: Start is ordered by taste match", matches.length === 9 && matches.every((m, i) => i === 0 || matches[i - 1] >= m), matches.join())
	ok("shows: a show to start says what it costs", /seasons? · \d+ episodes · about \d+ h/.test(await text("[data-tag=start]")))
	ok("shows: the whole row is the link to the show's page", await page.evaluate(() => [...document.querySelectorAll("[data-row]")].every((li) => li.children.length === 1 && li.firstElementChild.matches("a[href^='/show/']"))))
	ok("shows: no Watched button and no tick in the list", (await count("[data-section=tonight] ol button")) === 0 && !/watched it|mark .* watched/i.test(await text("[data-section=tonight] ol")))
	ok("shows: not watched for 30 days is a closed group of 2", (await count("details[data-group=older]:not([open])")) === 1 && /Not watched for 30 days\s*2/.test(await text("[data-group=older] summary")))
	ok("shows: waiting for episodes is shown", /Waiting for episodes\s*1/.test(await text("[data-group=waiting] h3")) && /The White Lotus[\s\S]*Caught up/.test(await text("[data-group=waiting]")))
	ok("shows: On hold and Dropped are closed groups", (await count("details[data-group='on-hold']:not([open])")) === 1 && (await count("details[data-group=dropped]:not([open])")) === 1)
	await shot("shows")
	await noSideScroll("shows")
	await page.click("[data-group=dropped] summary")
	ok("shows: Dropped opens to its show", /The Idol/.test(await text("[data-group=dropped]")))
	await open("page=shows&member=six&seen=30", "#start")
	ok("shows: #start lands on the Start group", await page.evaluate(() => {
		const top = document.getElementById("start").getBoundingClientRect().top
		return top >= 0 && top < innerHeight * 0.4
	}))
	await shot("shows-start")
	await open("page=shows&member=many&seen=30")
	ok("shows, 25 Watching: 8 watched in the last 30 days and the Seen show with new episodes continue; 17 are older", /CONTINUE\s*9/i.test(await text("[data-group-label=continue]")) && /Not watched for 30 days\s*17/.test(await text("[data-group=older] summary")))
	await shot("shows-25")
	await open("page=shows&member=none&seen=30")
	ok("shows, nothing started: the list is the shows to start", (await count("[data-group-label=continue]")) === 0 && /START\s*4/i.test(await text("[data-group-label=start]")) && /Shows to start/.test(await text("[data-order-rule]")))
	await shot("shows-none")
	await open("page=shows&member=empty&seen=0")
	ok("shows, nothing marked: the page says what puts a show here", (await count("[data-empty]")) === 1)

	// ---------------------------------------------------------------------------------------------- My movies
	await open("page=movies&member=six&seen=30")
	ok("movies: the page is My movies", (await text("h1")) === "My movies" && /17 movies you want to see/.test(await text("[data-page-head]")))
	const words = await text("[data-my-movies]")
	ok("movies: the word is movie, never film", !/\bfilms?\b/i.test(words), words.match(/.{20}\bfilms?\b.{20}/i)?.[0])
	ok("movies: the page speaks of your movies, not of the Wishlist or Watch next", !/wishlist|watch next/i.test(words), words.match(/.{20}(wishlist|watch next).{20}/i)?.[0])
	ok("movies: the hero is tonight's movie", /^Tonight's movie · Best match for you tonight/.test(await text("[data-herolabel]")))
	ok("movies: only movies are on it", await page.evaluate(() => [...document.querySelectorAll("[data-my-movies] a[href^='/show/']")].length === 0))
	await shot("movies")
	if (phone) {
		ok("movies: How long? is the fourth button of the slab", (await count("[data-watch-next-strip] button")) === 4 && /How long\?/.test(await text("[data-segment=time]")))
		await page.click("[data-segment=time]")
		await page.waitForSelector("[data-time-choice='120']")
		ok("movies: its drawer offers any length and three limits", (await texts("[data-time-choice]")).join() === "Any length,Up to 1h 30,Up to 2h,Up to 2h 30")
		await shot("movies-time-drawer")
		await page.click("[data-time-choice='120']")
		await page.click("[data-drawer-done]:visible")
	} else {
		ok("movies: How long? is a fourth choice in the strip", (await texts("[data-time] option")).join() === "How long? Any length,Up to 1h 30,Up to 2h,Up to 2h 30")
		await page.selectOption("[data-time]", "120")
	}
	await settle()
	await page.waitForTimeout(600)
	ok("movies: the time is in the URL and on the hero's line", param("time") === "120" && /, up to 2h$/.test(await text("[data-herolabel]")), await text("[data-herolabel]"))
	const hero = await text("[data-hero]")
	const minutes = (label) => (Number(label.match(/(\d+)h/)?.[1] ?? 0) * 60) + Number(label.match(/(\d+)m\b|(\d+) min/)?.slice(1).find(Boolean) ?? 0)
	ok("movies: tonight's movie runs no longer than the time", minutes(hero.match(/\d+h \d+m|\d+ min/)?.[0] ?? "") <= 120 && minutes(hero.match(/\d+h \d+m|\d+ min/)?.[0] ?? "") > 0, hero.slice(0, 80))
	ok("movies: what does not fit is one closed group", (await count("[data-tier=notTonightsFit] button[aria-expanded=false]")) === 1 && /Not tonight's fit/.test(await text("[data-tier=notTonightsFit]")))
	await page.locator("[data-tier=notTonightsFit]").scrollIntoViewIfNeeded()
	await page.click("[data-tier=notTonightsFit] button")
	await page.waitForSelector("[data-tier=notTonightsFit] [data-misfit]")
	await settle()
	const why = await texts("[data-tier=notTonightsFit] [data-misfit]")
	ok("movies: a movie that runs over says by how much", why.some((w) => /^(\d+ min|\d+h( \d+m)?) over$/.test(w)), why.join(" | "))
	ok("movies: the others say why they do not fit", why.every((w) => / over$|^Another mood$|^Not on your services$/.test(w)))
	await shot("movies-time")
	await noSideScroll("movies")

	// ---------------------------------------------------------------------------------------------- Home
	await open("page=home&member=six&seen=30")
	await page.waitForSelector("[data-home-doors]", { timeout: 15000 })
	const doors = await page.evaluate(() => [...document.querySelectorAll("[data-home-doors] [data-tv-item]")].filter((el) => el.getBoundingClientRect().width > 0).map((el) => el.dataset.tvItem))
	const seenDoors = [...new Set(doors)]
	ok("home: three doors, Continue, Start a show, A movie", seenDoors.join() === "door:continue,door:start,door:movie", seenDoors.join())
	const visible = (selector) => page.locator(`${selector} >> visible=true`).first().innerText()
	ok("home: Continue names the Next episode", /Continue[\s\S]*Slow Horses/.test(await visible("[data-tv-item='door:continue']")) && /S1 E4/.test(await visible("[data-tv-item='door:continue']")))
	ok("home: A movie says movie", /A movie/.test(await visible("[data-tv-item='door:movie']")) && !/film/i.test(await visible("[data-home-doors]")))
	ok("home: no extra row, and Something new is one key", (await page.locator("[data-tv-item='something-new'] >> visible=true").count()) === 1)
	await shot("home")
	await page.locator("[data-tv-item='door:start'] >> visible=true").first().click()
	await page.waitForTimeout(900)
	await settle()
	ok("home: the Start door lands on the Start group of My shows", param("page") === "shows" && new URL(page.url()).hash === "#start" && (await page.evaluate(() => {
		const top = document.getElementById("start")?.getBoundingClientRect().top ?? -1
		return top >= 0 && top < innerHeight * 0.5
	})))
	await open("page=home&member=none&seen=30")
	await page.waitForSelector("[data-home-doors]", { timeout: 15000 })
	const fewer = [...new Set(await page.evaluate(() => [...document.querySelectorAll("[data-home-doors] [data-tv-item]")].filter((el) => el.getBoundingClientRect().width > 0).map((el) => el.dataset.tvItem)))]
	ok("home, nothing started: Start a show, A movie, and Something new as the third tile", fewer.join() === "door:start,door:movie,something-new", fewer.join())
	await shot("home-none")

	// ---------------------------------------------------------------------------------------------- Tonight's pick
	await page.goto(`${base}/prototype/my-library-real?page=shows&member=six&seen=30`, { waitUntil: "networkidle" })
	await page.waitForSelector("[data-harness-pick] img")
	ok("tonight's pick: the Next episode of the show watched last, and it opens My shows", (await page.getAttribute("[data-harness-pick] a", "href")) === "/my-shows" && /S1 E4[\s\S]*Slow Horses/.test(await text("[data-harness-pick]")), await text("[data-harness-pick]"))
	await page.goto(`${base}/prototype/my-library-real?page=shows&member=none&seen=30`, { waitUntil: "networkidle" })
	await page.waitForSelector("[data-harness-pick] img")
	ok("tonight's pick, nothing in progress: the first movie of My movies", (await page.getAttribute("[data-harness-pick] a", "href")) === "/my-movies" && /Past Lives/.test(await text("[data-harness-pick]")), await text("[data-harness-pick]"))

	ok("no page error", errors.length === 0, errors.slice(0, 3).join(" ; "))
	await context.close()
}

await browser.close()
console.log(`${passed} checks passed, ${failed.length} failed`)
for (const line of failed) console.log(`  FAILED ${line}`)
process.exit(failed.length ? 1 : 0)
