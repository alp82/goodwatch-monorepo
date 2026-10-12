import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import {
	buildEpisodePresentation,
	type CatalogEpisode,
	type ImdbEpisodeRating,
	type EpisodeMapping,
} from "./episode-presentation.ts"
import { episodeLabel, showAiredBy, step, newRecord } from "./machine.ts"
type Fixture = {
	catalog: CatalogEpisode[]
	imdb: ImdbEpisodeRating[]
	mapping: EpisodeMapping
}
const fixtures: Fixture[] = JSON.parse(
	readFileSync(
		new URL("./fixtures/episode-alignment.json", import.meta.url),
		"utf8",
	),
)
const mf = fixtures.find((f) => f.mapping.showId === 154526)!
for (const f of fixtures)
	test(`audited mapping ${f.mapping.showId} preserves all canonical IDs and ratings`, () => {
		const p = buildEpisodePresentation(f.catalog, f.imdb, f.mapping)
		assert.equal(p.active, true)
		assert.equal(p.note, null)
		assert.deepEqual(
			p.episodes.map((e) => e.id).sort((a, b) => a - b),
			f.catalog.map((e) => e.id).sort((a, b) => a - b),
		)
		assert.equal(
			p.episodes.filter((e) => e.season > 0 && e.resolved).length,
			f.mapping.entries.length,
		)
		for (const s of p.seasons) {
			assert.equal(s.unresolved, 0)
			assert.ok(s.score)
			assert.equal(
				s.total,
				f.mapping.entries.filter((e) => e.display[0] === s.number).length,
			)
		}
	})
