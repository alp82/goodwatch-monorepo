import assert from "node:assert/strict"
import { test } from "node:test"
import { searchFilter } from "./search-filter.server.ts"
import type { TitleTable } from "./search-index.server.ts"

test("recent titles in the name index retain the discovery vote filter unless lesser-known is enabled", () => {
	const table: TitleTable = {
		size: 2,
		pointIds: [1_000_000_000_001, 2_000_000_292_741],
		titles: ["Old movie", "Nocturne"],
		originalTitles: ["", ""],
		years: new Int32Array([2000, 2026]),
		votes: new Float64Array([2000, 0]),
		goodwatchScores: new Float64Array([70, 0]),
		popularity: new Float64Array([1, 17]),
		imdbIds: [null, null],
		flagNames: [],
		flags: new Int32Array(2),
		productionMethods: [null, null],
		rowOf: new Map(),
	}
	for (const lesserKnown of [false, true]) {
		const { base, withEra } = searchFilter(table, [], {
			includeAdult: false, lesserKnown,
		}, { from: 2026, to: 2026 })
		assert.deepEqual([...base.rows], lesserKnown ? [1, 1] : [1, 0])
		assert.deepEqual([...withEra.rows], lesserKnown ? [0, 1] : [1, 0])
	}
})
