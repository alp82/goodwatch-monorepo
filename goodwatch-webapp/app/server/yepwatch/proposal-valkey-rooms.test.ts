import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { Redis } from "ioredis"
import { crateSql } from "./repository.server.ts"
import { RelationalProposalRepository } from "./proposal-relational-repository.ts"
import { provisionReleaseStore } from "./proposal-release-store.ts"
import { provisionDeletion } from "./proposal-deletion.ts"
import { provisionControl, ReleaseControl, DEFAULT_CONTROL } from "./proposal-release-control.ts"
import { SqlCreationQuotas } from "./proposal-creation-quota.ts"
import { ProposalService } from "./proposal-service.server.ts"
import { proposalFixtureCatalog } from "./proposal-test-support.ts"
import { MemoryCommandBudget } from "./proposal-command-budget.ts"
import { createRoomsValkey, K, roomsValkeyPassword, script } from "./proposal-rooms-valkey.ts"
import { ValkeyRoomRepository } from "./proposal-valkey-repository.ts"
import { ValkeyReleaseControl } from "./proposal-valkey-control.ts"
import { ValkeyAccountRooms, MirroredDeletionStore } from "./proposal-valkey-accounts.ts"
import { HistorySync } from "./proposal-history-sync.ts"
import { hash } from "./crypto.server.ts"
import { RoomError } from "./errors.ts"
import type { GuestAdmission } from "../../../packages/yepwatch-contracts/proposal.ts"

const enabled = process.env.YEPWATCH_TEST_ROOMS_VALKEY === "1"
const secret = "valkey-rooms-test-key-isolated-disposable-only"
const docker = (...args: string[]) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
const request = (nickname = "Guest") => ({
	contractVersion: 3 as const,
	commandId: randomBytes(16).toString("hex"),
	admissionSecret: randomBytes(32).toString("base64url"),
	nickname,
})
const credential = (a: GuestAdmission) => ({ participantId: a.credential.participantId, token: a.credential.token })
const until = async (check: () => Promise<boolean>, what: string, ms = 15000) => {
	const end = Date.now() + ms
	while (!(await check())) {
		if (Date.now() > end) throw new Error(`Timed out: ${what}`)
		await new Promise((r) => setTimeout(r, 50))
	}
}

