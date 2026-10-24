import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"

type Answer = { text: string; pressed: string | null; suggested: boolean }
type Step = { step: string; current: boolean; done: boolean; note: string }
type Left = { kind: string; line: string; label: string }
type Post = { url: string; body: unknown }
type Snap = {
	heading: string | null
	counter: string | null
	answers: Answer[]
	strip: string | null
	stripNote: string | null
	laterOffered: boolean
	text: string
}
type Run = {
	choose: string
	first: Snap
	firstSteps: Step[]
	confirms: Post[]
	locking: Answer[]
	second: Snap
	perTitle: Post[]
	allAnswers: Answer[]
	third: Snap
	sameForAll: Post[]
	later: Snap & { sent: Post[] }
	done: Snap & { left: Left[]; steps: Step[] }
	reopened: Snap
	refused: Snap & { error: string; sent: Post[] }
	finished: Snap & { left: Left[]; steps: Step[]; sent: Post[] }
}

const results = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/imports/import-questions-interaction.test-support.tsx",
		],
		{ encoding: "utf8" },
	)
		.split("__IMPORT_QUESTIONS__")
		.at(-1) ?? "",
) as {
	run: Run
	revisit: Snap & { left: Left[]; undo: boolean }
	oldPreview: Snap & { confirms: Post[] }
	imdb: { first: Snap; confirms: Post[]; decided: Post[]; second: Snap }
	seasonWish: {
		heading: string
		confirms: Post[]
		slotsBefore: string[]
		slotsAfter: string[]
		decided: Post[]
		next: Snap
		row: string
	}
	split: {
		first: string
		batches: { count: number; first: number; last: number }[]
		heldLeft: number
		next: string
	}
	pending: {
		asked: string
		laterWhilePending: boolean
		afterLaterClick: string
		settled: Snap & { error: string }
		laterAfter: boolean
	}
	otherTab: {
		firstFocused: boolean
		tickedFirst: boolean
		swapped: { heading: string; ticked: boolean; focused: boolean }
		decided: Post[]
		next: string
		nextFocused: boolean
	}
	stalePoll: { asked: string; final: Snap & { left: Left[] } }
}
const { run } = results
const DECIDE = "/api/imports/00000000-0000-4000-8000-0000000000aa/decide"
const done = (steps: Step[]) => steps.find((item) => item.step === "Done")
const pressed = (answers: Answer[]) => answers.map((answer) => answer.pressed)

test("Import starts the import right after Choose, asking every question the preview counts that the server takes", () => {
	assert.equal(run.choose, "What should come in?")
	assert.deepEqual(run.confirms, [
		{
			url: "/api/imports/00000000-0000-4000-8000-0000000000aa/confirm",
			body: {
				kinds: ["rating", "want", "review"],
				conflictChoice: "keep",
				watchDates: "preserve",
				ask: ["conflict", "rewatch"],
			},
		},
	])
	assert.equal(run.first.strip, "running", "the progress strip runs above")
	assert.equal(
		run.firstSteps.find((item) => item.current)?.step,
		"Import",
		"the stepper is on Import while questions come",
	)
})

test("questions come one title per screen from the held rows, with one counter and Decide later", () => {
	assert.equal(
		run.first.heading,
		"You gave Heat an 8 in GoodWatch. Trakt has 9. Keep your 8?",
	)
	assert.equal(run.first.counter, "Question 1 of 4")
	assert.ok(run.first.laterOffered)
	assert.match(run.first.text, /Nothing here changes until you answer\./)
	assert.match(run.first.text, /2 entries for this title follow this answer\./)
	assert.match(run.first.text, /Same answer for all 3/)
	assert.equal(run.first.stripNote, "4 questions left")
	assert.equal(
		run.second.heading,
		"You gave Alien a 7 in GoodWatch. Trakt has 10. Keep your 7?",
	)
	assert.equal(run.second.counter, "Question 2 of 4")
	assert.equal(
		run.third.heading,
		"1 title in your Trakt file is already Seen. Add it to Want to rewatch?",
	)
	assert.equal(run.third.counter, "Question 4 of 4")
})

