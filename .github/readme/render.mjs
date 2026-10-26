// Renders banner.html to banner.webp at 2x. Needs ImageMagick (`magick`) and a Chromium build:
// set CHROMIUM_PATH, or install one with `npx playwright install chromium`.
import { execFileSync } from "node:child_process"
import { rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright-core"

const here = dirname(fileURLToPath(import.meta.url))
const browser = await chromium.launch(
	process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
)
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1400, height: 500 } })
await page.goto(`file://${join(here, "banner.html")}`)
await page.waitForLoadState("networkidle")
await page.evaluate(() => document.fonts.ready)
const png = join(here, "banner.png")
await page.locator(".card").screenshot({ path: png, omitBackground: true })
await browser.close()

execFileSync("magick", [png, "-quality", "84", "-define", "webp:alpha-quality=100", join(here, "banner.webp")])
rmSync(png)
console.log("wrote", join(here, "banner.webp"))
