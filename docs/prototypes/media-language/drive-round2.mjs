// PROTOTYPE - throwaway. Walks round two (D to G) of /prototype/media-language in headless Chromium, desktop and
// phone, with real clicks and keys, and measures the page around every control: the title bar, the overview card,
// the where-to-watch box and About, before and after a control opens, a draft shows, a message comes and a change is
// undone. A control or a message must move nothing; only the content itself may change size (a longer title, other
// services). Writes the round-two screenshots of this folder. A walkthrough, not a test suite.
//   PLAYWRIGHT=<folder with node_modules/playwright-core> node drive-round2.mjs [base url] [output folder]
import { createRequire } from "node:module"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(`${process.env.PLAYWRIGHT ?? process.cwd()}/`)
const { chromium } = require("playwright-core")
const base = `${process.argv[2] ?? "http://localhost:3121"}/prototype/media-language`
const out = process.argv[3] ?? dirname(fileURLToPath(import.meta.url))
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium" })
const failures = []
let checks = 0
const check = (ok, what) => {
	checks += 1
	if (!ok) failures.push(what)
	console.log(`${ok ? "ok  " : "FAIL"} ${what}`)
}

async function open(query, mobile = false) {
	const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile })
	const page = await ctx.newPage()
	page.on("pageerror", (e) => check(false, `page error on ${query}: ${e.message}`))
	await page.route(/googletagmanager\.com|google-analytics\.com|posthog\.com|sentry\.io/, (r) => r.abort())
	await page.route("**/api/e", (r) => r.fulfill({ status: 200 }))
	await page.goto(`${base}?${query}&bar=small`, { waitUntil: "load", timeout: 120000 })
	await page.waitForSelector("[data-variant] h1", { timeout: 60000 })
	// Every image loaded and fonts in, so a late load cannot pass for a shift.
	await page.waitForFunction(() => document.fonts.status === "loaded" && [...document.images].every((i) => i.complete), null, { timeout: 30000 }).catch(() => {})
	await page.waitForTimeout(800)
	return page
}
const shot = async (page, name) => {
	await page.waitForTimeout(400)
	await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 82 })
}
const text = (page, sel) => page.locator(sel).first().innerText()
// The prototype's state line; with the bar small it is kept out of sight in the page.
const summary = (page) => page.locator("[data-proto-summary]").first().evaluate((el) => el.textContent)
// textContent: in G's edit mode the title is hidden behind the edit bar, and innerText of hidden text is empty.
const title = (page) => page.locator("[data-page-title]").first().evaluate((el) => el.textContent)

// Where the page's parts are, in page coordinates.
const PARTS = { bar: "[data-title-bar]", actions: "[data-actions]", card: "[data-title-page] section", watch: "[data-where-to-watch]", about: "[data-about]", poster: "[data-title-page] section button, [data-title-page] section span.aspect-\\[2\\/3\\]" }
const measure = (page) =>
	page.evaluate((parts) => {
		const out = {}
		for (const [k, sel] of Object.entries(parts)) {
			const el = document.querySelector(sel)
			if (!el) continue
			const r = el.getBoundingClientRect()
			out[k] = { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }
		}
		out.page = { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, view: innerWidth }
		return out
	}, PARTS)
/** Which parts moved or changed size between two measures. */
const moved = (a, b, keys = Object.keys(a)) =>
	keys.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map((k) => `${k} ${JSON.stringify(a[k])} -> ${JSON.stringify(b[k])}`)
const still = (a, b, what, keys) => {
	const m = moved(a, b, keys)
	check(m.length === 0, `${what}${m.length ? `: ${m.join("; ")}` : ""}`)
}
const inView = (page, sel) =>
	page.evaluate((sel) => {
		const r = document.querySelector(sel)?.getBoundingClientRect()
		return Boolean(r) && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight
	}, sel)
const box = (page, sel) => page.locator(sel).first().boundingBox()
const sameBox = (a, b) => a && b && Math.round(a.width) === Math.round(b.width) && Math.round(a.height) === Math.round(b.height)
const focused = (page) => page.evaluate(() => (document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent || "(nothing)").trim().slice(0, 70))
const failNext = (page, fail) => page.evaluate((fail) => window.__mediaLanguagePrototype.failNext(fail), fail)

