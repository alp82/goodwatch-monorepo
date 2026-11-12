import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { crateSql, type Sql } from "./repository.server.ts"
import { RelationalProposalRepository } from "./proposal-relational-repository.ts"
import { provisionReleaseStore } from "./proposal-release-store.ts"
import { provisionControl, DEFAULT_CONTROL } from "./proposal-release-control.ts"
import { ProposalService } from "./proposal-service.server.ts"
import { proposalFixtureCatalog } from "./proposal-test-support.ts"
import { tables, accountHistoryTable, invitationTable } from "./proposal-storage-schema.ts"
import { DAY_MS, RoomRetention, ROOM_RECORD_TABLES } from "./proposal-room-retention.ts"

const enabled = process.env.YEPWATCH_TEST_RELATIONAL_CRATE === "1"
const secret = "room-retention-test-key-isolated-disposable-only"
const docker = (...args: string[]) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
const request = (nickname: string) => ({
	contractVersion: 3 as const,
	commandId: randomBytes(16).toString("hex"),
	admissionSecret: randomBytes(32).toString("base64url"),
	nickname,
})
const ALL = [tables.room.name, ...ROOM_RECORD_TABLES.map((t) => t.name)]

test("room retention on disposable Crate: old rooms leave no rows in any table, newer and live rooms stay readable", { skip: !enabled, timeout: 240000 }, async (t) => {
	const name = `yepwatch-retention-test-${process.pid}`
	docker("run", "-d", "--name", name, "-p", "127.0.0.1::4200", "-e", "CRATE_HEAP_SIZE=512m", "crate:5.10.16", "crate", "-Cdiscovery.type=single-node", "-Ccluster.name=" + name)
	t.after(() => {
		docker("rm", "-f", name)
	})
	const port = docker("port", name, "4200/tcp").split(":").at(-1)
	const sql: Sql = crateSql(`http://127.0.0.1:${port}`, "crate", "")
	for (let i = 0; ; i++) {
		try {
			await sql("SELECT 1")
			break
		} catch (e) {
			if (i > 100) throw e
			await new Promise((r) => setTimeout(r, 300))
		}
	}
	await provisionReleaseStore(sql, 0, "retention-test", secret)
	await provisionControl(sql, DEFAULT_CONTROL, 0)
	const repository = new RelationalProposalRepository(sql, secret)
	const service = new ProposalService(repository, proposalFixtureCatalog, secret)

	let people = 0
	/**
	 * A signed-in host on two devices and a guest: setup, votes, a confirmed decision archived by Start again, a member
	 * grant and intent, connection tickets, receipts and an invitation.
	 */
	async function room() {
		const n = ++people
		const phone = { userId: `retention-member-${n}`, sessionId: `phone-${n}`, expiresAt: Date.now() + 86400_000 }
		const admission = await service.create(request("Host"), phone)
		const id = admission.credential.roomId
		const host = { ...admission.credential, accountId: phone.userId, sessionId: phone.sessionId }
		await service.resumeAccount(id, { ...phone, sessionId: `laptop-${n}` })
		const joined = await service.join(id, { ...request("Peer"), inviteCode: admission.invite.code })
		const guest = { participantId: joined.credential.participantId, token: joined.credential.token }
		const send = async (actor: any, command: (s: any) => any) => {
			const s = await service.read(id, actor)
			return service.command(id, actor, { commandId: randomBytes(16).toString("hex"), sequence: s.own.nextSequence, command: command(s) } as any)
		}
		await send(host, (s) => ({
			type: "setup",
			expectedContextVersion: s.shared.contextVersion,
			screens: [{ id: "screen", label: "TV", country: "DE", serviceIds: [8], confirmed: true }],
			constraints: { kinds: ["movie"], maxMinutes: null, moods: [] },
			screenId: "screen",
		}))
		await send(guest, (s) => ({ type: "assign_screen", expectedContextVersion: s.shared.contextVersion, screenId: "screen" }))
		for (const actor of [host, guest]) await send(actor, (s) => ({ type: "ready", expectedContextVersion: s.shared.contextVersion, ready: true }))
		await send(host, (s) => ({ type: "start", expectedRosterVersion: s.shared.rosterVersion, expectedContextVersion: s.shared.contextVersion }))
		for (const actor of [host, guest])
			await send(actor, (s) => ({ type: "vote", generation: s.shared.generation, candidateId: s.shared.candidates[0].id, value: "watch", expectedVoteRevision: 0, activeExposureMs: 1000 }))
		await send(host, (s) => ({ type: "propose", generation: s.shared.generation, expectedRosterVersion: s.shared.rosterVersion, expectedProposalVersion: s.shared.proposalVersion, candidateId: s.shared.candidates[0].id }))
		const decided = (
			await send(guest, (s) => ({
				type: "agree",
				generation: s.shared.generation,
				expectedRosterVersion: s.shared.rosterVersion,
				expectedProposalVersion: s.shared.proposalVersion,
				candidateId: s.shared.proposal.candidateId,
				expectedOwnAgreementRevision: s.own.agreement.revision,
				agreed: true,
			}))
		).snapshot
		assert.equal(decided.shared.phase, "decided")
		// Start again archives the decision into the room's history and opens a new round.
		await send(host, () => ({ type: "restart", expectedRevision: decided.shared.revision }))
		// A background acknowledgement may move the head between read and swap; retry like a writer would.
		for (let attempt = 0; ; attempt++) {
			assert.ok(attempt < 10, "member grant committed")
			const current = (await repository.read(id))!
			const linked = structuredClone(current.room)
			linked.revision++
			const member = linked.participants.find((p) => p.memberUserId === phone.userId)!
			member.memberGrant = { accessToken: `grant-${n}`, expiresAt: Date.now() + 100_000 }
			linked.memberIntents = [
				{ stateHash: `state-${n}`, participantId: guest.participantId, epoch: 0, expiresAt: Date.now() + 100_000, client: "native", returnTo: "yepwatch://auth/callback", challenge: "challenge", verifier: "verifier", status: "ready", codeHash: null },
			]
			if (await repository.compareAndSwap(current, linked, false)) break
			await new Promise((r) => setTimeout(r, 50))
		}
		for (const actor of [host, guest]) await service.ticket(id, actor)
		const whole = (await repository.read(id))!.room
		assert.equal(whole.phase, "setup")
		assert.equal(whole.history?.length, 1, "one archived decision")
		assert.equal(whole.participants.find((p) => p.memberUserId === phone.userId)!.sessions?.length, 2, "two account sessions")
		assert.equal(whole.tickets.length, 2)
		codes.set(id, admission.invite.code)
		guests.set(id, guest.participantId)
		return id
	}
	const guests = new Map<string, string>()
	const codes = new Map<string, string>()
	/** Moves a room's expiry into the past: the head by its own compare-and-swap, every other row to match. */
	async function expire(id: string, expiresAt: number, refresh = ALL) {
		const stored = (await repository.read(id))!
		const expired = structuredClone(stored.room)
		expired.expiresAt = expiresAt
		expired.revision++
		assert.equal(await repository.compareAndSwap(stored, expired, false), true)
		await sql(`REFRESH TABLE ${refresh.join(",")}`) // the UPDATE below finds rows by search
		for (const table of ROOM_RECORD_TABLES) await sql(`UPDATE ${table.name} SET expires_at=? WHERE room_id=?`, [expiresAt, id])
	}
	const rows = async (id: string) => {
		const counts: Record<string, number> = {}
		for (const table of ALL) {
			const n = Number((await sql(`SELECT count(*) FROM ${table} WHERE ${table === tables.room.name ? "id" : "room_id"}=?`, [id])).rows[0][0])
			if (n) counts[table] = n
		}
		return counts
	}

	const RECORDS = ROOM_RECORD_TABLES.map((t) => t.name)
	const HISTORY = accountHistoryTable.name
	const historyColumns = "id,room_id,room_label,title,year,poster_url,decided_at,people,account_ids,participant_ids"
	const history = async (id: string) => {
		await sql(`REFRESH TABLE ${HISTORY}`)
		return (await sql(`SELECT ${historyColumns} FROM ${HISTORY} WHERE room_id=? ORDER BY id`, [id])).rows
	}
	/** Runs instances until two rounds in a row delete nothing; every run stays within its aggregate row limit. */
	async function quiet(instances: RoomRetention[], refresh: string[], limit: number) {
		const totals: Record<string, number> = {}
		const reports = []
		for (let round = 0, calm = 0; calm < 2; round++) {
			assert.ok(round < 80, "cleanup finishes")
			await sql(`REFRESH TABLE ${refresh.join(",")}`) // stands in for the minute between runs (refresh_interval is 1 s)
			let any = false
			for (const report of await Promise.all(instances.map((r) => r.run()))) {
				reports.push(report)
				const total = Object.values(report.deleted).reduce((a, b) => a + b, 0)
				assert.ok(total <= limit, `one run deleted ${total} rows`)
				for (const [table, n] of Object.entries(report.deleted)) totals[table] = (totals[table] ?? 0) + n
				any ||= total > 0 || report.rooms > 0
			}
			calm = any ? 0 : calm + 1
		}
		return { totals, rooms: reports.reduce((n, r) => n + r.rooms, 0), reports }
	}

	const old = [await room(), await room(), await room()]
	const recent = await room()
	const live = await room()
	const waiting = await room()
	const stale = await room()
	const now = Number((await sql("SELECT CURRENT_TIMESTAMP")).rows[0][0])
	await expire(old[0], now - 30 * DAY_MS - 60_000)
	await expire(old[1], now - 45 * DAY_MS)
	await expire(old[2], now - 31 * DAY_MS)
	await expire(recent, now - 29 * DAY_MS)
	await expire(waiting, now - 40 * DAY_MS)
	await sql(`REFRESH TABLE ${[...ALL, HISTORY].join(",")}`)
	for (const id of [...old, recent, live, waiting, stale]) assert.ok(await repository.read(id), "fixture rooms are whole before cleanup")
	const before = await rows(old[0])
	for (const table of [tables.room, tables.participant, tables.candidate, tables.vote, tables.receipt, tables.agreement, tables.history, tables.ticket, tables.grant, tables.intent, tables.decision])
		assert.ok(before[table.name] > 0, `fixture fills ${table.name}`)
	assert.ok(before[invitationTable.name] > 0, "fixture fills the invitation")

	// The confirmed history every old room must leave behind, exactly. One room's rows are removed first: retention
	// must publish them again from the head before deleting it.
	const durable = new Map<string, unknown[][]>()
	for (const id of old) {
		durable.set(id, await history(id))
		assert.equal(durable.get(id)!.length, 1, "the archived decision was published when it was made")
	}
	await sql(`DELETE FROM ${HISTORY} WHERE room_id=?`, [old[1]])
	assert.deepEqual(await history(old[1]), [])

	// The guest of one old room asked for deletion: that request's purge owns the room, retention leaves it whole.
	await service.deletions.schedule({ kind: "guest", roomId: waiting, participantId: guests.get(waiting)! }, now)

	// Stale search visibility: the stale room's head expires but the room table is not refreshed, so search still sees
	// the old expiry while its records already match the cutoff. Records are checked against the head by primary key.
	await sql(`ALTER TABLE ${tables.room.name} SET (refresh_interval=0)`)
	await expire(stale, now - 50 * DAY_MS, RECORDS)
	await sql(`REFRESH TABLE ${RECORDS.join(",")}`)
	const keptBefore = { recent: await rows(recent), live: await rows(live), waiting: await rows(waiting), stale: await rows(stale) }

	const oldBefore = new Map<string, Record<string, number>>()
	for (const id of old) oldBefore.set(id, await rows(id))
	// History publication fails: nothing of any room is deleted, the failure is reported per room.
	const failing = new RoomRetention(
		sql,
		{ read: (id) => repository.read(id), accountStore: { publish: async () => { throw new Error("history unavailable") } }, deletionStore: repository.deletionStore },
		{ retentionDays: 30, roomsPerRun: 100 }
	)
	const refused = await failing.run()
	assert.equal(refused.failed, 3, "the three old rooms")
	assert.equal(refused.waiting, 1)
	assert.equal(refused.rooms, 0)
	assert.deepEqual(refused.deleted, {})
	for (const id of old) assert.deepEqual(await rows(id), oldBefore.get(id), "every row of every old room is still there")

	// Interrupted after removing a head: its records stay unreachable until a later run.
	let state: "armed" | "crash" | "done" = "armed"
	const crashing: Sql = async (stmt, args) => {
		if (state === "crash") {
			state = "done"
			throw new Error("Injected crash after head removal")
		}
		const result = await sql(stmt, args)
		if (state === "armed" && stmt.startsWith("DELETE FROM doc.yepwatch_room ") && result.rowcount === 1) state = "crash"
		return result
	}
	await assert.rejects(new RoomRetention(crashing, new RelationalProposalRepository(crashing, secret), { retentionDays: 30, roomsPerRun: 1 }).run(), /Injected crash/)
	const headless = []
	for (const id of old) if (!(await repository.read(id))) headless.push(id)
	assert.equal(headless.length, 1)
	assert.ok(Object.keys(await rows(headless[0])).length > 0)

	// Two API instances, small batches, while the room table stays unrefreshed: removed heads stay visible to search.
	const instances = [0, 1].map(() => new RoomRetention(sql, new RelationalProposalRepository(sql, secret), { retentionDays: 30, rowsPerStatement: 20, rowsPerRun: 120 }))
	const first = await quiet(instances, RECORDS, 120)
	assert.equal(first.rooms, 2, "the two remaining old heads, each removed once")
	assert.ok(first.reports.some((r) => r.waiting === 1), "the room with a deletion request waits")
	assert.deepEqual(await rows(stale), keptBefore.stale, "records of a head search cannot see yet are kept")
	assert.ok(await repository.read(stale), "and the room stays readable")

	// Search catches up: the stale room goes too.
	await sql(`ALTER TABLE ${tables.room.name} SET (refresh_interval=1000)`)
	const second = await quiet(instances, ALL, 120)
	assert.equal(second.rooms, 1, "the stale head")
	const totals = { ...first.totals }
	for (const [table, n] of Object.entries(second.totals)) totals[table] = (totals[table] ?? 0) + n

	await sql(`REFRESH TABLE ${ALL.join(",")}`)
	for (const id of [...old, stale]) assert.deepEqual(await rows(id), {}, "no rows left in any table")
	for (const table of ALL) {
		const orphans = table === tables.room.name ? 0 : Number((await sql(`SELECT count(*) FROM ${table} WHERE room_id NOT IN (SELECT id FROM ${tables.room.name})`)).rows[0][0])
		assert.equal(orphans, 0, `${table} has no rows without a head`)
	}
	for (const id of old) assert.deepEqual(await history(id), durable.get(id), "exactly the confirmed history survives")
	assert.equal((await history(stale)).length, 1)
	assert.deepEqual(await rows(recent), keptBefore.recent)
	assert.deepEqual(await rows(live), keptBefore.live)
	assert.deepEqual(await rows(waiting), keptBefore.waiting)
	assert.ok(await repository.read(recent))
	const fresh = new ProposalService(new RelationalProposalRepository(sql, secret), proposalFixtureCatalog, secret)
	assert.equal((await fresh.resolveInvite(codes.get(live)!)).roomId, live)
	await assert.rejects(fresh.resolveInvite(codes.get(old[1])!))

	// Restoring the deletion request releases the room.
	await service.deletions.restore({ kind: "guest", roomId: waiting, participantId: guests.get(waiting)! }, now)
	const third = await quiet(instances, ALL, 120)
	assert.equal(third.rooms, 1)
	assert.deepEqual(await rows(waiting), {})
	assert.equal((await history(waiting)).length, 1)
	// Replica loss cannot be simulated on a single local node; heads and records are only removed by primary key, which
	// Crate routes to the primary shard, and every search result is re-checked by primary key before a delete.
	t.diagnostic(JSON.stringify({ deleted: totals }))
})
