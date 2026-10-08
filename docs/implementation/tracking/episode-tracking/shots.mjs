// The screenshots of this folder: node shots.mjs <directory>. Same setup as drive.mjs.
import { mkdirSync } from "node:fs"
import { BASE, launch, settle } from "./lib.mjs"

const OUT = process.argv[2]
mkdirSync(OUT, { recursive: true })
const browser = await launch()
const T = "today=2026-10-08&latency=40"
const SIZES = { phone: { width: 390, height: 844, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true }, desktop: { width: 1280, height: 900, deviceScaleFactor: 1 } }

async function open(size, query) {
	const { width, height, ...rest } = SIZES[size]
	const context = await browser.newContext({ viewport: { width, height }, ...rest, locale: "en-GB" })
	const page = await context.newPage()
	await page.goto(`${BASE}?${query}&${T}`, { waitUntil: "domcontentloaded" })
	await page.waitForSelector("[data-harness]", { timeout: 90000 })
	await settle(page, 1200)
	return page
}
const tidy = (page) =>
	page.evaluate(() => {
		document.querySelector("[data-harness-panel]")?.setAttribute("style", "display:none")
		for (const el of document.querySelectorAll("body *")) {
			const style = getComputedStyle(el)
			if ((style.position === "fixed" || style.position === "sticky") && !el.closest("[data-tracking-toast]") && !el.querySelector("[data-tracking-toast]") && !el.closest("[role=dialog]") && !el.querySelector("[role=dialog]")) el.style.visibility = "hidden"
		}
	})
const save = async (page, selector, name) => {
	await tidy(page)
	await page.locator(selector).first().screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 62 })
}
const view = async (page, name) => {
	await tidy(page)
	await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 62 })
}
const list = async (page) => {
	await page.evaluate(() => document.querySelector("[data-harness] > div.mt-12")?.scrollIntoView())
	await page.waitForSelector("[data-episode-list]", { timeout: 30000 })
	await settle(page, 400)
}
const season = (page, n) => page.locator(`[data-season-press="${n}"]`).click({ position: { x: 12, y: 8 } })

for (const size of ["phone", "desktop"]) {
	let page = await open(size, "show=supernatural&scenario=watching&overviews=1")
	await save(page, "[data-hero]", `hero-watching-${size}`)
	await page.locator("[data-status-pill]").click()
	await settle(page, 200)
	await save(page, "[data-hero]", `hero-status-menu-${size}`)
	await page.keyboard.press("Escape")
	await list(page)
	await save(page, "[data-episode-list]", `list-matrix-${size}`)
	await season(page, 2)
	await settle(page, 400)
	await save(page, "[data-episode-list]", `list-season-open-${size}`)
	await page.locator("[data-episode]", { hasText: "Crossroad Blues" }).locator("[data-row]").click()
	await settle(page, 600)
	await save(page, "[data-episode-list]", `list-row-open-${size}`)
	await page.locator("[data-cover='image']").click()
	await page.locator("[data-cover='text']").click()
	await settle(page, 900)
	await save(page, "[data-episode-list]", `list-row-uncovered-${size}`)
	await page.locator("[data-mark-season]").click()
	await settle(page, 400)
	await page.locator("[data-tracking-toast]").scrollIntoViewIfNeeded()
	await view(page, `toast-mark-season-${size}`)
	await page.context().close()

	page = await open(size, "show=supernatural&scenario=fresh")
	await list(page)
	await save(page, "[data-episode-list]", `list-never-tracked-${size}`)
	await page.context().close()

	page = await open(size, "show=supernatural&scenario=seen_new")
	await save(page, "[data-hero]", `hero-seen-new-episodes-${size}`)
	await page.context().close()

	// Marked Seen on 19 Oct 2024; two seasons have aired since.
	page = await open(size, "show=slow-horses&scenario=seen_old")
	await page.locator("[data-status-pill]").click()
	await settle(page, 200)
	await view(page, `hero-menu-seen-new-episodes-${size}`)
	await page.keyboard.press("Escape")
	await list(page)
	await save(page, "[data-episode-list]", `list-seen-press-${size}`)
	await page.locator("[data-view-toggle]").click()
	await settle(page, 400)
	await page.mouse.move(2, 2)
	await settle(page, 400)
	await save(page, "[data-episode-list]", `list-ratings-grid-${size}`)
	await page.context().close()

	// Take back Seen: the question in the status menu and beside the line, and the toast with its Undo.
	page = await open(size, "show=slow-horses&scenario=seen_old")
	await page.locator("[data-status-pill]").click()
	await page.locator("[data-status-action='takeBack']").click()
	await settle(page, 200)
	await save(page, "[data-hero]", `hero-menu-take-back-${size}`)
	await page.keyboard.press("Escape")
	await list(page)
	await page.locator("[data-take-back]").click()
	await settle(page, 200)
	await save(page, "[data-episode-list]", `list-take-back-${size}`)
	await page.locator("[data-seen-press] [data-confirm-yes]").click()
	await settle(page, 400)
	await page.locator("[data-tracking-toast]").scrollIntoViewIfNeeded()
	await view(page, `toast-take-back-${size}`)
	await page.context().close()

	page = await open(size, "show=chernobyl&scenario=dropped")
	await page.locator("[data-status-pill]").click()
	await settle(page, 200)
	await save(page, "[data-hero]", `hero-menu-dropped-${size}`)
	await page.context().close()

	page = await open(size, "show=chernobyl&scenario=fresh")
	await page.locator("[data-seen-button]").click()
	await settle(page, 500)
	await page.locator("[data-tracking-toast] button[aria-label=Close]").click()
	await save(page, "[data-hero]", `hero-seen-rate-prompt-${size}`)
	await list(page)
	await save(page, "[data-episode-list]", `list-limited-series-${size}`)
	await page.context().close()

	page = await open(size, "show=chernobyl&scenario=fresh")
	await page.locator("[data-hero] fieldset button[aria-label^='Good']").click()
	await page.waitForSelector("[data-seen-question]")
	await settle(page, 300)
	await save(page, "[data-hero]", `hero-seen-question-${size}`)
	await page.context().close()

	page = await open(size, "show=slow-horses&scenario=watching")
	await list(page)
	const last = Math.max(...(await page.locator("[data-season-press]").evaluateAll((els) => els.map((el) => Number(el.dataset.seasonPress)))))
	await season(page, last)
	await settle(page, 400)
	await save(page, "[data-episode-list]", `list-airing-season-${size}`)
	await page.context().close()

	page = await open(size, "show=sherlock&scenario=watching")
	await list(page)
	await season(page, 0)
	await settle(page, 400)
	await save(page, "[data-episode-list]", `list-specials-${size}`)
	await page.context().close()
}
await browser.close()
