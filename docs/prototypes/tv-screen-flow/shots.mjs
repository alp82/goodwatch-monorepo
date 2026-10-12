// Screenshots of every TV screen of the flow prototype, at 1920x1080 and at a phone's width, and the frames of the
// expand animation of each variant. The repo has no browser driver, so point PLAYWRIGHT at one in a scratch folder:
//   npm i playwright-core   (anywhere outside the repo)
//   PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs BASE=http://localhost:3147 node shots.mjs [screens|expand] [rows/03]
// Needs the dev server (see README.md) and, for the strips and clips, ffmpeg.
import { execFileSync } from "node:child_process"
import { mkdirSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")
const base = `${process.env.BASE ?? "http://localhost:3147"}/prototype/tv-screen-flow`
const here = dirname(fileURLToPath(import.meta.url))
const only = process.argv[2]
// With "screens": only the screens whose `variant/name` contains this, for example `rows/03`.
const filter = process.argv[3]

// [file name, query]. `f` is the focused item on arrival.
const SCREENS = {
	rows: [
		["01-home-guest", ""],
		["02-home-member", "as=member"],
		["03-home-member-paged", "as=member&f=expand-movies"],
		["04-discover", "at=discover-cozy"],
		["05-discover-expand-focused", "at=discover-cozy&f=expand"],
		["06-explorer", "at=explorer"],
		["07-island", "at=explorer.island-heists"],
		["08-taste-guest", "at=taste"],
		["09-quiz", "at=taste.quiz"],
		["10-taste-sides", "at=taste&as=member"],
		["11-side", "at=taste.side-dark-crime&as=member"],
		["12-my-shows", "at=shows&as=member"],
		["13-title", "at=home.title-knives-out"],
		["14-rate", "at=home.title-knives-out.rate-knives-out"],
		["15-search", "at=home.search"],
		["16-search-results", "at=home.search.search-heist"],
		["17-menu", "at=home.menu"],
		["18-about", "at=home.about"],
	],
	apps: [
		["01-home-guest", ""],
		["02-home-member", "as=member&f=app-shows"],
		["03-tonight", "at=home.tonight"],
		["04-discover-moods", "at=home.discover"],
		["05-discover-results", "at=home.discover.discover-cozy"],
		["06-discover-expand-focused", "at=home.discover.discover-cozy&f=expand"],
		["07-explorer-map", "at=home.explorer&f=island-whodunits"],
		["08-island", "at=home.explorer.island-heists"],
		["09-taste-guest", "at=home.taste"],
		["10-taste-sides", "at=home.taste&as=member"],
		["11-side", "at=home.taste.side-big-ideas&as=member"],
		["12-my-shows", "at=home.shows&as=member"],
		["13-title", "at=home.tonight.title-arrival&as=member"],
		["14-search-results", "at=home.search.search-heist"],
		["15-menu", "at=home.discover.menu"],
	],
	guided: [
		["01-home-guest", ""],
		["02-home-member", "as=member"],
		["03-tonight-1-mood", "at=home.mood"],
		["04-tonight-2-kind", "at=home.mood.kind-cozy"],
		["05-tonight-3-pick", "at=home.mood.kind-cozy.pick-cozy-movie-0"],
		["06-pick-expand-focused", "at=home.mood.kind-cozy.pick-cozy-movie-0&f=expand"],
		["07-map-1-start", "at=home.start"],
		["08-map-2-island", "at=home.start.island-heists-0"],
		["09-quiz", "at=home.quiz"],
		["10-taste", "at=home.taste&as=member"],
		["11-next-episode", "at=home.next-0&as=member"],
		["12-title", "at=home.mood.kind-cozy.pick-cozy-movie-0.title-paddington-2"],
		["13-search-results", "at=home.search.search-heist"],
	],
}

// The expand run of each variant: where it starts, and how much of it is the brackets' way to the picture's edge.
const RUNS = {
	rows: { q: "variant=rows&at=discover-cozy&f=expand", arm: 420 / 1270, ms: 1270 },
	apps: { q: "variant=apps&at=home.discover.discover-cozy&f=expand", arm: 420 / 1270, ms: 850, framed: true },
	guided: { q: "variant=guided&at=home.mood.kind-cozy.pick-cozy-movie-0&f=expand", arm: 2400 / 3250, ms: 3250 },
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium" })
// A machine short of memory crashes a page now and then while it loads: try again, twice.
const open = async (viewport, query, tries = 3) => {
	const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 })
	const page = await ctx.newPage()
	try {
		await page.goto(`${base}?${query}`, { waitUntil: "load", timeout: 120000 })
		await page.waitForSelector("[data-tv-item][aria-current]", { timeout: 30000 })
	} catch (error) {
		await ctx.close().catch(() => {})
		if (tries <= 1) throw error
		await new Promise((done) => setTimeout(done, 4000))
		return open(viewport, query, tries - 1)
	}
	await page.waitForTimeout(700)
	// A dev server that was just restarted answers its first requests with an error, which Vite lays over the page.
	await page.evaluate(() => document.querySelector("vite-error-overlay")?.remove())
	return { ctx, page }
}

