// Walks every row of the transition table, the presets, the group actions, what a request sent twice does, and
// the property the owner cares about: no change of the catalog changes what is stored for a member.
import assert from "node:assert/strict"
import { test } from "node:test"
import {
	type ListedEpisode,
	STATES,
	type State,
	TABLE,
	type TrackingEvent,
	type World,
	derive,
	episodeLabel,
	newRecord,
	offer,
	seenButton,
	serverShow,
	showAiredBy,
	step,
} from "./machine.ts"
import {
	type Action,
	type CatalogChange,
	PRESETS,
	SHOWS,
	changeCatalog,
	episodeId,
	findPreset,
	findShow,
	isCatalogChange,
	mulberry32,
	play,
} from "./test-support.ts"

const w = (season: number, number: number): Action => ({
	type: "watch",
	season,
	number,
})
const u = (season: number, number: number): Action => ({
	type: "unwatch",
	season,
	number,
})
const SEEN: Action = { type: "pressSeen" }
const AGAIN: Action = { type: "undoSeen" }
const WANT: Action = { type: "wantToSee", on: true }
const NOPE: Action = { type: "notInterested", on: true }

const used = new Set<string>()
/** Plays actions and returns the states and rows, remembering which rows were walked. */
function run(key: string, actions: Action[]) {
	const played = play(findShow(key), actions)
	for (const s of played.steps) for (const r of s?.rows ?? []) used.add(r.id)
	return {
		...played,
		states: played.steps.map((s) => s?.to ?? "catalog"),
		rows: played.steps.map((s) =>
			s ? (s.refused ? "refused" : (s.row?.id ?? "-")) : "catalog",
		),
		view: derive(played.world),
	}
}
const nextLabel = (view: {
	next: { season: number; number: number } | null
}) => (view.next ? episodeLabel(view.next) : "none")

test("the table is well formed", () => {
	assert.equal(new Set(TABLE.map((row) => row.id)).size, TABLE.length)
	assert.deepEqual(
		TABLE.map((row) => Number(row.id)).sort((a, b) => a - b),
		Array.from({ length: 29 }, (_, index) => index + 1),
	)
	for (const row of TABLE) {
		assert.ok(row.from.length > 0, row.id)
		assert.ok(row.says.length > 10, row.id)
		for (const from of row.from) assert.ok(STATES.includes(from), row.id)
	}
	// Every row can be reached: none is shadowed by an unguarded row above it for the same state and event.
	TABLE.forEach((row, index) => {
		for (const from of row.from) {
			const shadow = TABLE.slice(0, index).find(
				(above) =>
					above.event === row.event &&
					above.from.includes(from) &&
					!above.guard,
			)
			assert.equal(
				shadow,
				undefined,
				`row ${row.id} is shadowed by row ${shadow?.id} from ${from}`,
			)
		}
	})
})

test("watching through an ended show: Watching with the first tick, Seen with the last", () => {
	const r = run("ended", [w(1, 1), w(1, 2), w(1, 3), w(2, 1), w(2, 2), w(2, 3)])
	assert.deepEqual(r.states, [
		"watching",
		"watching",
		"watching",
		"watching",
		"watching",
		"seen",
	])
	assert.deepEqual(r.rows, ["3", "3", "3", "3", "3", "2"])
	assert.equal(r.view.label, "Seen")
	assert.equal(r.view.next, null)
	assert.equal(
		seenButton(r.world).event,
		null,
		"Seen by ticking has no press to take back",
	)
	assert.deepEqual(
		r.world.record.watches.map((x) => [x.id, x.origin, x.group, x.pass]),
		[1, 2, 3, 4, 5, 6].map((n) => [`id-${n}`, "single", null, 1]),
	)
})

test("catching up on a running show, then episodes air", () => {
	const actions = findPreset("caught-up-airs").steps
	const r = run("weekly", actions)
	assert.deepEqual(r.states, [
		"watching",
		"watching",
		"watching",
		"watching",
		"seen",
		"catalog",
		"seen",
		"catalog",
		"catalog",
		"watching",
	])
	assert.deepEqual(r.rows, [
		"3",
		"3",
		"3",
		"3",
		"2",
		"catalog",
		"4",
		"catalog",
		"catalog",
		"5",
	])
	const labels = actions.map(
		(_, index) =>
			derive(play(findShow("weekly"), actions.slice(0, index + 1)).world).label,
	)
	assert.deepEqual(labels.slice(4), [
		"Caught up",
		"Caught up · 1 new",
		"Caught up",
		"Caught up · 1 new",
		"Caught up · 4 new",
		"Watching",
	])
	assert.equal(r.view.watched, 7)
	assert.equal(r.view.aired, 10)
	assert.equal(nextLabel(r.view), "S3 E1")
})

test("a Seen show reads Caught up while it runs and Seen once it has ended, and the state is the same", () => {
	const actions = [w(1, 1), w(1, 2), w(1, 3), w(2, 1), w(2, 2)]
	assert.equal(run("weekly", actions).view.label, "Caught up")
	const ended = run("weekly", [...actions, { type: "showEnds" }])
	assert.equal(ended.view.label, "Seen")
	assert.equal(ended.view.state, "seen")
	const fresh = run("ended", [
		SEEN,
		{ type: "seasonAirs" },
		{ type: "showEnds" },
	])
	assert.equal(fresh.view.label, "Seen · 3 new episodes")
})

test("Seen, then Seen again, removes exactly the press's group", () => {
	const r = run("ended", [w(1, 1), w(1, 2), SEEN, AGAIN])
	assert.deepEqual(r.states, ["watching", "watching", "seen", "watching"])
	assert.deepEqual(r.rows, ["3", "3", "11", "14"])
	assert.equal(r.world.record.watches.length, 2)
	assert.ok(r.world.record.watches.every((watch) => watch.origin === "single"))
	const pressed = run("ended", [w(1, 1), w(1, 2), SEEN])
	const group = pressed.world.record.watches.filter(
		(watch) => watch.origin === "seen" && watch.group === "id-3",
	)
	assert.deepEqual(
		group.map((watch) => watch.id),
		[
			`g-id-3-${episodeId("ended", 1, 3)}`,
			`g-id-3-${episodeId("ended", 2, 1)}`,
			`g-id-3-${episodeId("ended", 2, 2)}`,
			`g-id-3-${episodeId("ended", 2, 3)}`,
		],
	)
	assert.deepEqual(pressed.world.record.seenPress, {
		group: "id-3",
		from: "watching",
	})
	assert.equal(seenButton(pressed.world).event, "undoSeen")
})

