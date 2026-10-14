import assert from "node:assert/strict"
import { test } from "node:test"
import {
	BROWSER,
	type PreferenceEvent,
	type PreferenceState,
	changes,
	initialState,
	intended,
	isPending,
	onScreen,
	reduce,
} from "./machine.ts"

const saved = { country: "DE", language: BROWSER }
const run = (events: PreferenceEvent[], start = initialState(saved)) =>
	events.reduce(reduce, start)

test("a pick previews without saving, and Undo before Keep returns to what is saved", () => {
	const picked = run([{ type: "pickCountry", country: "JP" }])
	assert.deepEqual(intended(picked), { country: "JP", language: BROWSER })
	assert.deepEqual(picked.saved, saved)
	assert.equal(isPending(picked), true)
	const undone = reduce(picked, { type: "discard" })
	assert.equal(isPending(undone), false)
	assert.deepEqual(intended(undone), saved)
})

test("picking the saved value again is no change", () => {
	const state = run([
		{ type: "pickCountry", country: "JP" },
		{ type: "pickCountry", country: "DE" },
	])
	assert.equal(isPending(state), false)
	assert.deepEqual(state.preview, {})
})

test("an explicit language survives later country picks", () => {
	const state = run([
		{ type: "pickLanguage", language: "fr" },
		{ type: "pickCountry", country: "JP", offers: ["ja"] },
		{ type: "pickCountry", country: "ES", offers: ["es"] },
	])
	assert.deepEqual(intended(state), { country: "ES", language: "fr" })
	assert.deepEqual(state.offers, [], "no offer once a language was picked")
})

test("a country offers its language unticked; ticking it changes the language, a new country clears it", () => {
	const offered = run([{ type: "pickCountry", country: "JP", offers: ["ja"] }])
	assert.deepEqual(offered.offers, ["ja"])
	assert.equal(offered.companion, null)
	assert.equal(
		intended(offered).language,
		BROWSER,
		"never picked for the visitor",
	)
	const ticked = reduce(offered, { type: "tickCompanion", language: "ja" })
	assert.deepEqual(intended(ticked), { country: "JP", language: "ja" })
	const moved = reduce(ticked, {
		type: "pickCountry",
		country: "CH",
		offers: ["de", "fr", "it"],
	})
	assert.equal(moved.companion, null)
	assert.deepEqual(moved.offers, ["de", "fr", "it"])
	assert.equal(intended(moved).language, BROWSER)
})

test("only an offered language can be ticked, and a language pick replaces the offer", () => {
	const offered = run([
		{ type: "pickCountry", country: "CH", offers: ["de", "fr"] },
	])
	assert.equal(
		reduce(offered, { type: "tickCompanion", language: "ja" }),
		offered,
	)
	const radio = reduce(offered, { type: "tickCompanion", language: "fr" })
	assert.equal(
		reduce(radio, { type: "tickCompanion", language: null }).companion,
		null,
		"No change",
	)
	const replaced = reduce(radio, { type: "pickLanguage", language: "it" })
	assert.deepEqual(replaced.offers, [])
	assert.deepEqual(intended(replaced), { country: "CH", language: "it" })
})

test("the saved language is never offered, and a country back to the saved one drops the offer", () => {
	const start = initialState({ country: "DE", language: "ja" })
	assert.deepEqual(
		run([{ type: "pickCountry", country: "JP", offers: ["ja"] }], start).offers,
		[],
	)
	const back = run(
		[
			{ type: "pickCountry", country: "FR", offers: ["fr"] },
			{ type: "tickCompanion", language: "fr" },
			{ type: "pickCountry", country: "DE", offers: ["de"] },
		],
		start,
	)
	assert.equal(isPending(back), false)
})

