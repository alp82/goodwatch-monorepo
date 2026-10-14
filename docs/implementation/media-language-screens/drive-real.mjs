// Drives the header pair against the real save endpoint and the real `gw_loc` cookie, as a guest only (a guest's save
// writes the cookie and nothing else; no member is signed in, so no account row is written).
//   PLAYWRIGHT=<folder with node_modules/playwright-core> node docs/implementation/media-language-screens/drive-real.mjs http://localhost:3141
// Checks: the cookie after Keep, the kept pair in the server's first paint after a reload (scripts off), the toast's
// Undo, Browser default, and a 409 between two tabs of one browser.
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(`${process.env.PLAYWRIGHT ?? "."}/`)
const { chromium } = require("playwright-core")
const base = process.argv[2] ?? "http://localhost:3141"
// Screenshots stay out of the repo (see README.md): SCREENS, or a folder beside the repository's checkout.
const here =
	process.env.SCREENS ??
	path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../goodwatch-media-language-screens")
const TITLE = "/movie/129"
// HeadlessChrome's own user agent is a crawler to the app, which serves crawlers canonical English by policy.
const userAgent =
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

let failures = 0
const check = (ok, what) => {
	console.log(`${ok ? "ok  " : "FAIL"} ${what}`)
	if (!ok) failures++
}

async function quiet(context) {
	await context.route(/posthog|google-analytics|googletagmanager|sentry|\/api\/poster-impressions|\/api\/search-history/, (r) => r.abort())
	await context.route("**/api/e**", (r) => r.fulfill({ status: 200, body: "" }))
}

async function open(context, url = TITLE) {
	const p = await context.newPage()
	p.saves = []
	p.on("response", async (response) => {
		if (!response.url().endsWith("/api/user-settings/set")) return
		const body = response.request().postDataJSON()
		p.saves.push({ body, status: response.status(), answer: await response.json().catch(() => null) })
	})
	await p.goto(base + url, { waitUntil: "load", timeout: 180_000 })
	await p.addStyleTag({ content: ".tsqd-open-btn-container{display:none!important}" })
	await p.waitForSelector("[data-pair-chip]", { timeout: 120_000 })
	await p.waitForTimeout(1500)
	return p
}

