import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { gzipSync } from "node:zlib"
import type { TitleSnapshot } from "../title-snapshot/snapshot.server.ts"
import {
	createG1Reader,
	createG1OrderCache,
	G1_MODEL_HASH,
} from "./reader.server.ts"
import { requestOrder, type G1Components, type OwnShares } from "./order.ts"

const fixture = JSON.parse(
	readFileSync(
		new URL(
			"../../../../goodwatch-flows/tests/fixtures/g1_order.json",
			import.meta.url,
		),
		"utf8",
	),
) as {
	modelHash: string
	cases: {
		name: string
		components: G1Components
		ownShares: OwnShares
		groups: number[]
		order: number[]
		mixCount: number
	}[]
}
test("fixture and reader pin the same model", () =>
	assert.equal(fixture.modelHash, G1_MODEL_HASH))
for (const c of fixture.cases)
	test(`Python fixture exact parity: ${c.name}`, () => {
		const actual = requestOrder(c.components, c.ownShares)
		assert.deepEqual(actual.groups, c.groups)
		assert.deepEqual(
			actual.order.map((i) => c.components.pointIds[i]),
			c.order,
		)
		assert.equal(actual.mixCount, c.mixCount)
	})
test("request rejects misaligned components", () => {
	assert.throws(() =>
		requestOrder(
			{
				pointIds: [],
				b3Rank: [1],
				b5TopHalf: [],
				movieSeriesId: [],
				show: [],
				animation: [],
			},
			null,
		),
	)
})

// The wire payload is sorted by point id; request order (including ties) comes from the caller.
for (const c of fixture.cases)
	test(`gzip/typed-array Python parity: ${c.name}`, async () => {
		const at = c.components.pointIds
			.map((_, i) => i)
			.sort((a, b) => c.components.pointIds[a] - c.components.pointIds[b])
		const columns = Object.fromEntries(
			Object.entries(c.components).map(([key, values]) => [
				key,
				at.map((i) => values[i]),
			]),
		)
		const pointIds = at.map((i) => c.components.pointIds[i])
		const snapshot = {
			version: "parity",
			count: pointIds.length,
			rowOf: (key: number) => pointIds.indexOf(key),
		} as TitleSnapshot
		const now = Date.parse("2026-10-15T00:00:00Z")
		const wire = gzipSync(
			JSON.stringify({
				...columns,
				format: 1,
				modelHash: G1_MODEL_HASH,
				snapshotVersion: snapshot.version,
				builtAt: new Date(now).toISOString(),
				ownShares: c.ownShares,
				othersCount: 0,
				othersRatingsCount: 0,
			}),
		)
		const read = await createG1Reader(
			async () => wire,
			() => now,
		)("parity", snapshot)
		assert.equal(read.fallbackReason, null)
		const result = createG1OrderCache()(
			c.components.pointIds,
			read.data!,
			snapshot,
		)
		assert.deepEqual(result.keys, c.order)
		assert.deepEqual(
			c.components.pointIds.map((key) => result.titles.get(key)!.group),
			c.groups,
		)
		assert.equal(
			[...result.titles.values()].filter((t) => t.mixPlaced).length,
			c.mixCount,
		)
	})