test("Keep sends the whole intended pair once, and nothing changes while it saves", () => {
	const saving = run([
		{ type: "pickCountry", country: "JP", offers: ["ja"] },
		{ type: "tickCompanion", language: "ja" },
		{ type: "keep" },
	])
	assert.equal(saving.status, "saving")
	assert.deepEqual(saving.request, {
		seq: 1,
		pair: { country: "JP", language: "ja" },
		kind: "keep",
	})
	for (const event of [
		{ type: "pickCountry", country: "FR" },
		{ type: "pickLanguage", language: "fr" },
		{ type: "tickCompanion", language: null },
		{ type: "discard" },
		{ type: "keep" },
		{ type: "undoSaved" },
	] satisfies PreferenceEvent[])
		assert.equal(
			reduce(saving, event),
			saving,
			`${event.type} is ignored while saving`,
		)
})

test("Keep with nothing to save does nothing", () => {
	const state = initialState(saved)
	assert.equal(reduce(state, { type: "keep" }), state)
})

test("a successful Keep saves the pair and offers Undo of the whole pair", () => {
	const done = run([
		{ type: "pickCountry", country: "JP" },
		{ type: "pickLanguage", language: "ja" },
		{ type: "keep" },
		{ type: "saveSucceeded", seq: 1, pair: { country: "JP", language: "ja" } },
	])
	assert.equal(done.status, "saved")
	assert.deepEqual(done.saved, { country: "JP", language: "ja" })
	assert.equal(isPending(done), false)
	assert.deepEqual(done.undoTo, saved)

	const undoing = reduce(done, { type: "undoSaved" })
	assert.equal(undoing.status, "saving")
	assert.deepEqual(undoing.request, { seq: 2, pair: saved, kind: "undo" })
	const undone = reduce(undoing, { type: "saveSucceeded", seq: 2, pair: saved })
	assert.deepEqual(undone.saved, saved)
	assert.equal(undone.undoTo, null, "an Undo is not undone again")
	assert.equal(isPending(undone), false)
})

test("the saved pair is what the save answered, not what was asked", () => {
	const done = run([
		{ type: "pickLanguage", language: "ja" },
		{ type: "keep" },
		{ type: "saveSucceeded", seq: 1, pair: { country: "DE", language: "ja" } },
	])
	assert.deepEqual(done.saved, { country: "DE", language: "ja" })
})

test("a failed Keep keeps the preview and the saved pair; Retry sends it again", () => {
	const failed = run([
		{ type: "pickCountry", country: "JP" },
		{ type: "keep" },
		{ type: "saveFailed", seq: 1 },
	])
	assert.equal(failed.status, "failed")
	assert.deepEqual(failed.saved, saved)
	assert.deepEqual(intended(failed), { country: "JP", language: BROWSER })
	const retry = reduce(failed, { type: "keep" })
	assert.deepEqual(retry.request, {
		seq: 2,
		pair: { country: "JP", language: BROWSER },
		kind: "keep",
	})
})

test("after a failure, Undo still returns to what is saved", () => {
	const failed = run([
		{ type: "pickCountry", country: "JP" },
		{ type: "keep" },
		{ type: "saveFailed", seq: 1 },
		{ type: "discard" },
	])
	assert.equal(failed.status, "idle")
	assert.equal(isPending(failed), false)
})

test("a failed Undo of a kept change shows the old pair as an unsaved preview to retry", () => {
	const kept = run([
		{ type: "pickCountry", country: "JP" },
		{ type: "keep" },
		{
			type: "saveSucceeded",
			seq: 1,
			pair: { country: "JP", language: BROWSER },
		},
		{ type: "undoSaved" },
		{ type: "saveFailed", seq: 2 },
	])
	assert.equal(kept.status, "failed")
	assert.deepEqual(kept.saved, { country: "JP", language: BROWSER })
	assert.deepEqual(intended(kept), saved)
	assert.deepEqual(changes(kept), { country: true, language: false })
	assert.equal(reduce(kept, { type: "keep" }).request?.kind, "keep")
})

