// The For you and cookie switches on the Discover and privacy tile, on the local dev server
// (goodwatch-webapp/scripts/auth-wiring/dev.sh): off, on, keyboard focus and disabled, at 1440 and 390 wide, with
// role=switch and aria-checked following each press and the choice kept after a reload.
// Run: PLAYWRIGHT=<folder with node_modules/playwright> BASE=http://localhost:3061 node docs/implementation/settings-redesign/switches.mjs
const { chromium } = await import(`${process.env.PLAYWRIGHT ?? "."}/node_modules/playwright/index.mjs`)
import { mkdirSync } from "node:fs"
const BASE = process.env.BASE ?? "http://localhost:3550"
const MAIL = process.env.MAILPIT ?? "http://127.0.0.1:15980"
const OUT = process.env.OUT ?? new URL("./shots/switches", import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const WIDTHS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } }
const results = []
const check = (name, ok, detail = "") => {
	results.push({ name, ok })
	console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`)
}
const browser = await chromium.launch()

// A new member who finished the first steps, so nothing covers the page.
const email = `switches-${Date.now()}@example.test`
const signUp = await browser.newContext({ viewport: WIDTHS.desktop })
const page = await signUp.newPage()
await page.goto(`${BASE}/sign-up`, { waitUntil: "load" })
await page.waitForTimeout(3000)
await page.fill("#auth-email", email)
await page.fill("#auth-password", "a long enough password")
await page.click("button[type=submit]")
await page.waitForURL(/verify-email\?state=sent/)
let mail
for (let i = 0; i < 60 && !mail; i++) {
	const found = await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json()
	if (found.messages.length) mail = await (await fetch(`${MAIL}/api/v1/message/${found.messages[0].ID}`)).json()
	else await new Promise((r) => setTimeout(r, 500))
}
await page.goto(mail.Text.match(/https?:\/\/\S+\/api\/auth\/\S+/)[0], { waitUntil: "load" })
await page.waitForURL(/verify-email\?state=confirmed/)
await page.evaluate(() =>
	fetch("/api/user-settings/set", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			settings: { onboarding_country_completed: "yes", onboarding_streaming_completed: "yes", onboarding_ratings_completed: "yes" },
		}),
	}),
)
await page.evaluate(() => fetch("/api/handle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle: `sw${Date.now() % 1_000_000}` }) }))
const state = await signUp.storageState()
await signUp.close()

const settings = (p) => p.evaluate(async () => (await fetch("/api/user-settings/get")).json())
const tile = (p) => p.locator("section[aria-label='Discover and privacy']")
const forYou = (p) => tile(p).getByRole("switch", { name: "For you in Discover" })
const cookies = (p) => tile(p).getByRole("switch", { name: "Cookies" })
async function open(p) {
	await p.goto(`${BASE}/settings`, { waitUntil: "load" })
	await p.addStyleTag({ content: ".tsqd-open-btn-container{display:none!important}" })
	await p.waitForFunction(() => Object.keys(document.querySelector("main") ?? {}).some((k) => k.startsWith("__react")))
	await tile(p).scrollIntoViewIfNeeded()
	await p.waitForTimeout(1500)
}
const shot = (p, name) => tile(p).screenshot({ path: `${OUT}/${name}.png` })
// "for-you-on-cookies-off": the shot's name says what the switches show.
const states = async (p) =>
	`for-you-${(await forYou(p).getAttribute("aria-checked")) === "true" ? "on" : "off"}-cookies-${(await cookies(p).getAttribute("aria-checked")) === "true" ? "on" : "off"}`

for (const [size, viewport] of Object.entries(WIDTHS)) {
	const context = await browser.newContext({ viewport, deviceScaleFactor: 2, storageState: state })
	const p = await context.newPage()
	await p.route(/posthog|googletagmanager|google-analytics/, (route) => route.abort())
	await open(p)
	// The first width starts from what a new member has: For you on, no cookie choice yet (off).
	const startForYou = await forYou(p).getAttribute("aria-checked")
	const startCookies = await cookies(p).getAttribute("aria-checked")
	await shot(p, `${size}-1-${await states(p)}`)

	await forYou(p).click()
	await cookies(p).click()
	await p.waitForTimeout(1500)
	check(`${size}: each press flips aria-checked`, (await forYou(p).getAttribute("aria-checked")) !== startForYou && (await cookies(p).getAttribute("aria-checked")) !== startCookies)
	await shot(p, `${size}-2-${await states(p)}`)

	await forYou(p).click()
	await p.waitForTimeout(1500)
	await shot(p, `${size}-3-${await states(p)}`)
	const saved = await settings(p)
	await p.reload({ waitUntil: "load" })
	await tile(p).scrollIntoViewIfNeeded()
	await p.waitForTimeout(1800)
	check(
		`${size}: kept after a reload`,
		(await forYou(p).getAttribute("aria-checked")) === String(saved.for_you !== "no") &&
			(await cookies(p).getAttribute("aria-checked")) === String(saved.cookie_consent === "yes"),
		`for_you=${saved.for_you} cookie=${saved.cookie_consent}`,
	)

	// Keyboard: Tab reaches the switch with a visible ring, and Space presses it.
	await forYou(p).focus()
	await p.keyboard.press("Shift+Tab")
	await p.keyboard.press("Tab")
	// A ring is a box shadow in a color that isn't transparent, shown for the keyboard's focus.
	const ring = await forYou(p).evaluate((el) => ({
		visible: el.matches(":focus-visible"),
		colored: getComputedStyle(el)
			.boxShadow.split(/,(?![^(]*\))/)
			.some((part) => !/rgba\([^)]*,\s*0\)/.test(part) && !/^\s*none/.test(part)),
	}))
	check(`${size}: a keyboard focus shows a ring`, ring.visible && ring.colored, JSON.stringify(ring))
	await shot(p, `${size}-4-focus`)
	const before = await forYou(p).getAttribute("aria-checked")
	await p.keyboard.press("Space")
	await p.waitForTimeout(800)
	check(`${size}: Space presses it`, (await forYou(p).getAttribute("aria-checked")) !== before)

	// Disabled: while the member's settings haven't loaded, For you can't be pressed and looks it.
	const stalled = await context.newPage()
	await stalled.route("**/api/user-settings/get", () => {})
	await open(stalled)
	check(`${size}: For you is disabled until the settings load`, await forYou(stalled).isDisabled())
	await shot(stalled, `${size}-5-disabled`)
	await stalled.close()
	await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
