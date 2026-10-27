// Real loopback HTTP, production early middleware + profile admission, synthetic cache/database boundary.
// No app boot, dotenv, Redis, SQL, or background jobs. Safe without any local service or credential.
import assert from "node:assert/strict"
import { test } from "node:test"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { putGateFirst } from "../../app/server/browser-gate.server.ts"
import { createPersonRequestPolicy } from "../../app/server/person-request.server.ts"
import { createPersonProfileCache } from "../../app/server/person-profile-cache.server.ts"
import { createSearchBotVerifier } from "../../app/server/search-bot-verification.server.ts"

test("filtered HTTP load: warm/coalesced requests exceed old four slots, cold work stays bounded, abuse gets 429", async () => {
	let active = 0,
		peak = 0,
		calls = 0,
		appRequests = 0
	const profiles = createPersonProfileCache({
		read: async (id, load) => (id === 1 ? { id } : load()),
		load: async (id) => {
			calls++
			peak = Math.max(peak, ++active)
			await new Promise((r) => setTimeout(r, 40))
			active--
			return { id }
		},
	})
	const verify = createSearchBotVerifier({
		resolver: () => ({
			reverse: async (ip) =>
				ip === "192.0.2.254"
					? ["crawler.search.msn.com"]
					: ["ordinary.example.test"],
			resolve4: async () => ["192.0.2.254"],
			resolve6: async () => [],
			cancel() {},
		}),
	})
	const policy = createPersonRequestPolicy({
		env: { PERSON_TRUSTED_IP_HEADER: "x-real-ip" },
		verify,
	})
	const server = createServer(async (req, res) => {
		appRequests++
		try {
			const profile = await profiles.get(
				Number(req.url!.split("/")[2].split("-")[0]),
			)
			res.writeHead(200, { "Content-Type": "application/json" })
			res.end(JSON.stringify(profile))
		} catch (error) {
			if (!(error instanceof Response)) throw error
			res.writeHead(error.status, Object.fromEntries(error.headers))
			res.end(await error.text())
		}
	})
	putGateFirst(server, () => false, policy)
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
	const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
	const get = async (id: number, ip: string) => {
		const r = await fetch(
			`${origin}/person/${id}-p?minScore=70&_data=routes%2Fperson.%24personKey`,
			{
				headers: {
					"x-real-ip": ip,
					cookie: "gw_browser=1",
					"user-agent": "Chrome/140",
				},
				redirect: "manual",
			},
		)
		await r.text()
		return { status: r.status, retry: r.headers.get("Retry-After") }
	}
	const counts = (r: { status: number }[]) =>
		r.reduce<Record<string, number>>((a, r) => {
			a[r.status] = (a[r.status] ?? 0) + 1
			return a
		}, {})
	try {
		const started = performance.now()
		const warm = await Promise.all(
			Array.from({ length: 32 }, (_, i) => get(1, `198.18.0.${i + 1}`)),
		)
		assert.deepEqual(counts(warm), { "200": 32 })
		assert.equal(calls, 0)
		const coalesced = await Promise.all(
			Array.from({ length: 32 }, (_, i) => get(2, `198.18.1.${i + 1}`)),
		)
		assert.deepEqual(counts(coalesced), { "200": 32 })
		assert.equal(calls, 1)
		const cold = await Promise.all(
			Array.from({ length: 32 }, (_, i) => get(100 + i, `198.18.2.${i + 1}`)),
		)
		assert.deepEqual(counts(cold), { "200": 32 })
		assert.equal(peak, 4)
		const before = appRequests
		const burst = await Promise.all(
			Array.from({ length: 60 }, () => get(1, "192.0.2.1")),
		)
		assert.deepEqual(counts(burst), { "200": 30, "429": 30 })
		assert.equal(
			appRequests - before,
			30,
			"refused requests never reach the app",
		)
		assert.ok(
			burst.filter((r) => r.status === 429).every((r) => Number(r.retry) > 0),
		)
		const bot = await Promise.all(
			Array.from({ length: 60 }, () => get(1, "192.0.2.254")),
		)
		assert.deepEqual(counts(bot), { "200": 60 })
		console.log(
			JSON.stringify({
				warm: counts(warm),
				coalesced: counts(coalesced),
				cold: counts(cold),
				burst: counts(burst),
				verifiedBing: counts(bot),
				peakColdLoads: peak,
				backendLoads: calls,
				elapsedMs: Math.round(performance.now() - started),
			}),
		)
	} finally {
		server.closeAllConnections()
		await new Promise<void>((resolve) => server.close(() => resolve()))
	}
})
