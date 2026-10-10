// PROTOTYPE - throwaway (issue #368). Walks every row of the transition table, the presets, and the property the
// owner cares about: no sequence of catalog events changes what is stored for a member.
import assert from "node:assert/strict"
import { test } from "node:test"
import {
	type AnyEvent,
	type CatalogEvent,
	type MemberEvent,
	RECOMMENDED,
	STATES,
	type Settings,
	type Show,
	type State,
	TABLE,
	type World,
	derive,
	episodeLabel,
	newMember,
	offer,
	play,
	rowIsActive,
	seenButton,
	step,
} from "./machine.ts"
import { DECISIONS, PRESETS, SHOWS, findPreset, findShow } from "./presets.ts"

const show = (key: string): Show => {
	const found = findShow(key)
	assert.ok(found, key)
	return found
}
const w = (season: number, number: number): AnyEvent => ({ type: "watch", season, number })
const u = (season: number, number: number): AnyEvent => ({ type: "unwatch", season, number })
const SEEN: AnyEvent = { type: "pressSeen" }
const AGAIN: AnyEvent = { type: "undoSeen" }

const used = new Set<string>()
/** Plays events and returns the states and rows, remembering which rows were walked. */
function run(key: string, events: AnyEvent[], settings: Partial<Settings> = {}) {
	const played = play(show(key), events, { ...RECOMMENDED, ...settings })
	for (const s of played.steps) if (s.row) used.add(s.row.id)
	return {
		...played,
		states: played.steps.map((s) => s.to),
		rows: played.steps.map((s) => s.row?.id ?? (s.refused ? "refused" : "-")),
		view: derive(played.world, { ...RECOMMENDED, ...settings }),
	}
}

test("the table is well formed", () => {
	assert.equal(new Set(TABLE.map((row) => row.id)).size, TABLE.length)
	for (const row of TABLE) {
		assert.ok(row.from.length > 0, row.id)
		assert.ok(row.says.length > 10, row.id)
		for (const from of row.from) assert.ok(STATES.includes(from), row.id)
	}
	// Every row can be reached: none is shadowed by an unguarded row above it for the same state and event.
	TABLE.forEach((row, index) => {
		for (const from of row.from) {
			const shadow = TABLE.slice(0, index).find((above) => above.event === row.event && above.from.includes(from) && !above.guard && !above.only)
			assert.equal(shadow, undefined, `row ${row.id} is shadowed by row ${shadow?.id} from ${from}`)
		}
	})
})

test("watching through an ended show: Watching with the first tick, Seen with the last", () => {
	const r = run("ended", [w(1, 1), w(1, 2), w(1, 3), w(2, 1), w(2, 2), w(2, 3)])
	assert.deepEqual(r.states, ["watching", "watching", "watching", "watching", "watching", "seen"])
	assert.deepEqual(r.rows, ["3", "3", "3", "3", "3", "2"])
	assert.equal(r.view.label, "Seen")
	assert.equal(r.view.next, null)
	assert.equal(seenButton(r.world).event, null, "Seen by ticking has no press to take back")
})

test("catching up on a running show, then episodes air", () => {
	const events = findPreset("caught-up-airs")?.steps ?? []
	const r = run("weekly", events)
	assert.deepEqual(r.states, ["watching", "watching", "watching", "watching", "seen", "seen", "seen", "seen", "seen", "watching"])
	assert.deepEqual(r.rows, ["3", "3", "3", "3", "2", "27", "4", "27", "27", "5"])
	const labels = events.map((_, index) => derive(play(show("weekly"), events.slice(0, index + 1)).world).label)
	assert.deepEqual(labels.slice(4), ["Caught up", "Caught up · 1 new", "Caught up", "Caught up · 1 new", "Caught up · 4 new", "Watching"])
	assert.match(r.steps[5].message, /^Nothing changed your state\. You now have 1 new episode\./)
	assert.equal(r.view.watched, 7)
	assert.equal(r.view.aired, 10)
	assert.equal(episodeLabel(r.view.next ?? { season: 9, number: 9 }), "S3 E1")
})

