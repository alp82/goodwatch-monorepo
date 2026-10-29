// A member's start (member.server.ts) against fake reads: what it reads, that the reads run side by side, and what a
// failed read leaves.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../title-filter/test-alias.ts"
import type { TonightParts } from "~/server/home-doors.server"
import type { MyShowsRow } from "~/server/my-shows.server"
import type { Taste } from "~/server/taste/index.server"
import type { TitleCard } from "~/server/title-cards.server"
import type { ViewerContext } from "~/server/viewer.server"
import type { MemberStart, MemberStartReads } from "./member.server.ts"

const { loadMemberStart } = await import("./member.server.ts")
const { card } = await import(
	"../../ui/start/member/member-fixtures.test-support.ts"
)

const ctx = { services: [8, 9], country: "DE" } as unknown as ViewerContext
const taste = (ratings: number) => ({ ratings }) as unknown as Taste

const row = (id: number, activeAt: number, next = true) =>
	({
		id,
		kind: "next",
		activeAt,
		next: next
			? {
					season: 2,
					number: id,
					name: `Episode name ${id}`,
					airDate: null,
					runtime: 30,
				}
			: null,
	}) as unknown as MyShowsRow

const parts = (over: Partial<TonightParts> = {}): TonightParts =>
	({
		shows: {
			continue: [row(1, 10), row(2, 20)],
			pickUp: [row(3, 1, false)],
			start: [{ id: 50 }],
		},
		movies: [card("movie", 101)],
		movieCount: 5,
		movieFits: true,
		movieByMatch: true,
		newOn: { movie: null, start: null },
		...over,
	}) as unknown as TonightParts

/** Reads that answer at once and record what was asked. */
function fakeReads(over: Partial<MemberStartReads> = {}, ratings = 40) {
	const asked: string[] = []
	const note = <T>(name: string, value: T) => {
		asked.push(name)
		return value
	}
	const reads: MemberStartReads = {
		viewer: async () => note("viewer", ctx),
		taste: async () => note("taste", taste(ratings)),
		tonightParts: async () => note("tonightParts", parts()),
		wishlist: async () =>
			note("wishlist", {
				cards: [card("movie", 101), card("movie", 102)],
				total: 7,
			}),
		forYou: async (_ctx, kind) =>
			note(
				`forYou:${kind}`,
				kind === "movie"
					? [card("movie", 201), card("movie", 203)]
					: [card("show", 202)],
			),
		hotEnabled: () => true,
		hot: async () =>
			note("hot", [
				{
					mediaType: "movie" as const,
					tmdbId: 301,
					rank: 1,
					why: "New trailer · today",
				},
				{
					mediaType: "show" as const,
					tmdbId: 302,
					rank: 2,
					why: "New season · yesterday",
				},
			]),
		cards: async (keys) =>
			note(
				`cards:${keys.length}`,
				keys.map((key) =>
					key >= 2e12 ? card("show", key - 2e12) : card("movie", key - 1e12),
				),
			),
		...over,
	}
	return { reads, asked }
}

const request = new Request("https://goodwatch.app/")

/** The start once the lists that come later have arrived. */
async function settled({ data, later }: MemberStart) {
	return {
		...data,
		...(later.forYou ? { forYou: await later.forYou } : {}),
		...(later.hot ? { hot: await later.hot } : {}),
	}
}

/** A read that waits until its gate opens (every call to it). */
function gated<T>(value: () => T) {
	const waiting: (() => void)[] = []
	const read = () =>
		new Promise<T>((resolve) => {
			waiting.push(() => resolve(value()))
		})
	return {
		read,
		open: () => {
			for (const resolve of waiting) resolve()
		},
		get asked() {
			return waiting.length > 0
		},
	}
}

