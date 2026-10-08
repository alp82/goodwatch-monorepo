import assert from "node:assert/strict"
import { test } from "node:test"
import { type ListedEpisode, PRESS_NOT_RESTORABLE } from "./machine.ts"
import {
	type ActionAnswer,
	type PageAction,
	type ShowCopy,
	applyLocally,
	confirmed,
	viewOf,
	watchStateEntryOf,
} from "./show-page.ts"
import {
	type LogRow,
	type StateRow,
	seenPressRestore,
	watchStateOf,
} from "./storage.ts"
import { groupedQuery } from "./test-support.ts"

const SHOW = 1399
const TODAY = "2026-10-08"
const NOW = Date.UTC(2026, 9, 8, 19, 30)

/** A special, three episodes of season 1, and season 2 with one aired, one airing today and one tomorrow. */
const EPISODES: ListedEpisode[] = [
	{ id: 100, season: 0, number: 1, airDate: "2020-01-01" },
	{ id: 101, season: 1, number: 1, airDate: "2020-01-01" },
	{ id: 102, season: 1, number: 2, airDate: "2020-01-08" },
	{ id: 103, season: 1, number: 3, airDate: "2020-01-15" },
	{ id: 201, season: 2, number: 1, airDate: "2026-10-01" },
	{ id: 202, season: 2, number: 2, airDate: TODAY },
	{ id: 203, season: 2, number: 3, airDate: "2026-10-09" },
]
const EMPTY: ShowCopy = { state: null, log: [] }

let made = 0
/** Applies actions in turn, as a member pressing through the page; fails when one is refused. */
function after(
	actions: (PageAction | [PageAction, string])[],
	start: ShowCopy = EMPTY,
	today = TODAY,
): ShowCopy {
	let copy = start
	for (const entry of actions) {
		const [action, id] = Array.isArray(entry)
			? entry
			: [entry, `act-${String(++made).padStart(6, "0")}`]
		const result = applyLocally(copy, action, id, {
			showId: SHOW,
			episodes: EPISODES,
			today,
			now: NOW,
		})
		assert.equal(result.refused, null, JSON.stringify(action))
		copy = result.copy
	}
	return copy
}
const watch = (season: number, number: number): PageAction => ({
	type: "watch",
	season,
	number,
})
const view = (
	copy: ShowCopy,
	context: Partial<Parameters<typeof viewOf>[2]> = {},
) =>
	viewOf(copy, EPISODES, {
		today: TODAY,
		running: false,
		score: null,
		...context,
	})
const menuOf = (v: ReturnType<typeof view>) => v.menu.map((entry) => entry.id)
const ticks = (copy: ShowCopy) =>
	copy.log.map((r) => `${r.season_number}.${r.episode_number}`).sort()

// ---------------------------------------------------------------------------------------------------------
// The guess
// ---------------------------------------------------------------------------------------------------------

test("a tick is shown at once: the watch with the id the browser made, dated now, and the show Watching", () => {
	const copy = after([[watch(1, 1), "watch-000001"]])
	assert.deepEqual(copy.log, [
		{
			watch_id: "watch-000001",
			media_type: "show",
			tmdb_id: SHOW,
			episode_tmdb_id: 101,
			season_number: 1,
			episode_number: 1,
			watched_at: NOW,
			watched_at_precision: "moment",
			origin: "single",
			group_id: null,
			import_id: null,
			pass: 1,
			created_at: NOW,
		},
	])
	assert.deepEqual(copy.state, {
		state: "watching",
		state_changed_at: NOW,
		pass: 1,
		seen_press_group: null,
		seen_press_from: null,
		rate_prompt_dismissed_at: null,
		seen_question: null,
	})
})