test("M1: the same Seen show reads Seen when the switch says so, and after the show ends", () => {
	const events = [w(1, 1), w(1, 2), w(1, 3), w(2, 1), w(2, 2)]
	assert.equal(run("weekly", events, { m1: "seen" }).view.label, "Seen")
	const ended = run("weekly", [...events, { type: "showEnds" }])
	assert.equal(ended.view.label, "Seen")
	assert.equal(ended.view.state, "seen")
	assert.match(ended.steps[5].message, /Nothing changed your state\. The label now reads "Seen"\./)
})

test("Seen, then Seen again, removes exactly the press's group", () => {
	const r = run("ended", [w(1, 1), w(1, 2), SEEN, AGAIN])
	assert.deepEqual(r.states, ["watching", "watching", "seen", "watching"])
	assert.deepEqual(r.rows, ["3", "3", "11", "14"])
	assert.equal(r.world.member.watches.length, 2)
	assert.ok(r.world.member.watches.every((watch) => watch.origin === "hand"))
	const pressed = run("ended", [w(1, 1), w(1, 2), SEEN])
	assert.equal(pressed.world.member.watches.filter((watch) => watch.origin === "bulk" && watch.group === "seen-1").length, 4)
	assert.equal(seenButton(pressed.world).event?.type, "undoSeen")
})

test("Seen again with nothing ticked before returns to where the member was", () => {
	assert.deepEqual(run("ended", [SEEN, AGAIN]).rows, ["11", "17"])
	assert.equal(run("ended", [SEEN, AGAIN]).view.state, "not_started")
	// Dropped with nothing watched, Seen, Seen again: Dropped.
	const dropped = run("ended", [{ type: "drop" }, SEEN, AGAIN])
	assert.deepEqual(dropped.rows, ["19", "11", "16"])
	assert.equal(dropped.view.state, "dropped")
	// On hold with nothing watched exists only after the last episode is unticked (M2 a).
	const held = run("ended", [w(1, 1), { type: "hold" }, u(1, 1), SEEN, AGAIN])
	assert.deepEqual(held.rows, ["3", "18", "10", "11", "15"])
	assert.equal(held.view.state, "on_hold")
	// With episodes ticked before, Seen again is still an exact undo: On hold stays On hold.
	assert.equal(run("ended", [w(1, 1), { type: "hold" }, SEEN, AGAIN]).view.state, "on_hold")
})

test("a Seen press on a Seen show marks only the new episodes, and its undo keeps the show Seen", () => {
	const r = run("weekly", [SEEN, { type: "episodeAirs" }, SEEN, AGAIN])
	assert.deepEqual(r.rows, ["11", "27", "12", "13"])
	assert.deepEqual(r.states, ["seen", "seen", "seen", "seen"])
	assert.equal(r.view.label, "Caught up · 1 new")
	assert.equal(r.world.member.watches.length, 5)
})

test("On hold and back", () => {
	const r = run("weekly", findPreset("on-hold")?.steps ?? [])
	assert.deepEqual(r.states, ["watching", "watching", "on_hold", "watching", "on_hold", "watching"])
	assert.deepEqual(r.rows, ["3", "3", "18", "20", "18", "3"])
	assert.equal(offer(play(show("weekly"), []).world, { type: "hold" }).ok, false)
})

test("Dropped with nothing watched, then Want to See, then the first tick", () => {
	const r = run("ended", findPreset("dropped-want")?.steps ?? [])
	assert.deepEqual(r.states, ["dropped", "not_started", "watching"])
	assert.deepEqual(r.rows, ["19", "24", "3"])
	const wanted = play(show("ended"), [{ type: "drop" }, { type: "wantToSee" }]).world
	assert.equal(wanted.member.wantToSee, true)
	assert.equal(r.world.member.wantToSee, false, "the first tick clears Want to See")
	assert.equal(derive(play(show("ended"), [{ type: "drop" }]).world).hiddenFromRecommendations, true)
})

