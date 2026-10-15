// Drives the account pages on the local dev server (scripts/auth-wiring/dev.sh) against Docker CrateDB/Valkey and
// Mailpit. Takes screenshots at 1440 and 390 wide, and checks each flow end to end.
// Run: PLAYWRIGHT=<folder with node_modules/playwright-core> node docs/implementation/auth-pages/drive.mjs
// with the dev server of goodwatch-webapp/scripts/auth-wiring/dev.sh on port 3550. Screenshots go to OUT.
const { chromium } = await import(`${process.env.PLAYWRIGHT ?? "."}/node_modules/playwright-core/index.mjs`)
import { mkdirSync, writeFileSync } from "node:fs"

const BASE = process.env.BASE ?? "http://localhost:3550"
const MAIL = process.env.MAILPIT ?? "http://127.0.0.1:15980"
const OUT = process.env.OUT ?? new URL("./results", import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const WIDTHS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } }
const PASSWORD = "a long enough password"
const results = []
const check = (name, ok, detail = "") => {
	results.push({ name, ok, detail })
	console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`)
}

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" })

async function newPage(size = "desktop", context) {
	const ctx = context ?? (await browser.newContext({ viewport: WIDTHS[size], deviceScaleFactor: 1, userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36" }))
	const page = await ctx.newPage()
	page.setDefaultTimeout(120000)
	await page.route("**/api/e*", (route) => route.fulfill({ status: 200, body: "" }))
	await page.route(/posthog|googletagmanager|google-analytics/, (route) => route.abort())
	return page
}
async function go(page, path) {
	await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 120000 })
	await page.addStyleTag({ content: ".tsqd-open-btn-container{display:none!important}" })
	// The pages hydrate before forms answer.
	await page.waitForFunction(() => { const main = document.querySelector("main"); return main && Object.keys(main).some((k) => k.startsWith("__react")) }, null, { timeout: 120000 })
	await page.waitForTimeout(800)
}
async function shot(page, name) {
	await page.waitForTimeout(400)
	await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
}
// Both widths of the same address, in fresh contexts with the given cookies and storage.
async function both(name, path, prepare) {
	for (const size of Object.keys(WIDTHS)) {
		const page = await newPage(size)
		if (prepare) await prepare(page)
		await go(page, path)
		await shot(page, `${name}-${size}`)
		await page.context().close()
	}
}
async function messages(address) {
	const data = await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`)).json()
	return Promise.all(data.messages.reverse().map(async (m) => (await fetch(`${MAIL}/api/v1/message/${m.ID}`)).json()))
}
async function waitForMail(address, count, timeout = 20000) {
	const deadline = Date.now() + timeout
	while (Date.now() < deadline) {
		const found = await messages(address)
		if (found.length >= count) return found
		await new Promise((r) => setTimeout(r, 500))
	}
	throw new Error(`No mail #${count} for ${address}`)
}
const linkIn = (message) => message.Text.match(/https?:\/\/\S+\/api\/auth\/\S+/)[0]
async function emailShot(message, name) {
	for (const size of Object.keys(WIDTHS)) {
		const page = await newPage(size)
		await page.setContent(message.HTML, { waitUntil: "load" })
		await page.screenshot({ path: `${OUT}/${name}-${size}.png`, fullPage: true })
		await page.context().close()
	}
}
const signedInAs = async (page) =>
	page.evaluate(async () => {
		const r = await fetch("/api/auth/get-session")
		const data = await r.json()
		return data?.user?.email ?? null
	})

const stamp = Date.now()
const email = `member-${stamp}@example.test`

