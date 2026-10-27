import assert from "node:assert/strict"
import { test } from "node:test"
import "node-crate"
import "../title-filter/test-alias.ts"
import type { Metadata } from "./catalog.server.ts"
const { eligible } = await import("./catalog.server.ts")

const metadata: Metadata = {
	tmdb_id: 292741,
	media_type: "show",
	genres: null,
	adult: false,
	imdb_id: null,
	poster_path: "/nocturne.jpg",
	goodwatch_overall_score_voting_count: 0,
	goodwatch_overall_score_normalized_percent: 0,
}

test("all search results need a nonblank poster, including exact matches and lesser-known titles", () => {
	for (const discovery of [false, true]) {
		for (const lesserKnown of [false, true]) {
			const policy = { includeAdult: false, lesserKnown }
			for (const poster_path of [null, "", "  "]) {
				assert.equal(eligible({ ...metadata, poster_path }, policy, discovery), false)
			}
			assert.equal(eligible(undefined, policy, discovery), false)
		}
	}
})

test("an upcoming exact title with a poster needs no score or votes", () => {
	assert.equal(eligible({ ...metadata, goodwatch_overall_score_normalized_percent: null }, {
		includeAdult: false, lesserKnown: false,
	}, false), true)
})

test("a title lookup's poster qualifies even before its catalog metadata has arrived", () => {
	assert.equal(eligible(undefined, { includeAdult: false, lesserKnown: false }, false, "/tmdb.jpg"), true)
})

test("having a poster still respects adult and discovery vote restrictions", () => {
	const policy = { includeAdult: false, lesserKnown: false }
	assert.equal(eligible({ ...metadata, adult: true }, policy, false), false)
	assert.equal(eligible(metadata, policy, true), false)
	assert.equal(eligible(metadata, { ...policy, lesserKnown: true }, true), true)
})
