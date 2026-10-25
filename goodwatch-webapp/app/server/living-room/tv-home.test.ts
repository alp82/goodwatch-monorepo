// What the start page with the new TV loads: the same for every guest, and a member's Tonight and My shows shaped
// from what home's doors read.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../title-filter/test-alias.ts"
import type { TonightParts } from "~/server/home-doors.server"
import type {
	MyShows,
	MyShowsRow,
	MyShowsStart,
} from "~/server/my-shows.server"
import type { TitleCard } from "~/server/title-cards.server"

const { guestHome, memberHome, tonightShowIds, tvServices } = await import(
	"./tv-home.server.ts"
)

const card = (media_type: "movie" | "show", tmdb_id: number): TitleCard => ({
	key: tmdb_id * 2 + (media_type === "show" ? 1 : 0),
	tmdb_id,
	media_type,
	title: `${media_type} ${tmdb_id}`,
	poster_path: `/poster-${tmdb_id}.jpg`,
	backdrop_path: `/backdrop-${tmdb_id}.jpg`,
	release_year: 2020,
	runtime: 100,
	tagline: null,
	goodwatch_overall_score_normalized_percent: 80,
	goodwatch_overall_score_voting_count: 5000,
	match: 90,
	reasons: [],
	services: [],
	seen: false,
	wantToSee: true,
	notInterested: false,
	rating: null,
})

/** A show the member is in the middle of. `episode` is its Next episode's number; null leaves the list unread. */
const row = (id: number, episode: number | null = 4): MyShowsRow =>
	({
		id,
		kind: "next",
		left: 6,
		title: `Show ${id}`,
		poster_path: `/poster-${id}.jpg`,
		backdrop_path: `/backdrop-${id}.jpg`,
		next:
			episode === null
				? null
				: {
						season: 2,
						number: episode,
						name: `Episode ${episode}`,
						airDate: "2026-01-01",
						runtime: 48,
					},
		upcoming: null,
	}) as MyShowsRow

const toStart = (id: number): MyShowsStart => ({
	id,
	title: `Start ${id}`,
	poster_path: `/poster-${id}.jpg`,
	backdrop_path: `/backdrop-${id}.jpg`,
	match: 77,
	seasons: 1,
	episodes: 8,
	episodeMinutes: 50,
	running: true,
	service: "Netflix",
})

const parts = (
	shows: Partial<MyShows>,
	movies: TitleCard[] = [],
): TonightParts => ({
	shows: {
		continue: [],
		start: [],
		pickUp: [],
		waiting: [],
		onHold: [],
		dropped: [],
		total: 0,
		...shows,
	},
	movieCount: movies.length,
	movies,
	movieFits: true,
	movieByMatch: true,
	newOn: { movie: null, start: null },
})

const cardsFor = (p: TonightParts) =>
	tonightShowIds(p).map((id) => card("show", id))

test("replacement home DTO retains media provenance and Next episode language after canonical selection", async () => {
	const { overlayMediaRow } = await import("../../utils/media-overlay-core.ts")
	const { knownShow } = await import("../../ui/living-room/tv/tv-home.ts")
	const base = {
		media_type: "show" as const,
		tmdb_id: 10,
		title: "Canonical show",
	}
	const localized = overlayMediaRow(base, "ja", {
		canonical: [base],
		posters: [],
		translations: [
			{
				media_type: "show",
				media_tmdb_id: 10,
				language_code: "ja",
				country_code: "JP",
				title: "日本語の番組",
				overview: null,
				tagline: null,
			},
		],
	})
	const next = row(10)
	const p = parts({
		continue: [
			{
				...next,
				title: localized.title,
				canonical_title: localized.canonical_title,
				presentation: localized.presentation,
				next: next.next && {
					...next.next,
					name: "始まり",
					textPresentation: {
						name: { language: "ja-JP", source: "localized", fallback: false },
						overview: { language: "en", source: "canonical", fallback: true },
					},
				},
			},
		],
	})
	const result = memberHome(p, [{ ...card("show", 10), ...localized }])
	assert.equal(result.shows?.next[0].presentation?.title.language, "ja-JP")
	assert.equal(result.shows?.next[0].episode?.language, "ja-JP")
	assert.equal(result.tonight[0].episode?.language, "ja-JP")
	assert.equal(knownShow(result, "show-10")?.canonical_title, "Canonical show")
	assert.equal(p.shows.continue[0].next?.name, "始まり")
})
const tonightOf = (p: TonightParts) =>
	memberHome(p, cardsFor(p)).tonight.map((pick) => [
		`${pick.card.media_type}-${pick.card.tmdb_id}`,
		pick.href,
	])

