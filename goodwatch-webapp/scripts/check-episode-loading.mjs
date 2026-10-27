// Production gate, skeleton, grid and tracking against the existing in-memory server. No member data is written.
// ORIGIN=http://localhost:3003 PLAYWRIGHT=/path/to/playwright/index.mjs CHROMIUM=/path/to/chrome node scripts/check-episode-loading.mjs
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"

const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright")
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})
const origin = process.env.ORIGIN ?? "http://localhost:3003"
const html = JSON.parse(execFileSync("node_modules/.bin/vite-node", ["--config", "app/ui/imports/source-import-test-vite.config.ts", "app/ui/details/episode-grid/skeleton-render.test-support.tsx"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim())
const page = await browser.newPage()
const errors = []
page.on("pageerror", error => errors.push(error.message))
const results = []
try {
	for (const width of [390, 768, 1440]) {
		await page.setViewportSize({ width, height: 900 })
		for (const show of ["chernobyl", "sherlock", "slow-horses", "supernatural"]) {
			await page.goto(`${origin}/prototype/episode-tracking-real?show=${show}&latency=5000&scenario=watching&today=2026-10-08`, { waitUntil: "domcontentloaded", timeout: 60_000 })
			await page.locator("[data-episode-skeleton]").waitFor()
			await page.evaluate(async () => {
				await document.fonts.ready
				document.documentElement.style.scrollBehavior = "auto"
				const section = document.querySelector("#harness-episodes")
				window.scrollTo({ top: section.getBoundingClientRect().top + scrollY - 200, behavior: "instant" })
			})
			await page.waitForTimeout(100)
			const first = await page.locator("#harness-episodes").boundingBox()
			const serverHeight = await page.evaluate(async markup => {
				const copy = document.createElement("div")
				copy.style.cssText = `position:absolute;left:-10000px;width:${document.querySelector("#harness-episodes").clientWidth}px`
				copy.innerHTML = markup
				document.body.appendChild(copy)
				await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
				const height = copy.getBoundingClientRect().height
				copy.remove()
				return height
			}, html[show])
			assert.ok(Math.abs(first.height - serverHeight) <= 1, `${show}/${width}: SSR ${serverHeight}, hydrated ${first.height}`)
			await page.locator("[data-episode-list]").waitFor({ timeout: 20_000 })
			const ready = await page.locator("#harness-episodes").boundingBox()
			assert.ok(Math.abs(first.height - ready.height) <= 1, `${show}/${width}: ${first.height} -> ${ready.height}`)
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${show}/${width}: page overflows`)
			// A one-season show also starts in the overview; its season opens by choice.
			assert.equal(await page.locator("[data-open-season]").count(), 0)
			await page.locator("[data-season-press]").first().click()
			await page.locator("[data-open-season]").waitFor()
			const result = { show, width, skeleton: first.height, ready: ready.height, serverHeight }
			results.push(result)
			console.log(JSON.stringify(result))
		}
	}
	// Failure and catalog changes keep their original reservation until the member explicitly retries.
	await page.setViewportSize({ width: 390, height: 900 })
	for (const mode of ["failed", "changed", "empty"]) {
		await page.goto(`${origin}/prototype/episode-tracking-real?show=supernatural&latency=2000&scenario=watching&today=2026-10-08`, { waitUntil: "domcontentloaded" })
		await page.locator("[data-episode-skeleton]").waitFor()
		await page.evaluate(async () => {
			await document.fonts.ready
			document.documentElement.style.scrollBehavior = "auto"
			const section = document.querySelector("#harness-episodes")
			scrollTo({ top: section.getBoundingClientRect().top + scrollY - 200, behavior: "instant" })
		})
		await page.waitForTimeout(100)
		await page.evaluate(mode => {
			const server = window.__gwHarness
			server.options.latency = 10
			window.__loadingRestore = () => {}
			if (mode === "failed") {
				const route = server.route.bind(server)
				server.route = (method, path, body) => path === "/api/tracking/show" ? Response.json({ error: "Test unavailable" }, { status: 503 }) : route(method, path, body)
				window.__loadingRestore = () => { server.route = route }
			} else {
				const episodes = [...server.episodes]
				server.episodes = mode === "empty" ? [] : episodes.filter(episode => episode.season !== 15)
				window.__loadingRestore = () => { server.episodes = episodes }
			}
		}, mode)
		const first = await page.locator("#harness-episodes").boundingBox()
		const retry = page.getByRole("button", { name: mode === "failed" ? "Retry loading" : "Reload episodes", exact: true })
		await retry.waitFor({ timeout: 20_000 })
		const held = await page.locator("#harness-episodes").boundingBox()
		assert.equal(first.height, held.height, `${mode}: reservation changed`)
		if (mode !== "changed") await page.evaluate(() => window.__loadingRestore())
		await retry.click()
		await page.locator("[data-episode-list]").waitFor({ timeout: 10_000 })
		console.log(`PASS: ${mode} keeps its reservation and recovers after an explicit retry`)
	}
	assert.deepEqual(errors, [])
	console.log(`PASS: ${results.length} SSR/skeleton/tracking handoffs with no episode-section shift`)
} finally {
	await browser.close()
}
