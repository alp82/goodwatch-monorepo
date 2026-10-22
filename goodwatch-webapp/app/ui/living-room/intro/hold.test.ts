import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { type HoldInput, holdKind, holdState } from "./hold.ts"

const base: HoldInput = {
	member: false,
	boot: false,
	showing: { kind: "home" },
	asked: false,
	shown: false,
	gaveUp: false,
}
const held = { kind: "film", held: true } as const
const resumed = { kind: "film", held: false } as const

describe("the dark hold over the TV's picture", () => {
	it("is up from a guest's first paint while the boot screen plays, and not for a member's", () => {
		assert.equal(holdState({ ...base, showing: null, boot: true }), true)
		assert.equal(holdState({ ...base, showing: null, boot: true, member: true }), false)
		assert.equal(holdState({ ...base, showing: null, boot: false }), false)
	})

	it("rises in the render that asks for the film, for a member too, over whatever the TV shows", () => {
		assert.equal(holdState({ ...base, member: true, asked: true }), true)
		assert.equal(holdState({ ...base, asked: true, showing: { kind: "home" } }), true)
	})

	it("stays up for a held run until its stage is on the picture, then falls", () => {
		for (const member of [false, true]) {
			assert.equal(holdState({ ...base, member, showing: held }), true)
			assert.equal(holdState({ ...base, member, showing: held, shown: true }), false)
		}
	})

	it("is not up for a film that resumes in a returning tab, nor on the TV's home or with the TV off", () => {
		assert.equal(holdState({ ...base, showing: resumed }), false)
		assert.equal(holdState({ ...base, showing: { kind: "home" } }), false)
		assert.equal(holdState({ ...base, showing: { kind: "off" } }), false)
	})

	it("falls when the film never came, whatever asked for it", () => {
		assert.equal(holdState({ ...base, showing: held, gaveUp: true }), false)
		assert.equal(holdState({ ...base, asked: true, gaveUp: true }), false)
	})
})

describe("holdKind: which holds a returning tab's mark may hide", () => {
	it("only the start's: a guest's first paint before the tab decided", () => {
		assert.equal(holdKind(null, false), "start")
	})
	it("never a film's: the render that asks for it, or a held run", () => {
		assert.equal(holdKind(null, true), "run")
		assert.equal(holdKind({ kind: "film", held: true }, false), "run")
		assert.equal(holdKind({ kind: "home" }, true), "run")
	})
})