test("a guest's home holds the start titles and the first picture, and nothing personal", () => {
	const titles = [
		{
			media_type: "movie" as const,
			tmdb_id: 603,
			title: "The Matrix",
			release_year: 1999,
			poster_path: "/matrix.jpg",
			goodwatch_overall_score_normalized_percent: 85,
		},
	]
	const services = [{ id: 8, name: "Netflix", logo_path: "/netflix.jpg" }]
	assert.deepEqual(
		guestHome({ titles, picture: "/matrix-backdrop.jpg" }, services),
		{
			member: false,
			startTitles: titles,
			picture: "/matrix-backdrop.jpg",
			tonight: [],
			shows: null,
			services,
		},
	)
})

test("Tonight's pick is the Next episode of the first show to continue, then the movies, then the first show to start", () => {
	const p = parts({ continue: [row(10), row(11)], start: [toStart(20)] }, [
		card("movie", 1),
		card("movie", 2),
		card("movie", 3),
	])
	assert.deepEqual(tonightShowIds(p), [10, 20])
	const { tonight } = memberHome(p, cardsFor(p))
	assert.deepEqual(tonightOf(p), [
		["show-10", "/my-shows"],
		["movie-1", "/my-movies"],
		["movie-2", "/my-movies"],
		["movie-3", "/my-movies"],
		["show-20", "/my-shows#start"],
	])
	assert.deepEqual(tonight[0].episode, { code: "S2 E4", name: "Episode 4", runtime: 48 })
	assert.equal(tonight[1].episode, undefined)
})

test("without a show to continue the first movie is the pick, and the first show to start follows the movies", () => {
	const p = parts({ start: [toStart(20), toStart(21)] }, [
		card("movie", 1),
		card("movie", 2),
	])
	assert.deepEqual(tonightShowIds(p), [20])
	assert.deepEqual(tonightOf(p), [
		["movie-1", "/my-movies"],
		["movie-2", "/my-movies"],
		["show-20", "/my-shows#start"],
	])
	// Watch next holds up to ten: ten movies leave no place for it.
	const ten = Array.from({ length: 10 }, (_, i) => card("movie", i + 1))
	assert.deepEqual(
		tonightOf(parts({ start: [toStart(20)] }, ten)),
		ten.map((one) => [`movie-${one.tmdb_id}`, "/my-movies"]),
	)
	assert.deepEqual(
		tonightOf(parts({ start: [toStart(20)] }, ten.slice(0, 9))).at(-1),
		["show-20", "/my-shows#start"],
	)
})

test("without a show to continue and without a movie the first show to start is the pick, once", () => {
	const p = parts({ start: [toStart(20), toStart(21)] })
	assert.deepEqual(tonightOf(p), [["show-20", "/my-shows#start"]])
})

test("a show waiting for its list is no episode pick: Continue's first row must have a Next episode", () => {
	// `tonightsPickOf` takes the first Continue row only when it is of the kind "next".
	const seenNew = { ...row(10), kind: "seenNew" } as MyShowsRow
	const p = parts({ continue: [seenNew] }, [card("movie", 1)])
	assert.deepEqual(tonightOf(p), [["movie-1", "/my-movies"]])
	// The episode's name comes with the show's list; without it the pick has no episode line.
	const unread = parts({ continue: [row(10, null)] })
	assert.equal(
		memberHome(unread, cardsFor(unread)).tonight[0].episode,
		undefined,
	)
})

test("a member with nothing to pick from has no Tonight, and a show the catalog lacks is left out", () => {
	assert.deepEqual(memberHome(parts({}), []), {
		tonight: [],
		shows: { next: [], start: [] },
	})
	const p = parts({ continue: [row(10)] }, [card("movie", 1)])
	assert.deepEqual(
		memberHome(p, []).tonight.map((pick) => pick.card.tmdb_id),
		[1],
	)
})

