// The status pill's menu: every state with the facts that change what the machine allows. The expected entries
// are written out by hand from the table (machine.ts), in the order the owner approved.
import assert from "node:assert/strict"
import { test } from "node:test"
import { TABLE, type World, newRecord, step } from "./machine.ts"
import { PLAIN_DATES } from "./seen-press.ts"
import { MENU_PLACE, statusMenu } from "./status-menu.ts"
import { type Action, findShow, play } from "./test-support.ts"

const PRESSED = Date.UTC(2024, 9, 19, 18, 30)
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
const AIRS: Action = { type: "episodeAirs" }
const HOLD: Action = { type: "hold" }
const DROP: Action = { type: "drop" }
/** Every episode of the ended sample show, ticked one by one. */
const ALL = [w(1, 1), w(1, 2), w(1, 3), w(2, 1), w(2, 2), w(2, 3)]

const walked = new Set<string>()
const offered = new Set<string>()
function menu(show: string, actions: Action[]) {
	const world = play(findShow(show), actions).world
	const group = world.record.seenPress?.group
	const entries = statusMenu(
		world,
		group
			? {
					at: PRESSED,
					count: world.record.watches.filter((x) => x.group === group).length,
				}
			: null,
		PLAIN_DATES,
	)
	for (const entry of entries) {
		if (entry.row) walked.add(entry.row)
		offered.add(entry.id)
	}
	return entries
}
const ids = (show: string, actions: Action[]) =>
	menu(show, actions).map((entry) => entry.id)
const entry = (show: string, actions: Action[], id: string) => {
	const found = menu(show, actions).find((each) => each.id === id)
	assert.ok(found, `${id} is not offered`)
	return [found.label, found.note]
}

test("Not started has no menu: the box with the pill is not shown, and its actions are the page's buttons", () => {
	assert.deepEqual(ids("ended", []), [])
	assert.deepEqual(ids("ended", [{ type: "rate", score: 8 }]), [])
	assert.deepEqual(ids("ended", [{ type: "wantToSee", on: true }]), [])
})

test("Watching: mark all aired episodes, put on hold, and Drop last and quiet", () => {
	const entries = menu("ended", [w(1, 1), w(1, 2)])
	assert.deepEqual(
		entries.map((e) => [e.id, e.label, e.note, e.quiet]),
		[
			[
				"markAll",
				"Mark all aired episodes watched",
				"Marks the 4 you haven't ticked, without dates. The show is then Seen.",
				false,
			],
			[
				"hold",
				"Put on hold",
				"Set aside for now. Watching an episode brings it back.",
				false,
			],
			[
				"drop",
				"Drop",
				"Not continuing. Your watches stay, and it is hidden from your recommendations.",
				true,
			],
		],
	)
	// A running show is Caught up afterwards; a second pass offers the same.
	assert.match(
		entry("weekly", [w(1, 1)], "markAll")[1],
		/Marks the 4 you haven't ticked, without dates\. The show is then Caught up\./,
	)
	assert.deepEqual(ids("ended", [...ALL, { type: "watchAgain" }, w(1, 1)]), [
		"markAll",
		"hold",
		"drop",
	])
	assert.deepEqual(ids("ended", [...ALL, { type: "watchAgain" }]), [
		"markAll",
		"hold",
		"drop",
	])
})

test("On hold: Resume first, also with nothing watched, where it leads back to Not started", () => {
	assert.deepEqual(ids("ended", [w(1, 1), HOLD]), ["resume", "markAll", "drop"])
	assert.deepEqual(entry("ended", [w(1, 1), HOLD], "resume"), [
		"Resume",
		"Back to Watching.",
	])
	const emptied = [w(1, 1), HOLD, u(1, 1)]
	assert.deepEqual(ids("ended", emptied), ["resume", "markAll", "drop"])
	assert.deepEqual(entry("ended", emptied, "resume"), [
		"Resume",
		"Nothing is watched, so it is Not started again.",
	])
})

