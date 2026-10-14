// Live check of localized titles on real data: a dev server on the production catalog (read only), every REC_* flag
// on, as a guest. The header pair's picks save only the guest cookie (no account, no catalog write).
//   PLAYWRIGHT=<folder with node_modules/playwright-core> node docs/implementation/media-language-screens/drive-live.mjs http://localhost:3141
// For German, Japanese, Arabic and then Browser default (an en-US browser, so English):
// - on The Matrix, the pick previews title, poster, tagline and description in place (no layout shift), then Keep;
// - the title pages (header, hero poster, About, fingerprint and questions headings, related carousel, collection,
//   episode tips of a show), Discover, a person page and the command palette's title search then carry text in that
//   language with its `lang` (and `dir="rtl"` for Arabic), and no text of another picked language.
// Main search (/api/combined-search) is not run: a real search writes a history row and may call the paid
// interpreter, so the drive aborts it.
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(`${process.env.PLAYWRIGHT ?? "."}/`)
const { chromium } = require("playwright-core")
const base = process.argv[2] ?? "http://localhost:3141"
const here = path.dirname(fileURLToPath(import.meta.url))
// HeadlessChrome's own user agent is a crawler to the app, which serves crawlers canonical English by policy.
const userAgent =
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

let failures = 0
const bugs = []
const notes = new Set()
const check = (ok, what) => {
	console.log(`${ok ? "ok  " : "FAIL"} ${what}`)
	if (!ok) failures++
}

const MATRIX = "/movie/603-the-matrix"
const PAGES = [
	["matrix", MATRIX],
	["spirited-away", "/movie/129-spirited-away"],
	["breaking-bad", "/show/1396-breaking-bad"],
	["discover", "/discover"],
	["person", "/person/6384-keanu-reeves"],
]
const PICKED = ["de", "ja", "ar"]
const baseOf = (tag) => (tag ?? "").split("-")[0].toLowerCase()

async function newContext(browser, viewport) {
	const context = await browser.newContext({ viewport, locale: "en-US", userAgent })
	await context.route(
		/posthog|google-analytics|googletagmanager|sentry|\/api\/poster-impressions|\/api\/search-history|\/api\/combined-search/,
		(r) => r.abort(),
	)
	await context.route("**/api/e**", (r) => r.fulfill({ status: 200, body: "" }))
	await context.addInitScript(() => {
		window.__shifts = []
		new PerformanceObserver((list) => {
			for (const e of list.getEntries()) if (!e.hadRecentInput) window.__shifts.push({ t: e.startTime, value: e.value })
		}).observe({ type: "layout-shift", buffered: true })
	})
	return context
}

async function go(p, url) {
	for (let attempt = 0; attempt < 3; attempt++) {
		const r = await p.goto(base + url, { waitUntil: "load", timeout: 240_000 }).catch((e) => e)
		if (r && !(r instanceof Error) && r.status() < 500) break
		console.log(`  retry ${url}: ${r instanceof Error ? r.message.slice(0, 80) : r.status()}`)
		await p.waitForTimeout(3000)
	}
	await p.addStyleTag({ content: ".tsqd-open-btn-container{display:none!important}" })
	await p.waitForTimeout(1500)
}

/** Scrolls through the page so its lazy sections (related, collection, questions) come in. */
async function scrollThrough(p) {
	const height = await p.evaluate(() => document.documentElement.scrollHeight)
	for (let y = 0; y < height; y += 800) {
		await p.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y)
		await p.waitForTimeout(500)
	}
	await p.waitForTimeout(2500)
	await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
}

/** Every piece of media text on the page: elements with their own `lang`, outside the pair's own controls. */
const mediaText = (p, scope = "body") =>
	p.$$eval(`${scope} [lang]`, (els) =>
		els
			.filter((e) => !e.closest("[data-preference-dialog],[data-preference-question],[data-pair-chip],[data-toast]"))
			.map((e) => ({
				tag: e.tagName,
				lang: e.getAttribute("lang"),
				dir: e.getAttribute("dir"),
				text: (e.tagName === "IMG" ? e.getAttribute("alt") : e.textContent)?.trim().slice(0, 60) ?? "",
			})),
	)

