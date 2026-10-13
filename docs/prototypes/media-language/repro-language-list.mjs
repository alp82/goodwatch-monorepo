// PROTOTYPE - throwaway. One command for the report "I saved a change in A and now no language selector opens in any
// of the three variants": saves in A with real clicks, then opens the language list in A, B and C in the same page,
// without a reload. Prints a line per step and exits 1 when a list does not open.
//   PLAYWRIGHT=<folder with node_modules/playwright-core> node repro-language-list.mjs [base url] [what to save in A]
// What to do in A: lang (default), country, both, companion (save that), twice (save a language, then another),
// undo (save, then Undo), fail (a failed save, then one that lands), cancel (draft, Cancel, then save),
// settings (save on the settings page, then go to the title page). VISITOR=<key> picks the visitor (default guest-de;
// settings needs a member).
// ONLY AGAINST A COPY NOBODY IS REVIEWING, never the server someone has open:
// HOT_EDIT=<file>[:break] replays a source edit into the open page after the save, as a dev server does while someone
// works on the code: a comment, or with :break an import of a name the module does not export. The file is restored.
import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"

const require = createRequire(`${process.env.PLAYWRIGHT ?? process.cwd()}/`)
const { chromium } = require("playwright-core")
const base = `${process.argv[2] ?? "http://localhost:3117"}/prototype/media-language`
const what = process.argv[3] ?? "lang"
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium" })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const problems = []
page.on("pageerror", (e) => problems.push(`page error: ${e.message}`))
page.on("console", (m) => m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text()) && problems.push(`console: ${m.text().slice(0, 240)}`))
await page.route(/googletagmanager\.com|google-analytics\.com|posthog\.com|sentry\.io|\/api\/e$/, (r) => r.abort())
const visitor = process.env.VISITOR ?? (what === "settings" ? "member-de" : "guest-de")
await page.goto(`${base}?variant=A&visitor=${visitor}${what === "settings" ? "&page=settings" : ""}`, { waitUntil: "load", timeout: 120000 })
await page.waitForSelector("[data-variant] h1")
await page.waitForTimeout(1500)

let red = false
const LANG_LIST = '[role=listbox][aria-label="Titles in"]'
const FIELD = { country: '[data-field="country"], button[aria-labelledby="a-country"]', lang: '[data-field="lang"], button[aria-labelledby="a-lang"]' }
// What a person would see at the point of a click: the element under the pointer, the focus, anything inert.
const probe = (sel) =>
	page.evaluate((sel) => {
		const el = document.querySelector(sel)
		if (!el) return { missing: sel }
		const r = el.getBoundingClientRect()
		const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
		return {
			hit: hit === el || el.contains(hit) ? "itself" : hit?.outerHTML.slice(0, 160),
			disabled: el.matches(":disabled"),
			expanded: el.getAttribute("aria-expanded"),
			inert: Boolean(el.closest("[inert]")),
			focus: document.activeElement?.outerHTML.slice(0, 100),
			dialogs: document.querySelectorAll("[role=dialog]").length,
			saving: document.querySelector("[aria-busy=true]") !== null,
		}
	}, sel)
async function opens(label, trigger) {
	const before = await probe(trigger)
	await page.click(trigger, { timeout: 5000 }).catch((e) => problems.push(`${label}: click failed: ${e.message.split("\n")[0]}`))
	const ok = await page
		.waitForSelector(LANG_LIST, { state: "visible", timeout: 2500 })
		.then(() => true)
		.catch(() => false)
	// Open is not enough: it must stay open, lie on top, and take a pick.
	let state = ""
	if (ok) {
		await page.waitForTimeout(700)
		state = await page.evaluate((sel) => {
			const list = document.querySelector(sel)
			if (!list) return "closed again within 0.7 s"
			// The list scrolls to the saved language, so the first option may be out of sight: test the selected one.
			const option = list.querySelector("[role=option][aria-selected=true]") ?? list.querySelector("[role=option]")
			const r = option.getBoundingClientRect()
			const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
			if (!list.contains(hit)) return `covered by ${hit?.outerHTML.slice(0, 120)}`
			return list.querySelectorAll("[role=option]").length === 7 ? "" : `has ${list.querySelectorAll("[role=option]").length} options, not 7`
		}, LANG_LIST)
	}
	const good = ok && state === ""
	if (!good) red = true
	console.log(`${good ? "ok  " : "RED "} ${label}: the language list ${good ? "opens, stays open and is on top" : ok ? state : "does NOT open"}${ok ? "" : ` | at the click: ${JSON.stringify(before)}`}`)
	// Close the list the way it was opened. (Escape would also close A's whole dialog.)
	if (ok) await page.click(trigger)
	await page.waitForTimeout(300)
}
const summary = () => page.locator("[data-proto-summary]").innerText()
const pickFromOpenList = (text) => page.click(`[role=option]:has-text("${text}")`)