test("M3: before the first watch the page offers Not interested, or both", () => {
	const fresh: World = { show: show("ended"), member: newMember() }
	assert.deepEqual(derive(fresh).offers, ["notInterested"])
	assert.equal(offer(fresh, { type: "drop" }).ok, false)
	assert.deepEqual(derive(fresh, { ...RECOMMENDED, m3: "both" }).offers, ["notInterested", "drop"])
	assert.equal(offer(fresh, { type: "drop" }, { ...RECOMMENDED, m3: "both" }).ok, true)
	const started = play(show("ended"), [w(1, 1)]).world
	assert.deepEqual(derive(started).offers, ["drop"])
	assert.equal(offer(started, { type: "notInterested" }).ok, false)
	// Not interested and Want to See clear each other; neither is a state.
	const r = run("ended", [{ type: "notInterested" }, { type: "wantToSee" }])
	assert.deepEqual(r.rows, ["25", "23"])
	assert.deepEqual([r.view.state, r.world.member.notInterested, r.world.member.wantToSee], ["not_started", false, true])
	assert.equal(derive(play(show("ended"), [{ type: "notInterested" }]).world).hiddenFromRecommendations, true)
})

test("rating never changes the state, and asks once on a never-started show", () => {
	const r = run("ended", [{ type: "rate", score: 8 }])
	assert.deepEqual(r.rows, ["22"])
	assert.equal(r.view.state, "not_started")
	assert.equal(r.view.seenQuestion, true)
	assert.equal(r.view.countsAsSeen, true)
	assert.equal(r.view.hiddenByNotSeenYet, true)
	assert.equal(r.view.next, null, "a scored, never-started show has no next episode")
	// The three answers.
	assert.equal(run("ended", [{ type: "rate", score: 8 }, SEEN]).view.state, "seen")
	const partway = run("ended", [{ type: "rate", score: 8 }, { type: "answerSeenQuestion", answer: "partway" }])
	assert.deepEqual([partway.view.state, partway.view.seenQuestion], ["not_started", false])
	const just = run("ended", [{ type: "rate", score: 8 }, { type: "answerSeenQuestion", answer: "just_rating" }, { type: "rate", score: 6 }])
	assert.deepEqual([just.view.state, just.view.seenQuestion], ["not_started", false], "asked once")
	// Not asked on a started show, nor when M5 says never.
	assert.equal(run("ended", [w(1, 1), { type: "rate", score: 8 }]).view.seenQuestion, false)
	assert.equal(run("ended", [{ type: "rate", score: 8 }], { m5: "never" }).view.seenQuestion, false)
	const reach: [State, AnyEvent[]][] = [
		["watching", [w(1, 1)]],
		["on_hold", [w(1, 1), { type: "hold" }]],
		["dropped", [{ type: "drop" }]],
		["seen", [SEEN]],
	]
	for (const [state, events] of reach) assert.equal(run("ended", [...events, { type: "rate", score: 3 }]).view.state, state)
})

test("a rewatch: pass 2 has its own progress and next episode, and pass 1 stays in the log", () => {
	const r = run("ended", findPreset("rewatch")?.steps ?? [], { m4: "built" })
	assert.deepEqual(r.states, ["seen", "watching", "watching", "watching"])
	assert.deepEqual(r.rows, ["11", "26", "3", "3"])
	assert.equal(r.view.pass, 2)
	assert.deepEqual([r.view.watched, r.view.aired], [2, 6])
	assert.equal(episodeLabel(r.view.next ?? { season: 9, number: 9 }), "S1 E3")
	assert.equal(r.world.member.watches.filter((watch) => watch.pass === 1).length, 6)
	// Finishing pass 2 is Seen again.
	const done = run("ended", [SEEN, { type: "watchAgain" }, w(1, 1), w(1, 2), w(1, 3), w(2, 1), w(2, 2), w(2, 3)], { m4: "built" })
	assert.equal(done.view.state, "seen")
	// Drawn, not built: refused.
	assert.equal(run("ended", [SEEN, { type: "watchAgain" }]).rows[1], "refused")
})