test("Dropped: Resume with something watched; with nothing watched, Want to see it after all comes first", () => {
	assert.deepEqual(ids("ended", [w(1, 1), DROP]), ["resume", "markAll"])
	const emptied = [w(1, 1), DROP, u(1, 1)]
	assert.deepEqual(ids("ended", emptied), ["wantToSee", "resume", "markAll"])
	assert.deepEqual(entry("ended", emptied, "wantToSee"), [
		"Want to see it after all",
		"No longer dropped, and on your Wishlist.",
	])
	assert.deepEqual(ids("ended", [DROP]), ["wantToSee", "resume", "markAll"])
})

test("Seen with nothing new: Watch again and Want to rewatch; with a press standing also taking it back and a date for its watches", () => {
	assert.deepEqual(ids("ended", ALL), ["watchAgain", "rewatch"])
	assert.deepEqual(ids("weekly", [SEEN]), [
		"watchAgain",
		"rewatch",
		"takeBack",
		"setDate",
	])
	const entries = menu("ended", [w(1, 1), SEEN])
	assert.deepEqual(
		entries.map((e) => [e.id, e.label, e.note, e.quiet, e.confirm]),
		[
			[
				"watchAgain",
				"Watch again",
				"Starts pass 2 now: the ticks start empty and it is Watching again.",
				false,
				true,
			],
			[
				"rewatch",
				"Want to rewatch",
				"Only bookmarks it on your Wishlist. Your episodes stay ticked.",
				false,
				false,
			],
			[
				"takeBack",
				"Take back Seen",
				"Removes the 5 episodes marked on 19 Oct 2024. The show is then Watching.",
				true,
				// It removes watches, so the page asks first, in these words.
				true,
			],
			[
				"setDate",
				"Set a date for those 5 watches",
				"One day for all of them.",
				false,
				false,
			],
		],
	)
})

test("Take back Seen says where the show goes: the state the press was made from", () => {
	const note = (show: string, actions: Action[]) =>
		entry(show, actions, "takeBack")[1]
	assert.equal(
		note("ended", [SEEN]),
		"Removes the 6 episodes marked on 19 Oct 2024. The show is then Not started.",
	)
	assert.match(
		note("ended", [w(1, 1), HOLD, SEEN]),
		/The show is then On hold\.$/,
	)
	assert.match(
		note("ended", [w(1, 1), DROP, SEEN]),
		/The show is then Dropped\.$/,
	)
	// A press on a Seen show marked only what was new: the show stays Seen.
	assert.equal(
		note("weekly", [SEEN, AIRS, SEEN]),
		"Removes the 1 episode marked on 19 Oct 2024. It is new again, and the show stays Caught up.",
	)
	// A show without an episode list: the press marked nothing, and there is nothing to date or to watch again.
	assert.deepEqual(ids("nolist", [SEEN]), ["rewatch", "takeBack"])
	assert.equal(
		note("nolist", [SEEN]),
		"It marked no episode. The show is then Not started.",
	)
})

test("Seen with new episodes: mark them first, then On hold, Watch again, the press, and Drop last", () => {
	const pressed = [SEEN, AIRS, AIRS]
	assert.deepEqual(ids("weekly", pressed), [
		"markNew",
		"hold",
		"watchAgain",
		"rewatch",
		"takeBack",
		"setDate",
		"drop",
	])
	assert.deepEqual(entry("weekly", pressed, "markNew"), [
		"Mark 2 new episodes watched",
		"As one group without dates. The show stays Caught up.",
	])
	assert.equal(
		entry("weekly", [SEEN, AIRS], "markNew")[0],
		"Mark 1 new episode watched",
	)
	assert.deepEqual(entry("weekly", pressed, "drop"), [
		"Drop",
		"Not continuing. Your watches stay, and it is hidden from your recommendations.",
	])
	// Seen by ticking every episode: no press to take back or to date.
	const ticked = [w(1, 1), w(1, 2), w(1, 3), w(2, 1), w(2, 2), AIRS]
	assert.deepEqual(ids("weekly", ticked), [
		"markNew",
		"hold",
		"watchAgain",
		"rewatch",
		"drop",
	])
	// A press that marked nothing, and episodes listed since: nothing to watch again and nothing to date.
	const world: World = {
		show: findShow("weekly"),
		record: {
			...newRecord(),
			state: "seen",
			seenPress: { group: "g", from: "not_started" },
		},
	}
	assert.deepEqual(
		statusMenu(world, { at: PRESSED, count: 0 }, PLAIN_DATES).map((e) => e.id),
		["markNew", "hold", "rewatch", "takeBack", "drop"],
	)
})