test("Seen again with nothing ticked before returns to where the member was", () => {
	assert.deepEqual(run("ended", [SEEN, AGAIN]).rows, ["11", "17"])
	assert.equal(run("ended", [SEEN, AGAIN]).view.state, "not_started")
	// Dropped with nothing watched, Seen, Seen again: Dropped.
	const dropped = run("ended", [{ type: "drop" }, SEEN, AGAIN])
	assert.deepEqual(dropped.rows, ["19", "11", "16"])
	assert.equal(dropped.view.state, "dropped")
	// On hold with nothing watched exists only after the last episode is unticked.
	const held = run("ended", [w(1, 1), { type: "hold" }, u(1, 1), SEEN, AGAIN])
	assert.deepEqual(held.rows, ["3", "18", "10", "11", "15"])
	assert.equal(held.view.state, "on_hold")
	// With episodes ticked before, Seen again is still an exact undo: On hold stays On hold.
	const exact = run("ended", [w(1, 1), w(1, 2), { type: "hold" }, SEEN, AGAIN])
	assert.equal(exact.view.state, "on_hold")
	assert.equal(exact.rows[4], "15")
	assert.equal(exact.world.record.watches.length, 2)
})

test("a Seen press on a Seen show marks only the new episodes, and its undo keeps the show Seen", () => {
	const r = run("weekly", [SEEN, { type: "episodeAirs" }, SEEN, AGAIN])
	assert.deepEqual(r.rows, ["11", "catalog", "12", "13"])
	assert.deepEqual(r.states, ["seen", "catalog", "seen", "seen"])
	assert.equal(r.view.label, "Caught up · 1 new")
	assert.equal(r.world.record.watches.length, 5)
	const button = seenButton(
		play(findShow("weekly"), [SEEN, { type: "episodeAirs" }]).world,
	)
	assert.deepEqual(button, { event: "pressSeen", newEpisodes: 1 })
})

test("On hold and back", () => {
	const r = run("weekly", findPreset("on-hold").steps)
	assert.deepEqual(r.states, [
		"watching",
		"watching",
		"on_hold",
		"watching",
		"on_hold",
		"watching",
	])
	assert.deepEqual(r.rows, ["3", "3", "18", "20", "18", "3"])
	assert.equal(
		offer(play(findShow("weekly"), []).world, { type: "hold" }).ok,
		false,
	)
})

test("a Seen show with new episodes can be put on hold or dropped: the watches stay and the press ends (rows 28, 29)", () => {
	const AIRS: Action = { type: "episodeAirs" }
	for (const [type, id, to] of [
		["hold", "28", "on_hold"],
		["drop", "29", "dropped"],
	] as const) {
		// Nothing new: a show the member has seen all of is neither set aside nor given up.
		const upToDate = run("weekly", [SEEN, { type }])
		assert.deepEqual(upToDate.rows, ["11", "refused"], type)
		assert.equal(
			offer(play(findShow("weekly"), [SEEN]).world, { type }).ok,
			false,
		)
		const before: World = play(findShow("weekly"), [SEEN, AIRS]).world
		assert.equal(offer(before, { type }).ok, true, type)
		const r = run("weekly", [SEEN, AIRS, { type }])
		assert.deepEqual(r.rows, ["11", "catalog", id])
		assert.equal(r.view.state, to)
		assert.deepEqual(
			r.world.record.watches,
			before.record.watches,
			"no watch is touched",
		)
		assert.equal(r.world.record.seenPress, null, "the press ends")
		assert.deepEqual([r.view.watched, r.view.aired], [5, 6])
		// The rows that leave On hold and Dropped apply as for any other show.
		const resumed = run("weekly", [SEEN, AIRS, { type }, { type: "resume" }])
		assert.deepEqual([resumed.rows[3], resumed.view.state], ["20", "watching"])
		const ticked = run("weekly", [SEEN, AIRS, { type }, w(2, 3)])
		assert.deepEqual([ticked.rows[3], ticked.view.state], ["2", "seen"])
		assert.equal(ticked.world.record.seenPress, null)
		const some = run("weekly", [SEEN, AIRS, AIRS, { type }, w(2, 3)])
		assert.deepEqual([some.rows[4], some.view.state], ["3", "watching"])
	}
	const dropped = run("weekly", [
		SEEN,
		{ type: "episodeAirs" },
		{ type: "drop" },
	])
	assert.equal(dropped.view.hiddenFromRecommendations, true)
	assert.equal(dropped.view.next, null)
	const held = run("weekly", [SEEN, { type: "episodeAirs" }, { type: "hold" }])
	assert.equal(nextLabel(held.view), "S2 E3")
	// A press that marked nothing (no episode list at the time) and episodes listed since: On hold with nothing watched.
	const none = step(
		{
			show: findShow("weekly"),
			record: {
				...newRecord(),
				state: "seen",
				seenPress: { group: "g", from: "not_started" },
			},
		},
		{ type: "hold" },
	)
	assert.deepEqual(
		[none.row?.id, none.to, none.world.record.seenPress],
		["28", "on_hold", null],
	)
})

test("Dropped with nothing watched, then Want to See, then the first tick", () => {
	const r = run("ended", findPreset("dropped-want").steps)
	assert.deepEqual(r.states, ["dropped", "not_started", "watching"])
	assert.deepEqual(r.rows, ["19", "24", "3"])
	const wanted = play(findShow("ended"), [{ type: "drop" }, WANT]).world
	assert.equal(wanted.record.wantToSee, true)
	assert.equal(
		r.world.record.wantToSee,
		false,
		"the first tick clears Want to See",
	)
	assert.equal(
		derive(play(findShow("ended"), [{ type: "drop" }]).world)
			.hiddenFromRecommendations,
		true,
	)
	// With something watched, Resume is the way back, and taking a title off the Wishlist never moves a state.
	assert.equal(
		run("ended", [w(1, 1), { type: "drop" }, WANT]).rows[2],
		"refused",
	)
	assert.equal(
		run("ended", [{ type: "drop" }, { type: "wantToSee", on: false }]).rows[1],
		"refused",
	)
})

