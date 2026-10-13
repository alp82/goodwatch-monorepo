// The Explorer's Mood, Theme and Style islands over a fixed pool. The digests were recorded before the Theme and Style
// rules moved to domain/themes-styles.ts: the move, and any later change to that module, must leave the Explorer's
// islands as they were. A rule changed on purpose changes a digest; record the new one in the same commit.
// CommonJS packages are loaded before the alias hook, which would otherwise resolve their own relative requires.
import "node-crate"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { test } from "node:test"
import type { SnapshotRow } from "../title-snapshot/format.server"
import "../title-filter/test-alias.ts"
import type { Layout } from "./groupings.server.ts"
import type { ExplorerPool } from "./pool.server.ts"

const { encodeSnapshot, joinChunks } = await import(
	"../title-snapshot/format.server.ts"
)
const { buildSnapshot } = await import("../title-snapshot/snapshot.server.ts")
const { VALID_FINGERPRINT_KEYS } = await import("../utils/fingerprint.ts")
const { sharedLayout } = await import("./groupings.server.ts")
const { DIMENSIONS, DESCRIPTIVE } = await import("./pool.server.ts")

const TITLES = 1200
const MISSING = 255
const GENRES = [
	"Animation",
	"Comedy",
	"Documentary",
	"Drama",
	"Horror",
	"News",
	"Reality",
	"Talk",
]

/** The same numbers on every run. */
function seeded(seed: number) {
	let a = seed
	return () => {
		a = (a + 0x6d2b79f5) | 0
		let t = Math.imul(a ^ (a >>> 15), 1 | a)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

// Attributes hardly any title scores on, so their islands fall under the Explorer's least size.
const RARE = new Set([
	"sports",
	"showbiz",
	"slow_burn",
	"non_linear_narrative",
	"wholesome",
])

/**
 * A pool of made-up titles. Most attributes are common enough that their islands go over the Explorer's most and
 * their threshold rises; every third is uncommon and keeps its threshold; the rare ones drop it. A few titles have a
 * score missing, and a few have too few scores for any island.
 */
function fixedPool(): ExplorerPool {
	const random = seeded(20261013)
	const rows: SnapshotRow[] = Array.from({ length: TITLES }, (_, i) => {
		const bare = random() < 0.03
		const fingerprint = Uint8Array.from(VALID_FINGERPRINT_KEYS, (_, k) => {
			const r = random()
			if (bare ? k >= 6 : random() < 0.02) return MISSING
			const key = VALID_FINGERPRINT_KEYS[k]
			return Math.floor(
				(RARE.has(key) ? r ** 60 : k % 3 === 0 ? r ** 6 : r) * 11,
			)
		})
		return {
			pointId: (i % 4 === 0 ? 2e12 : 1e12) + i + 1,
			genres: GENRES.filter(() => random() < 0.12),
			releaseDay: 10000 + Math.floor(random() * 10000),
			votes: 1000 + Math.floor(random() * 100000),
			popularity: random() * 100,
			fingerprint,
			score: 40 + Math.floor(random() * 55),
			origin: "US",
			hasPoster: true,
			hasBackdrop: true,
			adult: false,
			anime: false,
		}
	})
	const { manifest, chunks } = encodeSnapshot({
		version: "explorer-groupings-test",
		builtAt: new Date("2026-01-01"),
		keyOrder: VALID_FINGERPRINT_KEYS,
		rows,
	})
	const snapshot = buildSnapshot(manifest, joinChunks(manifest, chunks))
	const n = snapshot.count
	const D = DIMENSIONS
	const z = new Float32Array(n * D)
	const unit = new Float32Array(n * D)
	const quality = new Float32Array(n)
	const keys = new Float64Array(n)
	for (let i = 0; i < n; i++) {
		const fp = snapshot.fingerprintAt(i)
		let squares = 0
		for (let d = 0; d < D; d++) {
			const v = fp[DESCRIPTIVE[d]]
			z[i * D + d] = (v === MISSING ? 0 : v) - 4
			squares += z[i * D + d] ** 2
		}
		const length = Math.sqrt(squares) || 1
		for (let d = 0; d < D; d++) unit[i * D + d] = z[i * D + d] / length
		quality[i] = random()
	}
	snapshot.forEach((key, row) => {
		keys[row] = key
	})
	return {
		version: snapshot.version,
		snapshot,
		n,
		keys,
		rows: Int32Array.from({ length: n }, (_, i) => i),
		facts: Array.from({ length: n }, (_, i) => snapshot.factsAt(i)),
		display: Array.from({ length: n }, () => ({
			title: "",
			year: null,
			poster: "",
			backdrop: null,
			genres: [],
			occasions: 0,
		})),
		z,
		unit,
		quality,
		years: new Int16Array(n),
		indexOf: (key) => snapshot.rowOf(key),
	}
}

/** Everything a layout says about its islands: which, who is on them, in which order, where they sit and their line. */
const digest = (layout: Layout) =>
	createHash("sha256")
		.update(
			JSON.stringify({
				islands: layout.islands.map(({ id, name, color }) => [id, name, color]),
				mask: Array.from(layout.mask),
				members: layout.members.map((list) => Array.from(list)),
				x: layout.x,
				y: layout.y,
				apart: layout.apart,
			}),
		)
		.digest("hex")

const pool = fixedPool()
const read = (layout: Layout) => ({
	sizes: Object.fromEntries(
		layout.islands.map((island, j) => [island.id, layout.members[j].length]),
	),
	digest: digest(layout),
})

test("the Theme islands of a fixed pool are what they were before the rules moved", () => {
	assert.deepEqual(read(sharedLayout(pool, "theme")), {
		sizes: {
			crime: 71,
			mystery: 193,
			war: 299,
			politics: 83,
			true: 224,
			history: 174,
			growing: 73,
			family: 221,
			mind: 186,
			showbiz: 10,
			sports: 14,
			money: 299,
			future: 225,
			fantasy: 300,
		},
		digest: "213a10f185ba9bae8858dc672c2a34ca54744d0ebe99cedd86259c0708812727",
	})
})

test("the Style islands of a fixed pool are what they were before the rules moved", () => {
	assert.deepEqual(read(sharedLayout(pool, "style")), {
		sizes: {
			animated: 145,
			documentary: 442,
			spectacle: 223,
			stylized: 65,
			music: 299,
			slow: 6,
			fast: 217,
			talky: 286,
			nonlinear: 14,
			graphic: 103,
		},
		digest: "c1eaca8585e3b3793ee9f351112782cca8233d200dafc5ac693468c45bffe7e0",
	})
})

test("the Mood islands of a fixed pool are unchanged", () => {
	assert.deepEqual(read(sharedLayout(pool, "mood")), {
		sizes: {
			funny: 302,
			romantic: 209,
			thrilling: 55,
			tense: 188,
			scary: 230,
			sad: 204,
			dark: 286,
			trippy: 211,
			deep: 64,
			magical: 210,
			quirky: 205,
		},
		digest: "0ad41eab904905ff472fc104c9e13d78c7ca2ac84e8584738eb3ae34180c7fa4",
	})
})
