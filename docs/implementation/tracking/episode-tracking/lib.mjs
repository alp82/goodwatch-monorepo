const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright-core")

export const BASE = `${process.env.HARNESS ?? "http://127.0.0.1:3084"}/prototype/episode-tracking-real`
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(BASE).hostname)) {
	throw new Error("HARNESS must be a loopback URL; this driver is for isolated local runs only")
}
export const SHOTS = process.env.SHOTS ?? "./shots"

export const VIEWPORTS = {
	phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
	// DESKTOP=1440 drives the wide screen at another width.
	desktop: { width: Number(process.env.DESKTOP ?? 1280), height: 900, deviceScaleFactor: 1 },
}

export async function launch() {
	return chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), headless: true })
}

export async function open(browser, size, query, { ready = true, navigationTimeout = 30000 } = {}) {
	// A fixed locale, so that the dates the page writes in the member's locale can be checked: "19 Oct 2024".
	const context = await browser.newContext({ viewport: VIEWPORTS[size], ...VIEWPORTS[size], locale: "en-GB" })
	const page = await context.newPage()
	page.setDefaultTimeout(10000)
	// Keep remote images/telemetry and incidental shell writes out of a fixture-only run.
	await page.route("**/*", async (route) => {
		const request = route.request()
		const url = new URL(request.url())
		if (url.origin !== new URL(BASE).origin) return route.fulfill({ status: 204, body: "" })
		if (url.pathname === "/api/poster-impressions") return route.fulfill({ status: 204, body: "" })
		if (!["GET", "HEAD"].includes(request.method())) return route.abort("blockedbyclient")
		return route.continue()
	})
	const errors = []
	page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))
	page.on("console", (m) => {
		if (m.type() === "error") errors.push(`console: ${m.text()}`)
	})
	const external = []
	page.on("request", (r) => {
		const u = new URL(r.url())
		if (u.pathname !== "/api/poster-impressions" && u.pathname.startsWith("/api/") && !u.pathname.startsWith("/api/tracking") && r.method() !== "GET") external.push(`${r.method()} ${u.pathname}`)
	})
	await page.goto(`${BASE}?${query}`, { waitUntil: "domcontentloaded", timeout: navigationTimeout })
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
