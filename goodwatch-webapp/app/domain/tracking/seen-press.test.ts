// The line that says what a standing Seen press covered, and when. Expected wordings are written out by hand.
import assert from "node:assert/strict"
import { test } from "node:test"
import type { ListedEpisode } from "./machine.ts"
import { PLAIN_DATES, seenPressLine, seenPressOf } from "./seen-press.ts"
import type { LogRow, StateRow } from "./storage.ts"

const PRESSED = Date.UTC(2024, 9, 19, 18, 30)
const LATER = Date.UTC(2026, 9, 8, 12)

/** Season 1 and 2 with eight episodes each, season 3 with ten, and one special. */
const EPISODES: ListedEpisode[] = [
	{ id: 1, season: 0, number: 1, airDate: "2020-01-01" },
	...[1, 2, 3].flatMap((season) =>
		Array.from({ length: season === 3 ? 10 : 8 }, (_, i) => ({
			id: season * 100 + i + 1,
			season,
			number: i + 1,
			airDate: `202${season}-01-01`,
		})),
	),
]

const row = (
	season: number,
	number: number,
	group: string | null = "press-1",
	rest: Partial<LogRow> = {},
): LogRow => ({
	watch_id: `w-${group}-${season}-${number}`,
	media_type: "show",
	tmdb_id: 1399,
	episode_tmdb_id: season * 100 + number,
	season_number: season,
	episode_number: number,
	watched_at: null,
	watched_at_precision: "unknown",
	origin: group ? "seen" : "single",
	group_id: group,
	import_id: null,
	pass: 1,
	created_at: PRESSED,
	...rest,
})
const rows = (
	season: number,
	count: number,
	group: string | null = "press-1",
	rest: Partial<LogRow> = {},
) => Array.from({ length: count }, (_, i) => row(season, i + 1, group, rest))

const state = (rest: Partial<StateRow> = {}): StateRow => ({
	state: "seen",
	state_changed_at: PRESSED,
	pass: 1,
	seen_press_group: "press-1",
	seen_press_from: "not_started",
	rate_prompt_dismissed_at: null,
	seen_question: null,
	...rest,
})

const line = (log: LogRow[], st: StateRow | null = state()) => {
	const press = seenPressOf({ state: st, log }, EPISODES)
	return press && seenPressLine(press, PLAIN_DATES)
}

test("no line without a standing press: no state, a Seen show by its ticks, a show that left Seen", () => {
	assert.equal(line(rows(1, 8), null), null)
	assert.equal(
		line(
			rows(1, 8, null),
			state({ seen_press_group: null, seen_press_from: null }),
		),
		null,
	)
	assert.equal(
		line(
			rows(1, 8),
			state({
				state: "watching",
				seen_press_group: null,
				seen_press_from: null,
			}),
		),
		null,
	)
})

test("whole seasons: the owner's show, marked Seen in 2024 when two seasons had aired", () => {
	assert.equal(
		line([...rows(1, 8), ...rows(2, 8)]),
		"Marked Seen on 19 Oct 2024 · seasons 1 and 2 (16 episodes), no dates recorded",
	)
	assert.equal(
		line(rows(1, 8)),
		"Marked Seen on 19 Oct 2024 · season 1 (8 episodes), no dates recorded",
	)
	assert.equal(
		line([...rows(1, 8), ...rows(2, 8), ...rows(3, 10)]),
		"Marked Seen on 19 Oct 2024 · seasons 1 to 3 (26 episodes), no dates recorded",
	)
})

test("the press covered part of a season: the season was airing, or the member had ticked the rest", () => {
	assert.equal(
		line([...rows(1, 8), ...rows(2, 8), ...rows(3, 4)]),
		"Marked Seen on 19 Oct 2024 · seasons 1 and 2, and 4 of the 10 episodes of season 3 (20 episodes), no dates recorded",
	)
	// Seasons 1 and 2 were ticked by hand; the press marked the rest of season 3.
	assert.equal(
		line([...rows(1, 8, null), ...rows(2, 8, null), row(3, 9), row(3, 10)]),
		"Marked Seen on 19 Oct 2024 · 2 of the 10 episodes of season 3, no dates recorded",
	)
	assert.equal(
		line([row(1, 8), row(3, 10)]),
		"Marked Seen on 19 Oct 2024 · 1 of the 8 episodes of season 1 and 1 of the 10 episodes of season 3 (2 episodes), no dates recorded",
	)
})

test("some of its episodes are gone from the log since: the line says what is left", () => {
	const log = [...rows(1, 8), ...rows(2, 8)].filter(
		(r) => !(r.season_number === 2 && (r.episode_number ?? 0) > 5),
	)
	assert.equal(
		line(log),
		"Marked Seen on 19 Oct 2024 · season 1, and 5 of the 8 episodes of season 2 (13 episodes), no dates recorded",
	)
})

test("a press with nothing left: a show that had no episode list then, or every row of it gone", () => {
	assert.equal(
		line([]),
		"Marked Seen on 19 Oct 2024 · no episode is marked by it",
	)
	// Watches the member made themselves are not the press's.
	assert.equal(
		line(rows(1, 3, null)),
		"Marked Seen on 19 Oct 2024 · no episode is marked by it",
	)
})

test("the day of the press is the day its rows were made, also when the state changed on another day", () => {
	// A press on a Seen show with new episodes: the state row still carries the day the show became Seen.
	const log = [
		...rows(1, 8, "press-0"),
		...rows(2, 8, "press-2", { created_at: LATER }),
	]
	const st = state({ seen_press_group: "press-2", seen_press_from: "seen" })
	assert.equal(
		line(log, st),
		"New episodes marked watched on 8 Oct 2026 · season 2 (8 episodes), no dates recorded",
	)
	// Nothing left of such a press: the state row's day is not the press's, so no day is claimed.
	assert.equal(
		line(rows(1, 8, "press-0"), st),
		"New episodes marked watched · no episode is marked by it",
	)
	// A press that left another state and has no row: the state changed with it.
	const press = seenPressOf(
		{ state: state({ state_changed_at: LATER }), log: [] },
		EPISODES,
	)
	assert.equal(press?.at, LATER)
})

test("dates set for the press's watches are said, and never claimed for all when some have none", () => {
	const day = {
		watched_at: Date.UTC(2024, 9, 1),
		watched_at_precision: "day" as const,
	}
	assert.equal(
		line(rows(1, 8, "press-1", day)),
		"Marked Seen on 19 Oct 2024 · season 1 (8 episodes), dated 1 Oct 2024",
	)
	assert.equal(
		line([...rows(1, 8, "press-1", day), ...rows(2, 8)]),
		"Marked Seen on 19 Oct 2024 · seasons 1 and 2 (16 episodes), 8 of them dated",
	)
	const other = {
		watched_at: Date.UTC(2024, 9, 2),
		watched_at_precision: "day" as const,
	}
	assert.equal(
		line([...rows(1, 8, "press-1", day), ...rows(2, 8, "press-1", other)]),
		"Marked Seen on 19 Oct 2024 · seasons 1 and 2 (16 episodes), dates recorded",
	)
})

test("what the press holds is counted for the menu: its rows, and how many of them have no date", () => {
	const press = seenPressOf(
		{ state: state(), log: [...rows(1, 8), ...rows(2, 3, null)] },
		EPISODES,
	)
	assert.deepEqual(
		[press?.group, press?.from, press?.count, press?.at],
		["press-1", "not_started", 8, PRESSED],
	)
})
