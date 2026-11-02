// Real current start-page integration. No mocked catalog or interpretation.
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { mkdir } from "node:fs/promises"
const workspace = createRequire(
	new URL("../../../yepwatch-app/package.json", import.meta.url),
)
const module = await import(pathToFileURL(workspace.resolve("playwright")).href)
const { chromium } = module.chromium ? module : module.default
const base = process.env.START_PAGE_URL ?? "http://127.0.0.1:3000"
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
	viewport: { width: 1440, height: 1100 },
})
const page = await context.newPage()
const errors = []
page.on("pageerror", (e) => errors.push(e.message))
await mkdir("/tmp/gw-current-start", { recursive: true })
async function open(query, extra = "") {
	const results = page.waitForResponse(
		(r) => r.url().includes("/api/discover/results?") && r.ok(),
		{ timeout: 60000 },
	)
	await page.goto(`${base}/?q=${encodeURIComponent(query)}${extra}`)
	const response = await results
	return { response, data: await response.json() }
}
try {
	let { response, data } = await open("tom hanks disney")
	assert(data.total > 0)
	let params = new URL(response.url()).searchParams
	assert.equal(params.get("people"), "31")
	assert.equal(params.get("services"), "337")
	assert(!params.has("ranked"))
	await page.getByRole("list").filter({ hasText: "Disney+" }).first().waitFor()
	const all = page.getByRole("link", { name: /See all/ }).first()
	const href = new URL(await all.getAttribute("href"), base)
	assert.equal(href.searchParams.get("people"), "31")
	assert.equal(href.searchParams.get("services"), "337")
	assert(!href.searchParams.has("q"))
	assert.equal(
		await page.locator("#start-search-input").inputValue(),
		"tom hanks disney",
	)
	await page.waitForTimeout(1500)
	await page.screenshot({ path: "/tmp/gw-current-start/tom-hanks-disney.png" })
	console.log(
		`PASS current start page: ${data.total} real results, Read as, original input and resolved See all`,
	)

	const request = page.waitForRequest(
		(r) => r.url().includes("/api/combined-search") && r.method() === "POST",
	)
	const mixed = open("underwater adventure 80")
	const body = (await request).postDataJSON()
	assert.equal(body.q, "adventure underwater")
	assert.deepEqual(body.filters.genres, ["Adventure"])
	;({ response, data } = await mixed)
	assert.equal(new URL(response.url()).searchParams.get("score"), "80")
	console.log(
		"PASS remaining text is ranked within inferred eligibility, then filtered by score",
	)
	;({ response } = await open("scary", "&moods=funny"))
	assert.equal(new URL(response.url()).searchParams.get("moods"), "funny")
	console.log("PASS existing mood picks win conflicting query filters")

	await page.setViewportSize({ width: 390, height: 844 })
	;({ response, data } = await open("tom hanks prime"))
	assert.equal(new URL(response.url()).searchParams.get("services"), "9")
	assert(data.total > 0)
	await page.waitForTimeout(1500)
	await page.screenshot({ path: "/tmp/gw-current-start/mobile-prime.png" })
	assert(await page.locator("#start-search-input").isVisible())
	assert.equal(errors.length, 0, errors.join("\n"))
	console.log("PASS mobile Prime alias, results and no browser errors")
} finally {
	await browser.close()
}
