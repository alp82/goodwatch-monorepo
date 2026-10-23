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

test("selectable brands keep all underlying IDs, including aliases and same-ID snapshots", async () => {
  const { groupProviderChoices } = await import('./streaming-links.ts')
  const choices = groupProviderChoices([
    { id: 119, name: 'Amazon Prime Video' },
    { id: 9, name: 'Amazon Prime Video' },
    { id: 10, name: 'Amazon Video' },
    { id: 2100, name: 'Amazon Prime Video with Ads' },
    { id: 8, name: 'Netflix' },
    { id: 1796, name: 'Netflix basic with Ads' },
    { id: 8, name: 'Netflix' },
    { id: 337, name: 'Disney Plus' },
  ])
  assert.deepEqual(choices.map(c => [c.id, c.selectionIds]), [[9,[9,10,119,2100]],[8,[8,1796]],[337,[337]]])
  assert.deepEqual(groupProviderChoices([{id:119,name:'Amazon Prime Video'}])[0].selectionIds,[119])
})
