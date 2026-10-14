// PROTOTYPE - throwaway (#541). Screenshots of the four variants of /prototype/start-row at desktop and phone width,
// for review.html. Takes the driver from PLAYWRIGHT=<folder with playwright-core> and the server from BASE=.
//   PLAYWRIGHT=/path/to/scratch BASE=http://localhost:3141 node docs/prototypes/talked-about-now/start-row/shots.mjs <out dir>
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
import path from "node:path"

const require = createRequire(path.join(process.env.PLAYWRIGHT ?? ".", "x.js"))
const { chromium } = require("playwright-core")
const BASE = process.env.BASE ?? "http://localhost:3141"
const OUT = process.argv[2] ?? "shots"
mkdirSync(OUT, { recursive: true })

const SIZES = {
	desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
	phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" })

async function open(size, variant, hash = "#browse") {
	const context = await browser.newContext(SIZES[size])
	const page = await context.newPage()
	await page.route("**/api/e**", (route) => route.fulfill({ status: 200 }))
	await page.goto(`${BASE}/prototype/start-row?variant=${variant}${hash}`, { waitUntil: "load", timeout: 120_000 })
	await page.addStyleTag({ content: ".sr-switcher{display:none!important}" })
	return { context, page }
}

/** The row with the section's top above it and a little of what follows: the row in its place on the page. */
async function shootRow(page, file, extra = 140) {
	await page.waitForSelector("#talked-title")
	await page.evaluate(() => document.getElementById("browse").scrollIntoView({ block: "start", behavior: "instant" }))
	await page.waitForTimeout(1500)
	await page.evaluate(async () => {
		for (const img of document.querySelectorAll("#browse img")) {
			img.loading = "eager"
			if (!img.complete) await new Promise((r) => { img.onload = img.onerror = r })
		}
	})
	// The site's fixed header and the phone's dock would lie over the clip: they are not what is judged here.
	await page.evaluate(() => {
		for (const el of document.querySelectorAll("body *")) {
			const style = getComputedStyle(el)
			if ((style.position === "fixed" || style.position === "sticky") && !el.closest("#browse")) el.style.visibility = "hidden"
		}
	})
	const section = await page.$("section[aria-labelledby=talked-title]")
	const box = await section.boundingBox()
	const top = await page.evaluate(() => document.getElementById("browse").getBoundingClientRect().top + window.scrollY)
	const scroll = await page.evaluate(() => window.scrollY)
	const width = page.viewportSize().width
	await page.screenshot({
		path: path.join(OUT, file),
		type: "jpeg",
		quality: 82,
		fullPage: true,
		clip: { x: 0, y: top, width, height: box.y + scroll - top + box.height + extra },
	})
}

for (const size of Object.keys(SIZES)) {
	for (const variant of ["A", "B", "C", "D"]) {
		const { context, page } = await open(size, variant)
		await shootRow(page, `${variant}-${size}.jpg`)
		if (variant === "B") {
			await page.click("section[aria-labelledby=talked-title] button[aria-label^='Play']")
			await page.waitForTimeout(300)
			await shootRow(page, `B-${size}-played.jpg`, 20)
		}
		if (variant === "C") {
			await page.click("section[aria-labelledby=talked-title] button[aria-expanded]")
			await page.waitForTimeout(300)
			await shootRow(page, `C-${size}-expanded.jpg`, 20)
		}
		if (variant === "D" && size === "desktop") {
			await page.click("section[aria-labelledby=talked-title] ol li:nth-child(3) button")
			await page.waitForTimeout(400)
			await shootRow(page, "D-desktop-lead3.jpg", 20)
		}
		await context.close()
	}
	// The room's first screen with the ticker's lip.
	const { context, page } = await open(size, "C", "")
	await page.waitForTimeout(2500)
	await page.screenshot({ path: path.join(OUT, `C-${size}-room.jpg`), type: "jpeg", quality: 80 })
	await context.close()
}
await browser.close()
console.log("shots in", OUT)