const ARABIC = /[؀-ۿ]/
const KANA_HAN = /[぀-ヿ一-鿿]/
/** Wrong-language text: a tag of another picked language, or text in a script its tag cannot have. */
function problems(items, language) {
	const out = []
	for (const i of items) {
		const b = baseOf(i.lang)
		if (b !== language && b !== "en" && b !== "und") out.push(["other language", i])
		else if ((b === "en" || b === "de") && (ARABIC.test(i.text) || KANA_HAN.test(i.text))) out.push(["script/lang mismatch", i])
		else if (b === "ar" && i.tag !== "IMG" && i.dir !== "rtl") out.push(["Arabic without dir=rtl", i])
	}
	return out
}

async function survey(p, page, url, language, name) {
	await scrollThrough(p)
	if (page === "breaking-bad") {
		// An episode's tip: its name as the grid has it.
		const cell = p.locator('#episode-ratings button[aria-label*=", episode "]:visible').first()
		await cell.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }))
		await cell.hover()
		await p.waitForTimeout(800)
		const tip = await p.$$eval("[data-episode-tip] [lang]", (els) => els.map((e) => `${e.textContent}[${e.getAttribute("lang")}${e.getAttribute("dir") ? ` ${e.getAttribute("dir")}` : ""}]`))
		check(tip.length > 0, `${name} breaking-bad: an episode tip names its episode with a language: ${tip.slice(0, 2).join(", ")}`)
	}
	const items = await mediaText(p)
	const found = problems(items, language)
	// Data, not a reader fault: an Arabic translation row whose title keeps the Latin name. Listed, not failed.
	for (const i of items) if (baseOf(i.lang) === "ar" && i.tag !== "IMG" && i.text && !ARABIC.test(i.text)) notes.add(`${url}: [${i.lang}] "${i.text}"`)
	const own = items.filter((i) => baseOf(i.lang) === language).length
	check(
		found.length === 0,
		`${name} ${page}: ${items.length} media texts, ${own} in ${language}${found.length ? `; ${found.length} wrong: ${found.slice(0, 3).map(([w, i]) => `${w} ${i.tag}[lang=${i.lang}] "${i.text}"`).join(" | ")}` : ""}`,
	)
	for (const [what, i] of found) bugs.push({ url, language, what, ...i })
	if (language !== "en") check(own > 0, `${name} ${page}: shows text in ${language}`)
	return items
}

async function palette(p, language, name) {
	await p.keyboard.press("Control+k")
	const input = p.getByRole("combobox").or(p.locator("[role=dialog] input")).first()
	await input.waitFor({ timeout: 30_000 })
	await input.fill("matrix")
	await p.waitForTimeout(4000)
	const items = await mediaText(p, "[role=dialog]")
	const found = problems(items, language)
	check(items.length > 0 && found.length === 0, `${name} palette "matrix": ${items.map((i) => `${i.text}[${i.lang}]`).slice(0, 4).join(", ")}${found.length ? ` WRONG ${JSON.stringify(found.slice(0, 2))}` : ""}`)
	for (const [what, i] of found) bugs.push({ url: "palette", language, what, ...i })
	if (language !== "en") check(items.some((i) => baseOf(i.lang) === language), `${name} palette: a title in ${language}`)
	await p.keyboard.press("Escape")
}

const expectedTitle = (p, language) =>
	p.evaluate(
		async (l) => (await (await fetch(`/api/media-title?type=movie&id=603&displayLanguage=${l}`)).json()).title,
		language,
	)

