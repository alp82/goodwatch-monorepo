// Screens and checks for the settings editor, media text in the launch languages, and the header pair's question on a
// 360 px phone with long language names.
//   PLAYWRIGHT=<folder with node_modules/playwright-core> node docs/implementation/media-language-screens/drive-text-settings.mjs http://localhost:3141
// The settings editor runs on /prototype/media-language-ui?view=settings as a guest: its saves go to the real endpoint
// (a guest save writes only the cookie), except where a save is held ("Saving…") or failed (503) in the browser.
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

let failures = 0
const check = (ok, what) => {
	console.log(`${ok ? "ok  " : "FAIL"} ${what}`)
	if (!ok) failures++
}

async function open(browser, url, viewport) {
	const context = await browser.newContext({ viewport, locale: "de-DE" })
	await context.route(/posthog|google-analytics|googletagmanager|sentry|\/api\/poster-impressions|\/api\/search-history/, (r) => r.abort())
	await context.route("**/api/e**", (r) => r.fulfill({ status: 200, body: "" }))
	const p = await context.newPage()
	p.saves = { mode: "real", held: null, sent: [] }
	await p.route("**/api/user-settings/set", async (r) => {
		p.saves.sent.push(r.request().postDataJSON())
		if (p.saves.mode === "hold") p.saves.held = r
		else if (p.saves.mode === "fail") r.fulfill({ status: 503, contentType: "application/json", body: '{"error":"held"}' })
		else r.continue()
	})
	await p.goto(base + url, { waitUntil: "load", timeout: 180_000 })
	await p.addStyleTag({ content: ".tsqd-open-btn-container{display:none!important}" })
	await p.waitForTimeout(2000)
	return p
}
const shot = (p, name) => p.screenshot({ path: path.join(here, `${name}.png`) })
const fits = (p) =>
	p.evaluate(() => {
		const q = document.querySelector("[data-preference-question]")?.getBoundingClientRect()
		return {
			page: document.documentElement.scrollWidth <= window.innerWidth,
			question: q ? q.left >= 0 && q.right <= window.innerWidth : null,
			width: window.innerWidth,
			scroll: document.documentElement.scrollWidth,
		}
	})

async function text(browser) {
	for (const [name, viewport] of [["desktop", { width: 1440, height: 1100 }], ["phone", { width: 360, height: 1400 }]]) {
		const p = await open(browser, "/prototype/media-language-ui?view=text", viewport)
		await p.waitForSelector("[data-sample]")
		const attrs = await p.$$eval("[data-sample] h3", (els) => els.map((e) => [e.getAttribute("lang"), e.getAttribute("dir"), e.getAttribute("data-media-script")]))
		check(attrs.slice(0, 14).every(([lang]) => lang) && attrs[13][1] === "rtl" && attrs[13][2] === "tall" && attrs[7][1] === null, `${name}: every launch language carries lang; Arabic rtl and tall; Japanese no dir`)
		const ar = await p.$eval('[data-sample="ar"] h3', (e) => ({ align: getComputedStyle(e).direction, font: getComputedStyle(e).fontFamily }))
		check(ar.align === "rtl", `${name}: Arabic content runs right to left (${ar.font})`)
		check(await p.evaluate(() => document.documentElement.dir !== "rtl" && getComputedStyle(document.body).direction === "ltr"), `${name}: the interface stays left to right`)
		check((await fits(p)).page, `${name}: no horizontal scroll`)
		await shot(p, `text-${name}`)
		await p.context().close()
	}
}

