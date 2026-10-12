// Everything pictured in this folder: every TV screen of the design prototype per direction (1920x1080 in the room,
// and 390 px), the side-by-side comparisons of the TV alone, a clip (mp4) and a strip of the focus moving, a clip and a
// strip of the expand run, and the size numbers (sizes.json).
//   PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs BASE=http://localhost:3147 node shots.mjs [screens|viewports|compare|bar|focus|expand|pointing] [cinema]
// The repo has no browser driver: install playwright-core outside it. Needs the dev server (see README.md) and ffmpeg.
// A page is loaded once per direction and person; window.__tvDesign then jumps from screen to screen.
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")
const base = `${process.env.BASE ?? "http://localhost:3147"}/prototype/tv-screen-design`
const here = dirname(fileURLToPath(import.meta.url))
const only = process.argv[2]
const DESIGNS = ["cinema", "marquee", "glow"].filter((d) => !process.argv[3] || d === process.argv[3])
const NAMES = { cinema: "Cinema", marquee: "Marquee", glow: "Glow" }
const DESKTOP = { width: 1920, height: 1080 }
const PHONE = { width: 390, height: 844 }

// [file name, the screen, a screen pushed on top, the focused item]
const GUEST = [
	["01-home", "home"],
	["02-tonight", "tonight"],
	["03-discover-moods", "discover"],
	["04-discover-results", "discover-cozy"],
	["05-expand-focused", "discover-cozy", null, "expand"],
	["06-explorer-map", "explorer"],
	["07-island", "island-heists"],
	["08-taste-start", "taste"],
	["09-quiz", "quiz"],
	["10-title", "title-knives-out"],
	["11-rate", "rate-knives-out"],
	["12-search", "search"],
	["13-search-results", "search-heist"],
	["14-menu", "discover", "menu"],
	["15-about", "about"],
]
const MEMBER = [
	["16-home-member", "home"],
	["17-taste-sides", "taste"],
	["18-side", "side-dark-crime"],
	["19-my-shows", "shows"],
]
const COMPARE = [
	["home", "home"],
	["discover-moods", "discover"],
	["discover-results", "discover-cozy"],
	["explorer", "explorer", null, "island-whodunits"],
	["title", "title-knives-out"],
]

const ffmpeg = (...args) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...args])
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium" })
// A machine short of memory crashes a page now and then while it loads: try again, twice.
const open = async (viewport, query, tries = 3) => {
	const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 })
	const page = await ctx.newPage()
	try {
		await page.goto(`${base}?${query}`, { waitUntil: "load", timeout: 120000 })
		await page.waitForSelector("[data-tv-item][aria-current]", { timeout: 60000 })
	} catch (error) {
		await ctx.close().catch(() => {})
		if (tries <= 1) throw error
		console.log("loading again:", String(error.message).split("\n")[0])
		await new Promise((done) => setTimeout(done, 4000))
		return open(viewport, query, tries - 1)
	}
	await page.waitForTimeout(600)
	// A dev server that was just restarted answers its first requests with an error, which Vite lays over the page.
	if (await page.evaluate(() => Boolean(document.querySelector("vite-error-overlay")?.remove()) || Boolean(document.querySelector("vite-error-overlay")))) console.log("removed a Vite error overlay on", query)
	return { ctx, page }
}
/** Jumps to a screen and waits until its art is there and its motion is over. */
const go = async (page, [, root, push, focus]) => {
	await page.evaluate((id) => window.__tvDesign.root(id), root)
	await page.waitForTimeout(150)
	if (push) await page.evaluate((id) => window.__tvDesign.push(id), push)
	if (focus) await page.evaluate((id) => window.__tvDesign.focus(id), focus)
	await page.waitForTimeout(150)
	await page.waitForFunction(() => [...document.querySelectorAll("[data-tv-screen] img")].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 30000 }).catch(() => console.log("art missing on", root))
	await page.waitForTimeout(1000)
}
const tvBox = (page) => page.locator("[data-tv-screen]").boundingBox()