// ---- D: a panel anchored to the pair ------------------------------------------------------------------------------
{
	const page = await open("variant=D")
	const m0 = await measure(page)
	await page.click("[data-pair-chip]")
	await page.waitForSelector("[data-header-overlay]")
	still(m0, await measure(page), "D: opening the panel moves nothing")
	check(await inView(page, "[data-header-overlay]"), "D: the panel lies inside the window")
	const panel0 = await box(page, "[data-header-overlay]")
	await shot(page, "d-open-desktop")
	await page.keyboard.press("Enter") // the focus is on the Country row
	await page.waitForSelector('[role=listbox][aria-label="Search countries"]')
	check(sameBox(panel0, await box(page, "[data-header-overlay]")), "D: the list opens inside the panel, at the panel's size")
	await page.keyboard.type("jap")
	await page.keyboard.press("Escape")
	check(await page.locator("[data-header-overlay] [data-row]").first().isVisible(), "D: Escape in the list closes the list only")
	check((await focused(page)).startsWith("Country"), "D: the focus is back on the Country row")
	await page.keyboard.press("Enter")
	await page.keyboard.type("jap")
	await page.keyboard.press("Enter")
	const m1 = await measure(page)
	still(m0, m1, "D: a new country keeps the title bar, card top, poster and box positions", ["bar", "poster"])
	check((await summary(page)).includes("NOT SAVED") && (await title(page)) === "Chihiros Reise ins Zauberland", "D: the page shows Japan's offers as a draft, titles unchanged")
	check(await page.locator("[data-companion]").isVisible(), "D: Japan offers its language as one small button, not picked")
	check(sameBox(panel0, await box(page, "[data-header-overlay]")), "D: the offer does not grow the panel")
	await page.click("[data-companion]")
	check((await title(page)) === "千と千尋の神隠し", "D: the offer shows the Japanese titles on the page")
	still(m0, await measure(page), "D: a Japanese title keeps the title bar's size", ["bar", "poster"])
	await shot(page, "d-draft-desktop")
	await page.keyboard.press("Escape")
	await page.waitForSelector("[data-header-overlay]", { state: "detached" })
	check(!(await summary(page)).includes("NOT SAVED"), "D: Escape drops the draft and the page is back")
	still(m0, await measure(page), "D: after Cancel the page is where it was")
	check((await focused(page)).startsWith("Country"), "D: the focus is back on the pair")
	// Save, with a failure first.
	await failNext(page, true)
	await page.click("[data-pair-chip]")
	await page.click('[data-row="lang"]')
	await page.click('[role=option]:has-text("French")')
	await page.click("[data-save]")
	await page.waitForSelector('[data-status]:has-text("Didn\'t save")')
	check(sameBox(panel0, await box(page, "[data-header-overlay]")) && (await summary(page)).includes("saved no country/browser"), "D: a failure is one line in the panel, nothing saved, the panel's size kept")
	await shot(page, "d-failed-desktop")
	await failNext(page, false)
	await page.click("[data-save]")
	await page.waitForSelector("[data-header-overlay]", { state: "detached" })
	check((await summary(page)).includes("saved no country/fr"), "D: Save keeps the language")
	await page.context().close()
}

// ---- E: two direct lists -------------------------------------------------------------------------------------------
{
	const page = await open("variant=E")
	const m0 = await measure(page)
	await page.click('[data-e="country"]')
	await page.waitForSelector("[data-header-overlay]")
	still(m0, await measure(page), "E: opening the country list moves nothing")
	await shot(page, "e-open-desktop")
	await page.keyboard.type("jap")
	await page.keyboard.press("Escape")
	check((await page.locator("[data-header-overlay]").count()) === 0 && (await focused(page)).startsWith("Country"), "E: Escape closes the list and the focus is on its button")
	await page.click('[data-e="country"]')
	await page.keyboard.type("jap")
	await page.keyboard.press("Enter")
	await page.waitForSelector("[data-save-bar]")
	check(await page.locator("[data-save-bar]").evaluate((el) => getComputedStyle(el).position === "fixed"), "E: the Save bar is fixed to the window, not in the page")
	still(m0, await measure(page), "E: Japan applied: title bar and poster stay", ["bar", "poster"])
	check((await summary(page)).includes("NOT SAVED") && (await title(page)) === "Chihiros Reise ins Zauberland", "E: the country applies at once, unsaved, and the language does not follow")
	await shot(page, "e-unsaved-desktop")
	await page.click("[data-undo]")
	check((await page.locator("[data-save-bar]").count()) === 0, "E: Undo goes back and the bar goes")
	still(m0, await measure(page), "E: after Undo the page is exactly where it was")
	await page.click('[data-e="lang"]')
	await page.keyboard.press("ArrowDown") // from Browser default to English
	await page.keyboard.press("Enter")
	check((await title(page)) === "Spirited Away", "E: a language picked with the keys shows at once")
	await failNext(page, true)
	await page.click("[data-save-bar] [data-save]")
	await page.waitForSelector('[data-save-bar]:has-text("Didn\'t save")')
	check((await summary(page)).includes("saved no country/browser"), "E: a failed save changes nothing and says so in the bar")
	await shot(page, "e-failed-desktop")
	await failNext(page, false)
	await page.click("[data-save-bar] [data-save]")
	await page.waitForSelector('[data-save-bar]:has-text("Saved")')
	check((await summary(page)).includes("saved no country/en"), "E: Save keeps it")
	await page.click("[data-undo]")
	check((await summary(page)).includes("saved no country/browser"), "E: Undo after a save takes it back")
	await page.context().close()
}

