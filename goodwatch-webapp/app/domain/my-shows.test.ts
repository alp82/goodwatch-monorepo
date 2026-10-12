// My shows (#385): the groups of the page, their order, the Next episode from the cached episode list, and
// Tonight's pick with its three fallbacks. Expected values are worked out by hand from the rules in
// docs/implementation/tracking/data-model.md ("Reads", "Stored versus derived", C3).
import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const { planMyShows, nextEpisodeAfter, nextEpisodeInGap, tonightsPickOf, activityWords, placedWords } =
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
	watchingSince: Date | null = null,
) => ({
	state,
	watchedAt: lastActivity,
	precision: lastActivity ? ("day" as const) : ("unknown" as const),
	count: episodesWatched,
	pass: 1,
	episodesWatched,
	furthest,
	lastActivityAt: lastActivity,
	watchingSince,
})
const show = (
	id: number,
	state: State,
	watched: number,
	aired: number | null,
	lastActivity: Date | null,
	running = true,
) => ({ id, entry: entry(state, watched, lastActivity), catalog: { airedEpisodes: aired, running } })
/** A Watching show the member moved there themselves: a season unmarked, a Seen press taken back, resumed, watched again. */
const moved = (id: number, watched: number, aired: number, lastActivity: Date | null, since: Date | null) => ({
	id,
	entry: entry("watching", watched, lastActivity, watched ? [1, watched] : null, since),
	catalog: { airedEpisodes: aired, running: true },
})
const ids = (rows: { id: number }[]) => rows.map((row) => row.id)

test("Continue holds the Watching shows with a Next episode and activity in the last 90 days, most recent first", () => {
	const plan = planMyShows({
		shows: [
			show(1, "watching", 3, 10, daysAgo(12)),
			show(2, "watching", 5, 10, daysAgo(1)),
			show(3, "watching", 2, 10, daysAgo(89)),
		],
		starts: [],
		now: NOW,
	})
	assert.deepEqual(ids(plan.continue), [2, 1, 3])
	assert.deepEqual(
		plan.continue.map((row) => row.kind),
		["next", "next", "next"],
	)
	assert.deepEqual(plan.pickUp, [])
})

test("a Watching show not watched for 90 days is one to pick up, and one without any activity date too", () => {
	const plan = planMyShows({
		shows: [
			show(1, "watching", 3, 10, daysAgo(91)),
			show(2, "watching", 3, 10, daysAgo(90)),
			show(3, "watching", 3, 10, null),
			show(4, "watching", 3, 10, daysAgo(400)),
		],
		starts: [],
		now: NOW,
	})
	assert.deepEqual(ids(plan.continue), [2])
	// Most recent first; the show whose watches have no date goes last.
	assert.deepEqual(ids(plan.pickUp), [1, 4, 3])
	assert.equal(plan.total, 4)
})

test("a show the member moved to Watching in the last 90 days is in Continue, whatever its watches say", () => {
	const plan = planMyShows({
		shows: [
			// Seen two years ago, a season unmarked this morning: the watches are old, and undated.
			moved(1, 18, 30, daysAgo(500), daysAgo(0)),
			// Resumed a month ago, with watches no import dated.
			moved(2, 4, 10, null, daysAgo(30)),
			// Moved 91 days ago, last watched 200 days ago: neither is in the last 90 days.
			moved(3, 4, 10, daysAgo(200), daysAgo(91)),
			// An import made it Watching: the entry has no time for that.
			moved(4, 4, 10, daysAgo(500), null),
			show(5, "watching", 3, 10, daysAgo(12)),
		],
		starts: [],
		now: NOW,
	})
	// Ordered by the later of the two: the last watch, or the move to Watching.
	assert.deepEqual(ids(plan.continue), [1, 5, 2])
	assert.deepEqual(ids(plan.pickUp), [3, 4])
	assert.deepEqual(
		plan.continue.map((row) => row.activeAt),
		[daysAgo(0).getTime(), daysAgo(12).getTime(), daysAgo(30).getTime()],
	)
	// What the show's watches say stays on the row.
	assert.equal(plan.continue[0].lastActivityAt, daysAgo(500).getTime())
	assert.equal(plan.pickUp[0].activeAt, daysAgo(91).getTime())
})

