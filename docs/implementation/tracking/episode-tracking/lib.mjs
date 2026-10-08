import { chromium } from "playwright-core"

export const BASE = `${process.env.HARNESS ?? "http://127.0.0.1:3084"}/prototype/episode-tracking-real`
export const SHOTS = process.env.SHOTS ?? "./shots"

export const VIEWPORTS = {
	phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
	desktop: { width: 1280, height: 900, deviceScaleFactor: 1 },
}

export async function launch() {
	return chromium.launch({ executablePath: "/usr/bin/chromium", headless: true })
}

export async function open(browser, size, query, { ready = true } = {}) {
	const context = await browser.newContext({ viewport: VIEWPORTS[size], ...VIEWPORTS[size] })
	const page = await context.newPage()
	const errors = []
	page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))
	page.on("console", (m) => {
		if (m.type() === "error") errors.push(`console: ${m.text()}`)
	})
	const external = []
	page.on("request", (r) => {
		const u = new URL(r.url())
		if (u.pathname.startsWith("/api/") && !u.pathname.startsWith("/api/tracking") && r.method() !== "GET") external.push(`${r.method()} ${u.pathname}`)
	})
	await page.goto(`${BASE}?${query}`, { waitUntil: "domcontentloaded" })
	await page.waitForSelector("[data-harness]", { timeout: 60000 })
	if (ready) await page.waitForTimeout(900)
	return { page, context, errors, external }
}

/** Hides the site chrome and the harness panel for a screenshot. */
export async function shot(page, name, { full = false, clip = null } = {}) {
	await page.addStyleTag({ content: "[data-harness-panel]{display:none!important} header, nav[aria-label], [data-mobile-dock]{}" }).catch(() => {})
	const target = clip ? page.locator(clip).first() : page
	await target.screenshot({ path: `${SHOTS}/${name}.jpg`, type: "jpeg", quality: 60, ...(clip ? {} : { fullPage: full }) })
}

export function checker() {
	const results = []
	const check = (name, ok, detail = "") => {
		results.push({ name, ok: !!ok, detail })
		if (!ok) console.log(`FAIL ${name} ${detail}`)
	}
	return { check, results }
}

export const stored = (page) => page.evaluate(() => window.__gwHarness.stored())
export const settle = (page, ms = 450) => page.waitForTimeout(ms)
