// When a late related map asks for its pack (late-wait.ts): near and after the page's navigation work, or at once on a tap.
import assert from "node:assert/strict"
import { test } from "node:test"
import { whenSectionWanted } from "./late-wait.ts"

function harness() {
	const listeners: Record<string, ((event: unknown) => void)[]> = {}
	const section = {
		addEventListener: (type: string, run: (event: unknown) => void) => {
			listeners[type] = (listeners[type] ?? []).concat([run])
		},
		removeEventListener: (type: string, run: (event: unknown) => void) => {
			listeners[type] = (listeners[type] ?? []).filter((one) => one !== run)
		},
	}
	let near: ((entries: { isIntersecting: boolean }[]) => void) | null = null
	let disconnected = false
	class Observer {
		constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
			near = callback
		}
		observe() {}
		disconnect() {
			disconnected = true
		}
	}
	const waits: { run: () => void; cancelled: boolean }[] = []
	const wait = (run: () => void) => {
		const entry = { run, cancelled: false }
		waits.push(entry)
		return () => {
			entry.cancelled = true
		}
	}
	let starts = 0
	const stop = whenSectionWanted(
		section as unknown as Element,
		() => {
			starts++
		},
		wait,
		Observer as unknown as typeof IntersectionObserver,
	)
	return {
		near: () => near?.([{ isIntersecting: true }]),
		tap: () => {
			for (const run of listeners.pointerdown ?? [])
				run({ type: "pointerdown" })
		},
		waits,
		stop,
		starts: () => starts,
		listening: () => (listeners.pointerdown ?? []).length,
		disconnected: () => disconnected,
	}
}

test("near: it waits for the navigation work, then starts once", () => {
	const h = harness()
	assert.equal(h.waits.length, 0)
	h.near()
	assert.equal(h.waits.length, 1)
	assert.equal(h.starts(), 0)
	h.waits[0].run()
	assert.equal(h.starts(), 1)
	h.tap()
	assert.equal(h.starts(), 1, "a later tap doesn't ask again")
})

test("a tap on the placeholder starts at once and drops a wait", () => {
	const early = harness()
	early.tap()
	assert.equal(early.starts(), 1)
	assert.ok(early.disconnected())
	const waiting = harness()
	waiting.near()
	waiting.tap()
	assert.equal(waiting.starts(), 1)
	assert.ok(waiting.waits[0].cancelled)
	waiting.waits[0].run()
	assert.equal(waiting.starts(), 1)
})

test("leaving the title cancels the wait, and a late wake-up asks for nothing", () => {
	const h = harness()
	h.near()
	h.stop()
	assert.ok(h.waits[0].cancelled)
	assert.equal(h.listening(), 0)
	h.waits[0].run()
	h.tap()
	assert.equal(h.starts(), 0)
})