test("what can be ticked goes by the date on the device", () => {
	const context = { showId: SHOW, episodes: EPISODES, today: TODAY, now: NOW }
	assert.equal(
		applyLocally(EMPTY, watch(2, 2), "watch-000001", context).refused,
		null,
	)
	const tomorrow = applyLocally(EMPTY, watch(2, 3), "watch-000002", context)
	assert.equal(tomorrow.refused, "It has not aired yet.")
	assert.equal(tomorrow.copy, EMPTY, "a refused action leaves the copy alone")
	assert.equal(
		applyLocally(EMPTY, watch(2, 3), "watch-000003", {
			...context,
			today: "2026-10-09",
		}).refused,
		null,
	)
})

test("Mark season and the Seen press mark what has aired on the device, as one group without dates", () => {
	const season = after([
		[{ type: "markSeason", season: 2, today: TODAY }, "group-000001"],
	])
	assert.deepEqual(ticks(season), ["2.1", "2.2"])
	assert.deepEqual(
		season.log.map((r) => [
			r.watch_id,
			r.origin,
			r.group_id,
			r.watched_at,
			r.watched_at_precision,
		]),
		[
			["g-group-000001-201", "season", "group-000001", null, "unknown"],
			["g-group-000001-202", "season", "group-000001", null, "unknown"],
		],
	)
	const seen = after([[{ type: "pressSeen", today: TODAY }, "press-000001"]])
	assert.deepEqual(ticks(seen), ["1.1", "1.2", "1.3", "2.1", "2.2"])
	assert.deepEqual(
		[
			seen.state?.state,
			seen.state?.seen_press_group,
			seen.state?.seen_press_from,
		],
		["seen", "press-000001", "not_started"],
	)
})

test("Take back and its Undo in the browser: the page shows the press as it was, to the row, a later time notwithstanding", () => {
	const pressed = after([
		[watch(1, 1), "watch-000001"],
		[{ type: "pressSeen", today: TODAY }, "press-000001"],
		{ type: "setGroupDate", group: "press-000001", day: "2026-09-30" },
	])
	const restore = seenPressRestore(pressed.state, pressed.log)
	assert.ok(restore)
	const later = NOW + 5 * 60_000
	const at = { showId: SHOW, episodes: EPISODES, today: TODAY, now: later }
	const taken = applyLocally(pressed, { type: "undoSeen" }, undefined, at)
	assert.deepEqual(
		[taken.copy.state?.state, ticks(taken.copy), view(taken.copy).press],
		["watching", ["1.1"], null],
	)
	const put = applyLocally(taken.copy, restore, undefined, at)
	assert.equal(put.refused, null)
	assert.deepEqual(put.copy, pressed)
	assert.deepEqual(view(put.copy).press, view(pressed).press)
	// The page refuses it once the member has ticked one of the press's episodes.
	const ticked = applyLocally(taken.copy, watch(1, 2), "watch-000002", at)
	assert.equal(
		applyLocally(ticked.copy, restore, undefined, at).refused,
		PRESS_NOT_RESTORABLE,
	)
})

test("a date set on a watch or on a group changes those rows only", () => {
	const copy = after([
		[watch(1, 1), "watch-000001"],
		[{ type: "watchUpTo", season: 1, number: 3, today: TODAY }, "group-000001"],
		{
			type: "editWatchDate",
			watchId: "watch-000001",
			when: { precision: "unknown" },
		},
		{ type: "setGroupDate", group: "group-000001", day: "2026-09-30" },
	])
	assert.deepEqual(
		copy.log.map((r) => [r.watch_id, r.watched_at, r.watched_at_precision]),
		[
			["watch-000001", null, "unknown"],
			["g-group-000001-102", Date.UTC(2026, 8, 30), "day"],
			["g-group-000001-103", Date.UTC(2026, 8, 30), "day"],
		],
	)
	const context = { showId: SHOW, episodes: EPISODES, today: TODAY, now: NOW }
	assert.equal(
		applyLocally(
			copy,
			{
				type: "editWatchDate",
				watchId: "nope-0000",
				when: { precision: "unknown" },
			},
			undefined,
			context,
		).refused,
		"That watch is not in the log.",
	)
	assert.equal(
		applyLocally(
			copy,
			{ type: "setGroupDate", group: "nope-0000", day: "2026-09-30" },
			undefined,
			context,
		).refused,
		"That group has no watch.",
	)
})

