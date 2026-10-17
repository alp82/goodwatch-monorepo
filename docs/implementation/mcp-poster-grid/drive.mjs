// Renders the MCP poster grid in a minimal MCP Apps host and checks it, then takes screenshots.
// The host is a page that loads the resource's HTML in a sandboxed iframe (scripts only, no same origin), under the
// CSP the resource declares, and speaks the host side of the protocol: ui/initialize, tool-input, tool-result,
// size-changed and ui/open-link. See README.md for how to run it.
import assert from "node:assert/strict"
import { mkdir, readFile } from "node:fs/promises"
import { posterGridCsp, posterGridHtml } from "../../../goodwatch-webapp/app/server/mcp/poster-grid.server.ts"

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright-core")
const here = new URL("./", import.meta.url)
const fixtures = JSON.parse(await readFile(new URL("fixtures.json", here), "utf8"))
const font = await readFile(new URL("../../../goodwatch-webapp/public/fonts/mcp/gabarito-latin.woff2", here))
const shots = new URL("shots/", here)
await mkdir(shots, { recursive: true })

const origin = "https://goodwatch.app"
const csp = posterGridCsp(origin)
// What a host derives from the resource's csp: nothing but inline code, images and fonts from the declared origins.
const policy = [
	"default-src 'none'",
	"script-src 'unsafe-inline'",
	"style-src 'unsafe-inline'",
	`img-src ${csp.resourceDomains.join(" ")}`,
	`font-src ${csp.resourceDomains.join(" ")}`,
	`connect-src ${csp.connectDomains.join(" ") || "'none'"}`,
].join("; ")
const widget = posterGridHtml(origin).replace(
	"<head>",
	`<head><meta http-equiv="Content-Security-Policy" content="${policy}">`,
)

const hostPage = (theme, width) => `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
body { margin: 0; padding: 24px 16px; background: ${theme === "dark" ? "#262624" : "#faf9f5"}; font: 15px system-ui; color: ${theme === "dark" ? "#e8e6dc" : "#141413"} }
.col { max-width: ${width}px; margin: 0 auto } p { margin: 0 0 12px }
iframe { display: block; width: 100%; height: 120px; border: 0 }
</style></head><body><div class="col"><p>Here are your best matches. See it on GoodWatch: My library</p>
<iframe id="app" sandbox="allow-scripts allow-popups"></iframe></div></body></html>`

