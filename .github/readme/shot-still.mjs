// PROTOTYPE: 2x still of a README scene from the local harness.
// node shot-still.mjs <scene> <out.png> [pauseMs|-] [clip x,y,w,h] [scale]
import { chromium } from "playwright-core"
const [scene, out, pause = "-", clip = "0,0,1440,770", scale = "2"] = process.argv.slice(2)
const [x, y, width, height] = clip.split(",").map(Number)
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const p = await b.newPage({ viewport: { width: 1440, height: 770 }, deviceScaleFactor: Number(scale) })
const q = new URLSearchParams()
if (pause !== "-") q.set("pause", pause)
await p.goto(`http://127.0.0.1:3177/prototype/readme/${scene}?${q}`, { waitUntil: "networkidle", timeout: 120000 })
await p.waitForTimeout(pause !== "-" ? 1800 : 2500)
await p.addStyleTag({ content: "html{scrollbar-width:none!important;scrollbar-gutter:auto!important}" })
await p.evaluate(() => Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r }))))
await p.waitForTimeout(300)
await p.screenshot({ path: out, clip: { x, y, width, height } })
await b.close()
