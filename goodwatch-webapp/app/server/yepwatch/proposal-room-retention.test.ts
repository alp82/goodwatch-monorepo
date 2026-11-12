import { test } from "node:test"
import assert from "node:assert/strict"
import type { Sql } from "./repository.server.ts"
import { DAY_MS, RoomRetention, ROOM_RECORD_TABLES, type RetentionRepository } from "./proposal-room-retention.ts"
import { tables } from "./proposal-storage-schema.ts"

const ROOM = tables.room.name
const NOW = 1_800_000_000_000
type Row = { room_id: string; expires_at: number; seq: number; pending_revision?: number; corrupt?: boolean; history?: any[] }

/** An in-memory store answering exactly the statements the cleanup sends; anything else fails the test. */
function store(now = NOW) {
	const data = new Map<string, Map<string, Row>>()
	const statements: { stmt: string; args: unknown[] }[] = []
	const table = (name: string) => {
		if (!data.has(name)) data.set(name, new Map())
		return data.get(name)!
	}
	let failOn: RegExp | undefined
	const sql: Sql = async (stmt, args = []) => {
		await new Promise((r) => setImmediate(r)) // lets concurrent runners interleave statement by statement
		statements.push({ stmt, args })
		if (failOn?.test(stmt)) {
			failOn = undefined
			throw new Error("Injected crash")
		}
		let m: RegExpMatchArray | null
		if (stmt === "SELECT CURRENT_TIMESTAMP") return { rows: [[now]], rowcount: 1 }
		if (stmt === `SELECT id FROM ${ROOM} WHERE expires_at<=? ORDER BY expires_at LIMIT ?`) {
			const rows = [...table(ROOM)].filter(([, r]) => r.expires_at <= Number(args[0])).sort((a, b) => a[1].expires_at - b[1].expires_at)
			return { rows: rows.slice(0, Number(args[1])).map(([id]) => [id]), rowcount: 0 }
		}
		if (stmt === `SELECT id FROM ${ROOM} WHERE id=?`) return { rows: table(ROOM).has(String(args[0])) ? [[args[0]]] : [], rowcount: 0 }
		if (stmt.startsWith(`SELECT expires_at,pending_revision,pending_agreement,_seq_no,_primary_term FROM ${ROOM} WHERE id=?`)) {
			const r = table(ROOM).get(String(args[0]))
			return { rows: r ? [[r.expires_at, r.pending_revision ?? 0, false, r.seq, 1]] : [], rowcount: 0 }
		}
		if (stmt === `DELETE FROM ${ROOM} WHERE id=? AND _seq_no=? AND _primary_term=?`) {
			const r = table(ROOM).get(String(args[0]))
			if (!r || r.seq !== args[1] || args[2] !== 1) return { rows: [], rowcount: 0 }
			table(ROOM).delete(String(args[0]))
			return { rows: [], rowcount: 1 }
		}
		if ((m = stmt.match(/^DELETE FROM (\S+) WHERE room_id=\? AND expires_at<=\?$/))) {
			let n = 0
			for (const [k, r] of table(m[1])) if (r.room_id === args[0] && r.expires_at <= Number(args[1])) table(m[1]).delete(k), n++
			return { rows: [], rowcount: n }
		}
		if ((m = stmt.match(/^SELECT (\w+),room_id FROM (\S+) WHERE expires_at<=\? AND room_id NOT IN \(SELECT id FROM (\S+)\) LIMIT \?$/))) {
			const rows = [...table(m[2])].filter(([, r]) => r.expires_at <= Number(args[0]) && !table(m![3]).has(r.room_id))
			return { rows: rows.slice(0, Number(args[1])).map(([k, r]) => [k, r.room_id]), rowcount: 0 }
		}
		if ((m = stmt.match(/^DELETE FROM (\S+) WHERE (\w+)=ANY\(\?\) AND expires_at<=\?$/))) {
			let n = 0
			for (const k of args[0] as string[]) {
				const r = table(m[1]).get(k)
				if (r && r.expires_at <= Number(args[1])) table(m[1]).delete(k), n++
			}
			return { rows: [], rowcount: n }
		}
		throw new Error(`Unexpected statement: ${stmt}`)
	}
	const published: string[] = []
	let retained = 0
	const repository: RetentionRepository = {
		async read(id) {
			const r = table(ROOM).get(id)
			if (!r) return null
			if (r.corrupt) throw new Error("Room records are incomplete")
			return { room: { expiresAt: r.expires_at, history: r.history ?? [] }, seq: r.seq, term: 1 }
		},
		accountStore: { publish: async (decisions) => void published.push(...decisions.map((d) => d.id)) },
		deletionStore: { retainTargetsBeforeRoomCleanup: async () => void retained++ },
	}
	/** A room with one row in every record table (more receipts on request). */
	function room(id: string, expiresAt: number, extra: Partial<Row> & { receipts?: number } = {}) {
		table(ROOM).set(id, { room_id: id, expires_at: expiresAt, seq: 1, ...extra })
		for (const t of ROOM_RECORD_TABLES) table(t.name).set(`${t.name}:${id}`, { room_id: id, expires_at: expiresAt, seq: 1 })
		for (let i = 0; i < (extra.receipts ?? 0); i++) table(tables.receipt.name).set(`r:${id}:${i}`, { room_id: id, expires_at: expiresAt, seq: 1 })
	}
	const rowsOf = (id: string) =>
		[ROOM, ...ROOM_RECORD_TABLES.map((t) => t.name)].reduce((n, name) => n + [...table(name).values()].filter((r) => r.room_id === id).length, 0)
	return {
		sql, repository, room, rowsOf, statements, published, table,
		get retained() { return retained },
		failNext(pattern: RegExp) { failOn = pattern },
	}
}