test("no answer is picked for the member; the suggested one only says so", () => {
	for (const screen of [run.first, run.second, run.third, run.reopened])
		assert.deepEqual(pressed(screen.answers), ["false", "false"])
	assert.deepEqual(
		run.first.answers.map((answer) => [answer.text, answer.suggested]),
		[
			["Yes, keep my 8", true],
			["No, use Trakt's 9", false],
		],
	)
	assert.deepEqual(
		run.third.answers.map((answer) => [answer.text, answer.suggested]),
		[
			["Yes, add to Want to rewatch", false],
			["No, leave it as Seen", true],
		],
	)
})

test("a title's answer locks in and posts that title's rows only", () => {
	assert.deepEqual(pressed(run.locking), ["true", "false"])
	assert.deepEqual(run.perTitle, [
		{
			url: DECIDE,
			body: { question: "conflict", answer: "keep", rows: [0, 1] },
		},
	])
})

test("Same answer for all posts the question without rows", () => {
	assert.deepEqual(
		run.allAnswers.map((answer) => answer.text),
		["Yes, keep my GoodWatch scores", "No, use Trakt's scores"],
	)
	assert.deepEqual(run.sameForAll, [
		{ url: DECIDE, body: { question: "conflict", answer: "source" } },
	])
	assert.equal(
		run.third.stripNote,
		"1 question left · 2 from your answers coming in",
	)
})

test("Decide later sends nothing; the run says what waits, and Done lists it with a Decide button and no tick", () => {
	assert.deepEqual(run.later.sent, [])
	assert.equal(run.later.heading, "1 question waits for the end")
	assert.match(run.later.text, /Nothing from it changes until you answer\./)
	assert.equal(run.done.heading, "3 titles are in GoodWatch")
	assert.match(run.done.text, /1 left to decide/)
	assert.deepEqual(run.done.left, [
		{
			kind: "rewatch",
			line: "1 title stays Seen, not on Want to rewatch.",
			label: "Decide: 1 Seen title on your wishlist",
		},
	])
	assert.equal(done(run.done.steps)?.done, false)
	assert.equal(done(run.done.steps)?.note, "1 to decide")
	assert.match(
		run.done.text,
		/Undo this import/,
		"Undo works while questions wait",
	)
})

test("Decide reopens the question; a refused answer stays unpicked with the reason, then Done ticks once nothing waits", () => {
	assert.equal(run.reopened.heading, run.third.heading)
	assert.equal(run.refused.error, "This import cannot accept answers now.")
	assert.deepEqual(pressed(run.refused.answers), ["false", "false"])
	assert.deepEqual(run.refused.sent, [
		{ url: DECIDE, body: { question: "rewatch", answer: "leave" } },
	])
	assert.deepEqual(run.finished.sent, [
		{ url: DECIDE, body: { question: "rewatch", answer: "leave" } },
	])
	assert.equal(run.finished.heading, "Done. 3 titles are in GoodWatch")
	assert.deepEqual(run.finished.left, [])
	assert.equal(done(run.finished.steps)?.done, true)
})

test("an import opened later shows Done with what's left to decide, asking nothing on arrival", () => {
	const { revisit } = results
	assert.equal(revisit.counter, null)
	assert.deepEqual(
		revisit.left.map((item) => item.kind),
		["rewatch"],
	)
	assert.ok(revisit.undo)
})

test("an older preview without question counts asks before the import starts", () => {
	const { oldPreview } = results
	assert.equal(oldPreview.counter, "Question 1 of 1")
	assert.match(
		oldPreview.heading ?? "",
		/differ from what you have in GoodWatch/,
	)
	assert.equal(oldPreview.laterOffered, false)
	assert.deepEqual(oldPreview.confirms, [])
})

