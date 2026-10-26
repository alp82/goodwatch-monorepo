// PROTOTYPE: records a README scene from the local harness frame by frame and encodes a looping animated AVIF.
//
//   cd .github/readme
//   CHROMIUM_PATH=~/.cache/ms-playwright/chromium-1187/chrome-linux/chrome \
//   FRAMES=/some/scratch/dir node scenes/record.mjs <scene> <lengthMs> [fadeMs] [fps]
//
// Deterministic: every CSS animation on the page is paused and set to the frame's time before each screenshot, so
// the clip is smooth whatever the machine's speed. `fadeMs` > 0 crossfades the last fadeMs into the first frame,
// so a scene that ends on a different picture loops softly; 0 for scenes whose last frame is their first.
// Writes clips/<scene>.avif and <FRAMES>/<scene>/sheet.png (a contact sheet, one frame per second).
// Only for the local harness (goodwatch-webapp/app/ui/prototype-readme/run.sh, no production settings).
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright-core"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const [scene, lengthArg, fadeArg = "600", fpsArg = "30"] = process.argv.slice(2)
if (!scene || !lengthArg) {
	console.error("usage: node scenes/record.mjs <scene> <lengthMs> [fadeMs] [fps]")
	process.exit(1)
}
const LENGTH = Number(lengthArg)
const FADE = Number(fadeArg)
const FPS = Number(fpsArg)
const BASE = process.env.HARNESS ?? "http://127.0.0.1:3177"
const OUT = path.join(process.env.FRAMES ?? path.join(os.tmpdir(), "readme-scene-frames"), scene)
const CRF = process.env.CRF ?? "30"
const HOLD = Number(process.env.HOLD ?? 6)

const n = Math.round((LENGTH / 1000) * FPS)
// ENCODE_ONLY=1 re-encodes the frames of the last recording.
if (!process.env.ENCODE_ONLY) await capture()

async function capture() {
	fs.rmSync(OUT, { recursive: true, force: true })
	fs.mkdirSync(OUT, { recursive: true })

	const browser = await chromium.launch({
		executablePath:
			process.env.CHROMIUM_PATH ?? path.join(os.homedir(), ".cache/ms-playwright/chromium-1187/chrome-linux/chrome"),
	})
	const page = await browser.newPage({ viewport: { width: 1440, height: 770 }, deviceScaleFactor: 1 })
	await page.goto(`${BASE}/prototype/readme/${scene}`, { waitUntil: "networkidle", timeout: 120000 })
	await page.waitForSelector("#readme-scene .film-stage > *", { timeout: 60000 })
	await page.addStyleTag({ content: "html{scrollbar-width:none!important;scrollbar-gutter:auto!important}" })
	// Every image loaded and decoded, every font ready, before the first frame.
	await page.evaluate(async () => {
		await document.fonts.ready
		const imgs = [...document.images]
		await Promise.all(
			imgs.map((i) =>
				i.complete
					? null
					: new Promise(
							(r) => i.addEventListener("load", r, { once: true }) || i.addEventListener("error", r, { once: true }),
						),
			),
		)
		await Promise.all(imgs.map((i) => i.decode().catch(() => {})))
	})
	// Let every animation run out in real time first: pausing one while the compositor runs it can leave a stale
	// value on screen (a half-faded letter). Then seek everything to the end and back so each value is pushed again.
	await page.waitForTimeout(LENGTH + 500)
	await page.evaluate(
		(ms) =>
			new Promise((resolve) => {
				for (const a of document.getAnimations()) {
					a.pause()
					a.currentTime = ms
				}
				requestAnimationFrame(() => requestAnimationFrame(resolve))
			}),
		LENGTH,
	)
	const broken = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src))
	if (broken.length) console.warn("images that did not load:", broken)

	const t0 = Date.now()
	for (let i = 0; i < n; i++) {
		const t = (i * 1000) / FPS
		await page.evaluate(
			(ms) =>
				new Promise((resolve) => {
					for (const a of document.getAnimations()) {
						a.pause()
						a.currentTime = ms
					}
					requestAnimationFrame(() => requestAnimationFrame(resolve))
				}),
			t,
		)
		await page.screenshot({
			path: path.join(OUT, `f${String(i).padStart(4, "0")}.png`),
			clip: { x: 0, y: 0, width: 1440, height: 770 },
		})
	}
	await browser.close()
	console.log(`${scene}: ${n} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`)
}

const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" })
const seq = ["-framerate", String(FPS), "-i", path.join(OUT, "f%04d.png")]
const avif = path.join(HERE, "..", "clips", `${scene}.avif`)
const enc = [
	"-c:v",
	"libaom-av1",
	"-crf",
	CRF,
	"-cpu-used",
	"4",
	"-pix_fmt",
	"yuv420p",
	"-f",
	"avif",
	"-loop",
	"0",
	avif,
]
// The loop is rendered to PNGs first, so it can start anywhere: START_MS rotates it (for example to open on the
// finished conversation, which is also the picture a viewer sees before the animation plays).
const LOOP = path.join(OUT, "loop")
fs.rmSync(LOOP, { recursive: true, force: true })
fs.mkdirSync(LOOP)
if (FADE > 0) {
	// The tail crossfades into the first frame and holds it for HOLD frames, so the encoder has settled on the
	// clean first picture before the loop starts again; the output keeps the same length.
	const offset = (LENGTH - FADE) / 1000
	const span = Math.max(1, Math.round((FADE / 1000) * FPS) - HOLD)
	const w = `min(1,(N+1)/${span})`
	ff([
		...seq,
		"-loop",
		"1",
		"-framerate",
		String(FPS),
		"-t",
		String(FADE / 1000),
		"-i",
		path.join(OUT, "f0000.png"),
		"-filter_complex",
		`[0:v]trim=end=${offset},setpts=PTS-STARTPTS[a];[0:v]trim=start=${offset},setpts=PTS-STARTPTS[t];[t][1:v]blend=all_expr='A*(1-${w})+B*${w}'[b];[a][b]concat=n=2:v=1[v]`,
		"-map",
		"[v]",
		path.join(LOOP, "%04d.png"),
	])
} else ff([...seq, path.join(LOOP, "%04d.png")])
{
	const files = fs.readdirSync(LOOP).sort()
	const k = Math.round((Number(process.env.START_MS ?? 0) / 1000) * FPS) % files.length
	const rot = path.join(OUT, "rot")
	fs.rmSync(rot, { recursive: true, force: true })
	fs.mkdirSync(rot)
	files.forEach((_, i) => fs.copyFileSync(path.join(LOOP, files[(i + k) % files.length]), path.join(rot, `${String(i).padStart(4, "0")}.png`)))
	ff(["-framerate", String(FPS), "-i", path.join(rot, "%04d.png"), ...enc])
}
// One frame per second, for checking.
ff([
	"-framerate",
	String(FPS),
	"-i",
	path.join(OUT, "f%04d.png"),
	"-vf",
	`select='not(mod(n\\,${FPS}))',scale=480:-1,tile=4x${Math.ceil(n / FPS / 4)}`,
	"-frames:v",
	"1",
	path.join(OUT, "sheet.png"),
])
console.log(
	`${path.relative(process.cwd(), avif)}  ${(fs.statSync(avif).size / 1024).toFixed(0)} KB  ${(LENGTH / 1000).toFixed(1)} s`,
)