async function drain(retention: RoomRetention, max = 50) {
	for (let i = 0; i < max; i++) {
		const report = await retention.run()
		if (!Object.keys(report.deleted).length) return i
	}
	throw new Error("Cleanup did not finish")
}

test("room retention: only rooms that expired at least the retention period ago are deleted, live rooms untouched", async () => {
	const s = store()
	s.room("exactly-30", NOW - 30 * DAY_MS, { history: [{ id: "decision-1" }] })
	s.room("older", NOW - 90 * DAY_MS)
	s.room("29-days", NOW - 29 * DAY_MS)
	s.room("almost-30", NOW - 30 * DAY_MS + 1)
	s.room("recently-expired", NOW - 3600_000)
	s.room("live", NOW + 3600_000)
	const retention = new RoomRetention(s.sql, s.repository, { retentionDays: 30 })
	const report = await retention.run()
	assert.equal(report.cutoff, NOW - 30 * DAY_MS)
	assert.equal(report.rooms, 2)
	await drain(retention)
	assert.equal(s.rowsOf("exactly-30"), 0)
	assert.equal(s.rowsOf("older"), 0)
	for (const kept of ["29-days", "almost-30", "recently-expired", "live"]) assert.equal(s.rowsOf(kept), 1 + ROOM_RECORD_TABLES.length, kept)
	assert.deepEqual(s.published, ["decision-1"], "decisions reach account history before the head goes")
	assert.ok(s.retained >= 1, "account deletions keep their identities first")
	// One day is the floor, whatever the caller passes.
	assert.throws(() => new RoomRetention(s.sql, s.repository, { retentionDays: 0.5 }), /at least 1 day/)
	assert.throws(() => new RoomRetention(s.sql, s.repository, { retentionDays: 0 }), /at least 1 day/)
	assert.throws(() => new RoomRetention(s.sql, s.repository, { retentionDays: Number.NaN }), /at least 1 day/)
})