// ---------------------------------------------------------------------------------------------------------
// The answer
// ---------------------------------------------------------------------------------------------------------

const row = (rest: Partial<LogRow>): LogRow => ({
	watch_id: "watch-000001",
	media_type: "show",
	tmdb_id: SHOW,
	episode_tmdb_id: 101,
	season_number: 1,
	episode_number: 1,
	watched_at: NOW,
	watched_at_precision: "moment",
	origin: "single",
	group_id: null,
	import_id: null,
	pass: 1,
	created_at: NOW,
	...rest,
})
const stateRow = (rest: Partial<StateRow> = {}): StateRow => ({
	state: "watching",
	state_changed_at: NOW,
	pass: 1,
	seen_press_group: null,
	seen_press_from: null,
	rate_prompt_dismissed_at: null,
	seen_question: null,
	...rest,
})
const answer = (rest: Partial<ActionAnswer>): ActionAnswer => ({
	status: "applied",
	refused: null,
	state: null,
	rows: [],
	deleted: [],
	cleared: { wantToSeeAddedAt: null, notInterested: false },
	...rest,
})

test("the answer replaces the guess: the server's state row, its rows for the guessed ones, and what it removed", () => {
	const guess: ShowCopy = {
		state: stateRow(),
		log: [
			row({}),
			row({
				watch_id: "watch-000002",
				episode_tmdb_id: 102,
				episode_number: 2,
			}),
		],
	}
	const stored = row({ watched_at: NOW + 1_234, created_at: NOW + 1_234 })
	const extra = row({
		watch_id: "g-press-203",
		episode_tmdb_id: 203,
		season_number: 2,
		episode_number: 3,
	})
	const next = confirmed(
		guess,
		answer({
			state: stateRow({ state: "seen", state_changed_at: NOW + 1_234 }),
			rows: [stored, extra],
			deleted: ["watch-000002"],
		}),
	)
	assert.deepEqual(
		next.state,
		stateRow({ state: "seen", state_changed_at: NOW + 1_234 }),
	)
	// The stored row stands where the guessed one stood; a row the browser did not expect is added.
	assert.deepEqual(next.log, [stored, extra])
})

// ---------------------------------------------------------------------------------------------------------
// What the page shows
// ---------------------------------------------------------------------------------------------------------

test("a show nobody started: no state, nothing watched, the Seen button marks, and no menu", () => {
	const v = view(EMPTY)
	assert.deepEqual(
		[
			v.tracked,
			v.derived.label,
			v.derived.watched,
			v.derived.aired,
			v.derived.next,
			v.seen.mode,
			v.menu,
			v.press,
			v.ratePrompt,
		],
		[false, "Not started", 0, 5, null, "mark", [], null, null],
	)
	assert.deepEqual([v.unaired, v.specialsWatched, v.wantToSee.ok], [1, 0, true])
	assert.deepEqual(v.derived.offers, ["notInterested"])
})

test("Watching: progress counts aired regular episodes, the next episode follows the furthest, and Drop takes Not interested's place", () => {
	const v = view(after([watch(1, 1), watch(1, 3), watch(0, 1)]))
	assert.deepEqual(
		[
			v.derived.label,
			v.derived.watched,
			v.derived.aired,
			v.derived.next?.id,
			v.specialsWatched,
		],
		["Watching", 2, 5, 201, 1],
	)
	assert.deepEqual([...v.watched].sort(), [100, 101, 103])
	assert.deepEqual(menuOf(v), ["markAll", "hold", "drop"])
	assert.deepEqual(v.derived.offers, ["drop"])
	assert.equal(v.wantToSee.ok, false)
	assert.match(v.wantToSee.why, /Watching/)
})

test("a special alone starts nothing, and is still the member's watch", () => {
	const v = view(after([watch(0, 1)]))
	assert.deepEqual(
		[v.tracked, v.derived.state, v.derived.watched, v.specialsWatched],
		[true, "not_started", 0, 1],
	)
})