test("stale answers change nothing", () => {
	const saving: PreferenceState = run([
		{ type: "pickCountry", country: "JP" },
		{ type: "keep" },
	])
	assert.equal(
		reduce(saving, {
			type: "saveSucceeded",
			seq: 0,
			pair: { country: "US", language: "en" },
		}),
		saving,
	)
	assert.equal(reduce(saving, { type: "saveFailed", seq: 7 }), saving)
	const idle = reduce(saving, { type: "saveFailed", seq: 1 })
	// The same answer arriving twice, or after the visitor moved on, is over.
	assert.equal(
		reduce(idle, {
			type: "saveSucceeded",
			seq: 1,
			pair: { country: "JP", language: BROWSER },
		}),
		idle,
	)
})

test("browser default is a choice of its own: picking it over a saved language is a change", () => {
	const start = initialState({ country: "DE", language: "de" })
	const state = run([{ type: "pickLanguage", language: BROWSER }], start)
	assert.deepEqual(changes(state), { country: false, language: true })
	assert.equal(intended(state).language, BROWSER)
})

test("a saved pair read later replaces the first guess and keeps the preview", () => {
	const state = run([
		{ type: "pickCountry", country: "JP" },
		{
			type: "syncSaved",
			pair: { country: "JP", language: "fr" },
			recorded: true,
		},
	])
	assert.equal(
		isPending(state),
		false,
		"the preview equals the saved country now",
	)
	assert.deepEqual(intended(state), { country: "JP", language: "fr" })
})

test("a conflict adopts the pair saved elsewhere and keeps showing the visitor's pick for Retry", () => {
	const state = run([
		{ type: "pickCountry", country: "JP", offers: ["ja"] },
		{ type: "tickCompanion", language: "ja" },
		{ type: "keep" },
		{
			type: "saveFailed",
			seq: 1,
			conflict: { current: { country: "FR", language: "fr" } },
		},
	])
	assert.equal(state.status, "failed")
	assert.equal(state.conflict, true)
	assert.deepEqual(state.saved, { country: "FR", language: "fr" })
	assert.deepEqual(
		intended(state),
		{ country: "JP", language: "ja" },
		"the page keeps the pick",
	)
	assert.deepEqual(reduce(state, { type: "keep" }).request?.pair, {
		country: "JP",
		language: "ja",
	})
	assert.equal(reduce(state, { type: "keep" }).conflict, false)
})

test("a conflict with the same pair saved elsewhere leaves nothing to save", () => {
	const state = run([
		{ type: "pickLanguage", language: "ja" },
		{ type: "keep" },
		{
			type: "saveFailed",
			seq: 1,
			conflict: { current: { country: "DE", language: "ja" } },
		},
	])
	assert.equal(state.status, "idle")
	assert.equal(isPending(state), false)
	assert.deepEqual(state.saved, { country: "DE", language: "ja" })
})

test("a conflict on the toast's Undo shows the pair from before over the adopted one", () => {
	const state = run([
		{ type: "pickCountry", country: "JP" },
		{ type: "keep" },
		{
			type: "saveSucceeded",
			seq: 1,
			pair: { country: "JP", language: BROWSER },
		},
		{ type: "undoSaved" },
		{
			type: "saveFailed",
			seq: 2,
			conflict: { current: { country: "US", language: "en" } },
		},
	])
	assert.equal(state.status, "failed")
	assert.deepEqual(state.saved, { country: "US", language: "en" })
	assert.deepEqual(intended(state), { country: "DE", language: "en" }, "the Undo changed only the country")
})

test("without a pair on record, picking the guessed values is a change Keep confirms", () => {
	const guess = initialState(saved, false)
	const country = reduce(guess, {
		type: "pickCountry",
		country: "DE",
		offers: ["de"],
	})
	assert.deepEqual(changes(country), { country: true, language: false })
	assert.deepEqual(country.offers, [], "the same country offers nothing")
	const kept = run(
		[{ type: "keep" }, { type: "saveSucceeded", seq: 1, pair: saved }],
		country,
	)
	assert.equal(kept.recorded, true)
	assert.equal(
		isPending(reduce(kept, { type: "pickCountry", country: "DE" })),
		false,
		"once on record, the same value is no change",
	)
	const language = reduce(guess, { type: "pickLanguage", language: BROWSER })
	assert.deepEqual(changes(language), { country: false, language: true })
	assert.equal(isPending(reduce(guess, { type: "discard" })), false)
})

