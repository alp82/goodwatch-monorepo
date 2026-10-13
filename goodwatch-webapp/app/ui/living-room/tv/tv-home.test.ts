// What the home's tiles show for a guest and a member, and the machine's context made of the page's data.
import assert from "node:assert/strict"
import { test } from "node:test"
import type { TitleCard } from "~/server/title-cards.server"
import type { StartTitle } from "../living-room-data"
import {
	type TvHomeData,
	type TvPool,
	homeApps,
	tonightPicks,
	tvContextOf,
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
}))

const guest: TvHomeData = {
	member: false,
	startTitles,
	picture: "/first-picture.jpg",
	tonight: [],
	shows: null,
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
}

const artOf = (data: TvHomeData, p: TvPool | null, app: string) =>
	homeApps(data, p).find((tile) => tile.app === app)?.art

test("a guest's home before the pool is drawn from the start titles alone", () => {
	const apps = homeApps(guest, null)
	assert.deepEqual(
		apps.map((tile) => [tile.app, tile.name]),
		[
			["tonight", "Tonight"],
			["discover", "Discover"],
			["explorer", "Explorer"],
			["taste", "Taste"],
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
	assert.deepEqual(apps[2].art, { kind: "map" })
	assert.deepEqual(apps[3].art, { kind: "print" })
	assert.equal(apps[3].line, "Rate 5 titles, get picks made for you.")
	// Nothing to pick from yet: Tonight has no items of its own.
	assert.deepEqual(tvContextOf(guest, null).tonight, [])
})

test("the home's tiles are the machine's apps, for a guest and a member", () => {
	for (const [data, p] of [
		[guest, null],
		[guest, pool],
		[member, null],
	] as const)
		assert.deepEqual(
			homeApps(data, p).map((tile) => `app:${tile.app}`),
			tvItems({ name: "home" }, tvContextOf(data, p)).filter((item) =>
				item.startsWith("app:"),
			),
		)
})

test("the pool swaps in a guest's own picks: Tonight's three, and the Discover tile's posters", () => {
	assert.deepEqual(artOf(guest, pool, "tonight"), {
		kind: "backdrop",
		path: "/backdrop-1.jpg",
	})
	assert.deepEqual(artOf(guest, pool, "discover"), {
		kind: "posters",
		paths: ["/poster-1.jpg", "/poster-2.jpg", "/poster-3.jpg", "/poster-4.jpg"],
	})
	const ctx = tvContextOf(guest, pool)
	assert.deepEqual(ctx.tonight, [
		{ title: "movie-1", href: null },
		{ title: "movie-2", href: null },
		{ title: "movie-3", href: null },
	])
	assert.equal(ctx.member, false)
	// A guest's Tonight grows into Discover.
	assert.equal(destinationHref({ name: "tonight", pick: 0 }, ctx), "/discover")
})

test("a member's Tonight and My shows come with the loader, and need no pool", () => {
	const apps = homeApps(member, null)
	assert.deepEqual(
		apps.map((tile) => tile.app),
		["tonight", "discover", "explorer", "taste", "shows"],
	)
	assert.deepEqual(apps[0].art, { kind: "backdrop", path: "/backdrop-10.jpg" })
	assert.equal(apps[0].line, "One pick at a time, your next episode first.")
	assert.equal(apps[4].name, "My shows")
	// The first show to continue is Tonight's pick: the My shows tile shows the next show.
	assert.deepEqual(apps[4].art, { kind: "backdrop", path: "/backdrop-11.jpg" })
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
		["movie-1", "movie-2", "movie-3"],
	)
})