// ---- F: pick in a dialog, then Keep or Undo on the page ------------------------------------------------------------
{
	const page = await open("variant=F")
	const m0 = await measure(page)
	await page.click("[data-pair-chip]")
	await page.waitForSelector("[data-f-dialog]")
	still(m0, await measure(page), "F: opening the dialog moves nothing (the scrollbar's space is kept)")
	await shot(page, "f-dialog-desktop")
	await page.keyboard.type("jap")
	await page.keyboard.press("Enter")
	await page.waitForSelector("[data-header-overlay]")
	check((await page.locator("[data-f-dialog]").count()) === 0, "F: a pick closes the dialog")
	still(m0, await measure(page), "F: Japan applied and the question shown: title bar and poster stay", ["bar", "poster"])
	check(await inView(page, "[data-header-overlay]"), "F: the question lies under the pair, in the window")
	const q0 = await box(page, "[data-header-overlay]")
	await page.check("[data-companion]")
	check((await title(page)) === "千と千尋の神隠し" && sameBox(q0, await box(page, "[data-header-overlay]")), "F: ticking the offer shows Japanese titles, the question keeps its size")
	await shot(page, "f-confirm-desktop")
	await page.click('[data-where-to-watch] [role=tab]:has-text("Rent")')
	check(await page.locator("[data-header-overlay]").isVisible(), "F: using the page leaves the question open")
	await page.click("[data-pair-chip]")
	await page.waitForSelector("[data-f-dialog]")
	await page.keyboard.press("Escape")
	await page.waitForSelector("[data-f-dialog]", { state: "detached" })
	check(await page.locator("[data-header-overlay]").isVisible() && (await summary(page)).includes("NOT SAVED"), "F: Escape closes the dialog only; the question and the preview stay")
	await page.keyboard.press("Escape")
	check((await page.locator("[data-header-overlay]").count()) === 0 && !(await summary(page)).includes("NOT SAVED"), "F: a second Escape is Undo")
	await page.click('[data-where-to-watch] [role=tab]:has-text("Stream")') // the Rent tab was this walkthrough's own content change
	still(m0, await measure(page), "F: after Undo the page is where it was", ["bar", "card", "poster", "about"])
	await failNext(page, true)
	await page.click("[data-pair-chip]")
	await page.keyboard.type("fran")
	await page.keyboard.press("Enter")
	await page.click("[data-keep]")
	await page.waitForSelector('[data-header-overlay]:has-text("Didn\'t save")')
	check(sameBox(q0, await box(page, "[data-header-overlay]")) && (await summary(page)).includes("saved no country/browser"), "F: a failure keeps the question's size and saves nothing")
	await failNext(page, false)
	await page.click("[data-keep]")
	await page.waitForSelector("[data-header-overlay]", { state: "detached" })
	check((await summary(page)).includes("saved FR/browser"), "F: Keep saves the country alone")
	await page.context().close()
}

