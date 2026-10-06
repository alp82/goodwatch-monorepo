import { createRequire } from "node:module"
const require = createRequire("/usr/lib/node_modules/@playwright/cli/node_modules/")
const { chromium } = require("playwright-core")
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE image.tmdb.org"] })
for (const path of ["/movie/603-the-matrix", "/show/1396-breaking-bad"]) {
	const context = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true, locale: "en-US" })
	const tab = await context.newPage()
	await tab.goto(`http://localhost:3111${path}`, { waitUntil: "load" })
	await tab.waitForTimeout(2500)
	console.log(path, JSON.stringify(await tab.evaluate(() => {
		const count = (el) => (el ? el.getElementsByTagName("*").length + 1 : 0)
		const header = document.querySelector("[data-details-header]")
		const ids = ["overview", "fingerprint", "about", "actors_and_crew", "related", "media", "faq"]
		return {
			headerHeight: header?.getBoundingClientRect().height,
			headerEls: count(header),
			sections: Object.fromEntries(ids.map((id) => [id, count(document.getElementById(id))])),
			swipers: [...document.querySelectorAll(".swiper")].map((s) => `${s.querySelectorAll(".swiper-slide").length} slides/${count(s)} els`),
			footer: count(document.querySelector("footer")),
			siteHeader: count(document.querySelector("body > header, header")),
			total: document.getElementsByTagName("*").length,
			cards: document.querySelectorAll("#related a[href^='/movie/'], #related a[href^='/show/']").length,
		}
	})))
	await context.close()
}
await browser.close()
