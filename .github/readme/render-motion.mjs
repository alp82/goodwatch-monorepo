// Renders banner-motion.html frame by frame into banner.avif, the README's animated banner.
// Usage: CHROMIUM_PATH=... node render-motion.mjs [seconds] [fps] [scale] [crf]   (defaults: 26 30 1.25 34)
// The last second blends into the first frames, so the loop has no visible jump. Needs ffmpeg (libaom-av1) and
// ImageMagick (`magick`). Frames go to FRAMES_DIR (default .frames next to this file, git-ignored).
import { execFileSync } from "node:child_process"
import { mkdirSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright-core"

const here = dirname(fileURLToPath(import.meta.url))
const [secs = "26", fpsArg = "30", scaleArg = "1.25", q = "34"] = process.argv.slice(2)
const T = Number(secs), fps = Number(fpsArg), scale = Number(scaleArg)
const n = Math.round(T * fps), tail = fps // one second crossfade
const out = process.env.FRAMES_DIR || join(here, ".frames")
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const page = await browser.newPage({ deviceScaleFactor: scale, viewport: { width: 1280, height: 400 } })
await page.goto(`file://${join(here, "banner-motion.html")}?T=${T}`)
await page.evaluate(() => window.preload())
await page.evaluate(() => document.fonts.ready)
const card = page.locator("#card")
for (let i = 0; i < n + tail; i++) {
	await page.evaluate((t) => window.renderAt(t), i / fps)
	await page.evaluate(() => Promise.all([...document.images].filter((im) => !im.complete).map((im) => im.decode().catch(() => {}))))
	await card.screenshot({ path: join(out, `f${String(i).padStart(4, "0")}.png`) })
}
await browser.close()

// Blend the tail (frames n..n+tail) over the head, so frame n-1 flows into frame 0.
for (let i = 0; i < tail; i++) {
	const head = join(out, `f${String(i).padStart(4, "0")}.png`)
	const end = join(out, `f${String(n + i).padStart(4, "0")}.png`)
	const w = Math.round((i / tail) * 100)
	execFileSync("magick", [end, head, "-compose", "blend", "-define", `compose:args=${w}`, "-composite", head])
	rmSync(end)
}
const file = join(here, "banner.avif")
// AVIF (AV1) keeps the drifting wall around half a megabyte; animated WebP of the same frames is over 9 MB.
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", join(out, "f%04d.png"), "-c:v", "libaom-av1", "-crf", q, "-cpu-used", "4", "-pix_fmt", "yuv420p", "-f", "avif", "-loop", "0", file])
console.log("wrote", file)