// ---- G: an edit mode of the title bar -----------------------------------------------------------------------------
{
	const page = await open("variant=G&title=portrait&visitor=member-de")
	const m0 = await measure(page)
	await page.click("[data-g-edit]")
	await page.waitForSelector("[data-edit-bar]")
	still(m0, await measure(page), "G: the edit mode keeps the title bar's height")
	check(await page.locator("[data-page-title]").isVisible(), "G: the title stays in view while editing")
	check((await focused(page)).startsWith("Country"), "G: the focus moves to the country control")
	await shot(page, "g-edit-desktop")
	await page.keyboard.press("Enter")
	await page.keyboard.type("jap")
	await page.keyboard.press("Escape")
	check(await page.locator("[data-edit-bar]").isVisible() && (await page.locator("[data-header-overlay]").count()) === 0, "G: Escape in the list closes the list, the mode stays")
	await page.click('[data-g="country"]')
	await page.keyboard.type("jap")
	await page.keyboard.press("Enter")
	still(m0, await measure(page), "G: Japan applied: title bar and poster stay", ["bar", "poster"])
	await page.click('[data-g="lang"]')
	const second = await page.locator('[role=listbox][aria-label="Titles in"] [role=option]').nth(1).innerText()
	check(second.includes("Japanese") && second.includes("Suggested for Japan"), "G: Japanese comes first in the list, marked suggested, not picked")
	await shot(page, "g-suggested-desktop")
	await page.keyboard.press("Escape")
	await page.click("[data-reset]")
	check(!(await summary(page)).includes("NOT SAVED") && (await page.locator("[data-edit-bar]").isVisible()), "G: Reset goes back to what is saved and stays in the mode")
	await page.click('[data-g="lang"]')
	await page.click('[role=option]:has-text("French")')
	const french = await title(page)
	check(french === "Portrait de la jeune fille en feu", `G: a language shows on the page while editing (${french})`)
	await failNext(page, true)
	await page.click("[data-done]")
	await page.waitForSelector('[data-done]:has-text("Retry")')
	check((await summary(page)).includes("saved DE/browser"), "G: a failed Done saves nothing and offers Retry")
	await failNext(page, false)
	await page.click("[data-done]")
	await page.waitForSelector("[data-edit-bar]", { state: "detached" })
	check((await summary(page)).includes("saved DE/fr") && (await focused(page)).startsWith("Country"), "G: Done saves, leaves the mode, the focus is on Edit")
	still(m0, await measure(page), "G: after Done the title bar is where it was", ["bar", "poster"])
	await page.click("[data-g-edit]")
	await page.click('[data-g="country"]')
	await page.keyboard.type("spa")
	await page.keyboard.press("Enter")
	await page.keyboard.press("Escape")
	check((await page.locator("[data-edit-bar]").count()) === 0 && (await summary(page)).includes("saved DE/fr") && !(await summary(page)).includes("NOT SAVED"), "G: Escape leaves the mode without saving")
	await page.context().close()
}

