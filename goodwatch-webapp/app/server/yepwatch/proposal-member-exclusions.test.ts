import { test } from "node:test"
import assert from "node:assert/strict"
import { ExclusionKeepAlive } from "./proposal-member-exclusions.ts"
import type { ProposalRoom } from "./proposal-types.ts"

const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }

test("a quiet room in setup has its members' seen copies refreshed every 10 s, for 10 minutes after its last change", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	let now = 1_000_000
	const room = { id: "room-1", phase: "setup", expiresAt: now + 6 * 3_600_000 } as ProposalRoom
	const refreshed: string[] = []
	const keep = new ExclusionKeepAlive(async () => room, (r) => void refreshed.push(r.id), { now: () => now })
	keep.touch("room-1")
	keep.touch("room-1")
	assert.equal(keep.size, 1)
	for (let i = 0; i < 3; i++) {
		now += 10_000
		t.mock.timers.tick(10_000)
		await flush()
	}
	assert.equal(refreshed.length, 3, "one refresh per 10 s, one timer per room")
	// Quiet for 10 minutes: it stops.
	for (let i = 0; i < 60; i++) {
		now += 10_000
		t.mock.timers.tick(10_000)
		await flush()
	}
	assert.equal(keep.size, 0)
	const count = refreshed.length
	assert.ok(count < 63, `stopped after ${count} refreshes`)
	now += 10_000
	t.mock.timers.tick(10_000)
	await flush()
	assert.equal(refreshed.length, count)
})

test("a room that started, expired or is gone is no longer refreshed", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	let now = 1_000_000
	const room = { id: "room-1", phase: "setup", expiresAt: now + 3_600_000 } as ProposalRoom
	let stored: ProposalRoom | null = room
	const refreshed: string[] = []
	const keep = new ExclusionKeepAlive(async () => stored, (r) => void refreshed.push(r.id), { now: () => now })
	keep.touch("room-1")
	now += 10_000
	t.mock.timers.tick(10_000)
	await flush()
	assert.equal(refreshed.length, 1)
	stored = { ...room, phase: "choosing" } as ProposalRoom
	now += 10_000
	t.mock.timers.tick(10_000)
	await flush()
	assert.equal(refreshed.length, 1)
	assert.equal(keep.size, 0)
	stored = null
	keep.touch("room-1")
	now += 10_000
	t.mock.timers.tick(10_000)
	await flush()
	assert.equal(keep.size, 0)
	assert.equal(refreshed.length, 1)
})

test("at most maxRooms rooms are kept, oldest out", () => {
	const keep = new ExclusionKeepAlive(async () => null, () => {}, { maxRooms: 2 })
	keep.touch("a")
	keep.touch("b")
	keep.touch("c")
	assert.equal(keep.size, 2)
	for (const id of ["a", "b", "c"]) keep.stop(id)
})
