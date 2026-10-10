// PROTOTYPE (#352): how the section's links are present for a client that runs no script, never clicks, never scrolls.
//   node seo-check.mjs [scroll|scroll2]
import { createRequire } from "node:module"
const require = createRequire("/home/alper/.npm/_npx/e41f203b7505f1fb/node_modules/")
const { chromium } = require("playwright-core")
const variant = process.argv[2] ?? "scroll"
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" })
const out = {}
for (const js of [false, true]) {
	// Googlebot smartphone's first viewport.
	const context = await browser.newContext({ viewport: { width: 412, height: 732 }, isMobile: true, javaScriptEnabled: js })
	const page = await context.newPage()
	await page.goto(`http://localhost:5391/?links=${variant}&bar=0`, { waitUntil: "load", timeout: 120000 })
	await page.waitForTimeout(js ? 8000 : 1500)
	out[js ? "withScript" : "withoutScript"] = await page.evaluate(() => {
		const links = [...document.querySelectorAll("#browse .lrb-in a[href^='/']")]
		const bad = []
		for (const a of links) {
			const b = a.getBoundingClientRect()
			const reasons = []
			for (let el = a; el && el !== document.documentElement; el = el.parentElement) {
				const c = getComputedStyle(el)
				if (c.display === "none") reasons.push("display:none")
				if (c.visibility !== "visible") reasons.push("visibility")
				if (Number(c.opacity) < 1) reasons.push("opacity")
				if (el.getAttribute("aria-hidden") === "true") reasons.push("aria-hidden")
				if (el.hasAttribute("hidden") || el.hasAttribute("inert")) reasons.push("hidden/inert")
				if (c.position === "fixed" || c.position === "absolute") reasons.push(`position:${c.position}`)
				if (c.clipPath !== "none" || (c.clip !== "auto" && c.clip !== "")) reasons.push("clip")
				if ((c.overflow !== "visible" && c.overflowX !== "visible") && (el.clientWidth < 2 || el.clientHeight < 2)) reasons.push("collapsed box")
				if (c.transform !== "none") reasons.push("transform")
			}
			if (b.width < 8 || b.height < 8) reasons.push("tiny")
			if (!a.textContent.trim()) reasons.push("no text")
			if (reasons.length) bad.push({ href: a.getAttribute("href"), reasons })
		}
		const first = links[0]?.getBoundingClientRect()
		const last = links.at(-1)?.getBoundingClientRect()
		return {
			titleLinks: links.filter((a) => /^\/(movie|show)\//.test(a.getAttribute("href"))).length,
			hubLinks: links.filter((a) => !/^\/(movie|show)\//.test(a.getAttribute("href"))).length,
			linksWithAProblem: bad,
			smallestFontPx: Math.min(...links.map((a) => parseFloat(getComputedStyle(a).fontSize))),
			firstLinkTopInDocument: first && Math.round(first.top + scrollY),
			lastLinkBottomInDocument: last && Math.round(last.bottom + scrollY),
			documentHeight: document.documentElement.scrollHeight,
			windowHeight: innerHeight,
		}
	})
	await context.close()
}
await browser.close()
console.log(JSON.stringify(out, null, 1))