test("next episode: after the furthest watched, then the earliest gap", () => {
	const startAtTwo = run("ended", [w(2, 1)])
	assert.equal(episodeLabel(startAtTwo.view.next ?? { season: 9, number: 9 }), "S2 E2")
	const gap = run("ended", [w(2, 1), w(2, 2), w(2, 3)])
	assert.equal(episodeLabel(gap.view.next ?? { season: 9, number: 9 }), "S1 E1")
	assert.equal(gap.view.state, "watching")
})

test("a re-added episode: the watch counts by season and number", () => {
	const r = run("weekly", findPreset("readded")?.steps ?? [])
	assert.deepEqual(r.rows, ["3", "3", "3", "27"])
	assert.deepEqual([r.view.watched, r.view.aired], [3, 5])
	assert.equal(episodeLabel(r.view.next ?? { season: 9, number: 9 }), "S2 E1")
	assert.match(r.steps[3].message, /Nothing changed your state\..*S1 E3 came back under a new id, and your watch still counts/)
	// And it can still be unticked.
	assert.equal(run("weekly", [w(1, 1), { type: "episodeReadded" }, u(1, 1)]).view.state, "not_started")
})

test("a show with no episode list", () => {
	const r = run("nolist", findPreset("no-list")?.steps ?? [])
	assert.deepEqual(r.states, ["seen", "not_started", "not_started", "seen"])
	assert.deepEqual(r.rows, ["11", "17", "23", "11"])
	assert.equal(r.world.member.wantToSee, false, "Seen clears Want to See")
	assert.deepEqual([r.view.watched, r.view.aired, r.view.label], [0, 0, "Seen"])
	assert.equal(run("nolist", [w(1, 1)]).rows[0], "refused")
	assert.equal(run("nolist", [{ type: "drop" }, { type: "resume" }]).view.state, "not_started")
	assert.equal(run("nolist", [SEEN]).view.ratePrompt, true)
})

test("the prompt to rate: three episodes or a Seen press, once, and never with a score", () => {
	assert.equal(run("specials", [w(1, 1), w(1, 2)]).view.ratePrompt, false)
	assert.equal(run("specials", [w(1, 1), w(1, 2), w(1, 3)]).view.ratePrompt, true)
	assert.equal(run("specials", [w(1, 1), w(1, 2), w(0, 1)]).view.ratePrompt, false, "a special does not count")
	assert.equal(run("specials", [SEEN]).view.ratePrompt, true)
	assert.equal(run("specials", [w(1, 1), w(1, 2), w(1, 3), { type: "dismissRatePrompt" }, w(1, 4)]).view.ratePrompt, false)
	assert.equal(run("specials", [w(1, 1), w(1, 2), w(1, 3), { type: "rate", score: 7 }]).view.ratePrompt, false)
})

test("a special is only its own mark", () => {
	const r = run("specials", findPreset("special")?.steps ?? [])
	assert.deepEqual(r.states, ["not_started", "watching", "watching"])
	assert.deepEqual(r.rows, ["1", "3", "6"])
	const only = run("specials", [{ type: "wantToSee" }, w(0, 1)])
	assert.deepEqual([only.view.state, only.view.watched, only.world.member.wantToSee], ["not_started", 0, true])
	// Five regular episodes make it Seen with both specials unwatched.
	assert.equal(run("specials", [w(1, 1), w(1, 2), w(1, 3), w(1, 4), w(1, 5)]).view.label, "Caught up")
})

test("unticking: Seen and Watching fall back, On hold and Dropped stay (M2)", () => {
	const seen = run("ended", [SEEN, u(2, 3)])
	assert.deepEqual([seen.rows[1], seen.view.state], ["7", "watching"])
	assert.equal(seenButton(seen.world).event?.type, "pressSeen", "the press can no longer be taken back")
	assert.deepEqual(run("ended", [w(1, 1), u(1, 1)]).rows, ["3", "8"])
	assert.equal(run("ended", [w(1, 1), u(1, 1)]).view.state, "not_started")
	const held = run("weekly", [w(1, 1), w(1, 2), { type: "hold" }, u(1, 2)])
	assert.deepEqual([held.rows[3], held.view.state], ["9", "on_hold"])
	const keep = run("weekly", findPreset("unwatch-on-hold")?.steps ?? [])
	assert.deepEqual(keep.states, ["watching", "on_hold", "on_hold", "not_started"])
	assert.deepEqual(keep.rows, ["3", "18", "10", "21"])
	const other = run("weekly", [w(1, 1), { type: "hold" }, u(1, 1)], { m2: "not_started" })
	assert.deepEqual([other.rows[2], other.view.state], ["10b", "not_started"])
	const dropped = run("weekly", [w(1, 1), { type: "drop" }, u(1, 1)])
	assert.deepEqual([dropped.rows[2], dropped.view.state], ["10", "dropped"])
})