test("before the first watch the page offers Not interested, and Drop from the first watch", () => {
	const fresh: World = { show: findShow("ended"), record: newRecord() }
	assert.deepEqual(derive(fresh).offers, ["notInterested"])
	assert.equal(offer(fresh, { type: "drop" }).ok, false)
	assert.equal(offer(fresh, NOPE).ok, true)
	const started = play(findShow("ended"), [w(1, 1)]).world
	assert.deepEqual(derive(started).offers, ["drop"])
	assert.equal(offer(started, NOPE).ok, false)
	assert.equal(offer(started, { type: "drop" }).ok, true)
	// Not interested and Want to See clear each other; neither is a state.
	const r = run("ended", [NOPE, WANT])
	assert.deepEqual(r.rows, ["25", "23"])
	assert.deepEqual(
		[r.view.state, r.world.record.notInterested, r.world.record.wantToSee],
		["not_started", false, true],
	)
	const back = run("ended", [WANT, NOPE]).world.record
	assert.deepEqual([back.notInterested, back.wantToSee], [true, false])
	const off = run("ended", [WANT, { type: "wantToSee", on: false }])
	assert.deepEqual([off.rows[1], off.world.record.wantToSee], ["23", false])
	assert.equal(
		derive(play(findShow("ended"), [NOPE]).world).hiddenFromRecommendations,
		true,
	)
})

test("rating never changes the state, and asks once on a never-started show", () => {
	const r = run("ended", [{ type: "rate", score: 8 }])
	assert.deepEqual(r.rows, ["22"])
	assert.equal(r.view.state, "not_started")
	assert.equal(r.view.seenQuestion, true)
	assert.equal(r.view.countsAsSeen, true)
	assert.equal(r.view.hiddenByNotSeenYet, true)
	assert.equal(
		r.view.next,
		null,
		"a scored, never-started show has no next episode",
	)
	// The three answers.
	const yes = run("ended", [{ type: "rate", score: 8 }, SEEN])
	assert.deepEqual(
		[yes.view.state, yes.world.record.seenQuestion],
		["seen", "answered"],
	)
	const partway = run("ended", [
		{ type: "rate", score: 8 },
		{ type: "answerSeenQuestion", answer: "partway" },
	])
	assert.deepEqual(
		[partway.view.state, partway.view.seenQuestion],
		["not_started", false],
	)
	const just = run("ended", [
		{ type: "rate", score: 8 },
		{ type: "answerSeenQuestion", answer: "just_rating" },
		{ type: "rate", score: 6 },
	])
	assert.deepEqual(
		[just.view.state, just.view.seenQuestion],
		["not_started", false],
		"asked once",
	)
	// A tick answers it too.
	assert.equal(
		run("ended", [{ type: "rate", score: 8 }, w(1, 1)]).world.record
			.seenQuestion,
		"answered",
	)
	// Not asked on a started show, when the score is cleared, or for a score that was not given by hand.
	assert.equal(
		run("ended", [w(1, 1), { type: "rate", score: 8 }]).view.seenQuestion,
		false,
	)
	assert.equal(
		run("ended", [{ type: "rate", score: null }]).view.seenQuestion,
		false,
	)
	assert.equal(
		run("ended", [{ type: "rate", score: 8, byHand: false }]).view.seenQuestion,
		false,
	)
	// A score clears Not interested; clearing a score does not.
	assert.equal(
		run("ended", [NOPE, { type: "rate", score: 8 }]).world.record.notInterested,
		false,
	)
	const reach: [State, Action[]][] = [
		["watching", [w(1, 1)]],
		["on_hold", [w(1, 1), { type: "hold" }]],
		["dropped", [{ type: "drop" }]],
		["seen", [SEEN]],
	]
	for (const [state, actions] of reach)
		assert.equal(
			run("ended", [...actions, { type: "rate", score: 3 }]).view.state,
			state,
		)
})

test("a rewatch: pass 2 has its own progress and next episode, and pass 1 stays in the log", () => {
	const r = run("ended", findPreset("rewatch").steps)
	assert.deepEqual(r.states, ["seen", "watching", "watching", "watching"])
	assert.deepEqual(r.rows, ["11", "26", "3", "3"])
	assert.equal(r.view.pass, 2)
	assert.deepEqual([r.view.watched, r.view.aired], [2, 6])
	assert.equal(nextLabel(r.view), "S1 E3")
	assert.equal(
		r.world.record.watches.filter((watch) => watch.pass === 1).length,
		6,
	)
	assert.equal(r.world.record.seenPress, null)
	// Right after Watch again nothing of the new pass is watched, and the next episode is the first.
	const started = run("ended", [SEEN, { type: "watchAgain" }])
	assert.deepEqual(
		[started.view.watched, nextLabel(started.view)],
		[0, "S1 E1"],
	)
	// Finishing pass 2 is Seen again.
	const done = run("ended", [
		SEEN,
		{ type: "watchAgain" },
		w(1, 1),
		w(1, 2),
		w(1, 3),
		w(2, 1),
		w(2, 2),
		w(2, 3),
	])
	assert.equal(done.view.state, "seen")
})

test("Watch again needs a watched regular episode", () => {
	// A show without an episode list can be Seen by a press, with nothing watched.
	const nolist = run("nolist", [SEEN, { type: "watchAgain" }])
	assert.deepEqual(nolist.rows, ["11", "refused"])
	assert.deepEqual([nolist.view.state, nolist.view.pass], ["seen", 1])
	assert.match(nolist.steps[1]?.refused ?? "", /nothing to watch again/)
	// A special does not count.
	const special = run("nolist", [SEEN])
	const withSpecial: World = {
		show: special.world.show,
		record: {
			...special.world.record,
			watches: [
				{
					id: "s",
					episodeId: 1,
					season: 0,
					number: 1,
					origin: "single",
					group: null,
					pass: 1,
				},
			],
		},
	}
	assert.ok(step(withSpecial, { type: "watchAgain" }).refused)
	// Only from Seen.
	assert.equal(
		run("ended", [w(1, 1), { type: "watchAgain" }]).rows[1],
		"refused",
	)
	// An earlier pass's watch is enough for the next one.
	const third = run("ended", [
		SEEN,
		{ type: "watchAgain" },
		SEEN,
		{ type: "watchAgain" },
	])
	assert.deepEqual([third.view.state, third.view.pass], ["watching", 3])
})

