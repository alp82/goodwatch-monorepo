// Drives Settings on the local dev server (goodwatch-webapp/scripts/auth-wiring/dev.sh) as a new member: signs up,
// confirms through Mailpit, then opens every tile's sheet at 1440 and 390 wide, saves each kind of setting, reloads to
// see it kept, and follows the old links. The local CrateDB needs the `country` and `streaming_service` rows.
// Run: PLAYWRIGHT=<folder with node_modules/playwright> BASE=http://localhost:3061 node docs/implementation/settings-redesign/drive.mjs
const { chromium } = await import(`${process.env.PLAYWRIGHT ?? "."}/node_modules/playwright/index.mjs`)
import { mkdirSync } from "node:fs"
const BASE = process.env.BASE ?? "http://localhost:3550"
const MAIL = process.env.MAILPIT ?? "http://127.0.0.1:15980"
const OUT = process.env.OUT ?? new URL("./shots", import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const WIDTHS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } }
const PASSWORD = "a long enough password"
const results = []
const check = (name, ok, detail = "") => {
	results.push({ name, ok, detail })
	console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`)
}
const problems = []
const browser = await chromium.launch()
async function newContext(size, storageState) {
	const context = await browser.newContext({ viewport: WIDTHS[size], deviceScaleFactor: 1, storageState })
	context.setDefaultTimeout(60000)
	return context
}
async function newPage(context, label) {
	const page = await context.newPage()
	page.on("pageerror", (e) => problems.push(`${label}: ${e.message}`))
	page.on("console", (m) => {
		if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) problems.push(`${label} console: ${m.text().slice(0, 200)}`)
	})
	await page.route(/posthog|googletagmanager|google-analytics/, (route) => route.abort())
	return page
}
async function go(page, path) {
	await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 120000 })
	await page.addStyleTag({ content: ".tsqd-open-btn-container{display:none!important}" })
	await page.waitForFunction(() => Object.keys(document.querySelector("main") ?? {}).some((k) => k.startsWith("__react")), null, { timeout: 120000 })
	await page.waitForTimeout(1200)
}
// What the viewport shows (the header is fixed, so a full-page shot would put it mid-page); `scrolled` adds a second
// shot one screen further down.
const shot = async (page, name, scrolled = false) => {
	await page.waitForTimeout(500)
	await page.screenshot({ path: `${OUT}/${name}.png` })
	if (!scrolled) return
	await page.mouse.wheel(0, page.viewportSize().height - 120)
	await page.waitForTimeout(600)
	await page.screenshot({ path: `${OUT}/${name}-2.png` })
	await page.evaluate(() => window.scrollTo(0, 0))
}
const settings = (page) => page.evaluate(async () => (await fetch("/api/user-settings/get")).json())
async function waitForMail(address) {
	for (let i = 0; i < 60; i++) {
		const data = await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`)).json()
		if (data.messages.length) return (await fetch(`${MAIL}/api/v1/message/${data.messages[0].ID}`)).json()
		await new Promise((r) => setTimeout(r, 500))
	}
	throw new Error("no confirmation email")
}
const service = (sheet, name) => sheet.locator("button").filter({ hasText: new RegExp(`^${name.replace(/[+]/g, "\\+")}$`) }).first()
const idle = (page) => page.waitForFunction(() => !document.querySelector("[data-pair-status]")?.textContent?.includes("Saving"))

// 1. A new member.
const email = `settings-${Date.now()}@example.test`
const desktop = await newContext("desktop")
const page = await newPage(desktop, "desktop")
await go(page, "/sign-up")
await page.fill("#auth-email", email)
await page.fill("#auth-password", PASSWORD)
await page.click("button[type=submit]")
await page.waitForURL(/verify-email\?state=sent/)
const confirm = await waitForMail(email)
await page.goto(confirm.Text.match(/https?:\/\/\S+\/api\/auth\/\S+/)[0], { waitUntil: "load" })
await page.waitForURL(/verify-email\?state=confirmed/)
check("signed up and confirmed", true, email)

// 2. The tiles.
await go(page, "/settings")
await page.waitForSelector("text=Where you watch")
check("Settings shows the tiles", (await page.locator("main a[href='/settings/where-you-watch']").count()) === 1)
check("Connected apps tile with Better Auth on", (await page.locator("a[href='/settings/connected-apps']").count()) === 1)
await shot(page, "01-home-desktop", true)

// 3. Where you watch: services save one by one, then a country without some of them says so.
await page.click("main a[href='/settings/where-you-watch']")
await page.waitForURL(/\/settings\/where-you-watch$/)
const sheet = page.locator("[data-settings-sheet]")
await sheet.locator("[aria-label='Search countries']").fill("Germany")
await sheet.locator("[data-country-code='DE']").click()
await idle(page)
check("Watching from saves the country", (await settings(page)).country_default === "DE")
for (const name of ["Netflix", "RTL+"]) {
	await sheet.getByLabel("Search services").fill(name)
	await service(sheet, name).click()
	await sheet.getByLabel("Search services").fill("")
	await page.waitForTimeout(300)
}
await page.waitForFunction(() => !document.body.textContent.includes("Saving your services"))
await page.waitForTimeout(800)
let saved = await settings(page)
check("two services saved", saved.streaming_providers_default === "8,6219" || saved.streaming_providers_default?.split(",").length === 2, saved.streaming_providers_default)
await shot(page, "02-where-you-watch-desktop")
await sheet.locator("[aria-label='Search countries']").fill("Japan")
await sheet.locator("[data-country-code='JP']").click()
await idle(page)
await page.waitForSelector("[data-services-notice]")
check("a country without one service says so", (await page.textContent("[data-services-notice]")).includes("1 of your services doesn't stream in Japan"), await page.textContent("[data-services-notice]"))
saved = await settings(page)
check("the member's settings show the new country at once", saved.country_default === "JP", saved.country_default)
check("the services list follows the country", (await sheet.getByPlaceholder("Search services in Japan").count()) === 1)
await shot(page, "03-where-you-watch-japan-desktop")
// Netflix off: only RTL+ is left, which Japan doesn't have.
await sheet.getByLabel("Search services").fill("Netflix")
await service(sheet, "Netflix").click()
await sheet.getByLabel("Search services").fill("")
await page.waitForFunction(() => document.querySelector("[data-services-notice]")?.textContent?.startsWith("None of your services"))
check("a country without any of them says On my services is empty", true)
await shot(page, "04-where-you-watch-empty-desktop")

