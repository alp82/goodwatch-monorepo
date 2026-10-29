import assert from "node:assert/strict"
import { test } from "node:test"
import { createAgeCommit } from "./age-commit.ts"

test("only the latest free-age edit commits after resting for 300 ms", (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	const pending = createAgeCommit()
	const committed: number[] = []
	const commit = (age: number) => committed.push(age)
	pending.schedule(12, commit)
	t.mock.timers.tick(200)
	pending.schedule(14, commit)
	t.mock.timers.tick(299)
	assert.deepEqual(committed, [])
	t.mock.timers.tick(1)
	assert.deepEqual(committed, [14])
	t.mock.timers.tick(300)
	assert.deepEqual(committed, [14])
})

test("cancelling a draft preserves a direct choice, including an already-Off choice", (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	const pending = createAgeCommit()
	let limit: number | undefined
	for (const choice of [undefined, 7]) {
		pending.schedule(12, (age) => {
			limit = age
		})
		t.mock.timers.tick(200)
		pending.cancel()
		limit = choice
		t.mock.timers.tick(300)
		assert.equal(limit, choice)
	}
})

test("cancellation on external changes or unmount discards the draft and allows later edits", (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	const pending = createAgeCommit()
	const committed: number[] = []
	const commit = (age: number) => committed.push(age)
	pending.schedule(12, commit)
	pending.cancel()
	pending.cancel()
	t.mock.timers.tick(300)
	assert.deepEqual(committed, [])
	pending.schedule(16, commit)
	t.mock.timers.tick(300)
	assert.deepEqual(committed, [16])
})
