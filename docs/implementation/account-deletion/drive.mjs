// Drives account deletion (#553) in Chromium on the local dev server of goodwatch-webapp/scripts/auth-deletion/dev.sh,
// against its disposable CrateDB, Valkey and Mailpit. Checks each flow end to end and takes the screenshots in `shots/`
// at 1440 and 390 wide.
// Run: PLAYWRIGHT=<folder with node_modules/playwright-core> CHROMIUM=<chromium binary> node docs/implementation/account-deletion/drive.mjs
import { mkdirSync, writeFileSync } from "node:fs"

const { chromium } = await import(`${process.env.PLAYWRIGHT ?? "."}/node_modules/playwright-core/index.mjs`)
const BASE = process.env.BASE ?? "http://localhost:16290"
const MAIL = process.env.MAILPIT ?? "http://127.0.0.1:16280"
const CRATE = process.env.CRATE ?? "http://127.0.0.1:16248"
const OUT = process.env.OUT ?? new URL("./results", import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const WIDTHS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } }
const PASSWORD = "a long enough password"
const MEMBER_TABLES = [
	"user_score",
	"user_wishlist",
	"user_favorite",
	"user_skipped",
	"user_not_interested",
	"user_setting",
	"user_watch_log",
	"user_watch_state",
	"user_import",
	"user_import_item",
	"user_mcp_action",
	"user_list_exposure",
	"user_list",
	"user_profile",
	"user_handle",
]
const results = []
const check = (name, ok, detail = "") => {
	results.push({ name, ok, detail })
	console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`)
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" })

async function newPage(size = "desktop") {
	const context = await browser.newContext({
		viewport: WIDTHS[size],
		deviceScaleFactor: 1,
		userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
	})
	const page = await context.newPage()
	page.setDefaultTimeout(120000)
	await page.route("**/api/e*", (route) => route.fulfill({ status: 200, body: "" }))
	await page.route(/posthog|googletagmanager|google-analytics/, (route) => route.abort())
	return page
}
async function hydrated(page) {
	await page.addStyleTag({ content: ".tsqd-open-btn-container{display:none!important}" })
	await page.waitForFunction(
		() => {
			const main = document.querySelector("main")
			return main && Object.keys(main).some((k) => k.startsWith("__react"))
		},
		null,
		{ timeout: 120000 },
	)
	await page.waitForTimeout(800)
}
async function go(page, path) {
	await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 120000 })
	await hydrated(page)
}
async function shot(page, name) {
	await page.waitForTimeout(400)
	await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
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
const linkIn = (message, path) => message.Text.match(new RegExp(`https?://\\S+${path}\\S*`))?.[0]
async function emailShot(message, name) {
	for (const size of Object.keys(WIDTHS)) {
		const page = await newPage(size)
		await page.setContent(message.HTML, { waitUntil: "load" })
		await page.screenshot({ path: `${OUT}/${name}-${size}.png`, fullPage: true })
		await page.context().close()
	}
}
const sessionOf = (page) =>
	page.evaluate(async () => {
		const r = await fetch("/api/auth/get-session")
		return (await r.json())?.user ?? null
	})
async function sql(stmt, args = []) {
	const response = await fetch(`${CRATE}/_sql`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ stmt, args }),
	})
	return response.json()
}
async function memberRows(userId) {
	await sql(`REFRESH TABLE ${MEMBER_TABLES.join(", ")}`)
	let total = 0
	for (const table of MEMBER_TABLES) total += (await sql(`SELECT count(*) FROM ${table} WHERE user_id = ?`, [userId])).rows[0][0]
	return total
}
async function seedRows(userId) {
	const now = Date.now()
	await sql("INSERT INTO user_wishlist (user_id, tmdb_id, media_type, created_at, updated_at) VALUES (?, 2001, 'movie', ?, ?)", [userId, now, now])
	await sql("INSERT INTO user_score (user_id, tmdb_id, media_type, score, created_at, updated_at) VALUES (?, 2002, 'movie', 8, ?, ?)", [userId, now, now])
	// An established member: onboarding done, so its prompt doesn't cover the pages in the screenshots.
	for (const [key, value] of [
		["country_default", "DE"],
		["onboarding_country_completed", "yes"],
		["onboarding_streaming_completed", "yes"],
		["onboarding_ratings_completed", "yes"],
	])
		await sql("INSERT INTO user_setting (user_id, key, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value", [userId, key, value, now, now])
	// A handle, as members who share lists have one; it stays reserved after deletion, without their id.
	const handle = `del_${userId.replace(/-/g, "").slice(0, 12)}`
	await sql("INSERT INTO user_handle (handle, user_id, claimed_at) VALUES (?, ?, ?)", [handle, userId, now])
	await sql("INSERT INTO user_profile (user_id, handle, created_at, updated_at) VALUES (?, ?, ?, ?)", [userId, handle, now, now])
	await sql("REFRESH TABLE user_setting, user_handle, user_profile")
}
async function handleOwner(userId) {
	const handle = `del_${userId.replace(/-/g, "").slice(0, 12)}`
	await sql("REFRESH TABLE user_handle")
	return (await sql("SELECT user_id FROM user_handle WHERE handle = ?", [handle])).rows[0]?.[0] ?? null
}

