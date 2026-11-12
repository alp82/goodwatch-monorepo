import { test } from "node:test"
import assert from "node:assert/strict"
import type { Sql } from "./repository.server.ts"
import { DAY_MS, RoomRetention, ROOM_RECORD_TABLES, cleanupRounds, type RetentionRepository } from "./proposal-room-retention.ts"
import { invitationTable } from "./proposal-storage-schema.ts"
import { tables } from "./proposal-storage-schema.ts"

const ROOM = tables.room.name
const NOW = 1_800_000_000_000
type Row = { room_id: string; expires_at: number; seq: number; pending_revision?: number; corrupt?: boolean; history?: any[]; participant_id?: string; member_user_id?: string | null }

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
		if (stmt === `SELECT id FROM ${ROOM} WHERE expires_at<=? AND id>? ORDER BY id LIMIT ?`) {
			const rows = [...table(ROOM)].filter(([id, r]) => r.expires_at <= Number(args[0]) && id > String(args[1])).sort((a, b) => (a[0] < b[0] ? -1 : 1))
			return { rows: rows.slice(0, Number(args[2])).map(([id]) => [id]), rowcount: 0 }
		}
		if (stmt === `SELECT id FROM ${ROOM} WHERE id=?`) return { rows: table(ROOM).has(String(args[0])) ? [[args[0]]] : [], rowcount: 0 }
		if (stmt === `SELECT expires_at,pending_revision,pending_agreement,_seq_no,_primary_term,invite_hash FROM ${ROOM} WHERE id=?`) {
			const r = table(ROOM).get(String(args[0]))
			return { rows: r ? [[r.expires_at, r.pending_revision ?? 0, false, r.seq, 1, `${invitationTable.name}:${args[0]}`]] : [], rowcount: 0 }
		}
		if (stmt === `SELECT DISTINCT participant_id,member_user_id FROM ${tables.participant.name} WHERE room_id=? LIMIT ?`) {
			const pairs = new Map<string, unknown[]>()
			for (const r of table(tables.participant.name).values())
				if (r.room_id === args[0] && r.participant_id) pairs.set(`${r.participant_id}:${r.member_user_id}`, [r.participant_id, r.member_user_id ?? null])
			return { rows: [...pairs.values()].slice(0, Number(args[1])), rowcount: 0 }
		}
		if (stmt === `DELETE FROM ${invitationTable.name} WHERE code_hash=? AND room_id=? AND expires_at<=?`) {
			const r = table(invitationTable.name).get(String(args[0]))
			if (!r || r.room_id !== args[1] || r.expires_at > Number(args[2])) return { rows: [], rowcount: 0 }
			table(invitationTable.name).delete(String(args[0]))
			return { rows: [], rowcount: 1 }
		}
		if (stmt === `DELETE FROM ${ROOM} WHERE id=? AND _seq_no=? AND _primary_term=?`) {
			const r = table(ROOM).get(String(args[0]))
			if (!r || r.seq !== args[1] || args[2] !== 1) return { rows: [], rowcount: 0 }
			table(ROOM).delete(String(args[0]))
			return { rows: [], rowcount: 1 }
		}
		if ((m = stmt.match(/^SELECT (\w+),room_id FROM (\S+) WHERE expires_at<=\? AND (\w+)>\? ORDER BY (\w+) LIMIT \?$/))) {
			const rows = [...table(m[2])].filter(([k, r]) => r.expires_at <= Number(args[0]) && k > String(args[1])).sort((a, b) => (a[0] < b[0] ? -1 : 1))
			return { rows: rows.slice(0, Number(args[2])).map(([k, r]) => [k, r.room_id]), rowcount: 0 }
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
	let markerReads = 0
	let publishFails = false
	const markers = new Set<string>()
	const repository: RetentionRepository = {
		async read(id) {
			const r = table(ROOM).get(id)
			if (!r) return null
			if (r.corrupt) throw new Error("Room records are incomplete")
			const participants = [...table(tables.participant.name).values()]
				.filter((p) => p.room_id === id && p.participant_id)
				.map((p) => ({ id: p.participant_id!, memberUserId: p.member_user_id ?? null }))
			return { room: { expiresAt: r.expires_at, inviteHash: `${invitationTable.name}:${id}`, history: r.history ?? [], participants }, seq: r.seq, term: 1 }
		},
		accountStore: {
			publish: async (decisions) => {
				if (publishFails || decisions.some((d) => String(d.id).startsWith("fail"))) throw new Error("History publication failed")
				published.push(...decisions.map((d) => d.id))
			},
		},
		deletionStore: {
			get: async (subject) => {
				markerReads++
				return markers.has(subject.kind === "account" ? `account:${subject.userId}` : `guest:${subject.roomId}:${subject.participantId}`) ? {} : null
			},
		},
	}
	/** A room with one row in every record table (more receipts on request). */
	function room(id: string, expiresAt: number, extra: Partial<Row> & { receipts?: number } = {}) {
		table(ROOM).set(id, { room_id: id, expires_at: expiresAt, seq: 1, ...extra })
		for (const t of ROOM_RECORD_TABLES)
			table(t.name).set(`${t.name}:${id}`, { room_id: id, expires_at: expiresAt, seq: 1, ...(t === tables.participant ? { participant_id: `${id}-p`, member_user_id: extra.member_user_id ?? null } : {}) })
		for (let i = 0; i < (extra.receipts ?? 0); i++) table(tables.receipt.name).set(`r:${id}:${i}`, { room_id: id, expires_at: expiresAt, seq: 1 })
	}
	const rowsOf = (id: string) =>
		[ROOM, ...ROOM_RECORD_TABLES.map((t) => t.name)].reduce((n, name) => n + [...table(name).values()].filter((r) => r.room_id === id).length, 0)
	return {
		sql, repository, room, rowsOf, statements, published, table, markers,
		get markerReads() { return markerReads },
		set publishFails(v: boolean) { publishFails = v },
		failNext(pattern: RegExp) { failOn = pattern },
	}
}

