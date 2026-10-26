// Records the README's feature clips from the live site (https://goodwatch.app, signed out, read-only) and encodes
// them to looping animated WebP next to this file.
//
//   cd .github/readme && npm install
//   CHROMIUM_PATH=~/.cache/ms-playwright/chromium-1187/chrome-linux/chrome \
//   CLIPS_RAW=/some/scratch/dir node clips/record.mjs [intro] [hiw] [encode]   (no phase = all three)
//
// - intro: the start page's TV film. For each chapter it clicks the chapter bar once to warm its images, waits 5 s,
//   clicks again and records it in real time with CDP Page.startScreencast (JPEG frames + timestamps).
// - hiw: the /how-it-works pictures. A first page scrolls through to warm the cache; a second page scrolls each
//   picture into view (they rise in once, on first view) and records it.
// - encode: cuts each clip from its recording (CLIPS below), crops to the TV picture / picture box, crossfades the
//   tail into the head so the loop is soft, renders PNG frames with ffmpeg and writes <name>.webp with Python Pillow
//   (python3 with Pillow 10+ needed). `encode score reel` re-encodes only those; `intro filters` re-records one chapter.
//
// Raw frames go to CLIPS_RAW (default: <os tmpdir>/goodwatch-readme-clips). Never point this at a local webapp
// started with the production .env: it only reads the public site.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright-core"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const RAW = process.env.CLIPS_RAW ?? path.join(os.tmpdir(), "goodwatch-readme-clips")
const SITE = process.env.SITE ?? "https://goodwatch.app"
const VIEWPORT = { width: 1440, height: 900 }
const SCALE = Number(process.env.SCALE ?? 1)

// Chapter bar order (app/ui/living-room/intro/scene.ts CHAPTERS).
const CHAPTERS = [
	"opener",
	"score",
	"streaming",
	"recommendations",
	"fingerprint",
	"search",
	"filters",
	"tracking",
	"imports",
	"ai",
	"discord",
]
// How long to record from the click, in s (each chapter's length plus its hand-over).
const CHAPTER_REC_S = 12

// Hides the film's controls and the Remote so the picture is clean.
const INTRO_CSS = `
.film-chapters, .film-skip, .film-fast { visibility: hidden !important; }
.remote-body { visibility: hidden !important; }
/* The Feedback tab (ui/feedback/FeedbackTab.tsx) overlaps the picture's right edge. */
button.group.fixed.right-0 { visibility: hidden !important; }
`

/**
 * The clips. `src` is a recording (intro/<chapter> or hiw/<picture>); `from` and `dur` are seconds from the click
 * (intro) or from the scroll into view (hiw); `fade` is the tail-into-head crossfade.
 */
