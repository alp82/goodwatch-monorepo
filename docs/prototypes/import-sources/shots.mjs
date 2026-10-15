// Screenshots of /prototype/import-sources at phone and desktop width.
import { mkdirSync } from "node:fs"
import { createRequire } from "node:module"
const require = createRequire("/home/alp/.npm/_npx/e41f203b7505f1fb/node_modules/noop.js")
const { chromium } = require("playwright-core")

const BASE = process.env.BASE ?? "http://localhost:5191/prototype/import-sources"
const OUT = process.argv[2]
mkdirSync(OUT, { recursive: true })
const only = process.argv[3]

const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } }
const clickText = (text, exact = false) => async (page) => {
	await page.getByText(text, { exact }).first().click()
	await page.waitForTimeout(250)
}
const clickRole = (role, name) => async (page) => {
	await page.getByRole(role, { name }).first().click()
	await page.waitForTimeout(250)
}
const sample = (fileName) => async (page) => {
	const summaries = page.locator("summary", { hasText: "Prototype: drop a sample file" })
	await summaries.first().click()
	await page.getByRole("button", { name: fileName, exact: true }).first().click()
	await page.waitForTimeout(400)
}

const shots = [
	["A-list", "A", []],
	["A-netflix-archive-waiting", "A", [clickRole("button", /^Netflix/), clickText("Full account archive"), clickText("I've asked for it, remind me here")]],
	["A-letterboxd-wrong-file", "A", [clickRole("button", /^Letterboxd/), sample("trakt-export-alp82.zip")]],
	["A-letterboxd-preview", "A", [clickRole("button", /^Letterboxd/), sample("letterboxd-alp82-2026-10-15-09-12-utc.zip")]],
	["A-coming-later-kodi", "A", [clickText(/more coming later/), clickRole("button", /^Kodi/)]],
	["B-grid", "B", []],
	["B-tmdb-connect", "B", [clickRole("button", /^TMDB/), clickRole("button", "Connect TMDB")]],
	["B-netflix", "B", [clickRole("button", /^Netflix/)]],
	["B-plex-coming-later", "B", [clickRole("button", /^Plex/)]],
	["C-where-from", "C", []],
	["C-somewhere-else", "C", [clickText(/Somewhere else/)]],
	["C-netflix-steps", "C", [clickRole("button", /^N\s*Netflix|Netflix/)]],
	["D-one-box", "D", []],
	["D-mal-or-kitsu", "D", [sample("anime-list.xml")]],
	["D-unknown-file", "D", [sample("my-movies.xlsx.csv")]],
	["D-no-file-yet-simkl", "D", [async (page) => { await page.selectOption("select", "simkl"); await page.waitForTimeout(250) }]],
	["D-netflix-archive-preview", "D", [sample("netflix-report.zip")]],
	["A-built-today", "A", [], "&built=today"],
]

const browser = await chromium.launch()
for (const [size, viewport] of Object.entries(sizes)) {
	const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: "dark" })
	const page = await context.newPage()
	page.on("pageerror", (error) => console.error("pageerror", error.message))
	for (const [name, variant, steps, extra = ""] of shots) {
		if (only && !name.startsWith(only)) continue
		await page.goto(`${BASE}?variant=${variant}${extra}`, { waitUntil: "networkidle" })
		await page.waitForTimeout(400)
		try {
			for (const step of steps) await step(page)
		} catch (error) {
			console.error(name, size, "step failed:", error.message.split("\n")[0])
		}
		const width = await page.evaluate(() => document.documentElement.scrollWidth)
		if (width > viewport.width) console.error(name, size, "overflows to", width)
		await page.evaluate(() => window.scrollTo(0, 0))
		await page.waitForTimeout(200)
		const sheet = await page.evaluate(() => {
			const aside = [...document.querySelectorAll("aside")].find((el) => getComputedStyle(el).position === "fixed")
			return aside ? aside.scrollHeight : 0
		})
		const height = sheet || (await page.evaluate(() => document.documentElement.scrollHeight))
		await page.setViewportSize({ width: viewport.width, height })
		await page.waitForTimeout(250)
		await page.screenshot({ path: `${OUT}/${name}-${size}.png` })
		await page.setViewportSize(viewport)
		console.log("shot", name, size)
	}
	await context.close()
}
await browser.close()
