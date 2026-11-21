import assert from "node:assert/strict"
import { test } from "node:test"
import "../title-filter/test-alias.ts"

const { titleKey } = await import("~/utils/title-key")
const { TROPE_RECORD_FORMAT, decodeTrope, encodeTrope } = await import("./trope-members.ts")

const rows = [
	{ media_type: "movie", media_tmdb_id: 348, play: "straight" as const },
	{ media_type: "movie", media_tmdb_id: 4232, play: null },
	{ media_type: "movie", media_tmdb_id: 348, play: "straight" as const },
	{ media_type: "show", media_tmdb_id: 1399, play: "subverted" as const },
	{ media_type: "show", media_tmdb_id: 66732, play: "averted" as const },
	{ media_type: "book", media_tmdb_id: 7, play: "straight" as const },
	{ media_type: "movie", media_tmdb_id: -1, play: "straight" as const },
]

test("a record round-trips through JSON", () => {
	const record = encodeTrope(rows)
	assert.equal(record.format, TROPE_RECORD_FORMAT)
	const members = decodeTrope(JSON.parse(JSON.stringify(record)))
	assert.ok(members)
	assert.equal(members.size, 4, "duplicates, other media and bad ids are left out")
	assert.deepEqual([...members.movies], [348, 4232])
	assert.deepEqual([...members.shows], [1399, 66732])
	assert.equal(members.has(titleKey("movie", 348)), true)
	assert.equal(members.has(titleKey("show", 348)), false)
	assert.equal(members.has(titleKey("movie", 1)), false)
	assert.equal(members.play(titleKey("show", 1399)), "subverted")
	assert.equal(members.play(titleKey("movie", 4232)), "straight")
	assert.equal(members.play(titleKey("movie", 9)), null)
	assert.equal(members.bentCount, 2)
	assert.equal(members.twistShare, 0.5)
	assert.deepEqual(
		[...members.keys()],
		[
			titleKey("movie", 348),
			titleKey("movie", 4232),
			titleKey("show", 1399),
			titleKey("show", 66732),
		],
	)
})

test("membership lookups stay correct on a large sorted list", () => {
	const many = Array.from({ length: 5000 }, (_, i) => ({
		media_type: "movie",
		media_tmdb_id: 5000 - i * 3 + 20000,
		play: null,
	}))
	const members = decodeTrope(encodeTrope(many))
	assert.ok(members)
	assert.equal(members.size, 5000)
	for (const r of many) assert.equal(members.has(titleKey("movie", r.media_tmdb_id)), true)
	assert.equal(members.has(titleKey("movie", 20001)), false)
})

test("a record of another format or shape decodes to null", () => {
	assert.equal(decodeTrope(null), null)
	assert.equal(decodeTrope({ format: 2, movies: "", shows: "", bent: [] }), null)
	assert.equal(decodeTrope({ format: 1, movies: 3 }), null)
	const empty = decodeTrope({ format: 1, movies: "", shows: "", bent: [[1, "twisted"]] })
	assert.ok(empty)
	assert.equal(empty.size, 0)
	assert.equal(empty.bentCount, 0, "unknown plays are dropped")
	assert.equal(empty.twistShare, 0)
})
