// check-surfaces.mjs <origin> <page-path> ...: loads each page in headless Chromium with an empty cache and reports
// failed requests, responses of 400 and above, console errors, and page errors. Exits 1 when a same-origin request
// fails or the page logs an error. Needs Playwright: set PLAYWRIGHT to the path of a `playwright-core` package.
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")
const [origin, ...pages] = process.argv.slice(2)
const browser = await chromium.launch()
let failed = 0
for (const [index, path] of pages.entries()) {
	const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: "en-US" })
	const page = await context.newPage()
	const problems = []
	const outside = []
	let requests = 0
	let staticRequests = 0
	page.on("request", (request) => {
		requests++
		const url = new URL(request.url())
		if (url.origin === origin && /\.[a-z0-9]{2,11}$/.test(url.pathname) && !url.pathname.startsWith("/og/")) staticRequests++
	})
	page.on("requestfailed", (request) => {
		const url = new URL(request.url())
		const line = `request failed: ${url.origin === origin ? url.pathname : url.host} (${request.failure()?.errorText})`
		// A beacon that the page sends while it is being closed or scrolled away is aborted by the browser.
		const beacon = request.method() !== "GET" && request.failure()?.errorText.includes("ERR_ABORTED")
		;(url.origin === origin && !beacon ? problems : outside).push(line)
	})
	page.on("response", (response) => {
		if (response.status() < 400) return
		const url = new URL(response.url())
		const line = `status ${response.status()}: ${url.origin === origin ? url.pathname : url.host}`
		;(url.origin === origin ? problems : outside).push(line)
	})
	page.on("console", (message) => {
		if (message.type() === "error") problems.push(`console error: ${message.text().slice(0, 160)}`)
	})
	page.on("pageerror", (error) => problems.push(`page error: ${String(error).slice(0, 160)}`))
	await page.goto(`${origin}${path}`, { waitUntil: "load", timeout: 60_000 })
	// Hydration, lazy chunks, and the telemetry that loads after 3.5 seconds of quiet.
	await page.waitForTimeout(7_000)
	await page.mouse.wheel(0, 2_000)
	await page.waitForTimeout(2_000)
	console.log(`surface ${index + 1}: ${requests} requests, ${staticRequests} same-origin static, ${problems.length} problems, ${outside.length} third-party failures or aborted beacons`)
	for (const problem of problems) console.log(`  ${problem}`)
	for (const line of [...new Set(outside)].slice(0, 5)) console.log(`  (not counted) ${line}`)
	failed += problems.length
	await context.close()
}
await browser.close()
console.log(failed ? `${failed} problems` : "no failed request and no console error")
process.exit(failed ? 1 : 0)
