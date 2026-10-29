import assert from "node:assert/strict"
import { test } from "node:test"
import { stubModules } from "../server/rating-onboarding.test-support.ts"

stubModules({
	"~/utils/auth": "export const getUserIdFromRequest=async()=>null",
	"~/server/user-settings.server": "export const getUserSettings=async()=>null",
	"~/server/cache-identity.server":
		"export const getLocaleFromRequest=()=>({locale:{language:'en'}})",
	"~/server/discover-country.server": "export const discoverCountry=()=> 'DE'",
})
const { buildDiscoverParams } = await import("./discover.ts")

test("Discover parameters normalize invalid, negative and non-finite pages", async () => {
	for (const [value, expected] of [
		["abc", 1],
		["", 1],
		["-5", 1],
		["0", 1],
		["Infinity", 1],
		["9".repeat(400), 1],
		["3", 3],
	] as const) {
		const result = await buildDiscoverParams(
			new Request(`https://goodwatch.test/discover?page=${value}`),
		)
		assert.equal(result.page, expected, value)
	}
})