test("reads every list and shapes it for the start", async () => {
	const { reads } = fakeReads()
	const start = await settled(await loadMemberStart(request, "member-1", reads))
	assert.equal(start.ratings, 40)
	assert.deepEqual(start.services, [8, 9])
	// Show 2 was active last: its next episode is Tonight's pick.
	assert.equal(start.tonight?.card.key, 2e12 + 2)
	assert.equal(start.tonight?.episode, "S2 E2 · Episode name 2")
	assert.equal(start.tonight?.source, "continue")
	// Continue, then Pick up; a show without a next episode has no line.
	assert.deepEqual(
		start.continue?.titles.map((s) => [s.card.tmdb_id, s.episode]),
		[
			[1, "S2 E1 · Episode name 1"],
			[2, "S2 E2 · Episode name 2"],
			[3, null],
		],
	)
	assert.equal(start.continue?.total, 3)
	assert.deepEqual(
		start.wishlist?.titles.map((c) => c.tmdb_id),
		[101, 102],
	)
	assert.equal(start.wishlist?.total, 7)
	// Movies and shows take turns.
	assert.deepEqual(
		start.forYou?.titles.map((c) => c.tmdb_id),
		[201, 202, 203],
	)
	assert.equal(start.hotOn, true)
	assert.deepEqual(
		start.hot?.titles.map((t) => [t.card.key, t.rank, t.why]),
		[
			[1e12 + 301, 1, "New trailer · today"],
			[2e12 + 302, 2, "New season · yesterday"],
		],
	)
})

test("the reads start side by side: none waits for another list", async () => {
	const gates: Record<string, () => void> = {}
	const started: string[] = []
	const held =
		<T>(name: string, value: () => T) =>
		() => {
			started.push(name)
			return new Promise<T>((resolve) => {
				gates[name] = () => resolve(value())
			})
		}
	const { reads } = fakeReads({
		tonightParts: held("tonightParts", () => parts()),
		wishlist: held("wishlist", () => ({ cards: [], total: 0 })),
		forYou: (_ctx, kind) => held(`forYou:${kind}`, () => [] as TitleCard[])(),
		hot: held("hot", () => []),
	})
	const pending = loadMemberStart(request, "member-1", reads)
	await new Promise((resolve) => setTimeout(resolve, 0))
	assert.deepEqual(started.sort(), [
		"forYou:movie",
		"forYou:show",
		"hot",
		"tonightParts",
		"wishlist",
	])
	for (const open of Object.values(gates)) open()
	await pending
})

test("For you isn't read without a single rating", async () => {
	const { reads, asked } = fakeReads({}, 0)
	const start = await settled(await loadMemberStart(request, "member-1", reads))
	assert.ok(!asked.some((name) => name.startsWith("forYou")))
	assert.deepEqual(start.forYou, { titles: [], total: 0 })
})

test("Hot on socials isn't read while the member doesn't see it", async () => {
	const { reads, asked } = fakeReads({ hotEnabled: () => false })
	const start = await settled(await loadMemberStart(request, "member-1", reads))
	assert.ok(!asked.includes("hot"))
	assert.equal(start.hotOn, false)
	assert.equal(start.hot, null)
})

test("a failed read leaves its list null and the rest of the start", async () => {
	const fail = async () => {
		throw new Error("down")
	}
	const error = console.error
	console.error = () => {}
	try {
		const { reads } = fakeReads({
			wishlist: fail,
			hot: fail,
			tonightParts: fail,
		})
		const start = await settled(
			await loadMemberStart(request, "member-1", reads),
		)
		assert.equal(start.wishlist, null)
		assert.equal(start.hot, null)
		assert.equal(start.hotOn, true)
		assert.equal(start.continue, null)
		assert.equal(start.tonight, null)
		assert.equal(start.forYou?.titles.length, 3)
	} finally {
		console.error = error
	}
})

test("Tonight's pick is the first movie without a show to continue, and the show to start without either", async () => {
	const noShows = parts({
		shows: {
			continue: [],
			pickUp: [],
			start: [{ id: 50 }],
		} as unknown as TonightParts["shows"],
	})
	let { reads } = fakeReads({ tonightParts: async () => noShows })
	let start = await settled(await loadMemberStart(request, "member-1", reads))
	assert.equal(start.tonight?.card.key, 1e12 + 101)
	assert.equal(start.tonight?.source, "wishlist")
	;({ reads } = fakeReads({
		tonightParts: async () => ({ ...noShows, movies: [] }),
	}))
	start = await settled(await loadMemberStart(request, "member-1", reads))
	assert.equal(start.tonight?.card.key, 2e12 + 50)
	assert.equal(start.tonight?.source, "wishlist")
	assert.deepEqual(start.continue?.titles, [])
})

