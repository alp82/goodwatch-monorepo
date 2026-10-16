// A service that streams in a country only under another of its ids (Amazon Prime Video is 119 in France, not 9) is
// still offered there: its duplicates' countries fold into it, and the duplicates leave the list.
import assert from "node:assert/strict"
import { test } from "node:test"
import { foldDuplicateProviders } from "./streaming-links.ts"

const row = (
	id: number,
	name: string,
	order: Record<string, number>,
	order_default = 50,
) => ({
	id,
	name,
	logo_path: `/${id}.png`,
	order_by_country: order,
	order_default,
})

const rows = [
	row(8, "Netflix", { FR: 0, US: 0 }),
	row(9, "Amazon Prime Video", { US: 2 }),
	row(119, "Amazon Prime Video", { FR: 3, US: 4 }),
	row(10, "Amazon Video", { DE: 1 }),
	row(337, "Disney Plus", { FR: 1, US: 1 }),
]

test("a service offered in a country only under a duplicate id is offered there under its own", () => {
	const folded = foldDuplicateProviders(rows, "FR")
	assert.deepEqual(
		folded.map((p) => p.id),
		[8, 337, 9],
	)
	assert.equal(folded.find((p) => p.id === 9)?.order_by_country?.FR, 3)
	assert.equal(folded.find((p) => p.id === 9)?.order_by_country?.DE, 1)
})

test("a service's own order in a country wins over its duplicates'", () => {
	assert.equal(
		foldDuplicateProviders(rows, "US").find((p) => p.id === 9)?.order_by_country
			?.US,
		2,
	)
})

test("without a country the order stays as it came", () => {
	assert.deepEqual(
		foldDuplicateProviders(rows, "").map((p) => p.id),
		[8, 9, 337],
	)
})
