// Scripted checks of the real episode tracking components on /prototype/episode-tracking-real, at 390 and 1280.
// HARNESS=http://127.0.0.1:3084 SHOTS=./shots node drive.mjs [phone,desktop]
// Needs playwright-core installed beside it, system Chromium, and the dev server started with REC_TRACKING=on.
import { mkdirSync } from "node:fs"
import { SHOTS, checker, launch, open, settle, stored } from "./lib.mjs"

mkdirSync(SHOTS, { recursive: true })
const browser = await launch()
const { check, results } = checker()
const T = "today=2026-10-08&latency=60"
const sizes = (process.argv[2] ?? "phone,desktop").split(",")

const text = (page, sel) => page.locator(sel).first().innerText().catch(() => "")
const count = (page, sel) => page.locator(sel).count()
const toList = async (page) => {
	await page.evaluate(() => document.querySelector("[data-harness] > div.mt-12")?.scrollIntoView())
	await page.waitForSelector("[data-episode-list]", { timeout: 20000 })
	await settle(page, 300)
}
const pressSeason = (page, n) => page.locator(`[data-season-press="${n}"]`).click({ position: { x: 12, y: 8 } })
const toast = (page) => text(page, "[data-tracking-toast]")
const toastAction = (page, label) => page.locator("[data-tracking-toast] button", { hasText: label }).click()
const noOverflow = (page) => page.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth + 1)
const overlapping = (page) =>
	page.evaluate(() => {
		const posts = window.__gwHarness.requests.filter((r) => r.path === "/api/tracking/show" && r.method === "POST")
		let n = 0
		for (let i = 1; i < posts.length; i++) if (posts[i - 1].endedAt === null || posts[i].startedAt < posts[i - 1].endedAt) n++
		return { posts: posts.length, overlapping: n, ids: posts.map((p) => p.body.actionId ?? p.body.event.type) }
	})
let shellHydration = 0
const cleanErrors = (errors) => { shellHydration += errors.filter((e) => /Suspense boundary received an update/.test(e)).length; return errors.filter((e) => !/Failed to load resource|ERR_|net::|status of 5|status of 4|Suspense boundary received an update/.test(e)) }
const hydration = (errors) => errors.filter((e) => /Suspense boundary received an update/.test(e)).length