test("IMDb ratings start with ask, then each differing score is decided by its rows", () => {
	const { imdb } = results
	assert.deepEqual(imdb.confirms, [
		{
			url: "/api/imdb-import/00000000-0000-4000-8000-0000000000bb/confirm",
			body: { conflictChoice: "ask" },
		},
	])
	assert.equal(
		imdb.first.heading,
		"You gave Heat an 8 in GoodWatch. IMDb has 10. Keep your 8?",
	)
	assert.equal(imdb.first.counter, "Question 1 of 2")
	assert.deepEqual(pressed(imdb.first.answers), ["false", "false"])
	assert.deepEqual(imdb.decided, [
		{
			url: "/api/imdb-import/00000000-0000-4000-8000-0000000000bb/decide",
			body: { answer: "imdb", rows: [0] },
		},
	])
	assert.equal(
		imdb.second.heading,
		"You gave Alien a 6 in GoodWatch. IMDb has 9. Keep your 6?",
	)
	assert.equal(imdb.second.counter, "Question 2 of 2")
})

test("a season wish for a show already Seen is asked about rewatch after the whole show, never left silently", () => {
	const { seasonWish } = results
	assert.deepEqual(seasonWish.confirms[0]?.body, {
		kinds: ["want"],
		conflictChoice: "keep",
		watchDates: "preserve",
		ask: ["conflict", "rewatch", "wholeShow"],
	})
	assert.match(seasonWish.heading, /lists seasons or episodes of 1 show/)
	assert.deepEqual(seasonWish.decided, [
		{ url: DECIDE, body: { question: "wholeShow", answer: "add" } },
	])
	assert.equal(seasonWish.row, "waiting:rewatch")
	assert.equal(
		seasonWish.next.heading,
		"1 title in your MDBList account is already Seen. Add it to Want to rewatch?",
	)
})

test("the example posters keep their place while the held rows load", () => {
	const { seasonWish } = results
	assert.deepEqual(seasonWish.slotsBefore, [""], "a blank slot from the start")
	assert.deepEqual(seasonWish.slotsAfter, ["Breaking Bad"])
})

test("a title whose rows go past the loaded page is answered for all of its rows, in batches of 500", () => {
	const { split } = results
	assert.equal(
		split.first,
		"You gave Heat an 8 in GoodWatch. Trakt has 9. Keep your 8?",
	)
	assert.deepEqual(split.batches, [
		{ count: 500, first: 0, last: 698 },
		{ count: 101, first: 699, last: 799 },
	])
	assert.equal(split.heldLeft, 0, "none of Heat's rows waits any more")
	assert.equal(
		split.next,
		"You gave Film 1 a 7 in GoodWatch. Trakt has 6. Keep your 7?",
	)
})

test("Decide later waits while an answer is on its way; a refused answer keeps its question and the reason", () => {
	const { pending } = results
	assert.equal(pending.laterWhilePending, true)
	assert.equal(pending.afterLaterClick, pending.asked)
	assert.equal(pending.settled.heading, pending.asked)
	assert.equal(pending.settled.error, "This import cannot accept answers now.")
	assert.deepEqual(pressed(pending.settled.answers), ["false", "false"])
	assert.equal(pending.laterAfter, false)
})

test("a title answered in another tab: the next screen starts without Same answer for all, and focus stays", () => {
	const { otherTab } = results
	assert.equal(
		otherTab.firstFocused,
		true,
		"Import moves focus to the question",
	)
	assert.equal(otherTab.tickedFirst, true)
	assert.equal(
		otherTab.swapped.heading,
		"You gave Alien a 7 in GoodWatch. Trakt has 10. Keep your 7?",
	)
	assert.equal(otherTab.swapped.ticked, false)
	assert.equal(otherTab.swapped.focused, false)
	assert.deepEqual(otherTab.decided, [
		{
			url: DECIDE,
			body: { question: "conflict", answer: "keep", rows: [2] },
		},
	])
	assert.equal(
		otherTab.next,
		"You gave Brazil a 9 in GoodWatch. Trakt has 6. Keep your 9?",
	)
	assert.equal(otherTab.nextFocused, true, "the member's answer moves focus")
})

test("a progress read older than an answer can't undo it or stop the polling", () => {
	const { stalePoll } = results
	assert.equal(
		stalePoll.asked,
		"1 title in your Trakt file is already Seen. Add it to Want to rewatch?",
	)
	assert.equal(stalePoll.final.heading, "Done. 3 titles are in GoodWatch")
	assert.deepEqual(stalePoll.final.left, [])
})
