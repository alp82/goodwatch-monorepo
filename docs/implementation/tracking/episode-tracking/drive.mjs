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
const menuIds = async (page) => {
	if (!(await count(page, "[role=menu]"))) await page.locator("[data-status-pill]").click()
	const ids = await page.locator("[data-status-action]").evaluateAll((els) => els.map((el) => el.dataset.statusAction))
	await page.keyboard.press("Escape")
	return ids.join(",")
}
const menuPick = async (page, id) => {
	await page.locator("[data-status-pill]").click()
	await page.locator(`[data-status-action='${id}']`).click()
	await settle(page)
}
const posts = (page) => page.evaluate(() => window.__gwHarness.requests.filter((r) => r.path === "/api/tracking/show" && r.method === "POST").length)
const top = (page, sel) => page.locator(sel).first().evaluate((el) => Math.round(el.getBoundingClientRect().top))
/** Where an element is on the page, whatever the scroll position. */
const pageTop = (page, sel) => page.locator(sel).first().evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY))
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

		// The box's button leads to the episode; it records nothing.
		C("box: no Watched button", (await count(page, "[data-next-watched]")) === 0 && (await count(page, "[data-tracking-box] button:has-text('Watched')")) === 0)
		C("box: the button says where it goes", (await text(page, "[data-go-episodes]")).trim() === "S2 E5")
		const go = await page.locator("[data-next-episode]").evaluate((el) => ({ tag: el.tagName, href: el.getAttribute("href"), pressed: el.getAttribute("aria-pressed"), role: el.getAttribute("role"), name: el.getAttribute("aria-label") }))
		C("box: it is a link to the episodes section, not a toggle", go.tag === "A" && go.href === "#episode-ratings" && go.pressed === null && go.role === null && /Next episode: S2 E5, Simon Said\. Go to it in the episode list/.test(go.name), JSON.stringify(go))
		const sentBefore = await posts(page)
		await page.locator("[data-next-episode]").focus()
		await page.keyboard.press("Enter")
		await page.waitForSelector("[data-episode][data-selected]", { timeout: 20000 }).catch(() => {})
		await settle(page, 900)
		C("box: Enter on the link opens season 2 with the Next row highlighted", (await count(page, "[data-season-panel='2']")) === 1 && /Simon Said/.test(await text(page, "[data-episode][data-selected]")))
		const rowTop = await top(page, "[data-episode][data-selected]").catch(() => -1)
		C("box: the row is in view", rowTop > 0 && rowTop < 844, String(rowTop))
		let s = await stored(page)
		C("box: nothing was recorded and nothing sent, and no toast", s.log.length === 27 && (await posts(page)) === sentBefore && (await count(page, "[data-tracking-toast]")) === 0)
		C("box: marking happens in the list", (await page.locator("[data-episode][data-selected] [data-tick]").getAttribute("aria-checked")) === "false")
		await page.evaluate(() => window.scrollTo(0, 0))

		// Not now
		await page.locator("[data-rate-not-now]").click()
		await settle(page)
		C("not now: the prompt is gone and remembered", (await count(page, "[data-rate-prompt]")) === 0 && (await stored(page)).state.rate_prompt_dismissed_at !== null)

		// Status menu
		C("menu Watching: mark all, On hold, Drop", (await menuIds(page)) === "markAll,hold,drop", await menuIds(page))
		await page.locator("[data-status-pill]").click()
		C("menu: every entry has a label and one line under it", (await page.locator("[data-status-action]").evaluateAll((els) => els.every((el) => el.children[1].children.length === 2 && el.children[1].children[1].textContent.length > 10))))
		C("menu: the words are the machine's", /Mark all aired episodes watched/.test(await text(page, "[data-status-action='markAll']")) && /Marks the 301 you haven't ticked, without dates\. The show is then Seen\./.test(await text(page, "[data-status-action='markAll']")) && /Put on hold/.test(await text(page, "[data-status-action='hold']")))
		C("menu: Drop is last and quiet", (await page.locator("[data-status-action]").last().getAttribute("data-status-action")) === "drop" && (await page.locator("[data-status-action='drop']").getAttribute("data-quiet")) === "true" && (await page.locator("[data-status-action='hold']").getAttribute("data-quiet")) === null)
		await page.keyboard.press("ArrowDown")
		await page.keyboard.press("ArrowDown")
		C("menu: the arrow keys move through it", (await page.evaluate(() => document.activeElement?.getAttribute("data-status-action"))) !== null)
		C("menu: fits the screen", await page.locator("[role=menu]").evaluate((el) => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth }))
		await page.keyboard.press("Escape")
		C("menu: Escape closes it and returns to the pill", (await count(page, "[role=menu]")) === 0 && (await page.evaluate(() => document.activeElement?.hasAttribute("data-status-pill"))))
		await menuPick(page, "hold")
		C("hold: pill and stored state", (await text(page, "[data-status-pill]")).trim() === "On hold" && (await stored(page)).state.state === "on_hold")
		C("hold: the next episode stays", /S2 E5/.test(await text(page, "[data-next-episode]")))
		C("menu On hold: Resume, mark all, Drop", (await menuIds(page)) === "resume,markAll,drop", await menuIds(page))
		await menuPick(page, "resume")
		C("resume: Watching", (await stored(page)).state.state === "watching")
		await page.locator("[data-drop]").click()
		await settle(page)
		C("drop: Dropped, pressed, no next", (await stored(page)).state.state === "dropped" && (await page.locator("[data-drop]").getAttribute("data-drop")) === "on" && (await count(page, "[data-next-episode]")) === 0)
		C("drop: toast says hidden", /dropped and hidden/.test(await toast(page)))
		await toastAction(page, "Undo")
		await settle(page)
		C("drop undone: Watching", (await stored(page)).state.state === "watching")
		// Mark all aired episodes watched, from the menu: a Seen press, whose line then says what it covered.
		await menuPick(page, "markAll")
		s = await stored(page)
		C("menu mark all: a Seen press from Watching, 301 undated rows", s.state.state === "seen" && s.state.seen_press_from === "watching" && s.log.filter((r) => r.origin === "seen").length === 301)
		C("menu Seen with a press: Watch again, take back, set a date", (await menuIds(page)) === "watchAgain,takeBack,setDate", await menuIds(page))
		await toList(page)
		C("press line: a part of a season is said as a part", (await text(page, "[data-seen-press] span")) === "Marked Seen on 8 Oct 2026 · seasons 3 to 15, and 18 of the 22 episodes of season 2 (301 episodes), no dates recorded", await text(page, "[data-seen-press] span"))
		await page.evaluate(() => window.scrollTo(0, 0))
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
		C("menu Seen: Watch again, take back, set a date", (await menuIds(page)) === "watchAgain,takeBack,setDate", await menuIds(page))
		await page.locator("[data-status-pill]").click()
		C("menu Seen: taking back names the count and the day, and where the show goes", /Removes the 5 episodes marked on 8 Oct 2026\. The show is then Not started\./.test(await text(page, "[data-status-action='takeBack']")), await text(page, "[data-status-action='takeBack']"))
		C("menu Seen: Set a date for those 5 watches", /Set a date for those 5 watches/.test(await text(page, "[data-status-action='setDate']")))
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
		const toggle = page.locator("[data-view-toggle]")
		C("grid toggle: in the heading line, off, named for assistive tech, no text link below", (await toggle.getAttribute("aria-pressed")) === "false" && /All ratings as one grid, in IMDb's numbering/.test(await toggle.getAttribute("aria-label")) && (await count(page, "#episode-grid-title")) === 0 && (await count(page, "[data-episode-list] button:has-text('All ratings as one grid')")) === 0)
		const head = await page.evaluate(() => {
			const box = (sel) => document.querySelector(sel).getBoundingClientRect()
			const title = box("#episode-list-title")
			const t = box("[data-view-toggle]")
			const section = box("[data-episode-list]")
			return { sameLine: t.top < title.bottom && t.bottom > title.top, atRight: section.right - t.right <= 1, leftOfTitle: t.left > title.right, height: t.height, hasMiniature: document.querySelectorAll("[data-view-toggle] [aria-hidden] > span").length }
		})
		C("grid toggle: on the heading's line, at the right edge, with a miniature of the grid", head.sameLine && head.atRight && head.leftOfTitle && head.hasMiniature === 12, JSON.stringify(head))
		if (size === "phone") C("phone: the toggle is a 40 px press target", head.height >= 40, String(head.height))
		const titleTop = await pageTop(page, "#episode-list-title")
		await toggle.click()
		await settle(page, 300)
		C("grid toggle: the grid takes the matrix's place", (await toggle.getAttribute("aria-pressed")) === "true" && (await count(page, "#episode-grid-title")) === 1 && (await count(page, "[id='episode-ratings']")) === 1 && (await count(page, "[data-matrix]")) === 0 && (await page.locator("[data-episode-list]").getAttribute("data-view")) === "grid")
		C("grid toggle: the heading stays where it was, and there is one visible heading", (await pageTop(page, "#episode-list-title")) === titleTop && (await page.locator("#episode-grid-title").evaluate((el) => el.getBoundingClientRect().width <= 1)))
		C("grid toggle: no sideways scroll with the grid", await noOverflow(page))
		// Remembered in this browser: the same member opens another show.
		const other = await page.context().newPage()
		await other.goto(page.url().replace("show=supernatural", "show=sherlock"), { waitUntil: "domcontentloaded" })
		await other.waitForSelector("[data-harness]", { timeout: 60000 })
		await settle(other, 900)
		await toList(other)
		C("grid toggle: remembered for the next show", (await other.locator("[data-view-toggle]").getAttribute("aria-pressed")) === "true" && (await count(other, "#episode-grid-title")) === 1)
		await other.close()
		await toggle.click()
		await settle(page, 300)
		C("grid toggle: back to the matrix", (await toggle.getAttribute("aria-pressed")) === "false" && (await count(page, "[data-matrix]")) === 1 && (await count(page, "#episode-grid-title")) === 0 && (await page.evaluate(() => localStorage.getItem("gw:episodes-view"))) === null)
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
		const tick = await page.locator("[data-episode] [data-tick]").first().evaluate((el) => {
			const box = el.querySelector("[data-tick-box]")
			const r = box.getBoundingClientRect()
			return { role: el.getAttribute("role"), checked: el.getAttribute("aria-checked"), pressed: el.getAttribute("aria-pressed"), name: el.getAttribute("aria-label"), radius: Number.parseFloat(getComputedStyle(box).borderTopLeftRadius), width: r.width, height: r.height, target: Math.min(el.getBoundingClientRect().width, el.getBoundingClientRect().height) }
		})
		C("tick: a checkbox by role, checked after the press", tick.role === "checkbox" && tick.checked === "true" && tick.pressed === null && /^Watched: S1 E1, Pilot/.test(tick.name), JSON.stringify(tick))
		C("tick: a square with rounded corners, not a circle", tick.width === tick.height && tick.radius >= 4 && tick.radius <= tick.width / 3, JSON.stringify(tick))
		if (size === "phone") C("phone: the tick is a 44 px press target", tick.target >= 44, String(tick.target))
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
		const { page, errors } = await open(browser, size, `show=supernatural&scenario=watching&overviews=1&${T}`)
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
		C("row open, not watched: no still and no description, a cover for each", (await row.locator("[data-detail] img").count()) === 0 && (await row.locator("[data-overview]").count()) === 0 && /Show image/.test(await row.locator("[data-cover='image']").innerText()) && /Show description/.test(await row.locator("[data-cover='text']").innerText()))
		C("row open, not watched: the description is not readable under its cover", !/crossroads|demon/i.test(await row.locator("[data-detail]").innerText()), await row.locator("[data-detail]").innerText())
		C("row open: air date, runtime, rating and the date choice", /Nov 16, 2006 · \d+ min · IMDb \d\.\d/.test(await row.locator("[data-detail]").innerText()) && (await row.locator("[data-watch-now]").count()) === 1)
		const coverBox = await row.locator("[data-cover='image']").evaluate((el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } })
		C("row open: the image's cover has the still's shape", Math.abs(coverBox.w / coverBox.h - 16 / 9) < 0.03, JSON.stringify(coverBox))
		const places = () => row.locator("[data-detail]").evaluate((el) => [el.getBoundingClientRect().height, el.querySelector("[data-watched-when]").getBoundingClientRect().top - el.getBoundingClientRect().top].map(Math.round).join("/"))
		const before0 = await places()
		await row.locator("[data-cover='image']").click()
		await row.locator("[data-detail] img").evaluate((img) => img.complete || new Promise((done) => { img.onload = img.onerror = done; setTimeout(done, 4000) }))
		C("uncover the image: the still, in the cover's place", (await row.locator("[data-detail] img").count()) === 1 && (await row.locator("[data-cover='image']").count()) === 0 && (await row.locator("[data-detail] img").evaluate((el) => { const r = el.getBoundingClientRect(); return `${Math.round(r.width)}/${Math.round(r.height)}` })) === `${coverBox.w}/${coverBox.h}`)
		await row.locator("[data-cover='text']").click()
		C("uncover the description: the text", (await row.locator("[data-overview]").innerText()).length > 20 && (await row.locator("[data-cover]").count()) === 0)
		C("uncovering moved nothing", (await places()) === before0, `${before0} -> ${await places()}`)
		C("row open: Watched up to here counts the gap", /Watched up to here \(4\)/.test(await row.locator("[data-up-to-here]").innerText()), await row.locator("[data-up-to-here]").innerText().catch(() => "none"))
		await page.locator("[data-episode-list]").screenshot({ path: `${SHOTS}/list-row-open-${size}.jpg`, type: "jpeg", quality: 60 })
		await row.locator("[data-watch-day]").fill("2026-10-02")
		await settle(page)
		s = await stored(page)
		let made = s.log.find((r) => r.season_number === 2 && r.episode_number === 8)
		C("date choice: a day records the watch on that day", made?.watched_at_precision === "day" && new Date(made.watched_at).toISOString().startsWith("2026-10-02"))
		C("date choice: the row says so", /Watched Oct 2, 2026/.test(await row.locator("[data-watched-when]").innerText()))
		// Watched now: closing and opening the row shows everything at once.
		await row.locator("[data-row]").evaluate((el) => el.click())
		await row.locator("[data-row]").evaluate((el) => el.click())
		await settle(page, 200)
		C("row open, watched: the still and the description, no cover", (await row.locator("[data-detail] img").count()) === 1 && (await row.locator("[data-overview]").count()) === 1 && (await row.locator("[data-cover]").count()) === 0)
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
		C("hero next: the press recorded nothing", (await stored(page)).log.length === 27)
		C("hero next: the list opens at the episode, in view", top > 0 && top < 844, String(top))
		// With the grid chosen, the box's link still leads to the episode's row.
		await page.locator("[data-view-toggle]").click()
		await settle(page, 300)
		await page.evaluate(() => window.scrollTo(0, 0))
		await page.locator("[data-next-episode]").click()
		await settle(page, 1200)
		C("hero next, from the grid: the list is back with the row highlighted", (await page.locator("[data-episode-list]").getAttribute("data-view")) === "list" && /Simon Said/.test(await text(page, "[data-episode][data-selected]")))
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
		C("dropped: pill Dropped, the menu offers Resume and mark all", (await text(page, "[data-status-pill]")).trim() === "Dropped" && (await menuIds(page)) === "resume,markAll", await menuIds(page))
		C("dropped: no next episode, and a link to the episodes", (await count(page, "[data-next-episode]")) === 0 && (await page.locator("a[data-go-episodes]").getAttribute("aria-label")) === "Go to episodes" && (await noOverflow(page)))
		C("dropped with watches: Want to See is off", await page.locator("[data-hero] button:has-text('Want to See')").isDisabled())
		await toList(page)
		for (let i = 0; i < 3; i++) {
			await page.locator("[data-episode][data-watched] [data-tick]").first().click()
			await settle(page, 300)
		}
		let s = await stored(page)
		C("dropped: unticking everything keeps Dropped", s.state.state === "dropped" && s.log.length === 0)
		await page.evaluate(() => window.scrollTo(0, 0))
		C("menu Dropped, nothing watched: Want to see it after all comes first", (await menuIds(page)) === "wantToSee,resume,markAll", await menuIds(page))
		await menuPick(page, "wantToSee")
		await settle(page, 400)
		s = await stored(page)
		C("dropped, nothing watched: Want to See makes it Not started and wanted", s.state === null && s.wantToSee === true && (await page.locator("[data-hero] button:has-text('Want to See')").getAttribute("aria-pressed")) === "true")
		await page.context().close()
	}

	// ---- The Seen press: its line, taking it back, a date for it --------------------------------
	{
		const { page, errors } = await open(browser, size, `show=sherlock&scenario=seen_old&${T}`)
		await page.waitForSelector("[data-tracking-hero]")
		await toList(page)
		const line = "Marked Seen on 19 Oct 2024 · seasons 1 to 4 (12 episodes), no dates recorded"
		C("press line: when the show was marked Seen and what that covered", (await text(page, "[data-seen-press] span")) === line, await text(page, "[data-seen-press] span"))
		const near = await page.evaluate(() => {
			const p = document.querySelector("[data-seen-press]").getBoundingClientRect()
			return { underTitle: p.top >= document.querySelector("#episode-list-title").getBoundingClientRect().bottom - 1, aboveMatrix: p.bottom <= document.querySelector("[data-matrix]").getBoundingClientRect().top + 1 }
		})
		C("press line: between the heading and the matrix", near.underTitle && near.aboveMatrix, JSON.stringify(near))
		C("press line: no sideways scroll", await noOverflow(page))
		C("menu Seen, an old press: the day is the press's", /Removes the 12 episodes marked on 19 Oct 2024\. The show is then Not started\./.test(await (async () => { await page.evaluate(() => window.scrollTo(0, 0)); await page.locator("[data-status-pill]").click(); const t = await text(page, "[data-status-action='takeBack']"); await page.keyboard.press("Escape"); return t })()))
		// A date for the press's watches, from the menu.
		await menuPick(page, "setDate")
		C("menu set a date: the dialog asks about the 12", /these 12 episodes/.test(await text(page, "[role=dialog]")))
		await page.locator("[role=dialog] input[type=date]").fill("2024-10-01")
		await page.locator("[role=dialog] button:has-text('Set date')").click()
		await settle(page)
		let s = await stored(page)
		C("menu set a date: every watch of the press has the day, and the press stands", s.log.length === 12 && s.log.every((r) => r.watched_at_precision === "day" && new Date(r.watched_at).toISOString().startsWith("2024-10-01")) && s.state.seen_press_group !== null)
		await toList(page)
		C("press line: says the date once it is set", (await text(page, "[data-seen-press] span")) === "Marked Seen on 19 Oct 2024 · seasons 1 to 4 (12 episodes), dated 1 Oct 2024", await text(page, "[data-seen-press] span"))
		// Take back, beside the line.
		await page.locator("[data-take-back]").click()
		await settle(page)
		s = await stored(page)
		C("take back beside the line: the press's watches are gone and the show is Not started", s.state === null && s.log.length === 0)
		C("take back: the toast says what was removed", /Seen taken back: 12 watches removed/.test(await toast(page)), await toast(page))
		C("take back: the line is gone", (await count(page, "[data-seen-press]")) === 0)
		C("press flows: no page errors", cleanErrors(errors).length === 0, cleanErrors(errors).join(" | "))
		await page.context().close()
	}
	{
		// Seen by ticking every episode: no press, no line.
		const { page } = await open(browser, size, `show=chernobyl&scenario=seen_ticked&${T}`)
		await toList(page)
		C("no press: no line", (await count(page, "[data-seen-press]")) === 0)
		await page.evaluate(() => window.scrollTo(0, 0))
		C("menu Seen by ticks: Watch again only", (await menuIds(page)) === "watchAgain", await menuIds(page))
		await page.context().close()
	}

	// ---- Seen with new episodes: mark them, put on hold, drop -----------------------------------
	for (const [pick, to, word] of [["hold", "on_hold", "On hold"], ["drop", "dropped", "Dropped"]]) {
		const { page, errors } = await open(browser, size, `show=slow-horses&scenario=seen_old&${T}`)
		await page.waitForSelector("[data-tracking-hero]")
		C(`seen with new (${pick}): Caught up · 10 new`, (await text(page, "[data-status-pill]")).trim() === "Caught up · 10 new", await text(page, "[data-status-pill]"))
		C(`seen with new (${pick}): the menu, mark the new ones first and Drop last`, (await menuIds(page)) === "markNew,hold,watchAgain,takeBack,setDate,drop", await menuIds(page))
		await page.locator("[data-status-pill]").click()
		C(`seen with new (${pick}): Mark 10 new episodes watched`, /Mark 10 new episodes watched/.test(await text(page, "[data-status-action='markNew']")))
		C(`seen with new (${pick}): the menu fits the screen`, await page.locator("[role=menu]").evaluate((el) => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth }))
		await page.keyboard.press("Escape")
		C(`seen with new (${pick}): the box leads to the first new episode`, (await text(page, "[data-go-episodes]")).trim() === "S5 E1")
		await toList(page)
		C(`seen with new (${pick}): the line names the seasons the press covered`, (await text(page, "[data-seen-press] span")) === "Marked Seen on 19 Oct 2024 · seasons 1 to 4 (24 episodes), no dates recorded", await text(page, "[data-seen-press] span"))
		await page.evaluate(() => window.scrollTo(0, 0))
		await menuPick(page, pick)
		let s = await stored(page)
		C(`${pick} from Seen: ${word}, the press ended, every watch kept`, s.state.state === to && s.state.seen_press_group === null && s.state.seen_press_from === null && s.log.length === 24)
		C(`${pick} from Seen: the pill, and the toast says how to come back`, (await text(page, "[data-status-pill]")).trim() === word && /Resume brings it back as Watching/.test(await toast(page)) && (await count(page, "[data-tracking-toast] button:has-text('Undo')")) === 0, await toast(page))
		C(`${pick} from Seen: the line is gone with the press`, (await count(page, "[data-seen-press]")) === 0)
		C(`${pick} from Seen: the menu of any ${word} show`, (await menuIds(page)) === (pick === "hold" ? "resume,markAll,drop" : "resume,markAll"), await menuIds(page))
		await menuPick(page, "resume")
		s = await stored(page)
		C(`${pick} from Seen, then Resume: Watching, 24 of 34`, s.state.state === "watching" && /24 of 34/.test(await text(page, "[data-progress]")))
		C(`${pick} from Seen: no page errors`, cleanErrors(errors).length === 0, cleanErrors(errors).join(" | "))
		await page.context().close()
	}
	{
		const { page } = await open(browser, size, `show=slow-horses&scenario=seen_old&${T}`)
		await page.waitForSelector("[data-tracking-hero]")
		await menuPick(page, "markNew")
		const s = await stored(page)
		C("menu mark new: a group of its own, pressed from Seen, 34 watches", s.state.state === "seen" && s.state.seen_press_from === "seen" && s.log.length === 34)
		C("menu mark new: nothing new is left, so no On hold and no Drop", (await menuIds(page)) === "watchAgain,takeBack,setDate", await menuIds(page))
		await toList(page)
		C("press line: a press on a Seen show says it marked the new episodes", (await text(page, "[data-seen-press] span")) === "New episodes marked watched on 8 Oct 2026 · season 5, and 4 of the 6 episodes of season 6 (10 episodes), no dates recorded", await text(page, "[data-seen-press] span"))
		await page.context().close()
	}
}

await browser.close()
console.log(`hydration notices of the app shell in dev: ${shellHydration}`)
const failed = results.filter((r) => !r.ok)
for (const size of sizes) console.log(`${size}: ${results.filter((r) => r.name.startsWith(`[${size}]`)).length} checks`)
console.log(`${results.length - failed.length} of ${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.name} ${f.detail}`)
process.exit(failed.length ? 1 : 0)
