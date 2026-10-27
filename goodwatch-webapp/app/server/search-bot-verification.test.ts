import assert from "node:assert/strict"
import { test } from "node:test"
import { createSearchBotVerifier } from "./search-bot-verification.server.ts"

test("bot exemption needs the correct reverse suffix AND a forward match, independent of UA", async () => {
	let reverse = 0
	const verify = createSearchBotVerifier({
		resolver: () => ({
			reverse: async (ip: string) => {
				reverse++
				return [
					ip.endsWith(".1")
						? "crawl.example.googlebot.com"
						: ip.endsWith(".2")
							? "bot.search.msn.com"
							: "googlebot.com.attacker.test",
				]
			},
			resolve4: async () => ["192.0.2.1"],
			resolve6: async () => [],
			cancel() {},
		}),
	})
	assert.equal(await verify("192.0.2.1"), "google")
	assert.equal(await verify("192.0.2.2"), "unverified")
	assert.equal(await verify("192.0.2.3"), "unverified")
	assert.equal(await verify("192.0.2.1"), "google")
	assert.equal(reverse, 3)
})

test("Bing and IPv6 Google verification are coalesced, cached and rechecked after expiry", async () => {
	let now = 0,
		reverse = 0
	const verify = createSearchBotVerifier({
		now: () => now,
		positiveMs: 10,
		resolver: () => ({
			reverse: async (ip: string) => {
				reverse++
				await new Promise((r) => setImmediate(r))
				return [
					ip.includes(":")
						? "crawl.example.googlebot.com."
						: "crawler.search.msn.com",
				]
			},
			resolve4: async () => ["192.0.2.2"],
			resolve6: async () => ["2001:db8:0:0:0:0:0:1"],
			cancel() {},
		}),
	})
	assert.deepEqual(
		await Promise.all(Array.from({ length: 20 }, () => verify("2001:db8::1"))),
		Array(20).fill("google"),
	)
	assert.equal(reverse, 1)
	assert.equal(await verify("192.0.2.2"), "bing")
	now = 11
	assert.equal(await verify("2001:db8::1"), "google")
	assert.equal(reverse, 3)
})
test("DNS work is bounded and cancelled on timeout; unavailable DNS is never a negative bot verdict", async () => {
	let cancelled = 0
	const verify = createSearchBotVerifier({
		maxPending: 1,
		timeoutMs: 10,
		resolver: () => ({
			reverse: () => new Promise<string[]>(() => {}),
			resolve4: async () => [],
			resolve6: async () => [],
			cancel() {
				cancelled++
			},
		}),
	})
	const first = verify("192.0.2.1")
	assert.equal(await verify("192.0.2.2"), "unknown")
	assert.equal(await first, "unknown")
	assert.equal(cancelled, 1)
	assert.equal(await verify("invalid"), "unverified")
})
