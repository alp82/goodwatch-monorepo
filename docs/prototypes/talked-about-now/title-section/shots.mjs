// Screenshots of /prototype/title-section for the review page: each variant at desktop and phone width, the section
// behind its facades and again with players loaded, and every source's facade and player in the lab variant.
//   PLAYWRIGHT=<folder with playwright-core> BASE=http://localhost:3142 OUT=<folder> node shots.mjs [variant ...]
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
import { join } from "node:path"

const require = createRequire(join(process.env.PLAYWRIGHT ?? ".", "noop.js"))
const { chromium } = require("playwright-core")
const BASE = process.env.BASE ?? "http://localhost:3142"
const OUT = process.env.OUT ?? "shots"
mkdirSync(OUT, { recursive: true })

const VARIANTS = process.argv.slice(2).length ? process.argv.slice(2) : ["rail", "grouped", "featured", "lab"]
const ALL_SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } }
// SIZES=phone (or desktop) shoots one width only.
const SIZES = process.env.SIZES ? { [process.env.SIZES]: ALL_SIZES[process.env.SIZES] } : ALL_SIZES
// What a click loads in each variant for the "loaded" shot: a video, a vertical clip and a post.
const LOAD = {
	rail: ["yt-trailer", "bsky-deadline", "short-out-now"],
	grouped: ["yt-trailer", "short-out-now", "bsky-deadline", "masto-codorco"],
	featured: ["yt-trailer", "bsky-deadline", "tiktok-1"],
	lab: "all",
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--autoplay-policy=user-gesture-required"] })
// Sites answer HeadlessChrome differently (Reddit's embed blocks it, Facebook's answers 503): a normal Chrome UA.
const UA = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version().split(".")[0]}.0.0.0 Safari/537.36`

async function open(size, variant) {
	const context = await browser.newContext({ viewport: SIZES[size], deviceScaleFactor: 1, isMobile: size === "phone", hasTouch: size === "phone", userAgent: UA })
	const page = await context.newPage()
	// Keep the dev server's telemetry tunnel and analytics out of it.
	await page.route(/\/api\/e(\?|$)|posthog|google-analytics|googletagmanager|sentry/, (route) => route.fulfill({ status: 200, body: "" }))
	await page.goto(`${BASE}/prototype/title-section?variant=${variant}&panel=1`, { waitUntil: "load", timeout: 120_000 })
	await page.waitForSelector("#talked-about-now[data-hydrated] [data-item]", { timeout: 120_000 })
	return { context, page }
}

// The page's sticky header and the prototype's floating bars would lie over the section: hidden for its shot.
async function sectionShot(page, file) {
	const section = page.locator("#talked-about-now")
	await section.evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }))
	await page.waitForTimeout(800)
	await page.evaluate(() => {
		for (const el of document.querySelectorAll("body *")) {
			const position = getComputedStyle(el).position
			if ((position === "fixed" || position === "sticky") && !el.closest("#talked-about-now")) {
				el.dataset.shotHidden = el.style.visibility || "-"
				el.style.visibility = "hidden"
			}
		}
	})
	// Chromium does not paint cross-origin frames outside the viewport, so the viewport grows to the whole section
	// for the shot.
	const size = page.viewportSize()
	const height = await section.evaluate((el) => Math.ceil(el.getBoundingClientRect().height))
	if (height > size.height) {
		// Each frame gets painted once in view first: a tall phone viewport alone left some of them blank.
		for (let y = 0; y < height; y += size.height * 0.8) {
			await page.evaluate(([el, dy]) => window.scrollTo({ top: el + dy, behavior: "instant" }), [await section.evaluate((el) => el.getBoundingClientRect().top + window.scrollY), y])
			await page.waitForTimeout(1500)
		}
		await page.setViewportSize({ width: size.width, height: height + 40 })
		await section.evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }))
		await page.waitForTimeout(8000)
	}
	await section.screenshot({ path: join(OUT, file), animations: "disabled" })
	await page.setViewportSize(size)
	await page.evaluate(() => {
		for (const el of document.querySelectorAll("[data-shot-hidden]")) {
			el.style.visibility = el.dataset.shotHidden === "-" ? "" : el.dataset.shotHidden
			delete el.dataset.shotHidden
		}
	})
}

for (const variant of VARIANTS) {
	for (const size of Object.keys(SIZES)) {
		const { context, page } = await open(size, variant)
		await sectionShot(page, `${variant}-${size}-facade.png`)
		// The page around the section, once, so the review shows where it sits.
		if (variant === "rail") {
			await page.evaluate(() => {
				const el = document.querySelector("#talked-about-now")
				window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 300, behavior: "instant" })
			})
			await page.waitForTimeout(800)
			await page.screenshot({ path: join(OUT, `page-${size}.png`) })
		}
		const ids = LOAD[variant] === "all" ? await page.$$eval("[data-load]", (els) => els.map((el) => el.getAttribute("data-load"))) : LOAD[variant]
		for (const id of ids) {
			const button = page.locator(`[data-load="${id}"]`).first()
			if (!(await button.count())) continue
			await button.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }))
			await button.click()
		}
		await page.waitForTimeout(25_000)
		await sectionShot(page, `${variant}-${size}-loaded.png`)
		await context.close()
		console.log("shot", variant, size)
	}
}
await browser.close()
