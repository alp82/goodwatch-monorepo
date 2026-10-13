// PROTOTYPE - throwaway. Walks /prototype/media-language in a headless browser: every variant, on a desktop and on a
// phone, with the checks that matter (a look saves nothing, Cancel drops the draft, a failed save changes nothing,
// arrow keys in a list do not switch the variant, the focus is never dropped) and the screenshots of this folder.
// A walkthrough to look at, not a test suite.
//   PLAYWRIGHT=<folder with node_modules/playwright-core> node drive.mjs [base url] [output folder]
import { createRequire } from "node:module"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(`${process.env.PLAYWRIGHT ?? process.cwd()}/`)
const { chromium } = require("playwright-core")
const base = `${process.argv[2] ?? "http://localhost:3117"}/prototype/media-language`
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
	// The site's own shell loads analytics. None of it leaves this browser.
	await page.route(/googletagmanager\.com|google-analytics\.com|posthog\.com|sentry\.io/, (r) => r.abort())
	await page.route("**/api/e", (r) => r.fulfill({ status: 200 }))
	await page.goto(`${base}?${query}`, { waitUntil: "load", timeout: 120000 })
	await page.waitForSelector("[data-variant] h1", { timeout: 60000 })
	await page.waitForFunction(() => document.querySelector("[data-proto-toggle]"), null, { timeout: 60000 }).catch(() => {})
	await page.waitForTimeout(1200)
	return page
}
const shot = async (page, name, opts = {}) => {
	await page.waitForTimeout(500)
	await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 82, ...opts })
}
/** True when the element is what a press at its middle would reach. */
const onTop = (page, sel) =>
	page.evaluate((sel) => {
		const el = document.querySelector(sel)
		const r = el.getBoundingClientRect()
		return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
	}, sel)
/** What has the focus, as a person would name it. */
const focused = (page) =>
	page.evaluate(() => {
		const el = document.activeElement
		if (!el || el === document.body) return "(nothing)"
		const labelled = (el.getAttribute("aria-labelledby") ?? "")
			.split(" ")
			.map((id) => document.getElementById(id)?.textContent ?? "")
			.join(" ")
		return (el.getAttribute("aria-label") || labelled || el.textContent || el.tagName).replace(/\s+/g, " ").trim().slice(0, 60)
	})
/** Presses Tab n times and returns what took the focus each time. */
const tabs = async (page, n) => {
	const order = []
	for (let i = 0; i < n; i++) {
		await page.keyboard.press("Tab")
		order.push(await focused(page))
	}
	return order
}
const text = (page, sel) => page.locator(sel).first().innerText()
const summary = (page) => text(page, "[data-proto-summary]")
const title = (page) => text(page, "[data-page-title]")
const variant = (page) => text(page, "[data-variant-label]")
// A press on something further down the page: bring it to the middle first, clear of the fixed header and the dock,
// and at once (the page scrolls smoothly, and a press during the scroll misses).
const press = async (page, sel) => {
	await page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }))
	await page.waitForTimeout(200)
	await page.locator(sel).first().click()
}

