import { test } from "node:test"
import assert from "node:assert/strict"
import type { Sql } from "./repository.server.ts"
import { DAY_MS, RoomRetention, ROOM_RECORD_TABLES, cleanupRounds, type RetentionRepository } from "./proposal-room-retention.ts"
import { invitationTable } from "./proposal-storage-schema.ts"
import { tables } from "./proposal-storage-schema.ts"

const ROOM = tables.room.name
const NOW = 1_800_000_000_000
const PAGE = `SELECT record_id,participant_id,member_user_id FROM ${tables.participant.name} WHERE room_id=? AND record_id>? ORDER BY record_id LIMIT ?`
type Row = { room_id: string; expires_at: number; seq: number; pending_revision?: number; corrupt?: boolean; history?: any[]; participant_id?: string; member_user_id?: string | null }

/** The first `n` entries in key order that pass `keep`, without sorting the whole table (backlog tests hold 100k rows). */
function firstN(rows: Map<string, Row>, keep: (key: string, row: Row) => boolean, n: number) {
	const out: [string, Row][] = []
	for (const [k, r] of rows) {
		if (!keep(k, r) || (out.length === n && k >= out[n - 1][0])) continue
		let i = out.length
		while (i > 0 && out[i - 1][0] > k) i--
		out.splice(i, 0, [k, r])
		if (out.length > n) out.pop()
	}
	return out
}

