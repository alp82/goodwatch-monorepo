// The start page's mixes (mixes.ts): a mix is its parts, one mix on at a time, up to three words.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const {
	MIXES,
	activeMix,
	displayPicks,
	isMix,
	leadWord,
	mixLine,
	pickLabel,
	pickMix,
	picksLine,
	tapPick,
} = await import("./mixes.ts")
const { WORD_BY_ID, MAX_PICKS } = await import("~/domain/taste-picker")

test("eight mixes of two or three of the picker's words, as the spec names them", () => {
	assert.equal(MIXES.length, 8)
	assert.deepEqual(
		MIXES.map((m) => [m.name, mixLine(m.id)]),
		[
			["Warm, easy comedies", "Funny · Cozy"],
			["Dark, gritty crime", "Crime & mystery · Scary · Graphic"],
			["Eerie, mind-bending stories", "Trippy · Scary"],
			["Funny love stories", "Romantic · Funny"],
			["Smart, high-stakes action", "Thrilling · Trippy · Fast-paced"],
			["Warm coming-of-age stories", "Coming of age · Cozy"],
			["Moving period dramas", "History · Sad · Slow burn"],
			["Dark fantasy epics", "Fantasy · Sad · Spectacle"],
		],
	)
	for (const mix of MIXES) {
		assert.ok(isMix(mix.id))
		assert.ok(mix.parts.length >= 2 && mix.parts.length <= MAX_PICKS)
		for (const part of mix.parts) assert.ok(WORD_BY_ID[part], part)
	}
	assert.equal(isMix("m:funny"), false)
	assert.equal(isMix("g9"), false)
})

test("a mix is on while all its parts are picked, however they got there", () => {
	assert.equal(activeMix([]), null)
	assert.equal(activeMix(["m:funny"]), null)
	// Picked one by one, in any order, with another word between.
	assert.equal(activeMix(["m:feelgood", "s:talky", "m:funny"])?.id, "g1")
	assert.equal(activeMix(pickMix([], "g2"))?.id, "g2")
})

test("only one mix is on at a time: the one whose parts were all picked first", () => {
	// Funny + Cozy completes g1 at the second pick; Romance then completes g4 at the third.
	assert.equal(activeMix(["m:funny", "m:feelgood", "m:romance"])?.id, "g1")
	assert.equal(activeMix(["m:romance", "m:funny", "m:feelgood"])?.id, "g4")
	assert.deepEqual(displayPicks(["m:romance", "m:funny", "m:feelgood"]), [
		"g4",
		"m:feelgood",
	])
})

test("tapping a mix swaps the one that is on for it, its parts first, other words kept while they fit", () => {
	// Another word stays beside a two-part mix.
	assert.deepEqual(pickMix(["s:animated"], "g1"), [
		"m:funny",
		"m:feelgood",
		"s:animated",
	])
	// The mix that is on comes off by its parts; the latest other words stay.
	assert.deepEqual(pickMix(["m:funny", "m:feelgood", "s:animated"], "g3"), [
		"m:mind",
		"m:scary",
		"s:animated",
	])
	// Two other words, room for one: the latest stays.
	assert.deepEqual(pickMix(["s:animated", "t:war"], "g4"), [
		"m:romance",
		"m:funny",
		"t:war",
	])
	// A three-part mix replaces everything.
	assert.deepEqual(pickMix(["m:funny", "s:animated"], "g7"), [
		"m:history",
		"m:heavy",
		"s:slow",
	])
	// A part both mixes share isn't doubled.
	assert.deepEqual(pickMix(pickMix([], "g3"), "g2"), [
		"m:crime",
		"m:scary",
		"s:graphic",
	])
})

test("tapping the mix that is on removes its parts and keeps the other words", () => {
	assert.deepEqual(pickMix(["m:funny", "m:feelgood", "s:animated"], "g1"), [
		"s:animated",
	])
	assert.deepEqual(pickMix(["m:history", "m:heavy", "s:slow"], "g7"), [])
	// The chip's × is the same tap.
	assert.deepEqual(tapPick(["m:feelgood", "m:funny", "t:war"], "g1"), {
		picks: ["t:war"],
		refused: false,
	})
})

test("unticking a part turns the mix off and keeps the rest", () => {
	const { picks } = tapPick(["m:crime", "m:scary", "s:graphic"], "m:scary")
	assert.deepEqual(picks, ["m:crime", "s:graphic"])
	assert.equal(activeMix(picks), null)
	assert.deepEqual(displayPicks(picks), ["m:crime", "s:graphic"])
})

test("mix tiles are never refused; words are at three", () => {
	const full = ["m:funny", "t:war", "s:slow"]
	assert.deepEqual(tapPick(full, "m:scary"), { picks: full, refused: true })
	for (const mix of MIXES) {
		const r = tapPick(full, mix.id)
		assert.equal(r.refused, false)
		assert.equal(activeMix(r.picks)?.id, mix.id)
		assert.ok(r.picks.length <= MAX_PICKS)
	}
	// A picked word can always come off, and a word fits while there is room.
	assert.deepEqual(tapPick(full, "t:war").picks, ["m:funny", "s:slow"])
	assert.deepEqual(tapPick(["m:funny"], "t:war").picks, ["m:funny", "t:war"])
	// Unknown ids change nothing.
	assert.deepEqual(tapPick(["m:funny"], "m:nope"), {
		picks: ["m:funny"],
		refused: false,
	})
})

test("chips show a whole mix by its name, then the other words", () => {
	const picks = ["s:animated", "m:feelgood", "m:funny"]
	assert.deepEqual(displayPicks(picks), ["g1", "s:animated"])
	assert.equal(picksLine(picks), "Warm, easy comedies · Animated")
	assert.equal(pickLabel("t:war"), "War")
	assert.deepEqual(displayPicks(["t:war", "m:funny"]), ["t:war", "m:funny"])
})

test("the room's lead word: the mix that is on leads with its first part, even when another word came first", () => {
	assert.equal(leadWord([]), null)
	assert.equal(leadWord(["t:war", "m:funny"]), "t:war")
	assert.equal(leadWord(["s:animated", "m:feelgood", "m:funny"]), "m:funny")
	assert.equal(leadWord(pickMix([], "g8")), "t:fantasy")
})
