// The quiz's keys: a held key answers once.
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readQuizPress } from "./quiz-flow.ts"

const quiz = { screen: "quiz", pickedBefore: true } as const
const picks = { screen: "picks", pickedBefore: true } as const
const down = (key: string, repeat = false) => ({ key, repeat })

describe("a keydown on the quiz", () => {
	it("answers with a fresh press", () => {
		assert.deepEqual(readQuizPress(down("8"), quiz), { type: "score", score: 8 })
		assert.deepEqual(readQuizPress(down("0"), quiz), { type: "score", score: 10 })
		assert.deepEqual(readQuizPress(down("s"), quiz), { type: "skip" })
		assert.deepEqual(readQuizPress(down("p"), quiz), { type: "show-picks" })
	})

	it("answers nothing while the key is held, so the next title isn't scored", () => {
		assert.equal(readQuizPress(down("8", true), quiz), "held")
		assert.equal(readQuizPress(down("s", true), quiz), "held")
		assert.equal(readQuizPress(down("p", true), quiz), "held")
	})

	it("answers again once the key was let go and pressed anew", () => {
		const sequence = [down("8"), down("8", true), down("8", true), down("8")]
		const answers = sequence.map((press) => readQuizPress(press, quiz)).filter((a) => a !== "held")
		assert.deepEqual(answers, [
			{ type: "score", score: 8 },
			{ type: "score", score: 8 },
		])
	})

	it("turns the picks while an arrow is held", () => {
		assert.deepEqual(readQuizPress(down("ArrowRight", true), picks), { type: "turn", by: 1 })
	})

	it("takes no key the quiz doesn't know", () => {
		assert.equal(readQuizPress(down("x"), quiz), null)
		assert.equal(readQuizPress(down("x", true), quiz), null)
	})
})
