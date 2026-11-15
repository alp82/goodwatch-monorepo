import { test } from "node:test"
import assert from "node:assert/strict"
import { HistorySync, type HistorySyncDeps } from "./proposal-history-sync.ts"

test("Follow-up failure logs only a count and does not block the room history copy", async () => {
	const logs: Record<string, unknown>[] = []
	let archived = false
	let synced = false
	const room = { id: "private-room", revision: 2 }
	const history = new HistorySync({
		redis: {
			hmget: async () => ["2", "incarnation", "body", "1", "3", "1", null, null],
			ywMark: async () => 1,
			ywSynced: async () => { synced = true },
		},
		repository: { decode: () => room },
		crate: {
			fingerprint: () => "fingerprint",
			archive: async () => { archived = true; return { seq: 4, term: 1 } },
		},
		retentionDays: 30,
		followups: async () => { throw new Error("private profile details") },
		log: event => logs.push(event),
	} as unknown as HistorySyncDeps)
	await (history as unknown as { room(id: string, member: string, lease: number): Promise<void> }).room(room.id, "job", 1)
	assert.equal(archived, true)
	assert.equal(synced, true)
	assert.deepEqual(logs, [{ event: "yepwatch_followups_failed", count: 1 }])
})