test("On hold offers Resume and Drop, Dropped offers Resume, and neither loses its status with nothing watched", () => {
	const held = after([watch(1, 1), { type: "hold" }])
	assert.deepEqual(
		[view(held).derived.label, menuOf(view(held))],
		["On hold", ["resume", "markAll", "drop"]],
	)
	const dropped = after([{ type: "drop" }], held)
	assert.deepEqual(
		[view(dropped).derived.label, menuOf(view(dropped))],
		["Dropped", ["resume", "markAll"]],
	)
	const emptied = after([{ type: "unwatch", season: 1, number: 1 }], dropped)
	const v = view(emptied)
	assert.deepEqual(
		[v.derived.label, v.derived.watched, v.wantToSee.ok],
		["Dropped", 0, true],
	)
})

test("a Seen show reads Caught up while it runs and Seen once it has ended, and its press can be taken back", () => {
	const seen = after([[{ type: "pressSeen", today: TODAY }, "press-000001"]])
	assert.equal(view(seen, { running: true }).derived.label, "Caught up")
	const ended = view(seen)
	assert.deepEqual(
		[
			ended.derived.label,
			ended.derived.watched,
			ended.derived.aired,
			ended.seen.mode,
			ended.derived.next,
		],
		["Seen", 5, 5, "takeBack", null],
	)
	assert.deepEqual(menuOf(ended), ["watchAgain", "takeBack", "setDate"])
	// The press as the page reads it: made now, five undated watches, the first season whole and two of season 2.
	assert.deepEqual(
		[ended.press?.at, ended.press?.count, ended.press?.dated],
		[NOW, 5, 0],
	)
	assert.equal(
		ended.menu[1].note,
		"Removes the 5 episodes marked on 8 Oct 2026. The show is then Not started.",
	)
	assert.equal(
		view(after([{ type: "undoSeen" }], seen)).derived.state,
		"not_started",
	)
})

test("a show that is Seen because every episode was ticked has no press to take back", () => {
	const copy = after([
		watch(1, 1),
		watch(1, 2),
		watch(1, 3),
		watch(2, 1),
		watch(2, 2),
	])
	const v = view(copy)
	assert.deepEqual([v.derived.state, v.seen.mode], ["seen", "off"])
})

test("a Seen show with new episodes stays Seen, says how many are new, and offers to mark them", () => {
	const seen = after([[{ type: "pressSeen", today: TODAY }, "press-000001"]])
	const later = { today: "2026-10-09" }
	const running = view(seen, { ...later, running: true })
	assert.deepEqual(
		[
			running.derived.label,
			running.derived.newEpisodes,
			running.derived.next?.id,
			running.seen.mode,
			running.seen.newEpisodes,
		],
		["Caught up · 1 new", 1, 203, "markNew", 1],
	)
	assert.equal(view(seen, later).derived.label, "Seen · 1 new episode")
	const marked = after(
		[[{ type: "pressSeen", today: "2026-10-09" }, "press-000002"]],
		seen,
		"2026-10-09",
	)
	const v = view(marked, later)
	assert.deepEqual(
		[v.derived.label, v.seen.mode, marked.state?.seen_press_from],
		["Seen", "takeBack", "seen"],
	)
})

test("Watch again starts a pass with no ticks, and each episode keeps the watches of the earlier pass", () => {
	const seen = after([[{ type: "pressSeen", today: TODAY }, "press-000001"]])
	const again = after(
		[{ type: "watchAgain" }, [watch(1, 1), "watch-000001"]],
		seen,
	)
	const v = view(again)
	assert.deepEqual(
		[
			v.derived.label,
			v.derived.pass,
			v.derived.watched,
			v.derived.aired,
			v.derived.next?.id,
		],
		["Watching", 2, 1, 5, 102],
	)
	assert.deepEqual([...v.watched], [101])
	assert.deepEqual(
		v.watchesOf.get(101)?.map((r) => [r.pass, r.origin]),
		[
			[2, "single"],
			[1, "seen"],
		],
	)
	assert.deepEqual(
		v.watchesOf.get(102)?.map((r) => r.pass),
		[1],
	)
})