for (const size of sizes) {
	const C = (name, ok, detail) => check(`[${size}] ${name}`, ok, detail)

	// ---- Hero: watching ------------------------------------------------------------------
	{
		const { page, errors } = await open(browser, size, `show=supernatural&scenario=watching&${T}`)
		await page.waitForSelector("[data-tracking-hero]")
		C("hero: status pill says Watching", (await text(page, "[data-status-pill]")).trim() === "Watching")
		C("hero: progress 26 of 327", /26 of 327/.test(await text(page, "[data-progress]")))
		C("hero: next episode S2 E5", /S2 E5 · Simon Said/.test(await text(page, "[data-next-episode]")))
		C("hero: one score control", (await count(page, "[data-hero] fieldset")) === 1)
		C("hero: rate prompt, the gentler wording", (await page.locator("[data-rate-prompt]").getAttribute("data-rate-prompt")) === "partway" && /so far\?/.test(await text(page, "[data-rate-prompt]")))
		C("hero: Drop takes Not interested's place", (await count(page, "[data-drop]")) === 1 && (await count(page, "[data-hero] button:has-text('Not interested')")) === 0)
		C("hero: Want to See is off for a started show", await page.locator("[data-hero] button:has-text('Want to See')").isDisabled())
		C("hero: no sideways scroll", await noOverflow(page))
		const boxHeight = await page.locator("[data-tracking-box]").evaluate((el) => el.getBoundingClientRect().height)
		C("hero: the box has the height the first paint reserved", Math.abs(boxHeight - 134) <= 1, String(boxHeight))

		await page.locator("[data-next-watched]").click()
		await settle(page)
		C("watched: progress 27", /27 of 327/.test(await text(page, "[data-progress]")))
		C("watched: next moves to S2 E6", /S2 E6/.test(await text(page, "[data-next-episode]")))
		C("watched: toast names the episode", /S2 E5 marked as watched/.test(await toast(page)))
		let s = await stored(page)
		C("watched: one more log row, dated now, single", s.log.length === 28 && s.log.at(-1).origin === "single" && s.log.at(-1).watched_at_precision === "moment")
		await toastAction(page, "Undo")
		await settle(page)
		s = await stored(page)
		C("undo: the watch is gone", s.log.length === 27 && /26 of 327/.test(await text(page, "[data-progress]")))

		// Not now
		await page.locator("[data-rate-not-now]").click()
		await settle(page)
		C("not now: the prompt is gone and remembered", (await count(page, "[data-rate-prompt]")) === 0 && (await stored(page)).state.rate_prompt_dismissed_at !== null)

		// Status menu
		await page.locator("[data-status-pill]").click()
		C("menu: On hold and Drop", (await count(page, "[data-status-action='hold']")) === 1 && (await count(page, "[data-status-action='drop']")) === 1 && (await count(page, "[data-status-action='resume']")) === 0)
		await page.locator("[data-status-action='hold']").click()
		await settle(page)
		C("hold: pill and stored state", (await text(page, "[data-status-pill]")).trim() === "On hold" && (await stored(page)).state.state === "on_hold")
		C("hold: the next episode stays", /S2 E5/.test(await text(page, "[data-next-episode]")))
		await page.locator("[data-status-pill]").click()
		C("menu on hold: Resume and Drop", (await count(page, "[data-status-action='resume']")) === 1 && (await count(page, "[data-status-action='drop']")) === 1)
		await page.locator("[data-status-action='resume']").click()
		await settle(page)
		C("resume: Watching", (await stored(page)).state.state === "watching")
		await page.locator("[data-drop]").click()
		await settle(page)
		C("drop: Dropped, pressed, no next", (await stored(page)).state.state === "dropped" && (await page.locator("[data-drop]").getAttribute("data-drop")) === "on" && (await count(page, "[data-next-episode]")) === 0)
		C("drop: toast says hidden", /dropped and hidden/.test(await toast(page)))
		await toastAction(page, "Undo")
		await settle(page)
		C("drop undone: Watching", (await stored(page)).state.state === "watching")
		C("hero flows: no page errors", cleanErrors(errors).length === 0, cleanErrors(errors).join(" | "))
		C("hero flows: requests never overlapped", (await overlapping(page)).overlapping === 0)
		await page.context().close()
	}

	// ---- Seen: mark, set a date, take back; the prompt -----------------------------------
	{
		const { page } = await open(browser, size, `show=chernobyl&scenario=wanted&${T}`)
		await page.waitForSelector("[data-tracking-hero]")
		C("fresh: no status box, today's three buttons", (await count(page, "[data-tracking-box]")) === 0 && (await count(page, "[data-hero] button:has-text('Not interested')")) === 1)
		C("fresh: Want to See is on", (await page.locator("[data-hero] button:has-text('Want to See')").getAttribute("aria-pressed")) === "true")
		await page.locator("[data-seen-button]").click()
		await settle(page)
		let s = await stored(page)
		C("seen: stored Seen with the press standing, 5 undated rows", s.state.state === "seen" && s.state.seen_press_from === "not_started" && s.log.length === 5 && s.log.every((r) => r.origin === "seen" && r.watched_at === null))
		C("seen: the Wishlist is cleared", s.wantToSee === false && (await page.locator("[data-hero] button:has-text('Want to See')").getAttribute("aria-pressed")) === "false")
		C("seen: label Seen for an ended show", (await text(page, "[data-status-pill]")).trim() === "Seen")
		C("seen: 5 of 5", /5 of 5/.test(await text(page, "[data-progress]")))
		C("seen: the button takes the press back", (await page.locator("[data-seen-button]").getAttribute("data-seen-button")) === "takeBack")
		C("seen: the prompt to rate asks about all of it", /You've watched all of Chernobyl/.test(await text(page, "[data-rate-prompt]")))
		C("seen: one score control", (await count(page, "[data-hero] fieldset")) === 1)
		C("seen: toast offers Set a date and Undo", /5 episodes marked, date unknown/.test(await toast(page)) && (await count(page, "[data-tracking-toast] button:has-text('Set a date')")) === 1)
		await toastAction(page, "Set a date")
		await page.locator("[role=dialog] input[type=date]").fill("2026-10-01")
		await page.locator("[role=dialog] button:has-text('Set date')").click()
		await settle(page)
		s = await stored(page)
		C("set a date: every row of the group has the day", s.log.every((r) => r.watched_at_precision === "day" && new Date(r.watched_at).toISOString().startsWith("2026-10-01")))
		// Watch again
		await page.locator("[data-status-pill]").click()
		C("menu seen: Watch again only", (await count(page, "[data-status-action]")) === 1 && (await count(page, "[data-status-action='watchAgain']")) === 1)
		await page.locator("[data-status-action='watchAgain']").click()
		await page.locator("[data-confirm-watch-again]").click()
		await settle(page)
		s = await stored(page)
		C("watch again: pass 2, Watching, the log kept", s.state.state === "watching" && s.state.pass === 2 && s.log.length === 5)
		C("watch again: progress reads Pass 2 · 0 of 5, next S1 E1", /Pass 2 · 0 of 5/.test((await text(page, "[data-progress]")).replace(/\s+/g, " ")) && /S1 E1/.test(await text(page, "[data-next-episode]")))
		await toList(page)
		C("watch again: the list's ticks are empty", (await count(page, "[data-episode][data-watched]")) === 0)
		await page.locator("[data-episode] [data-tick]").first().click()
		await settle(page)
		await page.locator("[data-episode] [data-row]").first().click()
		await settle(page, 200)
		C("watch again: the episode shows both passes' watches", (await count(page, "[data-episode-log] [data-logged-watch]")) === 2 && (await count(page, "[data-logged-watch='1']")) === 1 && (await count(page, "[data-logged-watch='2']")) === 1)
		await page.screenshot({ path: `${SHOTS}/watch-again-${size}.jpg`, type: "jpeg", quality: 60 })
		await page.context().close()
	}
	{
		const { page } = await open(browser, size, `show=chernobyl&scenario=wanted&${T}`)
		await page.waitForSelector("[data-tracking-hero]")
		await page.locator("[data-seen-button]").click()
		await settle(page)
		await toastAction(page, "Undo")
		await settle(page, 700)
		let s = await stored(page)
		C("undo of the Seen press: nothing stored, and Want to See is back at its time", s.state === null && s.log.length === 0 && s.wantToSee === true && s.wishlistAt.startsWith("2026-09-08"), JSON.stringify([s.wantToSee, s.wishlistAt]))
		C("undo of the Seen press: the button shows Want to See again", (await page.locator("[data-hero] button:has-text('Want to See')").getAttribute("aria-pressed")) === "true")
		await page.locator("[data-seen-button]").click()
		await settle(page)
		await page.locator("[data-seen-button]").click()
		await settle(page)
		s = await stored(page)
		C("seen again: back to no row and no watch", s.state === null && s.log.length === 0)
		await page.context().close()
	}
	{
		const { page } = await open(browser, size, `show=slow-horses&scenario=fresh&${T}`)
		await page.waitForSelector("[data-tracking-hero]")
		await page.locator("[data-seen-button]").click()
		await settle(page)
		C("a running show reads Caught up", (await text(page, "[data-status-pill]")).trim() === "Caught up")
		C("a running show names the next air date", /airs/.test(await text(page, "[data-no-next]")), await text(page, "[data-no-next]"))
		await page.context().close()
	}
	{
		const { page } = await open(browser, size, `show=supernatural&scenario=seen_new&${T}`)
		await page.waitForSelector("[data-tracking-hero]")
		C("seen with new: Seen · 20 new episodes", /Seen · 20 new episodes/.test(await text(page, "[data-status-pill]")), await text(page, "[data-status-pill]"))
		C("seen with new: the button marks them", (await page.locator("[data-seen-button]").getAttribute("data-seen-button")) === "markNew" && /Mark 20 new/.test(await text(page, "[data-seen-button]")))
		C("seen with new: new since you saw it", /New since you saw it/i.test(await text(page, "[data-next-episode]")) && /S15 E1/.test(await text(page, "[data-next-episode]")))
		C("seen with new: scored, so no prompt", (await count(page, "[data-rate-prompt]")) === 0)
		await page.locator("[data-seen-button]").click()
		await settle(page)
		const s = await stored(page)
		C("mark new: a group of its own, pressed from Seen", s.state.state === "seen" && s.state.seen_press_from === "seen" && s.log.length === 327)
		C("mark new: label Seen", (await text(page, "[data-status-pill]")).trim() === "Seen")
		await page.context().close()
	}
	{
		const { page } = await open(browser, size, `show=chernobyl&scenario=seen_ticked&${T}`)
		await page.waitForSelector("[data-tracking-hero]")
		C("seen by ticks: the button is off and says why", (await page.locator("[data-seen-button]").getAttribute("data-seen-button")) === "off" && /Untick one to change that/.test(await text(page, "[data-seen-off]")))
		await page.locator("[data-seen-button]").click({ force: true })
		await settle(page)
		C("seen by ticks: a press changes nothing", (await stored(page)).log.length === 5 && (await stored(page)).state.state === "seen")
		await page.context().close()
	}

	// ---- Have you seen all of it? ---------------------------------------------------------
	for (const answer of ["yes", "partway", "just_rating"]) {
		const { page } = await open(browser, size, `show=chernobyl&scenario=fresh&${T}`)
		await page.waitForSelector("[data-tracking-hero]")
		C(`question (${answer}): not asked before a score`, (await count(page, "[data-seen-question]")) === 0)
		await page.locator("[data-hero] fieldset button[aria-label^='Good']").click()
		await page.waitForSelector("[data-seen-question]", { timeout: 5000 }).catch(() => {})
		C(`question (${answer}): asked after a first score by hand`, (await count(page, "[data-seen-question]")) === 1 && (await stored(page)).state?.seen_question === "open")
		if (answer === "yes" && size === "phone") await page.locator("[data-hero]").screenshot({ path: `${SHOTS}/question-${size}.jpg`, type: "jpeg", quality: 60 })
		await page.locator(`[data-seen-answer='${answer}']`).click()
		await settle(page, 900)
		const s = await stored(page)
		C(`question (${answer}): gone`, (await count(page, "[data-seen-question]")) === 0)
		if (answer === "yes") C("question yes: the show is Seen", s.state.state === "seen" && s.log.length === 5 && s.state.seen_question === "answered")
		if (answer === "partway") {
			C("question partway: answered, nothing marked", s.state.seen_question === "answered" && s.log.length === 0)
			C("question partway: the episode list is opened", (await count(page, "[data-episode-list]")) === 1 && (await page.locator("[data-episode-list]").evaluate((el) => el.getBoundingClientRect().top < window.innerHeight)))
		}
		if (answer === "just_rating") C("question just rating: answered, nothing marked", s.state.seen_question === "answered" && s.state.state === "not_started" && s.log.length === 0)
		await page.context().close()
	}

	// ---- The episode list: never tracked --------------------------------------------------
	{
		const { page, errors } = await open(browser, size, `show=supernatural&scenario=fresh&${T}`)
		await toList(page)
		C("never tracked: the matrix, 16 rows", (await page.locator("[data-episode-list]").getAttribute("data-episode-list")) === "matrix" && (await count(page, "[data-season-row]")) === 16)
		C("never tracked: no watched and no next mark", (await count(page, "[data-cell][data-watched]")) === 0 && (await count(page, "[data-cell][data-next]")) === 0)
		C("never tracked: rated cells are coloured", (await count(page, "[data-cell][data-rated]")) > 300)
		C("never tracked: no Next button", (await count(page, "[data-jump-next]")) === 0)
		C("never tracked: the IMDb grid is behind a link", (await page.locator("[data-imdb-grid]").getAttribute("data-imdb-grid")) === "folded" && (await count(page, "#episode-grid-title")) === 0)
		await page.locator("[data-imdb-grid] > button").click()
		await settle(page, 200)
		C("never tracked: the link opens the grid", (await count(page, "#episode-grid-title")) === 1 && (await count(page, "[id='episode-ratings']")) === 1)
		await page.locator("[data-imdb-grid] > button").click()
		const heights = await page.locator("[data-season-press]").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))
		if (size === "phone") C("phone: every season row is a 40 px press target", heights.every((h) => h >= 40), String(Math.min(...heights)))
		else C("desktop: season rows are 22 px for a mouse", heights.every((h) => Math.abs(h - 22) < 1), String(heights[0]))
		const matrix = await page.locator("[data-matrix]").evaluate((el) => el.getBoundingClientRect().height)
		console.log(`[${size}] matrix height, 15 seasons and specials: ${Math.round(matrix)}`)
		const section = await page.locator("[data-episode-list]").evaluate((el) => el.getBoundingClientRect().height)
		console.log(`[${size}] episodes section, level 0: ${Math.round(section)}`)
		C("never tracked: no sideways scroll", await noOverflow(page))
		// The first tick from the list starts the show.
		await pressSeason(page, 1)
		await settle(page, 300)
		C("season open: its rows, the other seasons stay", (await count(page, "[data-season-panel='1']")) === 1 && (await count(page, "[data-season-row]")) === 16 && (await count(page, "[data-season-panel] [data-episode]")) >= 8)
		await page.locator("[data-episode] [data-tick]").first().click()
		await settle(page)
		C("first tick: Watching, and the hero's box appears", (await stored(page)).state.state === "watching" && (await count(page, "[data-tracking-box]")) === 1)
		C("first tick: the matrix marks it and rings the next", (await count(page, "[data-cell][data-watched]")) === 1 && (await count(page, "[data-cell][data-next]")) === 1)
		await page.locator("[data-episode] [data-tick]").first().click()
		await settle(page)
		C("untick the only episode: Not started again", (await stored(page)).state === null && (await stored(page)).log.length === 0)
		C("untick: toast offers Undo", /is unwatched again/.test(await toast(page)))
		await toastAction(page, "Undo")
		await settle(page)
		C("undo of an untick: watched again", (await stored(page)).log.length === 1 && (await stored(page)).state.state === "watching")
		C("never tracked flows: no page errors", cleanErrors(errors).length === 0, cleanErrors(errors).join(" | "))
		await page.context().close()
	}

	// ---- The episode list: tracking --------------------------------------------------------
	{
		const { page, errors } = await open(browser, size, `show=supernatural&scenario=watching&${T}`)
		await toList(page)
		C("tracking: 26 watched cells, one next", (await count(page, "[data-cell][data-watched]")) === 26 && (await count(page, "[data-cell][data-next]")) === 1)
		C("tracking: season 1 done, season 2 at 4/22", /4\/22/.test(await text(page, "[data-season-row='2'] [data-count]")) && (await count(page, "[data-season-row='1'] [data-count] svg")) === 1)
		C("tracking: specials row counts 1/101, not in progress", /1\/101/.test(await text(page, "[data-season-row='0'] [data-count]")))
		if (size === "desktop") C("desktop: the hint box stands beside the matrix", (await count(page, "[data-beside-empty]")) === 1)
		await page.locator("[data-episode-list]").screenshot({ path: `${SHOTS}/list-level0-${size}.jpg`, type: "jpeg", quality: 60 })

		// Next
		await page.locator("[data-jump-next]").click()
		await settle(page, 400)
		C("Next: opens season 2 with the next row selected", (await count(page, "[data-season-panel='2']")) === 1 && (await count(page, "[data-episode][data-selected]")) === 1 && /Simon Said/.test(await text(page, "[data-episode][data-selected]")))
		// Further down, so that the page has room to scroll back by the height of the season that closes.
		await pressSeason(page, 12)
		await settle(page, 300)
		await page.locator("[data-season-row='14']").evaluate((el) => el.scrollIntoView({ block: "center" }))
		await settle(page, 900)
		const before = await page.locator("[data-season-row='14']").evaluate((el) => el.getBoundingClientRect().top)
		// A press in the page itself: Playwright's own click first scrolls the row to where it likes it.
		await page.locator("[data-season-press='14']").evaluate((el) => el.click())
		await settle(page, 300)
		const after = await page.locator("[data-season-row='14']").evaluate((el) => el.getBoundingClientRect().top)
		C("the season above closed", (await count(page, "[data-season-panel='12']")) === 0 && (await count(page, "[data-season-panel='14']")) === 1)
		await pressSeason(page, 5)
		await settle(page, 300)
		C("a pressed season row stays where it is", Math.abs(after - before) <= 2, `${before} -> ${after}`)
		C("another season: its panel replaces the open one", (await count(page, "[data-season-panel]")) === 1 && (await count(page, "[data-season-panel='5']")) === 1)
		if (size === "phone") {
			await page.locator("[data-step='-1']").click()
			await settle(page, 300)
			C("phone: the arrow steps to the season before", (await count(page, "[data-season-panel='4']")) === 1)
			const steps = await page.locator("[data-step]").evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => Math.min(r.width, r.height)))
			C("phone: the arrows are 40 px", steps.every((s) => s >= 40), String(steps))
			await pressSeason(page, 5)
			await settle(page, 300)
		}
		// Mark season
		await page.locator("[data-mark-season]").click()
		await settle(page)
		let s = await stored(page)
		const group = s.log.filter((r) => r.origin === "season" && r.season_number === 5)
		C("mark season: 22 undated rows in one group", group.length === 22 && new Set(group.map((r) => r.group_id)).size === 1 && group.every((r) => r.watched_at === null))
		C("mark season: toast offers Set a date and Undo", /22 episodes marked, date unknown/.test(await toast(page)) && (await count(page, "[data-tracking-toast] button")) === 3)
		C("mark season: the row shows the season done", (await count(page, "[data-season-row='5'] [data-count] svg")) === 1)
		await toastAction(page, "Undo")
		await settle(page)
		s = await stored(page)
		C("undo of mark season: the group is gone", s.log.filter((r) => r.season_number === 5).length === 0 && s.state.state === "watching")

		// A row
		await pressSeason(page, 2)
		await settle(page, 300)
		const row = page.locator("[data-episode]", { hasText: "Crossroad Blues" })
		await row.locator("[data-row]").click()
		await settle(page, 250)
		C("row open: still, air date and the date choice", (await row.locator("[data-detail] img").count()) === 1 && /Nov 16, 2006/.test(await row.locator("[data-detail]").innerText()) && (await row.locator("[data-watch-now]").count()) === 1)
		C("row open: Watched up to here counts the gap", /Watched up to here \(4\)/.test(await row.locator("[data-up-to-here]").innerText()), await row.locator("[data-up-to-here]").innerText().catch(() => "none"))
		await page.locator("[data-episode-list]").screenshot({ path: `${SHOTS}/list-row-open-${size}.jpg`, type: "jpeg", quality: 60 })
		await row.locator("[data-watch-day]").fill("2026-10-02")
		await settle(page)
		s = await stored(page)
		let made = s.log.find((r) => r.season_number === 2 && r.episode_number === 8)
		C("date choice: a day records the watch on that day", made?.watched_at_precision === "day" && new Date(made.watched_at).toISOString().startsWith("2026-10-02"))
		C("date choice: the row says so", /Watched Oct 2, 2026/.test(await row.locator("[data-watched-when]").innerText()))
		await row.locator("[data-watch-unknown]").click()
		await settle(page)
		made = (await stored(page)).log.find((r) => r.season_number === 2 && r.episode_number === 8)
		C("date choice: don't know when clears the date", made?.watched_at === null && made.watched_at_precision === "unknown")
		C("a watch past a gap: the next episode stays after the furthest", /S2 E9/.test(await text(page, "[data-jump-next]")), await text(page, "[data-jump-next]"))
		await row.locator("[data-remove-watch]").click()
		await settle(page)
		C("remove watch: gone", !(await stored(page)).log.some((r) => r.season_number === 2 && r.episode_number === 8))
		await row.locator("[data-row]").click()
		await settle(page, 200)
		await row.locator("[data-up-to-here]").click()
		await settle(page)
		s = await stored(page)
		const upto = s.log.filter((r) => r.origin === "upto")
		C("watched up to here: the gap as one undated group", upto.length === 4 && new Set(upto.map((r) => r.group_id)).size === 1 && upto.every((r) => r.watched_at === null))
		C("watched up to here: toast offers Set a date", /4 episodes marked, date unknown/.test(await toast(page)))

		// A special
		const progress = await text(page, "[data-progress]")
		await pressSeason(page, 0)
		await settle(page, 300)
		await page.locator("[data-season-panel='0'] [data-episode]:not([data-watched]) [data-tick]:not([disabled])").first().click()
		await settle(page)
		C("a special can be ticked and changes no progress", (await text(page, "[data-progress]")) === progress && /2\/101/.test(await text(page, "[data-season-row='0'] [data-count]")) && /Specials don't count/.test(await toast(page)))

		// Finder
		if (size === "phone") await page.locator("[data-finder-open]").click()
		await page.locator("input[aria-label='Find an episode']").fill("9x14")
		await settle(page, 200)
		C("finder: 9x14 finds the episode", /S9 E14/.test(await text(page, "[data-found]")))
		await page.keyboard.press("Enter")
		await settle(page, 500)
		C("finder: lands on S9 E14, selected", (await count(page, "[data-season-panel='9']")) === 1 && /Captives/.test(await text(page, "[data-episode][data-selected]")))
		await page.locator("input[aria-label='Find an episode']").fill("captiv")
		await settle(page, 200)
		C("finder: part of a name", /Captives/.test(await text(page, "[data-found]")))
		await page.keyboard.press("Escape")

		// Three quick ticks: sent one after the other
		await pressSeason(page, 3)
		await settle(page, 300)
		const ticks = page.locator("[data-season-panel='3'] [data-episode] [data-tick]")
		const from = (await stored(page)).log.length
		await ticks.nth(0).click()
		await ticks.nth(1).click()
		await ticks.nth(2).click()
		C("three quick ticks: all shown at once", (await count(page, "[data-season-panel='3'] [data-episode][data-watched]")) === 3)
		await settle(page, 900)
		const o = await overlapping(page)
		C("three quick ticks: stored, in order, never two requests at once", (await stored(page)).log.length === from + 3 && o.overlapping === 0, JSON.stringify(o))

		// A failed request
		await page.evaluate(() => {
			window.__gwHarness.failNext = 500
			window.__gwHarness.options.latency = 700
		})
		await page.evaluate(() => {
			const all = document.querySelectorAll("[data-season-panel='3'] [data-episode] [data-tick]")
			all[3].click()
			all[4].click()
		})
		await settle(page, 20)
		C("failure: the ticks are shown first", (await count(page, "[data-season-panel='3'] [data-episode][data-watched]")) === 5)
		await settle(page, 1500)
		C("failure: both ticks are taken back, and the page says so", (await count(page, "[data-season-panel='3'] [data-episode][data-watched]")) === 3 && (await count(page, "[data-tracking-toast='error']")) === 1 && /taken back/.test(await toast(page)), await toast(page))
		C("failure: nothing of them is stored", (await stored(page)).log.length === from + 3)
		await ticks.nth(3).click()
		await settle(page, 1200)
		C("failure: the page works on", (await stored(page)).log.length === from + 4)
		C("tracking flows: no sideways scroll", await noOverflow(page))
		C("tracking flows: no page errors", cleanErrors(errors).length === 0, cleanErrors(errors).join(" | "))
		C("tracking flows: one toast host", (await count(page, "[data-tracking-toast]")) <= 1)
		await page.context().close()
	}

	// ---- The hero's Next episode opens the list --------------------------------------------
	{
		const { page } = await open(browser, size, `show=supernatural&scenario=watching&${T}`)
		await page.waitForSelector("[data-tracking-hero]")
		await page.locator("[data-next-episode]").click()
		await page.waitForSelector("[data-episode][data-selected]", { timeout: 20000 }).catch(() => {})
		await settle(page, 900)
		const top = await page.locator("[data-episode][data-selected]").evaluate((el) => el.getBoundingClientRect().top).catch(() => -1)
		C("hero next: the list opens at the episode, in view", top > 0 && top < 844, String(top))
		await page.context().close()
	}

	// ---- Unaired, by the device's date ------------------------------------------------------
	{
		const { page } = await open(browser, size, `show=slow-horses&scenario=watching&${T}`)
		await toList(page)
		const seasons = await page.locator("[data-season-press]").evaluateAll((els) => els.map((el) => Number(el.dataset.seasonPress)))
		const last = Math.max(...seasons)
		await pressSeason(page, last)
		await settle(page, 300)
		if (await count(page, "[data-fold='later']")) await page.locator("[data-fold='later']").click()
		const disabled = await page.locator(`[data-season-panel='${last}'] [data-tick][disabled]`).count()
		const dashed = await page.locator(`[data-season-row='${last}'] [data-cell]:not([data-rated])`).count()
		C("airing season: episodes that have not aired can't be ticked", disabled > 0, `${disabled} disabled, ${dashed} unrated cells`)
		C("airing season: the head says how many are to air", /to air/.test(await text(page, "[data-season-count]")))
		await page.locator("[data-episode-list]").screenshot({ path: `${SHOTS}/list-airing-${size}.jpg`, type: "jpeg", quality: 60 })
		await page.context().close()
	}

	// ---- A limited series ---------------------------------------------------------------------
	{
		const { page } = await open(browser, size, `show=chernobyl&scenario=fresh&${T}`)
		await toList(page)
		C("limited series: only its rows", (await page.locator("[data-episode-list]").getAttribute("data-episode-list")) === "rows" && (await count(page, "[data-episode]")) === 5 && (await count(page, "[data-matrix]")) === 0)
		C("limited series: no finder and no Next", (await count(page, "input[aria-label='Find an episode']")) === 0 && (await count(page, "[data-finder-open]")) === 0 && (await count(page, "[data-jump-next]")) === 0)
		C("limited series: no still before a press", (await count(page, "[data-episode] img")) === 0)
		const rows = await page.locator("[data-episode] [data-tick]").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))
		if (size === "phone") C("phone: ticks are 44 px", rows.every((h) => h >= 44))
		await page.locator("[data-episode-list]").screenshot({ path: `${SHOTS}/list-limited-${size}.jpg`, type: "jpeg", quality: 60 })
		// Watching through from the list
		for (let i = 0; i < 5; i++) await page.locator("[data-episode] [data-tick]").nth(i).click()
		await settle(page, 1200)
		const s = await stored(page)
		C("watching through: Seen, with no press to take back", s.state.state === "seen" && s.state.seen_press_group === null && s.log.length === 5)
		C("watching through: the toast says so", /You've watched every episode of Chernobyl/.test(await toast(page)))
		await page.context().close()
	}

	// ---- IMDb numbers a season differently ---------------------------------------------------
	{
		const { page } = await open(browser, size, `show=supernatural&scenario=fresh&imdb=differs&${T}`)
		await toList(page)
		await pressSeason(page, 1)
		await settle(page, 300)
		C("numbering differs: the open season says so", /IMDb numbers this season differently/.test(await text(page, "[data-numbering-note]")))
		C("numbering differs: an episode goes without a rating rather than a neighbour's", (await count(page, "[data-season-row='1'] [data-cell]:not([data-rated])")) >= 1 && (await count(page, "[data-chip='missing']")) >= 1)
		await page.context().close()
	}

	// ---- A show without an episode list --------------------------------------------------------
	{
		const { page, errors } = await open(browser, size, `show=supernatural&scenario=fresh&list=none&${T}`)
		await settle(page, 800)
		await page.evaluate(() => document.querySelector("[data-harness] > div.mt-12")?.scrollIntoView())
		await settle(page, 1200)
		C("no list: no tracking hero and no episode list", (await count(page, "[data-tracking-hero]")) === 0 && (await count(page, "[data-episode-list]")) === 0)
		C("no list: today's grid and today's three buttons", (await count(page, "#episode-grid-title")) === 1 && (await count(page, "[data-hero] button:has-text('Not interested')")) === 1 && (await count(page, "[data-hero] button:has-text('Mark as Seen')")) === 1)
		await page.evaluate(() => window.scrollTo(0, 0))
		await page.locator("[data-hero] button:has-text('Mark as Seen')").click()
		await settle(page, 900)
		C("no list: today's Seen press works and the status shows", (await stored(page)).state?.state === "seen" && (await count(page, "[data-tracking-box]")) === 1 && /Seen/.test(await text(page, "[data-tracking-box]")))
		C("no list: no page errors", cleanErrors(errors).length === 0, cleanErrors(errors).join(" | "))
		await page.context().close()
	}

	// ---- A visitor ------------------------------------------------------------------------------
	{
		const { page } = await open(browser, size, `show=supernatural&scenario=watching&guest=1&${T}`)
		await page.evaluate(() => document.querySelector("[data-harness] > div.mt-12")?.scrollIntoView())
		await settle(page, 1200)
		const sent = await page.evaluate(() => window.__gwHarness.requests.filter((r) => r.path === "/api/tracking/show").length)
		C("visitor: no tracking UI, today's grid, and no tracking request", (await count(page, "[data-tracking-hero]")) === 0 && (await count(page, "[data-tracking-box]")) === 0 && (await count(page, "[data-episode-list]")) === 0 && (await count(page, "#episode-grid-title")) === 1 && sent === 0)
		const chunks = await page.evaluate(() => performance.getEntriesByType("resource").map((r) => r.name).filter((n) => /ui\/tracking\/(HeroTracking|EpisodeList|actions|TrackingToast)/.test(n)))
		C("visitor: no tracking code is requested", chunks.length === 0, chunks.join(","))
		await page.context().close()
	}

	// ---- Dropped with nothing watched: Want to See ---------------------------------------------
	{
		const { page } = await open(browser, size, `show=chernobyl&scenario=dropped&${T}`)
		await page.waitForSelector("[data-tracking-hero]")
		C("dropped: pill Dropped, the menu offers Resume", (await text(page, "[data-status-pill]")).trim() === "Dropped")
		C("dropped with watches: Want to See is off", await page.locator("[data-hero] button:has-text('Want to See')").isDisabled())
		await toList(page)
		for (let i = 0; i < 3; i++) {
			await page.locator("[data-episode][data-watched] [data-tick]").first().click()
			await settle(page, 300)
		}
		let s = await stored(page)
		C("dropped: unticking everything keeps Dropped", s.state.state === "dropped" && s.log.length === 0)
		await page.evaluate(() => window.scrollTo(0, 0))
		await page.locator("[data-hero] button:has-text('Want to See')").click()
		await settle(page, 700)
		s = await stored(page)
		C("dropped, nothing watched: Want to See makes it Not started and wanted", s.state === null && s.wantToSee === true && (await page.locator("[data-hero] button:has-text('Want to See')").getAttribute("aria-pressed")) === "true")
		await page.context().close()
	}
}

await browser.close()
console.log(`hydration notices of the app shell in dev: ${shellHydration}`)
const failed = results.filter((r) => !r.ok)
console.log(`${results.length - failed.length} of ${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.name} ${f.detail}`)
process.exit(failed.length ? 1 : 0)
