// Drives the header pair (variant F) on a real title page of a dev server and saves screenshots beside this file.
//   PLAYWRIGHT=<folder with node_modules/playwright-core> node docs/implementation/media-language-screens/drive.mjs http://localhost:3141
// Saves go to POST /api/user-settings/set. The browser answers it here with the backend's contract
// ({ pair, version, sequence, effectiveContext, destination }; 409 { error, sequence, current }), and can hold an
// answer ("Saving…") or fail it (503), so it can show every state; the private read of what is saved is the real
// server's. drive-real.mjs drives the real endpoint end to end. Analytics and the Sentry tunnel are answered
// in the browser too, so the drive leaves no trace.
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(`${process.env.PLAYWRIGHT ?? "."}/`)
const { chromium } = require("playwright-core")
const base = process.argv[2] ?? "http://localhost:3141"
const here = path.dirname(fileURLToPath(import.meta.url))
const TITLE = "/movie/129"

let failures = 0
const check = (ok, what) => {
	console.log(`${ok ? "ok  " : "FAIL"} ${what}`)
	if (!ok) failures++
}

async function page(browser, viewport) {
	const context = await browser.newContext({ viewport, locale: "de-DE", deviceScaleFactor: 1 })
	const p = await context.newPage()
	await p.route(/posthog|google-analytics|googletagmanager|sentry|\/api\/poster-impressions|\/api\/search-history/, (r) => r.abort())
	await p.route("**/api/e**", (r) => r.fulfill({ status: 200, body: "" }))
	p.saves = { hold: false, held: [], sent: [], conflict: null }
	await p.route("**/api/user-settings/set", (r) => {
		const body = r.request().postDataJSON()
		p.saves.sent.push(body)
		if (p.saves.conflict) {
			const current = p.saves.conflict
			p.saves.conflict = null
			return r.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "conflict", sequence: body.sequence, current }) })
		}
		if (p.saves.hold) p.saves.held.push({ r, body })
		else answer(r, body)
	})
	await p.goto(base + TITLE, { waitUntil: "load", timeout: 180_000 })
	await p.addStyleTag({ content: ".tsqd-open-btn-container{display:none!important}" })
	// A dev server reloads a page once when it has optimized a new dependency: wait it out once.
	await p.waitForSelector("[data-pair-chip]", { timeout: 60_000 }).catch(async () => {
		await p.reload({ waitUntil: "load", timeout: 180_000 })
		await p.waitForSelector("[data-pair-chip]", { timeout: 120_000 })
	})
	await p.waitForTimeout(1500)
	return p
}

const shot = (p, name) => p.screenshot({ path: path.join(here, `${name}.png`) })
const pending = (p) => p.locator("[data-preference-question]").count().then((n) => n > 0)
const focusIs = (p, selector) => p.evaluate((s) => Boolean(document.activeElement?.matches(s)), selector)
const answer = (route, body) =>
	route.fulfill({
		status: 200,
		contentType: "application/json",
		body: JSON.stringify({
			pair: body.pair,
			version: `v${body.sequence}`,
			sequence: body.sequence,
			destination: "device",
			effectiveContext: { ...body.pair, languageSetting: body.pair.language },
		}),
	})
const holdSaves = (p) => {
	p.saves.hold = true
}
const releaseSave = (p, fail) => {
	p.saves.hold = false
	const { r, body } = p.saves.held.shift()
	return fail ? r.fulfill({ status: 503, body: "{}" }) : answer(r, body)
}

