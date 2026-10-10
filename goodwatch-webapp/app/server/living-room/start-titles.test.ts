import assert from "node:assert/strict"
import { test } from "node:test"
import "../title-filter/test-alias.ts"
import type { TitleDisplay } from "~/server/title-cards.server"
import type {
	TitleFacts,
	TitleSnapshot,
} from "../title-snapshot/snapshot.server.ts"

const { MOOD_KEYS } = await import("~/domain/moods")
const { START_TITLES, poolCandidates, selectPoolKeys, startTitleKeys } =
	await import("./pool-keys.server.ts")
const { loadStartTitles } = await import("./start-titles.server.ts")

const TODAY = 20_000

/** 60 titles that pass the pool's conditions, key 1 the least popular, half of them shows, one mood each. */
function fakeSnapshot(version: string) {
	const rows = Array.from({ length: 60 }, (_, row) => {
		const key = row + 1
		const facts: TitleFacts = {
			mediaType: key % 2 ? "movie" : "show",
			tmdbId: key,
			genres: [],
			adult: false,
			hasPoster: true,
			hasBackdrop: true,
			releaseDay: null,
			score: 80,
			votes: 5000,
			popularity: key,
			moods: [MOOD_KEYS[key % MOOD_KEYS.length]],
			origin: null,
			anime: false,
		}
		return { key, facts }
	})
	return {
		version,
		forEach(fn: (key: number, row: number) => void) {
			rows.forEach(({ key }, row) => fn(key, row))
		},
		factsAt: (row: number) => rows[row].facts,
	} satisfies Pick<TitleSnapshot, "version" | "forEach" | "factsAt">
}

const display = (key: number): TitleDisplay => ({
	key,
	tmdb_id: key,
	media_type: key % 2 ? "movie" : "show",
	title: `Title ${key}`,
	poster_path: `/poster-${key}.jpg`,
	backdrop_path: null,
	release_year: 2000 + (key % 20),
	runtime: null,
	tagline: null,
	goodwatch_overall_score_normalized_percent: 80,
	goodwatch_overall_score_voting_count: 5000,
})
const displaysOf = async (keys: number[]) =>
	new Map(keys.map((key) => [key, display(key)]))

test("the start titles are the pool's first for a visitor nobody knows anything about", async () => {
	const snapshot = fakeSnapshot("start-1")
	const candidates = poolCandidates(snapshot, TODAY)
	const nobody = {
		seen: new Set<number>(),
		skipped: new Set<number>(),
		hidden: new Set<number>(),
		wishlist: new Set<number>(),
	}
	const keys = startTitleKeys(candidates)
	assert.equal(keys.length, START_TITLES)
	assert.deepEqual(
		keys,
		selectPoolKeys(candidates, nobody, null).keys.slice(0, START_TITLES),
	)
	// Most popular first.
	assert.deepEqual(keys.slice(0, 3), [60, 59, 58])

	const titles = await loadStartTitles(snapshot, displaysOf, TODAY)
	assert.deepEqual(
		titles.map((title) => title.tmdb_id),
		keys,
	)
	assert.deepEqual(titles[0], {
		media_type: "show",
		tmdb_id: 60,
		title: "Title 60",
		release_year: 2000,
		poster_path: "/poster-60.jpg",
	})
})

test("the start titles take no viewer and no country: every call gives the same list", async () => {
	// The function has no parameter a viewer or a country could come in by; this pins the result as well.
	const snapshot = fakeSnapshot("start-2")
	const first = await loadStartTitles(snapshot, displaysOf, TODAY)
	const second = await loadStartTitles(snapshot, displaysOf, TODAY)
	assert.equal(first.length, START_TITLES)
	assert.deepEqual(second, first)
	assert.equal(JSON.stringify(second), JSON.stringify(first))
})

test("the list is empty while the snapshot loads, and when the titles can't be read", async () => {
	assert.deepEqual(await loadStartTitles(null, displaysOf, TODAY), [])
	const error = console.error
	console.error = () => {}
	try {
		assert.deepEqual(
			await loadStartTitles(
				fakeSnapshot("start-3"),
				async () => {
					throw new Error("Redis node is marked down")
				},
				TODAY,
			),
			[],
		)
	} finally {
		console.error = error
	}
})

test("a title without display fields is left out, the others keep their order", async () => {
	const snapshot = fakeSnapshot("start-4")
	const keys = startTitleKeys(poolCandidates(snapshot, TODAY))
	const titles = await loadStartTitles(
		snapshot,
		async (wanted) =>
			new Map(
				wanted
					.filter((key) => key !== keys[1])
					.map((key) => [key, display(key)]),
			),
		TODAY,
	)
	assert.deepEqual(
		titles.map((title) => title.tmdb_id),
		keys.filter((key) => key !== keys[1]),
	)
})
