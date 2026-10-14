// Screenshots of /prototype/auth at desktop and phone width, from a dev server on port 3121.
// Copy next to a playwright-core install (Chromium at /usr/bin/chromium) and run: node shots.mjs <outdir> [name filter]
// The PNGs were turned into the WebP files here with: magick <png> -quality 78 <webp>
import { chromium } from "playwright-core"
const [out, filter] = process.argv.slice(2)
const BASE = "http://localhost:3121/prototype/auth?shot=1&"
const SHOTS = [
  ["01-sign-in", "screen=sign-in"],
  ["02-sign-in-error", "screen=sign-in&state=error"],
  ["03-sign-in-unverified", "screen=sign-in&state=unverified"],
  ["04-sign-up", "screen=sign-up", async p => { await p.fill("#proto-email", "alex@example.com"); await p.fill("#proto-password", "popcorn-night") }],
  ["05-sign-up-guest", "screen=sign-up&state=guest"],
  ["06-sign-up-taken", "screen=sign-up&state=taken"],
  ["07-verify-sent", "screen=verify&state=sent"],
  ["08-verify-confirmed", "screen=verify&state=confirmed"],
  ["09-verify-expired", "screen=verify&state=expired"],
  ["10-forgot", "screen=forgot"],
  ["11-forgot-sent", "screen=forgot&state=sent"],
  ["12-reset", "screen=reset", async p => { await p.fill("#proto-password", "short") }],
  ["13-reset-done", "screen=reset&state=done"],
  ["14-reset-expired", "screen=reset&state=expired"],
  ["15-emails", "screen=emails"],
  ["16-notice-A-banner", "screen=notice&variant=A"],
  ["17-notice-A-sign-in", "screen=sign-in&state=cutover"],
  ["18-notice-B-dialog", "screen=notice&variant=B"],
  ["19-sign-in-connect", "screen=sign-in&state=connect&client=claude"],
  ["20-consent-A-claude", "screen=consent&variant=A&client=claude"],
  ["21-consent-B-claude", "screen=consent&variant=B&client=claude"],
  ["22-consent-B-see-only", "screen=consent&variant=B&client=chatgpt", async p => { await p.click("text=See only") }],
  ["23-consent-A-unverified", "screen=consent&variant=A&client=unknown"],
  ["24-consent-allowed", "screen=consent&variant=A&state=allowed&client=claude"],
  ["25-apps-A", "screen=apps&variant=A"],
  ["26-apps-A-confirm", "screen=apps&variant=A&state=confirm"],
  ["27-apps-B", "screen=apps&variant=B"],
  ["28-apps-empty", "screen=apps&variant=A&state=empty"],
]
const b = await chromium.launch({ executablePath: "/usr/bin/chromium" })
for (const [vpName, vp] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
  const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor ?? 1, isMobile: vp.isMobile, hasTouch: vp.hasTouch })
  await ctx.route("**/api/e*", r => r.fulfill({ status: 200, body: "" }))
  const p = await ctx.newPage()
  for (const [name, q, act] of SHOTS) {
    if (filter && !name.includes(filter)) continue
    await p.setViewportSize({ width: vp.width, height: vp.height })
    await p.goto(BASE + q, { waitUntil: "load", timeout: 120000 })
    await p.waitForSelector("h1, h2", { timeout: 60000 })
    if (act) await act(p)
    await p.waitForTimeout(1200)
    const standalone = await p.$("[data-standalone]")
    if (standalone) {
      const h = await standalone.evaluate(el => el.scrollHeight)
      await p.setViewportSize({ width: vp.width, height: Math.max(vp.height, h) })
      await p.waitForTimeout(300)
      await p.screenshot({ path: `${out}/${name}-${vpName}.png` })
    } else {
      // The shell's footer is the same on every page: leave it out, and let the page end where <main> ends.
      await p.addStyleTag({ content: "footer{display:none!important}" })
      const h = await p.evaluate(() => Math.ceil(document.querySelector("main").getBoundingClientRect().height + document.querySelector("main").offsetTop))
      await p.setViewportSize({ width: vp.width, height: Math.max(vp.height, h + (vp.isMobile ? 90 : 0)) })
      await p.waitForTimeout(300)
      await p.screenshot({ path: `${out}/${name}-${vpName}.png` })
    }
    console.log(name, vpName)
  }
  await ctx.close()
}
await b.close()
