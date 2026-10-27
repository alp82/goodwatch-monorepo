// What the home's tiles show for a guest and a member, and the machine's context made of the page's data.
import assert from "node:assert/strict"
import { test } from "node:test"
import type { TitleCard } from "~/server/title-cards.server"
import { TASTE_GROUPS_NAME } from "../../taste/taste-groups-name.ts"
import type { StartTitle } from "../living-room-data"
import {
	type TvHomeData,
	type TvPool,
	type TvService,
	homeApps,
	homeServices,
	tonightOrder,
	tonightPicks,
	tvContextOf,
	watchRank,
} from "./tv-home.ts"
import { destinationHref, tvItems } from "./tv-machine.ts"

const card = (media_type: "movie" | "show", tmdb_id: number) =>
	({
		media_type,
		tmdb_id,
		title: `${media_type} ${tmdb_id}`,
		poster_path: `/poster-${tmdb_id}.jpg`,
		backdrop_path: `/backdrop-${tmdb_id}.jpg`,
	}) as TitleCard

const startTitles: StartTitle[] = Array.from({ length: 16 }, (_, i) => ({
	media_type: "movie",
	tmdb_id: 100 + i,
	title: `Start ${i}`,
	release_year: 2000 + i,
	poster_path: i === 1 ? null : `/start-${i}.jpg`,
	goodwatch_overall_score_normalized_percent: 70 + i,
}))

const guest: TvHomeData = {
	member: false,
	startTitles,
	picture: "/first-picture.jpg",
	tonight: [],
	shows: null,
	services: [],
}

const pool: TvPool = {
	suggestions: [1, 2, 3, 4, 5, 6].map((id) => card("movie", id)),
}

const show = (id: number) => ({
	id,
	title: `Show ${id}`,
	poster_path: `/poster-${id}.jpg`,
	backdrop_path: `/backdrop-${id}.jpg`,
})
const member: TvHomeData = {
	member: true,
	startTitles,
	picture: "/first-picture.jpg",
	tonight: [
		{
			card: card("show", 10),
			href: "/my-shows",
			episode: { code: "S2 E4", name: "Episode 4" },
		},
		{ card: card("movie", 1), href: "/my-movies" },
		{ card: card("movie", 2), href: "/my-movies" },
	],
	shows: {
		next: [
			{
				...show(10),
				episode: { code: "S2 E4", name: "Episode 4", runtime: 48 },
			},
			{ ...show(11), episode: null },
		],
		start: [{ ...show(20), match: 80, service: "Netflix" }],
	},
	services: [],
}

const artOf = (data: TvHomeData, p: TvPool | null, app: string) =>
	homeApps(data, p).find((tile) => tile.app === app)?.art

test("a guest's home before the pool is drawn from the start titles alone", () => {
	const apps = homeApps(guest, null)
	assert.deepEqual(
		apps.map((tile) => [tile.app, tile.name]),
		[
			["tonight", "Watch next"],
			["discover", "Discover"],
			["taste", "Your taste"],
		],
	)
	assert.deepEqual(apps[0].art, {
		kind: "backdrop",
		path: "/first-picture.jpg",
	})
	assert.equal(apps[0].line, "One pick at a time, best rated right now.")
	// The first four start titles that have a poster.
	assert.deepEqual(apps[1].art, {
		kind: "posters",
		paths: ["/start-0.jpg", "/start-2.jpg", "/start-3.jpg", "/start-4.jpg"],
	})
	assert.deepEqual(apps[2].art, { kind: "print" })
	assert.equal(apps[2].line, "Rate titles you've seen, get picks made for you.")
	// Nothing to pick from yet: Tonight has no items of its own.
	assert.deepEqual(tvContextOf(guest, null).tonight, [])
})

test("a guest's home tiles are the machine's apps; a member's home is Start, without them", () => {
	for (const [data, p] of [
		[guest, null],
		[guest, pool],
	] as const)
		assert.deepEqual(
			homeApps(data, p).map((tile) => `app:${tile.app}`).sort(),
			tvItems({ name: "home" }, tvContextOf(data, p)).filter((item) =>
				item.startsWith("app:"),
			).sort(),
		)
	const start = tvItems({ name: "home" }, tvContextOf(member, null))
	assert.deepEqual(
		start.filter((item) => item.startsWith("app:")),
		[],
	)
	// Each of the member's apps has its tile on Start.
	for (const tile of homeApps(member, null))
		assert.ok(start.includes(`start:${tile.app}`), tile.app)
})