test("Tonight's pick stays when its show is past the first titles of Continue", async () => {
	// Thirteen shows: Continue lists them by its own order, the pick is the one last active on (show 13, the last).
	const shows = Array.from({ length: 13 }, (_, i) =>
		row(i + 1, i === 12 ? 99 : 1),
	)
	const { reads, asked } = fakeReads({
		tonightParts: async () =>
			parts({
				shows: {
					continue: shows,
					pickUp: [],
					start: [],
				} as unknown as TonightParts["shows"],
			}),
	})
	const { data: start } = await loadMemberStart(request, "member-1", reads)
	assert.equal(start.continue?.titles.length, 12)
	assert.ok(!start.continue?.titles.some((s) => s.card.tmdb_id === 13))
	assert.equal(start.continue?.total, 13)
	assert.equal(start.tonight?.card.key, 2e12 + 13)
	assert.equal(start.tonight?.episode, "S2 E13 · Episode name 13")
	assert.equal(start.tonight?.source, "continue")
	// One read for the twelve listed shows and the pick's show.
	assert.ok(asked.includes("cards:13"))
})

test("the page doesn't wait for For you and Hot on socials while an own list opens first", async () => {
	const forYou = gated(() => [card("movie", 201)])
	const hot = gated(() => [
		{ mediaType: "movie" as const, tmdbId: 301, rank: 1, why: "New trailer" },
	])
	const { reads } = fakeReads({ forYou: forYou.read, hot: hot.read })
	const { data, later } = await loadMemberStart(request, "member-1", reads)
	// Both were asked for at once, and the page came without them.
	assert.ok(forYou.asked && hot.asked)
	assert.equal(data.forYou, undefined)
	assert.equal(data.hot, undefined)
	assert.ok(data.continue?.titles.length)
	assert.ok(later.forYou && later.hot)
	forYou.open()
	hot.open()
	assert.deepEqual(
		(await later.forYou)?.titles.map((c) => c.key),
		[1e12 + 201],
	)
	assert.deepEqual(
		(await later.hot)?.titles.map((t) => t.card.key),
		[1e12 + 301],
	)
})

test("when For you is the door that opens, the page waits for it and Hot on socials still comes later", async () => {
	const hot = gated(() => [])
	const { reads } = fakeReads({
		tonightParts: async () =>
			parts({
				shows: {
					continue: [],
					pickUp: [],
					start: [],
				} as unknown as TonightParts["shows"],
				movies: [],
			}),
		wishlist: async () => ({ cards: [], total: 0 }),
		hot: hot.read,
	})
	const { data, later } = await loadMemberStart(request, "member-1", reads)
	assert.equal(data.forYou?.titles.length, 3)
	assert.equal(later.forYou, undefined)
	assert.equal(data.hot, undefined)
	assert.ok(later.hot)
	hot.open()
})

test("a new member opens Hot on socials: the page waits for it; For you without ratings is known to be empty", async () => {
	const { reads } = fakeReads(
		{
			tonightParts: async () =>
				parts({
					shows: {
						continue: [],
						pickUp: [],
						start: [],
					} as unknown as TonightParts["shows"],
					movies: [],
				}),
			wishlist: async () => ({ cards: [], total: 0 }),
		},
		0,
	)
	const { data, later } = await loadMemberStart(request, "member-1", reads)
	assert.deepEqual(data.forYou, { titles: [], total: 0 })
	assert.equal(data.hot?.titles.length, 2)
	assert.deepEqual(later, {})
})

test("an open door that turns out empty passes the opening on, and the page waits for the next one", async () => {
	const { reads } = fakeReads({
		tonightParts: async () =>
			parts({
				shows: {
					continue: [],
					pickUp: [],
					start: [],
				} as unknown as TonightParts["shows"],
				movies: [],
			}),
		wishlist: async () => ({ cards: [], total: 0 }),
		forYou: async () => [],
	})
	const { data, later } = await loadMemberStart(request, "member-1", reads)
	assert.deepEqual(data.forYou, { titles: [], total: 0 })
	assert.equal(data.hot?.titles.length, 2)
	assert.deepEqual(later, {})
})