const CLIPS = [
	// Five opinions fold into one score ring. The next chapter takes over 5.1 s after the click.
	{ name: "score", src: "intro/score", from: 0.3, dur: 4.4 },
	// Every service: logos multiply into "325 services in 139 countries", then "In your country".
	{ name: "streaming", src: "intro/streaming", from: 0.6, dur: 6.4, fps: 15, quality: 60 },
	// A poster wall dims down to one pick: Severance, 90% match. Hand-over at 5.3 s.
	{ name: "for-you", src: "intro/recommendations", from: 0.3, dur: 4.5 },
	// The taste fingerprint draws, its traits list, then the dials tune the picks. Hand-over at 6.6 s.
	{ name: "taste", src: "intro/fingerprint", from: 0.3, dur: 5.7, fps: 15, quality: 54 },
	// Typing "a mind-blowing space adventure", read as moods, Interstellar on top. Hand-over at 5.2 s.
	{ name: "search", src: "intro/search", from: 0.3, dur: 4.3 },
	// Filters switch on one by one as the catalog count falls. Hand-over at 7.9 s.
	{ name: "discover", src: "intro/filters", from: 0.3, dur: 7.0, fps: 15, quality: 54 },
	// The /how-it-works explorer picture rising in (no intro chapter shows the explorer): the islands land in 0.8 s,
	// then it holds. The screencast's first frame is the page before the scroll, so start a little in.
	{ name: "explorer", src: "hiw/explorer", from: 0.15, dur: 2.6, fade: 0.5 },
	// Hand-over at 5.4 s.
	{ name: "tracking", src: "intro/tracking", from: 0.3, dur: 4.5 },
	// Hand-over at 6.3 s.
	{ name: "imports", src: "intro/imports", from: 0.3, dur: 5.3 },
	// A ChatGPT chat calling GoodWatch, then the prompt chips. The chapter runs past 12 s.
	{ name: "ai", src: "intro/ai", from: 0.3, dur: 8.0 },
	// The quiz takes over at 6.4 s.
	{ name: "discord", src: "intro/discord", from: 0.3, dur: 5.5 },
].map((clip) => ({ width: 800, ...clip }))
// The highlight reel: parts of several chapters, joined with short crossfades.
const REEL = {
	name: "reel",
	width: 880,
	fps: 15,
	quality: 50,
	parts: [
		{ src: "intro/score", from: 1.6, dur: 2.5 },
		{ src: "intro/streaming", from: 2.6, dur: 2.5 },
		{ src: "intro/recommendations", from: 1.8, dur: 2.5 },
		{ src: "intro/fingerprint", from: 3.4, dur: 2.5 },
		{ src: "intro/search", from: 0.6, dur: 2.5 },
		{ src: "intro/filters", from: 1.2, dur: 2.5 },
		{ src: "intro/discord", from: 3.0, dur: 2.5 },
	],
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function launch() {
	const executablePath =
		process.env.CHROMIUM_PATH ??
		path.join(os.homedir(), ".cache/ms-playwright/chromium-1187/chrome-linux/chrome")
	const browser = await chromium.launch({ executablePath })
	const context = await browser.newContext({
		viewport: VIEWPORT,
		deviceScaleFactor: SCALE,
		locale: "en-US",
		timezoneId: "America/New_York",
		colorScheme: "dark",
	})
	return { browser, context }
}

/** Records the page in real time until `stop()`; frames land in `dir` with their timestamps in frames.json. */
async function screencast(page, dir) {
	fs.rmSync(dir, { recursive: true, force: true })
	fs.mkdirSync(dir, { recursive: true })
	const cdp = await page.context().newCDPSession(page)
	const frames = []
	const writes = []
	cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
		const file = `${String(frames.length).padStart(5, "0")}.jpg`
		frames.push({ file, t: metadata.timestamp })
		writes.push(fs.promises.writeFile(path.join(dir, file), Buffer.from(data, "base64")))
		cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {})
	})
	await cdp.send("Page.startScreencast", {
		format: "jpeg",
		quality: 92,
		maxWidth: Math.round(VIEWPORT.width * SCALE),
		maxHeight: Math.round(VIEWPORT.height * SCALE),
		everyNthFrame: 1,
	})
	return async (meta) => {
		await cdp.send("Page.stopScreencast")
		await Promise.all(writes)
		fs.writeFileSync(path.join(dir, "frames.json"), JSON.stringify({ ...meta, frames }, null, 1))
		await cdp.detach()
		return frames.length
	}
}

const rectOf = (page, selector) =>
	page.evaluate((s) => {
		const r = document.querySelector(s).getBoundingClientRect()
		return { x: r.x, y: r.y, w: r.width, h: r.height }
	}, selector)

async function recordIntro(only) {
	const { browser, context } = await launch()
	const page = await context.newPage()
	const open = async () => {
		for (let attempt = 1; ; attempt++) {
			try {
				// The tab keeps the film's progress (sessionStorage): forget it so the film plays again.
				if (page.url().startsWith(SITE)) await page.evaluate(() => sessionStorage.clear())
				await page.goto(`${SITE}/`, { waitUntil: "domcontentloaded" })
				await page.waitForSelector(".film-chapters button", { state: "attached", timeout: 20000 })
				// Only after hydration: an extra node in the head before it can break the page.
				await page.addStyleTag({ content: INTRO_CSS })
				break
			} catch (error) {
				// The TV shows its home instead when the film's code or data is slow: try again.
				if (attempt === 3) throw error
				console.log(`the film didn't start, attempt ${attempt}`)
				await page.screenshot({ path: path.join(RAW, `fail-${attempt}.png`) })
			}
		}
		await sleep(1500)
	}
	await open()
	const crop = await rectOf(page, ".film-stage")
	const click = async (i) => {
		// Once the film reaches the quiz the chapter bar goes: open the page again.
		if (!(await page.$(".film-chapters button"))) await open()
		await page.evaluate((n) => document.querySelectorAll(".film-chapters button")[n].click(), i)
	}
	for (const [i, chapter] of CHAPTERS.entries()) {
		if (only.length && !only.includes(chapter)) continue
		// Warm: play the chapter once so its images are cached and decoded.
		await click(i)
		await sleep(5000)
		const stop = await screencast(page, path.join(RAW, "intro", chapter))
		await sleep(400)
		const clickT = Date.now() / 1000
		await click(i)
		// Log when the picture's scenes change, to find where the next chapter takes over.
		await page.evaluate(() => {
			window.__scenes = []
			let last = ""
			window.__scenesTimer = setInterval(() => {
				const now = [...document.querySelectorAll(".film-slot[data-scene]")].map((e) => e.dataset.scene).join(",")
				if (now !== last) window.__scenes.push({ t: Date.now() / 1000, scenes: now })
				last = now
			}, 20)
		})
		await sleep(CHAPTER_REC_S * 1000)
		const scenes = await page.evaluate(() => {
			clearInterval(window.__scenesTimer)
			return window.__scenes
		})
		const n = await stop({ clickT, crop, scale: SCALE, scenes })
		console.log(`intro/${chapter}: ${n} frames`)
	}
	await browser.close()
}