test("the pool swaps in a guest's own picks: Watch next's, and the Discover tile's posters", () => {
	assert.deepEqual(artOf(guest, pool, "tonight"), {
		kind: "backdrop",
		path: "/backdrop-1.jpg",
	})
	assert.deepEqual(artOf(guest, pool, "discover"), {
		kind: "posters",
		paths: ["/poster-1.jpg", "/poster-2.jpg", "/poster-3.jpg", "/poster-4.jpg"],
	})
	const ctx = tvContextOf(guest, pool)
	// The pool's six, all of them: Watch next shows up to ten.
	assert.deepEqual(
		ctx.tonight,
		[1, 2, 3, 4, 5, 6].map((id) => ({ title: `movie-${id}`, href: null })),
	)
	assert.equal(ctx.member, false)
	// A guest's Tonight grows into Discover.
	assert.equal(destinationHref({ name: "tonight", pick: 0 }, ctx), "/discover")
})

test("a member's Tonight and My shows come with the loader, and need no pool", () => {
	const apps = homeApps(member, null)
	assert.deepEqual(
		apps.map((tile) => tile.app),
		["tonight", "discover", "taste", "shows"],
	)
	assert.deepEqual(apps[0].art, { kind: "backdrop", path: "/backdrop-10.jpg" })
	assert.equal(apps[0].line, "One pick at a time, your next episode first.")
	assert.equal(
		homeApps(member, null, true)[2].line,
		`${TASTE_GROUPS_NAME.title}.`,
	)
	assert.equal(apps[3].name, "My shows")
	// The first show to continue is Tonight's pick: the My shows tile shows the next show.
	assert.deepEqual(apps[3].art, { kind: "backdrop", path: "/backdrop-11.jpg" })
	const ctx = tvContextOf(member, null)
	assert.deepEqual(ctx.tonight, [
		{ title: "show-10", href: "/my-shows" },
		{ title: "movie-1", href: "/my-movies" },
		{ title: "movie-2", href: "/my-movies" },
	])
	assert.deepEqual(ctx.nextEpisodes, ["show-10", "show-11"])
	assert.deepEqual(ctx.toStart, ["show-20"])
	// Each pick grows into the member page it is the first thing on.
	assert.equal(destinationHref({ name: "tonight", pick: 0 }, ctx), "/my-shows")
	assert.equal(destinationHref({ name: "tonight", pick: 1 }, ctx), "/my-movies")
	// The pool changes the Discover tile's posters only.
	assert.deepEqual(tonightPicks(member, pool), member.tonight)
	assert.deepEqual(artOf(member, pool, "tonight"), apps[0].art)
	assert.deepEqual(
		artOf(member, pool, "discover"),
		artOf(guest, pool, "discover"),
	)
})

test("a member's Tonight from the Wishlist says so, and with one show the tiles share its picture", () => {
	const movies = { ...member, tonight: member.tonight.slice(1) }
	assert.equal(
		homeApps(movies, null)[0].line,
		"One pick at a time, from your Wishlist.",
	)
	const one: TvHomeData = {
		...member,
		shows: { next: [member.shows?.next[0] as never], start: [] },
	}
	assert.deepEqual(artOf(one, null, "shows"), {
		kind: "backdrop",
		path: "/backdrop-10.jpg",
	})
})

test("a member with nothing to pick from gets the pool's best, as a guest does", () => {
	const empty: TvHomeData = {
		...member,
		tonight: [],
		shows: { next: [], start: [] },
	}
	assert.deepEqual(artOf(empty, null, "tonight"), {
		kind: "backdrop",
		path: "/first-picture.jpg",
	})
	assert.equal(
		homeApps(empty, pool)[0].line,
		"One pick at a time, best rated right now.",
	)
	assert.deepEqual(artOf(empty, null, "shows"), {
		kind: "backdrop",
		path: null,
	})
	assert.deepEqual(
		tvContextOf(empty, pool).tonight.map((pick) => pick.title),
		["movie-1", "movie-2", "movie-3", "movie-4", "movie-5", "movie-6"],
	)
})

