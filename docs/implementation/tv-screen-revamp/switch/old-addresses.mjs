// Slice 13 of the new TV (the switch): the addresses the old TV wrote land on the screens they map to
// (`readTvState`, ui/living-room/tv/tv-machine.ts). Each old address is opened in a browser and must show what its
// new address shows, item for item, in both editions; `/living-room` must answer 301 to `/` with its query.
//
//   PLAYWRIGHT=<folder>/node_modules/playwright-core/index.mjs BASE=http://localhost:3213 node old-addresses.mjs
//
// Any server will do, with or without services: without the pool the lists are shorter on both sides alike.
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")
const BASE = process.env.BASE ?? "http://localhost:3213"

/** Old address, then the new address it maps to. */
const CASES = [
	["/?tv=picks&mood=funny", "/?tv=discover&mood=funny"],
	["/?tv=picks&mood=funny&from=new&service=Netflix", "/?tv=discover&mood=funny"],
	["/?tv=picks&mood=heavy", "/?tv=discover"],
	["/?tv=moods", "/?tv=discover"],
	["/?tv=moods&refine=1&mood=cozy", "/?tv=discover"],
	["/living-room?tv=moods", "/?tv=discover"],
	["/?tv=picks", "/?tv=tonight"],
	["/?tv=picks&from=wishlist&service=Netflix", "/?tv=tonight"],
	["/?tv=services", "/?tv=tonight"],
	["/?tv=this-or-that", "/?tv=tonight"],
	["/?tv=quiz&step=picks&goal=10&page=1", "/?tv=quiz"],
	["/?tv=title&title=1000000000603", "/?tv=title&title=movie-603"],
	["/?tv=title&title=2000000001399", "/?tv=title&title=show-1399"],
	["/?tv=title&title=603", "/"],
	["/?tv=about", "/?tv=about"],
	["/living-room", "/"],
]
const SIZES = { desktop: [1440, 900], phone: [390, 844] }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium" })
const results = []
let failed = 0

async function screenAt(path, [width, height]) {
	const phone = width < 768
	const ctx = await browser.newContext({ viewport: { width, height }, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) })
	const page = await ctx.newPage()
	// Nothing leaves for another host, and the telemetry tunnel is answered here.
	await page.route((u) => !["localhost", "127.0.0.1", "image.tmdb.org"].includes(u.hostname) && u.protocol.startsWith("http"), (r) => r.fulfill({ status: 204, body: "" }))
	await page.route("**/api/e*", (r) => r.fulfill({ status: 200, body: "" }))
	const response = await page.goto(BASE + path, { waitUntil: "load", timeout: 120000 })
	await page.waitForSelector("#room:not([data-room=unmeasured]) [data-tv-layer] [data-tv-item]", { timeout: 120000 })
	await page.waitForTimeout(600)
	const seen = await page.evaluate(() => {
		const layers = [...document.querySelectorAll("#room [data-tv-layer]")]
		const top = layers.at(-1)
		return {
			path: location.pathname + location.search,
			items: [...top.querySelectorAll("[data-tv-item]")].map((el) => el.getAttribute("data-tv-item")),
			text: top.textContent.replace(/\s+/g, " ").trim().slice(0, 80),
		}
	})
	const chain = []
	for (let r = response.request(); r; r = r.redirectedFrom()) chain.unshift(r.url().replace(BASE, ""))
	await ctx.close()
	return { ...seen, chain }
}

for (const [old, mapped] of CASES)
	for (const [edition, size] of Object.entries(SIZES)) {
		const a = await screenAt(old, size)
		const b = await screenAt(mapped, size)
		const same = JSON.stringify(a.items) === JSON.stringify(b.items)
		if (!same) failed++
		results.push({ old, mapped, edition, same, landedAt: a.path, chain: a.chain, items: a.items.slice(0, 6), text: a.text })
		console.log(`${same ? "ok  " : "FAIL"} ${edition.padEnd(7)} ${old} -> ${mapped}${a.chain.length > 1 ? ` (via ${a.chain.join(" -> ")})` : ""}: ${a.items.slice(0, 4).join(", ")}${same ? "" : ` | expected ${b.items.slice(0, 4).join(", ")}`}`)
	}
await browser.close()
console.log(`${results.length - failed} of ${results.length} land on their mapped screen`)
if (process.env.OUT) (await import("node:fs")).writeFileSync(process.env.OUT, JSON.stringify(results, null, 1))
process.exit(failed ? 1 : 0)
