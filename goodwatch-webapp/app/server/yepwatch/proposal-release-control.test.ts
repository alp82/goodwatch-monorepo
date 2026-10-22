import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import {
	ReleaseControl,
	DEFAULT_CONTROL,
	CONTROL_TABLE,
	provisionControl,
	controlFingerprint,
	BudgetError,
} from "./proposal-release-control.ts"
import { CONTINUOUS_LIMITS } from "./continuous-types.ts"
import { ProposalService } from "./proposal-service.server.ts"
import {
	ProposalMemoryRepository,
	proposalFixtureCatalog,
} from "./proposal-test-support.ts"
import { IndeterminateWrite, RoomError } from "./errors.ts"
import { createProposalHandler } from "./proposal-http.server.ts"
import { paths } from "../../../packages/yepwatch-contracts/proposal.ts"
import type { Sql } from "./repository.server.ts"
const secret = "ordinary-control-tests-at-least-thirty-two"
const admission = () => ({
	contractVersion: 3 as const,
	commandId: randomBytes(16).toString("hex"),
	admissionSecret: randomBytes(32).toString("base64url"),
	nickname: "A",
})
const who = (a: Awaited<ReturnType<ProposalService["create"]>>) => ({
	participantId: a.credential.participantId,
	token: a.credential.token,
})
function database(policy = DEFAULT_CONTROL) {
	let payload = JSON.stringify({
			format: 1,
			fingerprint: controlFingerprint(policy),
			window: -1,
			rooms: [],
			admissions: [],
			commands: [],
		}),
		seq = 0,
		now = 1_800_000_010_000,
		lost = false,
		failProof = false,
		late = false,
		failAfterUpdate = false
	const sql: Sql = async (stmt, args = []) => {
		if (stmt.startsWith("SELECT payload,_seq_no")) {
			if (failProof) {
				failProof = false
				throw new RoomError("busy", "Read unavailable", 503, true)
			}
			return { rows: [[payload, seq, 1, now]], rowcount: 1 }
		}
		if (stmt.startsWith("UPDATE " + CONTROL_TABLE)) {
			if (late) {
				now = Number(args[0])
				late = false
			}
			if (args[3] !== seq || args[4] !== 1) return { rows: [], rowcount: 0 }
			if (now < Number(args[0])) payload = String(args[1])
			seq++
			if (failAfterUpdate) {
				failAfterUpdate = false
				failProof = true
			}
			if (lost) {
				lost = false
				throw new IndeterminateWrite("Lost control acknowledgement")
			}
			return { rows: [], rowcount: 1 }
		}
		throw Error("Unexpected test statement: " + stmt)
	}
	return {
		sql,
		now: () => now,
		advance: (ms: number) => {
			now += ms
		},
		state: () => JSON.parse(payload),
		loseAndHideProof: () => {
			lost = true
			failAfterUpdate = true
		},
		lose: () => {
			lost = true
		},
		failNextRead: () => {
			failProof = true
		},
		delayNextCas: () => {
			late = true
		},
	}
}
test("Global reservation cap across independent instances; repeated denial has no writes, identity changes conflict, restart preserves original expiry", async () => {
	const policy = { ...DEFAULT_CONTROL, rooms: 2 },
		db = database(policy),
		a = new ReleaseControl(db.sql, policy),
		b = new ReleaseControl(db.sql, policy)
	const expiry = await a.create("room-a", "digest-a")
	await b.create("room-b", "digest-b")
	const before = db.state()
	for (let i = 0; i < 4; i++)
		await assert.rejects(
			b.create("room-c", "digest-c"),
			(e: BudgetError) => e.status === 503 && e.retryAfterSeconds > 0
		)
	assert.deepEqual(db.state(), before)
	await assert.rejects(a.create("room-a", "changed"), /retry changed/)
	db.advance(60_000)
	assert.equal(
		await new ReleaseControl(db.sql, policy).create("room-a", "digest-a"),
		expiry
	)
	db.advance(CONTINUOUS_LIMITS.roomMs)
	await assert.rejects(
		a.active({ id: "room-a", expiresAt: expiry }),
		(e: RoomError) => e.status === 410
	)
	await b.create("room-c", "digest-c")
	assert.equal(db.state().rooms.length, 1)
})
test("Concurrent capacity grants and original window fencing use CAS, never process-local counters", async () => {
	const policy = { ...DEFAULT_CONTROL, rooms: 3 },
		db = database(policy)
	const outcomes = await Promise.allSettled(
		Array.from({ length: 10 }, (_, i) =>
			new ReleaseControl(db.sql, policy).create(`room-${i}`, `digest-${i}`)
		)
	)
	assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 3)
	assert.equal(db.state().rooms.length, 3)
	const db2 = database()
	db2.delayNextCas()
	await new ReleaseControl(db2.sql, DEFAULT_CONTROL).create("late", "d")
	assert.equal(db2.state().window, Math.floor(db2.now() / 60_000))
	assert.equal(db2.state().admissions.length, 1)
})
test("Global admission/command and per-actor budgets remain bounded; exact permits recover lost acknowledgement and windows reset on SQL time", async () => {
	const policy = { rooms: 5, admissions: 2, commands: 3, actorCommands: 2 },
		db = database(policy),
		control = new ReleaseControl(db.sql, policy)
	db.lose()
	const expiry = await control.create("r", "d")
	await control.join("r", "a", "join-a")
	await control.join("r", "a", "join-a")
	await assert.rejects(
		control.join("r", "b", "join-b"),
		(e: BudgetError) => e.status === 429
	)
	db.lose()
	await control.command("r", "a", "cmd-a")
	await control.command("r", "a", "cmd-a")
	await control.command("r", "a", "cmd-b")
	await assert.rejects(
		control.command("r", "a", "cmd-c"),
		(e: BudgetError) => e.status === 429
	)
	await control.command("r", "b", "cmd-c")
	const before = db.state()
	for (let i = 0; i < 3; i++)
		await assert.rejects(
			control.command("r", "c", "cmd-d"),
			(e: BudgetError) => e.status === 429
		)
	assert.deepEqual(db.state(), before)
	db.advance(60_000)
	await new ReleaseControl(db.sql, policy).command("r", "a", "cmd-d")
	assert.equal(db.state().commands.length, 1)
	assert.equal(db.state().rooms[0][2], expiry)
	await assert.rejects(
		new ReleaseControl(db.sql, { ...policy, rooms: 6 }).check(),
		/configuration mismatch/
	)
	db.advance(-120_000)
	await assert.rejects(control.command("r", "a", "other"), /clock window/)
})
test("Service guard charges only authenticated valid new commands; retained receipts and exact lost-ack admission replay work at exhausted budgets", async () => {
	const policy = { rooms: 1, admissions: 1, commands: 2, actorCommands: 2 },
		db = database(policy),
		guard = new ReleaseControl(db.sql, policy),
		repo = new ProposalMemoryRepository()
	const service = new ProposalService(
		repo,
		proposalFixtureCatalog,
		secret,
		async () => {},
		db.now,
		guard
	)
	const request = admission(),
		a = await service.create(request),
		id = a.credential.roomId
	assert.equal(
		(await service.create(request)).credential.participantId,
		a.credential.participantId
	)
	let sequence = 1
	const command = (commandId: string) => ({
		commandId,
		sequence: sequence++,
		command: {
			type: "setup" as const,
			expectedContextVersion: sequence - 1,
			screens: [
				{
					id: "tv",
					label: "TV",
					country: "DE",
					serviceIds: [1],
					confirmed: true,
				},
			],
			constraints: {
				kinds: ["movie" as const, "show_start" as const],
				maxMinutes: null,
				moods: [],
			},
			screenId: "tv",
		},
	})
	const first = command("first")
	repo.ambiguousNext = true
	await service.command(id, who(a), first)
	const second = command("second")
	await service.command(id, who(a), second)
	const before = db.state()
	await assert.rejects(
		service.command(
			id,
			{ participantId: a.credential.participantId, token: "wrong" },
			command("bad-auth")
		)
	)
	const third = {
		...command("third"),
		sequence: 3,
		command: { ...second.command, expectedContextVersion: 3 },
	}
	await assert.rejects(
		service.command(id, who(a), third),
		(e: BudgetError) => e.status === 429
	)
	assert.deepEqual(db.state(), before)
	assert.equal(
		(await service.command(id, who(a), first)).receipt.replayed,
		true
	)
	assert.equal(
		(await service.create(request)).credential.participantId,
		a.credential.participantId
	)
	db.advance(60_000)
	await service.command(id, who(a), third)
	// Receipt from a previous budget window is still authoritative; no duplicate state effects.
	const revision = (await service.read(id, who(a))).shared.revision
	await service.command(id, who(a), first)
	assert.equal((await service.read(id, who(a))).shared.revision, revision)
})
test("Capacity HTTP response is explicitly retryable and Retry-After is present; repeated denied admissions cannot grow bookkeeping", async () => {
	const policy = { ...DEFAULT_CONTROL, rooms: 1 },
		db = database(policy),
		service = new ProposalService(
			new ProposalMemoryRepository(),
			proposalFixtureCatalog,
			secret,
			async () => {},
			db.now,
			new ReleaseControl(db.sql, policy)
		)
	await service.create(admission())
	const handler = createProposalHandler(service, {
		serviceSecret: secret,
		allowedOrigins: ["https://yepwatch.com"],
	})
	const before = db.state()
	const response = await handler(
		new Request("http://api" + paths.rooms, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin: "https://yepwatch.com",
				"x-yepwatch-client": "native",
			},
			body: JSON.stringify(admission()),
		})
	)
	assert.equal(response.status, 503)
	assert.ok(Number(response.headers.get("retry-after")) > 0)
	assert.equal((await response.json()).error.retryable, true)
	assert.deepEqual(db.state(), before)
})
test("Missing control record cannot be initialized over room history and configuration changes are never implicit", async () => {
	let inserts = 0
	const sql: Sql = async (stmt) => {
		if (stmt.startsWith("INSERT")) inserts++
		return { rows: stmt.startsWith("SELECT count") ? [[1]] : [], rowcount: 0 }
	}
	await assert.rejects(
		provisionControl(sql, DEFAULT_CONTROL, 0),
		/empty room store/
	)
	assert.equal(inserts, 0)
})

