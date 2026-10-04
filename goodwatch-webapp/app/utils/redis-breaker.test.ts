import assert from "node:assert/strict"
import { test } from "node:test"
import { RedisNodeDownError, createRedisBreakers } from "./redis-breaker.ts"

test("first failure opens; one probe per pause; failed probes restart the pause", () => {
	let now = 0
	const events: string[] = []
	const breakers = createRedisBreakers({
		now: () => now,
		onEvent: (node, event) => events.push(`${node}:${event}`),
	})
	assert.equal(breakers.isOpen("a"), false)
	assert.equal(breakers.claimProbe("a"), false)
	assert.deepEqual(breakers.states(), [])
	breakers.failure("a")
	assert.equal(breakers.openCount(), 1)
	now = 999
	breakers.failure("a")
	assert.equal(breakers.claimProbe("a"), false)
	now = 1000
	assert.equal(breakers.claimProbe("a"), true)
	assert.equal(breakers.claimProbe("a"), false)
	assert.equal(breakers.isOpen("a"), true)
	now = 2000
	assert.equal(breakers.claimProbe("a"), false)
	breakers.probeFailed("a")
	now = 2999
	assert.equal(breakers.claimProbe("a"), false)
	now = 3000
	assert.equal(breakers.claimProbe("a"), true)
	breakers.success("a")
	assert.equal(breakers.openCount(), 0)
	assert.equal(breakers.claimProbe("a"), false)
	breakers.success("a")
	assert.deepEqual(events, ["a:opened", "a:probe_failed", "a:closed"])
	breakers.failure("a")
	breakers.success("a") // A late answer can close a breaker without a probe.
	assert.equal(breakers.isOpen("a"), false)
	breakers.reset()
	assert.deepEqual(breakers.states(), [])
})

test("node bound evicts oldest closed entries before open ones", () => {
	const breakers = createRedisBreakers()
	for (let i = 0; i < 17; i++) breakers.failure(String(i))
	assert.equal(breakers.states().length, 16)
	assert.equal(breakers.isOpen("0"), false)
	breakers.success("8")
	breakers.failure("17")
	assert.equal(breakers.states().length, 16)
	assert.equal(
		breakers.states().some(({ node }) => node === "8"),
		false,
	)
	assert.equal(breakers.isOpen("1"), true)
})

test("custom limits and node down error contract", () => {
	let now = 0
	const breakers = createRedisBreakers({ now: () => now, openMs: 10, max: 1 })
	breakers.failure("a")
	now = 10
	assert.equal(breakers.claimProbe("a"), true)
	breakers.failure("b")
	assert.deepEqual(breakers.states(), [{ node: "b", open: true }])
	const error = new RedisNodeDownError("b")
	assert.equal(error.name, "RedisNodeDownError")
	assert.equal(error.message, "Redis node is marked down")
	assert.equal(error.node, "b")
})
