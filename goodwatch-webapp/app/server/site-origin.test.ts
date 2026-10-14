// Which requests count as the site's own (site-origin.server.ts), with and without a configured origin.
import assert from "node:assert/strict"
import { afterEach, describe, test } from "node:test"
import { hasSiteOrigin, isSiteRequest, siteOrigin } from "./site-origin.server.ts"

const env = { APP_ORIGIN: process.env.APP_ORIGIN, NODE_ENV: process.env.NODE_ENV }
afterEach(() => {
	for (const [name, value] of Object.entries(env)) {
		if (value === undefined) Reflect.deleteProperty(process.env, name)
		else process.env[name] = value
	}
})
const configure = (appOrigin: string | undefined, nodeEnv: "development" | "production") => {
	if (appOrigin === undefined) Reflect.deleteProperty(process.env, "APP_ORIGIN")
	else process.env.APP_ORIGIN = appOrigin
	process.env.NODE_ENV = nodeEnv
}
const post = (headers: Record<string, string>) =>
	new Request("http://10.0.0.5:3000/api/combined-search", { method: "POST", headers })

const SITE = "https://goodwatch.app"

describe("the site's origin", () => {
	test("production without APP_ORIGIN is goodwatch.app", () => {
		configure(undefined, "production")
		assert.equal(siteOrigin(), SITE)
	})
	test("APP_ORIGIN wins in any mode", () => {
		configure("https://staging.example", "production")
		assert.equal(siteOrigin(), "https://staging.example")
		configure("http://localhost:3107", "development")
		assert.equal(siteOrigin(), "http://localhost:3107")
	})
	test("development without APP_ORIGIN has none, so port 3003 is not trusted", () => {
		configure(undefined, "development")
		assert.equal(siteOrigin(), null)
		assert.equal(isSiteRequest(post({ Origin: "http://localhost:3003" })), false)
		assert.equal(isSiteRequest(post({ "Sec-Fetch-Site": "same-origin" })), false)
		assert.equal(isSiteRequest(post({ Referer: "http://localhost:3003/discover" })), false)
		assert.equal(hasSiteOrigin(post({ Origin: "http://localhost:3003" })), false)
		assert.equal(hasSiteOrigin(post({})), false)
	})
})

describe("isSiteRequest with a configured origin", () => {
	const cases: [string, Record<string, string>, boolean][] = [
		["no headers at all (curl, a script)", {}, false],
		["the right Origin", { Origin: SITE }, true],
		["the right Origin from a browser", { Origin: SITE, "Sec-Fetch-Site": "same-origin" }, true],
		["a wrong Origin", { Origin: "https://evil.example" }, false],
		["the right host on http", { Origin: "http://goodwatch.app" }, false],
		["a subdomain", { Origin: "https://static.goodwatch.app" }, false],
		["Origin null (a sandboxed frame, a redirect)", { Origin: "null" }, false],
		["a wrong Origin with a right Referer", { Origin: "https://evil.example", Referer: `${SITE}/` }, false],
		["Sec-Fetch-Site same-origin without Origin", { "Sec-Fetch-Site": "same-origin" }, true],
		["Sec-Fetch-Site cross-site", { "Sec-Fetch-Site": "cross-site" }, false],
		["Sec-Fetch-Site cross-site with the right Origin", { "Sec-Fetch-Site": "cross-site", Origin: SITE }, false],
		["Sec-Fetch-Site same-site (a subdomain)", { "Sec-Fetch-Site": "same-site", Referer: `${SITE}/` }, false],
		["Sec-Fetch-Site none (typed or bookmarked)", { "Sec-Fetch-Site": "none" }, false],
		["Sec-Fetch-Site same-origin with a wrong Origin", { "Sec-Fetch-Site": "same-origin", Origin: "https://evil.example" }, false],
		["an old browser: only a Referer on the site", { Referer: `${SITE}/discover?q=heist` }, true],
		["a Referer on another site", { Referer: "https://evil.example/goodwatch.app" }, false],
		["a Referer on a lookalike host", { Referer: "https://goodwatch.app.evil.example/" }, false],
		["a Referer that is no URL", { Referer: "goodwatch.app" }, false],
	]
	for (const [name, headers, expected] of cases)
		test(name, () => {
			configure(undefined, "production")
			assert.equal(isSiteRequest(post(headers)), expected)
		})
	test("APP_ORIGIN replaces goodwatch.app", () => {
		configure("http://localhost:3107", "development")
		assert.equal(isSiteRequest(post({ Origin: "http://localhost:3107" })), true)
		assert.equal(isSiteRequest(post({ Origin: SITE })), false)
		assert.equal(isSiteRequest(post({ Referer: "http://localhost:3107/" })), true)
		assert.equal(isSiteRequest(post({})), false)
	})
})

describe("hasSiteOrigin stays strict", () => {
	test("only the exact Origin passes", () => {
		configure(undefined, "production")
		assert.equal(hasSiteOrigin(post({ Origin: SITE })), true)
		assert.equal(hasSiteOrigin(post({})), false)
		assert.equal(hasSiteOrigin(post({ "Sec-Fetch-Site": "same-origin" })), false)
		assert.equal(hasSiteOrigin(post({ Referer: `${SITE}/` })), false)
		assert.equal(hasSiteOrigin(post({ Origin: "https://evil.example" })), false)
	})
})
