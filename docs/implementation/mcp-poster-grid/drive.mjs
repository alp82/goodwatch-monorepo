// Renders the MCP poster cards in a minimal MCP Apps host and checks them, then takes screenshots.
// The host is a page that loads the resource's HTML in a sandboxed iframe (scripts only, no same origin), under the
// CSP the resource declares, and speaks the host side of the protocol: ui/initialize with a theme and Claude-style
// style variables, tool input and result, size-changed and ui/open-link. See README.md for how to run it.
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
// A few of the variables Claude sends in hostContext.styles (light-dark() values resolve with color-scheme).
const variables = {
	"--color-text-primary": "light-dark(#141413, #faf9f5)",
	"--color-text-secondary": "light-dark(#5e5d59, #b7b5a9)",
	"--color-border-primary": "light-dark(rgba(31,30,29,.15), rgba(222,220,209,.15))",
}

const hostPage = (theme, width) => `<!doctype html>
<html style="color-scheme:${theme}"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
body { margin: 0; padding: 24px 16px; background: ${theme === "dark" ? "#262624" : "#faf9f5"}; font: 15px system-ui; color: ${theme === "dark" ? "#faf9f5" : "#141413"} }
.col { max-width: ${width}px; margin: 0 auto } p { margin: 0 0 12px }
iframe { display: block; width: 100%; height: 120px; border: 0; background: transparent }
</style></head><body><div class="col"><p>Here you go. See it on GoodWatch.</p>
<iframe id="app" sandbox="allow-scripts allow-popups"></iframe><p style="margin-top:12px">The answer goes on below the card.</p></div></body></html>`

