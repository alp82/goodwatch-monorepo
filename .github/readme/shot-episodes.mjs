// PROTOTYPE: still of a show's Episodes grid from the live site (signed out, read-only browsing).
// node shot-episodes.mjs <show path, e.g. /show/1399-game-of-thrones> <out.png> [scale] [section width px] [pad px]
// Hides the section's heading row (Episodes + Grid/Consistency) and narrows the section so the season average
// column sits next to the grid; the clip is the section plus `pad` of the page's own background.
import { chromium } from "playwright-core"
const [path, out, scale = "2", width = "540", pad = "28"] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(scale) })
await p.goto(`https://goodwatch.app${path}`, { waitUntil: "networkidle", timeout: 120000 })
await p.addStyleTag({
	content: `html{scrollbar-width:none!important}
section#episode-ratings{width:${width}px!important;max-width:none!important}
section#episode-ratings > div:first-child{display:none!important}
section#episode-ratings > div.mt-4{margin-top:0!important}`,
})
await p.setViewportSize({ width: 1441, height: 900 })
await p.setViewportSize({ width: 1440, height: 900 })
const sec = p.locator("section#episode-ratings")
await sec.scrollIntoViewIfNeeded()
await p.waitForTimeout(2500)
await p.mouse.move(0, 0)
await p.waitForTimeout(400)
const box = await sec.boundingBox()
console.log(JSON.stringify(box))
const P = Number(pad)
// The top pad is shorter: the card above the section reaches into a full pad.
const T = Math.round(P * 0.6)
await p.screenshot({ path: out, clip: { x: box.x - P, y: box.y - T, width: box.width + 2 * P, height: box.height + T + P } })
await b.close()
