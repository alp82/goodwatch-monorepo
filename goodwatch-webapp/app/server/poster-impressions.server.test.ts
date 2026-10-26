import assert from "node:assert/strict"
import { test } from "node:test"
import { recordTitleDemand } from "./poster-impressions.server.ts"

const visitorId = "4c972614-eac6-4b46-ae79-256e387668ff"
const movie = { media_type: "movie", tmdb_id: 162483 }
const request = (items: unknown[], extra = {}) => new Request("https://goodwatch.app/api/poster-impressions", {
	method: "POST", headers: { "Content-Type": "application/json", Origin: "https://goodwatch.app" }, body: JSON.stringify({ visitorId, items, ...extra }),
})
function fixture() {
	let now = 0
	const seen = new Map<string, number>()
	const writes: unknown[][] = []
	const deps = {
		hasSiteOrigin: () => true,
		getRedisCluster: () => ({ set: async (key: string, _value: string, _expiry: "EX", seconds: number, _mode: "NX") => {
			if ((seen.get(key) ?? -1) > now) return null
			seen.set(key, now + seconds * 1000)
			return "OK"
		} }),
		rateLimiter: { take: async () => ({ allowed: true, retryAfterSeconds: 0 }) },
		query: async (_sql: string, ids: number[]) => ids.filter(id => id === 10679).map(tmdb_id => ({ tmdb_id })),
		increasePriority: async (items: unknown[]) => { writes.push(items) },
	}
	return { deps, writes, advance: (ms: number) => { now += ms } }
}

test("legacy poster then opened uses canonical identity, independent server windows and known catalog filtering", async () => {
	const f = fixture()
	assert.equal((await recordTitleDemand(request([movie]), f.deps)).status, 204)
	assert.equal((await recordTitleDemand(request([{ ...movie, source_kind: "opened" }, { ...movie, tmdb_id: 10679, source_kind: "opened" }, { ...movie, tmdb_id: 999 }]), f.deps)).status, 204)
	assert.deepEqual(f.writes, [[{ ...movie, tmdb_id: 10679, source_kind: "poster" }], [{ ...movie, tmdb_id: 10679, source_kind: "opened" }]])
	await recordTitleDemand(request([{ ...movie, source_kind: "opened" }]), f.deps)
	assert.deepEqual(f.writes.at(-1), [])
	f.advance(1800000)
	await recordTitleDemand(request([{ ...movie, source_kind: "opened" }]), f.deps)
	assert.equal(f.writes.at(-1)?.length, 1)
})

test("invalid source, IDs, untrusted fields, body bounds, origin and rate guard prevent writes", async () => {
	const f = fixture()
	for (const items of [[{ ...movie, source_kind: "prefetch" }], [{ ...movie, tmdb_id: -1 }], [{ ...movie, last_opened_at: 1 }], []]) {
		assert.equal((await recordTitleDemand(request(items), f.deps)).status, 400)
	}
	assert.equal((await recordTitleDemand(request([movie], { padding: "x".repeat(9000) }), f.deps)).status, 413)
	assert.equal((await recordTitleDemand(request([movie]), { ...f.deps, hasSiteOrigin: () => false })).status, 403)
	assert.equal((await recordTitleDemand(request([movie]), { ...f.deps, rateLimiter: { take: async () => ({ allowed: false, retryAfterSeconds: 10 }) } })).status, 429)
	assert.deepEqual(f.writes, [])
})
