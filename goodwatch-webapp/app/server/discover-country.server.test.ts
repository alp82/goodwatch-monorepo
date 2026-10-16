import assert from "node:assert/strict"
import { test } from "node:test"

const { discoverCountry } = await import("./discover-country.server.ts")

const googlebot =
	"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
const request = (path: string, headers: Record<string, string> = {}) =>
	new Request(`http://localhost${path}`, { headers })

test("a crawler that names no country gets the US, so the streaming filter applies", () => {
	assert.equal(
		discoverCountry(
			request("/movies/streaming/netflix", { "User-Agent": googlebot }),
		),
		"US",
	)
})

test("a visitor without a country parameter or a saved country gets the request's country", () => {
	assert.equal(
		discoverCountry(
			request("/movies/streaming/netflix", {
				"Accept-Language": "de-DE,de;q=0.9",
			}),
		),
		"DE",
	)
	assert.equal(
		discoverCountry(
			request("/movies/streaming/netflix", {
				"GW-Cache-Identity": "anon;GB;en",
			}),
		),
		"GB",
	)
})

test("the country parameter wins, then a member's saved country", () => {
	const german = { "Accept-Language": "de-DE" }
	assert.equal(
		discoverCountry(
			request("/movies/streaming/netflix?country=FR", german),
			"IT",
		),
		"FR",
	)
	assert.equal(
		discoverCountry(request("/movies/streaming/netflix", german), "IT"),
		"IT",
	)
})
