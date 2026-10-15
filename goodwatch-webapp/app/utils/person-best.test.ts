import assert from "node:assert/strict"
import { test } from "node:test"
import { personBestCredit } from "./person-best.ts"
import {
	canonicalMediaTitle,
	mediaFieldLanguage,
} from "./media-presentation.ts"
import { overlayMediaRow } from "./media-overlay-core.ts"

test("Highest rated keeps title provenance and canonical identity through the compact stats projection", () => {
	const canonical = {
		media_type: "movie" as const,
		tmdb_id: 603,
		title: "The Matrix",
		score: 90,
		poster_path: "/en.jpg",
		release_year: 1999,
	}
	const localized = overlayMediaRow(canonical, "ja", {
		canonical: [canonical],
		translations: [
			{
				media_type: "movie",
				media_tmdb_id: 603,
				language_code: "ja",
				country_code: "JP",
				title: "マトリックス",
				overview: null,
				tagline: null,
			},
		],
		posters: [],
	})
	const best = personBestCredit(localized)!
	assert.equal(best.title, "マトリックス")
	assert.equal(mediaFieldLanguage(best), "ja-JP")
	assert.equal(canonicalMediaTitle(best), "The Matrix")
	assert.equal(best.score, 90)
	assert.equal(personBestCredit(undefined), null)
	assert.equal(canonical.title, "The Matrix")
})