async function visual(browser, name, viewport) {
	const p = await page(browser, viewport)
	const pair = p.locator("[data-pair-chip]")
	await shot(p, `${name}-1-closed`)

	await pair.click()
	await p.waitForSelector("[data-preference-dialog]")
	await p.waitForTimeout(800)
	await shot(p, `${name}-2-dialog-country`)
	await p.getByRole("tab", { name: /^Titles/ }).click()
	await p.waitForTimeout(300)
	await shot(p, `${name}-3-dialog-titles`)
	await p.keyboard.press("Escape")
	await p.waitForTimeout(300)
	check(!(await pending(p)), `${name}: closing the dialog without a pick changes nothing`)

	await pair.click()
	check(await p.getByRole("tab", { name: /^Titles/ }).getAttribute("aria-selected") === "true", `${name}: the dialog reopens on the list used last`)
	await p.getByRole("tab", { name: /^Country/ }).click()
	await p.getByLabel("Search countries").fill("Japan")
	await p.locator("[data-preference-dialog] li button", { hasText: "Japan" }).first().click()
	await p.waitForSelector("[data-preference-question]")
	await p.waitForFunction(() => !document.querySelector("[aria-busy=true][class*=opacity]"), null, { timeout: 120_000 }).catch(() => {})
	await p.waitForTimeout(800)
	check(await pending(p), `${name}: a country pick previews with the question open`)
	check((await p.locator("[data-companion]").count()) === 1, `${name}: Japan offers Japanese, as one checkbox`)
	check(!(await p.locator("[data-companion]").isChecked()), `${name}: the offer is not ticked`)
	await shot(p, `${name}-4-preview`)

	// Using the page and the Rent tab leave the question open.
	await p.mouse.wheel(0, 400)
	await p.waitForTimeout(300)
	await p.getByRole("tab", { name: /^Rent/ }).click().catch(() => {})
	await p.mouse.wheel(0, -400)
	await p.waitForTimeout(300)
	check(await pending(p), `${name}: scrolling and Rent keep the preview and the question`)
	await pair.click()
	await p.waitForSelector("[data-preference-dialog]")
	await p.keyboard.press("Escape")
	await p.waitForTimeout(300)
	check(await pending(p), `${name}: reopening the dialog keeps the preview`)

	await p.locator("[data-companion]").check()
	holdSaves(p)
	await p.locator("[data-preference-question] [data-keep]:visible").click()
	await p.waitForTimeout(300)
	check((await pair.getAttribute("aria-disabled")) === "true", `${name}: the pair is off while saving`)
	await shot(p, `${name}-5-saving`)
	await p.keyboard.press("Escape")
	check(await pending(p), `${name}: Escape does nothing while saving`)

	await releaseSave(p, true)
	await p.waitForTimeout(400)
	check((await p.locator("[data-preference-question] [role=alert]").count()) > 0, `${name}: a failed save is announced`)
	check((await p.locator("[data-preference-question] [data-keep]:visible").textContent()) === "Retry", `${name}: Keep becomes Retry`)
	await shot(p, `${name}-6-failed`)

	holdSaves(p)
	await p.locator("[data-preference-question] [data-keep]:visible").click()
	await p.waitForTimeout(200)
	await releaseSave(p, false)
	await p.waitForSelector("[data-toast]")
	await p.waitForTimeout(600)
	check(!(await pending(p)), `${name}: Retry saved; the question is gone`)
	const toast = await p.locator("[data-toast]").textContent()
	check(/Saved on this device: Japan, titles in Japanese/.test(toast ?? ""), `${name}: the toast names the destination and the pair (${toast})`)
	await shot(p, `${name}-7-saved`)

	check(
		JSON.stringify(p.saves.sent.map((b) => [b.sequence, b.pair])) ===
			JSON.stringify([[1, { country: "JP", language: "ja" }], [2, { country: "JP", language: "ja" }]]) &&
			p.saves.sent.every((b) => b.expectedVersion === null),
		`${name}: Keep and Retry each send the whole pair once, with the next sequence`,
	)
	await p.locator("[data-toast] button", { hasText: "Undo" }).click()
	await p.waitForTimeout(600)
	check(/Germany|Deutschland/.test((await pair.getAttribute("aria-label")) ?? ""), `${name}: the toast's Undo restores the whole pair`)
	const undo = p.saves.sent.at(-1)
	check(
		JSON.stringify([undo.pair, undo.sequence, undo.expectedVersion]) === JSON.stringify([{ country: "DE", language: "browser" }, 3, "v2"]) &&
			p.saves.sent.every((b) => b.clientId === undo.clientId),
		`${name}: Undo saves the pair from before through the same call and client, over the kept version`,
	)
	const restored = p.locator("[data-toast]", { hasText: "Restored" })
	await restored.waitFor({ timeout: 30_000 }).catch(() => {})
	check(
		/Restored on this device: Germany, titles follow your browser/.test((await restored.textContent()) ?? "") &&
			(await restored.locator("button").count()) === 0,
		`${name}: a short "Restored" toast without Undo`,
	)
	if (name === "desktop") await shot(p, "desktop-11-restored")
	await p.context().close()
}

