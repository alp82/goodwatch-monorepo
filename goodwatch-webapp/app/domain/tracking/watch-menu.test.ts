import assert from "node:assert/strict"
import { test } from "node:test"
import type { ListedEpisode } from "./machine.ts"
import { type ShowCopy, applyLocally } from "./show-page.ts"
import { existingUndo, markPlan } from "./watch-menu.ts"

const SHOW = 1399
const TODAY = "2026-11-03"
const NOW = Date.UTC(2026, 10, 3, 19, 30)
const EPISODES: ListedEpisode[] = [
	{ id: 101, season: 1, number: 1, airDate: "2020-01-01" },
	{ id: 102, season: 1, number: 2, airDate: "2020-01-08" },
	{ id: 103, season: 1, number: 3, airDate: "2020-01-15" },
]
const context = { showId: SHOW, episodes: EPISODES, today: TODAY, now: NOW }
const EMPTY: ShowCopy = { state: null, log: [] }
const E3 = { season: 1, number: 3 }

/** Applies a mark's actions, as the menu sends them. */
function mark(
	copy: ShowCopy,
	plan: ReturnType<typeof markPlan>,
	id: string,
): ShowCopy {
	const first = applyLocally(copy, plan.first, id, context)
	assert.equal(first.refused, null)
	if (!plan.after) return first.copy
	const then = applyLocally(first.copy, plan.after, undefined, context)
	assert.equal(then.refused, null)
	return then.copy
}
const undo = (copy: ShowCopy, plan: ReturnType<typeof markPlan>) => {
	const done = applyLocally(copy, plan.undo, undefined, context)
	assert.equal(done.refused, null)
	return done.copy
}
const rows = (copy: ShowCopy) =>
	copy.log.map((r) => [r.episode_number, r.watched_at, r.watched_at_precision])

test("opening the menu marks only this episode, just now; Undo takes exactly that watch back", () => {
	const plan = markPlan(
		E3,
		{ upTo: false, when: { precision: "moment" } },
		"watch-000001",
		TODAY,
	)
	const marked = mark(EMPTY, plan, "watch-000001")
	assert.deepEqual(rows(marked), [[3, NOW, "moment"]])
	assert.deepEqual(undo(marked, plan).log, [])
})

test("everything up to here is saved without a date, whatever the menu's when says", () => {
	for (const when of [
		{ precision: "moment" },
		{ precision: "day", day: TODAY },
		{ precision: "unknown" },
	] as const) {
		const plan = markPlan(E3, { upTo: true, when }, "group-000002", TODAY)
		assert.equal(plan.after, null)
		assert.deepEqual(
			rows(mark(EMPTY, plan, "group-000002")).map((r) => r[2]),
			["unknown", "unknown", "unknown"],
		)
	}
})

test("a change takes the previous mark back first, so the log holds only what the menu shows", () => {
	const one = markPlan(
		E3,
		{ upTo: false, when: { precision: "moment" } },
		"watch-000001",
		TODAY,
	)
	const group = markPlan(
		E3,
		{ upTo: true, when: { precision: "unknown" } },
		"group-000002",
		TODAY,
	)
	// Undo, then the new mark: the group covers all three episodes.
	const changed = mark(
		undo(mark(EMPTY, one, "watch-000001"), one),
		group,
		"group-000002",
	)
	assert.equal(changed.log.length, 3)
	// And back to this episode alone: the group goes, one watch stays.
	const back = markPlan(
		E3,
		{ upTo: false, when: { precision: "unknown" } },
		"watch-000003",
		TODAY,
	)
	assert.deepEqual(rows(mark(undo(changed, group), back, "watch-000003")), [
		[3, null, "unknown"],
	])
})

test("an episode watched before the menu opened is taken back through its latest watch", () => {
	const watched = mark(
		EMPTY,
		markPlan(
			E3,
			{ upTo: false, when: { precision: "day", day: "2026-01-02" } },
			"watch-000009",
			TODAY,
		),
		"watch-000009",
	)
	const undoIt = existingUndo(watched.log, E3, 1)
	assert.deepEqual(undoIt, { type: "deleteWatch", watchId: "watch-000009" })
	assert.equal(existingUndo(watched.log, { season: 1, number: 2 }, 1), null)
})
