// My shows (#385): the groups of the page, their order, the Next episode from the cached episode list, and
// Tonight's pick with its three fallbacks. Expected values are worked out by hand from the rules in
// docs/implementation/tracking/data-model.md ("Reads", "Stored versus derived", C3).
import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const { planMyShows, nextEpisodeAfter, nextEpisodeInGap, tonightsPickOf, activityWords } =
	await import("./my-shows.ts")

const NOW = Date.parse("2026-10-08T20:00:00Z")
const DAY = 86_400_000
const daysAgo = (days: number) => new Date(NOW - days * DAY)

type State = "watching" | "on_hold" | "dropped" | "seen"
const entry = (
	state: State,
	episodesWatched: number,
	lastActivity: Date | null,
	furthest: [number, number] | null = episodesWatched ? [1, episodesWatched] : null,
) => ({
	state,
	watchedAt: lastActivity,
	precision: lastActivity ? ("day" as const) : ("unknown" as const),
	count: episodesWatched,
	pass: 1,
	episodesWatched,
	furthest,
	lastActivityAt: lastActivity,
})
const show = (
	id: number,
	state: State,
	watched: number,
	aired: number | null,
	lastActivity: Date | null,
	running = true,
) => ({ id, entry: entry(state, watched, lastActivity), catalog: { airedEpisodes: aired, running } })
const ids = (rows: { id: number }[]) => rows.map((row) => row.id)

test("Continue holds the Watching shows with a Next episode and activity in the last 30 days, most recent first", () => {
	const plan = planMyShows({
		shows: [
			show(1, "watching", 3, 10, daysAgo(12)),
			show(2, "watching", 5, 10, daysAgo(1)),
			show(3, "watching", 2, 10, daysAgo(29)),
		],
		starts: [],
		now: NOW,
	})
	assert.deepEqual(ids(plan.continue), [2, 1, 3])
	assert.deepEqual(
		plan.continue.map((row) => row.kind),
		["next", "next", "next"],
	)
	assert.deepEqual(plan.older, [])
})

test("a Watching show not watched for 30 days is in its own group, and one without any activity date too", () => {
	const plan = planMyShows({
		shows: [
			show(1, "watching", 3, 10, daysAgo(31)),
			show(2, "watching", 3, 10, daysAgo(30)),
			show(3, "watching", 3, 10, null),
			show(4, "watching", 3, 10, daysAgo(400)),
		],
		starts: [],
		now: NOW,
	})
	assert.deepEqual(ids(plan.continue), [2])
	// Most recent first; the show whose watches have no date goes last.
	assert.deepEqual(ids(plan.older), [1, 4, 3])
})

test("Seen shows with new episodes follow the Watching shows in Continue and say how many are new", () => {
	const plan = planMyShows({
		shows: [
			show(1, "seen", 20, 23, daysAgo(200)),
			show(2, "watching", 5, 10, daysAgo(20)),
			show(3, "seen", 8, 9, daysAgo(3)),
		],
		starts: [],
		now: NOW,
	})
	assert.deepEqual(ids(plan.continue), [2, 3, 1])
	assert.deepEqual(
		plan.continue.map((row) => [row.kind, row.left]),
		[
			["next", 5],
			["seenNew", 1],
			["seenNew", 3],
		],
	)
})

test("a Seen show with nothing new waits for episodes while it runs, and is not on the page once it has ended", () => {
	const plan = planMyShows({
		shows: [
			show(1, "seen", 10, 10, daysAgo(5), true),
			show(2, "seen", 10, 10, daysAgo(5), false),
		],
		starts: [],
		now: NOW,
	})
	assert.deepEqual(ids(plan.waiting), [1])
	assert.deepEqual(plan.continue, [])
	assert.equal(plan.total, 1)
})

test("a Watching show with every aired episode watched waits for episodes", () => {
	const plan = planMyShows({
		shows: [show(1, "watching", 6, 6, daysAgo(2))],
		starts: [],
		now: NOW,
	})
	assert.deepEqual(ids(plan.waiting), [1])
	assert.deepEqual(plan.continue, [])
})

test("progress is capped at the aired count, and new episodes are never negative", () => {
	// The member ticked tomorrow's episode by the UTC date (C4): the log holds one more than has aired.
	const plan = planMyShows({
		shows: [show(1, "seen", 11, 10, daysAgo(0)), show(2, "watching", 11, 10, daysAgo(0))],
		starts: [],
		now: NOW,
	})
	assert.deepEqual(
		plan.waiting.map((row) => [row.id, row.watched, row.aired, row.left]),
		[
			[1, 10, 10, 0],
			[2, 10, 10, 0],
		],
	)
})

test("On hold and Dropped are groups of their own, whatever their activity", () => {
	const plan = planMyShows({
		shows: [
			show(1, "on_hold", 3, 10, daysAgo(2)),
			show(2, "dropped", 1, 10, daysAgo(1)),
			show(3, "on_hold", 0, 10, null),
			show(4, "dropped", 0, 0, null),
		],
		starts: [],
		now: NOW,
	})
	assert.deepEqual(ids(plan.onHold), [1, 3])
	assert.deepEqual(ids(plan.dropped), [2, 4])
	assert.deepEqual(plan.continue, [])
})

