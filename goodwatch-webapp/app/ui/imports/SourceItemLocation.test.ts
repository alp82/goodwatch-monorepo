import assert from "node:assert/strict"
import { test } from "node:test"
import type { ImportItem } from "../../domain/imports.ts"
import { sourceItemLocation } from "./SourceImportPreviewModel.ts"

const row = (fields: Partial<ImportItem>) =>
	({
		key: "k",
		kind: "rating",
		mediaType: "show",
		title: "Show",
		year: null,
		tmdbId: 1,
		imdbId: null,
		index: 0,
		outcome: "new",
		reason: null,
		...fields,
	}) as ImportItem

test("a season, episode or part score names what it scores, matched or not", () => {
	assert.equal(
		sourceItemLocation(
			row({ kind: "episode_rating", scoreScope: "season", season: 2 }),
			false,
		),
		"Season 2",
	)
	assert.equal(
		sourceItemLocation(
			row({
				kind: "episode_rating",
				scoreScope: "episode",
				season: 1,
				episode: 3,
				episodeTmdbId: 9,
			}),
			false,
		),
		"S1 E3",
	)
	// Not matched yet: the source's own coordinates.
	assert.equal(
		sourceItemLocation(
			row({
				kind: "episode_rating",
				scoreScope: "episode",
				season: 1,
				episode: 3,
			}),
			false,
		),
		"S1 E3",
	)
	assert.equal(
		sourceItemLocation(
			row({
				kind: "episode_rating",
				scoreScope: "part",
				scoreRanges: [{ season: 1, firstEpisode: 13, lastEpisode: 25 }],
			}),
			false,
		),
		"S1 E13–25",
	)
	assert.equal(
		sourceItemLocation(
			row({ kind: "episode_rating", scoreScope: "part" }),
			false,
		),
		"Part",
	)
})

test("other rows keep their show, movie, season and episode locations", () => {
	assert.equal(
		sourceItemLocation(row({ kind: "watch", season: 4 }), false),
		"S4",
	)
	assert.equal(sourceItemLocation(row({ kind: "rating" }), false), "Show")
	assert.equal(
		sourceItemLocation(row({ kind: "rating", mediaType: "movie" }), false),
		"Movie",
	)
	assert.equal(
		sourceItemLocation(row({ kind: "watch", season: 2, episode: 5 }), false),
		"S2 E5",
	)
	assert.equal(
		sourceItemLocation(
			row({
				kind: "want",
				season: 3,
				wishlistEvidence: {
					source: "x",
					completeness: "complete",
					mediaType: "season",
				},
			}),
			true,
		),
		"S3",
	)
})
