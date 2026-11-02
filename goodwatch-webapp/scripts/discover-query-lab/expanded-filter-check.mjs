import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { mkdir } from "node:fs/promises"
const workspace = createRequire(
	new URL("../../../yepwatch-app/package.json", import.meta.url),
)
const imported = await import(
	pathToFileURL(workspace.resolve("playwright")).href
)
const { chromium } = imported.chromium ? imported : imported.default
const base = process.env.START_PAGE_URL ?? "http://127.0.0.1:3000"
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
	viewport: { width: 1440, height: 1100 },
})
const page = await context.newPage()
const errors = []
page.on("pageerror", (e) => errors.push(e.message))
await mkdir("/tmp/gw-expanded-filters", { recursive: true })
try {
	for (const [q, expected] of [
		["IMDb 8+", { sources: "imdb:80" }],
		["low budget flop", { budget: "-4.999", returns: "flop" }],
		[
			"finished series at most two seasons",
			{ showStatus: "ended", seasons: "-2" },
		],
		["controversial", { gap: "audience" }],
		["episodes under 30 minutes", { episodeRuntime: "-29" }],
		["top 100", { rank: "-100" }],
		["both scary and funny", { moods: "scary,funny", all: "moods" }],
		["on my wishlist", { wishlist: "1" }],
		["Tubi", { services: "73" }],
		["French age ratings", { ratingCountry: "FR" }],
	]) {
		const r = await context.request.post(`${base}/api/discover/interpret`, {
			headers: { Origin: base },
			data: { query: q },
		})
		assert(r.ok(), q)
		const parsed = await r.json()
		const p = new URLSearchParams(parsed.params)
		for (const [k, v] of Object.entries(expected))
			assert.equal(p.get(k), v, `${q}: ${k}`)
		console.log("PASS API", q)
	}
	for (const q of [
		"IMDb 8+",
		"low budget flop",
		"finished series at most two seasons",
		"controversial",
	]) {
		const response = page.waitForResponse(
			(r) => r.url().includes("/api/discover/results?") && r.ok(),
			{ timeout: 60000 },
		)
		await page.goto(`${base}/?q=${encodeURIComponent(q)}`)
		const r = await response
		const data = await r.json()
		assert(data.total > 0, q)
		const interpretation = await context.request.post(
			`${base}/api/discover/interpret`,
			{ headers: { Origin: base }, data: { query: q } },
		)
		const parsed = await interpretation.json()
		const seeAll = page.getByRole("link", { name: /See all/ }).first()
		await seeAll.waitFor()
		assert.equal(await seeAll.getAttribute("href"), parsed.href)
		const text = await page.locator(".start-bar").innerText()
		assert(
			text.includes(
				q === "controversial"
					? "Audiences liked it more"
					: q === "low budget flop"
						? "low budget"
						: "Read as",
			),
		)
		await page.waitForTimeout(1000)
		await page.screenshot({
			path: `/tmp/gw-expanded-filters/${q.replaceAll(" ", "-")}.png`,
		})
		console.log("PASS catalog + See all", q, data.total)
	}
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto(`${base}/?q=controversial`)
	await page
		.getByText("Audiences liked it more (guess)", { exact: true })
		.waitFor()
	await page.screenshot({
		path: "/tmp/gw-expanded-filters/mobile-controversial.png",
	})
	assert.equal(errors.length, 0, errors.join("\n"))
	console.log("PASS mobile and no browser errors")
} finally {
	await browser.close()
}