test("room retention: readers never find a head without its records", async () => {
	const s = store()
	s.room("old", NOW - 40 * DAY_MS)
	await drain(new RoomRetention(s.sql, s.repository, { retentionDays: 30 }))
	const at = (re: RegExp) => s.statements.findIndex((x) => re.test(x.stmt) && x.args.includes("old"))
	const invite = at(/^DELETE FROM doc\.yepwatch_invitation WHERE room_id/)
	const head = at(/^DELETE FROM doc\.yepwatch_room WHERE id=/)
	assert.ok(invite >= 0 && head > invite, "invitation, then head")
	const firstRecord = s.statements.findIndex((x) => /=ANY\(\?\)/.test(x.stmt))
	assert.ok(firstRecord > head, "records only after the head is gone")

	// A run that stops after the head leaves records nobody can reach; the next run removes them.
	const crashed = store()
	crashed.room("old", NOW - 40 * DAY_MS)
	const retention = new RoomRetention(crashed.sql, crashed.repository, { retentionDays: 30 })
	crashed.failNext(/=ANY\(\?\)/)
	await assert.rejects(retention.run(), /Injected crash/)
	assert.equal(await crashed.repository.read("old"), null)
	assert.ok(crashed.rowsOf("old") > 0)
	await drain(retention)
	assert.equal(crashed.rowsOf("old"), 0)
})

test("room retention: bounded rows per statement and per run", async () => {
	const s = store()
	s.room("big", NOW - 31 * DAY_MS, { receipts: 250 })
	s.room("small", NOW - 32 * DAY_MS)
	const total = s.rowsOf("big") + s.rowsOf("small")
	const retention = new RoomRetention(s.sql, s.repository, { retentionDays: 30, rowsPerStatement: 100, rowsPerRun: 150, roomsPerRun: 1 })
	let runs = 0, deleted = 0
	for (;;) {
		const report = await retention.run()
		const rows = Object.values(report.deleted).reduce((a, b) => a + b, 0)
		assert.ok(rows <= 150, `run deleted ${rows}`)
		assert.ok(report.rooms <= 1)
		if (!rows) break
		deleted += rows
		runs++
	}
	assert.equal(deleted, total)
	assert.ok(runs >= 3)
	for (const x of s.statements.filter((x) => /=ANY\(\?\)/.test(x.stmt))) assert.ok((x.args[0] as string[]).length <= 100)
	assert.equal(s.rowsOf("big") + s.rowsOf("small"), 0)
})

test("room retention: several API instances delete each row once and never fail on each other", async () => {
	const s = store()
	for (let i = 0; i < 6; i++) s.room(`old-${i}`, NOW - (31 + i) * DAY_MS, { receipts: 20 })
	s.room("live", NOW + 3600_000)
	const total = [...Array(6)].reduce((n, _, i) => n + s.rowsOf(`old-${i}`), 0)
	const instances = [0, 1, 2].map(() => new RoomRetention(s.sql, s.repository, { retentionDays: 30, rowsPerStatement: 25, roomsPerRun: 2 }))
	let rooms = 0, deleted = 0
	for (let round = 0; round < 20; round++) {
		const reports = await Promise.all(instances.map((r) => r.run()))
		for (const report of reports) {
			rooms += report.rooms
			deleted += Object.values(report.deleted).reduce((a, b) => a + b, 0)
		}
	}
	assert.equal(rooms, 6, "each head is removed by exactly one instance")
	assert.equal(deleted, total, "no row is counted twice")
	assert.equal(s.rowsOf("live"), 1 + ROOM_RECORD_TABLES.length)
})

test("room retention: an unreadable head goes only once nothing is left to publish", async () => {
	const s = store()
	s.room("pending", NOW - 40 * DAY_MS, { corrupt: true, pending_revision: 7 })
	s.room("settled", NOW - 41 * DAY_MS, { corrupt: true, pending_revision: 0 })
	const retention = new RoomRetention(s.sql, s.repository, { retentionDays: 30 })
	const report = await retention.run()
	assert.equal(report.skipped, 1)
	await drain(retention)
	assert.equal(s.rowsOf("settled"), 0)
	assert.equal(s.rowsOf("pending"), 1 + ROOM_RECORD_TABLES.length, "the skipped room keeps its records too")
})