test("since when a show is Watching counts for a Watching show only", () => {
	// An entry the browser changed before the server answered may still carry the time of an earlier state.
	const stale = (id: number, state: State) => ({
		id,
		entry: entry(state, 3, daysAgo(200), [1, 3], daysAgo(1)),
		catalog: { airedEpisodes: 10, running: true },
	})
	const plan = planMyShows({
		shows: [stale(1, "on_hold"), stale(2, "dropped"), stale(3, "seen"), show(4, "watching", 3, 10, daysAgo(200))],
		starts: [],
		now: NOW,
	})
	assert.deepEqual(
		[...plan.onHold, ...plan.dropped, ...plan.continue, ...plan.pickUp].map((row) => [row.id, row.watchingSince]),
		[
			[1, null],
			[2, null],
			[3, null],
			[4, null],
		],
	)
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

test("a Seen show with new episodes that was dropped or put on hold leaves Continue for its status group", () => {
	// Rows 28 and 29 of the machine: 16 of 22 watched, the last of them yesterday.
	const seen = planMyShows({ shows: [show(1, "seen", 16, 22, daysAgo(1))], starts: [], now: NOW })
	assert.deepEqual(ids(seen.continue), [1])
	const plan = planMyShows({
		shows: [show(1, "dropped", 16, 22, daysAgo(1)), show(2, "on_hold", 16, 22, daysAgo(1))],
		starts: [],
		now: NOW,
	})
	assert.deepEqual(plan.continue, [])
	assert.deepEqual([ids(plan.dropped), ids(plan.onHold)], [[1], [2]])
})

test("a show the catalog has no aired count for stays where its state and activity put it", () => {
	const plan = planMyShows({
		shows: [
			show(1, "watching", 3, null, daysAgo(2)),
			{ id: 2, entry: entry("watching", 3, daysAgo(100)), catalog: null },
			show(3, "seen", 3, null, daysAgo(2)),
			{ id: 4, entry: entry("seen", 3, daysAgo(2)), catalog: null },
		],
		starts: [],
		now: NOW,
	})
	assert.deepEqual(ids(plan.continue), [1])
	assert.equal(plan.continue[0].aired, null)
	assert.deepEqual(ids(plan.pickUp), [2])
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

test("Tonight's pick is the show the member moved to Watching last, when that is later than any watch", () => {
	const plan = planMyShows({
		shows: [show(1, "watching", 3, 10, daysAgo(2)), moved(2, 18, 30, daysAgo(500), daysAgo(1))],
		starts: [],
		now: NOW,
	})
	assert.deepEqual(tonightsPickOf(plan, 555), { kind: "episode", showId: 2 })
})

test("without a Watching show active in the last 90 days, Tonight's pick is the first movie of My movies", () => {
	const plan = planMyShows({
		shows: [
			show(1, "watching", 3, 10, daysAgo(100)),
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

test("a row placed by the member's move to Watching says since when, and one placed by a watch says the watch", () => {
	const row = (lastActivityAt: Date | null, watchingSince: Date | null) => ({
		lastActivityAt: lastActivityAt?.getTime() ?? null,
		watchingSince: watchingSince?.getTime() ?? null,
	})
	assert.equal(placedWords(row(daysAgo(500), new Date(NOW - 2 * 3_600_000)), NOW), "Watching since today")
	assert.equal(placedWords(row(null, daysAgo(1)), NOW), "Watching since yesterday")
	assert.equal(placedWords(row(daysAgo(500), daysAgo(12)), NOW), "Watching for 12 days")
	assert.equal(placedWords(row(daysAgo(500), daysAgo(45)), NOW), "Watching for 6 weeks")
	assert.equal(placedWords(row(daysAgo(900), daysAgo(200)), NOW), "Watching for 7 months")
	assert.equal(placedWords(row(null, daysAgo(800)), NOW), "Watching for 2 years")
	// A watch since the move is the later fact, and one at the same moment (a first tick) is the plainer one.
	assert.equal(placedWords(row(daysAgo(3), daysAgo(12)), NOW), "Watched 3 days ago")
	assert.equal(placedWords(row(daysAgo(3), daysAgo(3)), NOW), "Watched 3 days ago")
	assert.equal(placedWords(row(daysAgo(3), null), NOW), "Watched 3 days ago")
	assert.equal(placedWords(row(null, null), NOW), "No date for your last watch")
})
