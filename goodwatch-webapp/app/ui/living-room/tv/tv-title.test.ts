// What the TV says about one title, and the rules behind its keys.
import assert from "node:assert/strict"
import { test } from "node:test"
import type { CardService, TitleCard } from "~/server/title-cards.server"
import type { TvTonightPick } from "./tv-home.ts"
import { tvItems, EMPTY_CONTEXT } from "./tv-machine.ts"
import {
	RATE_ANSWERS,
	parseTvTitleKey,
	ratedToast,
	recordsWatch,
	seenLabel,
	titleKicker,
	tonightWords,
	wantLabel,
	watchKey,
	whereLine,
} from "./tv-title.ts"

const service = (id: number, name: string): CardService => ({
	id,
	name,
	logo_path: `/${id}.jpg`,
})
const netflix = service(8, "Netflix")
const prime = service(9, "Amazon Prime Video")
const disney = service(337, "Disney Plus")

const card = (rest: Partial<TitleCard> = {}) =>
	({
		media_type: "movie",
		tmdb_id: 603,
		title: "The Matrix",
		tagline: "Free your mind.",
		...rest,
	}) as TitleCard

test("a title's key on the TV names a movie or a show by its TMDB id", () => {
	assert.deepEqual(parseTvTitleKey("movie-603"), {
		mediaType: "movie",
		tmdbId: 603,
	})
	assert.deepEqual(parseTvTitleKey("show-1399"), {
		mediaType: "show",
		tmdbId: 1399,
	})
	for (const key of ["", "movie", "movie-0", "film-603", "movie-603x", "603"])
		assert.equal(parseTvTitleKey(key), null, key)
})

test("the kicker says the year, the kind and the length", () => {
	const kicker = (rest: Partial<TitleCard>) => titleKicker(card(rest))
	assert.equal(
		kicker({ release_year: 2019, runtime: 130 }),
		"2019 · Movie · 2h 10m",
	)
	assert.equal(
		kicker({ release_year: 1999, runtime: 45 }),
		"1999 · Movie · 45 min",
	)
	assert.equal(
		kicker({ media_type: "show", release_year: 2021, runtime: 48 }),
		"2021 · Show · 48 min episodes",
	)
	// What nobody knows is left out.
	assert.equal(kicker({ release_year: null, runtime: null }), "Movie")
	assert.equal(kicker({ media_type: "show", release_year: 2021 }), "2021 · Show")
})

test("the Watch key says Watch on a service of the person's, On for another", () => {
	const title = card({ services: [netflix, disney] })
	assert.deepEqual(watchKey(title, [netflix]), {
		label: "Watch on Netflix",
		goes: true,
	})
	assert.deepEqual(watchKey(title, []), { label: "On Netflix", goes: true })
	assert.deepEqual(watchKey(title, [prime]), {
		label: "On Netflix",
		goes: true,
	})
})

test("the person's own service leads wherever it stands, under the name the title page shows", () => {
	const title = card({ services: [netflix, disney, prime] })
	assert.equal(watchKey(title, [disney]).label, "Watch on Disney+")
	assert.equal(watchKey(title, [prime]).label, "Watch on Prime")
	// A plan of the same brand is the same service.
	assert.equal(
		watchKey(title, [service(1796, "Netflix basic with Ads")]).label,
		"Watch on Netflix",
	)
	assert.equal(whereLine(title, [disney]), "On Disney+")
})

test("a title that streams nowhere has a key that does nothing", () => {
	assert.deepEqual(watchKey(card({ services: [] }), [netflix]), {
		label: "Not streaming",
		goes: false,
	})
	assert.equal(whereLine(card({ services: [] }), []), "Not streaming")
})

test("while nobody knows where a title streams, the key says where it leads", () => {
	// Its card is on its way, or the country's availability is still loading.
	for (const title of [null, card(), card({ services: null })]) {
		assert.deepEqual(watchKey(title, [netflix]), {
			label: "Where to watch",
			goes: true,
		})
		assert.equal(whereLine(title, [netflix]), null)
	}
})

test("Want to See and Seen it say what is", () => {
	assert.equal(wantLabel(false), "Want to See")
	assert.equal(wantLabel(true), "On Wishlist ✓")
	assert.equal(seenLabel(null, false), "Seen it")
	assert.equal(seenLabel(null, true), "Seen ✓")
	assert.equal(seenLabel(8, true), "8 · Great")
	assert.equal(seenLabel(10, true), "10 · Masterpiece")
	assert.equal(ratedToast(7), "Rated 7 · Good")
})

test("the rating's answers are the machine's items, each with its word", () => {
	const rate = tvItems({ name: "rate", title: "movie-603" }, EMPTY_CONTEXT)
	assert.deepEqual(
		RATE_ANSWERS.map((answer) => answer.item),
		rate.filter((item) => item.startsWith("level:")),
	)
	assert.deepEqual(RATE_ANSWERS, [
		{ item: "level:9", label: "Excellent" },
		{ item: "level:7", label: "Good" },
		{ item: "level:5", label: "Mediocre" },
		{ item: "level:3", label: "Bad" },
	])
})

test("Seen it records a member's watch of a movie, and the Seen press of a show not started", () => {
	const press = { signedIn: true, seen: false, started: false }
	assert.equal(recordsWatch({ ...press, mediaType: "movie" }), true)
	assert.equal(recordsWatch({ ...press, mediaType: "show" }), true)
	// A movie the member is tracking without having seen it (a watch taken back) gets its watch.
	assert.equal(
		recordsWatch({ ...press, mediaType: "movie", started: true }),
		true,
	)
})

test("Seen it never records a guest's watch, a second one, or a show the member is in the middle of", () => {
	const press = { signedIn: true, seen: false, started: false }
	for (const mediaType of ["movie", "show"] as const) {
		assert.equal(recordsWatch({ ...press, mediaType, signedIn: false }), false)
		assert.equal(recordsWatch({ ...press, mediaType, seen: true }), false)
	}
	assert.equal(
		recordsWatch({ ...press, mediaType: "show", started: true }),
		false,
	)
})

test("Tonight says where a pick comes from and which one it is", () => {
	const pick = (rest: Partial<TvTonightPick> = {}): TvTonightPick => ({
		card: card(),
		href: null,
		...rest,
	})
	assert.deepEqual(tonightWords(pick(), 0, 3), {
		crumb: "Best rated right now",
		kicker: "Pick 1 of 3",
		line: "Free your mind.",
	})
	assert.equal(
		tonightWords(pick({ href: "/my-movies" }), 1, 3).crumb,
		"From your Wishlist",
	)
	assert.equal(tonightWords(pick({ href: "/my-movies" }), 1, 3).kicker, "Pick 2 of 3")
	// A guest's own pick is the last title on the Wishlist in their browser.
	assert.equal(tonightWords(pick({ wished: true }), 0, 3).crumb, "From your Wishlist")
	assert.equal(tonightWords(pick({ card: card({ tagline: null }) }), 0, 1).line, null)
})

test("a member's next episode is named, with its own name in the title's line", () => {
	const episode = (name: string | null): TvTonightPick => ({
		card: card({ media_type: "show", title: "Slow Horses" }),
		href: "/my-shows",
		episode: { code: "S2 E4", name },
	})
	assert.deepEqual(tonightWords(episode("Cicada"), 0, 3), {
		crumb: "Next episode: S2 E4",
		kicker: "Pick 1 of 3",
		line: "Cicada",
	})
	// An episode without a name leaves the show's own line.
	assert.equal(tonightWords(episode(null), 0, 3).line, "Free your mind.")
})
