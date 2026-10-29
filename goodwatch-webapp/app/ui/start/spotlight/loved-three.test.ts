// The three titles a guest loved on the start page (loved-three.ts), with a progress store in memory.
import assert from "node:assert/strict"
import { test } from "node:test"
import {
	LOVED_SCORE,
	type LovedStore,
	type LovedTitle,
	createLovedThree,
} from "./loved-three.ts"

const title = (id: number, media_type: "movie" | "show" = "movie") => ({
	key: (media_type === "movie" ? 1e12 : 2e12) + id,
	media_type,
	tmdb_id: id,
})

/** A progress store as a map of scores, refusing past `limit` scores (the guest's 20). */
function memoryStore(limit = 20, start: Record<string, number> = {}) {
	const scores = new Map(Object.entries(start))
	const name = (t: LovedTitle) => `${t.media_type}:${t.tmdb_id}`
	const store: LovedStore<number | undefined> = {
		snapshot: (t) => scores.get(name(t)),
		love: (t) => {
			if (!scores.has(name(t)) && scores.size >= limit) return false
			scores.set(name(t), LOVED_SCORE)
			return true
		},
		restore: (t, before) => {
			if (before === undefined) scores.delete(name(t))
			else scores.set(name(t), before)
		},
	}
	return { store, scores }
}

const setup = (limit?: number, start?: Record<string, number>) => {
	const { store, scores } = memoryStore(limit, start)
	const changes: string[][] = []
	const three = createLovedThree<LovedTitle, number | undefined>({
		store,
		onChange: (loved) =>
			changes.push(loved.map((t) => `${t.media_type}:${t.tmdb_id}`)),
	})
	const keys = () => three.loved().map((t) => `${t.media_type}:${t.tmdb_id}`)
	return { three, scores, changes, keys }
}

test("a loved title is saved as a 9, and undoing removes it", () => {
	const { three, scores, keys } = setup()
	assert.equal(three.toggle(title(1)), "loved")
	assert.equal(scores.get("movie:1"), 9)
	assert.deepEqual(keys(), ["movie:1"])
	assert.equal(three.toggle(title(1)), "undone")
	assert.equal(scores.has("movie:1"), false)
	assert.deepEqual(keys(), [])
})

test("undo puts back a score the guest had before", () => {
	const { three, scores } = setup(20, { "show:5": 6 })
	three.toggle(title(5, "show"))
	assert.equal(scores.get("show:5"), 9)
	three.toggle(title(5, "show"))
	assert.equal(scores.get("show:5"), 6)
})

test("fewer than three carry across choices", () => {
	const { three, keys } = setup()
	three.toggle(title(1))
	three.toggle(title(2))
	three.choice()
	three.choice()
	assert.deepEqual(keys(), ["movie:1", "movie:2"])
})

test("a fourth is refused", () => {
	const { three, scores, keys } = setup()
	for (const id of [1, 2, 3]) three.toggle(title(id))
	assert.equal(three.toggle(title(4)), "full")
	assert.equal(scores.has("movie:4"), false)
	assert.deepEqual(keys(), ["movie:1", "movie:2", "movie:3"])
})

test("once three are loved, a new choice starts over and the scores stay", () => {
	const { three, scores, keys } = setup()
	for (const id of [1, 2, 3]) three.toggle(title(id))
	three.choice()
	assert.deepEqual(keys(), [])
	assert.deepEqual([...scores.values()], [9, 9, 9])
	// The three start again from nothing.
	assert.equal(three.toggle(title(4)), "loved")
	assert.deepEqual(keys(), ["movie:4"])
	// A title loved before the reset is loved again, its score unchanged.
	three.toggle(title(1))
	assert.equal(scores.get("movie:1"), 9)
})

test("a title the store refuses (the guest's 20 ratings) isn't loved", () => {
	const { three, keys } = setup(1, { "movie:99": 7 })
	assert.equal(three.toggle(title(1)), "refused")
	assert.deepEqual(keys(), [])
	// A title the guest already scored can be loved past the limit: it's a change, not a new rating.
	assert.equal(three.toggle(title(99)), "loved")
})

test("reset empties the slots and tells the page once", () => {
	const { three, changes } = setup()
	three.toggle(title(1))
	three.reset()
	three.reset()
	assert.deepEqual(changes, [["movie:1"], []])
})
