// A guest's picks from the titles they loved (guest-pick.ts), against a mocked fetch.
import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import type { TitleCard } from "../../server/title-cards.server.ts"
import { findPick, shownPick } from "./guest-pick.ts"

const realFetch = globalThis.fetch
afterEach(() => {
	globalThis.fetch = realFetch
})

const card = (
	media_type: "movie" | "show",
	tmdb_id: number,
	more: Partial<TitleCard> = {},
) =>
	({
		key: (media_type === "movie" ? 1e12 : 2e12) + tmdb_id,
		media_type,
		tmdb_id,
		title: `T${tmdb_id}`,
		poster_path: `/p${tmdb_id}.jpg`,
		backdrop_path: `/b${tmdb_id}.jpg`,
		services: [{ id: 8, name: "Netflix", logo_path: "/n.png" }],
		...more,
	}) as TitleCard

/** A card as the requests name it. */
const name = (c: { media_type: string; tmdb_id: number } | null | undefined) =>
	c ? `${c.media_type}:${c.tmdb_id}` : null

type Call = { path: string; params: URLSearchParams }

/** Answers the two requests from tables; records every call. */
function mockFetch(
	recs: Record<string, { tmdb_id: number; match_percentage: number }[]>,
	cards: TitleCard[],
) {
	const calls: Call[] = []
	globalThis.fetch = (async (input: string) => {
		const url = new URL(input, "http://local")
		calls.push({ path: url.pathname, params: url.searchParams })
		if (url.pathname === "/api/guest-recommendations") {
			const type = url.searchParams.get("mediaType") as string
			return Response.json({
				recommendations: (recs[type] ?? []).map((r) => ({
					...r,
					media_type: type,
				})),
			})
		}
		const keys = (url.searchParams.get("cards") ?? "").split(",")
		return Response.json({
			cards: keys.flatMap((k) => cards.find((c) => name(c) === k) ?? []),
		})
	}) as typeof fetch
	return calls
}

const loved = [
	{ media_type: "movie" as const, tmdb_id: 1 },
	{ media_type: "show" as const, tmdb_id: 2 },
	{ media_type: "movie" as const, tmdb_id: 3 },
]

test("asks once per kind loved, with the loved titles scored at 10", async () => {
	const calls = mockFetch(
		{ movie: [{ tmdb_id: 10, match_percentage: 80 }], show: [] },
		[card("movie", 10)],
	)
	await findPick(loved, [], new Set())
	const recCalls = calls.filter((c) => c.path === "/api/guest-recommendations")
	assert.deepEqual(recCalls.map((c) => c.params.get("mediaType")).sort(), [
		"movie",
		"show",
	])
	for (const c of recCalls)
		assert.deepEqual(
			JSON.parse(c.params.get("scoredItems") as string).map(
				(s: { score: number }) => s.score,
			),
			[10, 10, 10],
		)
})

test("merges by match, drops answered titles, leads with a backdrop", async () => {
	const calls = mockFetch(
		{
			movie: [
				{ tmdb_id: 10, match_percentage: 70 },
				{ tmdb_id: 11, match_percentage: 95 },
			],
			show: [
				{ tmdb_id: 20, match_percentage: 90 },
				{ tmdb_id: 21, match_percentage: 85 },
			],
		},
		[
			card("movie", 10),
			card("movie", 11, { backdrop_path: null }),
			card("show", 20),
			card("show", 21),
		],
	)
	const pick = await findPick(loved, [], new Set(["show-21"]), { more: 9 })
	const cardsCall = calls.find((c) => c.path === "/api/intro")
	assert.equal(cardsCall?.params.get("cards"), "movie:11,show:20,movie:10")
	// The best match has no backdrop: the next one leads, the rest follow in match order.
	assert.equal(name(pick.top), "show:20")
	assert.deepEqual(pick.more.map(name), ["movie:11", "movie:10"])
	assert.equal(pick.fallback, false)
})

test("asks for at most ten cards", async () => {
	const calls = mockFetch(
		{
			movie: Array.from({ length: 16 }, (_, i) => ({
				tmdb_id: 100 + i,
				match_percentage: 99 - i,
			})),
		},
		Array.from({ length: 16 }, (_, i) => card("movie", 100 + i)),
	)
	const pick = await findPick([loved[0]], [], new Set(), {
		more: 12,
		perType: 16,
	})
	const cardsCall = calls.find((c) => c.path === "/api/intro")
	assert.equal(cardsCall?.params.get("cards")?.split(",").length, 10)
	assert.equal(pick.more.length, 9)
})

test("with nothing to recommend, there is no pick", async () => {
	mockFetch({ movie: [], show: [] }, [])
	const errors = console.error
	console.error = () => {}
	try {
		const pick = await findPick(loved, [], new Set())
		assert.deepEqual(pick, { top: null, more: [], fallback: true })
	} finally {
		console.error = errors
	}
})

test("a failed recommendation request for one kind leaves the other", async () => {
	globalThis.fetch = (async (input: string) => {
		const url = new URL(input, "http://local")
		if (url.searchParams.get("mediaType") === "show")
			return new Response("", { status: 500 })
		if (url.pathname === "/api/guest-recommendations")
			return Response.json({
				recommendations: [
					{ tmdb_id: 10, media_type: "movie", match_percentage: 80 },
				],
			})
		return Response.json({ cards: [card("movie", 10)] })
	}) as typeof fetch
	const pick = await findPick(loved, [], new Set())
	assert.equal(name(pick.top), "movie:10")
})

test("shownPick chooses again when the viewer answers a candidate", () => {
	const cards = [card("movie", 1), card("movie", 2), card("movie", 3)]
	const pick = shownPick(
		{ top: null, more: [], fallback: false, cards },
		new Set(),
	)
	assert.equal(name(pick.top), "movie:1")
	const again = shownPick(pick, new Set(["movie-1"]))
	assert.equal(name(again.top), "movie:2")
	assert.deepEqual(again.more.map(name), ["movie:3"])
})