// ---- The second review: language kept across country picks, D's draft under touch, the neighbouring card ---------
const pickIn = async (page, label, name) => {
	await page.click(`[role=listbox][aria-label="${label}"] [role=option]:has-text("${name}")`)
}
{
	// D: French by hand, then Japan, then Spain. The French stays; no offer while the visitor's own language stands.
	const page = await open("variant=D&visitor=member-de")
	await page.click("[data-pair-chip]")
	await page.click('[data-row="lang"]')
	await pickIn(page, "Titles in", "French")
	await page.click('[data-row="country"]')
	await page.keyboard.type("jap")
	await page.keyboard.press("Enter")
	check((await title(page)) === "Le Voyage de Chihiro" && (await page.locator("[data-companion]").count()) === 0, "D: French, then Japan: the page stays French and nothing is offered")
	await page.click('[data-row="country"]')
	await page.keyboard.type("spa")
	await page.keyboard.press("Enter")
	check((await title(page)) === "Le Voyage de Chihiro" && (await summary(page)).includes("shows Spain/French"), "D: then Spain: still French")
	await shot(page, "d-lang-then-country-desktop")
	await page.click("[data-cancel]")
	// A suggestion taken for one country goes when the country changes again.
	await page.click("[data-pair-chip]")
	await page.click('[data-row="country"]')
	await page.keyboard.type("jap")
	await page.keyboard.press("Enter")
	await page.click("[data-companion]")
	check((await title(page)) === "千と千尋の神隠し", "D: Japan and its offer taken: Japanese titles")
	await page.click('[data-row="country"]')
	await page.keyboard.type("spa")
	await page.keyboard.press("Enter")
	check((await title(page)) === "Chihiros Reise ins Zauberland" && (await text(page, "[data-companion]")).includes("Spanish"), "D: then Spain: the Japanese offer goes, German is back, Spanish is offered")
	await page.context().close()
}
{
	// F: Titles first, then Country; the dialog opens on the list used last.
	const page = await open("variant=F&visitor=member-de")
	await page.click("[data-pair-chip]")
	await page.click('[role=tab]:has-text("Titles")')
	await pickIn(page, "Titles in", "French")
	await page.click("[data-pair-chip]")
	check(await page.locator('[role=tab][aria-selected=true]:has-text("Titles")').isVisible(), "F: the dialog opens on the list used last")
	await page.click('[role=tab]:has-text("Country")')
	await page.keyboard.type("jap")
	await page.keyboard.press("Enter")
	check((await title(page)) === "Le Voyage de Chihiro" && (await page.locator("[data-companion]").count()) === 0, "F: French, then Japan: the page stays French and nothing is offered")
	await page.context().close()
}
{
	// G: French, then Japan, then Spain, with the title in view the whole time.
	const page = await open("variant=G&visitor=member-de")
	await page.click("[data-g-edit]")
	await page.click('[data-g="lang"]')
	await pickIn(page, "Titles in", "French")
	await page.click('[data-g="country"]')
	await page.keyboard.type("jap")
	await page.keyboard.press("Enter")
	check((await title(page)) === "Le Voyage de Chihiro" && (await page.locator("[data-page-title]").isVisible()), "G: French, then Japan: the visible title stays French")
	await page.click('[data-g="lang"]')
	check(!(await text(page, '[role=listbox][aria-label="Titles in"]')).includes("Suggested"), "G: with the visitor's own language nothing is suggested")
	await page.keyboard.press("Escape")
	await page.click('[data-g="country"]')
	await page.keyboard.type("spa")
	await page.keyboard.press("Enter")
	check((await summary(page)).includes("shows Spain/French"), "G: then Spain: still French")
	await shot(page, "g-lang-then-country-desktop")
	await page.context().close()
}
{
	// E: the two are independent anyway; checked for the same order.
	const page = await open("variant=E&visitor=member-de")
	await page.click('[data-e="lang"]')
	await pickIn(page, "Titles in", "French")
	await page.click('[data-e="country"]')
	await page.keyboard.type("jap")
	await page.keyboard.press("Enter")
	check((await summary(page)).includes("shows Japan/French"), "E: French, then Japan: still French")
	await page.context().close()
}
{
	// D on a phone: a swipe, a tap and a tab on the page keep the panel and the draft. The pair folds the panel away.
	const page = await open("variant=D&visitor=member-de", true)
	await page.click("[data-pair-chip]")
	await page.click('[data-row="country"]')
	await page.keyboard.type("jap")
	await page.keyboard.press("Enter")
	const cdp = await page.context().newCDPSession(page)
	const touch = (type, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: 200, y }] })
	await touch("touchStart", 700)
	for (const y of [650, 560, 470, 380]) await touch("touchMove", y)
	await touch("touchEnd", 380)
	await page.waitForTimeout(600)
	check(await page.locator("[data-header-overlay]").isVisible(), "D phone: a swipe on the page keeps the panel open")
	check((await summary(page)).includes("shows Japan/German") && (await summary(page)).includes("NOT SAVED"), "D phone: and keeps the draft")
	await page.locator('[data-where-to-watch] [role=tab]:has-text("Rent")').evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }))
	await page.locator('[data-where-to-watch] [role=tab]:has-text("Rent")').tap()
	check((await page.locator("[data-header-overlay]").count()) === 1 && (await summary(page)).includes("NOT SAVED"), "D phone: a tap on the page's Rent tab keeps both")
	await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
	await page.click("[data-pair-chip]")
	check((await page.locator("[data-header-overlay]").count()) === 0 && (await summary(page)).includes("NOT SAVED"), "D phone: the pair folds the panel away and the draft stays")
	await shot(page, "d-folded-phone")
	await page.click("[data-pair-chip]")
	check((await text(page, '[data-row="country"]')).includes("Japan"), "D phone: the pair opens it again with the draft")
	await page.keyboard.press("Escape")
	check(!(await summary(page)).includes("NOT SAVED"), "D phone: Escape discards")
	await page.context().close()
}
{
	// The neighbouring card: a country with no streams grows the where-to-watch box; the actions beside it stay put.
	for (const v of ["D", "E"]) {
		const page = await open(`variant=${v}&visitor=member-de`)
		const a = await measure(page)
		if (v === "D") {
			await page.click("[data-pair-chip]")
			await page.click('[data-row="country"]')
		} else await page.click('[data-e="country"]')
		await page.keyboard.type("jap")
		await page.keyboard.press("Enter")
		const b = await measure(page)
		const grew = b.watch.h - a.watch.h
		still(a, b, `${v}: Japan grows where-to-watch by ${grew} px (${a.watch.h} -> ${b.watch.h}); the actions card keeps its place and size`, ["bar", "actions", "poster"])
		check(b.about.y - a.about.y === grew, `${v}: About moves down by exactly that growth (${b.about.y - a.about.y} px), nothing more`)
		console.log(`     ${v} boxes before ${JSON.stringify({ actions: a.actions, watch: a.watch, about: a.about.y })} after ${JSON.stringify({ actions: b.actions, watch: b.watch, about: b.about.y })}`)
		await page.context().close()
	}
}
{
	// G on a phone: the state in words, and a failure read out.
	const page = await open("variant=G&visitor=member-de", true)
	await page.click("[data-g-edit]")
	await page.click('[data-g="country"]')
	await page.keyboard.type("jap")
	await page.keyboard.press("Enter")
	check(await page.locator('[data-g-status]:has-text("Not saved")').isVisible(), "G phone: Not saved shows in words")
	await failNext(page, true)
	await page.click("[data-done]")
	await page.waitForSelector('[data-g-status][role=alert]:has-text("Didn\'t save")')
	check(await page.locator("[data-g-status]").isVisible(), "G phone: a failure shows in words, as an alert")
	await shot(page, "g-failed-phone")
	await page.context().close()
}
{
	// E on a phone: the title bar is as high as in the others, Money Heist included.
	const d = await open("variant=D&title=money-heist", true)
	const hd = (await measure(d)).bar.h
	await d.context().close()
	const e = await open("variant=E&title=money-heist", true)
	const he = (await measure(e)).bar.h
	await e.context().close()
	check(hd === he, `E phone: the title bar is ${he} px, as in D (${hd} px)`)
}