/** An in-memory store answering exactly the statements the cleanup sends; anything else fails the test. */
function store(start = NOW) {
	let now = start
	const data = new Map<string, Map<string, Row>>()
	const statements: { stmt: string; args: unknown[] }[] = []
	const table = (name: string) => {
		if (!data.has(name)) data.set(name, new Map())
		return data.get(name)!
	}
	let failOn: RegExp | undefined
	// Participant keys by room for the page read; rebuilt whenever rows were added since the last read (removed keys are
	// skipped by the lookup), so a backlog test does not scan 100k rows per page.
	let byRoom = new Map<string, string[]>()
	let indexedSize = -1
	const participantsOf = (roomId: string) => {
		const rows = table(tables.participant.name)
		if (rows.size > indexedSize) {
			byRoom = new Map()
			for (const [k, r] of rows) byRoom.set(r.room_id, [...(byRoom.get(r.room_id) ?? []), k])
		}
		indexedSize = rows.size
		const keyed = new Map<string, Row>()
		for (const k of byRoom.get(roomId) ?? []) if (rows.has(k)) keyed.set(k, rows.get(k)!)
		return keyed
	}
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
			const rows = firstN(table(ROOM), (id, r) => r.expires_at <= Number(args[0]) && id > String(args[1]), Number(args[2]))
			return { rows: rows.map(([id]) => [id]), rowcount: 0 }
		}
		if (stmt === `SELECT id FROM ${ROOM} WHERE id=?`) return { rows: table(ROOM).has(String(args[0])) ? [[args[0]]] : [], rowcount: 0 }
		if (stmt === `SELECT expires_at,pending_revision,pending_agreement,_seq_no,_primary_term,invite_hash FROM ${ROOM} WHERE id=?`) {
			const r = table(ROOM).get(String(args[0]))
			return { rows: r ? [[r.expires_at, r.pending_revision ?? 0, false, r.seq, 1, `${invitationTable.name}:${args[0]}`]] : [], rowcount: 0 }
		}
		if (stmt === PAGE) {
			const rows = firstN(participantsOf(String(args[0])), (k, r) => r.room_id === args[0] && !!r.participant_id && k > String(args[1]), Number(args[2]))
			return { rows: rows.map(([k, r]) => [k, r.participant_id, r.member_user_id ?? null]), rowcount: 0 }
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
			const rows = firstN(table(m[2]), (k, r) => r.expires_at <= Number(args[0]) && k > String(args[1]), Number(args[2]))
			return { rows: rows.map(([k, r]) => [k, r.room_id]), rowcount: 0 }
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
			// The head's roster: the room's own participant record, not the historical ones a test adds beside it.
			const own = table(tables.participant.name).get(`${tables.participant.name}:${id}`)
			const participants = own?.participant_id ? [{ id: own.participant_id, memberUserId: own.member_user_id ?? null }] : []
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
		set now(v: number) { now = v },
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
	const attempts = () => s.statements.filter((x) => x.stmt === PAGE && x.args[0] === "b-failing-0").length
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
		const scans = ran.filter((x) => /LIMIT \?$/.test(x.stmt))
		assert.ok(scans.length <= 1 + T + 10, `${scans.length} scans`)
		for (const x of scans) assert.ok(Number(x.args.at(-1)) <= 100)
		assert.ok(ran.filter((x) => x.stmt === PAGE).length <= 10)
		for (const x of ran.filter((x) => x.stmt === PAGE)) assert.ok(Number(x.args.at(-1)) <= 64)
		assert.ok(ran.filter((x) => x.stmt === `SELECT id FROM ${ROOM} WHERE id=?`).length <= 100 * T)
		assert.ok(ran.filter((x) => x.stmt.startsWith("DELETE")).length <= 2 * 10 + T)
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

test("room retention: a room with more participant records than one run checks is checked across runs, never stuck", async () => {
	const s = store()
	// One current participant, but 150 historical participant/account pairs from guests who joined and merged.
	s.room("crowded", NOW - 40 * DAY_MS, { member_user_id: "current", history: [{ id: "decision-crowded" }] })
	for (let i = 0; i < 150; i++)
		s.table(tables.participant.name).set(`p:crowded:${String(i).padStart(3, "0")}`, { room_id: "crowded", expires_at: NOW - 40 * DAY_MS, seq: 1, participant_id: `old-${i}`, member_user_id: `account-${i}` })
	s.room("plain", NOW - 40 * DAY_MS)
	// The request of a person on the third page keeps the room for its purge.
	s.markers.add("account:account-140")
	const retention = new RoomRetention(s.sql, s.repository, { retentionDays: 30, roomsPerRun: 2 })
	const reports = []
	for (let i = 0; i < 8; i++) reports.push(await retention.run())
	assert.equal(reports[0].checking, 1, "the first page is clear, the check continues")
	assert.equal(reports[0].failed, 0)
	assert.ok(reports.some((r) => r.waiting === 1), "the request on a later page is found")
	assert.equal(s.rowsOf("crowded"), 1 + ROOM_RECORD_TABLES.length + 150)
	assert.equal(s.rowsOf("plain"), 0, "the room beside it goes")
	assert.deepEqual(s.published, [])
	for (const x of s.statements.filter((x) => x.stmt === PAGE)) assert.equal(x.args[2], 64)

	// Restored: the check starts again from the first page and the room goes once every page is clear.
	s.markers.clear()
	await drain(retention)
	assert.equal(s.rowsOf("crowded"), 0)
	assert.deepEqual(s.published, ["decision-crowded"])
})

test("room retention: the run that removes a head rechecks its people; a check older than a day starts over", async () => {
	const s = store()
	s.room("crowded", NOW - 40 * DAY_MS, { member_user_id: "current" })
	for (let i = 0; i < 100; i++)
		s.table(tables.participant.name).set(`p:crowded:${String(i).padStart(3, "0")}`, { room_id: "crowded", expires_at: NOW - 40 * DAY_MS, seq: 1, participant_id: `old-${i}` })
	const retention = new RoomRetention(s.sql, s.repository, { retentionDays: 30 })
	assert.equal((await retention.run()).checking, 1)
	// The current member asks for deletion between the first page and the last.
	s.markers.add("account:current")
	const last = await retention.run()
	assert.equal(last.waiting, 1)
	assert.equal(last.rooms, 0)
	s.markers.clear()

	// A check that began more than a day ago is not trusted: it releases its slot, and after a backoff the first page is read again.
	assert.equal((await retention.run()).checking, 1)
	s.now = NOW + DAY_MS + 1
	const pages = () => s.statements.filter((x) => x.stmt === PAGE && x.args[0] === "crowded").map((x) => x.args[1])
	const before = pages().length
	assert.equal((await retention.run()).checking, 0, "expired: not continued")
	assert.equal(pages().length, before)
	await retention.run()
	assert.equal((await retention.run()).checking, 1, "after the backoff")
	assert.equal(pages()[before], "", "started over")
	await drain(retention)
	assert.equal(s.rowsOf("crowded"), 0)
})

/** `count` expired rooms with 65 historical participant records each beside their own: two pages per check. */
function crowdedBacklog(s: ReturnType<typeof store>, count: number) {
	const ids: string[] = []
	for (let r = 0; r < count; r++) {
		const id = `crowded-${String(r).padStart(4, "0")}`
		ids.push(id)
		s.room(id, NOW - 40 * DAY_MS, { history: [{ id: `decision-${id}` }] })
		for (let i = 0; i < 65; i++)
			s.table(tables.participant.name).set(`p:${id}:${String(i).padStart(2, "0")}`, { room_id: id, expires_at: NOW - 40 * DAY_MS, seq: 1, participant_id: `${id}-old-${i}` })
	}
	return ids
}

/** Runs with the store clock advancing `stepMs` per run until every head is gone; returns the runs it took. */
async function untilHeadsGone(s: ReturnType<typeof store>, retention: RoomRetention, stepMs: number, max: number) {
	for (let i = 1, now = NOW; i <= max; i++) {
		await retention.run()
		s.now = now += stepMs
		if (!s.table(ROOM).size) return i
	}
	throw new Error(`Heads left after ${max} runs: ${s.table(ROOM).size}`)
}

test("room retention: a backlog of more crowded rooms than any bound finishes every check, none restarted", async () => {
	const s = store()
	const ids = crowdedBacklog(s, 1500)
	const retention = new RoomRetention(s.sql, s.repository, { retentionDays: 30 })
	// Ten slots, two pages per room: 300 runs when no check ever loses its progress.
	const runs = await untilHeadsGone(s, retention, 60_000, 320)
	assert.ok(runs <= 301, `took ${runs} runs`)
	assert.equal(s.published.length, 1500)
	const firstPages = new Map<string, number>()
	for (const x of s.statements) if (x.stmt === PAGE && x.args[1] === "") firstPages.set(String(x.args[0]), (firstPages.get(String(x.args[0])) ?? 0) + 1)
	for (const id of ids) assert.equal(firstPages.get(id), 1, `${id} started its check once`)
})

test("room retention: checks finish when runs are far apart, a backlog never ages them past their window", async () => {
	const s = store()
	// 300 rooms take 30 runs per pass over the heads: an hour apart, a pass lasts longer than a check stays valid.
	const ids = crowdedBacklog(s, 300)
	const retention = new RoomRetention(s.sql, s.repository, { retentionDays: 30 })
	const runs = await untilHeadsGone(s, retention, 3_600_000, 80)
	assert.ok(runs <= 61, `took ${runs} runs`)
	assert.equal(s.published.length, 300)
	const restarts = s.statements.filter((x) => x.stmt === PAGE && x.args[1] === "").length
	assert.equal(restarts, ids.length, "every check read its first page once")
})

test("room retention: a full queue of checks that can never finish within their window does not keep new rooms out", async () => {
	// Codex reproduction scaled down: ten rooms whose checks need 30 runs while a check stays valid for 20 runs.
	const s = store()
	const pagesPerRoom = 30
	const crowded: string[] = []
	for (let r = 0; r < 10; r++) {
		const id = `crowded-${r}`
		crowded.push(id)
		s.room(id, NOW - 40 * DAY_MS)
		for (let i = 0; i < 64 * pagesPerRoom; i++)
			s.table(tables.participant.name).set(`p:${id}:${String(i).padStart(4, "0")}`, { room_id: id, expires_at: NOW - 40 * DAY_MS, seq: 1, participant_id: `${id}-old-${i}` })
	}
	const retention = new RoomRetention(s.sql, s.repository, { retentionDays: 30 })
	const step = DAY_MS / 20
	const runAt = async (i: number) => {
		s.now = NOW + i * step
		return retention.run()
	}
	let i = 0
	// The queue fills and outlives its window.
	for (; i < 60; i++) await runAt(i)
	const restarts = (id: string) => s.statements.filter((x) => x.stmt === PAGE && x.args[0] === id && x.args[1] === "").length
	assert.ok(crowded.every((id) => restarts(id) >= 2), "every check expired and started over")
	// An eleventh room arrives after the queue is full.
	s.room("zz-new", NOW - 31 * DAY_MS, { history: [{ id: "decision-new" }] })
	const headScans = () => s.statements.filter((x) => x.stmt.startsWith(`SELECT id FROM ${ROOM} WHERE expires_at`)).length
	const scansBefore = headScans()
	// Its head goes (its records follow when the record cursors pass them, behind the crowded rooms' 19,200 records).
	for (let end = i + 30; i < end && s.table(ROOM).has("zz-new"); i++) await runAt(i)
	assert.ok(!s.table(ROOM).has("zz-new"), "the eleventh room is examined and removed")
	assert.deepEqual(s.published, ["decision-new"])
	assert.ok(headScans() - scansBefore >= 1, "the head scan keeps running")
	for (const id of crowded) assert.equal(s.rowsOf(id), 1 + ROOM_RECORD_TABLES.length + 64 * pagesPerRoom, "crowded rooms stay")
})

test("room retention: a room that keeps failing on a later page of its check backs off further each time", async () => {
	const s = store()
	s.room("crowded", NOW - 40 * DAY_MS)
	for (let i = 0; i < 100; i++)
		s.table(tables.participant.name).set(`p:crowded:${String(i).padStart(3, "0")}`, { room_id: "crowded", expires_at: NOW - 40 * DAY_MS, seq: 1, participant_id: `old-${i}` })
	// Every second-page read fails.
	const sql: Sql = async (stmt, args = []) => {
		if (stmt === PAGE && args[0] === "crowded" && args[1] !== "") throw new Error("Injected page failure")
		return s.sql(stmt, args)
	}
	const retention = new RoomRetention(sql, s.repository, { retentionDays: 30 })
	const failedRuns: number[] = []
	for (let run = 1; run <= 40; run++) if ((await retention.run()).failed) failedRuns.push(run)
	// Backoffs of 2, 4, 8, 16 runs, each followed by one run that reads the first page again.
	assert.deepEqual(failedRuns, [2, 5, 10, 19, 36])
})

test("room retention: every record table gets a share of the row budget, whatever comes first", async () => {
	const s = store()
	// Headless records: 1500 in every table, so the first ten tables alone could fill the run budget for 15 runs.
	for (const t of ROOM_RECORD_TABLES)
		for (let i = 0; i < 1500; i++) s.table(t.name).set(`${t.name}:${String(i).padStart(4, "0")}`, { room_id: `gone-${i % 50}`, expires_at: NOW - 40 * DAY_MS, seq: 1 })
	const retention = new RoomRetention(s.sql, s.repository, { retentionDays: 30 })
	const reached = new Set<string>()
	for (let run = 0; run < ROOM_RECORD_TABLES.length; run++) {
		const report = await retention.run()
		assert.ok(Object.values(report.deleted).reduce((a, b) => a + b, 0) <= 1000)
		for (const table of Object.keys(report.deleted)) reached.add(table)
	}
	assert.deepEqual([...reached].sort(), ROOM_RECORD_TABLES.map((t) => t.name).sort(), "each table deletes within one rotation")
	await drain(retention, 120)
	for (const t of ROOM_RECORD_TABLES) assert.equal(s.table(t.name).size, 0, t.name)
})

test("room retention: the row budget must fit one head", () => {
	const s = store()
	assert.throws(() => new RoomRetention(s.sql, s.repository, { retentionDays: 30, rowsPerRun: 1 }), /Invalid room retention bound/)
	assert.ok(new RoomRetention(s.sql, s.repository, { retentionDays: 30, rowsPerRun: 2 }))
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
