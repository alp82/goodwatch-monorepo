import assert from "node:assert/strict"
import test from "node:test"
import {
	LIKED_FROM,
	MILESTONE_EVERY,
	MIN_LIKED,
} from "../../domain/taste-rules.ts"
import {
	type FlowState,
	INITIAL_FLOW,
	MILESTONE_GLOW,
	type Tally,
	justLanded,
	litMilestone,
	nextStep,
	nextStepWords,
	offersResume,
	ratingFlow,
	ratingRows,
	readFlowPress,
	resumeWords,
	tally,
	tasteBarWords,
	viewOf,
} from "./flow.ts"

const run = (...tallies: Tally[]): FlowState =>
	tallies.reduce(
		(state, t) => ratingFlow(state, { type: "tally", tally: t }),
		INITIAL_FLOW,
	)
const press = (key: string, more: Partial<KeyboardEvent> = {}) => ({
	key,
	repeat: false,
	metaKey: false,
	ctrlKey: false,
	altKey: false,
	...more,
})

test("the rules are the server's: 5 liked titles, liked from 6, a milestone every 10", () => {
	assert.equal(MIN_LIKED, 5)
	assert.equal(LIKED_FROM, 6)
	assert.equal(MILESTONE_EVERY, 10)
})

test("a tally counts every score as rated and 6 or higher as liked", () => {
	assert.deepEqual(tally([5, 6, 10, null, 1, 7]), { rated: 5, liked: 3 })
})

test("the taste is ready at the fifth liked title, and that is a milestone", () => {
	const before = run({ rated: 6, liked: 4 }, { rated: 7, liked: 4 })
	assert.equal(before.milestone, null)
	const ready = ratingFlow(before, { type: "tally", tally: { rated: 8, liked: 5 } })
	assert.deepEqual(ready.milestone, { kind: "ready", rated: 8 })
	assert.equal(ready.lastMilestoneAt, 8)
	assert.deepEqual(justLanded(ready), ready.milestone)
})

test("after the taste is ready a milestone lands every 10 ratings, liked or not", () => {
	let state = run({ rated: 5, liked: 5 })
	assert.equal(state.milestone, null, "ready before the visit is no milestone")
	for (let rated = 6; rated < 15; rated++)
		state = ratingFlow(state, { type: "tally", tally: { rated, liked: 5 } })
	assert.equal(state.milestone, null)
	state = ratingFlow(state, { type: "tally", tally: { rated: 15, liked: 5 } })
	assert.deepEqual(state.milestone, { kind: "picks", rated: 15 })
	assert.equal(state.lastMilestoneAt, 15)
})

test("the taste bar stays lit for 3 ratings, or until the taste view opens", () => {
	let state = run({ rated: 4, liked: 4 }, { rated: 5, liked: 5 })
	assert.equal(litMilestone(state)?.kind, "ready")
	state = ratingFlow(state, { type: "tally", tally: { rated: 5 + MILESTONE_GLOW - 1, liked: 7 } })
	assert.equal(litMilestone(state)?.kind, "ready")
	assert.equal(justLanded(state), null)
	state = ratingFlow(state, { type: "tally", tally: { rated: 5 + MILESTONE_GLOW, liked: 8 } })
	assert.equal(litMilestone(state), null)

	const opened = ratingFlow(run({ rated: 4, liked: 4 }, { rated: 5, liked: 5 }), {
		type: "taste-opened",
	})
	assert.equal(litMilestone(opened), null)
})

test("the same totals again change nothing", () => {
	const state = run({ rated: 3, liked: 2 })
	assert.equal(ratingFlow(state, { type: "tally", tally: { rated: 3, liked: 2 } }), state)
})

test("dropping below the rule takes the taste back, and reaching it again is a milestone again", () => {
	const lost = run({ rated: 5, liked: 5 }, { rated: 5, liked: 4 })
	assert.equal(lost.lastMilestoneAt, null)
	const again = ratingFlow(lost, { type: "tally", tally: { rated: 6, liked: 5 } })
	assert.equal(again.milestone?.kind, "ready")
})

