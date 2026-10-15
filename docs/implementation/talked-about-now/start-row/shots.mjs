// Screenshots of the "Talked about now" row (#557) at desktop and phone width, the heights of the featured title and
// the board side by side, and the first-view check: a fresh visit to the start page asks for nothing of the row.
//
//   PLAYWRIGHT=<folder with playwright-core> BASE=http://localhost:3161 node shots.mjs <out dir>
//
// Analytics and the Sentry tunnel are answered in the browser, so a run leaves no trace.
import { mkdirSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"

const require = createRequire(`${process.env.PLAYWRIGHT ?? "."}/`)
const { chromium } = require("playwright-core")
const BASE = process.env.BASE ?? "http://localhost:3161"
const out = process.argv[2] ?? "shots"
mkdirSync(out, { recursive: true })

const QUIET = /posthog|google-analytics|googletagmanager|sentry-browser|\/api\/poster-impressions|\/api\/search-history/
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" })
const report = {}

async function page(viewport, mobile) {
	const context = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile })
	const p = await context.newPage()
	await p.route("**/api/e*", (route) => route.fulfill({ status: 200 }))
	await p.route(QUIET, (route) => route.abort())
	return p
}

// 1. The first view: a fresh visit, the room locked, nothing scrolled.
{
	const p = await page({ width: 412, height: 823 }, true)
	const asked = []
	p.on("request", (request) => asked.push(request.url()))
	await p.goto(`${BASE}/`, { waitUntil: "load", timeout: 120_000 })
	// Hydrated: the page has taken its lock.
	await p.waitForFunction(() => document.documentElement.dataset.lr, null, { timeout: 120_000 })
	await p.waitForTimeout(5000)
	// The slot and its request helper are part of the start page itself (in a dev server, modules of their own).
	const row = asked.filter((url) => /api\/talked-about-now|TalkedAboutNow\.tsx|talked-about-now\.css|TalkedAboutNow-[^/]*\.js|social-embed/i.test(url))
	report.firstView = {
		requests: asked.length,
		rowRequests: row,
		slotInHtml: await p.evaluate(() => Boolean(document.querySelector(".tn, .tn-wait"))),
		locked: await p.evaluate(() => document.documentElement.dataset.lr ?? null),
	}
	await p.context().close()
}

// 2. Desktop and phone, below the room.
for (const [name, viewport, mobile] of [
	["desktop", { width: 1440, height: 900 }, false],
	["phone", { width: 390, height: 844 }, true],
]) {
	const p = await page(viewport, mobile)
	const hosts = new Set()
	p.on("request", (request) => hosts.add(new URL(request.url()).host))
	await p.goto(`${BASE}/#browse`, { waitUntil: "load", timeout: 120_000 })
	await p.waitForSelector(".tn-board", { timeout: 120_000 })
	await p.evaluate(() => document.querySelector(".tn")?.scrollIntoView({ block: "start", behavior: "instant" }))
	await p.waitForTimeout(2500)
	const sizes = await p.evaluate(() => {
		const box = (selector) => document.querySelector(selector)?.getBoundingClientRect()
		const lead = box(".tn-grid > .tn-lead") ?? box(".tn-inline .tn-lead")
		const board = box(".tn-board")
		return { lead: lead && Math.round(lead.height), board: board && Math.round(board.height), page: document.documentElement.scrollWidth }
	})
	const own = new URL(BASE).host
	report[name] = { ...sizes, viewport, hostsBeforePress: [...hosts].filter((host) => host !== own).sort() }
	// As the visitor sees it, with the site's header and dock.
	await p.screenshot({ path: join(out, `${name}-window.png`) })
	// The whole row, without the fixed header and dock that lie over it.
	await p.evaluate(() => {
		for (const el of document.querySelectorAll("body *"))
			if (!el.closest(".lrb") && /fixed|sticky/.test(getComputedStyle(el).position)) el.style.visibility = "hidden"
	})
	await p.locator(".tn").screenshot({ path: join(out, `${name}.png`) })
	// The press loads the player, and only then its host.
	if (name === "desktop") {
		// The first featured title may have no player: feature the first one that has.
		const press = p.locator(".tn-lead [data-social-item] button")
		for (let i = 0; !(await press.count()) && i < (await p.locator(".tn-row").count()); i++) {
			await p.locator(".tn-row").nth(i).click()
			await p.waitForTimeout(800)
		}
		await press.first().click()
		await p.waitForSelector(".tn-lead iframe", { timeout: 30_000 })
		await p.waitForTimeout(2000)
		report.afterPress = {
			iframe: await p.locator(".tn-lead iframe").first().getAttribute("src"),
			hosts: [...hosts].filter((host) => host !== own).sort(),
		}
		await p.screenshot({ path: join(out, "desktop-pressed.png") })
	}
	// The second title featured: the heights again.
	await p.locator(".tn-row").nth(1).click()
	await p.waitForTimeout(1500)
	report[`${name}-second`] = await p.evaluate(() => {
		const lead = document.querySelector(".tn-grid > .tn-lead, .tn-inline .tn-lead")?.getBoundingClientRect()
		const board = document.querySelector(".tn-board")?.getBoundingClientRect()
		return { lead: lead && Math.round(lead.height), board: board && Math.round(board.height) }
	})
	await p.locator(".tn").screenshot({ path: join(out, `${name}-second.png`) })
	await p.context().close()
}

await browser.close()
writeFileSync(join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
