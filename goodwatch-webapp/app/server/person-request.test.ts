import assert from "node:assert/strict"
import { test } from "node:test"
import { createPersonRequestPolicy } from "./person-request.server.ts"
const request = (
	ip = "192.0.2.1",
	query = "minScore=70",
	ua = "Chrome/140",
) => ({
	method: "GET",
	url: "/person/287-brad-pitt?" + query,
	headers: { "x-real-ip": ip, "user-agent": ua, cookie: "gw_browser=1" },
})
test("one client burst gets 429 with Retry-After before profile work, while other clients keep working", async () => {
	const check = createPersonRequestPolicy({
		env: { PERSON_TRUSTED_IP_HEADER: "x-real-ip" },
		verify: async () => "unverified",
	})
	for (let n = 0; n < 30; n++) assert.equal(await check(request()), null)
	const refused = await check(request())
	assert.equal(refused?.status, 429)
	assert.equal(refused?.headers["Retry-After"], "10")
	assert.equal(await check(request("192.0.2.2")), null)
	assert.equal(
		(await check(request("192.0.2.1", "minScore=70", "Googlebot/2.1")))?.status,
		429,
	)
})

test("verified Google and Bing are never rate-limited, even with a browser UA, and DNS outages fail open", async () => {
	for (const result of ["google", "bing", "unknown"] as const) {
		let verifications = 0
		const check = createPersonRequestPolicy({
			env: { PERSON_TRUSTED_IP_HEADER: "x-real-ip" },
			verify: async () => {
				verifications++
				return result
			},
		})
		for (let n = 0; n < 150; n++) assert.equal(await check(request()), null)
		assert.ok(verifications > 0)
	}
})
test("enumeration across people is limited, while normal filtering of one person remains available", async () => {
	let now = 0
	const check = createPersonRequestPolicy({
		now: () => now,
		env: { PERSON_TRUSTED_IP_HEADER: "x-real-ip" },
		verify: async () => "unverified",
	})
	for (let n = 1; n <= 20; n++)
		assert.equal(
			await check({ ...request(), url: `/person/${n}-p?minScore=70` }),
			null,
		)
	assert.equal(
		(await check({ ...request(), url: "/person/21-p?minScore=70" }))?.status,
		429,
	)
	assert.equal(await check(request("192.0.2.2")), null)
	now = 60_000
	assert.equal(await check(request()), null)
})
test("sustained filtering has a minute budget, uses the configured fallback, and recovers after expiry", async () => {
	let now = 0
	const check = createPersonRequestPolicy({
		now: () => now,
		env: {
			PERSON_TRUSTED_IP_HEADER: "",
			SEARCH_TRUSTED_IP_HEADER: "X-Real-IP",
		},
		verify: async () => "unverified",
	})
	for (let window = 0; window < 4; window++) {
		now = window * 10_000
		for (let n = 0; n < 30; n++) assert.equal(await check(request()), null)
	}
	now = 40_000
	const answer = await check(request())
	assert.equal(answer?.status, 429)
	assert.equal(answer?.headers["Retry-After"], "20")
	now = 60_000
	assert.equal(await check(request()), null)
})
test("rotating addresses cannot indefinitely enumerate deep filter combinations across people", async () => {
	const check = createPersonRequestPolicy({
		env: { PERSON_TRUSTED_IP_HEADER: "x-real-ip" },
		verify: async () => "unverified",
	})
	for (let n = 1; n <= 60; n++)
		assert.equal(
			await check({
				...request(`192.0.2.${n}`, "genre=Drama&trait=crime&minScore=70"),
				url: `/person/${n}-p?genre=Drama&trait=crime&minScore=70`,
			}),
			null,
		)
	assert.equal(
		(await check(request("192.0.2.61", "genre=Drama&trait=crime&minScore=70")))
			?.status,
		429,
	)
	assert.equal(await check(request("192.0.2.62")), null)
})
test("untrusted forwarding and missing identity never merge clients; IPv6 /64 shares a budget", async () => {
	const unkeyed = createPersonRequestPolicy({
		env: {},
		verify: async () => {
			throw new Error("must not verify spoofed header")
		},
	})
	for (let n = 0; n < 40; n++) assert.equal(await unkeyed(request()), null)
	const keyed = createPersonRequestPolicy({
		env: { PERSON_TRUSTED_IP_HEADER: "x-real-ip" },
		verify: async () => "unverified",
	})
	for (let n = 0; n < 30; n++)
		assert.equal(await keyed(request("2001:db8::1")), null)
	assert.equal((await keyed(request("2001:db8::2")))?.status, 429)
	assert.equal(await keyed(request("192.0.2.1, 192.0.2.2")), null)
})
test("normalization happens before work, retains fragments through navigation, and preserves Remix redirect protocol", async () => {
	const check = createPersonRequestPolicy({ env: {} })
	assert.equal(
		(await check(request("192.0.2.1", "x=anything&genre=Drama&minScore=070")))
			?.headers.Location,
		"/person/287-brad-pitt?genre=Drama&minScore=70",
	)
	const data = await check(
		request("192.0.2.1", "x=1&_data=routes%2Fperson.%24personKey"),
	)
	assert.equal(data?.status, 204)
	assert.equal(data?.headers["X-Remix-Redirect"], "/person/287-brad-pitt")
	assert.equal(
		await check(request("192.0.2.1", "_data=routes%2Fperson.%24personKey")),
		null,
	)
	assert.equal(await check({ ...request(), method: "POST" }), null)
	assert.equal(
		await check({ ...request(), url: "/movie/603-the-matrix?minScore=70" }),
		null,
	)
})