test("next episode: after the furthest watched, then the earliest gap", () => {
	const startAtTwo = run("ended", [w(2, 1)])
	assert.equal(nextLabel(startAtTwo.view), "S2 E2")
	const gap = run("ended", [w(2, 1), w(2, 2), w(2, 3)])
	assert.equal(nextLabel(gap.view), "S1 E1")
	assert.equal(gap.view.state, "watching")
})

test("a re-added episode: the watch counts by season and number", () => {
	const r = run("weekly", findPreset("readded").steps)
	assert.deepEqual(r.rows, ["3", "3", "3", "catalog"])
	assert.deepEqual([r.view.watched, r.view.aired], [3, 5])
	assert.equal(nextLabel(r.view), "S2 E1")
	const readded = r.world.show.episodes.find(
		(e) => e.season === 1 && e.number === 3,
	)
	assert.notEqual(readded?.id, episodeId("weekly", 1, 3))
	assert.equal(
		r.world.record.watches[2].episodeId,
		episodeId("weekly", 1, 3),
		"the watch keeps the id it was made with",
	)
	// And it can still be unticked.
	assert.equal(
		run("weekly", [w(1, 1), { type: "episodeReadded" }, u(1, 1)]).view.state,
		"not_started",
	)
	// Two listed episodes with the season and number of a watch whose id is gone: it counts for neither.
	const two: World = {
		show: {
			running: false,
			episodes: [
				{ id: 1, season: 1, number: 1, aired: true },
				{ id: 2, season: 1, number: 1, aired: true },
			],
		},
		record: {
			...newRecord(),
			state: "watching",
			watches: [
				{
					id: "a",
					episodeId: 99,
					season: 1,
					number: 1,
					origin: "single",
					group: null,
					pass: 1,
				},
			],
		},
	}
	assert.equal(derive(two).watched, 0)
})

test("a show with no episode list", () => {
	const r = run("nolist", findPreset("no-list").steps)
	assert.deepEqual(r.states, ["seen", "not_started", "not_started", "seen"])
	assert.deepEqual(r.rows, ["11", "17", "23", "11"])
	assert.equal(r.world.record.wantToSee, false, "Seen clears Want to See")
	assert.deepEqual([r.view.watched, r.view.aired, r.view.label], [0, 0, "Seen"])
	assert.equal(run("nolist", [w(1, 1)]).rows[0], "refused")
	assert.equal(
		run("nolist", [{ type: "drop" }, { type: "resume" }]).view.state,
		"not_started",
	)
	assert.equal(run("nolist", [SEEN]).view.ratePrompt, true)
})

test("the prompt to rate: three episodes or a Seen press, once, and never with a score", () => {
	assert.equal(run("specials", [w(1, 1), w(1, 2)]).view.ratePrompt, false)
	assert.equal(
		run("specials", [w(1, 1), w(1, 2), w(1, 3)]).view.ratePrompt,
		true,
	)
	assert.equal(
		run("specials", [w(1, 1), w(1, 2), w(0, 1)]).view.ratePrompt,
		false,
		"a special does not count",
	)
	assert.equal(run("specials", [SEEN]).view.ratePrompt, true)
	assert.equal(
		run("specials", [
			w(1, 1),
			w(1, 2),
			w(1, 3),
			{ type: "dismissRatePrompt" },
			w(1, 4),
		]).view.ratePrompt,
		false,
	)
	assert.equal(
		run("specials", [w(1, 1), w(1, 2), w(1, 3), { type: "rate", score: 7 }])
			.view.ratePrompt,
		false,
	)
})

test("a special is only its own mark", () => {
	const r = run("specials", findPreset("special").steps)
	assert.deepEqual(r.states, ["not_started", "watching", "watching"])
	assert.deepEqual(r.rows, ["1", "3", "6"])
	const only = run("specials", [WANT, w(0, 1)])
	assert.deepEqual(
		[only.view.state, only.view.watched, only.world.record.wantToSee],
		["not_started", 0, true],
	)
	// Five regular episodes make it Seen with both specials unwatched.
	assert.equal(
		run("specials", [w(1, 1), w(1, 2), w(1, 3), w(1, 4), w(1, 5)]).view.label,
		"Caught up",
	)
})

test("unticking: Seen and Watching fall back, On hold and Dropped stay", () => {
	const seen = run("ended", [SEEN, u(2, 3)])
	assert.deepEqual([seen.rows[1], seen.view.state], ["7", "watching"])
	assert.equal(
		seenButton(seen.world).event,
		"pressSeen",
		"the press can no longer be taken back",
	)
	assert.equal(seen.world.record.seenPress, null)
	assert.deepEqual(run("ended", [w(1, 1), u(1, 1)]).rows, ["3", "8"])
	assert.equal(run("ended", [w(1, 1), u(1, 1)]).view.state, "not_started")
	const held = run("weekly", [w(1, 1), w(1, 2), { type: "hold" }, u(1, 2)])
	assert.deepEqual([held.rows[3], held.view.state], ["9", "on_hold"])
	const keep = run("weekly", findPreset("unwatch-on-hold").steps)
	assert.deepEqual(keep.states, [
		"watching",
		"on_hold",
		"on_hold",
		"not_started",
	])
	assert.deepEqual(keep.rows, ["3", "18", "10", "21"])
	const dropped = run("weekly", [w(1, 1), { type: "drop" }, u(1, 1)])
	assert.deepEqual([dropped.rows[2], dropped.view.state], ["10", "dropped"])
	// What is not ticked can't be unticked, and what is ticked can't be ticked again in the pass.
	assert.equal(run("ended", [w(1, 1), u(1, 2)]).rows[1], "refused")
	assert.equal(run("ended", [w(1, 1), w(1, 1)]).rows[1], "refused")
	assert.equal(run("weekly", [w(2, 3)]).rows[0], "refused", "not aired yet")
})

test("Dropped and On hold end with a tick, and the last aired episode makes any state Seen", () => {
	assert.equal(
		run("ended", [w(1, 1), { type: "drop" }, w(1, 2)]).view.state,
		"watching",
	)
	assert.equal(
		run("ended", [w(1, 1), { type: "drop" }, { type: "resume" }]).view.state,
		"watching",
	)
	const last = run("ended", [
		w(1, 1),
		w(1, 2),
		w(1, 3),
		w(2, 1),
		w(2, 2),
		{ type: "hold" },
		w(2, 3),
	])
	assert.deepEqual([last.rows[6], last.view.state], ["2", "seen"])
	// Hold, drop and resume are refused where the table has no row.
	assert.equal(run("ended", [{ type: "hold" }]).rows[0], "refused")
	assert.equal(run("ended", [SEEN, { type: "drop" }]).rows[1], "refused")
	assert.equal(run("ended", [w(1, 1), { type: "resume" }]).rows[1], "refused")
	assert.equal(run("ended", [SEEN, SEEN]).rows[1], "refused")
	assert.equal(run("ended", [AGAIN]).rows[0], "refused")
})

