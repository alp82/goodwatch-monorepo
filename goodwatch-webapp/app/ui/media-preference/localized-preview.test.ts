import assert from "node:assert/strict"
import { test } from "node:test"
import type { MediaLanguage } from "../../utils/media-language.ts"
import type {
	LocalizedTitlePayload,
	PresentedMedia,
} from "../../utils/media-presentation.ts"
import {
	needsText,
	textLanguage,
	withLocalizedText,
} from "./localized-preview.ts"

const field = (language: string, fallback = false) => ({
	language,
	source: fallback ? ("canonical" as const) : ("localized" as const),
	fallback,
})
const matrix = {
	mediaType: "movie" as const,
	details: {
		canonical_title: undefined as string | undefined,
		presentation: undefined as PresentedMedia["presentation"],
		tmdb_id: 603,
		title: "The Matrix",
		poster_path: "/en.jpg",
		synopsis: "Set in the 22nd century…",
		tagline: "Believe the unbelievable.",
		release_year: 1999,
	},
	country: "DE",
}
const payload = (language: MediaLanguage, more: Partial<LocalizedTitlePayload> = {}): LocalizedTitlePayload => ({
	media_type: "movie",
	tmdb_id: 603,
	canonical_title: "The Matrix",
	title: "الماتريكس",
	poster_path: "/ar.jpg",
	overview: "نيو…",
	synopsis: "نيو…",
	tagline: null,
	presentation: {
		language,
		title: field("ar-SA"),
		poster: field("ar"),
		overview: field("ar-SA"),
		tagline: field("en", true),
	},
	...more,
})

test("a page without presentation is canonical English; only another language needs text", () => {
	assert.equal(textLanguage(matrix), "en")
	assert.equal(needsText(matrix, "en"), false)
	assert.equal(needsText(matrix, "ar"), true)
	const german = { ...matrix, details: { ...matrix.details, presentation: { language: "de" } as never } }
	assert.equal(needsText(german, "de"), false)
	assert.equal(needsText(german, "en"), true)
	// An unsupported code reads as English, as the endpoint does.
	assert.equal(needsText(matrix, "xx"), false)
})

test("the payload swaps title, poster, description and tagline and keeps everything else", () => {
	const shown = withLocalizedText(matrix, payload("ar"), "ar")
	assert.ok(shown)
	assert.equal(shown.details.title, "الماتريكس")
	assert.equal(shown.details.poster_path, "/ar.jpg")
	assert.equal(shown.details.synopsis, "نيو…")
	assert.equal(shown.details.tagline, null)
	assert.equal(shown.details.canonical_title, "The Matrix")
	assert.equal(shown.details.presentation?.title.language, "ar-SA")
	assert.equal(shown.details.release_year, 1999)
	assert.equal(shown.country, "DE")
	assert.equal(matrix.details.title, "The Matrix", "the page's own data is not changed")
})

test("a late answer for another language or title is never shown", () => {
	assert.equal(withLocalizedText(matrix, payload("ar"), "ja"), null)
	assert.equal(withLocalizedText(matrix, payload("ar", { tmdb_id: 604 }), "ar"), null)
	assert.equal(withLocalizedText(matrix, payload("ar", { media_type: "show" }), "ar"), null)
	assert.equal(withLocalizedText(matrix, undefined, "ar"), null)
})

test("no poster in the payload keeps the page's poster", () => {
	const shown = withLocalizedText(matrix, payload("ar", { poster_path: null }), "ar")
	assert.equal(shown?.details.poster_path, "/en.jpg")
})