if (!only || only === "screens") {
	for (const [variant, screens] of Object.entries(SCREENS)) {
		const dir = join(here, "screens", variant)
		mkdirSync(dir, { recursive: true })
		for (const [name, q] of screens) {
			if (filter && !`${variant}/${name}`.includes(filter)) continue
			for (const [size, viewport] of [
				["desktop", { width: 1920, height: 1080 }],
				["phone", { width: 390, height: 844 }],
			]) {
				const { ctx, page } = await open(viewport, `variant=${variant}&${q}`)
				await page.screenshot({ path: join(dir, `${name}-${size}.jpg`), type: "jpeg", quality: size === "desktop" ? 62 : 80 })
				await ctx.close()
			}
			console.log(variant, name)
		}
	}
}

if (!only || only === "expand") {
	const dir = join(here, "expand")
	const tmp = join(dir, "tmp")
	mkdirSync(dir, { recursive: true })
	const ffmpeg = (...args) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...args])
	for (const [variant, run] of Object.entries(RUNS)) {
		rmSync(tmp, { recursive: true, force: true })
		mkdirSync(tmp, { recursive: true })
		const { ctx, page } = await open({ width: 1920, height: 1080 }, `${run.q}&hold`)
		const shot = (file) => page.screenshot({ path: join(tmp, file), type: "jpeg", quality: 85 })
		const at = async (p) => {
			await page.evaluate((v) => window.__tvLeave(v), p)
			await page.waitForTimeout(80)
		}
		await shot("s0.jpg")
		await page.keyboard.press("Enter")
		await page.waitForTimeout(150)
		// The strip: six moments. Focused, the brackets half way and at the edge, the picture growing, the page.
		const first = run.framed ? run.arm : 0
		const moments = run.framed ? [0.2, 0.45, 0.7, 0.88, 1].map((g) => run.arm + (1 - run.arm) * g) : [run.arm * 0.5, run.arm, run.arm + (1 - run.arm) * 0.4, run.arm + (1 - run.arm) * 0.75, 1]
		for (const [i, p] of moments.entries()) {
			await at(p)
			await shot(`s${i + 1}.jpg`)
		}
		ffmpeg(...[0, 1, 2, 3, 4, 5].flatMap((i) => ["-i", join(tmp, `s${i}.jpg`)]), "-filter_complex", "[0][1][2]hstack=inputs=3[a];[3][4][5]hstack=inputs=3[b];[a][b]vstack,scale=2880:-2", "-q:v", "4", join(dir, `${variant}-strip.jpg`))
		// The clip: real time at 20 frames a second, held on the focused control before and on the page after.
		const fps = 20
		const frames = Math.round((run.ms / 1000) * fps)
		let n = 0
		const frame = async (p, times = 1) => {
			await at(p)
			await page.screenshot({ path: join(tmp, `f${String(n).padStart(3, "0")}.jpg`), type: "jpeg", quality: 85 })
			for (let i = 1; i < times; i++) ffmpeg("-i", join(tmp, `f${String(n).padStart(3, "0")}.jpg`), join(tmp, `f${String(n + i).padStart(3, "0")}.jpg`))
			n += times
		}
		await frame(first, 14)
		for (let i = 1; i <= frames; i++) await frame(first + ((1 - first) * i) / frames)
		await frame(1, 24)
		ffmpeg("-framerate", String(fps), "-i", join(tmp, "f%03d.jpg"), "-vf", "scale=1280:-2", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(dir, `${variant}.mp4`))
		ffmpeg("-framerate", String(fps), "-i", join(tmp, "f%03d.jpg"), "-vf", "fps=12,scale=720:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4", join(dir, `${variant}.gif`))
		await ctx.close()
		console.log("expand", variant)
	}
	rmSync(tmp, { recursive: true, force: true })
}
await browser.close()