test("Uncertain capacity acknowledgement never reaches room insertion without authoritative permit proof; original expiry is recovered", async () => {
	const db = database({ ...DEFAULT_CONTROL, rooms: 1 }),
		policy = { ...DEFAULT_CONTROL, rooms: 1 },
		repo = new ProposalMemoryRepository(),
		guard = new ReleaseControl(db.sql, policy)
	const service = new ProposalService(
		repo,
		proposalFixtureCatalog,
		secret,
		async () => {},
		db.now,
		guard
	)
	const input = admission()
	db.loseAndHideProof()
	await assert.rejects(service.create(input), /Read unavailable/)
	assert.equal(repo.rows.size, 0)
	const originalExpiry = db.state().rooms[0][2]
	db.advance(120000)
	await assert.rejects(
		service.create(admission()),
		(e: RoomError) => e.status === 503
	)
	const recovered = await service.create(input)
	assert.equal(recovered.credential.expiresAt, originalExpiry)
	assert.equal(repo.rows.size, 1)
})
test("Denied valid Start performs zero catalog work; expired receipt eviction cannot repeat a domain effect after budget-window eviction", async () => {
	const policy = { ...DEFAULT_CONTROL, commands: 120, actorCommands: 120 },
		db = database(policy),
		repo = new ProposalMemoryRepository(),
		guard = new ReleaseControl(db.sql, policy)
	let scans = 0
	const service = new ProposalService(
		repo,
		{
			...proposalFixtureCatalog,
			page: async (room) => {
				scans++
				return proposalFixtureCatalog.page(room)
			},
		},
		secret,
		async () => {},
		db.now,
		guard
	)
	const a = await service.create(admission()),
		id = a.credential.roomId
	const setup = (n: number) => ({
		commandId: "setup-" + n,
		sequence: n,
		command: {
			type: "setup" as const,
			expectedContextVersion: n,
			screens: [
				{
					id: "tv",
					label: "TV",
					country: "DE",
					serviceIds: [1],
					confirmed: true,
				},
			],
			constraints: { kinds: ["movie" as const], maxMinutes: null, moods: [] },
			screenId: "tv",
		},
	})
	for (let i = 1; i <= 70; i++) await service.command(id, who(a), setup(i))
	assert.equal(repo.rows.get(id)!.room.participants[0].receipts.length, 64)
	db.advance(60000)
	const revision = (await service.read(id, who(a))).shared.revision,
		before = db.state()
	await assert.rejects(
		service.command(id, who(a), setup(1)),
		(e: RoomError) => e.code === "outcome_unknown"
	)
	assert.equal((await service.read(id, who(a))).shared.revision, revision)
	assert.deepEqual(db.state(), before)
	// Exhaust current window without changing room state; a valid Start cannot initiate an expensive page.
	for (let i = 0; i < 120; i++)
		await guard.command(id, a.credential.participantId, "budget-fixture-" + i)
	const snapshot = await service.read(id, who(a))
	await assert.rejects(
		service.command(id, who(a), {
			commandId: "start",
			sequence: 71,
			command: {
				type: "start",
				hostReady: true,
				expectedRosterVersion: snapshot.shared.rosterVersion,
				expectedContextVersion: snapshot.shared.contextVersion,
			},
		}),
		(e: RoomError) => e.status === 429
	)
	assert.equal(scans, 0)
})

test("Admission rate denial returns429 Retry-After before room creation, independent of room capacity", async () => {
	const policy = { ...DEFAULT_CONTROL, rooms: 2, admissions: 1 },
		db = database(policy),
		repo = new ProposalMemoryRepository()
	const service = new ProposalService(
		repo,
		proposalFixtureCatalog,
		secret,
		async () => {},
		db.now,
		new ReleaseControl(db.sql, policy)
	)
	await service.create(admission())
	const handler = createProposalHandler(service, {
		serviceSecret: secret,
		allowedOrigins: ["https://yepwatch.com"],
	})
	for (let i = 0; i < 3; i++) {
		const response = await handler(
			new Request("http://api" + paths.rooms, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-yepwatch-client": "native",
				},
				body: JSON.stringify(admission()),
			})
		)
		assert.equal(response.status, 429)
		assert.ok(Number(response.headers.get("retry-after")) > 0)
	}
	assert.equal(repo.rows.size, 1)
	assert.equal(db.state().rooms.length, 1)
	assert.equal(db.state().admissions.length, 1)
})
