import assert from "node:assert/strict"
import { test } from "node:test"
import {
	BULK_SCORES_PER_MINUTE,
	MIN_AVERAGE_MEMBERS,
	MIN_SOURCE_MEMBERS,
	MIN_TITLE_MEMBERS,
	OTHER_SOURCE,
	bulkScoreKeys,
	importsBySource,
	memberAggregates,
	memberCounts,
	memberStats,
	memberTitleKeys,
} from "./members.ts"
import type { MemberTitleRow, RawMembers } from "./raw.ts"

const id = (n: number) =>
	`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const empty = (): RawMembers => ({
	visibility: [],
	scores: [],
	importedScores: [],
	movieMinutes: [],
	episodeMinutes: [],
	watches: [],
	showWatches: [],
	seen: [],
	wishlist: [],
	imports: [],
	countries: [],
})

const hide = (userId: string, parts: Record<string, string>) => ({
	userId,
	value: JSON.stringify(parts),
})

const NOW = Date.UTC(2026, 10, 15, 12)
// A Sunday, 21:00 UTC.
const SUNDAY_EVENING = Date.UTC(2026, 10, 8, 21, 5)

const score = (
	userId: string,
	tmdbId: number,
	value: number,
	createdAt: number | null = SUNDAY_EVENING,
): RawMembers["scores"][number] => ({
	userId,
	type: "movie",
	tmdbId,
	score: value,
	createdAt,
	year: 1999,
	genres: ["Drama"],
})

const titles: MemberTitleRow[] = [1, 2, 3].map((tmdbId) => ({
	type: "movie",
	tmdbId,
	title: `Title ${tmdbId}`,
	year: 1990 + tmdbId,
	poster: `/p${tmdbId}.jpg`,
	imdb: 7,
}))

test("a member counts for a part only while everyone can see it", () => {
	const counts = memberCounts([
		hide(id(1), { scores: "me" }),
		hide(id(2), { scores: "members", wishlist: "everyone" }),
		{ userId: id(3), value: "not json" },
	])
	assert.equal(counts(id(1), "scores"), false)
	assert.equal(counts(id(1), "wishlist"), true)
	assert.equal(
		counts(id(2), "scores"),
		false,
		"members only is hidden from a public page",
	)
	assert.equal(
		counts(id(3), "scores"),
		true,
		"an unreadable setting is the default",
	)
	assert.equal(counts(id(4), "hours"), true, "no setting: everything public")
})

test("ids that aren't accounts never count", () => {
	const counts = memberCounts([])
	assert.equal(counts("owner", "scores"), false)
	assert.equal(counts("owner", "any"), false)
})

test("a member who hides every part is left out of the countries too", () => {
	const all = Object.fromEntries(
		[
			"scores",
			"seen",
			"wishlist",
			"shows",
			"lists",
			"taste",
			"hours",
			"activity",
		].map((p) => [p, "me"]),
	)
	const counts = memberCounts([hide(id(1), all), hide(id(2), { scores: "me" })])
	assert.equal(counts(id(1), "any"), false)
	assert.equal(counts(id(2), "any"), true)
})

test("imported scores and bulk writes are marked; a fast hand is not", () => {
	const minute = Date.UTC(2026, 10, 1, 10, 0)
	const bulk = Array.from({ length: BULK_SCORES_PER_MINUTE }, (_, i) =>
		score(id(1), 100 + i, 8, minute + i * 500),
	)
	const fast = Array.from({ length: BULK_SCORES_PER_MINUTE - 1 }, (_, i) =>
		score(id(2), 100 + i, 8, minute + i * 900),
	)
	const keys = bulkScoreKeys(
		[...bulk, ...fast, score(id(3), 5, 7)],
		[{ userId: id(3), type: "movie", tmdbId: 5 }],
	)
	assert.ok(keys.has(`${id(1)}|movie-100`))
	assert.ok(!keys.has(`${id(2)}|movie-100`))
	assert.ok(keys.has(`${id(3)}|movie-5`))
})

test("title lists need 10 members, averages 25", () => {
	const raw = empty()
	for (let m = 1; m <= MIN_TITLE_MEMBERS - 1; m++)
		raw.seen.push({ userId: id(m), type: "movie", tmdbId: 1 })
	for (let m = 1; m <= MIN_TITLE_MEMBERS; m++)
		raw.seen.push({ userId: id(m), type: "movie", tmdbId: 2 })
	for (let m = 1; m <= MIN_AVERAGE_MEMBERS - 1; m++)
		raw.scores.push(score(id(m), 2, 9))
	for (let m = 1; m <= MIN_AVERAGE_MEMBERS; m++)
		raw.scores.push(score(id(m), 3, m % 2 ? 10 : 6))
	const counts = memberCounts([])
	const agg = memberAggregates(raw, counts)
	const stats = memberStats(raw, counts, agg, titles, NOW)
	assert.deepEqual(
		stats.mostSeen.map((t) => t.tmdbId),
		[2],
	)
	assert.deepEqual(
		stats.highestRated.map((t) => t.tmdbId),
		[3],
	)
	assert.equal(stats.split[0].tmdbId, 3)
	assert.ok(stats.split[0].spread > 1.9)
	// Title 2 has 24 scores: shared (10+), never averaged.
	assert.ok(stats.oldestShared.some((t) => t.tmdbId === 2))
	assert.ok(!stats.aboveImdb.some((t) => t.tmdbId === 2))
	assert.deepEqual(
		memberTitleKeys(agg)
			.map((k) => k.tmdbId)
			.sort(),
		[2, 3],
	)
})

test("a hidden part's rows are left out before counting", () => {
	const raw = empty()
	raw.visibility.push(hide(id(1), { scores: "me", hours: "me" }))
	raw.scores.push(score(id(1), 1, 1), score(id(2), 1, 9))
	raw.movieMinutes.push(
		{ userId: id(1), minutes: 1000 },
		{ userId: id(2), minutes: 120 },
	)
	const counts = memberCounts(raw.visibility)
	const stats = memberStats(
		raw,
		counts,
		memberAggregates(raw, counts),
		titles,
		NOW,
	)
	assert.equal(stats.scores.count, 1)
	assert.equal(stats.scores.average, 9)
	assert.equal(stats.loggedMovieMinutes, 120)
	assert.equal(stats.watchers, 1)
})

test("the week and the day count hand-given scores in UTC", () => {
	const raw = empty()
	raw.scores.push(score(id(1), 1, 8), score(id(1), 2, 8))
	raw.importedScores.push({ userId: id(1), type: "movie", tmdbId: 2 })
	const counts = memberCounts([])
	const stats = memberStats(
		raw,
		counts,
		memberAggregates(raw, counts),
		titles,
		NOW,
	)
	assert.equal(stats.weekdays.find((d) => d.day === 7)?.scores, 1)
	assert.equal(stats.hours.find((h) => h.hour === 21)?.scores, 1)
	assert.equal(stats.scores.count, 2, "imports still count as scores")
})

test("countries need 10 members; wishlists count their last 30 days", () => {
	const raw = empty()
	for (let m = 1; m <= 10; m++)
		raw.countries.push({ userId: id(m), code: "DE" })
	for (let m = 11; m <= 19; m++)
		raw.countries.push({ userId: id(m), code: "FR" })
	raw.wishlist.push(
		{
			userId: id(1),
			type: "movie",
			tmdbId: 1,
			createdAt: NOW - 86_400_000,
			runtime: 100,
		},
		{
			userId: id(1),
			type: "show",
			tmdbId: 2,
			createdAt: NOW - 40 * 86_400_000,
			runtime: null,
		},
	)
	const counts = memberCounts([])
	const stats = memberStats(
		raw,
		counts,
		memberAggregates(raw, counts),
		titles,
		NOW,
	)
	assert.deepEqual(stats.countries, [{ code: "DE", members: 10 }])
	assert.equal(stats.wishlist.addedLast30Days, 1)
	assert.equal(stats.wishlist.movieMinutes, 100)
	assert.equal(stats.wishlist.shows, 1)
})

test("an import source shows with 10 members; smaller ones only together", () => {
	const rows = (source: string, from: number, members: number, added = 100) =>
		Array.from({ length: members }, (_, i) => ({
			userId: id(from + i),
			source,
			added,
		}))
	assert.equal(MIN_SOURCE_MEMBERS, 10)
	// One member's 7,307 titles never make a bar of their own, nor a fold of one.
	assert.deepEqual(importsBySource(rows("tvtime", 1, 1, 7307)), [])
	assert.deepEqual(
		importsBySource([
			...rows("imdb", 1, 10),
			...rows("tvtime", 100, 1, 7307),
			...rows("csv", 200, 4),
		]),
		[{ source: "imdb", titles: 1000 }],
		"the fold has 5 members: dropped",
	)
	assert.deepEqual(
		importsBySource([
			...rows("imdb", 1, 12),
			...rows("tvtime", 100, 6, 50),
			...rows("csv", 200, 4, 10),
		]),
		[
			{ source: "imdb", titles: 1200 },
			{ source: OTHER_SOURCE, titles: 340 },
		],
		"the fold has 10 members: shown as one",
	)
	// Members count once per source however many imports they ran.
	assert.deepEqual(
		importsBySource([...rows("imdb", 1, 9), ...rows("imdb", 1, 9)]),
		[],
	)
	// Members in more than one small source count once in the fold.
	assert.deepEqual(
		importsBySource([...rows("csv", 1, 6), ...rows("tvtime", 1, 6)]),
		[],
	)
})

test("imports count only members who show their activity", () => {
	const raw = empty()
	for (let m = 1; m <= 10; m++)
		raw.imports.push({ userId: id(m), source: "trakt", added: 10 })
	raw.visibility.push(hide(id(1), { activity: "me" }))
	const counts = memberCounts(raw.visibility)
	const stats = memberStats(
		raw,
		counts,
		memberAggregates(raw, counts),
		titles,
		NOW,
	)
	assert.deepEqual(stats.imports, [], "9 visible members are too few")
})
