// PROTOTYPE: records the README taste loop (/prototype/readme/taste) frame by frame and encodes clips/taste.avif.
//   CHROMIUM_PATH=~/.cache/ms-playwright/chromium-1187/chrome-linux/chrome OUT=/scratch/dir node scenes/taste-record.mjs [stills ms,ms,...]
// Every animation is paused and set to frame/fps, so the frames are exact and the loop closes (frame N = frame 0).
// Needs the local harness on 127.0.0.1:3177 (goodwatch-webapp/app/ui/prototype-readme/run.sh, no production settings).
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright-core"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = process.env.OUT ?? path.join(HERE, ".frames-taste")
const LOOP_MS = 18000
const FPS = Number(process.env.FPS ?? 30)
const [mode, list] = process.argv.slice(2)

fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const p = await b.newPage({ viewport: { width: 1440, height: 770 }, deviceScaleFactor: 1 })
// Other agents edit the same worktree: a dead WebSocket keeps Vite's HMR from reloading the page mid-recording.
await p.addInitScript(() => {
	window.WebSocket = class {
		readyState = 0
		addEventListener() {}
		removeEventListener() {}
		send() {}
		close() {}
	}
})
await p.goto("http://127.0.0.1:3177/prototype/readme/taste", { waitUntil: "networkidle", timeout: 120000 })
await p.addStyleTag({ content: "html{scrollbar-width:none!important;scrollbar-gutter:auto!important}" })
await p.waitForFunction(() => {
	const imgs = [...document.querySelectorAll("#readme-scene img")]
	return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0)
}, null, { timeout: 60000 })
await p.evaluate(() => Promise.all([...document.querySelectorAll("#readme-scene img")].map((i) => i.decode())))
const seek = (t) =>
	p.evaluate((t) => {
		for (const a of document.getAnimations()) {
			a.pause()
			a.currentTime = t
		}
	}, t)
const shot = async (t, file) => {
	await seek(t)
	await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
	await p.screenshot({ path: file, clip: { x: 0, y: 0, width: 1440, height: 770 } })
}
if (mode === "stills") {
	for (const t of list.split(",").map(Number)) await shot(t, path.join(OUT, `still-${t}.png`))
} else {
	const n = Math.round((LOOP_MS / 1000) * FPS)
	for (let i = 0; i < n; i++) await shot((i * 1000) / FPS, path.join(OUT, `f${String(i).padStart(4, "0")}.png`))
	const dest = path.join(HERE, "..", "clips", "taste.avif")
	execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(OUT, "f%04d.png"),
		"-c:v", "libaom-av1", "-crf", process.env.CRF ?? "34", "-cpu-used", "4", "-pix_fmt", "yuv420p", "-f", "avif", "-loop", "0", dest], { stdio: "inherit" })
	console.log(dest, fs.statSync(dest).size, "bytes,", n, "frames")
}
await b.close()