test("Dropped and On hold end with a tick, and the last aired episode makes any state Seen", () => {
	assert.equal(run("ended", [w(1, 1), { type: "drop" }, w(1, 2)]).view.state, "watching")
	assert.equal(run("ended", [w(1, 1), { type: "drop" }, { type: "resume" }]).view.state, "watching")
	const last = run("ended", [w(1, 1), w(1, 2), w(1, 3), w(2, 1), w(2, 2), { type: "hold" }, w(2, 3)])
	assert.deepEqual([last.rows[6], last.view.state], ["2", "seen"])
})

test("what the filters read", () => {
	const fresh = derive({ show: show("ended"), member: newMember() })
	assert.deepEqual([fresh.countsAsSeen, fresh.hiddenByNotSeenYet, fresh.hiddenFromRecommendations], [false, false, false])
	for (const [events, hidden] of [
		[[w(1, 1)], true],
		[[w(1, 1), { type: "hold" }], true],
		[[{ type: "drop" }], true],
		[[SEEN], true],
		[[{ type: "wantToSee" }], false],
	] as [AnyEvent[], boolean][])
		assert.equal(run("ended", events).view.hiddenByNotSeenYet, hidden, JSON.stringify(events))
	assert.equal(run("ended", [w(1, 1)]).view.countsAsSeen, false)
})

test("M6: as specified a Seen show stays Seen; the alternative moves it with nobody acting", () => {
	const events = findPreset("seen-new-episodes")?.steps ?? []
	const stays = run("weekly", events)
	assert.deepEqual(stays.states, ["seen", "seen", "seen"])
	assert.equal(stays.view.label, "Caught up · 4 new")
	assert.equal(stays.steps[2].message, "Nothing changed your state. You now have 4 new episodes.")
	const returns = run("weekly", events, { m6: "returns" })
	assert.deepEqual(returns.rows, ["11", "27b", "27"])
	assert.deepEqual(returns.states, ["seen", "watching", "watching"])
	assert.match(returns.steps[1].message, /Your state changed with nobody acting: Seen → Watching/)
	assert.equal(seenButton(returns.world).event?.type, "pressSeen", "the press can no longer be taken back")
})

// ---- the property ------------------------------------------------------------------------------------------

/** A small deterministic generator, so a failure can be repeated. */
function random(seed: number) {
	let state = seed
	return () => {
		state = (state * 1664525 + 1013904223) % 4294967296
		return state / 4294967296
	}
}
const CATALOG: CatalogEvent[] = [{ type: "episodeAirs" }, { type: "seasonAirs" }, { type: "showEnds" }, { type: "episodeReadded" }]

function memberEvents(world: World): MemberEvent[] {
	const simple: MemberEvent[] = [{ type: "pressSeen" }, { type: "undoSeen" }, { type: "hold" }, { type: "drop" }, { type: "resume" }, { type: "rate", score: 7 }, { type: "wantToSee" }, { type: "notInterested" }, { type: "watchAgain" }]
	const episodes = world.show.episodes.flatMap((e): MemberEvent[] => [
		{ type: "watch", season: e.season, number: e.number },
		{ type: "unwatch", season: e.season, number: e.number },
	])
	return [...simple, ...episodes]
}

