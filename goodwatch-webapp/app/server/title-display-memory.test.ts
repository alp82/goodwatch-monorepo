import assert from "node:assert/strict"
import { test } from "node:test"
import { createDisplayMemory } from "./title-display-memory.server.ts"

test("missing entries return undefined and hits share the stored value", () => {
	const memory = createDisplayMemory<{ title: string }>()
	assert.equal(memory.get(1), undefined)
	const value = { title: "Title" }
	memory.set(1, value)
	assert.equal(memory.get(1), value)
	assert.equal(memory.size(), 1)
})

test("expired entries are removed without extending expiry on reads", () => {
	let now = 0
	const memory = createDisplayMemory<string>({ ttlMs: 10, now: () => now })
	memory.set(1, "title")
	now = 9
	assert.equal(memory.get(1), "title")
	now = 10
	assert.equal(memory.get(1), undefined)
	assert.equal(memory.size(), 0)
})

test("a read protects an entry from least recently used eviction", () => {
	const memory = createDisplayMemory<string>({ max: 2 })
	memory.set(1, "one")
	memory.set(2, "two")
	assert.equal(memory.get(1), "one")
	memory.set(3, "three")
	assert.equal(memory.size(), 2)
	assert.equal(memory.get(2), undefined)
	assert.equal(memory.get(1), "one")
	assert.equal(memory.get(3), "three")
})

test("overwrite refreshes expiry and marks the entry most recently used", () => {
	let now = 0
	const memory = createDisplayMemory<string>({
		max: 2,
		ttlMs: 10,
		now: () => now,
	})
	memory.set(1, "one")
	memory.set(2, "two")
	now = 5
	memory.set(1, "new")
	memory.set(3, "three")
	assert.equal(memory.get(2), undefined)
	now = 10
	assert.equal(memory.get(1), "new")
	now = 15
	assert.equal(memory.get(1), undefined)
})

test("clear removes every entry", () => {
	const memory = createDisplayMemory<string>()
	memory.set(1, "one")
	memory.set(2, "two")
	memory.clear()
	assert.equal(memory.size(), 0)
	assert.equal(memory.get(1), undefined)
	assert.equal(memory.get(2), undefined)
})