test("what the filters read", () => {
	const fresh = derive({ show: findShow("ended"), record: newRecord() })
	assert.deepEqual(
		[
			fresh.countsAsSeen,
			fresh.hiddenByNotSeenYet,
			fresh.hiddenFromRecommendations,
		],
		[false, false, false],
	)
	for (const [actions, hidden] of [
		[[w(1, 1)], true],
		[[w(1, 1), { type: "hold" }], true],
		[[{ type: "drop" }], true],
		[[SEEN], true],
		[[WANT], false],
	] as [Action[], boolean][])
		assert.equal(
			run("ended", actions).view.hiddenByNotSeenYet,
			hidden,
			JSON.stringify(actions),
		)
	assert.equal(run("ended", [w(1, 1)]).view.countsAsSeen, false)
})

test("a Seen show with new episodes stays Seen and says how many are new", () => {
	const stays = run("weekly", findPreset("seen-new-episodes").steps)
	assert.deepEqual(stays.states, ["seen", "catalog", "catalog"])
	assert.equal(stays.view.label, "Caught up · 4 new")
	assert.equal(stays.view.newEpisodes, 4)
	assert.equal(nextLabel(stays.view), "S2 E3")
	assert.deepEqual(stays.world.record.seenPress, {
		group: "id-1",
		from: "not_started",
	})
})

// ---- group actions -----------------------------------------------------------------------------------------

test("Mark season: one watch per aired episode of the season not yet watched, as one group", () => {
	const r = run("weekly", [w(1, 2), { type: "markSeason", season: 1 }])
	assert.deepEqual(r.states, ["watching", "watching"])
	assert.deepEqual(
		r.steps[1]?.rows.map((x) => x.id),
		["3", "3"],
	)
	assert.deepEqual(
		r.world.record.watches.slice(1).map((x) => [x.id, x.origin, x.group]),
		[
			[`g-id-2-${episodeId("weekly", 1, 1)}`, "season", "id-2"],
			[`g-id-2-${episodeId("weekly", 1, 3)}`, "season", "id-2"],
		],
	)
	// The unaired episodes of season 2 are left out, and the last aired one makes the show Seen (row 2).
	const all = run("weekly", [
		{ type: "markSeason", season: 1 },
		{ type: "markSeason", season: 2 },
	])
	assert.deepEqual([all.view.state, all.view.watched], ["seen", 5])
	assert.equal(all.steps[1]?.row?.id, "2")
	assert.equal(all.world.record.seenPress, null, "Seen by ticks has no press")
	// Nothing left to mark is refused, and so is a season of specials: a special is ticked on its own.
	assert.equal(
		run("weekly", [
			{ type: "markSeason", season: 1 },
			{ type: "markSeason", season: 1 },
		]).rows[1],
		"refused",
	)
	assert.equal(
		run("specials", [{ type: "markSeason", season: 0 }]).rows[0],
		"refused",
	)
})

test("Watched up to here: every aired episode up to it, and Want to See is cleared as by a tick", () => {
	const r = run("ended", [WANT, { type: "watchUpTo", season: 2, number: 1 }])
	assert.deepEqual([r.view.state, r.view.watched], ["watching", 4])
	assert.equal(r.world.record.wantToSee, false)
	assert.ok(
		r.world.record.watches.every(
			(x) => x.origin === "upto" && x.group === "id-2" && x.pass === 1,
		),
	)
	assert.equal(nextLabel(r.view), "S2 E2")
	assert.equal(
		run("ended", [{ type: "watchUpTo", season: 2, number: 3 }]).view.state,
		"seen",
	)
})

test("a group mark of two or more episodes on a Seen show ends the standing press", () => {
	const many = run("weekly", [
		SEEN,
		{ type: "seasonAirs" },
		{ type: "markSeason", season: 3 },
	])
	assert.deepEqual(
		many.steps[2]?.rows.map((x) => x.id),
		["5", "3", "2"],
	)
	assert.deepEqual(
		[many.view.state, many.world.record.seenPress],
		["seen", null],
	)
	const one = run("weekly", [
		SEEN,
		{ type: "episodeAirs" },
		{ type: "markSeason", season: 2 },
	])
	assert.equal(one.steps[2]?.row?.id, "4")
	assert.equal(one.world.record.seenPress?.group, "id-1")
})

test("Unmark season and the undo of a group mark are that many unwatches", () => {
	const unmarked = run("ended", [SEEN, { type: "unmarkSeason", season: 2 }])
	assert.deepEqual(
		[
			unmarked.view.state,
			unmarked.view.watched,
			unmarked.world.record.seenPress,
		],
		["watching", 3, null],
	)
	assert.deepEqual(
		unmarked.steps[1]?.rows.map((x) => x.id),
		["7", "7", "7"],
	)
	const all = run("ended", [
		{ type: "markSeason", season: 1 },
		{ type: "unmarkSeason", season: 1 },
	])
	assert.deepEqual([all.view.state, all.rows[1]], ["not_started", "8"])
	assert.equal(
		run("ended", [{ type: "unmarkSeason", season: 1 }]).rows[0],
		"refused",
	)
	// On hold stays On hold with nothing watched.
	const held = run("ended", [
		w(1, 1),
		{ type: "hold" },
		{ type: "unmarkSeason", season: 1 },
	])
	assert.deepEqual([held.view.state, held.rows[2]], ["on_hold", "10"])
	// Undo removes the group's watches and leaves the ticks made before it.
	const undone = run("ended", [
		w(1, 1),
		{ type: "watchUpTo", season: 2, number: 3 },
		{ type: "undoGroup", group: "id-2" },
	])
	assert.deepEqual(
		[undone.view.state, undone.world.record.watches.map((x) => x.id)],
		["watching", ["id-1"]],
	)
	assert.equal(
		run("ended", [{ type: "undoGroup", group: "nothing" }]).rows[0],
		"refused",
	)
	// Undoing the group of the standing Seen press is Seen pressed again.
	const press = run("ended", [SEEN, { type: "undoGroup", group: "id-1" }])
	assert.deepEqual([press.rows[1], press.view.state], ["17", "not_started"])
})

