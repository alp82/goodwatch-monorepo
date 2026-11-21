import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../../server/title-filter/test-alias.ts"
import brands from "../../../../domain/new-on-services-brands.json" with { type: "json" }
import { COUNTRIES } from "./countries.ts"
import { DECADES } from "./decades.ts"
import { GENRES } from "./genres.ts"
import { headings } from "./headings.ts"
import { type CopyFamily, type Kind, copyFor, copyIds } from "./index.ts"
import { BEST, HUB } from "./misc.ts"
import { MOODS } from "./moods.ts"
import { SERVICES } from "./services.ts"
import { STYLES, THEMES } from "./themes-styles.ts"
import type { Deck, PlaceCopy } from "./types.ts"

const { MOOD_KEYS, MOODS: MOOD_LIST } = await import("../../../../domain/moods.ts")
const {
	STYLES: STYLE_LIST,
	STYLE_KEYS,
	THEMES: THEME_LIST,
	THEME_KEYS,
} = await import("../../../../domain/themes-styles.ts")
const { genres } = await import("../../../../ui/explore/category/genres.ts")

const KINDS: ("movies" | "shows")[] = ["movies", "shows"]
const DECADE_NAMES = [
	"1930s",
	"1940s",
	"1950s",
	"1960s",
	"1970s",
	"1980s",
	"1990s",
	"2000s",
	"2010s",
	"2020s",
]
// The genre names of the titles themselves (TMDB's movie and TV lists), by the kind that carries them.
const TITLE_GENRES: Record<"movies" | "shows", string[]> = {
	movies: [
		"Action",
		"Adventure",
		"Animation",
		"Comedy",
		"Crime",
		"Documentary",
		"Drama",
		"Family",
		"Fantasy",
		"History",
		"Horror",
		"Music",
		"Mystery",
		"Romance",
		"Science Fiction",
		"Thriller",
		"TV Movie",
		"War",
		"Western",
	],
	shows: [
		"Action & Adventure",
		"Animation",
		"Comedy",
		"Crime",
		"Documentary",
		"Drama",
		"Family",
		"Kids",
		"Mystery",
		"News",
		"Reality",
		"Sci-Fi & Fantasy",
		"Soap",
		"Talk",
		"War & Politics",
		"Western",
		"Horror",
	],
}

const must = (kind: Kind, family: CopyFamily, id: string): PlaceCopy => {
	const copy = copyFor(kind, family, id)
	assert.ok(copy, `${family} "${id}" has no ${kind} copy`)
	return copy
}

test("every mood has copy for movies and shows, by key and by name", () => {
	for (const kind of KINDS) {
		for (const key of MOOD_KEYS) must(kind, "moods", key)
		for (const mood of MOOD_LIST)
			assert.equal(copyFor(kind, "moods", mood.name), must(kind, "moods", mood.key))
	}
})

test("every theme and style has copy for movies and shows, by id and by name", () => {
	for (const kind of KINDS) {
		for (const key of THEME_KEYS) must(kind, "themes", key)
		for (const key of STYLE_KEYS) must(kind, "styles", key)
		for (const theme of THEME_LIST)
			assert.equal(copyFor(kind, "themes", theme.name), must(kind, "themes", theme.id))
		for (const style of STYLE_LIST)
			assert.equal(copyFor(kind, "styles", style.name), must(kind, "styles", style.id))
	}
})

test("every genre has copy for the kinds it exists in", () => {
	for (const kind of KINDS) for (const name of TITLE_GENRES[kind]) must(kind, "genres", name)
	// The category pages of today (ui/explore/category/genres.ts), by their own paths.
	for (const page of Object.values(genres)) {
		const kinds = page.type === "all" ? KINDS : [page.type as "movies" | "shows"]
		for (const kind of kinds) must(kind, "genres", page.path)
	}
	assert.equal(copyFor("movies", "genres", "News"), null)
	assert.equal(copyFor("shows", "genres", "TV Movie"), null)
})

test("every decade has copy for movies and shows", () => {
	for (const kind of KINDS)
		for (const decade of DECADE_NAMES) {
			must(kind, "decades", decade)
			assert.equal(copyFor(kind, "decades", decade.slice(0, 4)), copyFor(kind, "decades", decade))
		}
})

test("every streaming brand, the hub, each family page and Best have copy", () => {
	for (const kind of KINDS) {
		for (const brand of brands) must(kind, "services", brand.slug)
		must(kind, "best", "all")
		for (const id of [
			"home",
			"moods",
			"genres",
			"themes",
			"styles",
			"decades",
			"countries",
			"services",
			"best",
		])
			must(kind, "hub", id)
	}
})

test("countries answer to their code and their name", () => {
	for (const kind of KINDS) {
		assert.ok(copyIds(kind, "countries").length >= 24)
		assert.equal(copyFor(kind, "countries", "JP"), must(kind, "countries", "japan"))
		assert.equal(copyFor(kind, "countries", "Türkiye"), must(kind, "countries", "tr"))
		assert.equal(copyFor(kind, "countries", "hong-kong-sar-china"), must(kind, "countries", "HK"))
		assert.equal(copyFor(kind, "countries", "zz"), null)
	}
})

