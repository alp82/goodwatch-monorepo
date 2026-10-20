// Native browser regression for the TV's expand/return handoff. Run against a local webapp:
// PLAYWRIGHT=/path/to/playwright/index.mjs CHROMIUM=/path/to/chrome node scripts/check-tv-transition.mjs
// ORIGIN defaults to http://localhost:3003. CASES=desktop,phone,cancel,reduced,unsupported selects checks.
// Playwright is installed externally, like docs/implementation/tv-screen-revamp/expand/drive.mjs.
import assert from "node:assert/strict"

const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright")
const browser = await chromium.launch({
	...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
})
const origin = process.env.ORIGIN ?? "http://localhost:3003"
const room = "/?tv=title&title=show-105248"
const cases = (
	process.env.CASES ?? "desktop,phone,cancel,reduced,unsupported"
).split(",")

async function open(options = {}) {
	const context = await browser.newContext({
		viewport: { width: 1982, height: 1600 },
		...options,
	})
	await context.route(
		/\/api\/(e|update-[^/?]+|poster-impressions)(\?|$)/,
		(route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: "{}",
			}),
	)
	const page = await context.newPage()
	await page.goto(`${origin}${room}`, {
		waitUntil: "networkidle",
		timeout: 60_000,
	})
	await page.locator('[data-tv-item="expand"]:visible').waitFor()
	await page.waitForFunction(() =>
		document
			.querySelector("[data-tv-screen]")
			?.textContent.includes("Cyberpunk"),
	)
	return { context, page }
}

// Observe the real router's transition without changing its update callback or animation timing.
async function observe(page) {
	await page.evaluate(() => {
		window.__tvTransitions = []
		const start = document.startViewTransition.bind(document)
		document.startViewTransition = (...args) => {
			const transition = start(...args)
			const record = { frames: [], ended: false }
			window.__tvTransitions.push(record)
			transition.ready.then(
				() => {
					const sample = () => {
						if (record.ended) return
						const html = document.documentElement
						const old = getComputedStyle(html, "::view-transition-old(root)")
						const fresh = getComputedStyle(html, "::view-transition-new(root)")
						record.frames.push({
							mark: html.dataset.tvTransition,
							oldAnimation: old.animationName,
							newAnimation: fresh.animationName,
						})
						requestAnimationFrame(sample)
					}
					sample()
				},
				() => {
					record.skipped = true
				},
			)
			transition.finished.then(() => {
				record.ended = true
			})
			return transition
		}
	})
}

async function verify(page, direction, count) {
	await page.waitForFunction(
		(n) =>
			window.__tvTransitions.length === n &&
			window.__tvTransitions.at(-1).ended,
		count,
	)
	await page.waitForFunction(
		() => !document.documentElement.hasAttribute("data-tv-transition"),
	)
	const record = await page.evaluate(() => window.__tvTransitions.at(-1))
	assert.ok(!record.skipped, `${direction}: the native transition must run`)
	assert.ok(
		record.frames.some(
			(f) =>
				f.oldAnimation.includes(`living-room-tv-room-${direction}`) ||
				f.newAnimation.includes(`living-room-tv-room-${direction}`),
		),
		`${direction}: the custom room animation must run`,
	)
	const fallback = record.frames.filter(
		(f) =>
			f.oldAnimation.includes("-ua-view-transition-fade-out") ||
			f.newAnimation.includes("-ua-view-transition-fade-in"),
	)
	assert.equal(
		fallback.length,
		0,
		`${direction}: default fade restarts while snapshots remain (${fallback.length} frames; the old TV can flash back)`,
	)
	assert.ok(
		record.frames.every((f) => f.mark === direction),
		`${direction}: keep geometry and animation styles until snapshots are released`,
	)
	console.log(
		`PASS ${direction}: ${record.frames.length} frames, no fallback fade or early cleanup`,
	)
}

try {
	for (const name of ["desktop", "phone"].filter((name) =>
		cases.includes(name),
	)) {
		console.log(name)
		const { context, page } = await open(
			name === "phone"
				? {
						viewport: { width: 390, height: 844 },
						isMobile: true,
						hasTouch: true,
					}
				: {},
		)
		await observe(page)
		await page.locator('[data-tv-item="expand"]:visible').click()
		await page.waitForURL("**/show/105248-*")
		await verify(page, "out", 1)
		await page.goBack()
		await page.waitForURL(`${origin}${room}`)
		await verify(page, "in", 2)
		await page.waitForFunction(
			() => !document.querySelector("[data-tv-bracket]"),
		)
		await context.close()
	}
	if (cases.includes("cancel")) {
		const { context, page } = await open()
		let release
		const hold = new Promise((resolve) => {
			release = resolve
		})
		await page.route("**/show/105248-*", async (route) => {
			await hold
			await route.abort()
		})
		await page.locator('[data-tv-item="expand"]:visible').click()
		await page.waitForFunction(
			() => document.documentElement.dataset.tvTransition === "out",
		)
		await page.keyboard.press("Escape")
		assert.equal(new URL(page.url()).search, new URL(`${origin}${room}`).search)
		assert.deepEqual(
			await page.evaluate(() => ({
				mark: document.documentElement.dataset.tvTransition ?? null,
				brackets: document.querySelectorAll("[data-tv-bracket]").length,
				trip: sessionStorage.getItem("living-room:left-through-tv"),
			})),
			{ mark: null, brackets: 0, trip: null },
		)
		release()
		await context.close()
		console.log(
			"PASS Escape cancels pending expansion and clears brackets and trip",
		)
	}
	for (const name of ["reduced", "unsupported"].filter((name) =>
		cases.includes(name),
	)) {
		const { context, page } = await open(
			name === "reduced" ? { reducedMotion: "reduce" } : {},
		)
		if (name === "unsupported")
			await page.evaluate(() => {
				document.startViewTransition = undefined
			})
		await page.locator('[data-tv-item="expand"]:visible').click()
		await page.waitForURL("**/show/105248-*")
		assert.equal(
			await page.evaluate(() => document.documentElement.dataset.tvTransition),
			undefined,
		)
		await page.goBack()
		await page.waitForURL(`${origin}${room}`)
		assert.equal(
			await page.evaluate(() => document.documentElement.dataset.tvTransition),
			undefined,
		)
		await context.close()
		console.log(`PASS ${name}: plain navigation out and back`)
	}
} finally {
	await browser.close()
}
