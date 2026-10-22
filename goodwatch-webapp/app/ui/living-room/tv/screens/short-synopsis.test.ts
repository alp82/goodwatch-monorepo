import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shortSynopsis } from "./short-synopsis.ts"

describe("shortSynopsis", () => {
	it("keeps a synopsis that fits", () => {
		assert.equal(
			shortSynopsis("A thief steals dreams."),
			"A thief steals dreams.",
		)
	})
	it("takes the first sentence where it fits", () => {
		const text = `A team of explorers travel through a wormhole. ${"More words follow here. ".repeat(6)}`
		assert.equal(
			shortSynopsis(text),
			"A team of explorers travel through a wormhole.",
		)
	})
	it("else ends at a whole word within the limit, with an ellipsis", () => {
		const out = shortSynopsis(`${"word ".repeat(40)}end.`)
		assert.ok(out.length <= 88)
		assert.ok(out.endsWith("word…"))
	})
	it("folds runs of white space", () => {
		assert.equal(shortSynopsis("One\n\n two   three."), "One two three.")
	})
})
