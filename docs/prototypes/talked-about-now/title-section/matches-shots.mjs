// Screenshots of ?variant=matches: a few titles and modes, desktop and phone.
//   PLAYWRIGHT=<folder with playwright-core> BASE=http://localhost:3142 OUT=<folder> node matches-shots.mjs
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
import { join } from "node:path"

const require = createRequire(join(process.env.PLAYWRIGHT ?? ".", "noop.js"))
const { chromium } = require("playwright-core")
const BASE = process.env.BASE ?? "http://localhost:3142"
const OUT = process.env.OUT ?? "shots"
mkdirSync(OUT, { recursive: true })

const SHOTS = [
	// name, query, viewport, Bluesky posts to load
	["matches-breaking-bad", "title=tv:1396&lanes=all", { width: 1440, height: 1500 }, 2],
	["matches-narnia", "title=movie:1147572&lanes=all", { width: 1440, height: 1300 }, 0],
	["matches-wandavision-wrong", "title=tv:85271&lanes=all", { width: 1440, height: 1000 }, 0],
	["matches-phone", "title=tv:1396&lanes=all", { width: 390, height: 1600 }, 0],
]

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium" })
const UA = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version().split(".")[0]}.0.0.0 Safari/537.36`
for (const [name, query, viewport, loadBsky] of SHOTS) {
	const phone = viewport.width < 600
	const context = await browser.newContext({ viewport, isMobile: phone, hasTouch: phone, userAgent: UA })
	const page = await context.newPage()
	await page.route(/\/api\/e(\?|$)|posthog|google-analytics|googletagmanager|sentry/, (route) => route.fulfill({ status: 200, body: "" }))
	await page.goto(`${BASE}/prototype/title-section?variant=matches&${query}&switcher=0`, { waitUntil: "load", timeout: 120_000 })
	await page.waitForSelector("[data-matches] [data-item]", { timeout: 120_000 })
	const buttons = page.locator("[data-matches] li [data-load]")
	for (let i = 0; i < loadBsky; i++) await buttons.first().click()
	await page.waitForTimeout(loadBsky ? 12_000 : 2500)
	await page.screenshot({ path: join(OUT, `${name}.png`) })
	await context.close()
	console.log("shot", name)
}
await browser.close()