/** The header pair's language pick on The Matrix: preview in place, then Keep. */
async function previewAndKeep(p, language, name) {
	await go(p, MATRIX)
	await p.locator("[data-pair-chip]").click()
	await p.getByRole("tab", { name: /^Titles/ }).click()
	const t0 = await p.evaluate(() => performance.now())
	await p.locator(`[data-language="${language}"]`).click()
	await p.waitForSelector("[data-preference-question]")
	const want = language === "browser" ? "en" : language
	const payload = await expectedTitle(p, want)
	await p.waitForFunction((l) => (document.querySelector("h1")?.getAttribute("lang") ?? "").split("-")[0] === l, want, { timeout: 60_000 })
	await p.waitForTimeout(1500)
	const shown = await p.evaluate(() => ({
		h1: document.querySelector("h1")?.textContent,
		dir: document.querySelector("h1")?.getAttribute("dir"),
		poster: document.querySelector("[data-title-overview] img[lang]")?.getAttribute("src") ?? "",
		shifts: window.__shifts,
	}))
	check(shown.h1 === payload.title, `${name} preview ${language}: header title "${shown.h1}" (payload "${payload.title}")`)
	check(!payload.poster_path || shown.poster.includes(payload.poster_path), `${name} preview ${language}: hero poster ${payload.poster_path}`)
	if (want === "ar") check(shown.dir === "rtl", `${name} preview ar: header title runs right to left`)
	const shift = shown.shifts.filter((s) => s.t >= t0).reduce((a, s) => a + s.value, 0)
	check(shift < 0.01, `${name} preview ${language}: layout shift after the pick ${shift.toFixed(4)}`)
	await p.screenshot({ path: path.join(here, `live-preview-${want}-${name}.png`) })
	// About, further down: its tagline and description in place too.
	const about = await p.evaluate(() => {
		const q = document.querySelector("blockquote p[lang]")
		return { tagline: q?.textContent, lang: q?.getAttribute("lang") }
	})
	if (about.tagline !== undefined)
		check(about.tagline === (payload.tagline ?? undefined), `${name} preview ${language}: About tagline "${about.tagline}" [${about.lang}]`)
	await p.locator("[data-keep]:visible").first().click()
	await p.locator("[data-toast]", { hasText: "Saved" }).waitFor({ timeout: 60_000 })
	await p.waitForTimeout(1500)
}

async function staleAnswers(browser) {
	// A late answer for an earlier pick never lands: Japanese is held back, Arabic picked after it comes first.
	const context = await newContext(browser, { width: 1440, height: 1000 })
	const p = await context.newPage()
	await p.route("**/api/media-title?*displayLanguage=ja*", async (r) => {
		await new Promise((done) => setTimeout(done, 5000))
		await r.continue().catch(() => {})
	})
	await go(p, MATRIX)
	await p.locator("[data-pair-chip]").click()
	await p.getByRole("tab", { name: /^Titles/ }).click()
	await p.locator('[data-language="ja"]').click()
	await p.waitForSelector("[data-preference-question]")
	await p.waitForTimeout(300)
	await p.locator("[data-pair-chip]").click()
	await p.getByRole("tab", { name: /^Titles/ }).click()
	await p.locator('[data-language="ar"]').click()
	await p.waitForFunction(() => document.querySelector("h1")?.getAttribute("lang")?.startsWith("ar"), null, { timeout: 60_000 })
	await p.waitForTimeout(7000)
	const h1 = await p.evaluate(() => [document.querySelector("h1")?.getAttribute("lang"), document.querySelector("h1")?.textContent])
	check(h1[0]?.startsWith("ar"), `stale: the held Japanese answer arrived later and the header still shows Arabic (${h1.join(" ")})`)
	await context.close()
}

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" })
try {
	const desktop = await newContext(browser, { width: 1440, height: 1000 })
	const phone = await newContext(browser, { width: 390, height: 844 })
	const d = await desktop.newPage()
	const m = await phone.newPage()
	for (const language of [...PICKED, "browser"]) {
		const want = language === "browser" ? "en" : language
		await previewAndKeep(d, language, "desktop")
		await previewAndKeep(m, language, "phone")
		for (const [page, url] of PAGES) {
			await go(d, url)
			await survey(d, page, url, want, "desktop")
			await d.screenshot({ path: path.join(here, `live-${want}-${page}-desktop.png`) })
			if (page === "matrix" || page === "breaking-bad" || page === "discover") {
				await go(m, url)
				await survey(m, page, url, want, "phone")
				await m.screenshot({ path: path.join(here, `live-${want}-${page}-phone.png`) })
			}
		}
		await go(d, MATRIX)
		await palette(d, want, "desktop")
	}
	await staleAnswers(browser)
} finally {
	await browser.close()
}
if (bugs.length) {
	console.log("\nwrong-language texts:")
	for (const b of bugs) console.log(JSON.stringify(b))
}
if (notes.size) console.log(`\nArabic-tagged text without Arabic letters (translation data):\n${[...notes].join("\n")}`)
console.log(failures ? `${failures} failed` : "all passed")
process.exit(failures ? 1 : 0)