/** The smallest text and the smallest focus target on the TV right now, in screen pixels, at rest (no focus growth). */
const measure = (page) =>
	page.evaluate(() => {
		const canvas = document.querySelector("[data-tv-canvas]")
		const k = canvas.getBoundingClientRect().width / canvas.offsetWidth
		const out = { text: null, target: null }
		const walker = document.createTreeWalker(canvas, NodeFilter.SHOW_TEXT)
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const words = node.textContent.trim()
			const el = node.parentElement
			if (!words || !el || !el.getClientRects().length) continue
			const px = Number.parseFloat(getComputedStyle(el).fontSize) * k
			if (!out.text || px < out.text.px) out.text = { px: Math.round(px * 10) / 10, words: words.slice(0, 40) }
		}
		for (const el of canvas.querySelectorAll("[data-tv-item]")) {
			const [w, h] = [el.offsetWidth * k, el.offsetHeight * k]
			if (!out.target || Math.min(w, h) < Math.min(out.target.w, out.target.h)) out.target = { w: Math.round(w), h: Math.round(h), item: el.dataset.tvItem }
		}
		return out
	})

if (!only || only === "screens") {
	const sizes = {}
	for (const design of DESIGNS) {
		const dir = join(here, "screens", design)
		mkdirSync(dir, { recursive: true })
		const worst = { text: null, target: null }
		for (const [size, viewport] of [
			["desktop", DESKTOP],
			["phone", PHONE],
		]) {
			for (const [as, screens] of [
				["guest", GUEST],
				["member", MEMBER],
			]) {
				const { ctx, page } = await open(viewport, `design=${design}&as=${as}`)
				for (const screen of screens) {
					await go(page, screen)
					await page.screenshot({ path: join(dir, `${screen[0]}-${size}.jpg`), type: "jpeg", quality: size === "desktop" ? 58 : 78 })
					if (size === "desktop" && screen[3] !== "expand") {
						const m = await measure(page)
						if (m.text && (!worst.text || m.text.px < worst.text.px)) worst.text = { ...m.text, screen: screen[0] }
						if (m.target && (!worst.target || Math.min(m.target.w, m.target.h) < Math.min(worst.target.w, worst.target.h))) worst.target = { ...m.target, screen: screen[0] }
					}
				}
				await ctx.close()
				console.log("screens", design, size, as)
			}
		}
		const { ctx, page } = await open(DESKTOP, `design=${design}`)
		const tv = await tvBox(page)
		await ctx.close()
		sizes[design] = { tv: `${Math.round(tv.width)} x ${Math.round(tv.height)}`, smallestText: worst.text, smallestTarget: worst.target }
	}
	if (DESIGNS.length === 3) {
		const before = JSON.parse(readFileSync(join(here, "sizes.json"), "utf8"))
		writeFileSync(join(here, "sizes.json"), `${JSON.stringify({ ...sizes, viewports: before.viewports }, null, "\t")}\n`)
	}
	console.log(JSON.stringify(sizes, null, 1))
}

if (!only || only === "viewports") {
	// One window size after the other: Cinema's home in the room for the contact sheet, and the TV's size and its
	// smallest type there (measured on My shows, which has Cinema's smallest type).
	const dir = join(here, "viewports")
	const tmp = join(dir, "tmp")
	mkdirSync(tmp, { recursive: true })
	const sizes = JSON.parse(readFileSync(join(here, "sizes.json"), "utf8"))
	sizes.viewports = {}
	const VIEWPORTS = [[1920, 1080], [1920, 940], [1536, 730], [1440, 800], [1366, 650], [1280, 720], [2560, 1300], [390, 844]]
	for (const [width, height] of VIEWPORTS) {
		const name = `${width}x${height}`
		const { ctx, page } = await open({ width, height }, "design=cinema&as=member&chrome=off")
		await go(page, ["", "shows"])
		const m = await measure(page)
		const tv = await tvBox(page)
		const remote = await page.evaluate(() => {
			const body = document.querySelector("[data-remote] .remote-body").getBoundingClientRect()
			const row = document.querySelector("[data-remote] button[aria-label='Only Netflix']").getBoundingClientRect()
			return { width: Math.round(body.width), endsAt: Math.round(body.bottom), streamingRowEndsAt: Math.round(row.bottom), place: document.querySelector("[data-remote-place]").dataset.remotePlace }
		})
		sizes.viewports[name] = { tv: `${Math.round(tv.width)} x ${Math.round(tv.height)}`, smallestText: m.text.px, remote }
		await ctx.close()
		const home = await open({ width, height }, "design=cinema&chrome=off")
		await go(home.page, ["", "home"])
		await home.page.screenshot({ path: join(tmp, `${name}.png`) })
		await home.ctx.close()
		console.log("viewport", name, JSON.stringify(sizes.viewports[name]))
	}
	writeFileSync(join(here, "sizes.json"), `${JSON.stringify(sizes, null, "\t")}\n`)
	// The sheet: every window at the same scale (a third), so their sizes can be compared too.
	const cell = (i, [w, h]) => `[${i}]scale=${Math.round(w / 3)}:${Math.round(h / 3)},pad=860:440:0:0:color=0x15171c,drawtext=text='${w} x ${h}':fontcolor=white:fontsize=22:x=12:y=h-34:box=1:boxcolor=black@0.7:boxborderw=6[c${i}]`
	ffmpeg(...VIEWPORTS.flatMap(([w, h]) => ["-i", join(tmp, `${w}x${h}.png`)]), "-filter_complex", `${VIEWPORTS.map((v, i) => cell(i, v)).join(";")};${VIEWPORTS.map((_, i) => `[c${i}]`).join("")}xstack=inputs=8:layout=0_0|860_0|1720_0|2580_0|0_440|860_440|1720_440|2580_440`, "-q:v", "3", join(dir, "contact-sheet.jpg"))
	rmSync(tmp, { recursive: true, force: true })
}

