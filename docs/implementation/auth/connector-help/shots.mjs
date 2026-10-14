import { chromium } from "playwright-core"
const out = process.argv[2]
const base = "http://localhost:3471"
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" })
const sizes = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } }
const pages = [
	{ name: "connect", path: "/connect" },
	{ name: "privacy", path: "/privacy" },
]
for (const [size, viewport] of Object.entries(sizes)) {
	const ctx = await browser.newContext({ viewport, deviceScaleFactor: size === "phone" ? 2 : 1, isMobile: size === "phone", hasTouch: size === "phone" })
	await ctx.route(/posthog|google-analytics|googletagmanager|sentry-browser|\/api\/e\b/, (r) => r.fulfill({ status: 204 }))
	const page = await ctx.newPage()
	for (const p of pages) {
		await page.goto(base + p.path, { waitUntil: "load", timeout: 120000 })
		await page.waitForSelector("h1", { timeout: 60000 })
		await page.addStyleTag({ content: ".tsqd-open-btn-container{display:none!important} footer{display:none!important}" })
		// A full-page shot draws fixed bars where the viewport was: hide the bottom dock (the header stays at the top).
		await page.evaluate(() => {
			for (const el of document.querySelectorAll("body *")) {
				const st = getComputedStyle(el)
				if (st.position === "fixed" && el.getBoundingClientRect().top > 100) el.style.display = "none"
			}
		})
		await page.waitForTimeout(800)
		if (p.name === "privacy") {
			// The new part: from the top to the end of the connected-apps policy.
			const end = await page.evaluate(() => {
				const el = [...document.querySelectorAll("p")].find((n) => n.textContent?.startsWith("The rest of this policy"))
				return el ? el.getBoundingClientRect().bottom + window.scrollY + 24 : 4000
			})
			await page.screenshot({ path: `${out}/${p.name}-${size}.png`, fullPage: true, clip: { x: 0, y: 0, width: viewport.width, height: end } })
		} else {
			await page.screenshot({ path: `${out}/${p.name}-${size}.png`, fullPage: true })
		}
		// Overflow check: no horizontal scroll.
		const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
		console.log(size, p.name, "overflow px:", wide)
	}
	await ctx.close()
}
await browser.close()