test("a guest's own Tonight's pick leads the pool's best, and is not named twice", () => {
	const keyed = (media_type: "movie" | "show", tmdb_id: number) => ({
		...card(media_type, tmdb_id),
		key: tmdb_id,
	})
	const best: TvPool = {
		suggestions: [keyed("movie", 1), keyed("show", 2), keyed("movie", 3)],
	}
	const wished = keyed("movie", 9)
	assert.deepEqual(tonightPicks(guest, best, wished), [
		{ card: wished, href: null, wished: true },
		{ card: best.suggestions[0], href: null },
		{ card: best.suggestions[1], href: null },
		{ card: best.suggestions[2], href: null },
	])
	// The pick is among the pool's best: once, first.
	assert.deepEqual(
		tonightPicks(guest, best, best.suggestions[1]).map((pick) => pick.card.key),
		[2, 1, 3],
	)
	// It is there before the pool is, and the machine's Tonight and the tile's picture follow it.
	assert.deepEqual(tonightPicks(guest, null, wished), [
		{ card: wished, href: null, wished: true },
	])
	assert.deepEqual(tvContextOf(guest, best, wished).tonight[0], {
		title: "movie-9",
		href: null,
	})
	assert.deepEqual(homeApps(guest, best, false, wished)[0].art, {
		kind: "backdrop",
		path: "/backdrop-9.jpg",
	})
})

test("a member's Tonight is their own: a pick from a browser's Wishlist changes nothing", () => {
	const wished = { ...card("movie", 9), key: 9 }
	assert.deepEqual(tonightPicks(member, pool, wished), member.tonight)
})

// ---- Tonight is for watching tonight.

const service = (id: number, name: string) => ({ id, name, logo_path: "" })
const NETFLIX = service(8, "Netflix")
const DISNEY = service(337, "Disney Plus")
const PRIME = service(9, "Amazon Prime Video")
/** A card of the pool with where it streams: a list, none (`[]`), or nobody knows (`null`). */
const streams = (
	tmdb_id: number,
	services: ReturnType<typeof service>[] | null,
) => ({ ...card("movie", tmdb_id), key: tmdb_id, services }) as TitleCard
const titlesOf = (cards: { tmdb_id: number }[]) => cards.map((c) => c.tmdb_id)

test("a title streams on the person's own service, on another one, or nowhere they can tell", () => {
	const mine = { ownServiceIds: [8] }
	assert.equal(watchRank(streams(1, [DISNEY, NETFLIX]), mine), 0)
	assert.equal(watchRank(streams(1, [DISNEY]), mine), 1)
	assert.equal(watchRank(streams(1, []), mine), 2)
	// While the country's availability loads, nobody knows.
	assert.equal(watchRank(streams(1, null), mine), 2)
	// A member's saved services come by name, a guest's by id.
	assert.equal(watchRank(streams(1, [DISNEY]), { savedServices: ["Disney Plus"] }), 0)
	// Without saved services nothing is the person's own.
	assert.equal(watchRank(streams(1, [NETFLIX]), {}), 1)
})

test("Tonight offers what streams on the person's services first, then what streams, then the rest", () => {
	const pool: TvPool = {
		ownServiceIds: [8],
		suggestions: [
			streams(1, []),
			streams(2, [DISNEY]),
			streams(3, [NETFLIX]),
			streams(4, [PRIME]),
			streams(5, [PRIME, NETFLIX]),
			streams(6, []),
		],
	}
	// Inside each group the pool's own order stays, and nothing is left out.
	assert.deepEqual(titlesOf(tonightOrder(pool)), [3, 5, 2, 4, 1, 6])
	assert.deepEqual(
		titlesOf(tonightPicks(guest, pool).map((pick) => pick.card)),
		[3, 5, 2, 4, 1, 6],
	)
	// The tile on home shows the first pick's picture.
	assert.deepEqual(homeApps(guest, pool)[0].art, {
		kind: "backdrop",
		path: "/backdrop-3.jpg",
	})
})

test("a person without saved services gets what streams in their country first", () => {
	const pool: TvPool = {
		suggestions: [streams(1, []), streams(2, [DISNEY]), streams(3, [NETFLIX])],
	}
	assert.deepEqual(titlesOf(tonightOrder(pool)), [2, 3, 1])
})

test("when too few titles stream, the picks are filled up with the pool's best of the rest", () => {
	const pool: TvPool = {
		ownServiceIds: [8],
		suggestions: [streams(1, []), streams(2, []), streams(3, [DISNEY]), streams(4, [])],
	}
	assert.deepEqual(
		titlesOf(tonightPicks(guest, pool).map((pick) => pick.card)),
		[3, 1, 2, 4],
	)
	// Nothing streams, or nobody knows yet: the pool's own order.
	for (const services of [[], null])
		assert.deepEqual(
			titlesOf(
				tonightOrder({
					suggestions: [1, 2, 3, 4].map((id) => streams(id, services)),
				}),
			),
			[1, 2, 3, 4],
		)
})