test("Watch again is not offered for a show marked Seen with no episode watched", () => {
	const context = { showId: SHOW, episodes: [], today: TODAY, now: NOW }
	const seen = applyLocally(
		EMPTY,
		{ type: "pressSeen" },
		"press-000001",
		context,
	).copy
	const v = viewOf(seen, [], { today: TODAY, running: false, score: null })
	assert.deepEqual([v.derived.state, menuOf(v)], ["seen", ["takeBack"]])
})

test("the prompt to rate is due after three episodes or a Seen press, until there is a score or Not now", () => {
	const two = after([watch(1, 1), watch(1, 2)])
	assert.equal(view(two).ratePrompt, null)
	const three = after([watch(1, 3)], two)
	assert.equal(view(three).ratePrompt, "partway")
	assert.equal(view(three, { score: 8 }).ratePrompt, null)
	assert.equal(
		view(after([{ type: "dismissRatePrompt" }], three)).ratePrompt,
		null,
	)
	const seen = after([[{ type: "pressSeen", today: TODAY }, "press-000001"]])
	assert.equal(view(seen).ratePrompt, "all")
})

test("the question after a score is open until it is answered", () => {
	const asked: ShowCopy = {
		state: stateRow({ state: "not_started", seen_question: "open" }),
		log: [],
	}
	assert.equal(view(asked, { score: 8 }).derived.seenQuestion, true)
	const answered = after(
		[{ type: "answerSeenQuestion", answer: "just_rating" }],
		asked,
	)
	assert.equal(view(answered, { score: 8 }).derived.seenQuestion, false)
	assert.equal(answered.state?.seen_question, "answered")
	const yes = after(
		[[{ type: "pressSeen", today: TODAY }, "press-000001"]],
		asked,
	)
	assert.deepEqual(
		[yes.state?.state, yes.state?.seen_question],
		["seen", "answered"],
	)
})

// ---------------------------------------------------------------------------------------------------------
// The member data map's entry
// ---------------------------------------------------------------------------------------------------------

test("the entry for the member data map is what the grouped query gives for the same rows", () => {
	const seen = after([[{ type: "pressSeen", today: TODAY }, "press-000001"]])
	const copies: ShowCopy[] = [
		after([watch(1, 1)]),
		after([watch(1, 1), watch(1, 3), watch(0, 1), { type: "hold" }]),
		after([
			[watch(1, 1), "watch-000001"],
			{
				type: "editWatchDate",
				watchId: "watch-000001",
				when: { precision: "unknown" },
			},
		]),
		after([
			[watch(2, 1), "watch-000001"],
			[{ type: "markSeason", season: 1, today: TODAY }, "group-000001"],
			{ type: "setGroupDate", group: "group-000001", day: "2026-09-30" },
		]),
		seen,
		after([{ type: "watchAgain" }, watch(1, 2)], seen),
		after([
			watch(1, 1),
			{ type: "drop" },
			{ type: "unwatch", season: 1, number: 1 },
		]),
	]
	for (const copy of copies) {
		const expected = watchStateOf(
			copy.state
				? [
						{
							tmdb_id: SHOW,
							media_type: "show",
							state: copy.state.state,
							pass: copy.state.pass,
						},
					]
				: [],
			groupedQuery(
				copy.log.map((r) => ({ ...r, user_id: "member" })) as LogRow[],
			),
		)[`show-${SHOW}`]
		assert.deepEqual(watchStateEntryOf(copy), expected ?? null)
	}
	assert.equal(watchStateEntryOf(EMPTY), null)
	assert.equal(
		watchStateEntryOf(after([watch(0, 1)])),
		null,
		"a special alone gives no entry",
	)
	assert.deepEqual(watchStateEntryOf(after([watch(1, 1), watch(1, 3)])), {
		state: "watching",
		watchedAt: new Date(NOW),
		precision: "moment",
		count: 2,
		pass: 1,
		episodesWatched: 2,
		furthest: [1, 3],
		lastActivityAt: new Date(NOW),
	})
})
