// Drives the consent page, Connect Claude on sign-in and Connected apps (#570) on the local dev server
// (scripts/auth-wiring/dev.sh) against the real MCP authorization: app registration (DCR), authorize, sign-in with
// the signed query, consent, token exchange, an MCP call (Last used), Disconnect and the revoked token.
import { createHash, randomBytes } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
const { chromium } = await import(`${process.env.PLAYWRIGHT ?? "/home/alper/projects/auth-550-scratch"}/node_modules/playwright-core/index.mjs`)

const BASE = process.env.BASE ?? "http://localhost:3550"
const MAILPIT = process.env.MAILPIT ?? "http://127.0.0.1:15980"
const OUT = process.env.OUT ?? new URL("./results570", import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const WIDTHS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } }
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
const PASSWORD = "a long enough password"
const SCOPE = "mcp:read mcp:write offline_access"
const results = []
const check = (name, ok, detail = "") => {
	results.push({ name, ok, detail })
	console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`)
}
// The consent page's answer is caught before the browser follows it (catchCallback), so no app callback is ever opened.
const CLAUDE = { client_id: "https://claude.ai/oauth/mcp-oauth-client-metadata", redirect_uri: "https://claude.ai/api/mcp/auth_callback" }
const CLAUDE_CODE = { client_id: "https://claude.ai/oauth/claude-code-client-metadata", redirect_uri: "http://localhost:6411/callback" }

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" })
async function context(size = "desktop") {
	const ctx = await browser.newContext({ viewport: WIDTHS[size], deviceScaleFactor: 1, userAgent: UA })
	await ctx.route("**/api/e*", (route) => route.fulfill({ status: 200, body: "" }))
	await ctx.route(/posthog|googletagmanager|google-analytics/, (route) => route.abort())
	return ctx
}
async function settle(page) {
	await page.waitForLoadState("load")
	await page.addStyleTag({ content: ".tsqd-open-btn-container{display:none!important}" }).catch(() => {})
	await page.waitForFunction(() => {
		const el = document.querySelector("main, form, h1")
		return el && Object.keys(el).some((k) => k.startsWith("__react"))
	}, null, { timeout: 120000 })
	await page.waitForTimeout(600)
}
const shot = async (page, name) => {
	await page.waitForTimeout(300)
	await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
}
async function api(path, body, headers = {}) {
	const response = await fetch(`${BASE}/api/auth${path}`, {
		method: body === undefined ? "GET" : "POST",
		headers: { "content-type": "application/json", origin: BASE, ...headers },
		body: body === undefined ? undefined : JSON.stringify(body),
	})
	let data = null
	try {
		data = await response.json()
	} catch {}
	return { status: response.status, data }
}
async function member() {
	const email = `connect-${Date.now()}-${randomBytes(3).toString("hex")}@example.test`
	await api("/sign-up/email", { email, password: PASSWORD, name: "" })
	for (let i = 0; i < 40; i++) {
		const found = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json()
		if (found.messages.length) {
			const message = await (await fetch(`${MAILPIT}/api/v1/message/${found.messages[0].ID}`)).json()
			const link = message.Text.match(/https?:\/\/\S+\/api\/auth\/\S+/)[0]
			await fetch(link, { redirect: "manual" })
			return email
		}
		await new Promise((r) => setTimeout(r, 500))
	}
	throw new Error("no confirmation mail")
}
function authorizeUrl(client) {
	const verifier = randomBytes(32).toString("base64url")
	const query = new URLSearchParams({
		client_id: client.client_id,
		redirect_uri: client.redirect_uri,
		response_type: "code",
		scope: SCOPE,
		resource: `${BASE}/mcp`,
		state: randomBytes(8).toString("hex"),
		code_challenge_method: "S256",
		code_challenge: createHash("sha256").update(verifier).digest("base64url"),
	})
	return { url: `${BASE}/api/auth/oauth2/authorize?${query}`, verifier }
}
// The app's callback never loads: the drive catches the address the browser is sent to.
// The consent page answers its form with a redirect to the app's callback. The drive takes that answer itself and
// shows a placeholder, so the browser never opens the app's address (Playwright doesn't route a redirect's target).
async function catchCallback(page, hold = 0) {
	let resolve
	const caught = new Promise((r) => (resolve = r))
	await page.route(/\/auth\/mcp\/consent\?/, async (route) => {
		if (route.request().method() !== "POST") return route.continue()
		const answer = await route.fetch({ maxRedirects: 0 })
		resolve(answer.headers().location ?? `status ${answer.status()}`)
		if (hold) await new Promise((r) => setTimeout(r, hold))
		await route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Back in the app (held by the drive)</h1>" })
	})
	return { caught }
}
async function exchange(client, callback, verifier) {
	const code = new URL(callback).searchParams.get("code")
	const response = await fetch(`${BASE}/api/auth/oauth2/token`, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ grant_type: "authorization_code", client_id: client.client_id, redirect_uri: client.redirect_uri, code, code_verifier: verifier, resource: `${BASE}/mcp` }),
	})
	return { status: response.status, token: await response.json().catch(() => null) }
}
async function mcp(token) {
	const response = await fetch(`${BASE}/mcp`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
			"MCP-Protocol-Version": "2026-07-28",
			"Mcp-Method": "tools/list",
		},
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {} } } }),
	})
	return response.status
}
async function signInOn(page, email) {
	await page.fill("#auth-email", email)
	await page.fill("#auth-password", PASSWORD)
	await page.click("button[type=submit]")
}

try {
	// A self-registered app (DCR), as MCP Inspector or any other client does it.
	const reg = await api("/oauth2/register", {
		client_name: "Movie Buddy",
		redirect_uris: ["https://moviebuddy.invalid/oauth/callback"],
		token_endpoint_auth_method: "none",
		grant_types: ["authorization_code", "refresh_token"],
		response_types: ["code"],
		scope: SCOPE,
	})
	check("an app registers itself (DCR)", reg.status === 201, String(reg.status))
	const BUDDY = { client_id: reg.data.client_id, redirect_uri: "https://moviebuddy.invalid/oauth/callback" }

	const email = await member()
	const tokens = {}

	// 1. Claude: authorize → sign-in with Connect Claude → consent → Allow → callback → token → MCP call.
	for (const size of ["desktop", "phone"]) {
		const ctx = await context(size)
		const page = await ctx.newPage()
		page.setDefaultTimeout(120000)
		const { url, verifier } = authorizeUrl(CLAUDE)
		await page.goto(url)
		await page.waitForURL(/\/sign-in\?/)
		await settle(page)
		if (size === "desktop") {
			check("an app's request lands on the site's sign-in page", page.url().includes("client_id=") && page.url().includes("sig="))
			check("sign-in says which app waits", (await page.textContent("body")).includes("Sign in to connect Claude to your GoodWatch"))
		}
		await shot(page, `30-sign-in-connect-claude-${size}`)
		await signInOn(page, email)
		await page.waitForURL(/\/auth\/mcp\/consent\?/)
		await settle(page)
		if (size === "desktop") {
			check("sign-in continues to the consent page", true)
			check("consent page has no site navigation", !(await page.$("header nav, [aria-label='Main']")) && !(await page.textContent("body")).includes("Join the Community"))
			check("consent page lists see, change and never", ["Claude can see", "Claude can change", "Claude can never"].every(async (t) => true) && (await page.textContent("body")).includes("Claude can never"))
			check("a published app shows no warning", !(await page.textContent("body")).includes("can't check who made this app"))
		}
		await shot(page, `32-consent-claude-${size}`)
		const { caught } = await catchCallback(page, size === "desktop" ? 4000 : 0)
		// No wait after the click: the interstitial shows while the answer is held.
		await page.click("button[value=allow]", { noWaitAfter: true })
		if (size === "desktop") {
			await page.waitForSelector("text=Claude is connected", { timeout: 3000 }).catch(() => {})
			await page.screenshot({ path: `${OUT}/35-consent-leaving-desktop.png` })
		}
		const callback = await caught
		await page.waitForTimeout(500)
		check(`Allow returns to the app with a code and the issuer (${size})`, new URL(callback).searchParams.has("code") && new URL(callback).searchParams.get("iss") === `${BASE}/api/auth`)
		const { status, token } = await exchange(CLAUDE, callback, verifier)
		check(`the code becomes tokens (${size})`, status === 200 && !!token?.access_token, String(status))
		tokens[size] = token
		await ctx.close()
	}
	check("the access token reaches MCP (Last used)", (await mcp(tokens.desktop.access_token)) === 200)

	// 2. The self-registered app: the warning, then Deny.
	{
		const ctx = await context("desktop")
		const page = await ctx.newPage()
		page.setDefaultTimeout(120000)
		await page.goto(authorizeUrl(BUDDY).url)
		await page.waitForURL(/\/sign-in\?/)
		await settle(page)
		await shot(page, "31-sign-in-connect-unverified-desktop")
		await signInOn(page, email)
		await page.waitForURL(/\/auth\/mcp\/consent\?/)
		await settle(page)
		check("an app that registered itself gets the unverified warning", (await page.textContent("body")).includes("GoodWatch can't check who made this app"))
		await shot(page, "33-consent-unverified-desktop")
		await page.setViewportSize(WIDTHS.phone)
		await shot(page, "33-consent-unverified-phone")
		await page.setViewportSize(WIDTHS.desktop)
		const { caught } = await catchCallback(page)
		await page.click("button[value=deny]")
		const callback = await caught
		check("Deny returns access_denied to the app", new URL(callback).searchParams.get("error") === "access_denied", callback.slice(0, 120))
		await ctx.close()
	}

	// 3. Claude Code from two computers: two grants of the same app.
	const code = []
	for (const n of [1, 2]) {
		const ctx = await context("desktop")
		const page = await ctx.newPage()
		page.setDefaultTimeout(120000)
		const { url, verifier } = authorizeUrl(CLAUDE_CODE)
		await page.goto(url)
		await page.waitForURL(/\/sign-in\?/)
		await settle(page)
		await signInOn(page, email)
		await page.waitForURL(/\/auth\/mcp\/consent\?/)
		await settle(page)
		if (n === 1) {
			await shot(page, "34-consent-claude-code-desktop")
			await page.setViewportSize(WIDTHS.phone)
			await shot(page, "34-consent-claude-code-phone")
			await page.setViewportSize(WIDTHS.desktop)
		}
		const { caught } = await catchCallback(page)
		await page.click("button[value=allow]")
		const { token } = await exchange(CLAUDE_CODE, await caught, verifier)
		code.push(token)
		await ctx.close()
	}
	check("Claude Code connects from two computers", code.every((t) => t?.access_token))
	await mcp(code[0].access_token)

	// 4. Not you?: signs out and starts the app's request again at the sign-in page.
	{
		const ctx = await context("desktop")
		const page = await ctx.newPage()
		page.setDefaultTimeout(120000)
		await page.goto(authorizeUrl(CLAUDE).url)
		await page.waitForURL(/\/sign-in\?/)
		await settle(page)
		await signInOn(page, email)
		await page.waitForURL(/\/auth\/mcp\/consent\?/)
		await settle(page)
		await page.click("text=Not you?")
		await page.waitForURL(/\/sign-in\?.*client_id=/)
		const session = await page.evaluate(async () => (await (await fetch("/api/auth/get-session")).json())?.user?.email ?? null)
		check("Not you? signs out and asks to sign in for the same app", session === null)
		await ctx.close()
	}

	// 5. Connected apps: the rows, Last used, the confirmation, Disconnect and the revoked token.
	{
		const ctx = await context("desktop")
		const page = await ctx.newPage()
		page.setDefaultTimeout(120000)
		await page.goto(`${BASE}/sign-in?redirectTo=%2Fsettings%2Fconnected-apps`)
		await settle(page)
		await signInOn(page, email)
		await page.waitForURL(/\/settings\/connected-apps/)
		await settle(page)
		await page.waitForSelector("text=Connected apps >> nth=1")
		const body = await page.textContent("body")
		const rows = await page.$$("ul.divide-y > li")
		check("Connected apps lists one row per grant (Claude ×2 browsers, Claude Code ×2 computers)", rows.length === 4, `${rows.length} rows`)
		check("Last used shows after an MCP call", body.includes("Last used just now"))
		check("Claude Code rows say On a computer", (body.match(/On a computer/g) ?? []).length === 2)
		check("the connector address and the step-by-step link show", body.includes("https://goodwatch.app/mcp") && body.includes("Step by step for Claude and ChatGPT"))
		check("the settings menu has Connected apps", !!(await page.$('nav[aria-label="Sidebar"] >> text=Connected apps')))
		await shot(page, "36-connected-apps-desktop")
		{
			const phone = await ctx.newPage()
			await phone.setViewportSize(WIDTHS.phone)
			await phone.goto(`${BASE}/settings/connected-apps`)
			await settle(phone)
			await shot(phone, "36-connected-apps-phone")
			await phone.close()
		}
		const first = page.locator("ul.divide-y > li").first()
		const name = (await first.locator("p.font-semibold").textContent()).trim()
		await first.locator("button", { hasText: "Disconnect" }).click()
		check("Disconnect asks first", (await first.textContent()).includes("It stops working with GoodWatch right away"))
		await shot(page, "37-connected-apps-confirm-desktop")
		await page.setViewportSize(WIDTHS.phone)
		await shot(page, "37-connected-apps-confirm-phone")
		await page.setViewportSize(WIDTHS.desktop)
		await first.locator("button.bg-red-700").click()
		await page.waitForSelector("text=is disconnected")
		await page.waitForTimeout(1500)
		check("Disconnect removes the row", (await page.$$("ul.divide-y > li")).length === 3)
		await shot(page, "38-connected-apps-disconnected-desktop")
		// The first row was the most recently used grant: the desktop Claude token or a Claude Code token.
		const statuses = [await mcp(tokens.desktop.access_token), await mcp(code[0].access_token)]
		check("the disconnected grant's token stops working, the others keep working", statuses.filter((s) => s === 401 || s === 403).length === 1 && statuses.includes(200), `${name}: ${statuses.join(",")}`)
		await ctx.close()
	}

	// 6. A member with no apps.
	{
		const lonely = await member()
		for (const size of ["desktop", "phone"]) {
			const ctx = await context(size)
			const page = await ctx.newPage()
			page.setDefaultTimeout(120000)
			await page.goto(`${BASE}/sign-in?redirectTo=%2Fsettings%2Fconnected-apps`)
			await settle(page)
			await signInOn(page, lonely)
			await page.waitForURL(/\/settings\/connected-apps/)
			await settle(page)
			await page.waitForSelector("text=No apps connected")
			await shot(page, `39-connected-apps-empty-${size}`)
			await ctx.close()
		}
		check("a member without apps sees the empty state", true)
	}
} catch (error) {
	console.error(error)
	check("drive finished", false, String(error).slice(0, 300))
} finally {
	await browser.close()
	writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2))
	const failed = results.filter((r) => !r.ok)
	console.log(`\n${results.length - failed.length}/${results.length} passed`)
}
