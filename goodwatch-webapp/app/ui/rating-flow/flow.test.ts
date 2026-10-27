import assert from "node:assert/strict"
import test from "node:test"
import {
	GUEST_RATING_LIMIT,
	LIKED_FROM,
	MILESTONE_EVERY,
	MIN_LIKED,
	isRatingLocked,
	nextMilestoneAt,
} from "../../domain/taste-rules.ts"
import {
	type FlowState,
	INITIAL_FLOW,
	MILESTONE_GLOW,
	type Tally,
	WANT_GUARD_MS,
	answerWords,
	isLocked,
	justLanded,
	lastAnswered,
	litMilestone,
	nextStep,
	nextStepWords,
	offersResume,
	ratingFlow,
	ratingRows,
	readFlowPress,
	readWantPress,
	resumeWords,
	showsSignUpLine,
	takesWantPress,
	tally,
	tasteBarWords,
	viewOf,
} from "./flow.ts"

const runAs =
	(member: boolean) =>
	(...tallies: Tally[]): FlowState =>
		tallies.reduce(
			(state, t) => ratingFlow(state, { type: "tally", tally: t, member }),
			INITIAL_FLOW,
		)
const run = runAs(false)
const member = runAs(true)
const add = (state: FlowState, t: Tally, isMember = false) =>
	ratingFlow(state, { type: "tally", tally: t, member: isMember })
/** The top strip's next step of a state whose totals are known. */
const stepOf = (state: FlowState, isMember = false) => {
	assert.ok(state.tally)
	return nextStep(state.tally, state.lastMilestoneAt, isMember)
}
const press = (key: string, more: Partial<KeyboardEvent> = {}) => ({
	key,
	repeat: false,
	metaKey: false,
	ctrlKey: false,
	altKey: false,
	...more,
})

test("the rules are the server's: 5 liked titles, liked from 6, guests stop at 20, members' milestones every 10", () => {
	assert.equal(MIN_LIKED, 5)
	assert.equal(LIKED_FROM, 6)
	assert.equal(GUEST_RATING_LIMIT, 20)
	assert.equal(MILESTONE_EVERY, 10)
})

test("the milestone schedule: 5, 10, 15, 20, then every 10 for members and none for guests", () => {
	const schedule = (isMember: boolean, upTo: number) => {
		const out: number[] = []
		for (
			let at = nextMilestoneAt(0, isMember);
			at != null && at <= upTo;
			at = nextMilestoneAt(at, isMember)
		)
			out.push(at)
		return out
	}
	assert.deepEqual(schedule(false, 60), [5, 10, 15, 20])
	assert.deepEqual(schedule(true, 60), [5, 10, 15, 20, 30, 40, 50, 60])
	assert.equal(nextMilestoneAt(7, false), 10)
	assert.equal(nextMilestoneAt(20, false), null)
	assert.equal(nextMilestoneAt(23, true), 30)
	assert.equal(nextMilestoneAt(30, true), 40)
})

test("a guest is locked at 20 ratings, a member never", () => {
	assert.equal(isRatingLocked(19, false), false)
	assert.equal(isRatingLocked(20, false), true)
	assert.equal(isRatingLocked(80, true), false)
	assert.equal(isLocked(null, false), false)
	assert.equal(isLocked({ rated: 20, liked: 2 }, false), true)
})

test("a tally counts every score as rated and 6 or higher as liked", () => {
	assert.deepEqual(tally([5, 6, 10, null, 1, 7]), { rated: 5, liked: 3 })
})

test("the taste is ready at the fifth liked title, and that is a milestone", () => {
	const before = run({ rated: 6, liked: 4 }, { rated: 7, liked: 4 })
	assert.equal(before.milestone, null)
	const ready = add(before, { rated: 8, liked: 5 })
	assert.deepEqual(ready.milestone, { kind: "ready", rated: 8, of: 5 })
	assert.equal(ready.lastMilestoneAt, 8)
	assert.deepEqual(justLanded(ready), ready.milestone)
})