test("MF GHOST has 12 / 12 / 13 episodes and canonical episode 13 is S2 E1", () => {
	const p = buildEpisodePresentation(mf.catalog, mf.imdb, mf.mapping)
	assert.deepEqual(
		p.seasons.map((s) => s.total),
		[12, 12, 13],
	)
	const e = p.episodes.find((e) => e.season === 1 && e.number === 13)!
	assert.equal(episodeLabel(e), "S2 E1")
	assert.equal(
		episodeLabel(
			showAiredBy([{ ...e, airDate: "2020-01-01" }], "2026-10-12").episodes[0],
		),
		"S2 E1",
	)
	assert.equal(e.id, 5648819)
	assert.equal(e.rating, 8.4)
})
test("append an unmapped episode without moving the reviewed seasons", () => {
	const p = buildEpisodePresentation(
		[...mf.catalog, { id: 999, season: 1, number: 38, name: "New episode" }],
		mf.imdb,
		mf.mapping,
	)
	assert.equal(p.active, true)
	assert.deepEqual(
		p.seasons.map((s) => s.total),
		[12, 12, 13, 1],
	)
	const e = p.episodes.find((e) => e.id === 999)!
	assert.equal(episodeLabel(e), "TMDB S1 E38")
	assert.equal(e.rating, null)
	assert.equal(p.seasons.at(-1)?.score, null)
})
test("catalog renumbering and inserted episodes fall back without rewriting identity", () => {
	for (const catalog of [
		mf.catalog.map((e) => (e.id === 5648819 ? { ...e, number: 50 } : e)),
		[...mf.catalog, { id: 999, season: 1, number: 1, name: "Inserted" }],
	]) {
		const p = buildEpisodePresentation(catalog, mf.imdb, mf.mapping)
		assert.equal(p.active, false)
		assert.equal(p.episodes.find((e) => e.id === 5648819)?.displaySeason, 1)
	}
})
test("provider failures never guess a neighboring rating or hide the episode", () => {
	const entry = mf.mapping.entries[12]
	for (const imdb of [
		mf.imdb.filter((e) => e.id !== entry.imdbId),
		mf.imdb.map((e) =>
			e.id === entry.imdbId ? { ...e, parentId: "ttWrong" } : e,
		),
		mf.imdb.map((e) =>
			e.id === entry.imdbId ? { ...e, name: "Wrong title" } : e,
		),
		mf.imdb.map((e) => (e.id === entry.imdbId ? { ...e, number: 2 } : e)),
		[...mf.imdb, mf.imdb.find((e) => e.id === entry.imdbId)!],
	]) {
		const p = buildEpisodePresentation(mf.catalog, imdb, mf.mapping)
		assert.equal(p.active, true)
		assert.equal(p.episodes.find((e) => e.id === entry.id)?.rating, null)
		assert.equal(p.seasons[1].score, null)
		assert.ok(p.seasons[1].unresolved >= 1)
	}
	const unrated = buildEpisodePresentation(
		mf.catalog,
		mf.imdb.map((e) =>
			e.id === entry.imdbId ? { ...e, score: null, votes: 0 } : e,
		),
		mf.mapping,
	)
	assert.equal(unrated.episodes.find((e) => e.id === entry.id)?.resolved, true)
	assert.equal(unrated.seasons[1].rated, 11)
	assert.equal(unrated.seasons[1].total, 12)
})
test("bundles, duplicate positions and order inversions cannot activate a mapping", () => {
	for (const mapping of [
		{
			...mf.mapping,
			entries: mf.mapping.entries.map((e, i) =>
				i === 1 ? { ...e, imdbId: mf.mapping.entries[0].imdbId } : e,
			),
		},
		{
			...mf.mapping,
			entries: mf.mapping.entries.map((e, i) =>
				i === 1 ? { ...e, display: mf.mapping.entries[0].display } : e,
			),
		},
		{
			...mf.mapping,
			entries: mf.mapping.entries.map((e, i) =>
				i < 2 ? { ...e, display: mf.mapping.entries[1 - i].display } : e,
			),
		},
	])
		assert.equal(
			buildEpisodePresentation(mf.catalog, mf.imdb, mapping).active,
			false,
		)
})
test("retired episodes don't invalidate the other memberships, dates change the snapshot", () => {
	const a = buildEpisodePresentation(mf.catalog, mf.imdb, mf.mapping)
	const b = buildEpisodePresentation(
		mf.catalog.filter((e) => e.id !== 5648819),
		mf.imdb,
		mf.mapping,
	)
	assert.equal(b.active, true)
	assert.equal(b.seasons[1].total, 11)
	assert.notEqual(a.version, b.version)
	const c = buildEpisodePresentation(
		mf.catalog.map((e) => ({ ...e, airDate: 0 })),
		mf.imdb,
		mf.mapping,
	)
	assert.notEqual(a.version, c.version)
})
test("explicit bulk targets mark only displayed season 2, undo and unmark preserve season 1", () => {
	const p = buildEpisodePresentation(mf.catalog, mf.imdb, mf.mapping)
	const show = showAiredBy(
		p.episodes.map((e) => ({ ...e, airDate: "2020-01-01" })),
		"2026-10-12",
	)
	const event = {
		type: "markEpisodes" as const,
		episodeIds: p.seasons[1].ids,
		displaySeason: 2,
		presentationVersion: p.version,
	}
	const first = step(
		{ show, record: newRecord() },
		{ type: "watch", season: 1, number: 1 },
		"first-watch",
	)
	const marked = step(first.world, event, "season-two")
	assert.equal(marked.refused, null)
	assert.equal(marked.world.record.watches.length, 13)
	assert.equal(
		marked.world.record.watches.filter((w) => w.group === "season-two").length,
		12,
	)
	assert.equal(
		marked.world.record.watches
			.filter((w) => w.group === "season-two")
			.every((w) => w.season === 1 && w.number >= 13 && w.number <= 24),
		true,
	)
	assert.equal(
		step(marked.world, { type: "undoGroup", group: "season-two" }).world.record
			.watches.length,
		1,
	)
	const removed = step(marked.world, { ...event, type: "unmarkEpisodes" })
	assert.equal(removed.world.record.watches.length, 1)
	for (const ids of [
		[...event.episodeIds, 999999],
		[event.episodeIds[0], event.episodeIds[0]],
	])
		assert.ok(
			step(first.world, { ...event, episodeIds: ids }, "bad-group").refused,
		)
	const resend = step(marked.world, event, "season-two", { resend: true })
	assert.deepEqual(resend.world.record.watches, marked.world.record.watches)
})
