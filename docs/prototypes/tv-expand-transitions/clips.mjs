// Records one clip (mp4) and two six-frame strips (the way out, the way back) of a transition of
// /prototype/tv-expand. No browser driver is in the repository: install playwright-core in a scratch folder and
// pass its path.
//   PLAYWRIGHT=/scratch/node_modules/playwright-core node clips.mjs <transition> [desktop|phone] [results|title] [extra query]
// BASE is the dev server (http://localhost:3157), OUT the folder to write into (this one).
import { execSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")
const [t = "frame", device = "desktop", screen = "results", extra = ""] = process.argv.slice(2)
const base = process.env.BASE ?? "http://localhost:3157"
const out = process.env.OUT ?? dirname(fileURLToPath(import.meta.url))
const ORDER = ["today", "grow", "frame", "morph", "camera", "live", "wipe", "lean", "leanlite"]
const phone = device === "phone"
const size = phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }
const name = `${ORDER.indexOf(t) + 1}-${t}-${device}${screen === "title" ? "-title" : ""}${extra.replace(/[^a-z0-9]/g, "")}`
const work = mkdtempSync(join(tmpdir(), "tvx-"))
mkdirSync(join(out, "clips"), { recursive: true })
mkdirSync(join(out, "strips"), { recursive: true })

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--use-angle=gl", "--ignore-gpu-blocklist"] })
const at = screen === "title" ? "home.discover.discover-funny.title-knives-out" : "home.discover.discover-funny"
const url = `${base}/prototype/tv-expand?t=${t}&at=${at}&f=expand${extra}`
// Once without recording: the dev server's first answer and the posters are in the cache afterwards.
const warm = await browser.newContext({ viewport: size, ...(phone ? { isMobile: true, hasTouch: true } : {}) })
const context = await browser.newContext({ viewport: size, recordVideo: { dir: work, size }, ...(phone ? { isMobile: true, hasTouch: true } : {}) })
const page = await context.newPage()
const t0 = Date.now()
const now = () => (Date.now() - t0) / 1000
await warm.close()
await page.goto(url, { waitUntil: "load", timeout: 120000 })
await page.waitForSelector("[data-tv-screen] [data-tv-item=expand]", { timeout: 60000 })
await page.waitForTimeout(2500)
// Live page: the real page is loading in the TV while the key has the focus.
if (t === "live" || t === "lean") await page.waitForFunction(() => document.querySelector('iframe[title="The real page"]')?.contentDocument?.querySelectorAll("img").length > 6, null, { timeout: 30000 }).catch(() => {})
if (t === "live" || t === "lean") await page.waitForTimeout(1500)
const calm = () => !document.documentElement.dataset.tvx && !document.documentElement.dataset.tvTransition
const idle = () => !document.documentElement.dataset.tvx && !document.documentElement.dataset.tvTransition && !document.querySelector('iframe[title="The real page"]')
// When the transition's own animation begins. Before it the person waits for the page's data, and the browser
// stands still while the next page is built. "New", "Live page" and "Lean in" begin in the room, at the press.
const moving = () => document.getAnimations().some((a) => (a.effect?.pseudoElement ?? "").startsWith("::view-transition"))
const inRoom = t === "grow" || t === "live" || t === "lean"
const pressed = now()
await page.keyboard.press("Enter")
if (!inRoom) await page.waitForFunction(moving, null, { timeout: 30000, polling: "raf" }).catch(() => {})
const outBegan = inRoom ? pressed : now()
// The router changes the address a moment before it starts the transition, so the address alone says nothing:
// the room is gone once the page has been swapped, and the marks are gone once the animation has ended.
await page.waitForFunction(`!document.querySelector("[data-tv-screen]") && (${idle})()`, null, { timeout: 30000 })
const arrived = now()
await page.waitForTimeout(1800)
const turned = now()
await page.evaluate(() => window.history.back())
await page.waitForFunction(moving, null, { timeout: 30000, polling: "raf" }).catch(() => {})
const backBegan = now()
// Back in the room the Live page starts loading in the TV again, so its frame is no sign of a run here.
await page.waitForFunction(`document.querySelector("[data-tv-screen]") && (${calm})() && window.__tvx?.state().run === null`, null, { timeout: 30000 })
const home = now()
await page.waitForTimeout(1100)
const state = await page.evaluate(() => window.__tvx.state())
const end = now()
await context.close()
await browser.close()

const video = join(work, readdirSync(work).find((f) => f.endsWith(".webm")))
// The recording starts with the page's first picture, a little after the script's clock: it ends when the script
// ends, so the difference of the two lengths is how far every time has to move.
const length = Number(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${video}`).toString())
const late = Math.max(0, end - length)
const from = Math.max(0, pressed - late - 0.9)
const run = (cmd) => execSync(cmd, { stdio: ["ignore", "ignore", "inherit"] })
run(`ffmpeg -loglevel error -y -ss ${from.toFixed(2)} -to ${(end - late).toFixed(2)} -i ${video} -vf "scale=${phone ? 390 : 1280}:-2" -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -movflags +faststart -an ${join(out, "clips", `${name}.mp4`)}`)
function strip(kind, a, b) {
	const times = Array.from({ length: 6 }, (_, i) => Math.max(0, a - late + ((b - a) * i) / 5))
	const w = phone ? 220 : 480
	const inputs = times.map((s) => `-ss ${s.toFixed(3)} -i ${video}`).join(" ")
	const filter = `${times.map((_, i) => `[${i}:v]trim=end_frame=1,scale=${w}:-2[f${i}]`).join(";")};${times.map((_, i) => `[f${i}]`).join("")}hstack=inputs=6`
	run(`ffmpeg -loglevel error -y ${inputs} -filter_complex "${filter}" -frames:v 1 -q:v 4 ${join(out, "strips", `${name}-${kind}.jpg`)}`)
}
// What the script notices by asking the page, it notices about a quarter of a second after the recording shows it.
const seen = 0.28
strip("out", outBegan - (inRoom ? 0 : seen), arrived - 0.15)
strip("back", backBegan - seen, home - 0.15)
console.log(`${name}: press to motion ${(outBegan - pressed).toFixed(2)} s, motion ${(arrived - outBegan).toFixed(2)} s; back to motion ${(backBegan - turned).toFixed(2)} s, motion ${(home - backBegan).toFixed(2)} s; recording ${late.toFixed(2)} s late; lands on ${state.stack} with the focus on ${state.focus}`)