async function recordHiw(only) {
	const { browser, context } = await launch()
	// Warm the cache: scroll through every picture once.
	const warm = await context.newPage()
	await warm.goto(`${SITE}/how-it-works`, { waitUntil: "networkidle" })
	const ids = await warm.evaluate(() => [...document.querySelectorAll("ol > li[id]")].map((li) => li.id))
	for (const id of ids) {
		await warm.evaluate((x) => document.getElementById(x).scrollIntoView({ block: "center" }), id)
		await sleep(1500)
	}
	await warm.close()
	const page = await context.newPage()
	await page.goto(`${SITE}/how-it-works`, { waitUntil: "networkidle" })
	await sleep(1000)
	for (const id of ids) {
		if (only.length && !only.includes(id)) continue
		const box = `[id="${id}"] .hiw-pic-host, [id="${id}"] .mt-6 > *`
		// Put the picture box in the middle of the screen without crossing it first.
		await page.evaluate((s) => {
			const el = document.querySelector(s)
			const r = el.getBoundingClientRect()
			window.scrollTo({ top: window.scrollY + r.top + r.height / 2 - innerHeight / 2, behavior: "instant" })
		}, box)
		// The scroll above passed earlier boxes on the way only in one jump, so nothing else mounted mid-record.
		const stop = await screencast(page, path.join(RAW, "hiw", id))
		const clickT = Date.now() / 1000
		await sleep(id === "title-analysis" || id === "discord" ? 9000 : 5000)
		const crop = await rectOf(page, box)
		const n = await stop({ clickT, crop, scale: SCALE })
		console.log(`hiw/${id}: ${n} frames`)
	}
	await browser.close()
}

/** An ffmpeg concat list that replays the recording's frames with their real timings, from `from` s after the click. */
function concatList(src, from, dur) {
	const dir = path.join(RAW, src)
	const meta = JSON.parse(fs.readFileSync(path.join(dir, "frames.json"), "utf8"))
	const t0 = meta.clickT + from
	const lines = []
	const f = meta.frames
	// The frame on screen at t0, then every frame until t0 + dur.
	let start = f.findIndex((x) => x.t > t0) - 1
	if (start < 0) start = 0
	for (let i = start; i < f.length; i++) {
		const a = Math.max(f[i].t, t0)
		// The screencast only sends a frame when the page changes: the last one holds to the end.
		const b = i + 1 < f.length ? f[i + 1].t : Number.POSITIVE_INFINITY
		if (a >= t0 + dur) break
		const d = Math.min(b, t0 + dur) - a
		if (d <= 0) continue
		lines.push(`file '${path.join(dir, f[i].file)}'`, `duration ${d.toFixed(4)}`)
	}
	lines.push(lines.at(-2)) // the concat demuxer drops the last duration
	const list = path.join(dir, `list-${from}-${dur}.txt`)
	fs.writeFileSync(list, lines.join("\n"))
	// Crop in frame pixels; an 8 px inset drops the bezel's glow.
	const c = meta.crop
	// Screencast frames come at the viewport's CSS size in headless Chrome, whatever the device scale.
	const frameW = Number(
		execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=width", "-of", "csv=p=0", path.join(dir, f[0].file)])
			.toString()
			.trim(),
	)
	const s = frameW / VIEWPORT.width
	const inset = 8
	const crop = [c.w - 2 * inset, c.h - 2 * inset, c.x + inset, c.y + inset].map((v) => Math.round(v * s))
	return { list, crop }
}

function ffmpeg(args) {
	execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" })
}

