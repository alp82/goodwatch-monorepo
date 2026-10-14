// PROTOTYPE - throwaway (#545). Drives /prototype/consent through each variant's flow, checks inside the vendors'
// frames that the real embeds load (YouTube and TikTok video elements, the Bluesky post text), checks that no embed
// vendor is contacted before consent, and takes the review page's screenshots.
//   PLAYWRIGHT=<node_modules with playwright-core> BASE=http://localhost:3145 OUT=<dir> node drive.mjs
// Uses /usr/bin/chromium. Analytics and the Sentry tunnel are answered in the browser, so nothing is reported.
import { createRequire } from "node:module"
import { writeFileSync } from "node:fs"

const require = createRequire(`${process.env.PLAYWRIGHT}/`)
const { chromium } = require("playwright-core")
const BASE = process.env.BASE ?? "http://localhost:3145"
const OUT = process.env.OUT ?? "."
const ONLY = (process.env.VARIANTS ?? "A,B,C,D").split(",")

const browser = await chromium.launch({
	executablePath: "/usr/bin/chromium",
	args: ["--autoplay-policy=no-user-gesture-required"],
})
const checks = []
const check = (name, ok, detail = "") => {
	checks.push({ name, ok, detail })
	console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`)
}

const DEVICES = {
	desktop: { viewport: { width: 1280, height: 900 } },
	phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}

async function open(variant, device) {
	const context = await browser.newContext(DEVICES[device])
	const page = await context.newPage()
	await page.route(/\/api\/e(\?|$)|posthog|google-analytics|googletagmanager|sentry/, (r) => r.fulfill({ status: 204 }))
	page.on("pageerror", (e) => console.log(`  [${variant} ${device}] pageerror: ${e.message.slice(0, 160)}`))
	await page.goto(`${BASE}/prototype/consent?variant=${variant}`, { waitUntil: "load", timeout: 120000 })
	await page.waitForSelector("text=Talked about now", { timeout: 60000 })
	await page.waitForTimeout(1500)
	return { context, page }
}

// The variant switcher is not part of the design; it stays in the first shot of each flow only.
const shot = async (page, name) => {
	if (!name.includes("-1-")) await page.addStyleTag({ content: ".ring-fuchsia-500.fixed{display:none!important}" })
	await page.waitForTimeout(600)
	await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 72 })
}
const vendorHosts = (page) => page.textContent('[data-testid="vendor-hosts"]')
const center = (locator) => locator.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }))

// A frame whose URL matches, once it has the element that proves the embed is real.
async function frameHas(page, urlPart, selector, timeout = 45000) {
	const end = Date.now() + timeout
	while (Date.now() < end) {
		for (const frame of page.frames()) {
			if (!frame.url().includes(urlPart)) continue
			try {
				if (await frame.$(selector)) return frame
			} catch {}
		}
		await page.waitForTimeout(500)
	}
	return null
}
async function videoPlays(frame) {
	try {
		await frame.waitForFunction(() => (document.querySelector("video")?.currentTime ?? 0) > 0.3, null, { timeout: 25000 })
		return true
	} catch {
		return false
	}
}

const flows = {
	async A(device) {
		const { context, page } = await open("A", device)
		check(`A ${device}: banner on first visit`, await page.isVisible("text=We use cookies"))
		check(`A ${device}: no vendor before consent`, (await vendorHosts(page)) === "none")
		await shot(page, `A-${device}-1-first-visit`)
		if (device === "desktop") {
			await page.click("text=Choose")
			await shot(page, `A-${device}-2-choose`)
		}
		await page.click("text=Decline")
		const play = page.locator('button[aria-label="Play Official Trailer #2"]')
		await center(play)
		await play.click()
		check(`A ${device}: facade asks for YouTube after Decline`, await page.isVisible("text=Allow YouTube"))
		await shot(page, `A-${device}-3-facade-asks`)
		await page.click("text=Allow YouTube")
		const yt = await frameHas(page, "youtube-nocookie.com/embed/ZkN2M4ODdys", "video")
		check(`A ${device}: YouTube player loaded`, Boolean(yt))
		if (yt) check(`A ${device}: YouTube video plays`, await videoPlays(yt))
		check(`A ${device}: only YouTube contacted`, (await vendorHosts(page)).includes("youtube-nocookie.com") && !(await vendorHosts(page)).includes("tiktok"))
		await shot(page, `A-${device}-4-youtube-live`)
		if (device === "desktop") {
			const stored = await page.evaluate(() => localStorage.getItem("proto-consent:A"))
			check("A desktop: YouTube remembered", stored.includes('"youtube":"yes"'), stored)
			await page.reload({ waitUntil: "load" })
			await page.waitForSelector("text=Talked about now")
			await page.waitForTimeout(2500)
			const next = page.locator('button[aria-label="Play In cinemas now"]')
			await center(next)
			await next.click()
			check("A desktop: next YouTube plays on one click after reload", Boolean(await frameHas(page, "youtube-nocookie.com/embed/v5oVaS2lW2s", "video")))
		}
		await context.close()
	},

	async B(device) {
		const { context, page } = await open("B", device)
		await page.waitForSelector("#cc-main .cm", { timeout: 20000 }).catch(() => {})
		check(`B ${device}: library banner on first visit`, await page.isVisible("#cc-main .cm"))
		check(`B ${device}: no vendor before consent`, (await vendorHosts(page)) === "none")
		await shot(page, `B-${device}-1-first-visit`)
		if (device === "desktop") {
			await page.click("#cc-main .cm >> text=Choose")
			await page.waitForSelector("#cc-main .pm", { state: "visible" })
			await shot(page, `B-${device}-2-preferences`)
			await page.click("#cc-main .pm >> text=Decline all")
		} else {
			await page.click("#cc-main .cm >> text=Decline")
		}
		const tiktok = page.locator('[data-post="om-tt"] div[data-service="tiktok"]')
		await center(tiktok)
		await tiktok.locator("text=Always allow").click()
		// TikTok's player shows the post's author before it plays; its own cookie prompt sits over it in the EU.
		const tt = await frameHas(page, "tiktok.com/player/v1/7664965741153717534", "text=roomforscream")
		check(`B ${device}: TikTok player loaded`, Boolean(tt))
		if (device === "desktop") {
			const both = await frameHas(page, "tiktok.com/player/v1/7665059046680038670", "text=grace.mitscherlich", 30000)
			check("B desktop: Always allow loads every TikTok on the page", Boolean(both))
			const cookie = await page.evaluate(() => decodeURIComponent(document.cookie))
			check("B desktop: TikTok accepted in the consent cookie", /"embeds":\["tiktok"\]/.test(cookie), cookie.match(/"services":\{[^}]*\}/)?.[0])
		}
		await shot(page, `B-${device}-3-tiktok-live`)
		await context.close()
	},

	async C(device) {
		const { context, page } = await open("C", device)
		check(`C ${device}: no banner`, !(await page.isVisible("text=We use cookies")))
		check(`C ${device}: no vendor before consent`, (await vendorHosts(page)) === "none")
		await shot(page, `C-${device}-1-first-visit`)
		const card = page.locator('[data-post="an-yt"]')
		await center(card)
		await card.locator("text=Remember for YouTube").click()
		await card.locator("text=Play from YouTube").click()
		const yt = await frameHas(page, "youtube-nocookie.com/embed/ZkN2M4ODdys", "video")
		check(`C ${device}: YouTube player loaded`, Boolean(yt))
		if (yt) check(`C ${device}: YouTube video plays`, await videoPlays(yt))
		await shot(page, `C-${device}-2-youtube-live`)
		const bsky = page.locator("text=Show post from Bluesky").first()
		await center(bsky)
		await bsky.click()
		const post = await frameHas(page, "embed.bsky.app/embed/did:plc:7exlcsle4mjfhu3wnhcgizz6", "text=/unexpected moment/i")
		check(`C ${device}: Bluesky post loaded (The Verge on Other Mommy)`, Boolean(post))
		await page.waitForTimeout(1500)
		await shot(page, `C-${device}-3-bluesky-live`)
		if (device === "desktop") {
			const tiktok = page.locator('[data-post="od-tt"]')
			await center(tiktok)
			await tiktok.locator("text=Play from TikTok").click()
			const tt = await frameHas(page, "tiktok.com/player/v1/7665059046680038670", "text=grace.mitscherlich")
			check("C desktop: TikTok player loaded", Boolean(tt))
			check("C desktop: TikTok shows its own cookie prompt inside the player", Boolean(tt && (await tt.$("text=/Allow cookies from TikTok/i"))))
			await page.waitForTimeout(1500)
			await shot(page, `C-${device}-4-tiktok-live`)
		}
		if (device === "desktop") {
			const stored = await page.evaluate(() => localStorage.getItem("proto-consent:C"))
			check("C desktop: only YouTube remembered", stored === '{"remembered":["youtube"]}', stored)
		}
		await context.close()
	},

	async D(device) {
		const { context, page } = await open("D", device)
		check(`D ${device}: question in the row, no banner`, await page.isVisible("text=See what people are posting?"))
		check(`D ${device}: no vendor before consent`, (await vendorHosts(page)) === "none")
		await shot(page, `D-${device}-1-first-visit`)
		await page.click('button[aria-pressed="true"]:has-text("TikTok")')
		await page.click("text=Show posts")
		const post = await frameHas(page, "embed.bsky.app/embed/did:plc:sanfemo6qfnbaxdoi2q2vnvl", "text=/Affleck/")
		check(`D ${device}: Bluesky posts show by themselves (Deadline on Animals)`, Boolean(post))
		check(`D ${device}: TikTok left off offers itself`, await page.locator("text=Turn on TikTok").first().isVisible())
		check(`D ${device}: no TikTok contacted`, !(await vendorHosts(page)).includes("tiktok"))
		await page.waitForTimeout(1500)
		await shot(page, `D-${device}-2-posts-on`)
		const play = page.locator('button[aria-label="Play Official Trailer #2"]')
		await center(play)
		await play.click()
		const yt = await frameHas(page, "youtube-nocookie.com/embed/ZkN2M4ODdys", "video")
		check(`D ${device}: YouTube plays on one click`, Boolean(yt) && (await videoPlays(yt)))
		await shot(page, `D-${device}-3-youtube-live`)
		await context.close()
	},
}

for (const variant of ONLY)
	for (const device of ["desktop", "phone"]) {
		try {
			await flows[variant](device)
		} catch (error) {
			check(`${variant} ${device}: flow ran`, false, error.message.split("\n")[0])
		}
	}
await browser.close()
writeFileSync(`${OUT}/checks.json`, JSON.stringify(checks, null, 2))
console.log(`${checks.filter((c) => c.ok).length}/${checks.length} checks passed`)
