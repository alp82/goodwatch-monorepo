import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { chromium } from "playwright"
const authUrl = process.argv[2]
if (
	!authUrl?.startsWith("http://127.0.0.1:3356/") &&
	!authUrl?.startsWith("http://localhost:3356/")
)
	throw new Error("Local OAuth URL required")
const fixture = JSON.parse(
	readFileSync(new URL("../results/member.json", import.meta.url), "utf8"),
)
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
page.on("response", (r) => {
	if (new URL(r.url()).origin === "http://127.0.0.1:3356")
		console.log(
			JSON.stringify({ path: new URL(r.url()).pathname, status: r.status() }),
		)
})
try {
	await page.goto(authUrl)
	await page.locator('input[name="email"]').fill(fixture.email)
	await page.locator('input[name="password"]').fill(fixture.password)
	await page.getByRole("button", { name: "Sign in", exact: true }).click()
	await page
		.getByRole("button", { name: "Allow", exact: true })
		.waitFor({ timeout: 10000 })
	const unverified = await page
		.locator("body")
		.innerText()
		.then((text) => text.includes("Unverified app."))
	if (process.env.EXPECT_DCR === "1") assert.equal(unverified, true)
	if (process.env.EXPECT_CIMD === "1") assert.equal(unverified, false)
	await page.getByRole("button", { name: "Allow", exact: true }).click()
	await page.waitForURL((url) => [6276, 6277].includes(Number(url.port)), {
		timeout: 30000,
	})
	const callback = new URL(page.url())
	assert.equal(
		callback.searchParams.get("iss"),
		"http://127.0.0.1:3356/api/auth",
	)
	assert.ok(callback.searchParams.get("code"))
	console.log(
		JSON.stringify({
			browserLogin: "PASS",
			consent: "PASS",
			registration: unverified ? "DCR-unverified" : "CIMD",
			issuer: "PASS",
			callbackPort: callback.port,
		}),
	)
} catch (error) {
	console.error(
		JSON.stringify({
			path: new URL(page.url()).pathname,
			body: (await page.locator("body").innerText()).slice(0, 500),
		}),
	)
	throw error
} finally {
	await browser.close()
}
