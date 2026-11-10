import assert from "node:assert/strict"
import { test } from "node:test"
import { createToastQueue } from "./toast-queue.ts"

test("a rejected first load retains messages and rich Undo closures; the next notification retries once in order", async () => {
	const delivered: { text: string; undo?: () => void }[] = []
	const errors: unknown[] = []
	let attempts = 0
	let undos = 0
	const runtime = {
		show: (message: (typeof delivered)[number]) => delivered.push(message),
	}
	const queue = createToastQueue(
		async () => {
			attempts++
			if (attempts === 1) throw new Error("temporary network failure")
			return runtime
		},
		(error) => errors.push(error),
	)
	const first = { text: "List deleted", undo: () => undos++ }
	queue.enqueue((module) => module.show(first))
	queue.enqueue((module) => module.show({ text: "First failure" }))
	await queue.retry()
	assert.equal(attempts, 1, "concurrent notifications share the rejected load")
	assert.equal(errors.length, 1)
	assert.equal(
		delivered.length,
		0,
		"nothing is discarded or displayed before the runtime loads",
	)
	queue.enqueue((module) => module.show({ text: "Saved" }))
	await queue.retry()
	assert.equal(attempts, 2)
	assert.deepEqual(
		delivered.map((message) => message.text),
		["List deleted", "First failure", "Saved"],
	)
	assert.equal(delivered[0], first, "retains the original rich notification")
	delivered[0].undo?.()
	assert.equal(undos, 1)
	await queue.retry()
	await queue.retry()
	assert.equal(
		delivered.length,
		3,
		"online events never repeat delivered messages",
	)
	assert.equal(attempts, 2, "the resolved runtime is reused")
})

test("reconnect retries a retained notification without another message and handles synchronous loader failures", async () => {
	let available = false
	let delivered = 0
	const errors: unknown[] = []
	const queue = createToastQueue(
		() => {
			if (!available) throw new Error("offline")
			return Promise.resolve({ show: () => delivered++ })
		},
		(error) => errors.push(error),
	)
	queue.enqueue((module) => module.show())
	await queue.retry()
	assert.equal(delivered, 0)
	assert.equal(errors.length, 1)
	available = true
	await queue.retry()
	assert.equal(delivered, 1)
})

test("a throwing delivery does not duplicate prior messages or strand later notifications", async () => {
	const delivered: string[] = []
	const errors: unknown[] = []
	const queue = createToastQueue(
		async () => ({}),
		(error) => errors.push(error),
	)
	queue.enqueue(() => delivered.push("first"))
	queue.enqueue(() => {
		delivered.push("throws after delivery")
		throw new Error("invalid content")
	})
	queue.enqueue(() => delivered.push("last"))
	await queue.retry()
	await queue.retry()
	assert.deepEqual(delivered, ["first", "throws after delivery", "last"])
	assert.equal(errors.length, 1)
})
