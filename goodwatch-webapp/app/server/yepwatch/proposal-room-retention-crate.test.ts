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
import { tables, accountHistoryTable } from "./proposal-storage-schema.ts"
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

	/** A started room with two people, a deck, votes, receipts and an invitation. */
	async function room() {
		const admission = await service.create(request("Host"))
		const id = admission.credential.roomId
		const host = { participantId: admission.credential.participantId, token: admission.credential.token }
		const joined = await service.join(id, { ...request("Peer"), inviteCode: admission.invite.code })
		const guest = { participantId: joined.credential.participantId, token: joined.credential.token }
		const send = async (actor: typeof host, command: (s: any) => any) => {
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
		codes.set(id, admission.invite.code)
		return id
	}
	const codes = new Map<string, string>()
	/** Moves a room's expiry into the past: the head by its own compare-and-swap, every other row to match. */
	async function expire(id: string, expiresAt: number) {
		const stored = (await repository.read(id))!
		const expired = structuredClone(stored.room)
		expired.expiresAt = expiresAt
		expired.revision++
		assert.equal(await repository.compareAndSwap(stored, expired, false), true)
		await sql(`REFRESH TABLE ${ALL.join(",")}`) // the UPDATE below finds rows by search
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

	const old = [await room(), await room(), await room()]
	const recent = await room()
	const live = await room()
	const now = Number((await sql("SELECT CURRENT_TIMESTAMP")).rows[0][0])
	await expire(old[0], now - 30 * DAY_MS - 60_000)
	await expire(old[1], now - 45 * DAY_MS)
	await expire(old[2], now - 31 * DAY_MS)
	await expire(recent, now - 29 * DAY_MS)
	await sql(`REFRESH TABLE ${[...ALL, accountHistoryTable.name].join(",")}`)
	for (const id of [...old, recent, live]) assert.ok(await repository.read(id), "fixture rooms are whole before cleanup")
	const before = await rows(old[0])
	for (const table of [tables.room, tables.participant, tables.candidate, tables.vote, tables.receipt, tables.agreement])
		assert.ok(before[table.name] > 0, `fixture fills ${table.name}`)
	const keptBefore = { recent: await rows(recent), live: await rows(live) }

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

	// Two API instances, small batches, run until quiet (as the per-minute timer would).
	const instances = [0, 1].map(() => new RoomRetention(sql, new RelationalProposalRepository(sql, secret), { retentionDays: 30, rowsPerStatement: 20, rowsPerRun: 120 }))
	const totals: Record<string, number> = {}
	let rooms = 0
	for (let round = 0, quiet = 0; quiet < 2; round++) {
		assert.ok(round < 60, "cleanup finishes")
		await sql(`REFRESH TABLE ${ALL.join(",")}`) // stands in for the minute between runs (refresh_interval is 1 s)
		const reports = await Promise.all(instances.map((r) => r.run()))
		let any = false
		for (const report of reports) {
			rooms += report.rooms
			for (const [table, n] of Object.entries(report.deleted)) {
				totals[table] = (totals[table] ?? 0) + n
				assert.ok(n <= 120)
				any = true
			}
		}
		quiet = any ? 0 : quiet + 1
	}
	assert.equal(rooms, 2, "the two remaining heads, each removed once")
	await sql(`REFRESH TABLE ${ALL.join(",")}`)
	for (const id of old) assert.deepEqual(await rows(id), {}, "no orphan rows in any table")
	for (const table of ALL) {
		const orphans = table === tables.room.name ? 0 : Number((await sql(`SELECT count(*) FROM ${table} WHERE room_id NOT IN (SELECT id FROM ${tables.room.name})`)).rows[0][0])
		assert.equal(orphans, 0, `${table} has no rows without a head`)
	}
	assert.deepEqual(await rows(recent), keptBefore.recent)
	assert.deepEqual(await rows(live), keptBefore.live)
	assert.ok(await repository.read(recent))
	const fresh = new ProposalService(new RelationalProposalRepository(sql, secret), proposalFixtureCatalog, secret)
	assert.equal((await fresh.resolveInvite(codes.get(live)!)).roomId, live)
	await assert.rejects(fresh.resolveInvite(codes.get(old[1])!))
	t.diagnostic(JSON.stringify({ deleted: totals }))
})