test("no sequence of catalog events changes what is stored for a member", () => {
	const settings: Settings = { ...RECOMMENDED, m4: "built" }
	const reached = new Set<State>()
	let catalogEvents = 0
	for (let seed = 1; seed <= 400; seed++) {
		const next = random(seed)
		let world: World = { show: SHOWS[seed % SHOWS.length], member: newMember() }
		for (let round = 0; round < 6; round++) {
			// The member acts a few times...
			for (let i = 0; i < 4; i++) {
				const options = memberEvents(world)
				world = step(world, options[Math.floor(next() * options.length)], settings).world
			}
			reached.add(world.member.state)
			// ...then only the catalog changes, any number of times.
			const stored = JSON.stringify(world.member)
			const count = 1 + Math.floor(next() * 8)
			for (let i = 0; i < count; i++) {
				const event = CATALOG[Math.floor(next() * CATALOG.length)]
				const done = step(world, event, settings)
				world = done.world
				catalogEvents++
				assert.equal(JSON.stringify(world.member), stored, `seed ${seed}: ${event.type} changed the stored record`)
				assert.equal(done.to, done.from)
				if (!done.refused) assert.match(done.message, /^Nothing changed your state\./)
			}
		}
	}
	assert.deepEqual([...reached].sort(), [...STATES].sort(), "the walk reached every state")
	assert.ok(catalogEvents > 5000)
})

test("the same walk under the M6 alternative does change the state", () => {
	const settings: Settings = { ...RECOMMENDED, m6: "returns" }
	let world = play(SHOWS[1], [{ type: "pressSeen" }], settings).world
	const stored = world.member.state
	world = step(world, { type: "episodeAirs" }, settings).world
	assert.notEqual(world.member.state, stored)
})

test("a member's event always ends in a state the table names, and Seen by a tick means up to date", () => {
	for (let seed = 1; seed <= 300; seed++) {
		const next = random(seed * 7)
		let world: World = { show: SHOWS[seed % SHOWS.length], member: newMember() }
		for (let i = 0; i < 40; i++) {
			const all: AnyEvent[] = [...memberEvents(world), ...CATALOG]
			const event = all[Math.floor(next() * all.length)]
			const done = step(world, event, RECOMMENDED)
			assert.ok(STATES.includes(done.to))
			if (done.refused) assert.equal(done.world, world, "a refused event changes nothing")
			if (event.type === "watch" && done.to === "seen" && done.from !== "seen") {
				const view = derive(done.world)
				assert.equal(view.watched, view.aired)
			}
			if (done.world.member.state === "not_started") assert.equal(done.world.member.watches.filter((x) => x.season > 0).length, 0, "Not started has no regular watch")
			if (done.world.member.state === "watching") assert.ok(done.world.member.watches.some((x) => x.season > 0), "Watching has a watch")
			world = done.world
		}
	}
})

test("every preset plays without a refused step, and every decision points at one", () => {
	for (const preset of PRESETS) {
		const played = run(preset.show, preset.steps, preset.settings)
		assert.deepEqual(
			played.steps.filter((s) => s.refused).map((s) => s.refused),
			[],
			preset.id,
		)
	}
	assert.deepEqual(
		DECISIONS.map((d) => d.id),
		["m1", "m2", "m3", "m4", "m5", "m6"],
	)
	for (const decision of DECISIONS) {
		assert.ok(findPreset(decision.preset), decision.id)
		assert.equal(decision.options.filter((o) => o.recommended).length, 1, decision.id)
		assert.equal(decision.options.find((o) => o.recommended)?.value, RECOMMENDED[decision.id], decision.id)
	}
})

// Last on purpose: the tests above mark the rows they use.
test("every row of the table was walked", () => {
	const missed = TABLE.filter((row) => !used.has(row.id)).map((row) => row.id)
	assert.deepEqual(missed, [])
	assert.ok(TABLE.some((row) => !rowIsActive(row, RECOMMENDED)))
})

test("Seen and Seen again from On hold with episodes ticked returns to On hold", () => {
	const r = run("ended", [w(1, 1), w(1, 2), { type: "hold" }, SEEN, AGAIN])
	assert.equal(r.view.state, "on_hold")
	assert.equal(r.rows.at(-1), "15")
	assert.equal(r.world.member.watches.length, 2)
})