test("a conflict with nothing on record any more keeps the pick as a change to confirm", () => {
	const state = run([
		{ type: "pickLanguage", language: "ja" },
		{ type: "keep" },
		{ type: "saveFailed", seq: 1, conflict: { current: null } },
	])
	assert.equal(state.recorded, false)
	assert.equal(state.status, "failed")
	assert.deepEqual(intended(state), { country: "DE", language: "ja" })
})

test("after a conflict, a value this save did not change follows the pair adopted from elsewhere", () => {
	const state = run([
		{ type: "pickLanguage", language: "it" },
		{ type: "keep" },
		{ type: "saveFailed", seq: 1, conflict: { current: { country: "ES", language: BROWSER } } },
	])
	assert.deepEqual(intended(state), { country: "ES", language: "it" })
	assert.deepEqual(changes(state), { country: false, language: true })
	assert.deepEqual(reduce(state, { type: "keep" }).request?.pair, { country: "ES", language: "it" })
})

// A member with Germany saved opens /movie/1?country=FR: France is the page's view, never saved by a language Keep.
const onFrance = () =>
	run([
		{
			type: "syncSaved",
			pair: { country: "DE", language: BROWSER },
			recorded: true,
			view: "FR",
		},
	], initialState({ country: "FR", language: BROWSER }))

test("the address's country is shown, not saved: a language-only Keep keeps the saved country", () => {
	const page = onFrance()
	assert.deepEqual(onScreen(page), { country: "FR", language: BROWSER })
	assert.equal(isPending(page), false)
	const saving = run([{ type: "pickLanguage", language: "ja" }, { type: "keep" }], page)
	assert.deepEqual(saving.request?.pair, { country: "DE", language: "ja" })
	const kept = reduce(saving, {
		type: "saveSucceeded",
		seq: saving.seq,
		pair: { country: "DE", language: "ja" },
	})
	assert.deepEqual(kept.saved, { country: "DE", language: "ja" })
	assert.deepEqual(onScreen(kept), { country: "FR", language: "ja" }, "the page still shows its address's country")
	assert.deepEqual(kept.undoTo, { country: "DE", language: BROWSER })
})

test("on the address's country, picking the saved one shows it without a question, and a kept country replaces the view", () => {
	const page = onFrance()
	const back = reduce(page, { type: "pickCountry", country: "DE" })
	assert.equal(onScreen(back).country, "DE")
	assert.equal(isPending(back), false)
	assert.equal(onScreen(reduce(back, { type: "discard" })).country, "FR")
	const saving = run([{ type: "pickCountry", country: "JP" }, { type: "keep" }], page)
	assert.deepEqual(saving.request?.pair, { country: "JP", language: BROWSER })
	const kept = reduce(saving, { type: "saveSucceeded", seq: saving.seq, pair: saving.request!.pair })
	assert.equal(kept.view, null)
	assert.equal(onScreen(kept).country, "JP")
})

test("the saved pair read during a save is taken, so the toast's Undo returns to it", () => {
	const saving = run([{ type: "pickLanguage", language: "ja" }, { type: "keep" }])
	const read = reduce(saving, {
		type: "syncSaved",
		pair: { country: "DE", language: "fr" },
		recorded: true,
	})
	assert.equal(read.status, "saving")
	assert.deepEqual(read.request, saving.request, "the save under way is not changed")
	const kept = reduce(read, { type: "saveSucceeded", seq: read.seq, pair: { country: "DE", language: "ja" } })
	assert.deepEqual(kept.undoTo, { country: "DE", language: "fr" })
})
