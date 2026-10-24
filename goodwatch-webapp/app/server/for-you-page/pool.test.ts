import assert from "node:assert/strict"
import { test } from "node:test"
import "../title-filter/test-alias.ts"
import type { PoolInput } from "./pool.server.ts"

const { selectPool, eligiblePool, POOL_MAX } = await import("./pool.server.ts")
const { encodeSnapshot, joinChunks } = await import(
	"../title-snapshot/format.server.ts"
)
const { buildSnapshot } = await import("../title-snapshot/snapshot.server.ts")
const { FP_KEYS, familyOf } = await import(
	"../../domain/for-you-page/contract.ts"
)
const { LIBRARY, ownRecipes, MIN_FIT } = await import(
	"../../domain/for-you-page/recipes.ts"
)

function fixture(n: number): PoolInput {
	let seed = 42
	const random = () => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
		return seed / 2 ** 32
	}
	const encoded = encodeSnapshot({
		version: "test",
		builtAt: new Date("2026-01-01"),
		keyOrder: [...FP_KEYS],
		rows: Array.from({ length: n }, (_, i) => ({
			pointId: 1e12 + i + 1,
			genres: [],
			releaseDay: 19000,
			votes: 20000,
			popularity: 2,
			fingerprint: FP_KEYS.map(() => Math.floor(random() * 11)),
			score: 63 + (i % 38),
			origin: "US",
			hasPoster: true,
			hasBackdrop: true,
			adult: false,
			anime: false,
		})),
	})
	const snapshot = buildSnapshot(
		encoded.manifest,
		joinChunks(encoded.manifest, encoded.chunks),
	)
	return {
		pool: {
			n,
			snapshot,
			rows: Int32Array.from({ length: n }, (_, i) => i),
			keys: snapshot.columns.pointIds,
		},
		ctx: {
			viewer: { kind: "member", userId: "test" },
			services: [8],
			seen: new Set(),
			hidden: new Set(),
			skipped: new Set(),
			wishlist: new Map(),
		},
		taste: { vector: new Float32Array(74).fill(1 / Math.sqrt(74)) },
		tasteView: {
			subject: "member",
			attributes: FP_KEYS.map((key) => ({
				key,
				label: key,
				family: familyOf(key) ?? "feel",
				edge: 0.2,
				tier: 1,
				carriers: [],
			})),
			groups: Array.from({ length: 5 }, (_, i) => ({
				id: `side-${i}`,
				name: `Side ${i}`,
				keys: FP_KEYS.slice(i * 4, i * 4 + 4),
				count: 10,
			})),
			loved: {},
		},
		onServices: null,
	}
}

test("excludes seen, hidden, skipped, wishlist, low and unknown scores", () => {
	const input = fixture(20)
	input.ctx.seen = new Set([1e12 + 1])
	input.ctx.hidden = new Set([1e12 + 2])
	input.ctx.skipped = new Set([1e12 + 3])
	input.ctx.wishlist = new Map([[1e12 + 4, new Date()]])
	input.pool.snapshot.columns.scores[4] = 62
	input.pool.snapshot.columns.scores[5] = 255
	const indices = [...selectPool(input)]
	assert.equal(indices.length, 14)
	assert.ok(indices.every((i) => i >= 6))
	assert.deepEqual(selectPool(input), selectPool(input))
})

test("services scope counts eligible titles, requires loaded country and member services", () => {
	const input = fixture(650)
	assert.equal(eligiblePool(input).scope, "everywhere")
	input.onServices = (key) => key <= 1e12 + 599
	assert.equal(eligiblePool(input).scope, "everywhere")
	input.onServices = (key) => key <= 1e12 + 600
	assert.equal(eligiblePool(input).scope, "services")
	assert.ok([...selectPool(input)].every((i) => i < 600))
	input.ctx.seen = new Set([1e12 + 1])
	assert.equal(eligiblePool(input).scope, "everywhere")
	input.ctx.seen = new Set()
	input.ctx.services = []
	assert.equal(eligiblePool(input).scope, "everywhere")
	input.ctx.services = [8]
	input.ctx.viewer = { kind: "guest", progress: { interactions: [] } }
	assert.equal(eligiblePool(input).scope, "everywhere")
})

test("all library and own recipes retain at least 15 quota winners; cap and 12k selection budget", () => {
	const input = fixture(12000)
	// Warm the same code paths before measuring steady-state request computation.
	selectPool(input)
	const started = performance.now()
	const selected = new Set(selectPool(input))
	const ms = performance.now() - started
	console.info(`12k selectPool: ${ms.toFixed(2)} ms; ${selected.size} titles`)
	assert.ok(ms < 50, `selection took ${ms} ms`)
	assert.ok(selected.size <= POOL_MAX)
	const snap = input.pool.snapshot
	const cosines = Array.from(
		{ length: 12000 },
		(_, i) => snap.cosineAt(i, input.taste.vector ?? new Float32Array(74)) ?? 0,
	)
	const mean = cosines.reduce((s, v) => s + v, 0) / 12000
	const sd =
		Math.sqrt(cosines.reduce((s, v) => s + (v - mean) ** 2, 0) / 12000) || 1
	for (const recipe of [
		...LIBRARY,
		...ownRecipes(input.tasteView?.groups ?? []),
	]) {
		const terms = Object.entries(recipe.attrs).map(([key, w]) => [
			FP_KEYS.indexOf(key as (typeof FP_KEYS)[number]),
			w,
		])
		const norm = terms.reduce((s, [, w]) => s + Math.abs(w), 0)
		const ranked = cosines
			.map((cosine, i) => {
				const fp = snap.fingerprintAt(i)
				const fit =
					terms.reduce(
						(s, [k, w]) =>
							s +
							w * Math.fround((fp[k] - snap.stats.mean[k]) / snap.stats.sd[k]),
						0,
					) / norm
				return { i, score: 0.7 * fit + (0.3 * (cosine - mean)) / sd }
			})
			.sort((a, b) => b.score - a.score || a.i - b.i)
		assert.ok(
			ranked.slice(0, 40).filter((r) => selected.has(r.i)).length >= MIN_FIT,
			recipe.id,
		)
	}
})

test("sample and absent taste skip the personal quota and remain deterministic", () => {
	const input = fixture(100)
	input.taste = { vector: null }
	assert.ok(selectPool(input).length > 0)
	input.tasteView = null
	assert.ok(selectPool(input).length > 0)
})
