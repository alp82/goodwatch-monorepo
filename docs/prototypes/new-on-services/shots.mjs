// Takes the screenshots of /prototype/new-on-services: every variation at 390 x 844 and 1440 x 900.
//   cd goodwatch-webapp     (no .env: nothing is read from a service)
//   REC_NAVIGATION=on REC_TRACKING=on REC_WATCH_NEXT=on node_modules/.bin/remix vite:dev --port 3117 --strictPort --host 127.0.0.1
//   PLAYWRIGHT=<folder with playwright-core>/node_modules/playwright-core/index.mjs \
//     node ../docs/prototypes/new-on-services/shots.mjs [output folder] [only: a part of a name]
// The driver is not among the repo's dependencies; system Chromium is used.
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")
const base = process.env.HARNESS ?? "http://127.0.0.1:3117"
const out = process.argv[2] ?? dirname(fileURLToPath(import.meta.url))
const only = process.argv[3]
mkdirSync(out, { recursive: true })

const SIZES = { phone: [390, 844], desktop: [1440, 900] }
const VARIANTS = { A: "days", B: "services", C: "wall", D: "landing" }
// name -> the rest of the address. `full` takes the whole page, not only the first screen.
const CASES = {
	member: { query: "viewer=member", full: true },
	visitor: { query: "viewer=visitor", full: true },
	"visitor-netflix": { query: "viewer=visitor&services=netflix" },
	"member-quiet": { query: "viewer=quiet" },
	"member-one": { query: "viewer=member&data=one" },
	"visitor-one": { query: "viewer=visitor&data=one&services=netflix" },
	"member-none": { query: "viewer=member&data=none" },
	"visitor-none": { query: "viewer=visitor&data=none&services=netflix" },
}

async function shoot(page, query, variant, full, path) {
	await page.goto(`${base}/prototype/new-on-services?variant=${query}&chrome=off`, {
		waitUntil: "load",
		timeout: 120_000,
	})
	await page.waitForSelector(`[data-variant="${variant}"]`, { timeout: 60_000 })
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
	await page.screenshot({ path, type: "jpeg", quality: 72, fullPage: Boolean(full) })
}

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" })
let failed = 0
for (const [size, [width, height]] of Object.entries(SIZES)) {
	const context = await browser.newContext({
		viewport: { width, height },
		deviceScaleFactor: 1,
		hasTouch: size === "phone",
	})
	let page = await context.newPage()
	for (const [variant, slug] of Object.entries(VARIANTS))
		for (const [name, { query, full }] of Object.entries(CASES)) {
			const file = `${variant.toLowerCase()}-${slug}-${name}-${size}.jpg`
			if (only && !file.includes(only)) continue
			// Headless Chromium crashes now and then on this machine: a second try gets a new page.
			for (let attempt = 1; attempt <= 2; attempt++)
				try {
					await shoot(page, `${variant}&${query}`, variant, full, join(out, file))
					console.log(file)
					break
				} catch (error) {
					console.error(
						`${attempt === 2 ? "FAILED" : "again"} ${file}: ${error.message.split("\n")[0]}`,
					)
					if (attempt === 2) failed++
					await page.close().catch(() => {})
					page = await context.newPage()
				}
		}
	await context.close()
}
await browser.close()
process.exit(failed ? 1 : 0)