test("the top strip counts liked titles to the taste, then ratings to new picks, and resets", () => {
	const forming = nextStep({ rated: 6, liked: 2 }, null)
	assert.deepEqual(forming, { kind: "liked", done: 2, of: 5, left: 3 })
	assert.equal(nextStepWords(forming), "3 more liked to your taste")
	const after = nextStep({ rated: 26, liked: 9 }, 20)
	assert.deepEqual(after, { kind: "rated", done: 6, of: 10, left: 4 })
	assert.equal(nextStepWords(after), "4 more to new picks")
	assert.equal(nextStep({ rated: 20, liked: 9 }, 20).done, 0)
})

test("the taste bar says the totals, and what liked means until the taste is ready", () => {
	assert.deepEqual(tasteBarWords({ rated: 6, liked: 4 }, null), {
		head: "Your taste",
		line: "6 rated · 4 liked (6 or higher)",
	})
	assert.equal(tasteBarWords({ rated: 6, liked: 5 }, null).line, "6 rated · 5 liked")
	assert.equal(
		tasteBarWords({ rated: 6, liked: 5 }, { kind: "ready", rated: 6 }).head,
		"Your taste is ready",
	)
	assert.equal(
		tasteBarWords({ rated: 16, liked: 9 }, { kind: "picks", rated: 16 }).head,
		"Your picks changed",
	)
})

test("keys: digits score with 0 as 10, H and N mark, held keys and modifiers answer nothing", () => {
	assert.deepEqual(readFlowPress(press("7")), { type: "score", score: 7 })
	assert.deepEqual(readFlowPress(press("0")), { type: "score", score: 10 })
	assert.deepEqual(readFlowPress(press("h")), { type: "unseen" })
	assert.deepEqual(readFlowPress(press("N")), { type: "not-interested" })
	assert.equal(readFlowPress(press("s")), null)
	assert.equal(readFlowPress(press("8", { repeat: true })), "held")
	assert.equal(readFlowPress(press("8", { ctrlKey: true })), null)
	assert.equal(readFlowPress(press("n", { metaKey: true })), null)
})

test("the address opens the taste view, also the old quiz's sign-up return", () => {
	assert.equal(viewOf(new URLSearchParams("view=taste")), "taste")
	assert.equal(viewOf(new URLSearchParams("show=picks")), "taste")
	assert.equal(viewOf(new URLSearchParams("resume=1")), "rate")
})

test("the resume bar: members with ratings and no taste yet, off the flow, until dismissed", () => {
	const forming = { rated: 3, liked: 2 }
	assert.equal(offersResume({ tally: forming, pathname: "/discover", dismissed: false }), true)
	assert.equal(offersResume({ tally: forming, pathname: "/taste/quiz", dismissed: false }), false)
	assert.equal(offersResume({ tally: forming, pathname: "/taste", dismissed: false }), false)
	assert.equal(offersResume({ tally: forming, pathname: "/taste/fingerprint", dismissed: false }), true)
	assert.equal(offersResume({ tally: forming, pathname: "/discover", dismissed: true }), false)
	assert.equal(offersResume({ tally: { rated: 9, liked: 5 }, pathname: "/", dismissed: false }), false)
	assert.equal(offersResume({ tally: { rated: 0, liked: 0 }, pathname: "/", dismissed: false }), false)
	assert.equal(offersResume({ tally: null, pathname: "/", dismissed: false }), false)
	assert.equal(resumeWords(forming), "3 more liked to your taste")
})

test("your ratings: newest first, each title once with its latest score", () => {
	const rows = ratingRows([
		{ key: "movie-1", score: 4, at: 10 },
		{ key: "show-2", score: 8, at: 30 },
		{ key: "movie-1", score: 9, at: 40 },
		{ key: "movie-3", score: 6, at: 0 },
	])
	assert.deepEqual(
		rows.map((r) => [r.key, r.score]),
		[
			["movie-1", 9],
			["show-2", 8],
			["movie-3", 6],
		],
	)
})
