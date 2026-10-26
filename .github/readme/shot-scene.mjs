// PROTOTYPE: screenshot a README scene from the local harness. node shot-scene.mjs <scene> <out.png> [pauseMs] [query]
import { chromium } from "playwright-core"
const [scene, out, pause, extra = ""] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const p = await b.newPage({ viewport: { width: 1440, height: 770 }, deviceScaleFactor: 1 })
const q = new URLSearchParams(extra)
if (pause) q.set("pause", pause)
await p.goto(`http://127.0.0.1:3177/prototype/readme/${scene}?${q}`, { waitUntil: "networkidle", timeout: 120000 })
await p.waitForTimeout(pause ? 1500 : 4000)
await p.addStyleTag({ content: "html{scrollbar-width:none!important;scrollbar-gutter:auto!important}" })
await p.waitForTimeout(200)
await p.screenshot({ path: out, clip: { x: 0, y: 0, width: 1440, height: 770 } })
await b.close()