async function mount(browser, { viewport, theme, result, args = {}, width = 680, mobile = false }) {
	const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile })
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
		({ html, theme, result, args, variables }) => {
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
							hostContext: { theme, displayMode: "inline", platform: "web", styles: { variables } },
						},
					})
				else if (method === "ui/notifications/initialized") {
					send({ method: "ui/notifications/tool-input", params: { arguments: args } })
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
		{ html: widget, theme, result, args, variables },
	)
	const view = page.frameLocator("#app")
	await view.locator("#gw[data-state=ready]").waitFor()
	const frame = page.frames().find((f) => f !== page.mainFrame())
	await frame.waitForFunction(() =>
		[...document.images].filter((img) => img.loading === "eager").every((img) => img.complete),
	)
	await frame.evaluate(() => document.fonts.ready)
	await page.waitForTimeout(300)
	return { context, page, view, frame, problems }
}
const shot = (page, name) => page.locator(".col").screenshot({ path: new URL(`${name}.png`, shots).pathname })
const opened = (page, n) =>
	page.waitForFunction((n) => window.__opened.length === n, n).then(() => page.evaluate(() => window.__opened))

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})
const desktop = { width: 1100, height: 1000 }
const phone = { width: 390, height: 844 }
const libraryArgs = { filter: "want_to_see", sort: "match" }
try {
	// The page itself stays transparent and follows the host's color scheme (Claude's theming guide).
	{
		const { context, frame, problems } = await mount(browser, { viewport: desktop, theme: "light", result: fixtures.library, args: libraryArgs })
		const look = await frame.evaluate(() => ({
			body: getComputedStyle(document.body).backgroundColor,
			html: getComputedStyle(document.documentElement).backgroundColor,
			scheme: document.documentElement.style.colorScheme,
			meta: document.querySelector('meta[name="color-scheme"]')?.content,
			text: getComputedStyle(document.querySelector(".rail .n")).color,
		}))
		assert.deepEqual([look.body, look.html], ["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)"])
		assert.equal(look.scheme, "light")
		assert.equal(look.meta, "light dark")
		assert.equal(look.text, "rgb(20, 20, 19)", "row titles use the host's text color")
		assert.deepEqual(problems, [])
		await context.close()
	}
	// Watch next, desktop dark: backdrop, large poster, episode name, Watch on Netflix with its logo, logo link.
	{
		const { context, page, view, frame, problems } = await mount(browser, { viewport: desktop, theme: "dark", result: fixtures.tonight })
		assert.equal(await view.locator(".pick .eyebrow").innerText(), "Next episode · S3 E7 · Between the Time")
		assert.equal(await view.locator(".pick h2").innerText(), "Dark")
		assert.equal(await view.locator(".pick .tag").innerText(), "Everything is connected.")
		assert.equal(await view.locator(".pick .meta").innerText(), "2017 · Show · 74% taste match")
		assert.equal(await view.locator(".pick .pf .score").innerText(), "85", "the GoodWatch score tab on the poster")
		assert.match(await view.locator(".btn.white").innerText(), /Watch on Netflix/)
		const images = await frame.evaluate(() => [...document.images].map((img) => [img.className, img.naturalWidth > 0]))
		assert.deepEqual(images, [["bd", true], ["", true], ["logo", true]])
		const poster = await view.locator(".pick .pf").boundingBox()
		assert.ok(poster.width >= 149, `poster ${poster.width}px wide`)
		await shot(page, "desktop-dark-watch-next")
		await view.locator(".btn.white").click()
		await view.locator(".btn.glass").click()
		await view.locator(".mark").click()
		assert.deepEqual(await opened(page, 3), [
			"https://www.netflix.com/title/80100172",
			"https://goodwatch.app/show/70523-dark",
			"https://goodwatch.app/my-shows",
		])
		assert.deepEqual(problems, [])
		await context.close()
	}
	// Watch next on a phone, both themes: the episode name goes, nothing overflows.
	for (const theme of ["dark", "light"]) {
		const { context, page, view, frame, problems } = await mount(browser, { viewport: phone, theme, result: fixtures.tonight, mobile: true, width: 358 })
		assert.equal(await view.locator(".pick .eyebrow").innerText(), "Next episode · S3 E7")
		const overflow = await frame.evaluate(() =>
			[...document.querySelectorAll(".pick *")]
				.filter((el) => el.getBoundingClientRect().right > window.innerWidth + 0.5)
				.map((el) => el.className || el.tagName),
		)
		assert.deepEqual(overflow, [])
		assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
		await shot(page, `phone-${theme}-watch-next`)
		assert.deepEqual(problems, [])
		await context.close()
	}
	// My library, desktop dark: the best match on its backdrop, then the row; arrows scroll it; links open.
	{
		const { context, page, view, frame, problems } = await mount(browser, { viewport: desktop, theme: "dark", result: fixtures.library, args: libraryArgs })
		assert.equal(await view.locator(".featlink .eyebrow").innerText(), "Best match on your Wishlist")
		assert.equal(await view.locator(".featlink .name").innerText(), "Elling")
		assert.match(await view.locator(".featlink .meta").innerText(), /^2001 · Movie( · \d+ h \d+ min)? · 95% taste match$/)
		assert.equal(await view.locator(".featlink .score").innerText(), "75")
		const tabs = await frame.evaluate(() =>
			[...document.querySelectorAll(".rail .item:not(.all)")].map((item) => item.querySelector(".score")?.textContent ?? null),
		)
		const expected = fixtures.library.items.slice(1).map((item) => (item.goodwatch_score == null ? null : String(item.goodwatch_score)))
		assert.deepEqual(tabs, expected, "every row poster with a score has its tab")
		assert.equal(await frame.evaluate(() => /% match/.test(document.querySelector(".rail").textContent)), false, "no match text in the row")
		assert.equal(await view.locator(".rail li").count(), 14, "13 posters and the See it on GoodWatch tile")
		assert.equal(await view.locator(".rail li").nth(8).locator(".missing").innerText(), "Inside No. 9")
		assert.equal(await view.locator(".nav.prev").isVisible(), false)
		assert.equal(await view.locator(".nav.next").isVisible(), true)
		await shot(page, "desktop-dark-library")
		await view.locator(".nav.next").click()
		await frame.waitForFunction(() => document.querySelector(".rail").scrollLeft > 300)
		await view.locator(".nav.prev").waitFor()
		await page.waitForTimeout(500)
		await shot(page, "desktop-dark-library-scrolled")
		await view.locator(".nav.prev").click()
		await frame.waitForFunction(() => document.querySelector(".rail").scrollLeft < 4)
		await view.locator(".featlink").click()
		await view.locator(".rail .item").nth(2).click()
		await view.locator(".feat .mark").click()
		assert.deepEqual(await opened(page, 3), [
			"https://goodwatch.app/movie/6007-elling",
			"https://goodwatch.app/movie/141-donnie-darko",
			"https://goodwatch.app/my-library",
		])
		const sizes = await page.evaluate(() => window.__sizes)
		assert.ok(sizes.at(-1) > 400, `size reports: ${sizes}`)
		assert.deepEqual(problems, [])
		await context.close()
	}
	// The row on a phone: it scrolls sideways inside the card, the next poster peeks in, the page never scrolls sideways.
	for (const theme of ["dark", "light"]) {
		const { context, page, view, frame, problems } = await mount(browser, { viewport: phone, theme, result: fixtures.library, args: libraryArgs, mobile: true, width: 358 })
		const row = await frame.evaluate(() => {
			const rail = document.querySelector(".rail")
			const third = rail.children[2].getBoundingClientRect()
			return { scroll: rail.scrollWidth, client: rail.clientWidth, thirdLeft: third.left, thirdRight: third.right, width: window.innerWidth }
		})
		assert.ok(row.scroll > row.client * 3, `row scrolls: ${JSON.stringify(row)}`)
		assert.ok(row.thirdLeft < row.width && row.thirdRight > row.width, `the third poster peeks in: ${JSON.stringify(row)}`)
		assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
		assert.equal(await view.locator(".nav.next").isVisible(), false, "no arrows on touch")
		await shot(page, `phone-${theme}-library`)
		// A swipe: a touch drag to the left on the row.
		const box = await view.locator(".rail").boundingBox()
		const cdp = await context.newCDPSession(page)
		// Raw touch events: headless Chromium ignores Input.synthesizeScrollGesture.
		const y = Math.round(box.y + 80)
		const startX = Math.round(box.x + box.width - 30)
		for (const [type, dx] of [["touchStart", 0], ["touchMove", -60], ["touchMove", -130], ["touchMove", -200], ["touchMove", -260], ["touchEnd", -260]])
			await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: startX + dx, y }] })
		await frame.waitForFunction(() => document.querySelector(".rail").scrollLeft > 60, null, { timeout: 5000 })
		await page.waitForTimeout(500)
		console.log(`  ${theme} phone: swipe moved the row to ${await frame.evaluate(() => document.querySelector(".rail").scrollLeft)} px`)
		assert.equal(await page.evaluate(() => window.scrollX), 0, "the swipe moved the row, not the page")
		await shot(page, `phone-${theme}-library-swiped`)
		assert.deepEqual(problems, [])
		await context.close()
	}
	// People search, desktop dark: the top person on their known-for backdrop, then the other people.
	{
		const { context, page, view, frame, problems } = await mount(browser, { viewport: desktop, theme: "dark", result: fixtures.people, args: { query: "denis" } })
		assert.equal(await view.locator(".featlink .eyebrow").innerText(), "Top result for “denis”")
		assert.equal(await view.locator(".featlink .name").innerText(), "Denis Villeneuve")
		assert.equal(await view.locator(".featlink .meta").innerText(), "Directing · Known for Arrival (2016), Blade Runner 2049 (2017)")
		assert.equal(await view.locator(".rail li").count(), 7, "six people and the See it on GoodWatch tile")
		assert.equal(await view.locator(".rail .item").nth(0).locator(".d").innerText(), "Acting")
		assert.equal(await view.locator(".rail li").nth(4).locator(".missing").innerText(), "Denis Lavant")
		const faces = await frame.evaluate(() => [...document.images].filter((img) => img.loading === "eager" && img.closest(".face")).map((img) => img.naturalWidth > 0))
		assert.ok(faces.length >= 5 && faces.every(Boolean), `profile photos load: ${faces}`)
		await shot(page, "desktop-dark-people")
		await view.locator(".featlink").click()
		await view.locator(".rail .item").first().click()
		assert.deepEqual(await opened(page, 2), [
			"https://goodwatch.app/person/137427-denis-villeneuve",
			"https://goodwatch.app/person/5724-denis-leary",
		])
		assert.deepEqual(problems, [])
		await context.close()
	}
	// People search and a filmography on a phone.
	for (const [name, result, theme] of [["people", fixtures.people, "light"], ["person", fixtures.person, "dark"]]) {
		const { context, page, view, frame, problems } = await mount(browser, { viewport: phone, theme, result, args: { query: "denis" }, mobile: true, width: 358 })
		assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
		const rail = await frame.evaluate(() => document.querySelector(".rail").scrollWidth > document.querySelector(".rail").clientWidth)
		assert.equal(rail, true, "the row scrolls sideways")
		if (name === "person") {
			assert.equal(await view.locator(".featlink .eyebrow").innerText(), "Filmography")
			assert.equal(await view.locator(".featlink .name").innerText(), "Denis Villeneuve")
			assert.equal(await view.locator(".rail .item").first().locator(".score").innerText(), "79")
		}
		await shot(page, `phone-${theme}-${name}`)
		assert.deepEqual(problems, [])
		await context.close()
	}
	// A filmography, desktop light: the person heads the card, the films fill the row with their score tabs.
	{
		const { context, page, view, problems } = await mount(browser, { viewport: desktop, theme: "light", result: fixtures.person })
		assert.equal(await view.locator(".featlink .face").count(), 1)
		assert.equal(await view.locator(".rail .item:not(.all)").count(), 12)
		await shot(page, "desktop-light-person")
		await view.locator(".rail .item").nth(2).click()
		assert.deepEqual(await opened(page, 1), ["https://goodwatch.app/movie/329865-arrival"])
		assert.deepEqual(problems, [])
		await context.close()
	}
	// Search, light desktop.
	{
		const { context, page, view, problems } = await mount(browser, { viewport: desktop, theme: "light", result: fixtures.search, args: { query: "dark" } })
		assert.equal(await view.locator(".featlink .eyebrow").innerText(), "Top result for “dark”")
		await shot(page, "desktop-light-search")
		assert.deepEqual(problems, [])
		await context.close()
	}
	// A poster that fails to load turns into the labeled placeholder; a missing backdrop leaves the dark card.
	{
		const broken = structuredClone(fixtures.search)
		broken.items[0].backdrop_url = null
		broken.items[1].poster_url = "https://image.tmdb.org/t/p/w185/missing-goodwatch-test.jpg"
		const { context, view, problems } = await mount(browser, { viewport: desktop, theme: "dark", result: broken })
		assert.equal(await view.locator(".feat .bd").count(), 0)
		await view.locator(".rail li").first().locator(".poster.none").waitFor()
		assert.equal(await view.locator(".rail li").first().locator(".missing").innerText(), "Severance")
		assert.ok(problems.every((p) => /404|Failed to load resource/.test(p)), problems.join("\n"))
		await context.close()
	}
	// An error answer: its message, the logo linking to the page.
	{
		const { context, page, view, problems } = await mount(browser, { viewport: desktop, theme: "dark", result: fixtures.error })
		assert.match(await view.locator(".msg .text").innerText(), /smarter matches/)
		await shot(page, "desktop-dark-error")
		assert.deepEqual(problems, [])
		await context.close()
	}
	// Light desktop Watch next, for the record.
	{
		const { context, page, problems } = await mount(browser, { viewport: desktop, theme: "light", result: fixtures.tonight })
		await shot(page, "desktop-light-watch-next")
		assert.deepEqual(problems, [])
		await context.close()
	}
	console.log("PASS: Watch next and the banner-and-row cards render, link through the host, scroll sideways on phones, stay transparent")
} finally {
	await browser.close()
}