test("My shows on the TV: three shows to continue and three to start", () => {
	const p = parts({
		continue: [row(10), row(11, null), row(12), row(13)],
		pickUp: [row(30)],
		start: [toStart(20), toStart(21), toStart(22), toStart(23)],
	})
	const { shows } = memberHome(p, cardsFor(p))
	assert.deepEqual(
		shows?.next.map((show) => show.id),
		[10, 11, 12],
	)
	assert.deepEqual(shows?.next[0], {
		id: 10,
		title: "Show 10",
		poster_path: "/poster-10.jpg",
		backdrop_path: "/backdrop-10.jpg",
		episode: { code: "S2 E4", name: "Episode 4", runtime: 48 },
		left: 6,
		caughtUp: false,
	})
	assert.equal(shows?.next[1].episode, null)
	assert.deepEqual(
		shows?.start.map((show) => show.id),
		[20, 21, 22],
	)
	assert.deepEqual(shows?.start[0], {
		id: 20,
		title: "Start 20",
		poster_path: "/poster-20.jpg",
		backdrop_path: "/backdrop-20.jpg",
		match: 77,
		service: "Netflix",
		seasons: 1,
	})
})

test("My shows on the TV: a Seen show with new episodes says how many are new", () => {
	const back = { ...row(40, 1), kind: "seenNew", left: 2 } as MyShowsRow
	const p = parts({ continue: [row(10), back] })
	const next = memberHome(p, cardsFor(p)).shows?.next
	assert.deepEqual(
		next?.map((show) => [show.id, show.left, show.caughtUp]),
		[
			[10, 6, false],
			[40, 2, true],
		],
	)
})

test("without a show to continue, My shows lists the shows to pick up", () => {
	const p = parts({ pickUp: [row(30), row(31)] })
	assert.deepEqual(
		memberHome(p, []).shows?.next.map((show) => show.id),
		[30, 31],
	)
})

// ---- The person's two streaming services: the Remote's keys and home's tiles after the apps.

const NETFLIX = { id: 8, name: "Netflix", logo_path: "/netflix.jpg" }
const PRIME = { id: 9, name: "Amazon Prime Video", logo_path: "/prime.jpg" }
const DISNEY = { id: 337, name: "Disney Plus", logo_path: "/disney.jpg" }
const HULU = { id: 15, name: "Hulu", logo_path: "/hulu.jpg" }
const MAX = { id: 1899, name: "Max", logo_path: "/max.jpg" }
const ids = (services: { id: number }[]) => services.map(({ id }) => id)
/** The default keys as they come without a catalog's logo: the Remote has a drawn mark for both. */
const DEFAULT = [
	{ id: 8, name: "Netflix", logo_path: null },
	{ id: 9, name: "Prime", logo_path: null },
]

test("a guest's two services are Netflix and Prime Video, the same for every guest", () => {
	assert.deepEqual(tvServices([]), DEFAULT)
	assert.deepEqual(guestHome({ titles: [], picture: null }).services, DEFAULT)
})

test("a member's two services are their first two saved ones, in the order they saved them", () => {
	assert.deepEqual(tvServices([MAX, DISNEY, NETFLIX]), [
		{ id: 1899, name: "Max", logo_path: "/max.jpg" },
		{ id: 337, name: "Disney+", logo_path: "/disney.jpg" },
	])
})

test("a member with one saved service, or none, is filled up with Netflix, then Prime Video", () => {
	assert.deepEqual(ids(tvServices([HULU])), [15, 8])
	// A saved service that is one of the two is not given twice: the next fills up.
	assert.deepEqual(ids(tvServices([NETFLIX])), [8, 9])
	assert.deepEqual(ids(tvServices([PRIME])), [9, 8])
	assert.deepEqual(tvServices([]), DEFAULT)
	// The member's own keeps the catalog's logo and the app's short name.
	assert.deepEqual(tvServices([PRIME])[0], {
		id: 9,
		name: "Prime",
		logo_path: "/prime.jpg",
	})
})

test("two plans or channels of one brand are one key", () => {
	const ads = {
		id: 1796,
		name: "Netflix Standard with Ads",
		logo_path: "/a.jpg",
	}
	const channel = { id: 1825, name: "Max Amazon Channel", logo_path: "/c.jpg" }
	assert.deepEqual(
		ids(tvServices([NETFLIX, ads, MAX, channel, HULU])),
		[8, 1899],
	)
	// A plan of Netflix's stands for Netflix: Prime Video fills up, not Netflix again.
	assert.deepEqual(ids(tvServices([ads])), [1796, 9])
	// The key is named by the brand, whichever plan it stands for.
	assert.equal(tvServices([ads])[0].name, "Netflix")
	// A service without a logo in the catalog has none.
	assert.equal(
		tvServices([{ id: 5, name: "Plain", logo_path: "" }])[0].logo_path,
		null,
	)
})