const cookie = async (context) => {
	const c = (await context.cookies()).find((c) => c.name === "gw_loc")
	return c ? { ...JSON.parse(decodeURIComponent(c.value)), httpOnly: c.httpOnly } : null
}
const label = (p) => p.locator("[data-pair-chip]").getAttribute("aria-label")
const pending = (p) => p.locator("[data-preference-question]").count().then((n) => n > 0)
async function pick(p, tab, selector, search) {
	await p.locator("[data-pair-chip]").click()
	await p.getByRole("tab", { name: new RegExp(`^${tab}`) }).click()
	if (search) await p.getByLabel("Search countries").fill(search)
	await p.locator(selector).first().click()
	await p.waitForSelector("[data-preference-question]")
}
async function keep(p) {
	const before = p.saves.length
	await p.locator("[data-preference-question] [data-keep]:visible").click()
	await p.waitForFunction((n) => window.__never !== true && n >= 0, before)
	for (let i = 0; i < 120 && p.saves.length === before; i++) await p.waitForTimeout(250)
	await p.waitForTimeout(800)
	return p.saves.at(-1)
}
async function firstPaint(browser, context, cookies) {
	// The server's HTML alone: scripts off, the same cookies (or the ones taken earlier).
	const plain = await browser.newContext({ javaScriptEnabled: false, locale: "de-DE", userAgent })
	await plain.addCookies(cookies ?? (await context.cookies()))
	await quiet(plain)
	const p = await plain.newPage()
	await p.goto(base + TITLE, { waitUntil: "load", timeout: 180_000 })
	const text = await p.locator("[data-pair-chip]").getAttribute("aria-label")
	await plain.close()
	return text ?? ""
}

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" })
try {
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-DE", userAgent })
	await quiet(context)
	const p = await open(context)
	check((await cookie(context)) === null, "guest: no gw_loc cookie before a Keep")
	check(/Country Germany/.test((await label(p)) ?? ""), "guest: the page starts on the guessed Germany")

	// Confirming the guessed country is a change Keep saves (nothing is on record yet).
	await pick(p, "Country", "[data-preference-dialog] li button:has-text('Germany')", "Germany")
	check(await pending(p), "guest: picking the guessed country again offers Keep (nothing on record)")
	await p.locator("[data-undo]:visible").click()

	await pick(p, "Country", "[data-preference-dialog] li button:has-text('Japan')", "Japan")
	const kept = await keep(p)
	check(
		kept?.status === 200 && kept.body.sequence === 1 && kept.body.expectedVersion === null && /^[\w-]{8,80}$/.test(kept.body.clientId),
		`Keep: one POST with clientId, sequence 1, expectedVersion null (${kept?.status})`,
	)
	let c = await cookie(context)
	check(c?.country === "JP" && c.language === "browser" && c.httpOnly && c.version === kept.answer.version, `Keep: gw_loc is set, HttpOnly, JP and browser (${JSON.stringify(c)})`)
	const toast = await p.locator("[data-toast]").last().textContent()
	check(/^Saved on this device: Japan(Undo)?$/.test(toast ?? ""), `Keep: the toast names only the country (${toast})`)
	await p.screenshot({ path: path.join(here, "real-1-kept.png") })

	// The toast lasts 6 s, less than a dev server's page: the first paint with the kept cookie is read after the Undo.
	const keptCookies = await context.cookies()

	// The toast's Undo through the same endpoint and client.
	await p.locator("[data-toast] button", { hasText: "Undo" }).click()
	for (let i = 0; i < 40 && p.saves.length < 2; i++) await p.waitForTimeout(250)
	await p.waitForTimeout(800)
	const undo = p.saves.at(-1)
	check(
		undo?.status === 200 && undo.body.sequence === 2 && undo.body.clientId === kept.body.clientId && undo.body.expectedVersion === kept.answer.version &&
			undo.body.pair.country === "DE" && undo.body.pair.language === "browser",
		`Undo: the pair from before, next sequence, same client, over the kept version (${JSON.stringify(undo?.body)})`,
	)
	c = await cookie(context)
	check(c?.country === "DE" && c.language === "browser", "Undo: gw_loc back to Germany, following the browser")
	check(/Restored on this device: Germany/.test((await p.locator("[data-toast]").last().textContent()) ?? ""), "Undo: a Restored toast")
	const painted = await firstPaint(browser, context, keptCookies)
	check(/Country Japan/.test(painted), `reload: the server's first paint shows the kept Japan (${painted})`)
	check(/Country Germany/.test(await firstPaint(browser, context)), "Undo: the first paint shows Germany again")

	// An explicit language, then Browser default.
	await pick(p, "Titles", '[data-language="fr"]')
	await keep(p)
	c = await cookie(context)
	check(c?.language === "fr", "French kept: gw_loc language fr")
	check(/Titles in French\./.test(await firstPaint(browser, context)), "French kept: the first paint shows French")
	await pick(p, "Titles", '[data-language="browser"]')
	check(/titles follow your browser \(currently German\)/i.test(await p.locator("[data-preference-question]").innerText()), "Browser default: the question says it follows the browser")
	await keep(p)
	c = await cookie(context)
	check(c?.language === "browser", "Browser default kept: gw_loc language browser")
	const browserToast = await p.locator("[data-toast]").last().textContent()
	check(/^Saved on this device: titles follow your browser \(currently German\)/.test(browserToast ?? ""), `Browser default: the toast says follow browser (${browserToast})`)
	check(/Titles in German\./.test(await firstPaint(browser, context)), "Browser default: the first paint shows the browser's German")

	// Two tabs: the second saves first, the first's save conflicts, adopts, and Retry saves over the new revision.
	const first = await open(context)
	const second = await open(context)
	await first.locator("[data-pair-chip]").hover()
	await first.waitForResponse((r) => r.url().endsWith("/api/media-preferences"), { timeout: 30_000 }).catch(() => {})
	await first.waitForTimeout(500)
	await pick(second, "Country", "[data-preference-dialog] li button:has-text('Spain')", "Spain")
	const secondSave = await keep(second)
	await pick(first, "Titles", '[data-language="it"]')
	const refused = await keep(first)
	check(
		refused?.status === 409 && refused.answer?.current?.pair?.country === "ES" && refused.answer.sequence === refused.body.sequence,
		`two tabs: the older tab's save answers 409 with the record on file (${JSON.stringify(refused?.answer)})`,
	)
	const alert = await first.locator("[data-preference-question] [role=alert]:visible").innerText().catch(() => "")
	check(/Saved elsewhere meanwhile/.test(alert), "two tabs: the question says it was saved elsewhere, with Retry")
	check(/Italian/.test((await label(first)) ?? ""), "two tabs: the page keeps the pick")
	c = await cookie(context)
	check(c?.country === "ES" && c.version === secondSave.answer.version, "two tabs: the 409 left the cookie as the other tab saved it")
	await first.screenshot({ path: path.join(here, "real-2-conflict.png") })
	const retry = await keep(first)
	check(
		retry?.status === 200 && retry.body.expectedVersion === secondSave.answer.version && retry.body.pair.language === "it" && retry.body.pair.country === "ES",
		`two tabs: Retry saves the picked Italian with the other tab's Spain, over the adopted revision (${JSON.stringify(retry?.body)})`,
	)
	c = await cookie(context)
	check(c?.language === "it" && c.country === "ES", "two tabs: gw_loc has Spain and the retried Italian")
	await first.close()
	await second.close()

	// The address's country is a view of the page: a Keep of the language alone keeps the saved Spain.
	const viewed = await open(context, `${TITLE}?country=FR`)
	await viewed.locator("[data-pair-chip]").hover()
	await viewed.waitForResponse((r) => r.url().endsWith("/api/media-preferences"), { timeout: 30_000 }).catch(() => {})
	await viewed.waitForTimeout(800)
	check(/Country France, for this page only/.test((await label(viewed)) ?? ""), `?country=FR: the pair says France is this page's only (${await label(viewed)})`)
	await pick(viewed, "Titles", '[data-language="ja"]')
	const languageOnly = await keep(viewed)
	check(
		languageOnly?.status === 200 && languageOnly.body.pair.country === "ES" && languageOnly.body.pair.language === "ja",
		`?country=FR: a language-only Keep saves the saved Spain with Japanese (${JSON.stringify(languageOnly?.body?.pair)})`,
	)
	c = await cookie(context)
	check(c?.country === "ES" && c.language === "ja", "?country=FR: gw_loc keeps Spain")
	check(/Country France/.test((await label(viewed)) ?? ""), "?country=FR: the page still shows France")

	// A preview stays with its title: the next title starts without it.
	await pick(viewed, "Titles", '[data-language="de"]')
	await viewed.evaluate(() => window.__remixRouter.navigate("/movie/603"))
	await viewed.waitForURL(/\/movie\/603/, { timeout: 120_000 })
	await viewed.waitForSelector("h1", { timeout: 120_000 })
	await viewed.waitForTimeout(3000)
	check((await viewed.locator("[data-preference-question]").count()) === 0, "next title: no question carried over")
	check(!/not saved/.test((await label(viewed)) ?? ""), `next title: the pair shows what is saved (${await label(viewed)})`)
	await context.close()
} finally {
	await browser.close()
}
console.log(failures ? `${failures} failed` : "all passed")
process.exit(failures ? 1 : 0)