test("a show the catalog has no aired count for stays where its state and activity put it", () => {
	const plan = planMyShows({
		shows: [
			show(1, "watching", 3, null, daysAgo(2)),
			{ id: 2, entry: entry("watching", 3, daysAgo(40)), catalog: null },
			show(3, "seen", 3, null, daysAgo(2)),
			{ id: 4, entry: entry("seen", 3, daysAgo(2)), catalog: null },
		],
		starts: [],
		now: NOW,
	})
	assert.deepEqual(ids(plan.continue), [1])
	assert.equal(plan.continue[0].aired, null)
	assert.deepEqual(ids(plan.older), [2])
	// A Seen show that still runs waits for episodes. One the catalog has no row for is not on the page: nothing
	// says it has new episodes or still runs.
	assert.deepEqual(ids(plan.waiting), [3])
})

test("Start holds the Want to See shows not started, best taste match first", () => {
	const plan = planMyShows({
		shows: [show(7, "watching", 1, 10, daysAgo(1))],
		starts: [
			{ id: 1, match: 71, addedAt: 100 },
			{ id: 2, match: 93, addedAt: 50 },
			{ id: 3, match: null, addedAt: 900 },
			{ id: 4, match: 93, addedAt: 60 },
			// Want to See on a started show: it is in its state's group, not in Start.
			{ id: 7, match: 99, addedAt: 1 },
		],
		now: NOW,
	})
	// The same match: the one added last first. No match: last.
	assert.deepEqual(ids(plan.start), [4, 2, 1, 3])
	assert.deepEqual(ids(plan.continue), [7])
})

// ---------------------------------------------------------------------------------------------------------

const ep = (season: number, number: number, airDate: string | null, name = `S${season}E${number}`) => ({
	season,
	number,
	name,
	airDate,
})
const LIST = [
	ep(0, 1, "2020-01-01", "A special"),
	ep(1, 1, "2026-09-01"),
	ep(1, 2, "2026-09-08"),
	ep(1, 3, "2026-09-15"),
	ep(2, 1, "2026-10-08"),
	ep(2, 2, "2026-10-15"),
	ep(2, 3, null),
]

test("the Next episode is the first aired regular episode after the furthest one watched", () => {
	assert.equal(nextEpisodeAfter(LIST, [1, 1], "2026-10-08")?.name, "S1E2")
	// Across the season's end, and on its air date by the UTC date.
	assert.equal(nextEpisodeAfter(LIST, [1, 3], "2026-10-08")?.name, "S2E1")
	assert.equal(nextEpisodeAfter(LIST, [1, 3], "2026-10-07"), null)
	// Nothing watched: the first regular episode, never the special.
	assert.equal(nextEpisodeAfter(LIST, null, "2026-10-08")?.name, "S1E1")
	// An episode without an air date has not aired.
	assert.equal(nextEpisodeAfter(LIST, [2, 2], "2027-01-01"), null)
})

test("with nothing aired after the furthest episode, the Next episode is the earliest one not watched", () => {
	const watched = new Set(["1-1", "1-3", "2-1"])
	assert.equal(nextEpisodeInGap(LIST, watched, "2026-10-08")?.name, "S1E2")
	assert.equal(nextEpisodeInGap(LIST, new Set(["1-1", "1-2", "1-3", "2-1"]), "2026-10-08"), null)
})

// ---------------------------------------------------------------------------------------------------------

test("Tonight's pick is the Next episode of the Watching show the member was last active on", () => {
	const plan = planMyShows({
		shows: [show(1, "watching", 3, 10, daysAgo(4)), show(2, "watching", 3, 10, daysAgo(2))],
		starts: [{ id: 9, match: 90, addedAt: 1 }],
		now: NOW,
	})
	assert.deepEqual(tonightsPickOf(plan, 555), { kind: "episode", showId: 2 })
})

test("without a Watching show active in the last 30 days, Tonight's pick is the first movie of My movies", () => {
	const plan = planMyShows({
		shows: [
			show(1, "watching", 3, 10, daysAgo(45)),
			// A Seen show with new episodes leads Continue here, and is still not the pick.
			show(2, "seen", 9, 10, daysAgo(1)),
		],
		starts: [{ id: 9, match: 90, addedAt: 1 }],
		now: NOW,
	})
	assert.deepEqual(ids(plan.continue), [2])
	assert.deepEqual(tonightsPickOf(plan, 555), { kind: "movie", movieId: 555 })
})

test("without a movie either, Tonight's pick is the first show to start; with nothing, there is none", () => {
	const plan = planMyShows({
		shows: [],
		starts: [
			{ id: 9, match: 70, addedAt: 1 },
			{ id: 8, match: 90, addedAt: 1 },
		],
		now: NOW,
	})
	assert.deepEqual(tonightsPickOf(plan, null), { kind: "start", showId: 8 })
	assert.equal(tonightsPickOf(planMyShows({ shows: [], starts: [], now: NOW }), null), null)
})

// ---------------------------------------------------------------------------------------------------------

test("the fact that places a Continue row says when the member last watched", () => {
	assert.equal(activityWords(NOW - 2 * 3_600_000, NOW), "Watched today")
	assert.equal(activityWords(daysAgo(1).getTime(), NOW), "Watched yesterday")
	assert.equal(activityWords(daysAgo(12).getTime(), NOW), "Watched 12 days ago")
	assert.equal(activityWords(daysAgo(45).getTime(), NOW), "Watched 6 weeks ago")
	assert.equal(activityWords(daysAgo(200).getTime(), NOW), "Watched 7 months ago")
	assert.equal(activityWords(daysAgo(800).getTime(), NOW), "Watched 2 years ago")
	assert.equal(activityWords(null, NOW), "No date for your last watch")
})