/** Runs until three runs in a row delete nothing (the rotating cursors have wrapped). */
async function drain(retention: RoomRetention, max = 80) {
	for (let i = 0, quiet = 0; i < max; i++) {
		const report = await retention.run()
		quiet = Object.keys(report.deleted).length ? 0 : quiet + 1
		if (quiet === 3) return i
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
	const invite = at(/^DELETE FROM doc\.yepwatch_invitation WHERE code_hash=\? AND room_id/)
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

test("room retention: a full batch of rooms that must stay never hides a healthy room behind it", async () => {
	const s = store()
	// Ten unreadable heads with pending work sort first, then ten whose publication keeps failing.
	for (let i = 0; i < 10; i++) s.room(`a-unreadable-${i}`, NOW - 50 * DAY_MS, { corrupt: true, pending_revision: 3 })
	for (let i = 0; i < 10; i++) s.room(`b-failing-${i}`, NOW - 50 * DAY_MS, { history: [{ id: `fail-${i}` }] })
	s.room("c-healthy", NOW - 31 * DAY_MS, { history: [{ id: "decision-healthy" }] })
	const retention = new RoomRetention(s.sql, s.repository, { retentionDays: 30, roomsPerRun: 10 })
	const reports = []
	for (let i = 0; i < 4 && s.rowsOf("c-healthy"); i++) reports.push(await retention.run())
	assert.equal(s.rowsOf("c-healthy"), 0, "the healthy room is deleted within one rotation")
	assert.deepEqual(s.published, ["decision-healthy"])
	assert.equal(reports[0].skipped, 10)
	assert.equal(reports[1].failed, 10)
	for (let i = 0; i < 10; i++) {
		assert.equal(s.rowsOf(`a-unreadable-${i}`), 1 + ROOM_RECORD_TABLES.length)
		assert.equal(s.rowsOf(`b-failing-${i}`), 1 + ROOM_RECORD_TABLES.length)
	}
	// Failing rooms are retried with a backoff: over 60 more runs each is attempted only a handful of times.
	const attempts = () => s.statements.filter((x) => x.stmt.startsWith("SELECT DISTINCT participant_id") && x.args[0] === "b-failing-0").length
	const before = attempts()
	for (let i = 0; i < 60; i++) await retention.run()
	assert.ok(attempts() - before <= 6, `retried ${attempts() - before} times`)
	assert.ok(attempts() - before >= 3, "but retried")
})

test("room retention: a room with an open deletion request is left for that request's purge", async () => {
	const s = store()
	s.room("member", NOW - 40 * DAY_MS, { member_user_id: "user-1", history: [{ id: "decision-member" }] })
	s.room("guest", NOW - 40 * DAY_MS, { history: [{ id: "decision-guest" }] })
	s.room("free", NOW - 40 * DAY_MS, { member_user_id: "user-2" })
	s.markers.add("account:user-1")
	s.markers.add("guest:guest:guest-p")
	const retention = new RoomRetention(s.sql, s.repository, { retentionDays: 30 })
	const report = await retention.run()
	assert.equal(report.waiting, 2)
	assert.equal(report.rooms, 1)
	await drain(retention)
	assert.equal(s.rowsOf("free"), 0)
	for (const id of ["member", "guest"]) assert.equal(s.rowsOf(id), 1 + ROOM_RECORD_TABLES.length, `${id} keeps every row for the purge`)
	assert.deepEqual(s.published, [], "nothing is published while a purge may be scrubbing history")
	// A restored request lets the room go.
	s.markers.clear()
	await drain(retention)
	assert.equal(s.rowsOf("member") + s.rowsOf("guest"), 0)
	assert.deepEqual(s.published.sort(), ["decision-guest", "decision-member"])
})

test("room retention: every statement is bounded; invitations go by primary key, no unbounded subquery", async () => {
	const s = store()
	for (let i = 0; i < 40; i++) s.room(`old-${String(i).padStart(2, "0")}`, NOW - (31 + i) * DAY_MS, { receipts: 30 })
	for (let i = 0; i < 40; i++) s.room(`live-${i}`, NOW + 3600_000, { receipts: 5 })
	const retention = new RoomRetention(s.sql, s.repository, { retentionDays: 30 })
	const T = ROOM_RECORD_TABLES.length
	for (let run = 0; run < 30; run++) {
		const from = s.statements.length
		const report = await retention.run()
		const ran = s.statements.slice(from)
		const rows = Object.values(report.deleted).reduce((a, b) => a + b, 0)
		assert.ok(rows <= 1000)
		const scans = ran.filter((x) => /LIMIT \?$/.test(x.stmt) && !x.stmt.startsWith("SELECT DISTINCT"))
		assert.ok(scans.length <= 1 + T, `${scans.length} scans`)
		for (const x of scans) assert.ok(Number(x.args.at(-1)) <= 100)
		assert.ok(ran.filter((x) => x.stmt === `SELECT id FROM ${ROOM} WHERE id=?`).length <= 100 * T)
		assert.ok(ran.filter((x) => x.stmt.startsWith("DELETE")).length <= 2 * 10 + T)
		assert.ok(ran.filter((x) => x.stmt.startsWith("SELECT DISTINCT")).length <= 10)
		for (const x of ran) {
			assert.doesNotMatch(x.stmt, /NOT IN|WHERE room_id=\? AND expires_at/, "no room-wide or subquery statement")
			if (/=ANY\(\?\)/.test(x.stmt)) assert.ok((x.args[0] as string[]).length <= 100)
		}
		if (!rows && !report.rooms) break
	}
	await drain(retention)
	for (let i = 0; i < 40; i++) assert.equal(s.rowsOf(`old-${String(i).padStart(2, "0")}`), 0)
	for (let i = 0; i < 40; i++) assert.equal(s.rowsOf(`live-${i}`), 6 + ROOM_RECORD_TABLES.length)
})

test("cleanup rounds: a rejected sibling does not let a second retention run start while the first is still running", async () => {
	let retentionRuns = 0
	let release!: () => void
	const failures: unknown[] = []
	const tick = cleanupRounds(
		[
			async () => {
				throw new Error("purge failed")
			},
			() => {
				retentionRuns++
				return new Promise<void>((resolve) => (release = resolve))
			},
		],
		(e) => failures.push(e)
	)
	const first = tick()
	assert.ok(first)
	await new Promise((r) => setTimeout(r, 5)) // the sibling has rejected by now
	assert.equal(failures.length, 0, "failures are reported once the round settles")
	assert.equal(tick(), null, "the next minute's tick finds the round still running")
	assert.equal(retentionRuns, 1)
	release()
	await first
	assert.equal(failures.length, 1)
	const second = tick()
	assert.ok(second, "a new round starts once everything settled")
	await new Promise((r) => setTimeout(r, 5))
	assert.equal(retentionRuns, 2)
	release()
	await second
})
