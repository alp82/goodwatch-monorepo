import assert from "node:assert/strict"
import { test } from "node:test"
import {
	BUDGET_PER_MINUTE,
	MAX_IN_FLIGHT,
	PrefetchQueue,
	type Priority,
} from "./prefetch-queue.ts"

function harness() {
	let now = 0
	const queue = new PrefetchQueue(() => now)
	const started: string[] = []
	const finishers = new Map<string, () => void>()
	const job = (key: string, priority: Priority) => ({
		key,
		priority,
		run: () => {
			started.push(key)
			return new Promise<void>((resolve) => {
				finishers.set(key, resolve)
			})
		},
	})
	const finish = async (key: string) => {
		finishers.get(key)?.()
		await new Promise((resolve) => setTimeout(resolve, 0))
	}
	return {
		queue,
		started,
		job,
		finish,
		advance: (ms: number) => {
			now += ms
		},
	}
}

test("at most two prefetches run at once; hover waits in front of viewport ones", async () => {
	const { queue, started, job, finish } = harness()
	queue.request(job("v1", "viewport"))
	queue.request(job("v2", "viewport"))
	queue.request(job("v3", "viewport"))
	queue.request(job("h1", "intent"))
	assert.equal(queue.running, MAX_IN_FLIGHT)
	assert.deepEqual(started, ["v1", "v2"])
	await finish("v1")
	assert.deepEqual(started, ["v1", "v2", "h1"])
	await finish("v2")
	assert.deepEqual(started, ["v1", "v2", "h1", "v3"])
})

test("a press starts at once, past the limit, and takes its key out of the queue", () => {
	const { queue, started, job } = harness()
	queue.request(job("a", "intent"))
	queue.request(job("b", "intent"))
	queue.request(job("c", "intent"))
	queue.request(job("c", "press"))
	assert.deepEqual(started, ["a", "b", "c"])
	assert.equal(queue.queued, 0)
})

test("leaving a link takes its waiting prefetch back", async () => {
	const { queue, started, job, finish } = harness()
	queue.request(job("a", "intent"))
	queue.request(job("b", "intent"))
	queue.request(job("c", "intent"))
	queue.cancel("c")
	await finish("a")
	assert.deepEqual(started, ["a", "b"])
})

test("the budget stops prefetches after 40 a minute, except presses", async () => {
	const { queue, started, job, finish, advance } = harness()
	for (let i = 0; i < BUDGET_PER_MINUTE; i++) {
		queue.request(job(`k${i}`, "intent"))
		await finish(`k${i}`)
	}
	assert.equal(queue.request(job("over", "intent")), false)
	assert.equal(queue.request(job("tap", "press")), true)
	advance(60_001)
	assert.equal(queue.request(job("later", "viewport")), true)
	assert.ok(started.includes("later"))
})
