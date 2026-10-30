import assert from "node:assert/strict"
import { test } from "node:test"
import { recommendationsResource } from "./resource.ts"
const request = (query = "") => ({
	request: new Request(`https://goodwatch.test/api/trope-recs${query}`),
})

test("unauthenticated requests never read member data", async () => {
	const loader = recommendationsResource({
		authenticate: async () => null,
		load: async () => {
			throw Error("must not load")
		},
	})
	const result = await loader(request())
	assert.equal(result.status, 401)
	assert.equal(result.headers.get("Cache-Control"), "private, no-store")
	assert.equal(result.headers.get("Vary"), "Cookie")
})

test("owner always comes from session; kind and trope are passed through", async () => {
	const loader = recommendationsResource({
		authenticate: async () => "session-member",
		load: async (user, kind, trope) => {
			assert.equal(user, "session-member")
			assert.equal(kind, "show")
			assert.equal(trope, "uri")
			return { pending: false }
		},
	})
	assert.equal(
		(await loader(request("?member=other&userId=other&kind=show&trope=uri")))
			.status,
		200,
	)
})

test("invalid parameters and tropes outside the profile return 400", async () => {
	let calls = 0
	const loader = recommendationsResource({
		authenticate: async () => "member",
		load: async () => {
			calls++
			throw new RangeError("Not in profile")
		},
	})
	assert.equal((await loader(request("?kind=tv"))).status, 400)
	assert.equal(calls, 0)
	assert.equal((await loader(request("?trope=foreign"))).status, 400)
	assert.equal(calls, 1)
})

test("cold work is represented as pending with a retry interval; failures stay failures", async () => {
	const loader = recommendationsResource({
		authenticate: async () => "member",
		load: async () => ({ pending: true }),
	})
	const result = await loader(request())
	assert.equal(result.status, 202)
	assert.equal(result.headers.get("Retry-After"), "2")
	const failing = recommendationsResource({
		authenticate: async () => "member",
		load: async () => {
			throw Error("unavailable")
		},
	})
	await assert.rejects(failing(request()), /unavailable/)
})