test("deleting a watch in the log: an unwatch when it was the episode's last of the pass, and never a state without a watch", () => {
	const last = run("ended", [w(1, 1), { type: "deleteWatch", watchId: "id-1" }])
	assert.deepEqual([last.rows[1], last.view.state], ["8", "not_started"])
	const seen = run("ended", [
		SEEN,
		{ type: "deleteWatch", watchId: `g-id-1-${episodeId("ended", 2, 3)}` },
	])
	assert.deepEqual(
		[seen.rows[1], seen.view.state, seen.world.record.seenPress],
		["7", "watching", null],
	)
	assert.equal(
		run("ended", [{ type: "deleteWatch", watchId: "nothing" }]).rows[0],
		"refused",
	)
	// A watch of an earlier pass: the current pass is untouched, so the state stays...
	const earlier = run("ended", [
		SEEN,
		{ type: "watchAgain" },
		w(1, 1),
		{ type: "deleteWatch", watchId: `g-id-1-${episodeId("ended", 1, 1)}` },
	])
	assert.deepEqual(
		[earlier.rows[3], earlier.view.state, earlier.view.watched],
		["-", "watching", 1],
	)
	// ...until no watch of a regular episode is left in any pass: Not started, and the pass is kept.
	let world = play(findShow("ended"), [SEEN, { type: "watchAgain" }]).world
	for (const watch of [...world.record.watches])
		world = step(world, { type: "deleteWatch", watchId: watch.id }).world
	assert.deepEqual(
		[world.record.state, world.record.pass, world.record.watches.length],
		["not_started", 2, 0],
	)
	// An episode watched twice in the pass stays watched when one of the two is deleted.
	const twice: World = {
		show: findShow("ended"),
		record: {
			...run("ended", [SEEN]).world.record,
			watches: [
				...run("ended", [SEEN]).world.record.watches,
				{
					id: "again",
					episodeId: episodeId("ended", 1, 1),
					season: 1,
					number: 1,
					origin: "import",
					group: null,
					pass: 1,
				},
			],
		},
	}
	const kept = step(twice, { type: "deleteWatch", watchId: "again" })
	assert.deepEqual(
		[kept.to, kept.row, kept.world.record.seenPress?.group],
		["seen", null, "id-1"],
	)
	// A watch whose episode TMDB no longer lists can still be deleted.
	const gone: World = {
		show: findShow("nolist"),
		record: {
			...newRecord(),
			state: "watching",
			watches: [
				{
					id: "x",
					episodeId: 5,
					season: 1,
					number: 1,
					origin: "single",
					group: null,
					pass: 1,
				},
			],
		},
	}
	assert.equal(
		step(gone, { type: "deleteWatch", watchId: "x" }).to,
		"not_started",
	)
})

test("a group mark does not depend on the order of its episodes", () => {
	const marked = run("weekly", [
		w(1, 2),
		{ type: "watchUpTo", season: 2, number: 2 },
	])
	const byHand = run("weekly", [w(1, 2), w(2, 2), w(2, 1), w(1, 3), w(1, 1)])
	assert.equal(marked.view.state, byHand.view.state)
	assert.deepEqual(
		marked.world.record.watches.map((x) => `${x.season}.${x.number}`).sort(),
		byHand.world.record.watches.map((x) => `${x.season}.${x.number}`).sort(),
	)
})

// ---- events that need an id, and a request sent again ---------------------------------------------------------

test("a watch, a Seen press and a group mark need the action's id", () => {
	const fresh: World = { show: findShow("ended"), record: newRecord() }
	for (const event of [
		{ type: "watch", season: 1, number: 1 },
		{ type: "pressSeen" },
		{ type: "markSeason", season: 1 },
		{ type: "watchUpTo", season: 1, number: 2 },
	] as TrackingEvent[]) {
		const done = step(fresh, event)
		assert.match(done.refused ?? "", /needs an id/, event.type)
		assert.equal(done.world, fresh)
	}
})

test("sent again, an event that already wrote its watches gives the same record", () => {
	const resend = { resend: true }
	const same = (world: World, event: TrackingEvent, id: string) => {
		const first = step(world, event, id)
		assert.equal(first.refused, null)
		const again = step(first.world, event, id, resend)
		assert.equal(again.refused, null, event.type)
		assert.deepEqual(again.world.record, first.world.record, event.type)
		// And when only the watches were written and the state was not.
		const half: World = {
			show: world.show,
			record: { ...world.record, watches: first.world.record.watches },
		}
		const repaired = step(half, event, id, resend)
		assert.deepEqual(repaired.world.record, first.world.record, event.type)
		return first.world
	}
	const fresh: World = { show: findShow("ended"), record: newRecord() }
	const ticked = same(fresh, { type: "watch", season: 1, number: 1 }, "a")
	const held = step(ticked, { type: "hold" }).world
	const pressed = same(held, { type: "pressSeen" }, "b")
	assert.deepEqual(pressed.record.seenPress, { group: "b", from: "on_hold" })
	same(ticked, { type: "markSeason", season: 2 }, "c")
	same(ticked, { type: "watchUpTo", season: 2, number: 3 }, "d")
	// The last aired episode: sent again it is still Seen, not refused as already watched.
	const five = play(findShow("ended"), [
		w(1, 1),
		w(1, 2),
		w(1, 3),
		w(2, 1),
		w(2, 2),
	])
	assert.equal(
		same(five.world, { type: "watch", season: 2, number: 3 }, "e").record.state,
		"seen",
	)
	// Without the option the machine is strict, which is what the browser runs.
	assert.ok(step(ticked, { type: "watch", season: 1, number: 1 }, "a").refused)
})