// ---- A: one staged panel -------------------------------------------------------------------------------------------
for (const mobile of [false, true]) {
	const tag = mobile ? "phone" : "desktop"
	const page = await open("variant=A", mobile)
	check((await title(page)) === "Chihiros Reise ins Zauberland", `A ${tag}: a German browser gets the German title without any setting`)
	await page.click("[data-country]")
	await page.waitForSelector("[data-panel-a]")
	if (!mobile) await shot(page, "a-panel-untouched-desktop")
	await page.click('[data-panel-a] [data-field="country"]')
	await page.keyboard.type("jap")
	await page.keyboard.press("ArrowDown")
	await page.keyboard.press("ArrowUp")
	await page.keyboard.press("ArrowRight")
	check((await variant(page)).startsWith("A"), `A ${tag}: arrow keys in the country search stay in the list`)
	await page.keyboard.press("Enter")
	check(await page.locator("[data-companion] input").isVisible(), `A ${tag}: Japan offers Japanese as a companion`)
	check(!(await page.locator("[data-companion] input").isChecked()), `A ${tag}: the companion starts unticked`)
	check((await text(page, "[data-save]")) === "Save country", `A ${tag}: the button names the one change`)
	check((await summary(page)).includes("shows Germany/German"), `A ${tag}: the page behind the panel has not changed`)
	await shot(page, `a-panel-country-${tag}`)
	await page.check("[data-companion] input")
	check((await text(page, "[data-save]")) === "Save country and language", `A ${tag}: with the companion the button names both`)
	check((await text(page, "[data-after]")).includes("千と千尋の神隠し"), `A ${tag}: the preview shows the Japanese title`)
	await shot(page, `a-panel-both-${tag}`)
	// Cancel drops the whole draft.
	await page.keyboard.press("Escape")
	await page.waitForSelector("[data-panel-a]", { state: "detached" })
	check((await summary(page)).includes("saved no country/browser") && (await title(page)) === "Chihiros Reise ins Zauberland", `A ${tag}: Escape drops the draft, nothing saved`)
	// A failed save keeps the draft and changes nothing.
	await page.click("[data-proto-toggle]")
	await page.click('[data-proto-panel] button:has-text("Fails")')
	await page.click("[data-proto-toggle]")
	await press(page, "[data-region-change]")
	await page.click('[data-panel-a] [data-field="lang"]')
	await page.keyboard.press("ArrowDown")
	await page.keyboard.press("ArrowDown")
	await page.keyboard.press("ArrowDown")
	await page.keyboard.press("Enter")
	check((await text(page, "[data-save]")) === "Save language", `A ${tag}: a language picked with the keyboard is a draft of one change`)
	await page.click("[data-save]")
	await page.waitForSelector("[data-save-error]")
	check((await summary(page)).includes("saved no country/browser"), `A ${tag}: a failed save changes nothing`)
	await shot(page, `a-panel-failed-${tag}`)
	await page.keyboard.press("Escape")
	await page.click("[data-proto-toggle]")
	await page.click('[data-proto-panel] button:has-text("Succeeds")')
	await page.click("[data-proto-toggle]")
	// A save of both lands as one, and Undo takes both back.
	await page.click("[data-country]")
	await page.click('[data-panel-a] [data-field="country"]')
	await page.keyboard.type("jap")
	await page.keyboard.press("Enter")
	await page.check("[data-companion] input")
	await page.click("[data-save]")
	await page.waitForSelector("[data-toast]")
	check((await summary(page)).includes("saved JP/ja") && (await title(page)) === "千と千尋の神隠し", `A ${tag}: both saved in one step`)
	await shot(page, `a-saved-${tag}`)
	await page.click('[data-toast] button:has-text("Undo")')
	check((await summary(page)).includes("saved no country/browser"), `A ${tag}: Undo takes both back`)
	await page.context().close()
}
{
	const page = await open("variant=A&visitor=member-explicit&page=settings&title=portrait")
	check(await page.locator("[data-settings-page] [data-panel-a]").isVisible(), "A settings: the same panel is the open section")
	await page.click('[data-panel-a] [data-field="lang"]')
	await page.click('[data-panel-a] [role=option]:has-text("Turkish")')
	await shot(page, "a-settings-fallback-desktop")
	check((await text(page, "[data-after]")).includes("no Turkish yet"), "A settings: the preview marks what is not in Turkish")
	await page.click('button:has-text("Discard changes")')
	check((await text(page, "[data-save]")) === "Nothing to save", "A settings: Discard changes empties the draft")
	await page.context().close()
}

