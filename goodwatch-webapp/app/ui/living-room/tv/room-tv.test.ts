// The keyboard's keys on the TV: a held OK presses once.
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { keyboardKey } from "./room-tv.ts"

const down = (key: string, repeat = false) => ({ key, repeat })

describe("the keyboard on the TV", () => {
	it("presses the Remote's keys", () => {
		assert.deepEqual(keyboardKey(down("Enter")), { type: "ok" })
		assert.deepEqual(keyboardKey(down("ArrowLeft")), { type: "move", dir: "left" })
		assert.deepEqual(keyboardKey(down("Escape")), { type: "back" })
		assert.deepEqual(keyboardKey(down("Backspace")), { type: "back" })
		assert.deepEqual(keyboardKey(down("H")), { type: "home" })
		assert.deepEqual(keyboardKey(down("m")), { type: "menu" })
		assert.deepEqual(keyboardKey(down("s")), { type: "search" })
	})

	it("doesn't press OK again while Enter is held: the quiz's next title stays unscored", () => {
		assert.equal(keyboardKey(down("Enter", true)), "held")
		const sequence = [down("Enter"), down("Enter", true), down("Enter", true), down("Enter")]
		assert.equal(
			sequence.map(keyboardKey).filter((key) => key !== "held").length,
			2,
			"one press per time the key went down",
		)
	})

	it("keeps moving while an arrow is held", () => {
		assert.deepEqual(keyboardKey(down("ArrowDown", true)), { type: "move", dir: "down" })
	})

	it("takes no other key", () => {
		assert.equal(keyboardKey(down("x")), null)
		assert.equal(keyboardKey(down("Tab")), null)
	})
})