// ffmpeg renders PNG frames; Pillow writes the WebP. ffmpeg's libwebp_anim can't cap the keyframe distance, and
// libwebp's lossy sub-frames treat "nearly the same" pixels as unchanged, so slow crossfades and push-ins left stale
// blocks of the previous picture. A keyframe every KMAX frames bounds that.
const KMAX = Number(process.env.KMAX ?? 6)
const PILLOW = `
import sys, glob
from PIL import Image
src, out, fps, q, kmax = sys.argv[1], sys.argv[2], float(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
files = sorted(glob.glob(src + "/*.png"))
frames = [Image.open(f).convert("RGB") for f in files]
frames[0].save(out, save_all=True, append_images=frames[1:], duration=round(1000 / fps), loop=0,
	quality=q, method=5, kmin=max(1, kmax - 1), kmax=kmax, allow_mixed=False, minimize_size=False)
`
function writeWebp(ffmpegArgs, out, fps, quality) {
	const frames = path.join(RAW, "frames", path.basename(out, ".webp"))
	fs.rmSync(frames, { recursive: true, force: true })
	fs.mkdirSync(frames, { recursive: true })
	ffmpeg([...ffmpegArgs, "-r", String(fps), path.join(frames, "%05d.png")])
	execFileSync("python3", ["-c", PILLOW, frames, out, String(fps), String(quality), String(KMAX)], { stdio: "inherit" })
}

function encodeClip({ name, src, from, dur, width, fps = 18, quality = 70, fade = 0.6 }) {
	// Record `fade` s more than the loop's length: the extra tail crossfades into the head.
	const { list, crop } = concatList(src, from, dur + fade)
	const [w, h, x, y] = crop
	const graph = [
		`[0:v]crop=${w}:${h}:${x}:${y},scale=${width}:-2:flags=lanczos,fps=${fps},split[a][b]`,
		`[a]trim=start=${fade}:end=${dur + fade},setpts=PTS-STARTPTS[body]`,
		`[b]trim=start=0:end=${fade},setpts=PTS-STARTPTS[head]`,
		`[body][head]xfade=transition=fade:duration=${fade}:offset=${dur - fade}[v]`,
	].join(";")
	const out = path.join(HERE, `${name}.webp`)
	writeWebp(["-f", "concat", "-safe", "0", "-i", list, "-filter_complex", graph, "-map", "[v]"], out, fps, quality)
	console.log(`${name}.webp  ${(fs.statSync(out).size / 1024).toFixed(0)} KB  ${dur}s`)
}

function encodeReel({ name, width, fps, quality, parts }) {
	const xf = 0.5
	const inputs = []
	const graph = []
	parts.forEach((p, i) => {
		const { list, crop } = concatList(p.src, p.from, p.dur + xf)
		const [w, h, x, y] = crop
		inputs.push("-f", "concat", "-safe", "0", "-i", list)
		graph.push(
			`[${i}:v]crop=${w}:${h}:${x}:${y},scale=${width}:-2:flags=lanczos,fps=${fps},setsar=1,trim=end=${p.dur + xf},setpts=PTS-STARTPTS[p${i}]`,
		)
	})
	// Chain the parts with crossfades, then fade the end into the first part's head for the loop.
	let last = "p0"
	let length = parts[0].dur + xf
	for (let i = 1; i < parts.length; i++) {
		graph.push(`[${last}][p${i}]xfade=transition=fade:duration=${xf}:offset=${(length - xf).toFixed(3)}[x${i}]`)
		last = `x${i}`
		length += parts[i].dur
	}
	// length is now the chain's length; the loop: drop the head's first xf s and fade the tail into it.
	graph.push(`[${last}]split[c1][c2]`)
	graph.push(`[c1]trim=start=${xf},setpts=PTS-STARTPTS[body]`)
	graph.push(`[c2]trim=end=${xf},setpts=PTS-STARTPTS[head]`)
	graph.push(`[body][head]xfade=transition=fade:duration=${xf}:offset=${(length - 2 * xf).toFixed(3)}[v]`)
	const out = path.join(HERE, `${name}.webp`)
	writeWebp([...inputs, "-filter_complex", graph.join(";"), "-map", "[v]"], out, fps, quality)
	console.log(`${name}.webp  ${(fs.statSync(out).size / 1024).toFixed(0)} KB  ${(length - xf).toFixed(1)}s`)
}