test("live rooms in Valkey with a Crate history copy", { skip: !enabled, timeout: 300000 }, async (t) => {
	const tag = `${process.pid}-${randomBytes(3).toString("hex")}`
	const valkeyName = `yepwatch-rooms-valkey-test-${tag}`
	const crateName = `yepwatch-rooms-crate-test-${tag}`
	docker("run", "-d", "--rm", "--name", valkeyName, "-p", "127.0.0.1::6379", "valkey/valkey:8.1.10", "valkey-server",
		"--requirepass", roomsValkeyPassword(secret), "--appendonly", "yes", "--maxmemory-policy", "noeviction")
	docker("run", "-d", "--rm", "--name", crateName, "-p", "127.0.0.1::4200", "-e", "CRATE_HEAP_SIZE=512m", "crate:6.4.6",
		"crate", "-Cdiscovery.type=single-node", `-Ccluster.name=${crateName}`)
	t.after(() => {
		for (const name of [valkeyName, crateName]) try { docker("rm", "-f", name) } catch {}
	})
	const valkeyPort = docker("port", valkeyName, "6379/tcp").split(":").at(-1)
	const cratePort = docker("port", crateName, "4200/tcp").split(":").at(-1)
	const sql = crateSql(`http://127.0.0.1:${cratePort}`, "crate", "")
	await until(async () => sql("SELECT 1").then(() => true, () => false), "crate", 120000)
	await provisionReleaseStore(sql, 0, "valkey-test", secret)
	await provisionDeletion(sql, 0)
	await provisionControl(sql, DEFAULT_CONTROL, 0)
	const redis = createRoomsValkey(`redis://127.0.0.1:${valkeyPort}`, secret)
	await until(async () => redis.connect().then(() => true, () => false), "valkey")
	t.after(() => redis.disconnect())
	const raw = new Redis(`redis://127.0.0.1:${valkeyPort}`, { password: roomsValkeyPassword(secret) })
	t.after(() => raw.disconnect())

	let offset = 0
	const now = () => Date.now() + offset
	const crate = new RelationalProposalRepository(sql, secret)
	const quotas = new SqlCreationQuotas(sql, 3)
	let history!: HistorySync
	const deletions = new MirroredDeletionStore(redis, crate.deletionStore, () => history.caughtUp(), now)
	const accounts = new ValkeyAccountRooms(redis, crate.accountStore, secret, now)
	const repository = new ValkeyRoomRepository(redis, crate, secret, { accounts, deletions, retentionDays: 30, now })
	const logs: Record<string, unknown>[] = []
	history = new HistorySync({ redis, repository, crate, quotas, accounts: crate.accountStore, deletions, retentionDays: 30, now, log: (e) => logs.push(e) })
	const control = new ValkeyReleaseControl(redis, { roomsPerPerson: 3, admissions: 50, commands: 600, actorCommands: 60 }, new MemoryCommandBudget(now), quotas, now)
	const service = new ProposalService(repository, proposalFixtureCatalog, secret, async () => {}, now, control)

	// A room created by the Crate-only code before the deploy (the migration case).
	const legacy = new ProposalService(crate, proposalFixtureCatalog, secret, async () => {}, now, new ReleaseControl(sql, DEFAULT_CONTROL, quotas))
	const before = await legacy.create(request("Before"))
	history.start()

	await t.test("first import copies Crate's tables and live rooms, then rooms never read through", async () => {
		await history.maintain()
		assert.deepEqual(Object.keys(await raw.hgetall(K.mirror)).sort(), ["deletions", "invites", "quotas", "rooms", "sessions"])
		const imported = await raw.hmget(K.room(before.credential.roomId), "v", "s", "cs")
		assert.equal(imported[0], "1")
		assert.equal(imported[1], "1")
		assert.ok(imported[2], "imported rooms record the Crate head they match")
		assert.equal(await repository.read("not-a-room-anywhere"), null)
		// The pre-deploy room keeps working: the invite resolves through the imported mapping.
		assert.equal((await service.resolveInvite(before.invite.code)).roomId, before.credential.roomId)
	})

	const host = await service.create(request("Host"))
	const id = host.credential.roomId
	const guest = await service.join(id, { ...request("Peer"), inviteCode: host.invite.code })
	const send = async (who: GuestAdmission, command: any) => {
		const s = await service.read(id, credential(who))
		return service.command(id, credential(who), { commandId: randomBytes(16).toString("hex"), sequence: s.own.nextSequence, command })
	}

	await t.test("a whole room runs on Valkey and its newest state reaches Crate", async () => {
		let s = await service.read(id, credential(host))
		await send(host, {
			type: "setup",
			expectedContextVersion: s.shared.contextVersion,
			screens: [{ id: "screen", label: "TV", country: "DE", serviceIds: [8], confirmed: true }],
			constraints: { kinds: ["movie"], maxMinutes: null, moods: [] },
			screenId: "screen",
		})
		s = await service.read(id, credential(guest))
		await send(guest, { type: "assign_screen", expectedContextVersion: s.shared.contextVersion, screenId: "screen" })
		for (const who of [host, guest]) {
			s = await service.read(id, credential(who))
			await send(who, { type: "ready", expectedContextVersion: s.shared.contextVersion, ready: true })
		}
		s = await service.read(id, credential(host))
		await send(host, { type: "start", expectedRosterVersion: s.shared.rosterVersion, expectedContextVersion: s.shared.contextVersion })
		s = await service.read(id, credential(host))
		const candidate = s.shared.candidates[0].id
		for (const who of [host, guest]) {
			s = await service.read(id, credential(who))
			await send(who, { type: "vote", generation: s.shared.generation, candidateId: candidate, value: "watch", expectedVoteRevision: 0 })
		}
		const live = (await repository.read(id))!
		assert.equal(live.room.phase, "choosing")
		assert.equal(live.room.participants.every((p) => p.votes[candidate]?.value === "watch"), true)
		await history.kick()
		await until(async () => (await crate.read(id))?.room.revision === live.room.revision, "copy reaches Crate")
		const copied = (await crate.read(id))!
		assert.deepEqual(copied.room.participants.map((p) => p.votes), live.room.participants.map((p) => p.votes))
		assert.equal(copied.pendingRevision, 0, "a copied head carries no pending notification")
		// Its invite and capacity reservation were copied before the head: Crate-only code could serve the room.
		assert.equal(await crate.findInvite(hash(host.invite.code)), id)
		await quotas.active(id, live.room.expiresAt)
		const [v, synced] = await raw.hmget(K.room(id), "v", "s")
		assert.equal(synced, v)
		assert.ok((await raw.pttl(K.room(id))) > 0, "a synced room expires")
		assert.equal(await raw.zcard(K.jobs), 0)
	})

	await t.test("stale compare-and-swap, notifications and pending repair", async () => {
		const stored = (await repository.read(id))!
		const next = structuredClone(stored.room)
		next.revision++
		assert.equal(await repository.compareAndSwap(stored, next, true), true)
		assert.equal(await repository.compareAndSwap(stored, next, true), false, "an older version never lands")
		assert.equal(await repository.compareAndSwap({ ...stored, seq: stored.seq + 1, term: stored.term + 1 }, next, true), false, "another incarnation never lands")
		assert.ok((await repository.pending(10)).includes(id))
		await repository.acknowledge(id, next.revision)
		assert.ok(!(await repository.pending(10)).includes(id))
		assert.equal((await repository.read(id))!.pendingRevision, 0)
		assert.equal((await raw.pttl(K.room(id))), -1, "an unsynced room never expires")
		await history.kick()
		await until(async () => (await crate.read(id))?.room.revision === next.revision, "copy")
	})

	await t.test("a head written by anyone else wins, its revision raised above both", async () => {
		const stored = (await crate.read(id))!
		const foreign = structuredClone(stored.room)
		foreign.revision++
		foreign.participants[0].nickname = "Rolled back"
		assert.equal(typeof (await crate.archive(foreign, { seq: stored.seq, term: stored.term })), "object")
		const live = (await repository.read(id))!
		const mine = structuredClone(live.room)
		mine.revision++
		mine.participants[1].nickname = "Lost"
		assert.equal(await repository.compareAndSwap(live, mine, true), true)
		await history.kick()
		await until(async () => (await repository.read(id))!.room.participants[0].nickname === "Rolled back", "Crate wins")
		const after = (await repository.read(id))!
		assert.ok(after.room.revision > mine.revision, "phones see a newer revision")
		assert.notEqual(after.term, live.term, "a replaced room is a new incarnation")
		await history.kick()
		await until(async () => (await crate.read(id))?.room.revision === after.room.revision, "replacement copied")
		assert.ok(logs.some((e) => e.event === "yepwatch_history_replaced"))
	})

	await t.test("a late copy record from an older incarnation never touches the replacement", async () => {
		// The replacement's copy can still be recording itself (Crate already has it): wait until no job is left.
		await history.kick()
		await until(async () => (await raw.zcard(K.jobs)) === 0, "idle")
		const [v, s, cs] = await raw.hmget(K.room(id), "v", "s", "cs")
		await raw.zadd(K.jobs, 5, `room:${id}`)
		assert.equal(Number(await script(redis, "ywSynced", K.jobs, K.tries, K.room(id), `room:${id}`, 5, 999, 1, 1, Date.now(), "1")), 4)
		assert.deepEqual(await raw.hmget(K.room(id), "v", "s", "cs"), [v, s, cs])
		assert.ok((await raw.zscore(K.jobs, `room:${id}`)) !== null, "the replacement keeps its job")
		await raw.zrem(K.jobs, `room:${id}`)
	})

	await t.test("this store's own write whose record was lost is adopted, not replaced", async () => {
		const live = (await repository.read(id))!
		const next = structuredClone(live.room)
		next.revision++
		next.participants[0].nickname = "Adopted"
		// Hold the room's copy job until the crash is staged: the background loop runs due jobs every second, and a
		// copy before the staged write below would move the Crate head under it.
		await raw.zadd(K.jobs, Date.now() + 60_000, `room:${id}`)
		assert.equal(await repository.compareAndSwap(live, next, false), true)
		// A worker wrote it to Crate and crashed before recording it.
		const [v, cs, ct] = await raw.hmget(K.room(id), "v", "cs", "ct")
		await raw.hset(K.room(id), "w", v!, "wf", `${v}:${crate.fingerprint(next)}`)
		assert.equal(typeof (await crate.archive(next, { seq: Number(cs), term: Number(ct) })), "object")
		// Staged: now the job is due.
		await raw.zadd(K.jobs, "XX", 1, `room:${id}`)
		await history.kick()
		await until(async () => (await raw.hget(K.room(id), "s")) === v, "adopted")
		assert.equal((await repository.read(id))!.room.participants[0].nickname, "Adopted")
		assert.equal((await repository.read(id))!.term, live.term)
	})

	await t.test("a write whose answer was lost and lands late never replaces newer live state", async () => {
		await history.kick()
		await until(async () => (await raw.zcard(K.jobs)) === 0, "idle")
		const [, cs, ct] = await raw.hmget(K.room(id), "v", "cs", "ct")
		let live = (await repository.read(id))!
		const a = structuredClone(live.room)
		a.revision++
		a.participants[0].nickname = "Late A"
		// Hold the copy job (there is none after idle, so not XX) until the lost write is staged.
		await raw.zadd(K.jobs, Date.now() + 60_000, `room:${id}`)
		assert.equal(await repository.compareAndSwap(live, a, false), true)
		const [va] = await raw.hmget(K.room(id), "v")
		await raw.hset(K.room(id), "w", va!, "wf", `${va}:${crate.fingerprint(a)}`)
		live = (await repository.read(id))!
		const b = structuredClone(live.room)
		b.revision++
		b.participants[0].nickname = "Newer B"
		assert.equal(await repository.compareAndSwap(live, b, false), true)
		// The lost write of A lands now, on the head this store recorded.
		assert.equal(typeof (await crate.archive(a, { seq: Number(cs), term: Number(ct) })), "object")
		await raw.zadd(K.jobs, "XX", 1, `room:${id}`)
		await history.kick()
		await until(async () => (await crate.read(id))?.room.participants[0].nickname === "Newer B", "B reaches Crate")
		assert.equal((await repository.read(id))!.room.participants[0].nickname, "Newer B")
		assert.equal((await repository.read(id))!.term, live.term, "adopted, not replaced")
	})

	await t.test("a room expired before its copy still reaches Crate (no clock fence on the copy)", async () => {
		const room = structuredClone((await repository.read(id))!.room)
		room.id = randomBytes(16).toString("hex")
		room.expiresAt = Date.now() - 1000
		for (const c of room.candidates) void c
		assert.equal(typeof (await crate.archive(room, null)), "object")
		assert.equal((await crate.read(room.id))!.room.expiresAt, room.expiresAt)
	})

	await t.test("allowance, admission budget, exact retries and capacity proofs", async () => {
		const creator = "creator-digest-for-allowance-test"
		const rooms = await Promise.all([1, 2, 3].map(async (n) => (await control.create(`allowance-${n}`, `a${n}`, creator))!))
		assert.equal(rooms.every((e) => Math.abs(e - now() - 6 * 3600_000) < 5000), true)
		assert.equal(await control.create("allowance-1", "a1", creator), rooms[0], "an exact retry gets its expiry")
		await assert.rejects(control.create("allowance-1", "changed", creator), /Admission retry changed/)
		await assert.rejects(control.create("allowance-4", "a4", creator), /up to 3 rooms/)
		await assert.rejects(control.join("no-such-room", "p", "d"), (e: RoomError) => e.status === 503)
		await control.join("allowance-1", "p", "d")
		await control.active({ id: "allowance-1", expiresAt: rooms[0] })
		await assert.rejects(control.active({ id: "allowance-1", expiresAt: rooms[0] + 1 }), (e: RoomError) => e.status === 503)
		offset += 6 * 3600_000 + 5000
		await assert.rejects(control.active({ id: "allowance-1", expiresAt: rooms[0] }), /expired/)
		assert.ok(await control.create("allowance-5", "a5", creator), "expired rooms free the allowance")
		const budget = new ValkeyReleaseControl(redis, { roomsPerPerson: 10, admissions: 2, commands: 600, actorCommands: 60 }, new MemoryCommandBudget(now), quotas, now)
		offset += 60_000
		await budget.create("budget-1", "b1", "budget-creator")
		await budget.create("budget-2", "b2", "budget-creator")
		await assert.rejects(budget.create("budget-3", "b3", "budget-creator"), /Admission budget reached/)
		offset = 0
	})

	await t.test("log out and deletion fence first, in Valkey, and read from there", async () => {
		const session = "session-for-logout-test"
		assert.equal(await accounts.sessionActive(session), true)
		await accounts.revokeSession(session, Date.now() + 3600_000)
		assert.equal(await accounts.sessionActive(session), false)
		assert.equal(await crate.accountStore.sessionActive(session), false, "Crate keeps the copy")
		const subject = { kind: "account" as const, userId: "user-for-deletion-test" }
		assert.equal(await deletions.get(subject), null)
		const state = await deletions.schedule(subject, Date.now())
		assert.deepEqual(await deletions.get(subject), state)
		await deletions.restore(subject, Date.now())
		assert.equal(await deletions.get(subject), null)
		await deletions.importMarkers()
		assert.equal(await deletions.get(subject), null)
	})

	await t.test("account rooms and decision history go through the outbox", async () => {
		await accounts.remember("user-1", { roomId: id, expiresAt: Date.now() + 3600_000 })
		assert.deepEqual((await accounts.rooms("user-1")).map((r) => r.roomId), [id])
		await history.kick()
		await until(async () => (await crate.accountStore.rooms("user-1")).some((r) => r.roomId === id), "index copied")
	})

	await t.test("a lost Valkey reads rooms back from Crate", async () => {
		await history.kick()
		const synced = (await crate.read(id))!
		await raw.flushall()
		assert.equal((await repository.read(id))!.room.revision, synced.room.revision, "read through while not imported")
		await history.ensureMirrors()
		assert.equal((await raw.hget(K.mirror, "rooms")), "1")
		assert.equal((await service.read(id, credential(host))).shared.revision >= synced.room.revision, true)
	})
	await history.stop()
})
