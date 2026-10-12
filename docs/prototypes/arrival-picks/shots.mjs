// Screenshots of /prototype/arrival-picks: every variation in every prepared case, at 390 x 844 and 1440 x 900.
// The repository has no browser driver. Install playwright-core in a scratch folder and point PLAYWRIGHT at it:
//   PLAYWRIGHT=/path/to/node_modules/playwright-core BASE=http://127.0.0.1:3111 node shots.mjs [out dir] [filter]
// Prints Tonight's pick of every shot, as the debug panel says it. `MISSING=1` takes only the shots that are not
// in the folder yet.
import { existsSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright-core")
const base = process.env.BASE ?? "http://127.0.0.1:3111"
const out = process.argv[2] ?? dirname(fileURLToPath(import.meta.url))
const only = process.argv[3] ?? ""
mkdirSync(out, { recursive: true })

const VARIANTS = ["A", "B", "C", "D"]
const SHOTS = [
	...["none", "one", "several", "both", "fresh", "old"].map((key) => ({
		name: key,
		query: `case=${key}`,
	})),
	// Beside the six cases: the member who is not in the middle of a show, and the member who has opened the pages.
	{ name: "fresh-earlier", query: "case=fresh&watching=earlier" },
	{ name: "one-nocontinue", query: "case=one&watching=none" },
	{ name: "several-visited", query: "case=several&visited=yes" },
]
const SIZES = {
	desktop: { width: 1440, height: 900 },
	phone: { width: 390, height: 844 },
}

// Headless Chromium goes away now and then on this machine: every size has its own browser, started again on a
// failure.
let browser = null
let page = null
async function pageFor(size) {
	if (page) return page
	browser = await chromium.launch({ executablePath: "/usr/bin/chromium" })
	const context = await browser.newContext({
		viewport: SIZES[size],
		deviceScaleFactor: size === "phone" ? 2 : 1,
		isMobile: size === "phone",
		hasTouch: size === "phone",
	})
	page = await context.newPage()
	return page
}
async function close() {
	await browser?.close().catch(() => {})
	browser = null
	page = null
}

async function shoot(size, variant, shot, path) {
	const page = await pageFor(size)
	await page.goto(
		`${base}/prototype/arrival-picks?variant=${variant}&${shot.query}`,
		{ waitUntil: "load", timeout: 120_000 },
	)
	await page.waitForSelector("[data-home-doors] [data-door]", {
		timeout: 60_000,
	})
	await page.waitForSelector("[data-debug-pick]", { timeout: 60_000 })
	// The posters and backdrops come from another host.
	await page
		.waitForFunction(
			() =>
				[...document.querySelectorAll("[data-tv] img")].every(
					(img) => img.complete && img.naturalWidth > 0,
				),
			null,
			{ timeout: 30_000 },
		)
		.catch(() => console.log("  an image did not load"))
	await page.waitForTimeout(400)
	await page.screenshot({ path, quality: 70, type: "jpeg" })
	return (await page.locator("[data-debug-pick]").innerText()).replace(
		/\s+/g,
		" ",
	)
}

let failed = 0
for (const size of Object.keys(SIZES)) {
	for (const variant of VARIANTS)
		for (const shot of SHOTS) {
			const name = `${variant}-${shot.name}-${size}`
			const path = join(out, `${name}.jpg`)
			if (only && !name.includes(only)) continue
			if (process.env.MISSING && existsSync(path)) continue
			for (let attempt = 1; attempt <= 3; attempt++)
				try {
					console.log(`${name}: ${await shoot(size, variant, shot, path)}`)
					break
				} catch (error) {
					const last = attempt === 3
					if (last) failed++
					console.log(
						`${name}: ${last ? "FAILED" : "again"} ${String(error).split("\n")[0]}`,
					)
					await close()
				}
		}
	await close()
}
process.exit(failed ? 1 : 0)
