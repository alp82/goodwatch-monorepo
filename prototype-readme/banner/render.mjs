// PROTOTYPE: renders banner.html to ../assets/banner.webp at 2x.
import { execFileSync } from "node:child_process"
import { mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright-core"

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, "..", "assets")
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({
	executablePath: join(homedir(), ".cache/ms-playwright/chromium-1248/chrome-linux64/chrome"),
})
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1400, height: 500 } })
await page.goto(`file://${join(here, "banner.html")}`)
await page.waitForLoadState("networkidle")
await page.evaluate(() => document.fonts.ready)
const png = join(out, "banner.png")
await page.locator(".card").screenshot({ path: png, omitBackground: true })
await browser.close()

execFileSync("magick", [png, "-quality", "84", "-define", "webp:alpha-quality=100", join(out, "banner.webp")])
execFileSync("rm", [png])
console.log("wrote", join(out, "banner.webp"))