// ---- Long titles, phones, and the round switch ---------------------------------------------------------------------
{
	const page = await open("variant=D&title=portrait&visitor=guest-de")
	const de = await measure(page)
	await page.click("[data-pair-chip]")
	await page.click('[data-row="lang"]')
	await page.click('[role=option]:has-text("English")')
	still(de, await measure(page), "A long German title and a short English one give the same title bar", ["bar", "poster"])
	await page.context().close()
}
for (const v of ["D", "E", "F", "G"]) {
	const page = await open(`variant=${v}`, true)
	const m0 = await measure(page)
	check(m0.page.w <= m0.page.view, `${v} phone: nothing wider than the screen`)
	const trigger = { D: "[data-pair-chip]", E: '[data-e="lang"]', F: "[data-pair-chip]", G: "[data-g-edit]" }[v]
	await page.click(trigger)
	await page.waitForTimeout(400)
	if (v === "G") {
		check(await page.locator("[data-edit-bar]").evaluate((el) => el.scrollWidth <= el.clientWidth + 1), "G phone: the edit bar fits the title bar")
		await page.click('[data-g="lang"]')
	}
	const overlay = v === "F" ? "[data-f-dialog]" : "[data-header-overlay]"
	await page.waitForSelector(overlay)
	check(await inView(page, overlay), `${v} phone: what opens lies inside the screen`)
	still(m0, await measure(page), `${v} phone: opening it moves nothing`, ["bar", "card", "poster", "about", "page"])
	await shot(page, `${v.toLowerCase()}-open-phone`)
	await page.context().close()
}
{
	const page = await open("variant=G")
	await page.click("[data-proto-grow]")
	await page.click("[data-round]")
	check((await text(page, "[data-variant-label]")).startsWith("A"), "The round switch leads to round one (A)")
	await page.click('[aria-label="Next variant"]')
	await page.click('[aria-label="Next variant"]')
	await page.click('[aria-label="Next variant"]')
	check((await text(page, "[data-variant-label]")).startsWith("A"), "In round one the arrows go round A to C only")
	await page.click("[data-round]")
	check((await text(page, "[data-variant-label]")).startsWith("D"), "And back to round two (D)")
	await page.keyboard.press("ArrowLeft")
	check((await text(page, "[data-variant-label]")).startsWith("G"), "In round two the arrows go round D to G only")
	await page.context().close()
}

await browser.close()
console.log(`\n${checks - failures.length} of ${checks} checks passed`)
if (failures.length) {
	console.log(failures.map((f) => ` - ${f}`).join("\n"))
	process.exit(1)
}