// ---- B: look, then keep --------------------------------------------------------------------------------------------
for (const mobile of [false, true]) {
	const tag = mobile ? "phone" : "desktop"
	const page = await open("variant=B&visitor=member-de", mobile)
	await page.click("[data-country]")
	await page.keyboard.type("jap")
	await page.keyboard.press("ArrowLeft")
	check((await variant(page)).startsWith("B"), `B ${tag}: arrow keys in the country search stay in the list`)
	await page.keyboard.press("Enter")
	await page.waitForSelector("[data-look]")
	check((await summary(page)).includes("saved DE/browser") && (await summary(page)).includes("NOT SAVED"), `B ${tag}: a look saves nothing`)
	check((await title(page)) === "Chihiros Reise ins Zauberland", `B ${tag}: a look at Japan leaves the titles in German`)
	await shot(page, `b-look-${tag}`)
	await page.click("[data-back]")
	check((await summary(page)).includes("shows Germany/German") && !(await summary(page)).includes("NOT SAVED"), `B ${tag}: Back to Germany ends the look`)
	await page.click("[data-country]")
	await page.keyboard.type("jap")
	await page.keyboard.press("Enter")
	await page.click("[data-keep]")
	await page.waitForSelector("[data-kept]")
	check((await summary(page)).includes("saved JP/browser"), `B ${tag}: Save as my country saves the country alone`)
	check(await page.locator("[data-companion-ask]").isVisible(), `B ${tag}: after the save it asks about Japanese, and has not switched`)
	check(await page.evaluate(() => document.activeElement?.matches("[data-kept]")), `B ${tag}: the focus moves to the line about the saved country`)
	await page.locator("[data-kept]").evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }))
	check(await onTop(page, "[data-keep-lang]"), `B ${tag}: both answers to the language question are in reach, not under the prototype's bar`)
	await shot(page, `b-kept-ask-${tag}`)
	await page.click('[data-companion-ask] button:has-text("Show titles in Japanese")')
	await page.waitForSelector("[data-toast]")
	check((await summary(page)).includes("saved JP/ja"), `B ${tag}: the language follows only when asked for`)
	// The language chip saves at once; with the keyboard, and a failure leaves it as it was.
	await page.click("[data-proto-toggle]")
	await page.click('[data-proto-panel] button:has-text("Fails")')
	await page.click("[data-proto-toggle]")
	await press(page, "[data-lang-chip]")
	await shot(page, `b-lang-list-${tag}`)
	await page.keyboard.press("ArrowUp")
	await page.keyboard.press("ArrowUp")
	check((await variant(page)).startsWith("B"), `B ${tag}: arrow keys in the language list stay in the list`)
	await page.keyboard.press("Enter")
	await page.waitForSelector("[data-lang-error]")
	check((await summary(page)).includes("saved JP/ja"), `B ${tag}: a failed language save changes nothing`)
	await shot(page, `b-lang-failed-${tag}`)
	await page.context().close()
}
{
	// A look that lasts until it is reset follows to the next title; one that lasts for the title does not.
	const page = await open("variant=B&look=visit&visitor=guest-en-de")
	check((await title(page)) === "Spirited Away", "B: an English browser in Germany gets English titles and German offers")
	await page.click("[data-country]")
	await page.keyboard.type("united k")
	await page.keyboard.press("Enter")
	await press(page, 'button:has-text("Portrait of a Lady on Fire")')
	check(await page.locator("[data-look]").isVisible(), "B: with 'until reset' the look follows to the next title")
	await shot(page, "b-look-visit-desktop")
	await page.context().close()
	const page2 = await open("variant=B&visitor=guest-en-de")
	await page2.click("[data-country]")
	await page2.keyboard.type("united k")
	await page2.keyboard.press("Enter")
	await press(page2, 'button:has-text("Portrait of a Lady on Fire")')
	check(!(await page2.locator("[data-look]").isVisible()), "B: with 'this title' the look ends on the next title")
	await page2.context().close()
	const page3 = await open("variant=B&visitor=member-de&page=settings")
	await page3.click('[data-row="Country"] button:has-text("Change")')
	await page3.keyboard.type("fran")
	await page3.keyboard.press("Enter")
	await page3.waitForSelector("[data-companion-ask]")
	check((await summary(page3)).includes("saved FR/browser"), "B settings: a pick saves at once, the language is asked about")
	await shot(page3, "b-settings-desktop")
	await page3.context().close()
}

