import assert from "node:assert/strict"
import { test } from "node:test"
import { filterHides, searchFilter } from "./search-filter.server.ts"
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

test("filter hides: the topic's titles each of the search's own filters alone keeps out", () => {
	// Five pirate titles: 2020 movie, 2003 movie, 2020 anime show, 1999 anime show, 2020 movie under the vote line.
	const pointIds = [1_000_000_000_001, 1_000_000_000_002, 2_000_000_000_003, 2_000_000_000_004, 1_000_000_000_005]
	const table: TitleTable = {
		size: 5,
		pointIds,
		titles: ["A", "B", "C", "D", "E"],
		originalTitles: ["", "", "", "", ""],
		years: new Int32Array([2020, 2003, 2020, 1999, 2020]),
		votes: new Float64Array([5000, 5000, 5000, 5000, 10]),
		goodwatchScores: new Float64Array(5),
		popularity: new Float64Array(5),
		imdbIds: [null, null, null, null, null],
		flagNames: ["is_anime"],
		flags: new Int32Array([0, 0, 1, 1, 0]),
		productionMethods: [null, null, null, null, null],
		rowOf: new Map(pointIds.map((id, row) => [id, row])),
	}
	const topic = new Set(pointIds)
	const hides = filterHides(table, topic, {
		includeAdult: false,
		lesserKnown: false,
		filters: { minYear: 2020, maxYear: 2020, anime: "none" },
	}, [], null)
	// 2003 movie: only the years; 2020 anime: only anime; 1999 anime: both (in the total, counted for neither);
	// E: under the vote line.
	assert.deepEqual(hides, { hidden: 3, anime: 1, years: 1 })
	assert.equal(filterHides(table, topic, { includeAdult: false, lesserKnown: false }, [], null), null)
	assert.deepEqual(
		filterHides(table, topic, { includeAdult: false, lesserKnown: false, filters: { type: "show" } }, [], null),
		{ hidden: 2, type: 2 },
	)
	assert.equal(
		filterHides(table, topic, {
			includeAdult: false,
			lesserKnown: false,
			filters: { type: "show", genres: ["Comedy"] },
		}, [], null),
		null,
		"a genre the table can't check: no counts",
	)
})
