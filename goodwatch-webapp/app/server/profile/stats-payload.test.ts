import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import type { TastePerson, TasteStats } from "~/domain/profile-taste"
import { tasteStats } from "./taste-stats-model.ts"

const { statsPayload } = await import("./stats-payload.ts")

const empty = () =>
	tasteStats({
		titles: [],
		credits: [],
		people: new Map(),
		watching: 0,
		year: 2026,
	})
const person = (id: number): TastePerson => ({
	id,
	name: `Person ${id}`,
	profile: null,
	count: 99,
	average: 8,
	hours: 42,
	titles: Array.from({ length: 6 }, (_, i) => ({
		key: `movie-${i + 1}`,
		mediaType: "movie",
		tmdbId: i + 1,
		title: `Movie ${i}`,
		year: 2020,
		poster: "/p.jpg",
		backdrop: null,
		href: `/movie/${i + 1}`,
		score: 8,
		gw: 80,
		date: null,
	})),
})

test("stats send only rendered people and title previews, keeping totals and both rankings", () => {
	const stats: TasteStats = {
		...empty(),
		people: {
			directors: Array.from({ length: 8 }, (_, i) => person(i)),
			bestDirectors: Array.from({ length: 6 }, (_, i) => person(20 + i)),
			actors: [person(40)],
			composers: Array.from({ length: 6 }, (_, i) => person(50 + i)),
			writers: Array.from({ length: 6 }, (_, i) => person(60 + i)),
		},
	}
	const before = structuredClone(stats)
	const result = statsPayload(stats)
	for (const key of ["directors", "bestDirectors"] as const) {
		assert.equal(result.people[key].length, stats.people[key].length)
		result.people[key].forEach((p, i) => {
			assert.deepEqual(p, {
				...stats.people[key][i],
				titles: stats.people[key][i].titles.slice(0, i < 4 ? 5 : 1),
			})
		})
	}
	assert.deepEqual(
		result.people.actors,
		stats.people.actors.map((p) => ({ ...p, titles: [] })),
	)
	for (const key of ["writers", "composers"] as const)
		assert.deepEqual(
			result.people[key],
			stats.people[key].slice(0, 3).map((p) => ({ ...p, titles: [] })),
		)
	assert.deepEqual({ ...result, people: stats.people }, stats)
	assert.deepEqual(
		stats,
		before,
		"do not mutate owner cache entries shared by viewers",
	)
	assert.deepEqual(statsPayload(result), result)
})

test("summary keeps its exact agreement winner, both crowd cards and all group posters", async () => {
	const { statsTastePayload } = await import("./stats-payload.ts")
	const { agreementTitle } = await import("~/ui/profile/taste/agreement")
	// The renderer only reads these fields from this fixture; the helper preserves the rest of the portrait.
	const title = (id: number, score = 8, gw = 70) => ({
		...person(1).titles[0],
		key: `movie-${id}`,
		tmdbId: id,
		score,
		gw,
		anime: false,
	})
	const titles = Object.fromEntries(
		Array.from({ length: 30 }, (_, i) => {
			const t = title(i + 1, 8, i === 19 || i === 20 ? 80 : 70)
			return [t.key, t]
		}),
	)
	const taste = {
		titles,
		sides: {
			list: Array.from({ length: 5 }, (_, i) => ({
				here: [`movie-${i + 1}`, `movie-${i + 2}`, "movie-29"],
			})),
		},
		crowd: { higher: [{ key: "movie-10" }], lower: [{ key: "movie-11" }] },
	} as unknown as import("~/ui/profile/taste/model").ProfileTaste
	const before = structuredClone(taste)
	const result = statsTastePayload(taste)
	assert.deepEqual(Object.keys(result.titles), [
		"movie-1",
		"movie-2",
		"movie-3",
		"movie-4",
		"movie-10",
		"movie-11",
		"movie-20",
	])
	assert.deepEqual(agreementTitle(result.titles), agreementTitle(taste.titles))
	assert.deepEqual({ ...result, titles }, taste)
	assert.deepEqual(taste, before)
	assert.deepEqual(statsTastePayload(result), result)
})