if (!only || only === "compare") {
	const dir = join(here, "compare")
	const tmp = join(dir, "tmp")
	mkdirSync(tmp, { recursive: true })
	for (const design of ["cinema", "marquee", "glow"]) {
		const { ctx, page } = await open(DESKTOP, `design=${design}&chrome=off`)
		for (const screen of COMPARE) {
			await go(page, screen)
			await page.screenshot({ path: join(tmp, `${screen[0]}-${design}.png`), clip: await tvBox(page) })
		}
		await ctx.close()
		console.log("compare", design)
	}
	for (const [name] of COMPARE) {
		const label = (i, text) => `[${i}]drawtext=text='${text}':fontcolor=white:fontsize=30:x=w-tw-24:y=h-54:box=1:boxcolor=black@0.7:boxborderw=10[l${i}]`
		ffmpeg(...["cinema", "marquee", "glow"].flatMap((d) => ["-i", join(tmp, `${name}-${d}.png`)]), "-filter_complex", `${label(0, "1 Cinema")};${label(1, "2 Marquee")};${label(2, "3 Glow")};[l0][l1][l2]vstack=inputs=3`, "-q:v", "3", join(dir, `${name}.jpg`))
	}
	rmSync(tmp, { recursive: true, force: true })
}

if (!only || only === "bar") {
	// The top bar as built (the expand key last) and the alternative (first), cut from the titles of Discover.
	const dir = join(here, "compare")
	const tmp = join(dir, "tmp")
	mkdirSync(tmp, { recursive: true })
	const strips = []
	for (const design of ["cinema", "marquee", "glow"]) {
		for (const order of ["last", "first"]) {
			const { ctx, page } = await open(DESKTOP, `design=${design}&chrome=off${order === "first" ? "&bar=first" : ""}`)
			await go(page, ["", "discover-cozy"])
			const b = await tvBox(page)
			const file = join(tmp, `${design}-${order}.png`)
			await page.screenshot({ path: file, clip: { x: b.x, y: b.y, width: b.width, height: 124 } })
			strips.push([file, `${NAMES[design]}, Expand ${order}`])
			await ctx.close()
		}
	}
	const label = (i, text) => `[${i}]drawtext=text='${text}':fontcolor=white:fontsize=24:x=w-tw-24:y=h-40:box=1:boxcolor=black@0.7:boxborderw=8[l${i}]`
	ffmpeg(...strips.flatMap(([file]) => ["-i", file]), "-filter_complex", `${strips.map(([, text], i) => label(i, text)).join(";")};${strips.map((_, i) => `[l${i}]`).join("")}vstack=inputs=${strips.length}`, "-q:v", "3", join(dir, "top-bar.jpg"))
	rmSync(tmp, { recursive: true, force: true })
	console.log("bar")
}