async function keyboard(browser) {
	const p = await page(browser, { width: 1440, height: 900 })
	const pair = p.locator("[data-pair-chip]")
	await pair.focus()
	await p.keyboard.press("Enter")
	await p.waitForSelector("[data-preference-dialog]")
	check(await focusIs(p, "[data-preference-dialog] [role=tab][aria-selected=true]"), "keys: the dialog takes the focus, on its open tab")
	await p.keyboard.press("Escape")
	await p.waitForTimeout(300)
	check(await focusIs(p, "[data-pair-chip]"), "keys: Escape closes the dialog and the focus returns to the pair")
	check(!(await pending(p)), "keys: nothing changed")

	await p.keyboard.press("Enter")
	await p.waitForSelector("[data-preference-dialog]")
	await p.getByRole("tab", { name: /^Titles/ }).focus()
	await p.keyboard.press("Enter")
	await p.locator('[data-language="browser"]').focus()
	await p.keyboard.press("ArrowDown")
	await p.keyboard.press("ArrowDown")
	const picked = await p.evaluate(() => document.activeElement?.getAttribute("data-language"))
	await p.keyboard.press("Enter")
	await p.waitForSelector("[data-preference-question]")
	check(picked === "de", `keys: arrows move through the titles list (${picked})`)
	check(await focusIs(p, "[data-pair-chip]"), "keys: after a pick the focus is on the pair")
	check((await p.locator("[data-companion]").count()) === 0, "keys: a language never offers a country")

	// Escape outside the pair's region leaves the preview alone.
	await p.locator("h1").first().click()
	await p.keyboard.press("Escape")
	check(await pending(p), "keys: Escape elsewhere on the page is not the pair's")

	await pair.focus()
	await p.keyboard.press("Escape")
	await p.waitForTimeout(200)
	check(!(await pending(p)), "keys: Escape on the pair drops the preview")
	check(await focusIs(p, "[data-pair-chip]"), "keys: the focus stays on the pair")

	// Browser default: copy says "follow", never "Saved German". First keep French, then go back to the browser.
	await pair.focus()
	await p.keyboard.press("Enter")
	await p.getByRole("tab", { name: /^Titles/ }).click()
	await p.locator('[data-language="fr"]').click()
	await p.locator("[data-preference-question] [data-keep]:visible").click()
	await p.waitForSelector("[data-toast]")
	await p.waitForSelector("[data-preference-question]", { state: "detached" })
	await pair.focus()
	await p.keyboard.press("Enter")
	await p.getByRole("tab", { name: /^Titles/ }).click()
	await p.locator('[data-language="browser"]').click()
	await p.waitForSelector("[data-preference-question]")
	const what = await p.locator("[data-preference-question]").innerText()
	check(/titles follow your browser \(currently German\)/i.test(what), "keys: Browser default says it follows the browser")
	await shot(p, "desktop-8-browser-default")
	await p.keyboard.press("Tab")
	check(await focusIs(p, "[data-undo]"), "keys: Tab from the pair goes into the question")
	await p.keyboard.press("Tab")
	await p.keyboard.press("Enter")
	await p.locator("[data-toast]", { hasText: "follow" }).waitFor({ timeout: 30_000 }).catch(() => {})
	const toast = await p.locator("[data-toast]").last().textContent()
	check(/^Saved on this device: titles follow your browser/.test(toast ?? "") && !/Germany|: German\b/.test(toast ?? ""), `keys: a language-only toast names only the language, as follow browser (${toast})`)
	check(await focusIs(p, "[data-pair-chip]"), "keys: after Keep the focus returns to the pair")

	// Saved elsewhere meanwhile: the page adopts that record as saved, keeps the pick, and Retry saves over its version.
	p.saves.conflict = { pair: { country: "FR", language: "fr" }, version: "v99", sequence: 7 }
	await pair.focus()
	await p.keyboard.press("Enter")
	await p.getByRole("tab", { name: /^Titles/ }).click()
	await p.locator('[data-language="it"]').click()
	await p.locator("[data-preference-question] [data-keep]:visible").click()
	await p.locator("[data-preference-question] [role=alert]:visible").waitFor({ timeout: 30_000 })
	check(/Saved elsewhere meanwhile/.test(await p.locator("[data-preference-question] [role=alert]:visible").innerText()), "keys: a conflict says it was saved elsewhere")
	check(/Italian/.test((await pair.getAttribute("aria-label")) ?? ""), "keys: the page keeps the pick after a conflict")
	check(
		/titles in Italian/i.test(await p.locator("[data-preference-question]").innerText()) && /Country France/.test((await pair.getAttribute("aria-label")) ?? ""),
		"keys: the picked language stays; the unchanged country follows the adopted France",
	)
	await shot(p, "desktop-10-conflict")
	await p.locator("[data-preference-question] [data-keep]:visible").click()
	await p.waitForSelector("[data-preference-question]", { state: "detached", timeout: 30_000 })
	const retry = p.saves.sent.at(-1)
	check(retry.expectedVersion === "v99" && retry.pair.language === "it", `keys: Retry saves over the adopted version (${JSON.stringify(retry)})`)

	// Several languages for one country: radios, with an explicit "No change", none chosen for the visitor.
	await pair.click()
	await p.getByRole("tab", { name: /^Country/ }).click()
	await p.getByLabel("Search countries").fill("Switzerland")
	await p.locator("[data-preference-dialog] li button", { hasText: "Switzerland" }).first().click()
	await p.waitForSelector("[data-preference-question]")
	const radios = p.locator("[data-preference-question] input[type=radio]")
	check((await radios.count()) === 3, `keys: Switzerland offers French and Italian as radios beside No change (${await radios.count()})`)
	check(await p.locator('[data-companion="none"]').isChecked(), "keys: No change is the choice until the visitor picks one")
	await p.waitForTimeout(1500)
	await shot(p, "desktop-9-companion-radios")
	await pair.focus()
	await p.keyboard.press("Escape")
	await p.context().close()
}

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" })
try {
	await visual(browser, "desktop", { width: 1440, height: 900 })
	await visual(browser, "phone", { width: 390, height: 844 })
	await keyboard(browser)
} finally {
	await browser.close()
}
console.log(failures ? `${failures} failed` : "all passed")
process.exit(failures ? 1 : 0)