const panel = async () => {
	if (what !== "settings") await page.click("[data-country]")
	await page.waitForSelector("[data-panel-a]")
}
const draftLang = async (name) => {
	await page.click(FIELD.lang)
	await pickFromOpenList(name)
}
const saveAndWait = async (expect) => {
	await page.click("[data-save]")
	await page.waitForFunction((t) => document.querySelector("[data-proto-summary]")?.textContent.includes(t), expect, { timeout: 5000 }).catch(() => problems.push(`the state line never showed "${expect}"`))
	await page.waitForTimeout(300)
}
const failNext = async (fail) => {
	await page.click("[data-proto-toggle]")
	await page.click(`[data-proto-panel] button:has-text("${fail ? "Fails" : "Succeeds"}")`)
	await page.click("[data-proto-toggle]")
}

// 1. A: a control check before any save.
await panel()
await opens("A before any save", FIELD.lang)

// 2. A: the change, with real clicks.
if (what === "lang" || what === "both" || what === "settings") await draftLang("French")
if (what === "country" || what === "both" || what === "companion") {
	await page.click(FIELD.country)
	await page.keyboard.type("jap")
	await page.keyboard.press("Enter")
}
if (what === "companion") await page.check("[data-companion] input")
if (what === "twice") {
	await draftLang("French")
	await saveAndWait("/fr")
	await panel()
	await draftLang("Spanish")
}
if (what === "cancel") {
	await draftLang("Turkish")
	await page.click("[data-cancel], [data-panel-a] button:has-text('Cancel')")
	await panel()
	await draftLang("French")
}
if (what === "fail") {
	await page.keyboard.press("Escape")
	await failNext(true)
	await panel()
	await draftLang("French")
	await page.click("[data-save]")
	await page.waitForSelector("[data-save-error]")
	await page.keyboard.press("Escape")
	await page.waitForSelector("[data-panel-a]", { state: "detached" })
	await failNext(false)
	await panel()
	await draftLang("French")
}
if (what === "undo") await draftLang("French")
await saveAndWait(what === "country" ? "saved JP/" : what === "companion" ? "/ja" : what === "twice" ? "/es" : "/fr")
if (what === "undo") {
	await page.click('[data-toast] button:has-text("Undo")')
	await page.waitForTimeout(300)
}
console.log(`     done in A (${what}, ${visitor}): ${await summary()}`)
if (what === "settings") {
	await page.click("[data-proto-toggle]")
	await page.click('[data-proto-panel] button:has-text("Title page")')
	await page.click("[data-proto-toggle]")
}

// 2b. Optionally, a source edit lands in the open page.
const [hotFile, hotMode] = (process.env.HOT_EDIT ?? "").split(":")
let original = null
if (hotFile) {
	original = readFileSync(hotFile, "utf8")
	writeFileSync(hotFile, hotMode === "break" ? `import { notExported${Date.now()} } from "./fixtures"\n${original}` : `${original}\n// hot edit ${Date.now()}\n`)
	await page.waitForTimeout(4000)
	console.log(`     hot edit (${hotMode ?? "comment"}) of ${hotFile.split("/").pop()} landed: ${await summary().catch(() => "the state line is gone")}`)
}
const restore = () => original !== null && writeFileSync(hotFile, original)
process.on("exit", restore)

// 3. A again, same page.
await page.click("[data-country]")
await page.waitForSelector("[data-panel-a]", { timeout: 5000 }).catch(() => problems.push("A: the panel did not reopen"))
const stuck = await page.evaluate(() => ({ busy: document.querySelectorAll("[aria-busy=true]").length, inert: document.querySelectorAll("[inert]").length, dialogs: document.querySelectorAll("[role=dialog]").length, bodyLocked: getComputedStyle(document.documentElement).overflow }))
console.log(`     with A's panel open again: ${JSON.stringify(stuck)}`)
await opens("A after the save", FIELD.lang)
await page.keyboard.press("Escape")
await page.waitForTimeout(400)

// 4. B, same page.
await page.click('[aria-label="Next variant"]')
await page.waitForFunction(() => document.querySelector("[data-variant]")?.getAttribute("data-variant") === "B")
await page.locator("[data-lang-chip]").evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }))
await opens("B after the save in A", "[data-lang-chip]")

// 5. C, same page.
await page.click('[aria-label="Next variant"]')
await page.waitForFunction(() => document.querySelector("[data-variant]")?.getAttribute("data-variant") === "C")
await page.locator("[data-about-compare]").evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }))
await page.click("[data-about-compare]")
await page.waitForSelector("[data-board-c]", { timeout: 5000 }).catch(() => problems.push("C: the board did not open"))
await opens("C after the save in A", '[data-what-if="lang"]')

if (problems.length) console.log(`problems:\n${problems.map((p) => ` - ${p}`).join("\n")}`)
console.log(red ? "RED: a language list did not open" : "GREEN: every language list opened")
await browser.close()
process.exit(red ? 1 : 0)
