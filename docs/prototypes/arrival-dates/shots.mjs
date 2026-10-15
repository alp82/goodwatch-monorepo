// Takes the screenshots of /prototype/arrival-dates: every variation at 390 x 844 and 1440 x 900, and reports any
// console error. Adapted from docs/prototypes/new-on-services/shots.mjs (branch ghostex/3fbfaf5b).
//   cd goodwatch-webapp     (no .env: nothing is read from a service)
//   node_modules/.bin/remix vite:dev --port 3121 --strictPort --host 127.0.0.1
//   PLAYWRIGHT=<folder with playwright-core>/node_modules/playwright-core/index.mjs \
//     node ../docs/prototypes/arrival-dates/shots.mjs [output folder] [only: a part of a name]
// The driver is not among the repo's dependencies. CHROMIUM=<path> picks a browser; without it Playwright's own is used.
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")
const base = process.env.HARNESS ?? "http://127.0.0.1:3121"
const out = process.argv[2] || dirname(fileURLToPath(import.meta.url))
const only = process.argv[3]
mkdirSync(out, { recursive: true })

const SIZES = { phone: [390, 844], desktop: [1440, 900] }
const VARIANTS = { A: "days", B: "weeks", C: "size", D: "country", E: "popularity", F: "no-days" }
// name -> the rest of the address. `full` takes the whole page, not only the first screen. `state` opens the panel.
const CASES = {
	member: { query: "viewer=member", full: true },
	"visitor-netflix": { query: "viewer=visitor&service=netflix", full: true },
	"visitor-mubi": { query: "viewer=visitor&service=mubi", full: true },
	"visitor-netflix-br": { query: "viewer=visitor&country=BR&service=netflix", full: true },
	"member-first": { query: "viewer=member&data=first", full: true },
	"visitor-netflix-first": { query: "viewer=visitor&service=netflix&data=first" },
	"visitor-mubi-first": { query: "viewer=visitor&service=mubi&data=first" },
	"visitor-netflix-br-first": { query: "viewer=visitor&country=BR&service=netflix&data=first" },
	"visitor-one": { query: "viewer=visitor&service=netflix&data=one" },
	"member-none": { query: "viewer=member&data=none" },
}
// The state panel, for two pages that mix.
const STATES = {
	"controls-state-c-member": "C&viewer=member",
	"controls-state-e-visitor-netflix": "E&viewer=visitor&service=netflix",
}

const errors = []
async function shoot(page, query, variant, full, path, state) {
	const url = `${base}/prototype/arrival-dates?variant=${query}${state ? "" : "&chrome=off"}`
	await page.goto(url, { waitUntil: "load", timeout: 120_000 })
	await page.waitForSelector(`[data-variant="${variant}"]`, { timeout: 60_000 })
	if (state) await page.click("[data-state-toggle]")
	// Every picture on the first screens has arrived, or has had eight seconds to.
	const arrived = () =>
		page
			.waitForFunction(
				() =>
					[...document.images]
						.filter((img) => img.getBoundingClientRect().top < innerHeight * 2)
						.every((img) => img.complete),
				null,
				{ timeout: 8_000 },
			)
			.catch(() => {})
	await arrived()
	if (full) {
		// Lazy pictures further down load when they come into view.
		await page.evaluate(async () => {
			for (let y = 0; y < document.body.scrollHeight; y += innerHeight) {
				scrollTo({ top: y, behavior: "instant" })
				await new Promise((r) => setTimeout(r, 250))
			}
			scrollTo({ top: 0, behavior: "instant" })
			await new Promise((r) => setTimeout(r, 600))
		})
		await arrived()
	}
	const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
	if (wide) errors.push(`${path}: the page scrolls sideways`)
	await page.screenshot({ path, type: "jpeg", quality: 72, fullPage: Boolean(full) })
}

const browser = await chromium.launch(
	process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {},
)
let failed = 0
for (const [size, [width, height]] of Object.entries(SIZES)) {
	const context = await browser.newContext({
		viewport: { width, height },
		deviceScaleFactor: 1,
		hasTouch: size === "phone",
	})
	const watch = (page) => {
		page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()}: ${m.text()}`))
		page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`))
		return page
	}
	let page = watch(await context.newPage())
	const jobs = []
	for (const [variant, slug] of Object.entries(VARIANTS))
		for (const [name, { query, full }] of Object.entries(CASES))
			jobs.push([`${variant.toLowerCase()}-${slug}-${name}-${size}.jpg`, `${variant}&${query}`, variant, full, false])
	if (size === "desktop")
		for (const [name, query] of Object.entries(STATES))
			jobs.push([`${name}-${size}.jpg`, query, query[0], false, true])
	for (const [file, query, variant, full, state] of jobs) {
		if (only && !file.includes(only)) continue
		// Headless Chromium crashes now and then: a second try gets a new page.
		for (let attempt = 1; attempt <= 2; attempt++)
			try {
				await shoot(page, query, variant, full, join(out, file), state)
				console.log(file)
				break
			} catch (error) {
				console.error(`${attempt === 2 ? "FAILED" : "again"} ${file}: ${error.message.split("\n")[0]}`)
				if (attempt === 2) failed++
				await page.close().catch(() => {})
				page = watch(await context.newPage())
			}
	}
	await context.close()
}
await browser.close()
for (const error of errors) console.error(`ERROR ${error}`)
process.exit(failed || errors.length ? 1 : 0)
