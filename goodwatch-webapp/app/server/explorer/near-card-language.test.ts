// The quick view's card of a map title (getNearCard) carries the story inside the title, so the display language
// that translates the name translates the story too.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../title-filter/test-alias.ts"
import type { ExplorerCard } from "../../domain/explorer.ts"
import {
	type Sources,
	overlayMediaRow,
} from "../../utils/media-overlay-core.ts"

const { localizeTitlePayload } = await import(
	"../../utils/media-payload-core.ts"
)

const sources: Sources = {
	canonical: [
		{
			media_type: "movie",
			tmdb_id: 42,
			title: "Canonical",
			original_title: "Canonical",
			original_language_code: "en",
			poster_path: "/en.jpg",
			synopsis: "English story",
			tagline: null,
		},
	],
	translations: [
		{
			media_tmdb_id: 42,
			media_type: "movie",
			language_code: "fr",
			country_code: "FR",
			title: "Titre",
			overview: "Histoire française",
			tagline: null,
		},
	],
	posters: [],
}

const card: ExplorerCard = {
	title: {
		key: 1e12 + 42,
		mediaType: "movie",
		anime: false,
		tmdbId: 42,
		title: "Canonical",
		year: 2001,
		poster: "/en.jpg",
		backdrop: null,
		genres: ["Drama"],
		score: 80,
		match: null,
		services: [],
		seen: false,
		wantToSee: false,
		notInterested: false,
		rating: null,
		overview: "English story",
	},
	why: null,
	like: null,
	services: [],
	signUp: false,
}

test("a near card's story is translated with its title", async () => {
	const localized = await localizeTitlePayload(
		card,
		"fr",
		undefined,
		async (rows) => rows.map((row) => overlayMediaRow(row, "fr", sources)),
	)
	assert.equal(localized.title.title, "Titre")
	assert.equal(localized.title.overview, "Histoire française")
	assert.equal(card.title.overview, "English story")
})