// ---- C: compare outcomes -------------------------------------------------------------------------------------------
for (const mobile of [false, true]) {
	const tag = mobile ? "phone" : "desktop"
	const page = await open("variant=C&title=money-heist", mobile)
	await page.click("[data-country]")
	await page.waitForSelector("[data-board-c]")
	check(await page.locator("[data-empty]").isVisible(), `C ${tag}: with nothing changed there is nothing to pick`)
	await page.click('[data-what-if="country"]')
	await page.keyboard.type("spa")
	await page.keyboard.press("Enter")
	check((await page.locator("[data-outcome]").count()) === 3, `C ${tag}: Spain gives Now, only the country, and the country with Spanish`)
	check((await page.locator("[data-outcome] input:checked").count()) === 0 && (await page.locator("[data-try]").isDisabled()), `C ${tag}: with two outcomes none is picked for the visitor`)
	await shot(page, `c-board-country-${tag}`)
	await page.click('[data-what-if="lang"]')
	await page.click('[data-board-c] [role=option]:has-text("French")')
	check((await page.locator("[data-outcome]").count()) === 4, `C ${tag}: a country and a language give one, the other and both`)
	check((await text(page, '[data-outcome="lang"]')).includes("no French yet"), `C ${tag}: the French outcome marks the title that has no French name`)
	await page.locator('[data-outcome="country"] input').focus()
	await page.keyboard.press("ArrowDown")
	check((await variant(page)).startsWith("C") && (await page.locator('[data-outcome="lang"] input').isChecked()), `C ${tag}: arrow keys move between the outcomes`)
	await page.locator('[data-outcome="both"]').click()
	await shot(page, `c-board-both-${tag}`)
	await page.click("[data-try]")
	await page.waitForSelector("[data-visit-bar]")
	check((await summary(page)).includes("saved no country/browser") && (await summary(page)).includes("shows Spain/French"), `C ${tag}: a try changes the page and saves nothing`)
	await shot(page, `c-trying-${tag}`)
	await press(page, 'button:has-text("Le Voyage de Chihiro")')
	check(await page.locator("[data-visit-bar]").isVisible(), `C ${tag}: the try follows to the next title`)
	await page.click("[data-visit-bar] [data-back]")
	check((await summary(page)).includes("shows Germany/German"), `C ${tag}: Reset goes back to what is saved`)
	// A failed save from the board, then a save that lands.
	await page.click("[data-proto-toggle]")
	await page.click('[data-proto-panel] button:has-text("Fails")')
	await page.click("[data-proto-toggle]")
	await press(page, "[data-region-change]")
	await page.click('[data-what-if="lang"]')
	await page.click('[data-board-c] [role=option]:has-text("English")')
	await page.click("[data-save]")
	await page.waitForSelector("[data-save-error]")
	check((await summary(page)).includes("saved no country/browser"), `C ${tag}: a failed save changes nothing`)
	await shot(page, `c-failed-${tag}`)
	await page.keyboard.press("Escape")
	await page.click("[data-proto-toggle]")
	await page.click('[data-proto-panel] button:has-text("Succeeds")')
	if (!mobile) await shot(page, "state-panel-desktop")
	await page.click("[data-proto-toggle]")
	await press(page, "[data-region-change]")
	await page.click('[data-what-if="lang"]')
	await page.click('[data-board-c] [role=option]:has-text("English")')
	await page.click("[data-save]")
	// The line of the earlier try may still be up, so wait for the save itself.
	await page.waitForSelector('[data-toast]:has-text("Saved to")')
	check((await summary(page)).includes("saved no country/en"), `C ${tag}: saving only the language leaves the guessed country unsaved`)
	await page.context().close()
}
{
	const page = await open("variant=C&visitor=member-explicit&page=settings&title=portrait")
	await page.click('[data-what-if="country"]')
	await page.keyboard.type("switz")
	await page.keyboard.press("Enter")
	check((await page.locator("[data-outcome]").count()) === 4, "C settings: Switzerland suggests two languages, as two outcomes")
	await shot(page, "c-settings-desktop")
	await page.context().close()
}

