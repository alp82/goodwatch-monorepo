import assert from "node:assert/strict"
import { test } from "node:test"
import { DECADE_TITLES } from "../../domain/profile-taste.ts"
import type { ProfileTitle } from "../../domain/profile.ts"
import {
	type StatsInput,
	type StatsTitle,
	rankPeople,
	tasteStats,
} from "./taste-stats-model.ts"

let next = 1
function t(
	over: Partial<StatsTitle> & {
		score: number | null
		year?: number
		mediaType?: "movie" | "show"
	},
): StatsTitle {
	const id = next++
	const mediaType = over.mediaType ?? "movie"
	const title: ProfileTitle = {
		key: `${mediaType}-${id}`,
		mediaType,
		tmdbId: id,
		title: `T${id}`,
		year: over.year ?? 2000,
		poster: "/p.jpg",
		backdrop: null,
		href: `/${mediaType}/${id}-t${id}`,
		score: over.score,
		gw: 70,
		date: null,
	}
	return {
		title,
		kind: over.kind ?? mediaType,
		score: over.score,
		genres: over.genres ?? ["Drama"],
		runtime: over.runtime ?? 100,
		budget: over.budget ?? null,
		revenue: over.revenue ?? null,
		countries: over.countries ?? ["US"],
		language: over.language ?? "en",
		essence: over.essence ?? [],
		tropes: over.tropes ?? [],
		episodesWatched: over.episodesWatched ?? 0,
	}
}

const people = new Map([
	[1, { id: 1, name: "Ana", profile: null }],
	[2, { id: 2, name: "Ben", profile: "/b.jpg" }],
])

test("people need two rated titles and rank by count, then by average", () => {
	const a = t({ score: 9 })
	const b = t({ score: 8 })
	const c = t({ score: 6 })
	const d = t({ score: null })
	const input: StatsInput = {
		titles: [a, b, c, d],
		credits: [
			{ personId: 1, key: a.title.key, role: "director" },
			{ personId: 1, key: b.title.key, role: "director" },
			{ personId: 2, key: c.title.key, role: "director" },
			{ personId: 2, key: d.title.key, role: "director" }, // unrated: doesn't count
		],
		people,
		watching: 0,
		year: 2026,
	}
	const directors = rankPeople(input, "director", 5)
	assert.deepEqual(
		directors.map((p) => [p.name, p.count, p.average]),
		[["Ana", 2, 8.5]],
	)
	assert.deepEqual(
		directors[0].titles.map((x) => x.score),
		[9, 8],
	)
	assert.equal(directors[0].hours, 3.3)
})

test("genres, decades, classics, world, tags and style", () => {
	const titles = [
		t({
			score: 10,
			year: 1975,
			genres: ["Drama", "Crime"],
			countries: ["US", "IT"],
			essence: ["Mob saga"],
			tropes: ["Family Business"],
		}),
		t({ score: 9, year: 1999, genres: ["Drama"], essence: ["Mob saga"] }),
		t({
			score: 4,
			year: 2021,
			genres: ["Comedy"],
			countries: ["GB"],
			language: "en",
		}),
		t({ score: null, year: 2023, mediaType: "show", episodesWatched: 30 }),
	]
	const stats = tasteStats({
		titles,
		credits: [],
		people,
		watching: 5,
		year: 2026,
	})
	assert.deepEqual(
		stats.genres.map((g) => [g.name, g.count, g.average]),
		[
			["Drama", 2, 9.5],
			["Comedy", 1, 4],
			["Crime", 1, 10],
		],
	)
	assert.deepEqual(
		stats.eras.decades.map((d) => d.decade),
		[1970, 1990, 2020],
	)
	assert.deepEqual(
		stats.eras.classics.map((c) => c.year),
		[1975, 1999],
	)
	assert.equal(stats.world.countries[0].code, "US")
	assert.equal(stats.world.totalCountries, 3)
	assert.deepEqual(stats.tags.essence[0], {
		name: "Mob saga",
		count: 2,
		average: 9.5,
	})
	assert.deepEqual(stats.tags.tropes, [{ name: "Family Business", count: 1 }])
	assert.equal(stats.facts?.mostEpisodes?.episodes, 30)
	assert.equal(stats.facts?.oldest?.year, 1975)
	assert.equal(stats.style?.average, 7.7)
	assert.equal(stats.style?.share8, 0.67)
	assert.ok(stats.badges.some((b) => b.id === "plates"))
	assert.ok(stats.badges.some((b) => b.name === "Movie person"))
})

test("an empty library gives empty stats without failing", () => {
	const stats = tasteStats({
		titles: [],
		credits: [],
		people,
		watching: 0,
		year: 2026,
	})
	assert.deepEqual(stats.genres, [])
	assert.equal(stats.eras.averageYear, null)
	assert.deepEqual(stats.badges, [])
	assert.equal(stats.facts?.longest, null)
})

test("a decade's panel holds its rated titles, best rated first, posters before blanks, up to the panel size", () => {
	const unrated = t({ score: null, year: 1994 })
	const noPoster = t({ score: 10, year: 1991 })
	noPoster.title.poster = null
	// Scores 1..9, 1..7; GoodWatch 50..65.
	const rated = Array.from({ length: 16 }, (_, i) =>
		t({ score: 1 + (i % 9), year: 1990 + (i % 10) }),
	)
	rated.forEach((x, i) => {
		x.title.gw = 50 + i
	})
	const input: StatsInput = {
		titles: [unrated, noPoster, ...rated],
		credits: [],
		people,
		watching: 0,
		year: 2026,
	}
	const [nineties] = tasteStats(input).eras.decades
	assert.equal(nineties.count, 17)
	assert.equal(nineties.titles.length, DECADE_TITLES)
	assert.ok(!nineties.titles.some((x) => x.key === unrated.title.key))
	// The posterless 10 waits behind every title with a poster; tied scores go to the higher GoodWatch score.
	assert.ok(!nineties.titles.some((x) => x.key === noPoster.title.key))
	assert.deepEqual(
		nineties.titles.slice(0, 4).map((x) => [x.score, x.gw]),
		[
			[9, 58],
			[8, 57],
			[7, 65],
			[7, 56],
		],
	)
	assert.deepEqual(
		nineties.byCrowd.slice(0, 2).map((x) => x.gw),
		[65, 64],
	)
	// With room left, the posterless title fills a slot.
	const [few] = tasteStats({
		...input,
		titles: [noPoster, ...rated.slice(0, 3)],
	}).eras.decades
	assert.deepEqual(few.titles.at(-1)?.key, noPoster.title.key)
})