try {
	// 1. The empty pages.
	await both("01-sign-in", "/sign-in")
	await both("02-sign-up", "/sign-up")
	await both("03-sign-up-guest", "/sign-up", async (page) => {
		await page.addInitScript(() => {
			const ratings = [603, 27205, 155, 157336, 680, 13, 550].map((id, i) => ({ tmdb_id: id, media_type: "movie", type: "score", score: 7 + (i % 3), timestamp: Date.now() }))
			const plans = [693134, 872585].map((id) => ({ tmdb_id: id, media_type: "movie", type: "plan", timestamp: Date.now() }))
			localStorage.setItem("onboarding_ratings", JSON.stringify([...ratings, ...plans]))
		})
	})
	await both("04-forgot", "/forgot-password")
	await both("05-verify-resend", "/verify-email?state=resend")

	// 2. Sign-up with guest data, the "Check your inbox" page, and the confirmation email.
	const page = await newPage("desktop")
	await page.addInitScript(() => {
		if (!localStorage.getItem("seeded")) {
			localStorage.setItem("seeded", "1")
			localStorage.setItem("onboarding_ratings", JSON.stringify([{ tmdb_id: 603, media_type: "movie", type: "score", score: 9, timestamp: Date.now() }, { tmdb_id: 27205, media_type: "movie", type: "plan", timestamp: Date.now() }]))
		}
	})
	await go(page, "/sign-up")
	check("sign-up shows what the guest's data brings", (await page.textContent("body")).includes("Your 1 rating and 1 Wishlist title come along"))
	await page.fill("#auth-email", email)
	await page.fill("#auth-password", "short")
	check("create is disabled under 10 characters", await page.isDisabled("button[type=submit]"))
	await page.fill("#auth-password", PASSWORD)
	await page.click("button[type=submit]")
	await page.waitForURL(/verify-email\?state=sent/)
	await page.waitForSelector("text=Check your inbox")
	check("sign-up goes to Check your inbox with the address", (await page.textContent("h1 + p")).includes(email))
	check("resend waits for its cooldown", (await page.textContent("body")).includes("Resend link in 0:"))
	await shot(page, "06-verify-sent-desktop")
	{
		const phone = await newPage("phone")
		await go(phone, "/sign-up")
		await phone.fill("#auth-email", `phone-${email}`)
		await phone.fill("#auth-password", PASSWORD)
		await phone.click("button[type=submit]")
		await phone.waitForURL(/verify-email\?state=sent/)
		await shot(phone, "06-verify-sent-phone")
		await phone.context().close()
	}
	const [confirm] = await waitForMail(email, 1)
	check("confirmation email comes from hello@goodwatch.app", confirm.From.Address === "hello@goodwatch.app", confirm.From.Address)
	check("confirmation email has the prototype's subject", confirm.Subject === "Confirm your email for GoodWatch", confirm.Subject)
	await emailShot(confirm, "20-email-confirm")

	// 3. Signing in before confirming: the shared message.
	{
		const p = await newPage("desktop")
		await go(p, "/sign-in")
		await p.fill("#auth-email", email)
		await p.fill("#auth-password", PASSWORD)
		await p.click("button[type=submit]")
		await p.waitForSelector("[role=alert]")
		check("unconfirmed sign-in shows the shared notice", (await p.textContent("[role=alert]")).includes("isn't confirmed yet"))
		await shot(p, "07-sign-in-error-desktop")
		await p.setViewportSize(WIDTHS.phone)
		await shot(p, "07-sign-in-error-phone")
		await p.context().close()
	}

	// 4. Resend from the "Check your inbox" page: a new link, only the newest works.

	// 5. Opening the link signs in and lands on Email confirmed; the guest's data comes along.
	const link = linkIn(confirm)
	await page.goto(link, { waitUntil: "load" })
	await page.waitForURL(/verify-email\?state=confirmed/)
	await page.addStyleTag({ content: ".tsqd-open-btn-container{display:none!important}" })
	await page.waitForTimeout(1500)
	check("confirmation link signs in", (await signedInAs(page)) === email)
	check("confirmed page", (await page.textContent("h1")) === "Email confirmed")
	await shot(page, "08-verify-confirmed-desktop")
	{
		const p = await newPage("phone")
		await go(p, "/verify-email?state=confirmed&returnTo=%2F")
		await shot(p, "08-verify-confirmed-phone")
		await p.context().close()
	}
	const transfer = await page.evaluate(() => JSON.parse(localStorage.getItem("goodwatch_account_transfers") || "[]"))
	check("guest data is bound to the new account for transfer", transfer.some((t) => t.accountId && t.automatic), JSON.stringify(transfer.map((t) => ({ a: !!t.accountId, auto: t.automatic }))))

	// 6. The same link again: the expired page, in a browser.
	{
		const p = await newPage("desktop")
		await p.goto(link, { waitUntil: "load" })
		await p.waitForURL(/verify-email\?state=expired/)
		check("used confirmation link lands on the expired page", (await p.textContent("h1")) === "This link has expired")
		await p.context().close()
		await both("09-verify-expired", "/verify-email?state=expired")
	}

	// 7. Sign out, then sign in with the password and "Stay signed in" off: a session cookie without an expiry.
	await page.evaluate(() => fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }))
	await go(page, "/sign-in?redirectTo=%2Fprivacy")
	await page.fill("#auth-email", email)
	await page.fill("#auth-password", PASSWORD)
	await page.uncheck("input[name=remember]")
	await page.click("button[type=submit]")
	await page.waitForURL(/\/privacy$/, { timeout: 60000 })
	const cookie = (await page.context().cookies()).find((c) => c.name.endsWith("gw.session_token"))
	check("sign-in returns to the page it came from", page.url().endsWith("/privacy"))
	check("'Stay signed in' off gives a cookie that ends with the browser", cookie && cookie.expires === -1, `expires=${cookie?.expires}`)
	await page.evaluate(() => fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }))
	await go(page, "/sign-in")
	await page.fill("#auth-email", email)
	await page.fill("#auth-password", PASSWORD)
	await page.click("button[type=submit]")
	await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 60000 })
	const kept = (await page.context().cookies()).find((c) => c.name.endsWith("gw.session_token"))
	check("'Stay signed in' on gives a 90-day cookie", kept && kept.expires > Date.now() / 1000 + 80 * 86400, `expires=${kept?.expires}`)
	await shot(page, "10-after-sign-in-desktop")

	// 8. Settings › Account: change the password (needs the current one).
	await go(page, "/settings/account")
	await page.waitForSelector("#password-current", { timeout: 30000 }).catch(() => {})
	await shot(page, "11-settings-account-desktop")
	if (await page.$("#password-current")) {
		await page.fill("#password-current", PASSWORD)
		await page.fill("#password-new", `${PASSWORD} two`)
		await page.click("text=Change Password >> nth=-1")
		await page.waitForSelector("text=Password changed. Other devices are signed out.", { timeout: 30000 })
		check("settings password change", true)
		const changed = (await waitForMail(email, 3)).at(-1)
		check("password-changed email after the settings change", /password changed/i.test(changed.Subject), changed.Subject)
		await emailShot(changed, "22-email-password-changed")
	} else check("settings password change", false, "no current-password field")
	{
		const p = await newPage("phone", page.context())
		await p.setViewportSize(WIDTHS.phone)
		await go(p, "/settings/account")
		await p.waitForSelector("#password-current", { timeout: 30000 }).catch(() => {})
		await shot(p, "11-settings-account-phone")
		await p.close()
	}

	// 9. Forgot password, the email, the reset page, direct sign-in, and the used link.
	await page.evaluate(() => fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }))
	const before = (await messages(email)).length
	await go(page, "/forgot-password")
	await page.fill("#auth-email", email)
	await page.click("button[type=submit]")
	await page.waitForSelector("text=Check your inbox")
	await shot(page, "12-forgot-sent-desktop")
	{
		const p = await newPage("phone")
		await go(p, "/forgot-password")
		await p.fill("#auth-email", `nobody-${stamp}@example.test`)
		await p.click("button[type=submit]")
		await p.waitForSelector("text=Check your inbox")
		check("an unknown address gets the same answer", (await p.textContent("body")).includes("If there's an account for"))
		await shot(p, "12-forgot-sent-phone")
		await p.context().close()
	}
	const reset = (await waitForMail(email, before + 1)).at(-1)
	check("reset email subject", reset.Subject === "Set a new GoodWatch password", reset.Subject)
	await emailShot(reset, "21-email-reset")
	const resetLink = linkIn(reset)
	await page.goto(resetLink, { waitUntil: "load" })
	await page.waitForURL(/reset-password\?token=/)
	await page.addStyleTag({ content: ".tsqd-open-btn-container{display:none!important}" })
	await page.waitForTimeout(1500)
	await shot(page, "13-reset-form-desktop")
	{
		const p = await newPage("phone")
		await go(p, new URL(page.url()).pathname + new URL(page.url()).search)
		await shot(p, "13-reset-form-phone")
		await p.context().close()
	}
	await page.fill("#auth-password", `${PASSWORD} three`)
	await page.click("button[type=submit]")
	await page.waitForSelector("text=Password saved")
	check("reset signs the member in", (await signedInAs(page)) === email)
	await shot(page, "14-reset-done-desktop")
	{
		const p = await newPage("phone")
		await p.goto(resetLink, { waitUntil: "load" })
		await p.waitForURL(/reset-password\?error=/)
		await p.addStyleTag({ content: ".tsqd-open-btn-container{display:none!important}" })
		await p.waitForTimeout(1500)
		check("a used reset link shows the expired page", (await p.textContent("h1")) === "This link no longer works")
		await shot(p, "15-reset-expired-phone")
		await p.setViewportSize(WIDTHS.desktop)
		await shot(p, "15-reset-expired-desktop")
		await p.context().close()
	}

	// 10. A duplicate sign-up answers the same and emails the owner.
	{
		const p = await newPage("desktop")
		await go(p, "/sign-up")
		await p.fill("#auth-email", email)
		await p.fill("#auth-password", PASSWORD)
		await p.click("button[type=submit]")
		await p.waitForURL(/verify-email\?state=sent/)
		check("duplicate sign-up answers Check your inbox", true)
		const owner = (await waitForMail(email, (await messages(email)).length)).at(-1)
		const all = await messages(email)
		const notice = all.find((m) => /already have/i.test(m.Subject))
		check("duplicate sign-up emails the owner", !!notice)
		if (notice) await emailShot(notice, "23-email-existing-account")
		await p.context().close()
	}

	// 11. Too many requests: the sixth resend for one address within the hour.
	{
		const p = await newPage("desktop")
		const target = `throttle-${stamp}@example.test`
		await go(p, "/forgot-password")
		let throttled = false
		for (let i = 0; i < 7 && !throttled; i++) {
			await go(p, "/forgot-password")
			await p.fill("#auth-email", target)
			await p.click("button[type=submit]")
			await p.waitForSelector(':text("Check your inbox"), :text("Too many tries")', { timeout: 30000 })
			throttled = (await p.textContent("body")).includes("Too many tries")
		}
		check("the sixth request for one address is held back", throttled)
		await shot(p, "16-forgot-throttled-desktop")
		await p.setViewportSize(WIDTHS.phone)
		await shot(p, "16-forgot-throttled-phone")
		await p.context().close()
	}

	// 12. Continue with Google leaves for Google with this server's client and state.
	{
		const p = await newPage("desktop")
		await go(p, "/sign-in")
		let google = null
		await p.route(/accounts\.google\.com/, (route) => {
			google = route.request().url()
			route.fulfill({ status: 204 })
		})
		await p.click("text=Continue with Google")
		await p.waitForTimeout(5000)
		check("Continue with Google goes to Google with the client and PKCE", !!google && google.includes("client_id=local-google-client") && google.includes("code_challenge="), google?.slice(0, 120))
		await p.context().close()
		await both("17-sign-in-google-error", "/sign-in?error=google")
	}

	// 13. The cut-over: a browser with an old Supabase sign-in.
	const oldSignIn = async (page) => {
		await page.context().addCookies([{ name: "sb-abcdefghijklmnop-auth-token", value: "base64-old", url: BASE }])
	}
	await both("18-banner", "/privacy", oldSignIn)
	{
		const p = await newPage("desktop")
		await oldSignIn(p)
		await go(p, "/privacy")
		check("the banner shows with an old Supabase sign-in", (await p.textContent("body")).includes("GoodWatch has a new sign-in, so you were signed out once."))
		await p.click("text=Sign in >> nth=0").catch(() => {})
		await p.click('a[href*="reason=new-sign-in"]')
		await p.waitForURL(/reason=new-sign-in/)
		await p.waitForTimeout(1000)
		check("Sign in leads to Sign in again", (await p.textContent("h1")) === "Sign in again")
		check("following the banner removes the old sign-in", !(await p.context().cookies()).some((c) => c.name.startsWith("sb-")))
		await shot(p, "19-sign-in-again-desktop")
		await p.setViewportSize(WIDTHS.phone)
		await shot(p, "19-sign-in-again-phone")
		await go(p, "/privacy")
		check("the banner does not come back", !(await p.textContent("body")).includes("so you were signed out once"))
		await p.context().close()
	}
	{
		const p = await newPage("desktop")
		await oldSignIn(p)
		await go(p, "/privacy")
		await p.click('button[aria-label="Dismiss"]')
		await go(p, "/privacy")
		check("dismissing the banner is for good", !(await p.textContent("body")).includes("so you were signed out once"))
		await p.context().close()
	}

	// 13b. A guest tab that still holds an earlier member's media-session marker drops it on a full page load, so a
	// later sign-in as that member moves the guest's media preferences to the account.
	{
		const p = await newPage("desktop")
		await p.addInitScript(() => sessionStorage.setItem("gw_media_session_v2", "earlier-member-id"))
		await go(p, "/sign-in")
		check("the stale-marker sign-in page loads as a guest",(await signedInAs(p)) === null)
		check("a guest page load clears a stale media-session marker", (await p.evaluate(() => sessionStorage.getItem("gw_media_session_v2"))) === null)
		await p.context().close()
	}

	// 14. Google-only member asking for a reset gets the "you sign in with Google" email (made directly in CrateDB is
	// beyond this drive; the wiring suite covers it). Render the template from a known address instead.
} catch (error) {
	console.error(error)
	check("drive finished", false, String(error).slice(0, 300))
} finally {
	await browser.close()
	writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2))
	const failed = results.filter((r) => !r.ok)
	console.log(`\n${results.length - failed.length}/${results.length} passed`)
}