test("sent again, an event whose watches are already deleted still moves the state", () => {
	const resend = { resend: true }
	const afterDelete = (world: World, event: TrackingEvent) => {
		const first = step(world, event)
		assert.equal(first.refused, null)
		// Only the watches were deleted; the state row is the one from before.
		const half: World = {
			show: world.show,
			record: { ...world.record, watches: first.world.record.watches },
		}
		const repaired = step(half, event, "", resend)
		assert.equal(repaired.refused, null, event.type)
		return [repaired.world.record, first.world.record] as const
	}
	const one = play(findShow("ended"), [w(1, 1)]).world
	const two = play(findShow("ended"), [w(1, 1), w(1, 2)]).world
	const seen = play(findShow("ended"), [SEEN]).world
	// The only watched episode: Not started.
	assert.deepEqual(
		...afterDelete(one, { type: "unwatch", season: 1, number: 1 }),
	)
	assert.deepEqual(...afterDelete(one, { type: "unmarkSeason", season: 1 }))
	assert.deepEqual(
		...afterDelete(one, { type: "deleteWatch", watchId: "id-1" }),
	)
	// From Seen: an unwatch and an unmark leave Seen and end the press.
	assert.deepEqual(
		...afterDelete(seen, { type: "unwatch", season: 2, number: 3 }),
	)
	assert.deepEqual(...afterDelete(seen, { type: "unmarkSeason", season: 2 }))
	// Seen pressed again.
	assert.deepEqual(...afterDelete(seen, { type: "undoSeen" }))
	const both = play(findShow("ended"), [w(1, 1), SEEN]).world
	assert.deepEqual(...afterDelete(both, { type: "undoSeen" }))
	// A deleted watch or group that is gone can't say what it was, so the state stays unless nothing is left.
	const kept = step(
		{
			show: two.show,
			record: { ...two.record, watches: two.record.watches.slice(0, 1) },
		},
		{ type: "deleteWatch", watchId: "id-2" },
		"",
		resend,
	)
	assert.deepEqual([kept.refused, kept.to], [null, "watching"])
	const group = step(seen, { type: "undoGroup", group: "gone" }, "", resend)
	assert.deepEqual([group.refused, group.to], [null, "seen"])
	// Sent again after it was applied in full, an unwatch changes nothing.
	const done = step(two, { type: "unwatch", season: 1, number: 2 }).world
	assert.deepEqual(
		step(done, { type: "unwatch", season: 1, number: 2 }, "", resend).world
			.record,
		done.record,
	)
})

// ---- aired: UTC on the server, the device's date in the browser ---------------------------------------------------

const LIST: ListedEpisode[] = [
	{ id: 1, season: 1, number: 1, airDate: "2026-10-01" },
	{ id: 2, season: 1, number: 2, airDate: "2026-10-07" },
	{ id: 3, season: 1, number: 3, airDate: "2026-10-08" },
	{ id: 4, season: 1, number: 4, airDate: "2026-10-09" },
	{ id: 5, season: 1, number: 5, airDate: null },
]
const airedIds = (show: { episodes: { id: number; aired: boolean }[] }) =>
	show.episodes.filter((e) => e.aired).map((e) => e.id)

test("aired is the air date on or before the day, and an episode without a date has not aired", () => {
	assert.deepEqual(airedIds(showAiredBy(LIST, "2026-10-07")), [1, 2])
	assert.deepEqual(airedIds(showAiredBy(LIST, "2026-10-08")), [1, 2, 3])
	assert.deepEqual(airedIds(showAiredBy(LIST, "2030-01-01")), [1, 2, 3, 4])
	assert.equal(showAiredBy(LIST, "2026-10-07", true).running, true)
})

test("the server reads aired by the UTC date, and accepts a tick of an episode that airs one day later", () => {
	const utc = "2026-10-07"
	assert.deepEqual(airedIds(serverShow(LIST, { type: "hold" }, utc)), [1, 2])
	// Tomorrow's episode counts as aired in the step that ticks it, and only that one.
	assert.deepEqual(
		airedIds(serverShow(LIST, { type: "watch", season: 1, number: 3 }, utc)),
		[1, 2, 3],
	)
	assert.deepEqual(
		airedIds(serverShow(LIST, { type: "watch", season: 1, number: 2 }, utc)),
		[1, 2],
	)
	// The day after tomorrow, and an undated episode, are refused.
	for (const number of [4, 5]) {
		const event: TrackingEvent = { type: "watch", season: 1, number }
		const world: World = {
			show: serverShow(LIST, event, utc),
			record: newRecord(),
		}
		assert.equal(step(world, event, "a").refused, "It has not aired yet.")
	}
	// The first watch of a premiere gives the same state on both sides: with it, everything aired is watched.
	const premiere: TrackingEvent = { type: "watch", season: 1, number: 3 }
	const before = play(serverShow(LIST, { type: "hold" }, utc), [
		w(1, 1),
		w(1, 2),
	])
	assert.equal(before.world.record.state, "seen")
	const ticked = step(
		{ show: serverShow(LIST, premiere, utc), record: before.world.record },
		premiere,
		"p",
	)
	assert.deepEqual([ticked.row?.id, ticked.to], ["4", "seen"])
})

test("On hold and Drop on a Seen show go by the device's date, at most one day on, for what aired since", () => {
	const listed: ListedEpisode[] = [
		{ id: 1, season: 1, number: 1, airDate: "2026-10-01" },
		{ id: 2, season: 1, number: 2, airDate: "2026-10-09" },
		{ id: 3, season: 1, number: 3, airDate: "2026-10-10" },
	]
	for (const type of ["hold", "drop"] as const) {
		const seen = step(
			{ show: showAiredBy(listed, "2026-10-08"), record: newRecord() },
			{ type: "pressSeen" },
			"press-1",
		).world.record
		// The device is a day ahead of UTC and shows tomorrow's episode as new.
		const ahead = { type, today: "2026-10-09" } as const
		const tomorrow = serverShow(listed, ahead, "2026-10-08")
		assert.deepEqual(airedIds(tomorrow), [1, 2])
		assert.equal(step({ show: tomorrow, record: seen }, ahead).refused, null)
		// A device that claims a later day gets one day and no more.
		assert.deepEqual(
			airedIds(serverShow(listed, { type, today: "2026-10-20" }, "2026-10-08")),
			[1, 2],
		)
		// Without the device's date it is the UTC date: nothing is new, and the show is one the member has seen.
		const utc = serverShow(listed, { type }, "2026-10-08")
		assert.deepEqual(airedIds(utc), [1])
		assert.notEqual(step({ show: utc, record: seen }, { type }).refused, null)
	}
})