// ---- The review's defects, each driven on its own ------------------------------------------------------------------
{
	// C: a tried language is not saved under "Only the country".
	const page = await open("variant=C&visitor=guest-de")
	await page.click("[data-about-compare]")
	await page.click('[data-what-if="lang"]')
	await page.click('[data-board-c] [role=option]:has-text("Japanese")')
	await page.click("[data-try]")
	await page.waitForSelector("[data-visit-bar]")
	check((await summary(page)).includes("saved no country/browser") && (await summary(page)).includes("shows Germany/Japanese"), "C: trying Japanese shows Japanese and saves nothing")
	await page.click("[data-country]")
	await page.click('[data-what-if="country"]')
	await page.keyboard.type("fran")
	await page.keyboard.press("Enter")
	check((await text(page, "[data-base-name]")).startsWith("Saved"), "C: during a try the first column is named Saved, and a line says what is tried")
	check(await page.locator("[data-board-trying]").isVisible(), "C: the board says it compares with what is saved, not with the try")
	check((await text(page, '[data-outcome="country"]')).includes("Titles in German"), "C: Only the country shows the saved language, German, not the tried Japanese")
	await page.locator('[data-outcome="country"]').click()
	await shot(page, "c-board-during-try-desktop")
	await page.click("[data-save]")
	await page.waitForSelector('[data-toast]:has-text("Saved to")')
	check((await summary(page)).includes("saved FR/browser") && (await summary(page)).includes("shows France/German"), "C: saving Only the country during a Japanese try saves FR and no language")
	await page.context().close()
}
{
	// C on settings: a try has its bar, with Reset and Save this.
	const page = await open("variant=C&visitor=member-de&page=settings")
	await page.click('[data-what-if="country"]')
	await page.keyboard.type("jap")
	await page.keyboard.press("Enter")
	check((await focused(page)).includes("Japan"), "C: after a pick the focus is back on the field, which names its value")
	await page.locator('[data-outcome="country"]').click()
	await page.click("[data-try]")
	await page.waitForSelector("[data-settings-page] [data-visit-bar]")
	check((await summary(page)).includes("saved DE/browser") && (await summary(page)).includes("NOT SAVED"), "C settings: a try shows its bar and saves nothing")
	await shot(page, "c-settings-trying-desktop")
	await page.click("[data-visit-bar] [data-back]")
	check(!(await page.locator("[data-visit-bar]").isVisible()) && (await summary(page)).includes("shows Germany/German"), "C settings: Reset ends the try")
	check((await focused(page)) !== "(nothing)", "C settings: after Reset the focus is on a control")
	await page.context().close()
}
{
	// B settings: Undo takes the lines about the undone save with it.
	const page = await open("variant=B&visitor=member-de&page=settings")
	await page.click('[data-row="Country"] button:has-text("Change")')
	await page.keyboard.type("jap")
	await page.keyboard.press("Enter")
	await page.waitForSelector("[data-row-saved]")
	check((await focused(page)).includes("Country"), "B settings: after a pick the focus is back on the row's Change button")
	await page.click('[data-row-saved] button:has-text("Undo")')
	check((await summary(page)).includes("saved DE/browser"), "B settings: Undo returns the country")
	check((await page.locator("[data-row-saved]").count()) === 0 && (await page.locator("[data-companion-ask]").count()) === 0, "B settings: Undo clears the Saved mark and the language question")
	await page.context().close()
}
{
	// The undecided rule for a title without a name in the language: both placeholders, switchable.
	const en = await open("variant=B&visitor=member-de&title=money-heist")
	await press(en, "[data-lang-chip]")
	await en.click('[role=option]:has-text("French")')
	await en.waitForSelector('[data-toast]:has-text("French")')
	check((await title(en)) === "Money Heist" && (await text(en, "[data-missing]")).includes("title"), "No French title, placeholder rule English: the page shows the English title and says so")
	await en.context().close()
	const orig = await open("variant=B&visitor=member-de&title=money-heist&no-title=original")
	await press(orig, "[data-lang-chip]")
	await orig.click('[role=option]:has-text("French")')
	await orig.waitForSelector('[data-toast]:has-text("French")')
	check((await title(orig)) === "La casa de papel", "No French title, placeholder rule Original: the page shows the original title")
	await orig.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
	await shot(orig, "no-title-original-desktop")
	await orig.context().close()
}
for (const fail of [false, true]) {
	// A: a save cannot be walked away from, so its answer always shows.
	const page = await open(`variant=A${fail ? "&save=fail" : ""}`)
	await page.click("[data-country]")
	await page.click('[data-panel-a] [data-field="country"]')
	await page.keyboard.type("jap")
	await page.keyboard.press("Enter")
	check((await focused(page)).includes("Japan"), "A: after a pick the focus is back on the field, which names its value")
	await page.click("[data-save]")
	await page.keyboard.press("Escape")
	await page.waitForTimeout(150)
	check(await page.locator("[data-panel-a]").isVisible(), `A${fail ? " (failing)" : ""}: Escape during a save does not close the panel`)
	check((await text(page, "[data-save-status]")).startsWith("Saving"), `A${fail ? " (failing)" : ""}: the panel says it is saving`)
	check(await page.locator("[data-cancel]").isDisabled(), `A${fail ? " (failing)" : ""}: Cancel is off while saving`)
	if (!fail) await shot(page, "a-saving-desktop")
	if (fail) {
		await page.waitForSelector("[data-save-error]")
		check((await summary(page)).includes("saved no country/browser"), "A (failing): the error shows in the panel and nothing is saved")
		check((await focused(page)).startsWith("Try again"), "A (failing): the focus is still on the save button")
		await page.keyboard.press("Escape")
		await page.waitForSelector("[data-panel-a]", { state: "detached" })
		check(true, "A (failing): once the answer is there, Escape closes the panel again")
	} else {
		await page.waitForSelector("[data-panel-a]", { state: "detached" })
		check((await summary(page)).includes("saved JP/browser"), "A: the save lands and the panel closes by itself")
		check((await focused(page)).startsWith("Country: Japan"), "A: after the save the focus is back on the country button of the page")
	}
	await page.context().close()
}
{
	// C: the same for the board.
	const page = await open("variant=C&save=fail")
	await page.click("[data-country]")
	await page.click('[data-what-if="country"]')
	await page.keyboard.type("jap")
	await page.keyboard.press("Enter")
	await page.locator('[data-outcome="country"]').click()
	await page.click("[data-save]")
	await page.keyboard.press("Escape")
	await page.waitForTimeout(150)
	check(await page.locator("[data-board-c]").isVisible(), "C: Escape during a save does not close the board")
	await page.waitForSelector("[data-save-error]")
	check((await summary(page)).includes("saved no country/browser"), "C: the error shows on the board and nothing is saved")
	await page.context().close()
}
{
	// A guessed country is not called saved, and can be made the visitor's own in each variant.
	const a = await open("variant=A&visitor=guest-de")
	check((await text(a, "[data-region-line]")).replace(/\s+/g, " ").includes("Germany (our guess)"), "The page's foot marks a guessed country as a guess")
	await a.click("[data-country]")
	check((await text(a, "[data-save]")) === "Nothing to save", "A: a guess alone is not a draft")
	await a.check("[data-confirm-guess] input")
	check((await text(a, "[data-save]")) === "Save country", "A: ticking the guess makes it a draft of one change")
	await shot(a, "a-guess-confirm-desktop")
	await a.click("[data-save]")
	await a.waitForSelector('[data-toast]:has-text("Saved to")')
	check((await summary(a)).includes("saved DE/browser") && !(await text(a, "[data-region-line]")).includes("guess"), "A: the guess is saved as the country, the language is left alone")
	await a.context().close()
	const b = await open("variant=B&visitor=guest-de")
	check((await text(b, "[data-lang-chip]")).includes("browser default"), "B: the language chip says the language is the browser default")
	await b.click("[data-country]")
	await b.click('[data-confirm-guess] button')
	await b.waitForSelector('[data-toast]:has-text("Saved to")')
	check((await summary(b)).includes("saved DE/browser"), "B: the guess can be saved from the country list")
	await b.click("[data-country]")
	await b.keyboard.type("jap")
	await b.keyboard.press("Enter")
	check((await text(b, "[data-look]")).includes("your country is still Germany"), "B: with a saved country the look line says it is still theirs")
	await b.context().close()
	const b2 = await open("variant=B&visitor=guest-de")
	await b2.click("[data-country]")
	await b2.keyboard.type("jap")
	await b2.keyboard.press("Enter")
	check((await text(b2, "[data-look]")).includes("we still guess you are in Germany"), "B: with only a guess the look line does not call Germany theirs")
	check((await focused(b2)).startsWith("Country: Japan"), "B: after a pick the focus is back on the country button")
	await b2.context().close()
	const c = await open("variant=C&visitor=guest-de")
	await c.click("[data-country]")
	await c.click("[data-confirm-guess] button")
	await c.waitForSelector('[data-toast]:has-text("Saved to")')
	check((await summary(c)).includes("saved DE/browser"), "C: the guess can be saved from the first column")
	await c.context().close()
}
{
	// Keyboard: the order of the Tab key, and a popover that closes when the focus leaves it.
	const a = await open("variant=A&visitor=member-de")
	await a.locator("[data-country]").focus()
	await a.keyboard.press("Enter")
	await a.waitForSelector("[data-panel-a]")
	const orderA = await tabs(a, 9)
	console.log(`     A tab order: ${orderA.join(" > ")}`)
	const at = (order, start) => order.findIndex((name) => name.startsWith(start))
	check(at(orderA, "Country Germany") >= 0 && at(orderA, "Country Germany") < at(orderA, "Titles in German") && at(orderA, "Titles in German") < at(orderA, "Cancel"), "A: Tab goes country, language, preview, Cancel, and each field says its value")
	check(await a.evaluate(() => document.activeElement?.closest("[role=dialog]") !== null), "A: Tab stays inside the dialog")
	await a.context().close()
	const b = await open("variant=B&visitor=member-de")
	await b.locator("[data-country]").focus()
	await b.keyboard.press("Enter")
	await b.waitForSelector('[role=listbox][aria-label="Search countries"]')
	const orderB = await tabs(b, 2)
	console.log(`     B tab order from the open country list: ${orderB.join(" > ")}`)
	check((await b.locator('[role=listbox][aria-label="Search countries"]').count()) === 0, "B: the country list closes when Tab leaves it")
	await b.locator("[data-lang-chip]").focus()
	await b.keyboard.press("Enter")
	await b.keyboard.press("Escape")
	check((await focused(b)).startsWith("Titles in"), "B: Escape closes the language list and the focus is on the chip")
	await b.context().close()
	const c = await open("variant=C&visitor=member-de")
	await c.locator("[data-country]").focus()
	await c.keyboard.press("Enter")
	await c.waitForSelector("[data-board-c]")
	await c.click('[data-what-if="country"]')
	await c.keyboard.type("jap")
	await c.keyboard.press("Enter")
	// With two outcomes none is picked, so Try and Save are off until Space picks the outcome under the focus.
	const toOutcomes = await tabs(c, 2)
	await c.keyboard.press("Space")
	const orderC = [...toOutcomes, ...(await tabs(c, 3))]
	console.log(`     C tab order after a country pick: ${orderC.join(" > ")}`)
	check(
		orderC[0].startsWith("with titles in German") && orderC.some((name) => name.startsWith("Keep what I have")) && orderC.some((name) => name.startsWith("Try for this visit")) && orderC.some((name) => name.startsWith("Save to my account")),
		"C: Tab goes language, outcomes (Space picks one), Keep what I have, Try, Save",
	)
	await c.context().close()
}
{
	// The prototype's bar can be shrunk, so nothing under it stays out of reach on a phone.
	const page = await open("variant=B&visitor=member-de", true)
	await page.click("[data-proto-shrink]")
	check((await page.locator("[data-proto-summary]").count()) === 0 && (await page.locator("[data-proto-grow]").isVisible()), "The prototype's bar shrinks to a corner key")
	await page.click("[data-proto-grow]")
	check(await page.locator("[data-proto-summary]").isVisible(), "The corner key brings the bar back")
	await page.context().close()
}
{
	// A simulated shared link that carries the sender's country: a look for the recipient, in their own language.
	const page = await open("variant=B&visitor=recipient-look")
	check((await title(page)) === "千と千尋の神隠し" && (await text(page, "[data-look]")).includes("Looking at Germany"), "A link with a country arrives as a look, in the recipient's language")
	check((await summary(page)).includes("SIMULATED") && (await summary(page)).includes("NOT SAVED"), "The state line calls the shared link simulated and the look not saved")
	await shot(page, "b-recipient-look-desktop")
	await page.context().close()
}