async function mount(browser, { viewport, theme, result, width = 720, mobile = false }) {
	const context = await browser.newContext({
		viewport,
		deviceScaleFactor: 2,
		isMobile: mobile,
		hasTouch: mobile,
	})
	await context.route(`${origin}/fonts/mcp/gabarito-latin.woff2`, (route) =>
		route.fulfill({ body: font, contentType: "font/woff2", headers: { "Access-Control-Allow-Origin": "*" } }),
	)
	const page = await context.newPage()
	const problems = []
	page.on("pageerror", (error) => problems.push(error.message))
	page.on("console", (message) => {
		if (message.type() === "error" || /Content Security Policy/.test(message.text())) problems.push(message.text())
	})
	await page.setContent(hostPage(theme, width))
	await page.evaluate(
		({ html, theme, result }) => {
			const frame = document.getElementById("app")
			window.__opened = []
			window.__sizes = []
			const send = (message) => frame.contentWindow.postMessage({ jsonrpc: "2.0", ...message }, "*")
			window.addEventListener("message", (event) => {
				if (event.source !== frame.contentWindow) return
				const { id, method, params } = event.data
				if (method === "ui/initialize")
					send({
						id,
						result: {
							protocolVersion: params.protocolVersion,
							hostInfo: { name: "goodwatch-test-host", version: "1" },
							hostCapabilities: { openLinks: {} },
							hostContext: { theme, displayMode: "inline", platform: "web" },
						},
					})
				else if (method === "ui/notifications/initialized") {
					send({ method: "ui/notifications/tool-input", params: { arguments: {} } })
					send({
						method: "ui/notifications/tool-result",
						params: { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result },
					})
				} else if (method === "ui/notifications/size-changed") {
					window.__sizes.push(params.height)
					frame.style.height = `${params.height}px`
				} else if (method === "ui/open-link") {
					window.__opened.push(params.url)
					send({ id, result: {} })
				}
			})
			frame.srcdoc = html
		},
		{ html: widget, theme, result },
	)
	const view = page.frameLocator("#app")
	await view.locator("#gw[data-state=ready]").waitFor()
	// Lazy images below the fold load once visible; wait for the visible ones and the font.
	const frame = page.frames().find((f) => f !== page.mainFrame())
	await frame.waitForFunction(() =>
		[...document.images].filter((img) => img.loading === "eager" && img.closest("li:not([hidden])")).every((img) => img.complete),
	)
	await frame.evaluate(() => document.fonts.ready)
	await page.waitForTimeout(200)
	return { context, page, view, frame, problems }
}

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})
const desktop = { width: 1100, height: 900 }
const phone = { width: 390, height: 844 }
try {
	// Library, dark, desktop: six cards, then all, links through the host.
	{
		const { context, page, view, frame, problems } = await mount(browser, { viewport: desktop, theme: "dark", result: fixtures.library })
		assert.equal(await view.locator("li.item:visible").count(), 6)
		assert.equal(await view.locator("h1").innerText(), "My library")
		const loaded = await frame.evaluate(() =>
			[...document.images].filter((img) => img.closest("li:not([hidden])")).map((img) => img.naturalWidth > 0),
		)
		assert.ok(loaded.length === 6 && loaded.every(Boolean), `posters loaded: ${loaded}`)
		assert.equal(await frame.evaluate(() => document.fonts.check("700 13px Gabarito")), true)
		await page.locator("body").screenshot({ path: new URL("desktop-dark-library.png", shots).pathname })
		await view.locator("#more").click()
		assert.equal(await view.locator("li.item:visible").count(), 14)
		await page.waitForTimeout(400)
		// The missing poster keeps a labeled card; the image never shows a broken icon.
		assert.equal(await view.locator("li.item").nth(9).locator(".missing").innerText(), "Inside No. 9")
		assert.equal(await view.locator("li.item").nth(9).locator("img").count(), 0)
		await view.locator("li.item a").first().click()
		await view.locator("#page").click()
		await page.waitForFunction(() => window.__opened.length === 2)
		assert.deepEqual(await page.evaluate(() => window.__opened), [
			"https://goodwatch.app/movie/6007-elling",
			"https://goodwatch.app/my-library",
		])
		const sizes = await page.evaluate(() => window.__sizes)
		assert.ok(sizes.length >= 2 && sizes.at(-1) > sizes[0], `size reports: ${sizes}`)
		await page.locator("body").screenshot({ path: new URL("desktop-dark-library-expanded.png", shots).pathname })
		assert.deepEqual(problems, [])
		await context.close()
	}
	// A poster that fails to load turns into the labeled placeholder.
	{
		const broken = structuredClone(fixtures.search)
		broken.items[0].poster_url = "https://image.tmdb.org/t/p/w185/missing-goodwatch-test.jpg"
		const { context, view, problems } = await mount(browser, { viewport: desktop, theme: "dark", result: broken })
		await view.locator("li.item").first().locator(".poster.none").waitFor()
		assert.equal(await view.locator("li.item").first().locator(".missing").innerText(), "Donnie Darko")
		assert.ok(problems.every((p) => /404|Failed to load resource/.test(p)), problems.join("\n"))
		await context.close()
	}
	// Search, light host theme, desktop.
	{
		const { context, page, view, problems } = await mount(browser, { viewport: desktop, theme: "light", result: fixtures.search })
		assert.equal(await view.locator("h1").innerText(), "Search results")
		assert.equal(await view.locator("#more").innerText(), "Show all 7")
		assert.equal(await view.locator("li.item").first().locator(".sr").innerText(), "91% taste match")
		await page.locator("body").screenshot({ path: new URL("desktop-light-search.png", shots).pathname })
		assert.deepEqual(problems, [])
		await context.close()
	}
	// Watch next, both themes, desktop and phone.
	for (const [name, viewport, theme, mobile] of [
		["desktop-dark-watch-next", desktop, "dark", false],
		["phone-light-watch-next", phone, "light", true],
	]) {
		const { context, page, view, problems } = await mount(browser, { viewport, theme, result: fixtures.tonight, mobile })
		assert.equal(await view.locator("li.item").count(), 1)
		assert.equal(await view.locator(".meta").first().innerText(), "S3 E7 · Between the Time")
		assert.equal(await view.locator(".meta.match").innerText(), "74% taste match")
		assert.equal(await view.locator("#more").isVisible(), false)
		await page.locator("body").screenshot({ path: new URL(`${name}.png`, shots).pathname })
		assert.deepEqual(problems, [])
		await context.close()
	}
	// Library on a phone, dark and light: three columns, no horizontal scroll.
	for (const theme of ["dark", "light"]) {
		const { context, page, view, frame, problems } = await mount(browser, { viewport: phone, theme, result: fixtures.library, mobile: true })
		const columns = await frame.evaluate(() => getComputedStyle(document.getElementById("grid")).gridTemplateColumns.split(" ").length)
		assert.equal(columns, 3)
		assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
		assert.equal(await view.locator("li.item:visible").count(), 6)
		await page.locator("body").screenshot({ path: new URL(`phone-${theme}-library.png`, shots).pathname })
		assert.deepEqual(problems, [])
		await context.close()
	}
	// An error answer shows its message and the page link, and no cards.
	{
		const { context, page, view, problems } = await mount(browser, { viewport: desktop, theme: "dark", result: fixtures.error })
		assert.equal(await view.locator("li.item").count(), 0)
		assert.match(await view.locator("#status").innerText(), /smarter matches/)
		assert.equal(await view.locator("#page").isVisible(), true)
		await page.locator("body").screenshot({ path: new URL("desktop-dark-error.png", shots).pathname })
		assert.deepEqual(problems, [])
		await context.close()
	}
	console.log("PASS: poster grid renders, expands, opens links through the host, handles missing posters and errors")
} finally {
	await browser.close()
}
