import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { searchFilter } from "../search-ranking/search-filter.server.ts"
import type { TitleTable } from "../search-ranking/search-index.server.ts"
import {
	allowsTitle,
	parseSearchFilters,
	searchFiltersKey,
	titlePointId,
	toCrateSql,
	toQdrantMust,
} from "./search-filters.ts"

const onlyTitles = ["movie:550", "show:1399", "movie:13"]

describe("onlyTitles", () => {
	test("is never read from a request", () => {
		assert.deepEqual(parseSearchFilters({ onlyTitles, type: "movie" }), {
			type: "movie",
		})
	})

	test("does not change the browser's filter key", () => {
		assert.equal(searchFiltersKey({ onlyTitles }), "")
	})

	test("becomes Qdrant point ids", () => {
		assert.equal(titlePointId("movie:550"), 1_000_000_000_550)
		assert.equal(titlePointId("show:1399"), 2_000_000_001_399)
		assert.deepEqual(toQdrantMust({ onlyTitles }), [
			{ has_id: [1_000_000_000_550, 2_000_000_001_399, 1_000_000_000_013] },
		])
	})

	test("becomes a Crate condition per table that MATCH can run next to", () => {
		assert.deepEqual(toCrateSql({ onlyTitles, minYear: 1990 }, "movie"), {
			sql: " AND release_year >= ? AND (tmdb_id + 0) IN (?,?)",
			params: [1990, 550, 13],
		})
		assert.deepEqual(toCrateSql({ onlyTitles }, "show"), {
			sql: " AND (tmdb_id + 0) IN (?)",
			params: [1399],
		})
	})

	test("excludes a table without any of the titles", () => {
		assert.equal(toCrateSql({ onlyTitles: ["movie:550"] }, "show"), null)
	})

	test("checks title lookup rows", () => {
		assert.ok(allowsTitle({ onlyTitles }, "show:1399"))
		assert.ok(!allowsTitle({ onlyTitles }, "show:550"))
		assert.ok(allowsTitle({}, "show:550"))
		assert.ok(allowsTitle(undefined, "show:550"))
	})

	test("limits the ranker's title table rows", () => {
		const pointIds = [
			titlePointId("movie:550"),
			titlePointId("movie:551"),
			titlePointId("show:1399"),
			titlePointId("show:550"),
		]
		const table = {
			size: pointIds.length,
			pointIds,
			years: Int32Array.from([1999, 1999, 2011, 2005]),
			flags: new Uint32Array(pointIds.length),
			flagNames: [],
			productionMethods: [],
		} as unknown as TitleTable
		const eligibility = {
			includeAdult: false,
			lesserKnown: false,
			filters: { onlyTitles },
		}
		const { base } = searchFilter(table, [], eligibility, null)
		assert.deepEqual([...base.rows], [1, 0, 1, 0])
		assert.deepEqual(base.qdrant.must.at(-1), {
			has_id: [1_000_000_000_550, 2_000_000_001_399, 1_000_000_000_013],
		})
	})
})