// ---- Visitors ------------------------------------------------------------------------------------------------------
{
	const sv = await open("variant=A&visitor=guest-sv")
	check((await title(sv)) === "Spirited Away" && (await summary(sv)).includes("shows Sweden/English"), "A Swedish browser ends at English, in Sweden")
	await sv.context().close()
	const ja = await open("variant=B&visitor=recipient-ja&title=money-heist")
	check((await title(ja)) === "ペーパー・ハウス", "The recipient of a shared link gets their own language")
	check(await ja.locator("[data-missing]").isVisible(), "The page says what is not in Japanese yet")
	await ja.locator("[data-missing]").evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }))
	await shot(ja, "fallback-on-page-desktop")
	await ja.context().close()
	const member = await open("variant=A&visitor=member-explicit")
	check((await title(member)) === "Spirited Away" && (await summary(member)).includes("saved US/en"), "A saved English wins over a German browser")
	await member.context().close()
	// The switcher's arrow keys: free on the page, left alone inside a field of the prototype's own panel.
	const keys = await open("variant=A&panel=open")
	await keys.keyboard.press("ArrowRight")
	check((await variant(keys)).startsWith("B"), "With nothing focused the right arrow goes to the next variant")
	await keys.locator("[data-proto-panel] select").focus()
	await keys.keyboard.press("ArrowDown")
	await keys.keyboard.press("ArrowRight")
	check((await variant(keys)).startsWith("B"), "Arrow keys in the visitor select do not switch the variant")
	await keys.context().close()
	const plain = await open("variant=A&chrome=off")
	check((await plain.locator("[data-proto-summary]").count()) === 0, "chrome=off hides the prototype's controls")
	await shot(plain, "title-page-desktop", { fullPage: true })
	await plain.context().close()
}

await browser.close()
console.log(`\n${checks - failures.length} of ${checks} checks passed`)
if (failures.length) {
	console.log(failures.map((f) => ` - ${f}`).join("\n"))
	process.exit(1)
}
