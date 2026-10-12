// Everything pictured in this folder: every TV screen of the design prototype per direction (1920x1080 in the room,
// and 390 px), the side-by-side comparisons of the TV alone, a clip (mp4) and a strip of the focus moving, a clip and a
// strip of the expand run, and the size numbers (sizes.json).
//   PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs BASE=http://localhost:3147 node shots.mjs [screens|viewports|compare|bar|focus|expand|pointing|touch] [cinema]
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
	// A phone is a phone: touch, and no scrollbar that takes width.
	const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...(viewport.width < 768 ? { isMobile: true, hasTouch: true } : {}) })
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
				// The phone's pictures are without the prototype's own key, so they show the real proportions.
				const { ctx, page } = await open(viewport, `design=${design}&as=${as}${size === "phone" ? "&chrome=off" : ""}`)
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
		writeFileSync(join(here, "sizes.json"), `${JSON.stringify({ ...sizes, viewports: before.viewports, phones: before.phones }, null, "\t")}\n`)
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
	const VIEWPORTS = [[1920, 1080], [1920, 940], [1536, 730], [1440, 800], [1366, 650], [1280, 720], [2560, 1300]]
	for (const [width, height] of VIEWPORTS) {
		const name = `${width}x${height}`
		const { ctx, page } = await open({ width, height }, "design=cinema&as=member&chrome=off")
		await go(page, ["", "shows"])
		const m = await measure(page)
		const tv = await tvBox(page)
		const remote = await page.evaluate(() => {
			const body = document.querySelector("[data-remote] .remote-body")
			const row = document.querySelector("[data-remote] button[aria-label='Only Netflix']").getBoundingClientRect()
			return { width: Math.round(body.getBoundingClientRect().width), scale: Math.round((document.querySelector("[data-remote]").offsetWidth / 312) * 100) / 100, endsAt: Math.round(body.getBoundingClientRect().bottom), streamingRowEndsAt: Math.round(row.bottom), place: document.querySelector("[data-remote-place]").dataset.remotePlace }
		})
		sizes.viewports[name] = { tv: `${Math.round(tv.width)} x ${Math.round(tv.height)}`, smallestText: m.text.px, remote }
		await ctx.close()
		const home = await open({ width, height }, "design=cinema&chrome=off")
		await go(home.page, ["", "home"])
		await home.page.screenshot({ path: join(tmp, `${name}.png`) })
		await home.ctx.close()
		console.log("viewport", name, JSON.stringify(sizes.viewports[name]))
	}
	// The sheet: every window at the same scale (a third), so their sizes can be compared too.
	const cell = (i, [w, h]) => `[${i}]scale=${Math.round(w / 3)}:${Math.round(h / 3)},pad=860:440:0:0:color=0x15171c,drawtext=text='${w} x ${h}':fontcolor=white:fontsize=22:x=12:y=h-34:box=1:boxcolor=black@0.7:boxborderw=6[c${i}]`
	ffmpeg(...VIEWPORTS.flatMap(([w, h]) => ["-i", join(tmp, `${w}x${h}.png`)]), "-filter_complex", `${VIEWPORTS.map((v, i) => cell(i, v)).join(";")};${VIEWPORTS.map((_, i) => `[c${i}]`).join("")}xstack=inputs=7:layout=0_0|860_0|1720_0|2580_0|0_440|860_440|1720_440`, "-q:v", "3", join(dir, "contact-sheet.jpg"))

	// The phones: the room, the TV and the phone's own Remote on one screen, at five sizes. The sheet has Cinema's
	// home, a mini Discover and a title per size with the Remote as the phone has it by itself; a second sheet has
	// the home in both forms. The numbers are for both forms.
	sizes.phones = {}
	const PHONES = [[390, 844], [360, 740], [375, 667], [430, 932], [390, 700]]
	const SHEET = [["home", "home"], ["discover", "discover-cozy"], ["title", "title-knives-out"]]
	for (const [width, height] of PHONES) {
		const name = `${width}x${height}`
		// Which form the phone takes by itself: held in the hand, or on the table where the window is too short.
		const own = await open({ width, height }, "design=cinema&chrome=off")
		const auto = await own.page.locator("[data-remote]").getAttribute("data-phone-remote")
		await own.ctx.close()
		sizes.phones[name] = { byItself: auto }
		for (const form of ["hand", "table"]) {
			const { ctx, page } = await open({ width, height }, `design=cinema&chrome=off&form=${form}`)
			let text = null
			for (const [file, screen] of SHEET) {
				await go(page, ["", screen])
				const m = await measure(page)
				if (m.text && (!text || m.text.px < text)) text = m.text.px
				await page.screenshot({ path: join(tmp, `p-${name}-${form}-${file}.png`) })
			}
			const tv = await tvBox(page)
			const room = await page.evaluate(() => {
				const body = document.querySelector("[data-remote] .remote-body").getBoundingClientRect()
				const all = [...document.querySelectorAll("[data-remote] button")].map((b) => b.getBoundingClientRect())
				const canvas = document.querySelector("[data-tv-canvas]")
				const frame = document.querySelector("[data-tv-body]").getBoundingClientRect()
				return {
					canvas: `${canvas.offsetWidth} x ${Math.round(canvas.offsetHeight)}`, shownAt: Math.round((canvas.getBoundingClientRect().width / canvas.offsetWidth) * 100) / 100, tvBody: `${Math.round(frame.width)} x ${Math.round(frame.height)}`,
					remote: { width: Math.round(body.width), keys: all.length, smallestKey: Math.round(Math.min(...all.map((r) => Math.min(r.width, r.height)))), startsAt: Math.round(body.top), keysEndAt: Math.round(Math.max(...all.map((r) => r.bottom))) },
				}
			})
			sizes.phones[name][form] = { tv: `${Math.round(tv.width)} x ${Math.round(tv.height)}`, tvBody: room.tvBody, canvas: room.canvas, shownAt: room.shownAt, smallestText: text, remote: room.remote }
			await ctx.close()
			console.log("phone", name, form, form === auto ? "(by itself)" : "", JSON.stringify(sizes.phones[name][form]))
		}
	}
	writeFileSync(join(here, "sizes.json"), `${JSON.stringify(sizes, null, "\t")}\n`)
	const label = (text) => `drawtext=text='${text}':fontcolor=white:fontsize=22:x=8:y=h-30:box=1:boxcolor=black@0.7:boxborderw=5`
	const grid = (cells, columns, out) => {
		const filters = cells.map(([, text], i) => `[${i}]pad=446:968:0:0:color=0x15171c,${label(text)}[p${i}]`).join(";")
		const layout = cells.map((_, i) => `${(i % columns) * 446}_${Math.floor(i / columns) * 968}`).join("|")
		ffmpeg(...cells.flatMap(([file]) => ["-i", file]), "-filter_complex", `${filters};${cells.map((_, i) => `[p${i}]`).join("")}xstack=inputs=${cells.length}:layout=${layout}:fill=0x15171c`, "-q:v", "4", out)
	}
	// The first sheet is each phone as it is by itself; the second has the home in both forms at every size.
	const own = (w, h) => sizes.phones[`${w}x${h}`].byItself
	grid(SHEET.flatMap(([file]) => PHONES.map(([w, h]) => [join(tmp, `p-${w}x${h}-${own(w, h)}-${file}.png`), `${w} x ${h}${own(w, h) === "table" ? ", on the table" : ""}`])), PHONES.length, join(dir, "phones.jpg"))
	grid(["hand", "table"].flatMap((form) => PHONES.map(([w, h]) => [join(tmp, `p-${w}x${h}-${form}-home.png`), `${w} x ${h}, ${form === "table" ? "on the table" : "in the hand"}${own(w, h) === form ? " (by itself)" : ""}`])), PHONES.length, join(dir, "phones-forms.jpg"))
	// Before and after at 390 x 844: the pictures of the last round (commit 58ad60e3) over this round's.
	const BEFORE = [["home", "01-home"], ["discover", "04-discover-results"], ["title", "10-title"]]
	for (const [file, old] of BEFORE) writeFileSync(join(tmp, `before-${file}.jpg`), execFileSync("git", ["show", `58ad60e3:docs/prototypes/tv-screen-design/screens/cinema/${old}-phone.jpg`], { cwd: here, maxBuffer: 1 << 26 }))
	grid([...BEFORE.map(([file]) => [join(tmp, `before-${file}.jpg`), "before"]), ...BEFORE.map(([file]) => [join(tmp, `p-390x844-hand-${file}.png`), "after"])], 3, join(dir, "phone-before-after.jpg"))
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
	// The two places the expand key had in the top bar, kept behind B for comparison (last and first), cut from the
	// titles of Discover.
	const dir = join(here, "compare")
	const tmp = join(dir, "tmp")
	mkdirSync(tmp, { recursive: true })
	const strips = []
	for (const design of ["cinema", "marquee", "glow"]) {
		for (const order of ["last", "first"]) {
			const { ctx, page } = await open(DESKTOP, `design=${design}&chrome=off&bar=${order}`)
			await go(page, ["", "discover-cozy"])
			const b = await tvBox(page)
			const file = join(tmp, `${design}-${order}.png`)
			await page.screenshot({ path: file, clip: { x: b.x, y: b.y, width: b.width, height: 124 } })
			strips.push([file, `${NAMES[design]}, Expand ${order} in the bar`])
			await ctx.close()
		}
	}
	const label = (i, text) => `[${i}]drawtext=text='${text}':fontcolor=white:fontsize=24:x=w-tw-24:y=h-40:box=1:boxcolor=black@0.7:boxborderw=8[l${i}]`
	ffmpeg(...strips.flatMap(([file]) => ["-i", file]), "-filter_complex", `${strips.map(([, text], i) => label(i, text)).join(";")};${strips.map((_, i) => `[l${i}]`).join("")}vstack=inputs=${strips.length}`, "-q:v", "3", join(dir, "top-bar.jpg"))
	// Where the expand key is: out of the bar, in the picture's bottom right corner. The whole TV per direction.
	const whole = []
	for (const design of ["cinema", "marquee", "glow"]) {
		const { ctx, page } = await open(DESKTOP, `design=${design}&chrome=off&bar=bottom`)
		await go(page, ["", "discover-cozy"])
		const b = await tvBox(page)
		const file = join(tmp, `${design}-bottom.png`)
		await page.screenshot({ path: file, clip: { x: b.x, y: b.y, width: Math.floor(b.width / 2) * 2, height: Math.floor(b.height / 2) * 2 } })
		whole.push([file, `${NAMES[design]}, Expand at the bottom right`])
		await ctx.close()
	}
	ffmpeg(...whole.flatMap(([file]) => ["-i", file]), "-filter_complex", `${whole.map(([, text], i) => label(i, text).replace("x=w-tw-24:y=h-40", "x=24:y=h-40")).join(";")};${whole.map((_, i) => `[l${i}]`).join("")}vstack=inputs=${whole.length}`, "-q:v", "3", join(dir, "expand-bottom.jpg"))
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
		// Along the apps and back, into Discover, around the moods, into the results, along the titles and on to the expand key.
		let firstMove = 0
		const frames = await record(page, tmp, async () => {
			await page.waitForTimeout(400)
			firstMove = Date.now() / 1000
			await press("ArrowRight", "ArrowRight", "ArrowRight", "ArrowLeft", "ArrowLeft", "Enter", "ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Enter", "ArrowRight", "ArrowRight")
			// On to the expand key in the bottom right corner: right as far as it goes, then down.
			const onExpand = () => page.evaluate(() => window.__tvDesign.state().endsWith("focus expand"))
			for (const key of ["ArrowRight", "ArrowRight", "ArrowDown", "ArrowDown", "ArrowRight", "ArrowDown"]) if (!(await onExpand())) await press(key)
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
if (!only || only === "touch") {
	// A finger pointing at the picture on a phone (390 x 844): a tap, and a long press that is dragged. The grey
	// disc is the finger; this script draws it, the prototype does not.
	const dir = join(here, "touch")
	const tmp = join(dir, "tmp")
	mkdirSync(dir, { recursive: true })
	const { ctx, page } = await open(PHONE, "design=cinema&chrome=off")
	const cdp = await ctx.newCDPSession(page)
	await page.evaluate(() => {
		const f = document.createElement("div")
		f.id = "finger"
		f.style.cssText = "position:fixed;left:0;top:0;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(200,205,215,.38);box-shadow:0 0 0 2px rgba(255,255,255,.55);z-index:9999;pointer-events:none;opacity:0;transition:opacity .12s"
		document.body.append(f)
	})
	const finger = (x, y, on) => page.evaluate(([x, y, on]) => { const f = document.getElementById("finger"); f.style.transform = `translate(${x}px, ${y}px)`; f.style.opacity = on ? "1" : "0" }, [x, y, on])
	const touch = async (type, x, y) => { await finger(x, y, type !== "touchEnd"); await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] }) }
	const mid = async (id) => { const b = await page.locator(`[data-tv-screen] [data-tv-item="${id}"]`).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2] }
	const strip = (files, out) => ffmpeg(...files.flatMap((f) => ["-i", f]), "-filter_complex", `hstack=inputs=${files.length}`, "-q:v", "4", out)
	const snap = async (file) => { await page.screenshot({ path: join(tmp, file), type: "jpeg", quality: 88 }); return join(tmp, file) }
	const clip = (out) => ffmpeg("-f", "concat", "-safe", "0", "-i", join(tmp, "list.txt"), "-vf", "fps=30,scale=390:-2", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out)

	// The tap, as a clip: the finger lands on Discover, lifts, Discover opens, the ring fades and the Remote settles.
	await go(page, ["", "home"])
	let [x, y] = await mid("app-discover")
	await record(page, tmp, async () => {
		await page.waitForTimeout(500)
		await touch("touchStart", x, y)
		await page.waitForTimeout(140)
		await touch("touchEnd", x, y)
		await page.waitForTimeout(1500)
	})
	clip(join(dir, "tap.mp4"))
	// The tap, as a strip: before; a fifth of a second after the finger landed (the ring where it landed, the Remote
	// on its way, the app opening; the finger is up again by then, its disc is left in for the picture); half a second
	// later; and at rest again.
	await go(page, ["", "home"])
	const tap = [await snap("t0.jpg")]
	await touch("touchStart", x, y)
	await page.waitForTimeout(90)
	await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
	await page.waitForTimeout(110)
	tap.push(await snap("t1.jpg"))
	await finger(x, y, false)
	await page.waitForTimeout(300)
	tap.push(await snap("t2.jpg"))
	await page.waitForTimeout(1400)
	tap.push(await snap("t3.jpg"))
	strip(tap, join(dir, "tap-strip.jpg"))

	// The long press: down under Funny, held until the ring comes out above the finger, dragged across the moods
	// to Dark, let go there.
	await go(page, ["", "discover"])
	;[x, y] = await mid("mood-funny")
	const [x2, y2] = await mid("mood-dark")
	const [x3, y3] = await mid("mood-thrilling")
	const drag = async (ax, ay, bx, by, steps = 14) => { for (let i = 1; i <= steps; i++) { await touch("touchMove", ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps); await page.waitForTimeout(34) } }
	const LIFT = 46
	await record(page, tmp, async () => {
		await page.waitForTimeout(400)
		await touch("touchStart", x, y + LIFT)
		await page.waitForTimeout(800)
		await drag(x, y + LIFT, x3, y3 + LIFT)
		await page.waitForTimeout(500)
		await drag(x3, y3 + LIFT, x2, y2 + LIFT)
		await page.waitForTimeout(600)
		await touch("touchEnd", x2, y2 + LIFT)
		await page.waitForTimeout(1500)
	})
	clip(join(dir, "hold.mp4"))
	// The strip: held, dragged to Thrilling, on to Dark, let go.
	await go(page, ["", "discover"])
	await touch("touchStart", x, y + LIFT)
	await page.waitForTimeout(800)
	const hold = [await snap("h0.jpg")]
	await drag(x, y + LIFT, x3, y3 + LIFT)
	await page.waitForTimeout(500)
	hold.push(await snap("h1.jpg"))
	await drag(x3, y3 + LIFT, x2, y2 + LIFT)
	await page.waitForTimeout(500)
	hold.push(await snap("h2.jpg"))
	await touch("touchEnd", x2, y2 + LIFT)
	await page.waitForTimeout(450)
	hold.push(await snap("h3.jpg"))
	strip(hold, join(dir, "hold-strip.jpg"))
	await ctx.close()
	rmSync(tmp, { recursive: true, force: true })
	console.log("touch")
}

await browser.close()