const ALL: [string, Deck][] = [
	["moods", MOODS],
	["genres", GENRES],
	["themes", THEMES],
	["styles", STYLES],
	["decades", DECADES],
	["countries", COUNTRIES],
	["services", SERVICES],
	["best", BEST],
	["hub", HUB],
]
const texts: { where: string; copy: PlaceCopy }[] = []
for (const [family, deck] of ALL)
	for (const [id, entry] of Object.entries(deck)) {
		if ("lede" in entry) texts.push({ where: `${family}/${id}`, copy: entry })
		else
			for (const kind of [...KINDS, "all"] as Kind[]) {
				const copy = entry[kind]
				if (copy) texts.push({ where: `${family}/${id}/${kind}`, copy })
			}
	}

// Words that read as filler or as the machine talking.
const BANNED =
	/rollercoaster|roller coaster|tour de force|tapestry|delve|testament to|masterclass|goodwatch|fingerprint|edge of your seat|emotional journey|stand the test of time|must-watch|look no further|whether you're/i

test("a card line stays under 60 characters and ends its sentence", () => {
	for (const { where, copy } of texts) {
		assert.ok(copy.short.length < 60, `${where}: short is ${copy.short.length} characters`)
		assert.match(copy.short, /[.?!]$/, `${where}: short has no end`)
	}
})

test("a lede is a few short sentences, in plain words", () => {
	for (const { where, copy } of texts) {
		const sentences = copy.lede.split(/(?<=[.?!]"?)\s+(?=[A-Z"])/).length
		assert.ok(sentences >= 2 && sentences <= 4, `${where}: ${sentences} sentences`)
		assert.ok(copy.lede.length <= 330, `${where}: lede is ${copy.lede.length} characters`)
		for (const text of [copy.short, copy.lede]) {
			assert.doesNotMatch(text, /[—–]/, `${where}: dash`)
			assert.doesNotMatch(text, BANNED, `${where}: banned phrase`)
			// No counts, scores or years: the only digits are the decade in a decade's own text.
			if (!where.startsWith("decades/")) assert.doesNotMatch(text, /\d/, `${where}: digit`)
		}
	}
})

// The movie genres whose shows side is the shows' merged shelf (Action and Adventure are Action & Adventure).
const shared =
	/genres\/(action|adventure|action-adventure|fantasy|science-fiction|sci-fi-fantasy|war|war-politics)\//

test("no two places share a card line or a lede, apart from genres that are one shelf", () => {
	const seen = new Map<string, string>()
	const place = (where: string) => where.split("/").slice(0, 2).join("/")
	for (const { where, copy } of texts) {
		if (shared.test(where) && where.endsWith("/shows")) continue
		if (where.startsWith("hub/")) continue
		for (const text of [copy.short, copy.lede]) {
			const first = seen.get(text)
			// Movies and shows together may keep a place's own card line where it fits both.
			if (first && where.endsWith("/all") && place(first) === place(where)) continue
			assert.ok(!first, `${where} repeats ${first}`)
			seen.set(text, where)
		}
	}
})

test("movies and shows together have a text of their own wherever both kinds have one", () => {
	for (const [family, deck] of ALL)
		for (const [id, entry] of Object.entries(deck)) {
			if ("lede" in entry) continue
			if (entry.movies && entry.shows) {
				// The shows side of a movie genre is the shows' merged shelf: the mix reads that shelf's own text.
				if (shared.test(`${family}/${id}/`) && !entry.all) continue
				// TMDB tags only movies with these, so the mix holds movies alone there and reads the movie text.
				if (/^genres\/(horror|thriller|romance|history|music)$/.test(`${family}/${id}`)) {
					assert.equal(copyFor("all", "genres", id), entry.movies)
					continue
				}
				assert.ok(entry.all, `${family}/${id} has no text for movies and shows together`)
			}
			assert.ok(copyFor("all", family as CopyFamily, id), `${family}/${id}: nothing for "all"`)
		}
})

test("a text for movies and shows together never speaks of movies alone", () => {
	const big = /\b(movies?|films?|cinema)\b/i
	const small =
		/\b(shows?|series|television|TV|episodes?|seasons?|sitcoms?|telenovelas?|soaps?|anime)\b/i
	for (const { where, copy } of texts) {
		if (!where.endsWith("/all")) continue
		// A card line and its lede are read together on a place's page.
		const text = `${copy.short} ${copy.lede}`
		if (big.test(text)) assert.match(text, small, `${where}: movies only: ${text}`)
	}
})

test("headings are plain", () => {
	assert.equal(headings.closeTo("Cozy"), "Close to Cozy")
	assert.equal(headings.kindsOf("comedy"), "Kinds of comedy")
	for (const value of Object.values(headings)) {
		const text = typeof value === "function" ? value("this") : value
		assert.doesNotMatch(text, /,| and /)
	}
})
