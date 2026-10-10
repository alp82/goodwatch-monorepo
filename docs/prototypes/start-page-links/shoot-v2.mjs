// PROTOTYPE (#352): screenshots and behaviour checks of the scroll variants.
//   node shoot-v2.mjs <output directory> [scroll,scroll2]
import { createRequire } from "node:module"
const require = createRequire("/home/alper/.npm/_npx/e41f203b7505f1fb/node_modules/")
const { chromium } = require("playwright-core")

const ORIGIN = "http://localhost:5391"
const OUT = process.argv[2]
const variants = (process.argv[3] ?? "scroll,scroll2").split(",")
const UA =
	"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36"
const sizes = {
	desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
	phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA },
	landscape: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA },
}
const HIDE = ".tsqd-parent-container{display:none!important}"
// A real pointer press at the element's middle, where it is on screen.
const press = async (page, selector) => {
	const b = await page.locator(selector).first().boundingBox()
	await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
}
const state = (page) =>
	page.evaluate(() => ({ y: Math.round(scrollY), hash: location.hash, below: document.documentElement.hasAttribute("data-lr-below") || !!document.querySelector("#browse:target") }))

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--hide-scrollbars"] })
const report = []
for (const variant of variants) {
	const name = variant === "scroll" ? "scroll-v2" : "scroll-v2-take2"
	for (const [size, options] of Object.entries(sizes)) {
		const context = await browser.newContext(options)
		const page = await context.newPage()
		await page.addInitScript(() => {
			window.__cls = 0
			new PerformanceObserver((list) => {
				for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value
			}).observe({ type: "layout-shift", buffered: true })
		})
		await page.goto(`${ORIGIN}/?links=${variant}&bar=0`, { waitUntil: "load", timeout: 120000 })
		await page.waitForTimeout(10000)
		await page.addStyleTag({ content: HIDE })
		const row = { variant, size, cls: await page.evaluate(() => Math.round(window.__cls * 10000) / 10000) }
		await page.screenshot({ path: `${OUT}/${name}-${size}-room.png` })

		// In the room: the wheel and the arrow keys do not move the page.
		await page.mouse.move(options.viewport.width / 2, 200)
		await page.mouse.wheel(0, 700)
		await page.keyboard.press("ArrowDown")
		await page.keyboard.press("PageDown")
		await page.waitForTimeout(700)
		row.afterWheelAndKeysInRoom = await state(page)

		// The lip is the way down.
		const lip = await page.locator(".lrb-lip").boundingBox()
		row.lip = lip && { x: Math.round(lip.x), y: Math.round(lip.y), w: Math.round(lip.width), h: Math.round(lip.height) }
		await press(page, ".lrb-lip")
		await page.waitForTimeout(230)
		if (size !== "landscape") await page.screenshot({ path: `${OUT}/${name}-${size}-moving.png` })
		await page.waitForTimeout(1600)
		row.afterLip = await state(page)
		await page.screenshot({ path: `${OUT}/${name}-${size}-section.png` })

		// Below: the page scrolls like any page.
		await page.mouse.wheel(0, 400)
		await page.waitForTimeout(700)
		row.afterWheelBelow = await state(page)
		await page.evaluate(() => {
			const end = document.querySelector(".lrb").getBoundingClientRect().bottom + scrollY
			scrollTo({ top: end - innerHeight + (innerWidth < 1024 ? 64 : 0), behavior: "instant" })
		})
		await page.waitForTimeout(600)
		await page.screenshot({ path: `${OUT}/${name}-${size}-section-end.png` })

		// Escape returns.
		await page.keyboard.press("Escape")
		await page.waitForTimeout(2200)
		row.afterEscape = await state(page)
		await page.mouse.wheel(0, 700)
		await page.waitForTimeout(600)
		row.afterWheelInRoomAgain = await state(page)

		// Scrolling up to the very top returns too.
		await press(page, ".lrb-lip")
		await page.waitForTimeout(1800)
		await page.mouse.wheel(0, 300)
		await page.waitForTimeout(600)
		row.belowAgain = await state(page)
		await page.mouse.wheel(0, -5000)
		await page.waitForTimeout(1800)
		row.afterScrollingUpToTop = await state(page)

		// The back control returns.
		await press(page, ".lrb-lip")
		await page.waitForTimeout(1800)
		await press(page, ".lrb-back")
		await page.waitForTimeout(2200)
		row.afterBackControl = await state(page)

		// Tab from the lip into the section brings the focused link into view.
		await page.locator(".lrb-lip").focus()
		await page.keyboard.press("Tab")
		await page.keyboard.press("Tab")
		await page.keyboard.press("Tab")
		await page.waitForTimeout(1200)
		row.afterTabIntoSection = {
			...(await state(page)),
			focused: await page.evaluate(() => {
				const el = document.activeElement
				const b = el.getBoundingClientRect()
				return { text: el.textContent.slice(0, 40), inView: b.top >= 0 && b.bottom <= innerHeight }
			}),
		}
		report.push(row)
		await context.close()
	}

	// Without JavaScript: the lip is a link, and the page can scroll once it is followed.
	const context = await browser.newContext({ ...sizes.phone, javaScriptEnabled: false })
	const page = await context.newPage()
	await page.goto(`${ORIGIN}/?links=${variant}&bar=0`, { waitUntil: "load", timeout: 120000 })
	await page.waitForTimeout(1500)
	await press(page, ".lrb-lip")
	await page.waitForTimeout(1500)
	const box = await page.locator("#browse-title").boundingBox()
	await press(page, ".lrb-back")
	await page.waitForTimeout(1500)
	const room = await page.locator("#room").boundingBox()
	report.push({ variant, size: "phone without JavaScript", headingTopAfterLip: box && Math.round(box.y), roomTopAfterBack: room && Math.round(room.y), url: page.url().replace(ORIGIN, "") })
	await context.close()
}
await browser.close()
console.log(JSON.stringify(report))
