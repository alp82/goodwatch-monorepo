// The /stats card: titles, years to watch all, the most common movie title and the longest movie, from the snapshot.
import "react"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import type { StatsSnapshot } from "../../domain/stats/snapshot.ts"

const { statsCardContent } = await import("./stats-content.server.ts")

const snapshot = (
	over: { commonTitles?: unknown[]; longest?: unknown[] } = {},
) =>
	({
		catalog: {
			movies: 1_278_749,
			shows: 237_249,
			movieMinutes: 55_141_801,
			episodeMinutes: 159_439_820,
		},
		trivia: {
			commonTitles: over.commonTitles ?? [{ title: "Home", movies: 173 }],
		},
		records: { longest: over.longest ?? [{ title: "Live Aid", runtime: 984 }] },
	}) as unknown as StatsSnapshot

test("the card reads titles, years to watch all, the most common title and the longest movie, in that order", async () => {
	const content = await statsCardContent({ snapshot: async () => snapshot() })
	assert.deepEqual(content.lines, [
		{ n: "1.5M", words: "movies and shows" },
		{ n: "408", words: "years to watch all" },
		{ n: "173", words: "movies called Home" },
		{
			n: "16 h",
			words: "Live Aid, the longest movie",
			short: "the longest movie",
		},
	])
})

test("a line whose list is empty is left out", async () => {
	const content = await statsCardContent({
		snapshot: async () => snapshot({ commonTitles: [], longest: [] }),
	})
	assert.deepEqual(
		content.lines.map((l) => l.words),
		["movies and shows", "years to watch all"],
	)
})

test("before the first snapshot there is no card to store", async () => {
	await assert.rejects(statsCardContent({ snapshot: async () => null }))
})
