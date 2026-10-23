import assert from "node:assert/strict"
import { test } from "node:test"
import type { ProfileTitle } from "../../domain/profile.ts"
import { type StatsTitle, tasteStats } from "./taste-stats-model.ts"
import { statsForViewer } from "./taste-stats-view.ts"

let next = 1
function t(
	score: number | null,
	over: Partial<StatsTitle> = {},
	mediaType: "movie" | "show" = "movie",
): StatsTitle {
	const id = next++
	const title: ProfileTitle = {
		key: `${mediaType}-${id}`,
		mediaType,
		tmdbId: id,
		title: `T${id}`,
		year: 1970,
		poster: "/p.jpg",
		backdrop: null,
		href: `/${mediaType}/${id}`,
		score,
		gw: 70,
		date: null,
	}
	return {
		title,
		kind: mediaType,
		score,
		genres: ["Drama"],
		runtime: 100,
		budget: 1000,
		revenue: 2000,
		countries: ["US"],
		language: "en",
		essence: ["Moody"],
		tropes: [],
		episodesWatched: 0,
		...over,
	}
}

const titles = [
	...Array.from({ length: 12 }, () => t(9)),
	...Array.from({ length: 10 }, () => t(8, { kind: "anime" }, "show")),
	t(null, { episodesWatched: 40 }, "show"),
]
const people = new Map([[1, { id: 1, name: "Ana", profile: null }]])
const stats = tasteStats({
	titles,
	credits: titles
		.slice(0, 4)
		.map((x) => ({ personId: 1, key: x.title.key, role: "director" as const })),
	people,
	watching: 5,
	year: 2026,
})
const all = { scores: true, seen: true, shows: true, hours: true }

test("everything visible: the stats pass through unchanged", () => {
	assert.deepEqual(statsForViewer(stats, all), stats)
})

test("without scores: no score numbers, averages, rating style or score-ranked lists", () => {
	const view = statsForViewer(stats, { ...all, scores: false })
	const text = JSON.stringify(view)
	assert.equal(view.style, null)
	assert.ok(view.genres.every((g) => g.average === null))
	assert.ok(view.eras.decades.every((d) => d.average === null))
	assert.ok(view.world.countries.every((c) => c.average === null))
	assert.ok(view.tags.essence.every((e) => e.average === null))
	assert.equal(view.eras.classics.length, 0)
	assert.equal(view.people.bestDirectors.length, 0)
	assert.ok(
		view.people.directors.every(
			(p) => p.average === null && p.titles.every((x) => x.score === null),
		),
	)
	assert.ok(!view.badges.some((b) => b.id === "style"))
	assert.ok(
		!/averaging/.test(view.badges.find((b) => b.id === "anime")?.line ?? ""),
	)
	assert.ok(!text.includes('"score":9') && !text.includes('"score":8'))
})

test("without Seen: no facts about watched titles", () => {
	assert.equal(statsForViewer(stats, { ...all, seen: false }).facts, null)
})

test("without Shows or time watched: no episodes, no plate spinner without Shows", () => {
	assert.ok(stats.facts?.mostEpisodes)
	assert.equal(
		statsForViewer(stats, { ...all, hours: false }).facts?.mostEpisodes,
		null,
	)
	const noShows = statsForViewer(stats, { ...all, shows: false })
	assert.equal(noShows.facts?.mostEpisodes, null)
	assert.ok(!noShows.badges.some((b) => b.id === "plates"))
	assert.ok(
		statsForViewer(stats, { ...all, hours: false }).people.directors.every(
			(p) => p.hours === null,
		),
	)
})