// PROTOTYPE "pulse" cut: each clip rests on a still and plays only its essence once per CYCLE s. Slot "a" moves early
// in the cycle and slot "b" half a cycle later, so neighboring sections in the README take turns. `at`/`len` are in
// the encoded clip's time (the contact sheets), still = the essence's last frame. `still: true` is a single picture.
const CYCLE = 16
const PULSE_FPS = 20
const LEAD = 0.5 // crossfade from the still into the essence's first frame
const PULSE = [
	{ name: "score", at: 0.3, len: 3.4, slot: "a" },
	{ name: "streaming", at: 0.3, len: 2.6, slot: "b" },
	{ name: "for-you", at: 0.7, len: 3.2, slot: "a" },
	{ name: "taste", at: 2.9, len: 2.4, slot: "b" },
	{ name: "search", at: 0.0, len: 3.6, slot: "a" },
	{ name: "discover", at: 2.6, len: 3.1, slot: "b" },
	{ name: "explorer", at: 1.3, still: true },
	{ name: "tracking", at: 0.3, len: 3.7, slot: "a" },
	{ name: "imports", at: 0.3, len: 4.5, slot: "b" },
	{ name: "ai", at: 0.0, len: 2.05, slot: "a" },
	{ name: "discord", at: 1.0, len: 3.6, slot: "b" },
]

function encodePulse({ name, at, len = 0, slot, still }) {
	const clip = CLIPS.find((c) => c.name === name)
	const raw = clip.from + (clip.fade ?? 0.6) + at
	const dir = path.join(RAW, "pulse", name)
	fs.rmSync(dir, { recursive: true, force: true })
	fs.mkdirSync(dir, { recursive: true })
	const { list, crop } = concatList(clip.src, raw, Math.max(len, 0.2) + 0.1)
	const [w, h, x, y] = crop
	ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-vf", `crop=${w}:${h}:${x}:${y},scale=${still ? w : clip.width}:-2:flags=lanczos,fps=${PULSE_FPS}`, path.join(dir, "e%04d.png")])
	const essence = fs.readdirSync(dir).filter((f) => f.startsWith("e")).sort().slice(0, still ? 1 : Math.round(len * PULSE_FPS))
	const last = path.join(dir, essence.at(-1))
	const out = path.join(HERE, `${name}.avif`)
	if (still) {
		ffmpeg(["-i", last, "-c:v", "libaom-av1", "-crf", "22", "-still-picture", "1", "-pix_fmt", "yuv420p", out])
		console.log(`${name}.avif  ${(fs.statSync(out).size / 1024).toFixed(0)} KB  still`)
		return
	}
	// The cycle: still, LEAD crossfade into the first essence frame, the essence, then still again.
	const total = CYCLE * PULSE_FPS
	const start = Math.round((slot === "a" ? 1 : 1 + CYCLE / 2) * PULSE_FPS)
	const lead = Math.round(LEAD * PULSE_FPS)
	const frames = []
	for (let i = 0; i < total; i++) {
		const k = i - start
		if (k >= 0 && k < essence.length) frames.push(path.join(dir, essence[k]))
		else if (k < 0 && k >= -lead) {
			const blend = path.join(dir, `x${String(k + lead).padStart(3, "0")}.png`)
			const wgt = Math.round(((k + lead + 1) / (lead + 1)) * 100)
			execFileSync("magick", [last, path.join(dir, essence[0]), "-compose", "blend", "-define", `compose:args=${wgt}`, "-composite", blend])
			frames.push(blend)
		} else frames.push(last)
	}
	const seq = path.join(dir, "seq")
	fs.mkdirSync(seq)
	frames.forEach((f, i) => fs.copyFileSync(f, path.join(seq, `${String(i).padStart(4, "0")}.png`)))
	ffmpeg(["-framerate", String(PULSE_FPS), "-i", path.join(seq, "%04d.png"), "-c:v", "libaom-av1", "-crf", "34", "-cpu-used", "4", "-pix_fmt", "yuv420p", "-f", "avif", "-loop", "0", out])
	console.log(`${name}.avif  ${(fs.statSync(out).size / 1024).toFixed(0)} KB  moves ${len}s of ${CYCLE}s (slot ${slot})`)
}

const args = process.argv.slice(2)
const phases = args.filter((a) => ["intro", "hiw", "encode", "pulse", "stills"].includes(a))
const only = args.filter((a) => !phases.includes(a))
const run = (p) => (phases.length === 0 && !["pulse", "stills"].includes(p)) || phases.includes(p)
if (run("intro")) await recordIntro(only)
if (run("hiw")) await recordHiw(only)
if (run("encode")) {
	for (const clip of CLIPS) if (!only.length || only.includes(clip.name)) encodeClip(clip)
	if (!only.length || only.includes("reel")) encodeReel(REEL)
}
// Stills: the frame each pulse rests on (the essence's last frame), as a single AVIF picture.
if (phases.includes("stills"))
	for (const p of PULSE)
		if (!only.length || only.includes(p.name)) encodePulse(p.still ? p : { name: p.name, at: p.at + p.len - 1 / PULSE_FPS, still: true })
if (phases.includes("pulse")) for (const p of PULSE) if (!only.length || only.includes(p.name)) encodePulse(p)
