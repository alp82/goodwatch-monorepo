import { createRequire } from "node:module"
const require = createRequire("/home/alper/.npm/_npx/e41f203b7505f1fb/node_modules/")
const { chromium } = require("playwright-core")

const ORIGIN = "http://localhost:5391"
const OUT = process.argv[2]
const only = process.argv[3]?.split(",")
const variants = ["today", "strip", "scroll", "tv"].filter((v) => !only || only.includes(v))
const sizes = {
	desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
	phone: {
		viewport: { width: 390, height: 844 },
		deviceScaleFactor: 2,
		isMobile: true,
		hasTouch: true,
		userAgent:
			"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
	},
}

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--hide-scrollbars"] })
const rows = []
for (const variant of variants) {
	for (const [name, options] of Object.entries(sizes)) {
		const context = await browser.newContext(options)
		const page = await context.newPage()
		const images = new Set()
		page.on("request", (r) => {
			if (r.resourceType() === "image") images.add(r.url())
		})
		await page.addInitScript(() => {
			window.__cls = 0
			new PerformanceObserver((list) => {
				for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value
			}).observe({ type: "layout-shift", buffered: true })
		})
		const url = `${ORIGIN}/${variant === "today" ? "?bar=0" : `?links=${variant}&bar=0`}`
		await page.goto(url, { waitUntil: "load", timeout: 120000 })
		// Past hydration, the pool's posters, and the 7 s "Turn your phone" hint.
		await page.waitForTimeout(10000)
		// The TanStack Query devtools button is in development builds only.
		await page.addStyleTag({ content: ".tsqd-parent-container{display:none!important}" })
		const stats = await page.evaluate(() => {
			const seen = (a) => {
				const b = a.getBoundingClientRect()
				if (b.width < 1 || b.height < 1) return false
				const x = b.left + b.width / 2
				const y = b.top + b.height / 2
				if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false
				const top = document.elementFromPoint(x, y)
				return !!top && (a.contains(top) || top.contains(a))
			}
			const all = [...document.querySelectorAll("a[href]")]
			const isTitle = (a) => /^\/(movie|show)\/\d/.test(a.getAttribute("href"))
			const hubs = ["/discover", "/movies", "/shows", "/explorer", "/taste", "/how-it-works", "/movies/moods", "/shows/moods", "/movies/genres", "/shows/genres", "/movies/streaming", "/shows/streaming"]
			const uniq = (list) => new Set(list.map((a) => a.getAttribute("href"))).size
			const titles = all.filter(isTitle)
			const hubLinks = all.filter((a) => hubs.includes(a.getAttribute("href")))
			const small = titles.concat(hubLinks).filter(seen).map((a) => {
				const b = a.getBoundingClientRect()
				return { h: Math.round(b.height * 10) / 10, w: Math.round(b.width), font: parseFloat(getComputedStyle(a).fontSize) }
			})
			return {
				titlesFirstScreen: uniq(titles.filter(seen)),
				hubsFirstScreen: uniq(hubLinks.filter(seen)),
				minLinkHeightPx: small.length ? Math.min(...small.map((s) => s.h)) : null,
				cls: Math.round(window.__cls * 10000) / 10000,
				
			}
		})
		await page.screenshot({ path: `${OUT}/${variant}-${name}.png` })
		if (variant === "scroll") {
			await page.evaluate(() => document.getElementById("popular-now")?.scrollIntoView({ behavior: "instant", block: "start" }))
			await page.waitForTimeout(800)
			await page.screenshot({ path: `${OUT}/${variant}-${name}-scrolled.png` })
		}
		rows.push({ variant, size: name, imageRequests: images.size, ...stats })
		await context.close()
	}
}
await browser.close()
console.log(JSON.stringify(rows, null, 1))