/** Records the TV while `act` runs, through the browser's own screencast, and returns the frames with their times. */
async function record(page, dir, act) {
	const cdp = await page.context().newCDPSession(page)
	const frames = []
	cdp.on("Page.screencastFrame", (f) => {
		frames.push({ at: f.metadata.timestamp, data: f.data })
		cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {})
	})
	await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, everyNthFrame: 1 })
	await act()
	await page.waitForTimeout(500)
	await cdp.send("Page.stopScreencast")
	rmSync(dir, { recursive: true, force: true })
	mkdirSync(dir, { recursive: true })
	frames.forEach((f, i) => writeFileSync(join(dir, `f${String(i).padStart(4, "0")}.jpg`), Buffer.from(f.data, "base64")))
	const list = frames.map((f, i) => `file 'f${String(i).padStart(4, "0")}.jpg'\nduration ${Math.max(0.016, (frames[i + 1]?.at ?? f.at + 0.6) - f.at).toFixed(3)}`).join("\n")
	writeFileSync(join(dir, "list.txt"), `${list}\nfile 'f${String(frames.length - 1).padStart(4, "0")}.jpg'\n`)
	return frames
}

if (!only || only === "focus") {
	const dir = join(here, "focus")
	const tmp = join(dir, "tmp")
	mkdirSync(dir, { recursive: true })
	for (const design of DESIGNS) {
		const { ctx, page } = await open(DESKTOP, `design=${design}&as=member&chrome=off`)
		await go(page, ["", "home"])
		const b = await tvBox(page)
		const crop = `crop=${Math.round(b.width)}:${Math.round(b.height)}:${Math.round(b.x)}:${Math.round(b.y)}`
		const press = async (...keys) => {
			for (const key of keys) {
				await page.keyboard.press(key)
				await page.waitForTimeout(520)
			}
		}
		// Along the apps and back, into Discover, around the moods, into the results, along the titles, up to the bar and along it to the expand key.
		let firstMove = 0
		const frames = await record(page, tmp, async () => {
			await page.waitForTimeout(400)
			firstMove = Date.now() / 1000
			await press("ArrowRight", "ArrowRight", "ArrowRight", "ArrowLeft", "ArrowLeft", "Enter", "ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Enter", "ArrowRight", "ArrowRight", "ArrowUp", "ArrowRight", "ArrowRight", "ArrowRight")
			await page.waitForTimeout(700)
		})
		ffmpeg("-f", "concat", "-safe", "0", "-i", join(tmp, "list.txt"), "-vf", `${crop},fps=30,scale=1200:-2`, "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(dir, `${design}.mp4`))
		// The strip: the frames of the first move from app to app, as the browser drew them.
		const start = Math.max(0, frames.findIndex((f) => f.at >= firstMove) - 1)
		const picked = [0, 1, 2, 3, 5, 8].map((n) => Math.min(frames.length - 1, start + n))
		ffmpeg(...picked.flatMap((i) => ["-i", join(tmp, `f${String(i).padStart(4, "0")}.jpg`)]), "-filter_complex", `${picked.map((_, i) => `[${i}]${crop},crop=iw*0.62:ih*0.52:0:ih*0.48[c${i}]`).join(";")};${picked.map((_, i) => `[c${i}]`).join("")}hstack=inputs=3:shortest=0[x]`.replace("hstack=inputs=3:shortest=0[x]", "xstack=inputs=6:layout=0_0|w0_0|w0+w1_0|0_h0|w0_h0|w0+w1_h0[x]"), "-map", "[x]", "-q:v", "4", join(dir, `${design}-strip.jpg`))
		await ctx.close()
		console.log("focus", design, frames.length, "frames")
	}
	rmSync(tmp, { recursive: true, force: true })
}

if (!only || only === "pointing") {
	// The Remote following the cursor into the four corners and across the TV, once per pointer shape.
	const dir = join(here, "pointing")
	const tmp = join(dir, "tmp")
	mkdirSync(dir, { recursive: true })
	for (const shape of ["ring", "cross", "dot"]) {
		const { ctx, page } = await open(DESKTOP, `design=cinema&chrome=off&pointer=${shape}`)
		await go(page, ["", "discover-cozy"])
		const tv = await tvBox(page)
		const item = await page.locator("[data-tv-item=t-paddington-2]").boundingBox()
		const stops = [
			["the middle of the TV", tv.x + tv.width * 0.62, tv.y + tv.height * 0.3],
			["top left", 24, 90],
			["top right", 1880, 90],
			["bottom right", 1880, 1050],
			["bottom left", 24, 1050],
			["an item", item.x + item.width / 2, item.y + item.height / 2],
		]
		await record(page, tmp, async () => {
			for (const [, x, y] of [...stops, ["", tv.x + 40, tv.y + tv.height * 0.6], ["", tv.x + tv.width - 60, tv.y + tv.height * 0.6], stops[5]]) {
				await page.mouse.move(x, y, { steps: 26 })
				await page.waitForTimeout(650)
			}
		})
		ffmpeg("-f", "concat", "-safe", "0", "-i", join(tmp, "list.txt"), "-vf", "fps=30,scale=1280:-2", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(dir, `${shape}.mp4`))
		// The strip: the same stops, each once it has settled.
		for (const [i, [, x, y]] of stops.entries()) {
			await page.mouse.move(x, y, { steps: 10 })
			await page.waitForTimeout(900)
			await page.screenshot({ path: join(tmp, `s${i}.jpg`), type: "jpeg", quality: 85 })
		}
		ffmpeg(...stops.flatMap((_, i) => ["-i", join(tmp, `s${i}.jpg`)]), "-filter_complex", "[0][1][2]hstack=inputs=3[a];[3][4][5]hstack=inputs=3[b];[a][b]vstack,scale=2880:-2", "-q:v", "4", join(dir, `${shape}-strip.jpg`))
		await ctx.close()
		console.log("pointing", shape)
	}
	rmSync(tmp, { recursive: true, force: true })
}

if (!only || only === "expand") {
	const dir = join(here, "expand")
	const tmp = join(dir, "tmp")
	mkdirSync(dir, { recursive: true })
	// The run starts with the picture framed (the expand key has the focus), so all of it is the picture growing.
	const arm = 420 / 1270
	for (const design of DESIGNS) {
		rmSync(tmp, { recursive: true, force: true })
		mkdirSync(tmp, { recursive: true })
		const { ctx, page } = await open(DESKTOP, `design=${design}&chrome=off&hold&at=home.discover.discover-cozy`)
		await go(page, ["", "discover-cozy"])
		const shot = (file) => page.screenshot({ path: join(tmp, file), type: "jpeg", quality: 88 })
		const at = async (grow) => {
			await page.evaluate((v) => window.__tvLeave(v), arm + (1 - arm) * grow)
			await page.waitForTimeout(90)
		}
		// The strip: the results, the expand key focused (the picture steps back into its frame), then the picture growing.
		await shot("s0.jpg")
		await page.evaluate(() => window.__tvDesign.focus("expand"))
		await page.waitForTimeout(700)
		await shot("s1.jpg")
		await page.keyboard.press("Enter")
		await page.waitForTimeout(200)
		for (const [i, grow] of [0.3, 0.6, 0.85, 1].entries()) {
			await at(grow)
			await shot(`s${i + 2}.jpg`)
		}
		ffmpeg(...[0, 1, 2, 3, 4, 5].flatMap((i) => ["-i", join(tmp, `s${i}.jpg`)]), "-filter_complex", "[0][1][2]hstack=inputs=3[a];[3][4][5]hstack=inputs=3[b];[a][b]vstack,scale=2880:-2", "-q:v", "4", join(dir, `${design}-strip.jpg`))
		// The clip: real time at 20 frames a second, held on the framed picture before and on the page after.
		const fps = 20
		const frames = Math.round(0.85 * fps)
		let n = 0
		const frame = async (grow, times = 1) => {
			await at(grow)
			const name = (i) => join(tmp, `f${String(i).padStart(3, "0")}.jpg`)
			await page.screenshot({ path: name(n), type: "jpeg", quality: 88 })
			for (let i = 1; i < times; i++) ffmpeg("-i", name(n), name(n + i))
			n += times
		}
		ffmpeg("-i", join(tmp, "s0.jpg"), join(tmp, "f000.jpg"))
		for (let i = 1; i < 12; i++) ffmpeg("-i", join(tmp, "s0.jpg"), join(tmp, `f${String(i).padStart(3, "0")}.jpg`))
		n = 12
		await frame(0, 16)
		for (let i = 1; i <= frames; i++) await frame(i / frames)
		await frame(1, 24)
		ffmpeg("-framerate", String(fps), "-i", join(tmp, "f%03d.jpg"), "-vf", "scale=1280:-2", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(dir, `${design}.mp4`))
		await ctx.close()
		console.log("expand", design)
	}
	rmSync(tmp, { recursive: true, force: true })
}
await browser.close()
