// Screenshots of the title section ("Talked about now" on a title page) for titles of the relevance fixture, and the
// check that a title whose links were all dropped shows no section.
//
//   PLAYWRIGHT=<folder with playwright-core> BASE=http://localhost:3171 node title-shots.mjs <out dir> <path>...
//
// The dev server runs with TALKED_ABOUT_NOW_TITLE=on and SOCIAL_FIXTURE=fixture.json. Analytics and the Sentry
// tunnel are answered in the browser, so a run leaves no trace.
import { mkdirSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"

const require = createRequire(`${process.env.PLAYWRIGHT ?? "."}/`)
const { chromium } = require("playwright-core")
const BASE = process.env.BASE ?? "http://localhost:3171"
const [out = "shots", ...paths] = process.argv.slice(2)
mkdirSync(out, { recursive: true })

const QUIET = /posthog|google-analytics|googletagmanager|sentry-browser|\/api\/poster-impressions|\/api\/search-history/
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" })
const report = {}

for (const path of paths) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA })
	const p = await context.newPage()
	await p.route("**/api/e*", (route) => route.fulfill({ status: 200 }))
	await p.route(QUIET, (route) => route.abort())
	const answers = []
	p.on("response", async (response) => {
		if (response.url().includes("/api/social/title")) answers.push(await response.json().catch(() => null))
	})
	await p.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 120_000 })
	// Come near the section, as a visitor scrolling down does: the slot asks for the posts then.
	for (let y = 0; y < 8000 && !answers.length; y += 600) {
		await p.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y)
		await p.waitForTimeout(700)
	}
	await p.waitForTimeout(2500)
	const section = p.locator("#talked-about-now")
	const shown = (await section.count()) > 0
	const name = path.replace(/\W+/g, "-").replace(/^-|-$/g, "")
	report[path] = {
		asked: answers.length > 0,
		items: answers[0]?.items?.map((item) => `${item.source} · ${item.author} · ${item.text.slice(0, 70)}`) ?? null,
		sectionShown: shown,
	}
	if (shown) {
		await section.scrollIntoViewIfNeeded()
		await p.evaluate(() => {
			for (const el of document.querySelectorAll("body *"))
				if (/fixed|sticky/.test(getComputedStyle(el).position)) el.style.visibility = "hidden"
		})
		await section.screenshot({ path: join(out, `title-${name}.png`) })
	}
	await context.close()
}

await browser.close()
writeFileSync(join(out, "title-report.json"), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