// 4. Show titles in.
await page.keyboard.press("Escape")
await page.waitForURL(/\/settings$/)
check("Escape closes the sheet back to /settings", true)
check("the tile warns that no service streams there", (await page.textContent("main")).includes("None of your services stream in Japan"))
await page.click("main a[href='/settings/language']")
await page.waitForSelector("[data-show-titles-in] [data-language='ja']")
await idle(page)
await page.click("[data-language='ja']")
await idle(page)
await page.waitForSelector("[data-toast]")
check("a language pick saves with a toast", /Saved .*titles in Japanese/.test(await page.locator("[data-toast]").last().textContent()))
await shot(page, "05-language-desktop")
await go(page, "/settings/language")
check("the language is kept after a reload", (await page.textContent("[data-titles-current]")).startsWith("Japanese"))

// 5. Discover and privacy: For you and cookies.
await page.click("[data-settings-sheet] button[aria-label='Close']")
await page.waitForURL(/\/settings$/)
await page.locator("input[aria-label='For you in Discover']").click({ force: true })
await page.waitForTimeout(1500)
check("For you off is saved", (await settings(page)).for_you === "no")
await page.locator("input[aria-label='Cookies']").click({ force: true })
await page.waitForTimeout(1500)
check("cookie choice is saved", (await settings(page)).cookie_consent === "yes")
check("the cookie banner is gone", !(await page.textContent("body")).includes("We use cookies"))
await shot(page, "06-home-after-desktop", true)

// 6. Public profile: a handle claimed on the sheet shows in the header.
const handle = `set${Date.now() % 1_000_000}`
await go(page, "/settings/profile")
await page.fill("[data-settings-sheet] input", handle)
await page.waitForSelector(`text=@${handle} is available.`)
await page.getByRole("button", { name: "Claim handle" }).click()
await page.waitForSelector(`main >> text=@${handle}`)
check("a claimed handle shows in the Settings header", true, handle)

// 7. The other sheets, at both widths.
const sheets = ["where-you-watch", "language", "profile", "imports", "hidden", "account", "connected-apps"]
for (const name of sheets) {
	await go(page, `/settings/${name}`)
	await page.waitForSelector("[data-settings-sheet]")
	await shot(page, `10-${name}-desktop`)
}
// 8. Old links.
for (const [from, to] of [["/settings/country", "/settings/where-you-watch"], ["/settings/streaming", "/settings/where-you-watch"]]) {
	await page.goto(`${BASE}${from}?from=test`, { waitUntil: "load" })
	check(`${from} lands on ${to}`, new URL(page.url()).pathname === to && page.url().includes("from=test"), page.url())
}
for (const path of ["/settings/profile", "/settings/imports?source=imdb", "/settings/hidden", "/settings/account", "/settings/connected-apps"]) {
	const response = await page.goto(`${BASE}${path}`, { waitUntil: "load" })
	check(`${path} still opens`, response.status() === 200 && (await page.locator("[data-settings-sheet]").count()) === 1, String(response.status()))
}

// 9. Phone, as a member who finished the first steps (a new one sees them over every page).
await page.evaluate(() =>
	fetch("/api/user-settings/set", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ settings: { onboarding_country_completed: "yes", onboarding_streaming_completed: "yes", onboarding_ratings_completed: "yes" } }),
	}),
)
const state = await desktop.storageState()
const phoneContext = await newContext("phone", state)
const phone = await newPage(phoneContext, "phone")
await go(phone, "/settings")
await shot(phone, "01-home-phone", true)
const width = await phone.evaluate(() => document.documentElement.scrollWidth)
check("no sideways scroll on a phone", width <= 390, String(width))
for (const name of sheets) {
	await go(phone, `/settings/${name}`)
	await phone.waitForSelector("[data-settings-sheet]")
	await shot(phone, `10-${name}-phone`)
}

// 10. Restart setup, last: it brings the first steps back over every page.
await go(page, "/settings/account")
await page.getByRole("button", { name: "Restart setup" }).click()
await page.waitForSelector("text=Done. The first steps show up again.")
check("Restart setup resets the first steps", (await settings(page)).onboarding_country_completed === "no")

await browser.close()
for (const p of problems) console.log(`PROBLEM ${p}`)
const failed = results.filter((r) => !r.ok)
console.log(`${results.length - failed.length}/${results.length} checks passed, ${problems.length} page problems`)
process.exit(failed.length ? 1 : 0)