test("a guest's own pick still leads, and a member's Tonight is not reordered", () => {
	const pool: TvPool = {
		ownServiceIds: [8],
		suggestions: [streams(1, []), streams(2, [NETFLIX]), streams(3, [NETFLIX])],
	}
	const wished = streams(9, [])
	assert.deepEqual(
		titlesOf(tonightPicks(guest, pool, wished).map((pick) => pick.card)),
		[9, 2, 3, 1],
	)
	assert.deepEqual(tonightPicks(member, pool), member.tonight)
})

// ---- The person's two streaming services: the Remote's keys and home's tiles after the apps.

const netflix: TvService = { id: 8, name: "Netflix", logo_path: "/netflix.jpg" }
const disney: TvService = { id: 337, name: "Disney+", logo_path: "/disney.jpg" }
const keyed: TvHomeData = { ...guest, services: [netflix, disney] }

test("the machine's context names the person's two services by their ids, in the keys' order", () => {
	assert.deepEqual(tvContextOf(keyed, null).services, [8, 337])
	assert.deepEqual(tvContextOf(guest, null).services, [])
	// Home has a tile for each after the apps, for a guest and a member.
	assert.deepEqual(tvItems({ name: "home" }, tvContextOf(keyed, null)), [
		"app:tonight",
		"app:discover",
		"app:taste",
		"service:8",
		"service:337",
		"bar:search",
		"bar:menu",
	])
	assert.deepEqual(
		tvItems(
			{ name: "home" },
			tvContextOf({ ...member, services: [disney, netflix] }, null),
		).filter((id) => id.startsWith("service:")),
		[],
	)
})

test("a service's tile says what it opens, and before the pool it has no picture", () => {
	assert.deepEqual(homeServices(keyed, null), [
		{ service: netflix, line: "What to watch on Netflix.", picture: null },
		{ service: disney, line: "What to watch on Disney+.", picture: null },
	])
	assert.deepEqual(homeServices(guest, pool), [])
})

test("a service's tile shows the first of the person's picks that streams there", () => {
	const p: TvPool = {
		suggestions: [
			streams(1, [PRIME]),
			streams(2, [DISNEY]),
			streams(3, [NETFLIX]),
			streams(4, [NETFLIX, DISNEY]),
		],
	}
	assert.deepEqual(
		homeServices(keyed, p).map((tile) => tile.picture),
		["/backdrop-3.jpg", "/backdrop-2.jpg"],
	)
	// A title that streams nowhere there, or nobody knows where, is no picture of the service.
	assert.deepEqual(
		homeServices(keyed, {
			suggestions: [streams(1, [PRIME]), streams(2, null), streams(3, [])],
		}).map((tile) => tile.picture),
		[null, null],
	)
})

test("a service's tile takes another picture than Tonight's tile and the service before it, while it can", () => {
	// Tonight's tile shows the first pick, which streams on both.
	const both: TvPool = {
		suggestions: [
			streams(1, [NETFLIX, DISNEY]),
			streams(2, [NETFLIX, DISNEY]),
			streams(3, [NETFLIX, DISNEY]),
		],
	}
	assert.equal(homeApps(keyed, both)[0].art.kind, "backdrop")
	assert.deepEqual(
		homeServices(keyed, both).map((tile) => tile.picture),
		["/backdrop-2.jpg", "/backdrop-3.jpg"],
	)
	// With one title on a service, its picture is that title's, whoever else shows it.
	const one: TvPool = { suggestions: [streams(1, [NETFLIX, DISNEY])] }
	assert.deepEqual(
		homeServices(keyed, one).map((tile) => tile.picture),
		["/backdrop-1.jpg", "/backdrop-1.jpg"],
	)
})

test("a member's service tiles draw from their own Tonight before the pool is asked for", () => {
	const own: TvHomeData = {
		...member,
		services: [netflix, disney],
		tonight: [
			{ card: streams(10, [NETFLIX]), href: "/my-shows" },
			{ card: streams(11, [NETFLIX]), href: "/my-movies" },
			{ card: streams(12, [DISNEY]), href: "/my-movies" },
		],
	}
	assert.deepEqual(
		homeServices(own, null).map((tile) => tile.picture),
		["/backdrop-11.jpg", "/backdrop-12.jpg"],
	)
})

test("Watch next takes up to ten of a guest's picks", () => {
	const twelve: TvPool = {
		suggestions: Array.from({ length: 12 }, (_, i) => card("movie", i + 1)),
	}
	const picks = tonightPicks(guest, twelve)
	assert.equal(picks.length, 10)
	assert.equal(picks[9].card.tmdb_id, 10)
	// With a guest's own pick first, still ten.
	assert.equal(tonightPicks(guest, twelve, { ...card("movie", 99), key: 99 }).length, 10)
})
