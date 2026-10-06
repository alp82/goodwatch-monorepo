import "react"
import assert from "node:assert/strict"
import { test } from "node:test"

const { createActiveSections } = await import("./scroll.ts")

test("starts with no active section", () => {
	assert.deepEqual(createActiveSections().get(), [])
})

test("holds the sections on screen in the order they arrived, each once", () => {
	const active = createActiveSections()
	active.enter("overview")
	active.enter("fingerprint")
	active.enter("overview")
	assert.deepEqual(active.get(), ["overview", "fingerprint"])
	active.leave("overview")
	assert.deepEqual(active.get(), ["fingerprint"])
})

test("tells its listeners only when the list changed", () => {
	const active = createActiveSections()
	let calls = 0
	active.subscribe(() => calls++)
	// What the observer's first report does: one section on screen, the others not.
	active.leave("about")
	active.leave("faq")
	assert.equal(calls, 0)
	active.enter("overview")
	assert.equal(calls, 1)
	active.enter("overview")
	assert.equal(calls, 1)
	active.leave("overview")
	assert.equal(calls, 2)
})

test("keeps the same list while nothing changed, so a reader doesn't render again", () => {
	const active = createActiveSections()
	const empty = active.get()
	active.leave("about")
	assert.equal(active.get(), empty)
	active.enter("about")
	const one = active.get()
	active.enter("about")
	assert.equal(active.get(), one)
	assert.notEqual(one, empty)
})

test("a listener that unsubscribed isn't told", () => {
	const active = createActiveSections()
	let calls = 0
	const unsubscribe = active.subscribe(() => calls++)
	unsubscribe()
	active.enter("overview")
	assert.equal(calls, 0)
})
