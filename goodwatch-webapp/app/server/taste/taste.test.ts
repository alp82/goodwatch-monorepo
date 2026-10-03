import assert from "node:assert/strict"
import { test } from "node:test"
import "../title-filter/test-alias.ts"
import type { TitleSnapshot } from "../title-snapshot/snapshot.server.ts"

const {
	QUANTILES,
	QUANTILE_LEVELS,
	TASTE_LENGTH,
	percentileOf,
	quantileTable,
} = await import("./formula.server.ts")
const { decodeTaste, encodeTaste } = await import("./stored.server.ts")
const { makeTaste } = await import("./taste.server.ts")

// A reference pool the size of the real one, with cosines 0 to 1 evenly: the title at rank r of n has r / (n - 1) of
// the pool below it.
const POOL = 58_628
const evenPool = () =>
	Float32Array.from({ length: POOL }, (_, i) => i / (POOL - 1))

/** A snapshot that only knows each title's cosine with any taste. */
const snapshotOf = (cosines: Map<number, number>) =>
	({
		cosine: (key: number) => cosines.get(key) ?? null,
	}) as unknown as TitleSnapshot

const built = (liked: number, quantiles = quantileTable(evenPool())) => ({
	ratings: liked,
	liked,
	vector: new Float32Array(TASTE_LENGTH).fill(1 / Math.sqrt(TASTE_LENGTH)),
	quantiles,
})

test("the quantile table holds whole percents and the top 1 percent in fine steps", () => {
	assert.equal(QUANTILES, 119)
	assert.equal(QUANTILE_LEVELS.length, QUANTILES)
	assert.equal(QUANTILE_LEVELS[0], 0)
	assert.equal(QUANTILE_LEVELS[99], 99)
	assert.equal(QUANTILE_LEVELS[100], 99.1)
	assert.equal(QUANTILE_LEVELS[108], 99.9)
	assert.equal(QUANTILE_LEVELS[109], 99.91)
	assert.equal(QUANTILE_LEVELS[117], 99.99)
	assert.equal(QUANTILE_LEVELS[118], 100)
	for (let q = 1; q < QUANTILES; q++)
		assert.ok(QUANTILE_LEVELS[q] > QUANTILE_LEVELS[q - 1])
	const table = quantileTable(evenPool())
	assert.equal(table.length, QUANTILES)
	QUANTILE_LEVELS.forEach((level, q) =>
		assert.ok(Math.abs(table[q] - level / 100) < 1e-6),
	)
})

test("the percentile is resolved down to the top 0.01 percent", () => {
	const table = quantileTable(evenPool())
	assert.equal(percentileOf(-1, table), 0)
	assert.equal(percentileOf(2, table), 100)
	for (const percentile of [
		0.5, 37.25, 90, 99, 99.5, 99.9, 99.95, 99.98, 99.99,
	])
		assert.ok(
			Math.abs(percentileOf(percentile / 100, table) - percentile) < 2e-4,
			`${percentile}`,
		)
	// A pool whose top 1 percent is far from even: the fine steps still place its titles by their rank.
	const skewed = Float32Array.from({ length: POOL }, (_, i) => {
		const below = i / (POOL - 1)
		return below < 0.99 ? below * 0.5 : 0.495 + ((below - 0.99) / 0.01) ** 4
	})
	const sorted = skewed.slice().sort()
	const skewedTable = quantileTable(skewed)
	for (const fromTop of [300, 59, 30, 12, 6]) {
		const rank = POOL - 1 - fromTop
		const exact = (rank / (POOL - 1)) * 100
		const found = percentileOf(sorted[rank], skewedTable)
		// Within a tenth of the title's own tail share.
		assert.ok(
			Math.abs(found - exact) < (100 - exact) * 0.1,
			`${fromTop} from the top: ${found} for ${exact}`,
		)
	}
})

test("a taste shows the new scale and gives the percentile behind it", () => {
	// Titles 1 to 7 at these shares of the pool below them; title 8 has no fingerprint.
	const below = [0, 0.5, 0.9, 0.99, 0.999, 0.9999, 1]
	const keys = [1, 2, 3, 4, 5, 6, 7, 8]
	const snapshot = snapshotOf(new Map(below.map((share, i) => [i + 1, share])))
	const many = makeTaste(snapshot, built(100))
	assert.deepEqual(many.match(keys), [50, 65, 80, 90, 95, 99, 99, null])
	const percentiles = many.percentile(keys)
	assert.equal(percentiles[7], null)
	below.forEach((share, i) =>
		assert.ok(Math.abs((percentiles[i] as number) - share * 100) < 2e-4),
	)
	// The same titles for a taste built from 5 and from 20 liked titles: lower, and still apart.
	assert.deepEqual(makeTaste(snapshot, built(5)).match(keys), [
		50,
		61,
		71,
		79,
		82,
		85,
		85,
		null,
	])
	assert.deepEqual(makeTaste(snapshot, built(20)).match(keys), [
		50,
		63,
		76,
		84,
		89,
		92,
		92,
		null,
	])
	// The percentile doesn't move with the liked count: orders stay the same as a person rates more.
	assert.deepEqual(makeTaste(snapshot, built(5)).percentile(keys), percentiles)
	// A percentile kept in a Float32Array is the same number, so it shows the same match.
	for (const percentile of percentiles.slice(0, 7))
		assert.equal(Math.fround(percentile as number), percentile)
})

test("without a vector a taste has neither", () => {
	const none = makeTaste(snapshotOf(new Map([[1, 0.5]])), {
		ratings: 3,
		liked: 3,
		vector: null,
		quantiles: null,
	})
	assert.equal(none.signal, "none")
	assert.deepEqual(none.match([1]), [null])
	assert.deepEqual(none.percentile([1]), [null])
})

const stored = (liked: number) => ({
	...built(liked),
	wantToSee: 2,
	builtAt: 1,
	sourceAt: 2,
	touchedAt: 3,
	snapshotVersion: "v-test",
})

test("a stored taste reads back as it was written", () => {
	const taste = stored(40)
	const read = decodeTaste(encodeTaste(taste))
	assert.ok(read)
	assert.equal(read.liked, 40)
	assert.equal(read.snapshotVersion, "v-test")
	assert.deepEqual(read.vector, taste.vector)
	assert.deepEqual(read.quantiles, taste.quantiles)
	const none = decodeTaste(
		encodeTaste({ ...taste, liked: 2, vector: null, quantiles: null }),
	)
	assert.ok(none)
	assert.equal(none.vector, null)
	assert.equal(none.quantiles, null)
})

test("a taste stored with the old quantile table is rebuilt, not misread", () => {
	// The value as it was written before: 74 floats for the vector and 101 for the table.
	const header = Buffer.from(
		JSON.stringify({ ratings: 40, liked: 40, snapshotVersion: "v-test" }),
	)
	const floatsAt = Math.ceil((2 + header.length) / 4) * 4
	const old = Buffer.alloc(floatsAt + (TASTE_LENGTH + 101) * 4)
	old.writeUInt16LE(header.length, 0)
	header.copy(old, 2)
	for (let i = 0; i < TASTE_LENGTH + 101; i++)
		old.writeFloatLE(i / 200, floatsAt + i * 4)
	assert.equal(decodeTaste(old), null)
	// A value cut short is rebuilt too.
	const whole = encodeTaste(stored(40))
	assert.equal(decodeTaste(whole.subarray(0, whole.length - 4)), null)
})
