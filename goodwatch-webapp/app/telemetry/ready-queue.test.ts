import assert from "node:assert/strict"
import { test } from "node:test"

const { createReadyQueue } = await import("./ready-queue.ts")

// The tool stands in for PostHog: the calls are what a sign-in sends.
function fakeTool() {
	const calls: string[] = []
	return { calls, identify: (id: string) => calls.push(`identify ${id}`) }
}

test("a call made before the tool loaded runs when it loads", () => {
	const queue = createReadyQueue<ReturnType<typeof fakeTool>>(() => {})
	const tool = fakeTool()
	queue.run((posthog) => posthog.identify("member"))
	assert.deepEqual(tool.calls, [])
	queue.ready(tool)
	assert.deepEqual(tool.calls, ["identify member"])
})

test("waiting calls run in the order they were made, before later calls", () => {
	const queue = createReadyQueue<ReturnType<typeof fakeTool>>(() => {})
	const tool = fakeTool()
	queue.run((posthog) => posthog.identify("first"))
	queue.run((posthog) => posthog.identify("second"))
	queue.ready(tool)
	queue.run((posthog) => posthog.identify("third"))
	assert.deepEqual(tool.calls, [
		"identify first",
		"identify second",
		"identify third",
	])
})

test("a call made after the tool loaded runs at once", () => {
	const queue = createReadyQueue<ReturnType<typeof fakeTool>>(() => {})
	const tool = fakeTool()
	queue.ready(tool)
	queue.run((posthog) => posthog.identify("member"))
	assert.deepEqual(tool.calls, ["identify member"])
})

test("a call that throws is reported and doesn't stop the others", () => {
	const errors: unknown[] = []
	const queue = createReadyQueue<ReturnType<typeof fakeTool>>((error) =>
		errors.push(error),
	)
	const tool = fakeTool()
	queue.run(() => {
		throw new Error("broken call")
	})
	queue.run((posthog) => posthog.identify("member"))
	queue.ready(tool)
	assert.deepEqual(tool.calls, ["identify member"])
	assert.equal(errors.length, 1)
})

test("a tool that never loads runs nothing", () => {
	const queue = createReadyQueue<ReturnType<typeof fakeTool>>(() => {})
	let ran = false
	queue.run(() => {
		ran = true
	})
	assert.equal(ran, false)
})