test("after the taste is ready a milestone lands at the next step of the schedule, liked or not", () => {
	let state = run({ rated: 5, liked: 5 })
	assert.equal(state.milestone, null, "ready before the visit is no milestone")
	for (let rated = 6; rated < 10; rated++)
		state = add(state, { rated, liked: 5 })
	assert.equal(state.milestone, null)
	state = add(state, { rated: 10, liked: 5 })
	assert.deepEqual(state.milestone, { kind: "picks", rated: 10, of: 5 })
	assert.equal(state.lastMilestoneAt, 10)
})

test("the first milestone waits for the taste: ready at 7, then picks at 10, 15 and 20", () => {
	const ready = run({ rated: 0, liked: 0 }, { rated: 7, liked: 5 })
	assert.equal(ready.milestone?.kind, "ready")
	assert.deepEqual(stepOf(ready), {
		kind: "rated",
		done: 0,
		of: 3,
		left: 3,
	})
	const ten = add(ready, { rated: 10, liked: 6 })
	assert.deepEqual(ten.milestone, { kind: "picks", rated: 10, of: 3 })
	const twenty = add(add(ten, { rated: 15, liked: 8 }), { rated: 20, liked: 9 })
	assert.deepEqual(twenty.milestone, { kind: "picks", rated: 20, of: 5 })
})

test("a guest has no milestone after 20; a member's go on every 10", () => {
	const guest = run({ rated: 20, liked: 9 })
	assert.deepEqual(stepOf(guest), {
		kind: "done",
		done: 0,
		of: 0,
		left: 0,
	})
	assert.equal(nextStepWords(stepOf(guest)), "Your picks are ready")
	let state = member({ rated: 20, liked: 9 })
	assert.deepEqual(stepOf(state, true), {
		kind: "rated",
		done: 0,
		of: 10,
		left: 10,
	})
	state = add(state, { rated: 29, liked: 12 }, true)
	assert.equal(state.milestone, null)
	state = add(state, { rated: 30, liked: 12 }, true)
	assert.deepEqual(state.milestone, { kind: "picks", rated: 30, of: 10 })
})

test("the taste bar stays lit for 3 ratings, or until the taste view opens", () => {
	let state = run({ rated: 4, liked: 4 }, { rated: 5, liked: 5 })
	assert.equal(litMilestone(state)?.kind, "ready")
	state = add(state, { rated: 5 + MILESTONE_GLOW - 1, liked: 7 })
	assert.equal(litMilestone(state)?.kind, "ready")
	assert.equal(justLanded(state), null)
	state = add(state, { rated: 5 + MILESTONE_GLOW, liked: 8 })
	assert.equal(litMilestone(state), null)

	const opened = ratingFlow(
		run({ rated: 4, liked: 4 }, { rated: 5, liked: 5 }),
		{
			type: "taste-opened",
		},
	)
	assert.equal(litMilestone(opened), null)
})

test("the same totals again change nothing", () => {
	const state = run({ rated: 3, liked: 2 })
	assert.equal(add(state, { rated: 3, liked: 2 }), state)
})

test("dropping below the rule takes the taste back, and reaching it again is a milestone again", () => {
	const lost = run({ rated: 5, liked: 5 }, { rated: 5, liked: 4 })
	assert.equal(lost.lastMilestoneAt, null)
	const again = add(lost, { rated: 6, liked: 5 })
	assert.equal(again.milestone?.kind, "ready")
})

test("the top strip counts liked titles to the taste, then ratings to new picks, and resets", () => {
	const forming = nextStep({ rated: 6, liked: 2 }, null)
	assert.deepEqual(forming, { kind: "liked", done: 2, of: 5, left: 3 })
	assert.equal(nextStepWords(forming), "3 more liked to your taste")
	const after = nextStep({ rated: 26, liked: 9 }, 20, true)
	assert.deepEqual(after, { kind: "rated", done: 6, of: 10, left: 4 })
	assert.equal(nextStepWords(after), "4 more to new picks")
	assert.equal(nextStep({ rated: 20, liked: 9 }, 20, true).done, 0)
	assert.deepEqual(nextStep({ rated: 12, liked: 9 }, 10), {
		kind: "rated",
		done: 2,
		of: 5,
		left: 3,
	})
})

