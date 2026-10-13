// PROTOTYPE - throwaway. Drives the round 10 Explorer prototype and takes screenshots next to this file:
// node shot.mjs <variant> <name> [steps as JSON] [WIDTHxHEIGHT]. Steps: ["snap", label], ["go", region], ["tap", island id],
// ["pick", [ids]], ["into", island id], ["zoom", times the region scale], ["eval", "() => ..."], ["wait", ms].
import { chromium } from "playwright-core"
const [variant, name, stepsJson = "[]", size = "1440x900"] = process.argv.slice(2)
const [w, h] = size.split("x").map(Number)
const out = new URL("./", import.meta.url).pathname
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--use-angle=gl", "--ignore-gpu-blocklist"] })
const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: w < 700 })
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)) })
const q = process.env.QUERY ?? "services=all&unseen=0"
await page.goto(`http://localhost:3110/prototype/rec-explorer-10?variant=${variant}&${q}`, { waitUntil: "load", timeout: 120000 })
await page.waitForFunction(() => window.__explorer?.islands().length > 10, null, { timeout: 120000 })
const settle = async (ms = 1800) => { await page.waitForTimeout(ms); await page.waitForFunction(() => { const x = window.__explorer; const m = x.engine.mix(); return !x.busy() && (!m || (m.bridge.grow >= 1 && !m.bridge.pending)) }, null, { timeout: 25000 }).catch(() => {}); await page.waitForTimeout(900) }
await settle(2500)
let n = 0
const snap = async (label) => { await page.screenshot({ path: `${out}${name}-${String(++n).padStart(2, "0")}-${label}.png` }) }
for (const step of JSON.parse(stepsJson)) {
	const [op, arg, arg2] = step
	if (op === "snap") await snap(arg)
	else if (op === "go") { await page.evaluate((id) => window.__explorer.go(id), arg); await settle() }
	else if (op === "pick") { await page.evaluate((ids) => window.__explorer.pick(ids), arg); await settle(3200) }
	else if (op === "tap") { // tap an island by id, where it is on screen
		const at = await page.evaluate((id) => { const i = window.__explorer.islands().find((x) => x.id === id); return i && { x: i.x, y: i.y + i.r * 0.55 } }, arg)
		const box = await page.locator("canvas.ex-posters").boundingBox()
		await page.mouse.click(box.x + at.x, box.y + at.y); await settle(3200)
	} else if (op === "click") { await page.mouse.click(arg, arg2); await settle() }
	else if (op === "wheel") { await page.mouse.move(arg[0], arg[1]); await page.mouse.wheel(0, arg2); await settle() }
	else if (op === "zoom") { await page.evaluate((s) => { const e = window.__explorer.engine; e.zoomTo(e.view().base * s) }, arg); await settle() }
	else if (op === "into") { await page.evaluate((id) => { const e = window.__explorer.engine; e.flyToIsland(e.island(id)) }, arg); await settle(3000) }
	else if (op === "eval") console.log(JSON.stringify(await page.evaluate(`(${arg})()`)))
	else if (op === "wait") await page.waitForTimeout(arg)
}
console.log(JSON.stringify({ sea: await page.evaluate(() => window.__explorer.sea()), errors: [...new Set(errors)].slice(0, 8) }))
await browser.close()
