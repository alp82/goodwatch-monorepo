// Screenshots of /prototype/arrival-mark: every variation on every page, at 390 x 844 and 1440 x 900.
//   PLAYWRIGHT=<folder with playwright-core> BASE=http://127.0.0.1:3127 node shots.mjs <out dir> [only]
// `only` is a part of a file name, to take a few again ("B-movies").
import { createRequire } from "node:module"
import path from "node:path"

const require = createRequire(path.join(process.env.PLAYWRIGHT ?? process.cwd(), "x.js"))
const { chromium } = require("playwright-core")

const base = process.env.BASE ?? "http://127.0.0.1:3127"
const out = process.argv[2] ?? "."
const only = process.argv[3]

const SIZES = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } }
// name, query, and what to do before the picture
const SHOTS = []
for (const variant of ["A", "B", "C", "D"])
	for (const page of ["movies", "shows", "want", "title"])
		SHOTS.push([`${variant}-${page}`, `variant=${variant}&page=${page}`])
SHOTS.push(
	// B with the chip on, C sorted by best match, D with the log open.
	["B-movies-chip-on", "variant=B&page=movies&only=1"],
	["B-shows-chip-on", "variant=B&page=shows&only=1"],
	["C-movies-best-match", "variant=C&page=movies&sort=match"],
	["D-movies-log-open", "variant=D&page=movies", "[data-log] summary"],
	["D-shows-log-open", "variant=D&page=shows", "[data-log] summary"],
	// The other sample members, on the variation's own page.
	["A-movies-one", "variant=A&page=movies&member=one"],
	["A-movies-none", "variant=A&page=movies&member=none"],
	["D-movies-one", "variant=D&page=movies&member=one"],
	["A-shows-both", "variant=A&page=shows&member=both"],
	["B-shows-both", "variant=B&page=shows&member=both"],
	["C-shows-both", "variant=C&page=shows&member=both"],
	["D-shows-both", "variant=D&page=shows&member=both", "[data-log] summary"],
	// Three days on: the landing of 12 days is 15 days old, the one of 5 days is 8.
	["A-movies-day-3", "variant=A&page=movies&day=3"],
	["C-want-day-3", "variant=C&page=want&day=3"],
	// The grid under the hero, where the posters carry the marks.
	["A-movies-grid", "variant=A&page=movies", null, "[aria-label='The rest of your movies']"],
	["B-movies-grid", "variant=B&page=movies", null, "[aria-label='The rest of your movies']"],
	["C-movies-grid", "variant=C&page=movies&sort=match", null, "[aria-label='The rest of your movies']"],
	["D-movies-grid", "variant=D&page=movies", null, "[aria-label='The rest of your movies']"],
)

// One page load per screen size: the dev server takes most of a minute for one on a busy machine. After it, each
// picture is a navigation inside the app.
async function open(size, attempt = 1) {
	try {
		return await load(size)
	} catch (error) {
		// Headless Chromium crashes now and then on this machine, also on its first page.
		if (attempt === 4) throw error
		return open(size, attempt + 1)
	}
}

async function load(size) {
	const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" })
	const context = await browser.newContext({ viewport: SIZES[size], deviceScaleFactor: size === "phone" ? 2 : 1 })
	const page = await context.newPage()
	await page.goto(`${base}/prototype/arrival-mark`, { waitUntil: "load", timeout: 180_000 })
	await page.waitForSelector("[data-switcher]", { timeout: 60_000 })
	// Hydrated once the pill answers.
	await page.waitForFunction(
		() => {
			document.querySelector("[data-switcher] button:last-child")?.click()
			return location.search.includes("variant=")
		},
		null,
		{ timeout: 120_000, polling: 500 },
	)
	return { browser, page }
}

async function shoot(page, size, [name, query, click, scrollTo]) {
	await page.evaluate((url) => {
		history.pushState(null, "", url)
		dispatchEvent(new PopStateEvent("popstate"))
		window.scrollTo(0, 0)
	}, `/prototype/arrival-mark?${query}`)
	const params = new URLSearchParams(query)
	await page.waitForFunction(
		([variant, name]) =>
			document.querySelector("[data-switcher]")?.textContent?.includes(`${variant} ·`) &&
			document.querySelector(`[data-page-shown="${name}"]`),
		[params.get("variant"), params.get("page")],
		{ timeout: 30_000 },
	)
	// The app restores the scroll position it remembers for a history entry: start from the top instead.
	await page.waitForTimeout(300)
	await page.evaluate(() => window.scrollTo(0, 0))
	if (click) await page.click(click)
	if (scrollTo)
		await page
			.locator(scrollTo)
			.first()
			.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 90))
	// Posters and backdrops come from TMDB. One that failed to load is asked for again.
	for (let round = 0; round < 4; round++) {
		const loaded = await page
			.waitForFunction(
				() =>
					[...document.images]
						.filter((img) => img.getBoundingClientRect().top < innerHeight && img.getBoundingClientRect().bottom > 0)
						.every((img) => img.complete),
				null,
				{ timeout: 30_000 },
			)
			.then(() => true, () => false)
		const broken = await page.evaluate(() => {
			const failed = [...document.images].filter((img) => img.complete && img.naturalWidth === 0 && img.src)
			for (const img of failed) img.src = `${img.src.split("#")[0]}#${Date.now()}`
			return failed.length
		})
		if (loaded && !broken) break
		await page.waitForTimeout(1500)
	}
	await page.waitForTimeout(500)
	await page.screenshot({ path: path.join(out, `${name}-${size}.jpg`), quality: 80 })
}

for (const size of Object.keys(SIZES)) {
	let session = await open(size)
	for (const shot of SHOTS) {
		if (only && !shot[0].includes(only)) continue
		for (let attempt = 1; ; attempt++) {
			try {
				await shoot(session.page, size, shot)
				console.log(`${shot[0]}-${size}`)
				break
			} catch (error) {
				// Headless Chromium crashes now and then on this machine: start over with a new one.
				if (attempt === 3) throw error
				await session.browser.close().catch(() => {})
				session = await open(size)
			}
		}
	}
	await session.browser.close()
}
