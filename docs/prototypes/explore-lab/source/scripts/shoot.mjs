// PROTOTYPE - throwaway (prototype/explore-r4). Screenshots of a prototype page at desktop (1440) and phone (390), so a
// builder can LOOK at what they made.
//
//   node app/prototype/explore/scripts/shoot.mjs <url-path> <name> [--port 3270] [--member] [--viewport] [--hover "<css>"] [--click "<css>"] [--wait 1500] [--lab slot:variant,...]
//
//   <url-path>  what follows the origin: /prototype/explore/demo/movies/moods/cozy
//   <name>      file name stem: writes <name>-desktop.png and <name>-phone.png to ~/.cache/gw-explore-r4/shots/
//   --member    sign in as the preview member first (/__preview), for member views
//   --viewport  only the first screen, not the full page
//   --hover     hover an element before the shot (desktop only), e.g. a trait word
//   --click     click an element before the shot
//   --lab       lab picks for this shot only: --lab hub:atlas,card:identity (same as ?lab=... in the path; the cookie
//               is not written)
//   --motion    leave motion on (the default asks for reduced motion, so shots are still)
//   --slice N   also cut the full page into pieces N px tall (<name>-desktop-1.png, -2.png, ...), which stay readable
//               when a page is long. Default 1500; --slice 0 turns it off.
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

// Playwright comes from the YepWatch app's dependencies; run from goodwatch-webapp/.
const require = createRequire(join(process.cwd(), "../yepwatch-app/package.json"))
const { chromium } = require("playwright")

const args = process.argv.slice(2)
const flag = (name, fallback) => {
	const i = args.indexOf(`--${name}`)
	return i < 0 ? fallback : (args[i + 1] ?? true)
}
const has = (name) => args.includes(`--${name}`)
const [path, name] = args.filter(
	(a, i) =>
		!a.startsWith("--") && !(args[i - 1] ?? "").match(/^--(port|hover|click|wait|slice|lab)$/),
)
if (!path || !name) {
	console.error(
		"Usage: shoot.mjs <url-path> <name> [--port 3270] [--member] [--viewport] [--hover css] [--click css] [--wait ms]",
	)
	process.exit(1)
}
const origin = `http://127.0.0.1:${flag("port", "3270")}`
const labPicks = flag("lab")
const target =
	typeof labPicks === "string"
		? `${path}${path.includes("?") ? "&" : "?"}lab=${encodeURIComponent(labPicks)}`
		: path
const out = join(homedir(), ".cache/gw-explore-r4/shots")
mkdirSync(out, { recursive: true })
process.env.TMPDIR = join(homedir(), ".cache/lhb")
mkdirSync(process.env.TMPDIR, { recursive: true })

const browser = await chromium.launch()
const sizes = [
	["desktop", { width: 1440, height: 900 }, 1],
	["phone", { width: 390, height: 844 }, 2],
]
for (const [label, viewport, scale] of sizes) {
	const context = await browser.newContext({
		viewport,
		deviceScaleFactor: scale,
		isMobile: label === "phone",
		hasTouch: label === "phone",
		reducedMotion: has("motion") ? "no-preference" : "reduce",
	})
	const page = await context.newPage()
	const problems = []
	page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`))
	page.on("console", (m) => {
		if (
			m.type() === "error" &&
			!/Failed to load resource|ERR_|favicon|posthog|sentry/i.test(m.text())
		)
			problems.push(`console: ${m.text().slice(0, 300)}`)
	})
	if (has("member")) await page.goto(`${origin}/__preview`, { waitUntil: "load" }).catch(() => {})
	const response = await page.goto(origin + target, { waitUntil: "load", timeout: 90000 })
	await page.waitForTimeout(Number(flag("wait", "1800")))
	// Lazy images: walk the page once so everything below the fold has loaded, then return to the top.
	if (!has("viewport")) {
		const walk = () =>
			page.evaluate(async () => {
				const step = window.innerHeight
				for (let y = 0; y < document.body.scrollHeight; y += step) {
					window.scrollTo(0, y)
					await new Promise((r) => setTimeout(r, 120))
				}
				window.scrollTo(0, 0)
			})
		// A dev server can reload the page once while it optimizes a dependency: wait and walk again.
		await walk().catch(async () => {
			await page.waitForLoadState("load")
			await page.waitForTimeout(2500)
			await walk()
		})
		await page.waitForTimeout(900)
	}
	const click = flag("click")
	if (typeof click === "string") {
		await page
			.locator(click)
			.first()
			.click({ timeout: 5000 })
			.catch((e) => problems.push(`click: ${e.message.split("\n")[0]}`))
		await page.waitForTimeout(500)
	}
	const hover = flag("hover")
	if (typeof hover === "string" && label === "desktop") {
		await page
			.locator(hover)
			.first()
			.hover({ timeout: 5000 })
			.catch((e) => problems.push(`hover: ${e.message.split("\n")[0]}`))
		await page.waitForTimeout(400)
	}
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth,
	)
	const file = join(out, `${name}-${label}.png`)
	await page.screenshot({ path: file, fullPage: !has("viewport") })
	console.log(
		`${response?.status()} ${label} ${file}${overflow > 1 ? `  !! sideways scroll: ${overflow}px` : ""}`,
	)
	const slice = Number(flag("slice", "1500"))
	if (slice > 0 && !has("viewport")) {
		// Real scrolling, one tall viewport per piece: lazy images and offscreen-skipped cards render as they do for a
		// person. The prototype switcher is hidden after the first piece so it doesn't sit on every one.
		const per = label === "phone" ? 1700 : slice
		await page.setViewportSize({ width: viewport.width, height: per })
		const height = await page.evaluate(() => document.documentElement.scrollHeight)
		let n = 0
		for (let y = 0; y < height; y += per - 120) {
			n++
			await page.evaluate((top) => window.scrollTo(0, top), y)
			if (n === 2)
				await page.addStyleTag({ content: "[data-proto-switcher]{display:none!important}" })
			await page
				.waitForFunction(
					() =>
						[...document.images]
							.filter((img) => {
								const r = img.getBoundingClientRect()
								return (
									r.bottom > 0 &&
									r.top < window.innerHeight &&
									r.right > 0 &&
									r.left < window.innerWidth &&
									r.width > 0
								)
							})
							.every((img) => img.complete),
					null,
					{ timeout: 8000 },
				)
				.catch(() => problems.push(`slice ${n}: some images did not finish loading`))
			await page.waitForTimeout(350)
			await page.screenshot({ path: join(out, `${name}-${label}-${n}.png`) })
			if (y + per >= height) break
		}
		console.log(`   ${n} slices: ${name}-${label}-N.png`)
	}
	for (const p of [...new Set(problems)].slice(0, 8)) console.log(`   ${p}`)
	await context.close()
}
await browser.close()