/** A confirmed member, signed in on a fresh desktop or phone page. */
async function member(label, size = "desktop") {
	const address = `${label}-${Date.now()}@example.test`
	const page = await newPage(size)
	await go(page, "/sign-up")
	await page.fill("#auth-email", address)
	await page.fill("#auth-password", PASSWORD)
	await page.click("form:has(#auth-password) button[type=submit]")
	await page.waitForURL(/verify-email\?state=sent/)
	const [confirm] = await waitForMail(address, 1)
	await page.goto(linkIn(confirm, "/api/auth/"), { waitUntil: "load" })
	await page.waitForURL(/verify-email\?state=confirmed/)
	await hydrated(page)
	const user = await sessionOf(page)
	if (user?.email !== address) throw new Error(`Sign-up of ${address} did not sign in`)
	await seedRows(user.id)
	// Signing up writes rows of its own (settings); the seeded ones come on top.
	return { page, address, id: user.id, rows: await memberRows(user.id) }
}

try {
	// 1. Settings › Account shows the entry, at both widths.
	const owner = await member("owner")
	await go(owner.page, "/settings/account")
	await owner.page.waitForSelector("text=Delete Account")
	check("Settings › Account has the Delete Account section", await owner.page.isVisible("a[href='/delete-account']"))
	await shot(owner.page, "01-settings-account-desktop")
	{
		const phone = await member("phone", "phone")
		await go(phone.page, "/settings/account")
		await phone.page.waitForSelector("text=Delete Account")
		await phone.page.locator("#delete-account").scrollIntoViewIfNeeded()
		await shot(phone.page, "01-settings-account-phone")
		await go(phone.page, "/delete-account")
		await phone.page.waitForSelector("text=Your password, to confirm")
		await shot(phone.page, "02-confirm-password-phone")
		await phone.page.context().close()
	}

	// 2. The confirmation page with the password; a wrong one keeps everything.
	await owner.page.click("a[href='/delete-account']")
	await owner.page.waitForURL(/\/delete-account$/)
	await owner.page.waitForSelector("text=Your password, to confirm")
	check("the page lists what goes with the account", (await owner.page.textContent("body")).includes("Deleted with your account"))
	check("the delete button waits for a password", await owner.page.isDisabled("form:has(#auth-password) button[type=submit]"))
	await shot(owner.page, "02-confirm-password-desktop")
	await owner.page.fill("#auth-password", "not the right password")
	await owner.page.click("form:has(#auth-password) button[type=submit]")
	await owner.page.waitForSelector("[role=alert]")
	check("a wrong password says so", (await owner.page.textContent("[role=alert]")).includes("That password isn't right"))
	check("a wrong password keeps the member signed in", (await sessionOf(owner.page))?.id === owner.id)
	check("the member has rows to delete", owner.rows >= 3, `${owner.rows} rows`)
	check("a wrong password keeps the member's rows", (await memberRows(owner.id)) === owner.rows)
	await shot(owner.page, "03-wrong-password-desktop")
	await owner.page.setViewportSize(WIDTHS.phone)
	await shot(owner.page, "03-wrong-password-phone")
	await owner.page.setViewportSize(WIDTHS.desktop)

	// 3. The email route instead: the page to send the link, then Check your inbox.
	await owner.page.click("text=Confirm by email instead")
	await owner.page.waitForSelector("text=Email me the link")
	await shot(owner.page, "04-confirm-by-email-desktop")
	await owner.page.click("text=Email me the link")
	await owner.page.waitForSelector("text=Check your inbox")
	check("Check your inbox names the address", (await owner.page.textContent("h1 + p")).includes(owner.address))
	await shot(owner.page, "05-link-sent-desktop")
	await owner.page.setViewportSize(WIDTHS.phone)
	await shot(owner.page, "05-link-sent-phone")
	await owner.page.setViewportSize(WIDTHS.desktop)
	const mail = (await waitForMail(owner.address, 2)).at(-1)
	check("the email asks to confirm deleting", mail.Subject === "Confirm deleting your GoodWatch account", mail.Subject)
	await emailShot(mail, "10-email-confirm-delete")
	const link = linkIn(mail, "/delete-account")
	check("the email links to the confirmation page", Boolean(link) && new URL(link).pathname === "/delete-account")

	// 4. The link in a browser that isn't signed in: sign in first, then back to the same link.
	{
		const other = await newPage("desktop")
		await other.goto(link, { waitUntil: "load" })
		await hydrated(other)
		await other.waitForSelector("text=Sign in to delete your account")
		check("opening the link signed out deletes nothing", (await memberRows(owner.id)) === owner.rows)
		await shot(other, "06-link-signed-out-desktop")
		await other.setViewportSize(WIDTHS.phone)
		await shot(other, "06-link-signed-out-phone")
		await other.setViewportSize(WIDTHS.desktop)
		await other.getByRole("link", { name: "Sign in", exact: true }).filter({ visible: true }).last().click()
		await other.waitForURL(/\/sign-in\?redirectTo=/)
		await hydrated(other)
		await other.fill("#auth-email", owner.address)
		await other.fill("#auth-password", PASSWORD)
		await other.click("form:has(#auth-password) button[type=submit]")
		await other.waitForURL(/\/delete-account\?token=/, { timeout: 60000 })
		await hydrated(other)
		await other.waitForSelector("text=Delete your account for good?")
		check("signing in comes back to the link's confirmation page", true)
		check("opening the link signed in still deletes nothing", (await memberRows(owner.id)) === owner.rows)
		await shot(other, "07-confirm-link-desktop")
		await other.setViewportSize(WIDTHS.phone)
		await shot(other, "07-confirm-link-phone")
		await other.setViewportSize(WIDTHS.desktop)

		// 5. Pressing the button deletes: this device and the first one are signed out, and the rows are gone.
		await other.click("button:has-text('Delete my account')")
		await other.waitForSelector("text=Your account is deleted")
		check("the done page", true)
		check("this device is signed out", (await sessionOf(other)) === null)
		check("the other device is signed out", (await sessionOf(owner.page)) === null)
		check("no member row remains", (await memberRows(owner.id)) === 0)
		const reserved = await handleOwner(owner.id)
		check("the handle stays reserved without the member's id", reserved !== null && reserved !== owner.id, String(reserved))
		await shot(other, "08-deleted-desktop")
		await other.setViewportSize(WIDTHS.phone)
		await shot(other, "08-deleted-phone")
		const gone = (await waitForMail(owner.address, 3)).at(-1)
		check("an account-deleted email follows", gone.Subject === "Your GoodWatch account is deleted", gone.Subject)
		await emailShot(gone, "11-email-deleted")
		await other.context().close()
	}

	// 6. The same link again, for a new account with that address: it no longer works.
	{
		const again = await newPage("desktop")
		await go(again, "/sign-up")
		await again.fill("#auth-email", owner.address)
		await again.fill("#auth-password", PASSWORD)
		await again.click("form:has(#auth-password) button[type=submit]")
		await again.waitForURL(/verify-email\?state=sent/)
		const confirm = (await waitForMail(owner.address, 4)).at(-1)
		check("the address signs up again", confirm.Subject === "Confirm your email for GoodWatch", confirm.Subject)
		await again.goto(linkIn(confirm, "/api/auth/"), { waitUntil: "load" })
		await again.waitForURL(/verify-email\?state=confirmed/)
		const fresh = await sessionOf(again)
		check("the new account is a new member", fresh && fresh.id !== owner.id)
		await again.goto(link, { waitUntil: "load" })
		await hydrated(again)
		await again.click("button:has-text('Delete my account')")
		await again.waitForSelector("text=This link no longer works")
		check("a used link deletes nothing", (await sessionOf(again))?.id === fresh.id)
		await shot(again, "09-link-expired-desktop")
		await again.setViewportSize(WIDTHS.phone)
		await shot(again, "09-link-expired-phone")
		await again.setViewportSize(WIDTHS.desktop)

		// 7. With the password: deleted at once.
		await go(again, "/delete-account")
		await again.fill("#auth-password", PASSWORD)
		await again.click("form:has(#auth-password) button[type=submit]")
		await again.waitForSelector("text=Your account is deleted")
		check("the password deletes at once", (await sessionOf(again)) === null)
		await again.click("text=Back to GoodWatch")
		await again.waitForURL((url) => url.pathname === "/")
		check("Back to GoodWatch goes home signed out", (await sessionOf(again)) === null)
		await again.context().close()
	}

	// 8. A member who signs in with Google only: no password field, an email link instead.
	{
		const google = await member("google")
		await google.page.route("**/api/auth/list-accounts", (route) =>
			route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ providerId: "google", accountId: "1" }]) }),
		)
		await go(google.page, "/delete-account")
		await google.page.waitForSelector("text=You sign in with Google")
		check("a Google-only member gets no password field", !(await google.page.isVisible("#auth-password")))
		await shot(google.page, "12-google-only-desktop")
		await google.page.setViewportSize(WIDTHS.phone)
		await shot(google.page, "12-google-only-phone")
		await google.page.context().close()
	}

	// 9. Signed out without a link: sign-in first, back here afterwards.
	{
		const out = await newPage("desktop")
		await go(out, "/delete-account")
		await out.waitForURL(/\/sign-in\?redirectTo=%2Fdelete-account/)
		check("a signed-out visit goes to sign-in and back", true)
		await out.context().close()
	}
	await owner.page.context().close()
} catch (error) {
	check("drive finished", false, String(error?.stack ?? error))
	let n = 0
	for (const context of browser.contexts())
		for (const page of context.pages()) await page.screenshot({ path: `${OUT}/failure-${n++}.png`, fullPage: true }).catch(() => {})
} finally {
	await browser.close()
	writeFileSync(`${OUT}/drive-results.json`, JSON.stringify(results, null, 2))
	const failed = results.filter((r) => !r.ok)
	console.log(`${results.length - failed.length}/${results.length} checks passed`)
	if (failed.length) process.exitCode = 1
}
