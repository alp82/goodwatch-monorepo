import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { G1_MODEL_HASH } from "./reader.server.ts"
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