async function settings(browser) {
	for (const [name, viewport] of [["desktop", { width: 1280, height: 900 }], ["phone", { width: 360, height: 900 }]]) {
		const p = await open(browser, "/prototype/media-language-ui?view=settings", viewport)
		await p.waitForSelector("[data-settings-pair] fieldset:not([disabled])", { timeout: 60_000 })
		await p.waitForSelector("[data-country-code]", { timeout: 60_000 })
		check(/saves on this device/.test(await p.locator("[data-settings-pair]").innerText()), `${name}: the destination is named (a guest here: on this device)`)
		await shot(p, `settings-${name}-1`)

		p.saves.mode = "hold"
		await p.getByLabel("Search countries").fill("Japan")
		await p.locator('[data-country-code="JP"]').click()
		await p.waitForTimeout(400)
		check(await p.locator("[data-settings-pair] fieldset[disabled]").count() === 1, `${name}: a pick saves at once; both lists are off while it saves`)
		check(/Saving on this device/.test(await p.locator("[data-settings-pair] output").innerText()), `${name}: Saving… is said`)
		await shot(p, `settings-${name}-2-saving`)
		const held = p.saves.held
		p.saves.mode = "fail"
		await held.fulfill({ status: 503, contentType: "application/json", body: '{"error":"held"}' })
		await p.waitForSelector("[data-settings-pair] [role=alert]")
		check(/Didn't save/.test(await p.locator("[data-settings-pair] [role=alert]").innerText()), `${name}: a failure is announced, with Retry and Cancel`)
		check(/Japan · not saved/.test(await p.locator("[data-settings-pair] h3").first().innerText()), `${name}: the pick stays, marked not saved`)
		await shot(p, `settings-${name}-3-failed`)

		p.saves.mode = "real"
		await p.locator("[data-retry]").click()
		await p.waitForSelector("[data-toast]", { timeout: 60_000 })
		await p.waitForTimeout(600)
		check(/^Saved on this device: Japan(Undo)?$/.test((await p.locator("[data-toast]").last().textContent()) ?? ""), `${name}: Retry saves; the toast names only the country`)
		const sent = p.saves.sent
		check(sent.length === 2 && sent.every((b) => b.clientId === sent[0].clientId) && sent.map((b) => b.sequence).join() === "1,2" && sent.every((b) => b.pair.language === "browser" && b.pair.country === "JP"), `${name}: the pick and its Retry each send the whole pair, one client, next sequence`)
		await shot(p, `settings-${name}-4-saved`)

		await p.locator('[data-language="ja"]').click()
		await p.waitForTimeout(1500)
		await p.locator('[data-language="browser"]').click()
		await p.locator("[data-toast]", { hasText: "follow" }).waitFor({ timeout: 60_000 })
		const toast = await p.locator("[data-toast]").last().textContent()
		check(/^Saved on this device: titles follow your browser \(currently German\)/.test(toast ?? ""), `${name}: Browser default says follow browser (${toast})`)
		check(/Follow browser \(currently German\)/.test(await p.locator("[data-settings-pair] h3").nth(1).innerText()), `${name}: the Titles heading says Follow browser`)
		await p.locator("[data-toast] button", { hasText: "Undo" }).last().click()
		await p.locator("[data-toast]", { hasText: "Restored" }).waitFor({ timeout: 60_000 })
		check(/Japanese/.test(await p.locator("[data-settings-pair] h3").nth(1).innerText()), `${name}: Undo restores the whole pair before it (Japanese)`)
		await shot(p, `settings-${name}-5-restored`)
		check((await fits(p)).page, `${name}: no horizontal scroll`)
		await p.context().close()
	}
}

async function phoneQuestion(browser) {
	const p = await open(browser, "/movie/129", { width: 360, height: 740 })
	await p.waitForSelector("[data-pair-chip]", { timeout: 120_000 })
	const pick = async (tab, selector, search) => {
		await p.locator("[data-pair-chip]").click()
		await p.getByRole("tab", { name: new RegExp(`^${tab}`) }).click()
		if (search) await p.getByLabel("Search countries").fill(search)
		await p.locator(selector).first().click()
		await p.waitForSelector("[data-preference-question]")
		await p.waitForTimeout(600)
	}
	for (const [label, tab, selector, search] of [
		["portugal", "Country", "[data-preference-dialog] li button:has-text('Portugal')", "Portugal"],
		["taiwan", "Country", "[data-preference-dialog] li button:has-text('Taiwan')", "Taiwan"],
		["switzerland", "Country", "[data-preference-dialog] li button:has-text('Switzerland')", "Switzerland"],
		["european-portuguese", "Titles", '[data-language="pt-PT"]'],
	]) {
		await pick(tab, selector, search)
		const f = await fits(p)
		check(f.page && f.question, `phone 360: ${label} question fits (${f.scroll}px of ${f.width}px)`)
		await shot(p, `phone360-${label}`)
		await p.locator("[data-pair-chip]").focus()
		await p.keyboard.press("Escape")
		await p.waitForTimeout(300)
	}
	await p.context().close()
}

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" })
try {
	await text(browser)
	await settings(browser)
	await phoneQuestion(browser)
} finally {
	await browser.close()
}
console.log(failures ? `${failures} failed` : "all passed")
process.exit(failures ? 1 : 0)