test("a group action marks by the later of the UTC date and the device's date, at most one day on", () => {
	const utc = "2026-10-07"
	const press = (today?: string): TrackingEvent => ({
		type: "pressSeen",
		today,
	})
	assert.deepEqual(airedIds(serverShow(LIST, press(), utc)), [1, 2])
	assert.deepEqual(
		airedIds(serverShow(LIST, press("2026-10-08"), utc)),
		[1, 2, 3],
	)
	assert.deepEqual(airedIds(serverShow(LIST, press("2026-10-06"), utc)), [1, 2])
	assert.deepEqual(
		airedIds(serverShow(LIST, press("2026-10-20"), utc)),
		[1, 2, 3],
	)
	assert.deepEqual(airedIds(serverShow(LIST, press("tomorrow"), utc)), [1, 2])
	assert.deepEqual(
		airedIds(
			serverShow(
				LIST,
				{ type: "markSeason", season: 1, today: "2026-10-08" },
				utc,
			),
		),
		[1, 2, 3],
	)
	assert.deepEqual(
		airedIds(
			serverShow(
				LIST,
				{ type: "watchUpTo", season: 1, number: 4, today: "2026-10-08" },
				utc,
			),
		),
		[1, 2, 3],
	)
	// The month's end.
	assert.deepEqual(
		airedIds(
			serverShow(
				[{ id: 9, season: 1, number: 1, airDate: "2026-11-01" }],
				press("2026-11-01"),
				"2026-10-31",
			),
		),
		[9],
	)
})

// ---- the properties ------------------------------------------------------------------------------------------

const CATALOG: CatalogChange[] = [
	{ type: "episodeAirs" },
	{ type: "seasonAirs" },
	{ type: "showEnds" },
	{ type: "episodeReadded" },
]

function memberEvents(world: World): TrackingEvent[] {
	const simple: TrackingEvent[] = [
		{ type: "pressSeen" },
		{ type: "undoSeen" },
		{ type: "hold" },
		{ type: "drop" },
		{ type: "resume" },
		{ type: "rate", score: 7 },
		{ type: "wantToSee", on: true },
		{ type: "wantToSee", on: false },
		{ type: "notInterested", on: true },
		{ type: "watchAgain" },
		{ type: "dismissRatePrompt" },
	]
	const episodes = world.show.episodes.flatMap((e): TrackingEvent[] => [
		{ type: "watch", season: e.season, number: e.number },
		{ type: "unwatch", season: e.season, number: e.number },
		{ type: "markSeason", season: e.season },
		{ type: "unmarkSeason", season: e.season },
		{ type: "watchUpTo", season: e.season, number: e.number },
	])
	const watches = world.record.watches.flatMap((x): TrackingEvent[] => [
		{ type: "deleteWatch", watchId: x.id },
		...(x.group ? [{ type: "undoGroup", group: x.group } as const] : []),
	])
	return [...simple, ...episodes, ...watches]
}

test("no change of the catalog changes what is stored for a member", () => {
	const reached = new Set<State>()
	let changes = 0
	for (let seed = 1; seed <= 400; seed++) {
		const next = mulberry32(seed)
		let world: World = { show: SHOWS[seed % SHOWS.length], record: newRecord() }
		let made = 0
		for (let round = 0; round < 6; round++) {
			// The member acts a few times...
			for (let i = 0; i < 4; i++) {
				const options = memberEvents(world)
				world = step(
					world,
					options[Math.floor(next() * options.length)],
					`a-${++made}`,
				).world
			}
			reached.add(world.record.state)
			// ...then only the catalog changes, any number of times.
			const stored = world.record
			const count = 1 + Math.floor(next() * 8)
			for (let i = 0; i < count; i++) {
				const change = CATALOG[Math.floor(next() * CATALOG.length)]
				world = { show: changeCatalog(world, change), record: world.record }
				changes++
				// The catalog is an argument and the record is not touched: row 27, by construction.
				assert.equal(world.record, stored)
				assert.equal(derive(world).state, stored.state)
			}
		}
	}
	assert.deepEqual(
		[...reached].sort(),
		[...STATES].sort(),
		"the walk reached every state",
	)
	assert.ok(changes > 5000)
})

test("every event ends in a state the table names, and the record's invariants hold", () => {
	for (let seed = 1; seed <= 400; seed++) {
		const next = mulberry32(seed * 7)
		let world: World = { show: SHOWS[seed % SHOWS.length], record: newRecord() }
		for (let i = 0; i < 40; i++) {
			const all: Action[] = [...memberEvents(world), ...CATALOG]
			const action = all[Math.floor(next() * all.length)]
			if (isCatalogChange(action)) {
				world = { show: changeCatalog(world, action), record: world.record }
				continue
			}
			const done = step(world, action, `a-${seed}-${i}`)
			for (const r of done.rows) used.add(r.id)
			assert.ok(STATES.includes(done.to))
			if (done.refused)
				assert.equal(done.world, world, "a refused event changes nothing")
			if (
				action.type === "watch" &&
				done.to === "seen" &&
				done.from !== "seen"
			) {
				const view = derive(done.world)
				assert.equal(view.watched, view.aired)
			}
			const record = done.world.record
			const regular = record.watches.filter((x) => x.season > 0).length
			if (record.state === "not_started")
				assert.equal(regular, 0, "Not started has no regular watch")
			if (record.state === "watching")
				assert.ok(regular > 0, "Watching has a watch")
			if (record.seenPress)
				assert.equal(record.state, "seen", "a press stands only on a Seen show")
			if (record.state !== "not_started")
				assert.ok(
					!record.wantToSee && !record.notInterested,
					"a started show is on no list of intentions",
				)
			assert.equal(
				new Set(record.watches.map((x) => x.id)).size,
				record.watches.length,
				"watch ids are unique",
			)
			for (const x of record.watches)
				assert.ok(x.pass >= 1 && x.pass <= record.pass)
			world = done.world
		}
	}
})

test("every preset plays without a refused step", () => {
	for (const preset of PRESETS) {
		const played = run(preset.show, preset.steps)
		assert.deepEqual(
			played.steps.filter((s) => s?.refused).map((s) => s?.refused),
			[],
			preset.id,
		)
	}
})

// Last on purpose: the tests above mark the rows they use.
test("every row of the table was walked, except the catalog's, which no code takes", () => {
	const missed = TABLE.filter((row) => !used.has(row.id)).map((row) => row.id)
	assert.deepEqual(missed, ["27"])
})
