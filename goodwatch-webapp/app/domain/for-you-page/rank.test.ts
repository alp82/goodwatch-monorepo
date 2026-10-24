import assert from "node:assert/strict"
import { performance } from "node:perf_hooks"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { FP_KEYS, familyOf, encodeFingerprints, decodeFingerprints } =
	await import("./contract.ts")
const { poolStats, rankPool, STEER_CAP } = await import("./rank.ts")
const { familyPushes, shapeOf, steerOf, FLAT } = await import("./shape.ts")
type DecodedPool = import("./contract.ts").DecodedPool
type ForYouTaste = import("./contract.ts").ForYouTaste

function fixture(n = 1200) {
	let seed = 781
	const next = () => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
		return seed / 4294967296
	}
	const fingerprints = Uint8Array.from({ length: n * FP_KEYS.length }, () =>
		Math.floor(next() * 11),
	)
	const pool: DecodedPool = {
		keys: Array.from({ length: n }, (_, i) => `movie-${i}`),
		names: Array(n).fill("Title"),
		years: Array(n).fill(null),
		posters: Array(n).fill("/a.jpg"),
		scores: Array.from({ length: n }, () => 63 + Math.floor(next() * 38)),
		steps: Array.from({ length: n }, () => 50 + Math.floor(next() * 50)),
		moods: Array.from({ length: n }, () => Math.floor(next() * 2048)),
		themes: Array(n).fill(0),
		styles: Array(n).fill(0),
		fingerprints,
		scope: "everywhere",
	}
	const taste: ForYouTaste = {
		subject: "member",
		groups: [],
		loved: {},
		attributes: FP_KEYS.map((key, i) => ({
			key,
			label: key,
			family: familyOf(key) ?? "feel",
			edge: i % 7 === 0 ? 1 : 0.1,
			tier: 1,
			carriers: [],
		})),
	}
	return { pool, taste, stats: poolStats(fingerprints, n) }
}
const empty = { attrs: {}, recipeLean: [] }

test("title analysis encoding round-trips every value and rejects malformed input", () => {
	const rows = [
		Uint8Array.from(FP_KEYS, (_, i) => (i % 12 === 11 ? 255 : i % 12)),
	]
	assert.deepEqual(decodeFingerprints(encodeFingerprints(rows), 1), rows[0])
	assert.equal(encodeFingerprints([]), "")
	assert.equal(decodeFingerprints("", 0).length, 0)
	assert.throws(() => decodeFingerprints("_", 1), RangeError)
	assert.throws(
		() => decodeFingerprints("x".repeat(FP_KEYS.length), 1),
		RangeError,
	)
	assert.throws(
		() => encodeFingerprints([Array(FP_KEYS.length).fill(11)]),
		RangeError,
	)
	assert.throws(() => encodeFingerprints([[1]]), RangeError)
})

test("shared column order and family mapping agree with the catalog", async () => {
	const { VALID_FINGERPRINT_KEYS } = await import(
		"../../server/utils/fingerprint"
	)
	assert.deepEqual(FP_KEYS, VALID_FINGERPRINT_KEYS)
	assert.equal(FP_KEYS.length, 74)
	assert.equal(familyOf("unknown"), undefined)
	assert.equal(familyOf("educational"), "story")
	assert.equal(familyOf("direction"), "craft")
})

test("empty steer orders by taste and quality with exact score contributions", () => {
	const { pool, taste } = fixture(3)
	pool.scores = [70, 94, 82]
	pool.steps = [75, 99, 87]
	pool.fingerprints.fill(5)
	const stats = poolStats(pool.fingerprints, 3)
	const ranked = rankPool(pool, stats, taste, empty)
	assert.deepEqual(
		ranked.map((r) => r.index),
		[1, 2, 0],
	)
	assert.ok(
		Math.abs(ranked[0].score - (1.1 * (1 - 0.85 * 0.25) * 0.45 * 2 + 0.7)) <
			1e-12,
	)
	assert.ok(ranked.every((r) => r.steerFit === 100))
})