test("Want to rewatch stands beside Watch again on a Seen show, and reads as on once the show is on the Wishlist", () => {
	const seen = play(findShow("ended"), [w(1, 1), SEEN]).world
	const of = (world: World) => statusMenu(world, null, PLAIN_DATES)
	const beside = of(seen).map((e) => e.id)
	assert.equal(beside.indexOf("rewatch"), beside.indexOf("watchAgain") + 1)
	const on = of({
		show: seen.show,
		record: { ...seen.record, wantToSee: true },
	}).find((e) => e.id === "rewatch")
	assert.deepEqual(
		[on?.label, on?.note, on?.event, on?.row, on?.confirm],
		[
			"On your Wishlist to rewatch",
			"Take it off. Nothing else changes.",
			{ type: "wantToSee", on: false },
			"31",
			false,
		],
	)
	// Only a Seen show has it: for a show that is under way, Want to See is not an action.
	for (const actions of [[w(1, 1)], [w(1, 1), { type: "hold" } as const]])
		assert.ok(
			!of(play(findShow("ended"), actions).world).some(
				(e) => e.id === "rewatch",
			),
		)
})

test("a press whose day nothing stored says is taken back without naming one", () => {
	const world = play(findShow("ended"), [SEEN]).world
	const back = statusMenu(world, { at: null, count: 6 }, PLAIN_DATES).find(
		(e) => e.id === "takeBack",
	)
	assert.equal(
		back?.note,
		"Removes the 6 episodes it marked. The show is then Not started.",
	)
})

test("every entry is an action the machine takes from that state, by the row the menu names", () => {
	for (const [show, actions] of [
		["ended", [w(1, 1)]],
		["ended", [w(1, 1), HOLD]],
		["ended", [DROP]],
		["weekly", [SEEN, AIRS]],
		["ended", [w(1, 1), SEEN]],
	] as const) {
		const world = play(findShow(show), [...actions]).world
		for (const each of menu(show, [...actions])) {
			if (each.id === "setDate") continue
			assert.ok(each.event, each.id)
			const done = step(world, each.event, "menu-check")
			assert.equal(done.refused, null, `${each.id} from ${world.record.state}`)
			assert.equal(done.row?.id, each.row, each.id)
		}
	}
})

// Last on purpose: the tests above record which rows and entries the menus used.
test("every event of the table has its place: in the menu, or named as living elsewhere", () => {
	for (const row of TABLE)
		assert.ok(
			row.event in MENU_PLACE,
			`"${row.event}" (row ${row.id}) is neither in the menu nor listed as not in the menu`,
		)
	for (const [event, place] of Object.entries(MENU_PLACE))
		assert.ok(place === "menu" || place.length > 10, event)
	// Every row of a menu event that starts from a state with a pill was offered above. A new row for one of these
	// events fails here until a case above reaches it.
	const expected = TABLE.filter(
		(row) =>
			MENU_PLACE[row.event] === "menu" &&
			row.from.some((from) => from !== "not_started"),
	).map((row) => row.id)
	assert.deepEqual(
		expected.filter((id) => !walked.has(id)),
		[],
		"rows the menu never offered",
	)
	assert.deepEqual([...offered].sort(), [
		"drop",
		"hold",
		"markAll",
		"markNew",
		"resume",
		"rewatch",
		"setDate",
		"takeBack",
		"wantToSee",
		"watchAgain",
	])
})
