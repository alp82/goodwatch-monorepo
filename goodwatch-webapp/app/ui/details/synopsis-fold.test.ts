import assert from "node:assert/strict"
import { test } from "node:test"
import { foldSynopsis, splitLead } from "./synopsis-fold.ts"

const words = (n: number, w = "word") =>
	Array.from({ length: n }, () => w).join(" ")

test("a short synopsis shows whole", () => {
	const text = `${words(30)}. ${words(25)}.`
	assert.deepEqual(foldSynopsis(text), { shown: text, hidden: "", cut: false })
})

test("a long synopsis folds after whole sentences of about 40 words", () => {
	const a = `First ${words(19)}.`
	const b = `Second ${words(19)}.`
	const c = `Third ${words(39)}.`
	const { shown, hidden, cut } = foldSynopsis(`${a} ${b} ${c}`)
	assert.equal(shown, `${a} ${b}`)
	assert.equal(hidden, c)
	assert.equal(cut, false)
})

test("it doesn't fold when fewer than 25 words would stay hidden", () => {
	const text = `First ${words(39)}. Second ${words(9)}. Third ${words(10)}.`
	assert.equal(foldSynopsis(text).hidden, "")
})

test("the lead skips abbreviations and too-short sentences", () => {
	const [lead, rest] = splitLead(
		"Dr. Smith travels to the U.S. to find the missing professor of history. He fails.",
	)
	assert.equal(
		lead,
		"Dr. Smith travels to the U.S. to find the missing professor of history.",
	)
	assert.equal(rest, "He fails.")
})