test("a lots more family step replaces at least four of the top nine", () => {
	const { pool, stats, taste } = fixture()
	const base = rankPool(pool, stats, taste, empty).slice(0, 9)
	const steer = steerOf(undefined, shapeOf({ humor: 2 }), familyPushes(taste))
	const pushed = rankPool(pool, stats, taste, steer).slice(0, 9)
	const old = new Set(base.map((r) => r.index))
	assert.ok(pushed.filter((r) => !old.has(r.index)).length >= 4)
	assert.deepEqual(steerOf(undefined, FLAT, familyPushes(taste)), empty)
})

test("steer cap clamps strength while allowing larger pushes than the default", () => {
	const { pool, stats, taste } = fixture(50)
	const score = (amount: number, cap = STEER_CAP) =>
		rankPool(
			pool,
			stats,
			taste,
			{ attrs: { adrenaline: amount }, recipeLean: [] },
			{ cap, reasonsTop: 0 },
		)
	const capped = score(10)
	assert.deepEqual(score(100), capped)
	assert.notDeepEqual(score(100, 10), capped)
	assert.notDeepEqual(score(1), capped)
})

test("soft mood lean adds 0.9 without filtering and hidden titles are excluded", () => {
	const { pool, taste, stats } = fixture(3)
	pool.moods = [1, 0, 1]
	const plain = rankPool(pool, stats, taste, empty)
	const leaned = rankPool(pool, stats, taste, {
		attrs: {},
		recipeLean: ["funny"],
	})
	for (const r of leaned) {
		const before = plain.find((x) => x.index === r.index)
		assert.ok(before)
		assert.ok(
			Math.abs(r.score - before.score - (r.index === 1 ? 0 : 0.9)) < 1e-12,
		)
	}
	assert.equal(
		rankPool(pool, stats, taste, empty, { hidden: new Set(pool.keys) }).length,
		0,
	)
})

test("missing analysis and unknown quality produce no NaN; quality floor is inclusive", () => {
	const { pool, taste } = fixture(4)
	pool.fingerprints.fill(255)
	pool.scores = [-1, 62, 62.5, 63]
	pool.steps.fill(0)
	const stats = poolStats(pool.fingerprints, 4)
	assert.ok([...stats.z].every((z) => z === 0))
	assert.ok([...stats.sd].every((sd) => sd === 1))
	const ranked = rankPool(pool, stats, taste, empty)
	assert.deepEqual(
		ranked.map((r) => r.index),
		[3, 2],
	)
	assert.ok(ranked.every((r) => Number.isFinite(r.score)))
	assert.deepEqual(rankPool({ ...pool, keys: [] }, stats, taste, empty), [])
})

test("reasons use original row indices, keep four strongest and stop at the requested limit", () => {
	const { pool, stats, taste } = fixture()
	const ranked = rankPool(
		pool,
		stats,
		taste,
		{ attrs: { adrenaline: 3 }, recipeLean: [] },
		{ reasonsTop: 1 },
	)
	assert.ok(ranked[0].reasons.length > 0)
	assert.ok(ranked[0].reasons.length <= 4)
	for (const reason of ranked[0].reasons) {
		const k = FP_KEYS.indexOf(reason.key as (typeof FP_KEYS)[number])
		assert.ok(stats.z[ranked[0].index * FP_KEYS.length + k] >= 0.6)
	}
	assert.ok(ranked.slice(1).every((r) => r.reasons.length === 0))
})

test("ranking 1,200 titles with default reasons stays under 5 ms after warmup", (t) => {
	const { pool, stats, taste } = fixture()
	const steer = steerOf(undefined, shapeOf({ humor: 2 }), familyPushes(taste))
	for (let i = 0; i < 30; i++) rankPool(pool, stats, taste, steer)
	const times = Array.from({ length: 31 }, () => {
		const start = performance.now()
		const result = rankPool(pool, stats, taste, steer)
		const elapsed = performance.now() - start
		assert.equal(result.length, 1200)
		return elapsed
	}).sort((a, b) => a - b)
	t.diagnostic(
		`1,200 titles: median ${times[15].toFixed(3)} ms; p95 ${times[29].toFixed(3)} ms (statistics prepared once)`,
	)
	assert.ok(times[29] < 5, `p95 ${times[29]} ms exceeds budget`)
})
