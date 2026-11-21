import assert from "node:assert/strict"
import { test } from "node:test"
import "../title-filter/test-alias.ts"

const { markedFor, unmarked } = await import("./page-marks.ts")

const card = (key: number, seen = false) => ({
	key,
	title: "x",
	seen,
	wantToSee: seen,
	notInterested: false,
})

test("a cached page carries no viewer's marks, and each viewer gets their own on a copy", () => {
	const built = {
		lists: [{ rows: [{ title: { card: card(1, true), to: "/a" } }] }],
		lede: "hi",
		n: 3,
	}
	const neutral = unmarked(built)
	assert.equal(neutral.lists[0].rows[0].title.card.seen, false)
	assert.equal(neutral.lists[0].rows[0].title.card.wantToSee, false)
	assert.equal(built.lists[0].rows[0].title.card.seen, true, "the build itself is not changed")
	const ctx = {
		seen: new Set([1]),
		wishlist: new Map(),
		notInterested: new Set<number>(),
	} as unknown as Parameters<typeof markedFor>[1]
	const mine = markedFor(neutral, ctx)
	assert.equal(mine.lists[0].rows[0].title.card.seen, true)
	assert.equal(mine.lists[0].rows[0].title.card.wantToSee, false)
	assert.equal(neutral.lists[0].rows[0].title.card.seen, false, "the cached page stays neutral")
	assert.equal(mine.lede, "hi")
	assert.equal(mine.n, 3)
})