test("the taste bar says the totals, and what liked means until the taste is ready", () => {
	assert.deepEqual(tasteBarWords({ rated: 6, liked: 4 }, null), {
		head: "Your taste",
		line: "6 rated · 4 liked (6 or higher)",
	})
	assert.equal(
		tasteBarWords({ rated: 6, liked: 5 }, null).line,
		"6 rated · 5 liked",
	)
	assert.equal(
		tasteBarWords({ rated: 6, liked: 5 }, { kind: "ready", rated: 6, of: 5 })
			.head,
		"Your taste is ready",
	)
	assert.equal(
		tasteBarWords({ rated: 16, liked: 9 }, { kind: "picks", rated: 16, of: 10 })
			.head,
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
	assert.equal(
		offersResume({ tally: forming, pathname: "/discover", dismissed: false }),
		true,
	)
	assert.equal(
		offersResume({ tally: forming, pathname: "/taste/quiz", dismissed: false }),
		false,
	)
	assert.equal(
		offersResume({ tally: forming, pathname: "/taste", dismissed: false }),
		false,
	)
	assert.equal(
		offersResume({
			tally: forming,
			pathname: "/taste/fingerprint",
			dismissed: false,
		}),
		true,
	)
	assert.equal(
		offersResume({ tally: forming, pathname: "/discover", dismissed: true }),
		false,
	)
	assert.equal(
		offersResume({
			tally: { rated: 9, liked: 5 },
			pathname: "/",
			dismissed: false,
		}),
		false,
	)
	assert.equal(
		offersResume({
			tally: { rated: 0, liked: 0 },
			pathname: "/",
			dismissed: false,
		}),
		false,
	)
	assert.equal(
		offersResume({ tally: null, pathname: "/", dismissed: false }),
		false,
	)
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

test("the quiet sign-up line: guests from 5 ratings until the lock, never members", () => {
	assert.equal(showsSignUpLine(null, false), false)
	assert.equal(showsSignUpLine({ rated: 4, liked: 4 }, false), false)
	assert.equal(showsSignUpLine({ rated: 5, liked: 1 }, false), true)
	assert.equal(showsSignUpLine({ rated: 19, liked: 9 }, false), true)
	assert.equal(showsSignUpLine({ rated: 20, liked: 9 }, false), false)
	assert.equal(showsSignUpLine({ rated: 8, liked: 6 }, true), false)
})

test("Want to See keys: Y or W adds, N says no, Escape or Backspace goes back; nothing else, held or with a modifier", () => {
	assert.equal(readWantPress(press("y")), "yes")
	assert.equal(readWantPress(press("W")), "yes")
	assert.equal(readWantPress(press("n")), "no")
	assert.equal(readWantPress(press("Escape")), "back")
	assert.equal(readWantPress(press("Backspace")), "back")
	assert.equal(readWantPress(press("h")), null)
	assert.equal(readWantPress(press("8")), null)
	assert.equal(readWantPress(press("y", { repeat: true })), null)
	assert.equal(readWantPress(press("y", { metaKey: true })), null)
})

test("Want to See ignores presses right after it appears and a double click's second click", () => {
	assert.equal(takesWantPress(0, 5000, 1), false, "not shown")
	assert.equal(takesWantPress(1000, 1000 + WANT_GUARD_MS - 1, 1), false)
	assert.equal(takesWantPress(1000, 1000 + WANT_GUARD_MS, 1), true)
	assert.equal(takesWantPress(1000, 2000, 2), false)
	assert.equal(takesWantPress(1000, 2000, 0), true, "a key press on the button")
})

test("the top row: the newest answers with known titles, each title once", () => {
	const known = new Set(["movie-1", "movie-2", "show-3", "movie-4"])
	const answers = [
		{
			media_type: "movie",
			tmdb_id: 1,
			type: "score" as const,
			score: 8,
			timestamp: 10,
		},
		{ media_type: "movie", tmdb_id: 9, type: "skip" as const, timestamp: 50 },
		{ media_type: "movie", tmdb_id: 2, type: "plan" as const, timestamp: 20 },
		{
			media_type: "show",
			tmdb_id: 3,
			type: "not-interested" as const,
			timestamp: 30,
		},
		{
			media_type: "movie",
			tmdb_id: 1,
			type: "score" as const,
			score: 6,
			timestamp: 40,
		},
		{ media_type: "movie", tmdb_id: 4, type: "skip" as const, timestamp: 5 },
	]
	assert.deepEqual(
		lastAnswered(answers, known).map((a) => [a.tmdb_id, a.score ?? a.type]),
		[
			[1, 6],
			[3, "not-interested"],
			[2, "plan"],
		],
	)
	assert.equal(lastAnswered([], known).length, 0)
	assert.equal(answerWords({ type: "score", score: 8 }), "Scored 8")
	assert.equal(answerWords({ type: "plan" }), "Want to See")
	assert.equal(answerWords({ type: "skip" }), "Haven't seen it")
	assert.equal(answerWords({ type: "not-interested" }), "Not interested")
})

test("clearing a score below the last milestone takes it back: the glow ends, the strip steps back, and it lands again", () => {
	// 19 → 20: the milestone at 20 lands; clearing one goes back to 19.
	let state = run({ rated: 15, liked: 8 }, { rated: 19, liked: 9 })
	state = add(state, { rated: 20, liked: 9 })
	assert.deepEqual(state.milestone, { kind: "picks", rated: 20, of: 5 })
	state = add(state, { rated: 19, liked: 9 })
	assert.equal(state.milestone, null)
	assert.equal(litMilestone(state), null)
	assert.equal(state.lastMilestoneAt, 15)
	assert.deepEqual(stepOf(state), { kind: "rated", done: 4, of: 5, left: 1 })
	assert.equal(nextStepWords(stepOf(state)), "1 more to new picks")
	// Scoring again lands the 20 milestone again.
	state = add(state, { rated: 20, liked: 10 })
	assert.deepEqual(state.milestone, { kind: "picks", rated: 20, of: 5 })
	assert.deepEqual(litMilestone(state), state.milestone)
	assert.equal(nextStepWords(stepOf(state)), "Your picks are ready")
})

test("a guest's lock at 20 follows the totals: unlocked at 19 after a clear, locked again at 20", () => {
	let state = run({ rated: 15, liked: 8 }, { rated: 20, liked: 9 })
	assert.equal(isLocked(state.tally, false), true)
	state = add(state, { rated: 19, liked: 9 })
	assert.equal(isLocked(state.tally, false), false)
	assert.equal(nextStepWords(stepOf(state)), "1 more to new picks")
	state = add(state, { rated: 20, liked: 9 })
	assert.equal(isLocked(state.tally, false), true)
	assert.equal(state.milestone?.rated, 20)
	assert.equal(nextStepWords(stepOf(state)), "Your picks are ready")
})

test("a member's cleared score below a later milestone steps back on the schedule", () => {
	let state = member({ rated: 20, liked: 9 }, { rated: 29, liked: 12 })
	state = add(state, { rated: 30, liked: 12 }, true)
	assert.equal(state.milestone?.rated, 30)
	state = add(state, { rated: 29, liked: 12 }, true)
	assert.equal(state.milestone, null)
	assert.equal(state.lastMilestoneAt, 20)
	state = add(state, { rated: 30, liked: 13 }, true)
	assert.deepEqual(state.milestone, { kind: "picks", rated: 30, of: 10 })
	// Ready at 7, then a cleared unliked score: still ready, back to the step at 5.
	let ready = run({ rated: 6, liked: 4 }, { rated: 7, liked: 5 })
	assert.equal(ready.milestone?.kind, "ready")
	ready = add(ready, { rated: 6, liked: 5 })
	assert.equal(ready.milestone, null)
	assert.equal(ready.lastMilestoneAt, 5)
	assert.equal(add(ready, { rated: 7, liked: 5 }).milestone, null)
})
