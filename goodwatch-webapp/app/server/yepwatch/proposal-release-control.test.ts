import { test } from "node:test"
import assert from "node:assert/strict"
import { createHash, randomBytes } from "node:crypto"
import {
	ReleaseControl,
	CONTROL_COLUMNS,
	controlRow,
	controlState,
	DEFAULT_CONTROL,
	CONTROL_TABLE,
	provisionControl,
	controlFingerprint,
	BudgetError,
} from "./proposal-release-control.ts"
import { CONTINUOUS_LIMITS } from "./continuous-types.ts"
import { ProposalService } from "./proposal-service.server.ts"
import {
	MemoryCreationQuotas,
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
/** A control over `db` with in-memory personal allowances on the same clock. */
function guarded(db: ReturnType<typeof database>, policy = DEFAULT_CONTROL, quotas = new MemoryCreationQuotas(db.now)) {
	return new ReleaseControl(db.sql, policy, quotas)
}
function database(policy = DEFAULT_CONTROL) {
	let state = {
			format: 1,
			fingerprint: controlFingerprint(policy),
			window: -1,
			rooms: [],
			admissions: [],
			commands: [],
		} as import("./proposal-release-control.ts").Control,
		seq = 0,
		now = 1_800_000_010_000,
		lost = false,
		failProof = false,
		late = false,
		failAfterUpdate = false
	const sql: Sql = async (stmt, args = []) => {
		if (stmt.startsWith("SELECT " + CONTROL_COLUMNS.join(","))) {
			if (failProof) {
				failProof = false
				throw new RoomError("busy", "Read unavailable", 503, true)
			}
			const row = controlRow(state)
			return {
				rows: [[...CONTROL_COLUMNS.map((k) => row[k]), seq, 1, now]],
				rowcount: 1,
			}
		}
		if (stmt.startsWith("UPDATE " + CONTROL_TABLE)) {
			if (late) {
				now = Number(args[0])
				late = false
			}
			if (args.at(-2) !== seq || args.at(-1) !== 1)
				return { rows: [], rowcount: 0 }
			if (now < Number(args[0]))
				state = controlState({
					id: "proposal3",
					...Object.fromEntries(
						CONTROL_COLUMNS.filter((k) => k !== "id").map((k, i) => [
							k,
							args[i * 2 + 1],
						])
					),
				})
			seq++
			if (failAfterUpdate) {
				failAfterUpdate = false
				failProof = true
			}
			if (lost) {
				lost = false
				throw new IndeterminateWrite("Lost control acknowledgement")
			}
			// RETURNING: the row as written (unchanged when the window had ended by the store's clock).
			const row = controlRow(state)
			return { rows: [[...CONTROL_COLUMNS.map((k) => row[k]), seq, 1, now]], rowcount: 1 }
		}
		throw Error("Unexpected test statement: " + stmt)
	}
	return {
		sql,
		now: () => now,
		advance: (ms: number) => {
			now += ms
		},
		state: () => structuredClone(state),
		setFingerprint: (fingerprint: string) => {
			state = { ...state, fingerprint }
		},
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
test("No shared room cap: 25 creators across independent instances; identity changes conflict, restart preserves original expiry", async () => {
	const policy = { ...DEFAULT_CONTROL, admissions: 120 },
		db = database(policy),
		quotas = new MemoryCreationQuotas(db.now),
		a = guarded(db, policy, quotas),
		b = guarded(db, policy, quotas)
	const expiry = await a.create("room-0", "digest-0", "person-0")
	for (let i = 1; i < 25; i++) await (i % 2 ? b : a).create(`room-${i}`, `digest-${i}`, `person-${i}`)
	assert.equal(await quotas.count(), 25)
	assert.equal(db.state().rooms.length, 0, "the control row keeps no room reservations")
	await assert.rejects(a.create("room-0", "changed", "person-0"), /retry changed/)
	db.advance(60_000)
	assert.equal(await guarded(db, policy, quotas).create("room-0", "digest-0", "person-0"), expiry)
	db.advance(CONTINUOUS_LIMITS.roomMs)
	await assert.rejects(
		a.active({ id: "room-0", expiresAt: expiry }),
		(e: RoomError) => e.status === 410
	)
})
test("Concurrent creations land and original window fencing uses CAS, never process-local counters", async () => {
	const policy = { ...DEFAULT_CONTROL, admissions: 120 },
		db = database(policy),
		quotas = new MemoryCreationQuotas(db.now)
	// Each permit retries a lost compare-and-swap up to 8 times, so 8 simultaneous writers all land.
	const outcomes = await Promise.allSettled(
		Array.from({ length: 8 }, (_, i) =>
			guarded(db, policy, quotas).create(`room-${i}`, `digest-${i}`, `person-${i}`)
		)
	)
	assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 8)
	assert.equal(db.state().admissions.length, 8)
	assert.equal(await quotas.count(), 8)
	const db2 = database()
	db2.delayNextCas()
	await guarded(db2).create("late", "d", "person")
	assert.equal(db2.state().window, Math.floor(db2.now() / 60_000))
	assert.equal(db2.state().admissions.length, 1)
})
test("A control row provisioned under any old shared room cap still validates; changed budgets are refused", async () => {
	const db = database()
	await guarded(db).check()
	// The stored format: [format, window, room lifetime, shared room cap, admissions, commands, actor commands].
	const p = DEFAULT_CONTROL
	for (const cap of [3, 20, 100]) {
		db.setFingerprint(createHash("sha256").update(JSON.stringify([1, 60_000, CONTINUOUS_LIMITS.roomMs, cap, p.admissions, p.commands, p.actorCommands])).digest("hex"))
		await guarded(db).check()
		if (cap === 20) assert.equal(db.state().fingerprint, controlFingerprint(p), "new rows record the old default")
	}
	await assert.rejects(guarded(db, { ...DEFAULT_CONTROL, admissions: 21 }).check(), /configuration mismatch/)
})
test("Global admission/command and per-actor budgets remain bounded; exact permits recover lost acknowledgement and windows reset on SQL time", async () => {
	const policy = { admissions: 2, commands: 3, actorCommands: 2 },
		db = database(policy),
		quotas = new MemoryCreationQuotas(db.now),
		control = guarded(db, policy, quotas)
	db.lose()
	const expiry = await control.create("r", "d", "person")
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
	await guarded(db, policy, quotas).command("r", "a", "cmd-d")
	assert.equal(db.state().commands.length, 1)
	assert.equal(quotas.rooms.get("r")?.expiresAt, expiry)
	await assert.rejects(
		guarded(db, { ...policy, commands: 4 }, quotas).check(),
		/configuration mismatch/
	)
	db.advance(-120_000)
	await assert.rejects(control.command("r", "a", "other"), /clock window/)
})
test("Service guard charges only authenticated valid new commands; retained receipts and exact lost-ack admission replay work at exhausted budgets", async () => {
	const policy = { admissions: 1, commands: 2, actorCommands: 2 },
		db = database(policy),
		guard = guarded(db, policy),
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
test("Creating more rooms than the removed shared cap (25 over HTTP) succeeds; only the admission rate window paces them", async () => {
	const db = database(),
		repo = new ProposalMemoryRepository(),
		quotas = new MemoryCreationQuotas(db.now),
		service = new ProposalService(
			repo,
			proposalFixtureCatalog,
			secret,
			async () => {},
			db.now,
			guarded(db, DEFAULT_CONTROL, quotas)
		)
	const handler = createProposalHandler(service, {
		serviceSecret: secret,
		allowedOrigins: ["https://yepwatch.com"],
	})
	for (let i = 0; i < 25; i++) {
		// The admission budget (20 a minute) is a separate abuse control: the 21st creation waits for the next window.
		if (i === DEFAULT_CONTROL.admissions) db.advance(60_000)
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
		assert.equal(response.status, 200, `room ${i + 1}`)
	}
	assert.equal(repo.rows.size, 25)
	assert.equal(await quotas.count(), 25)
	assert.equal(db.state().rooms.length, 0)
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

test("Uncertain admission acknowledgement never reaches room insertion without authoritative permit proof; original expiry is recovered", async () => {
	const db = database(),
		repo = new ProposalMemoryRepository(),
		quotas = new MemoryCreationQuotas(db.now),
		guard = guarded(db, DEFAULT_CONTROL, quotas)
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
	assert.equal(await quotas.count(), 0, "no reservation before the admission is proven")
	assert.equal(db.state().admissions.length, 1)
	const recovered = await service.create(input)
	assert.equal(db.state().admissions.length, 1, "the exact retry finds its grant")
	assert.equal(recovered.credential.expiresAt, [...quotas.rooms.values()][0].expiresAt)
	assert.equal(repo.rows.size, 1)
	// A retry after the room exists returns the room's original expiry.
	db.advance(120000)
	assert.equal((await service.create(input)).credential.expiresAt, recovered.credential.expiresAt)
})
test("Denied valid Start performs zero catalog work; expired receipt eviction cannot repeat a domain effect after budget-window eviction", async () => {
	const policy = { ...DEFAULT_CONTROL, commands: 120, actorCommands: 120 },
		db = database(policy),
		repo = new ProposalMemoryRepository(),
		guard = guarded(db, policy)
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

test("Admission rate denial returns429 Retry-After before room creation and writes no allowance rows", async () => {
	const policy = { ...DEFAULT_CONTROL, admissions: 1 },
		db = database(policy),
		repo = new ProposalMemoryRepository(),
		quotas = new MemoryCreationQuotas(db.now)
	const service = new ProposalService(
		repo,
		proposalFixtureCatalog,
		secret,
		async () => {},
		db.now,
		guarded(db, policy, quotas)
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
	assert.equal(await quotas.count(), 1)
	assert.equal(db.state().admissions.length, 1)
})
test("with creation quotas, a check reads the room's quota proof alongside the control row and keeps its outcome", async () => {
	const db = database()
	let events: string[] = []
	const sql: Sql = async (stmt, args) => {
		const control = stmt.includes(CONTROL_TABLE) && stmt.startsWith("SELECT")
		if (control) await new Promise((resolve) => setTimeout(resolve, 5))
		const result = await db.sql(stmt, args)
		if (control) events.push("control read")
		return result
	}
	let valid = true
	const quotas = {
		limit: 10,
		async reserve() { return 0 },
		async count() { return 0 },
		async active() {
			events.push("quota proof")
			if (!valid) throw new RoomError("busy", "Room allowance could not be confirmed", 503, true)
		},
	}
	const control = new ReleaseControl(sql, DEFAULT_CONTROL, quotas)
	const room = { id: "room-q", expiresAt: 1_900_000_000_000 }
	await control.active(room)
	assert.deepEqual(events, ["quota proof", "control read"], "the proof didn't wait for the control row")
	events = []
	await control.command(room.id, "actor", "digest-1")
	assert.deepEqual(events.slice(0, 2), ["quota proof", "control read"])
	valid = false
	await assert.rejects(control.active(room), { code: "busy" })
	await assert.rejects(control.command(room.id, "actor", "digest-2"), { code: "busy" })
})
test("a command's permit starts from the control row its room check just read and learns the grant from its write", async () => {
	const db = database()
	let events: string[] = []
	const sql: Sql = async (stmt, args) => {
		if (stmt.includes(CONTROL_TABLE)) events.push(stmt.startsWith("SELECT") ? "control read" : "control write")
		return db.sql(stmt, args)
	}
	const quotas = {
		limit: 10,
		async reserve() { return 0 },
		async count() { return 0 },
		async active() { events.push("quota proof") },
	}
	const control = new ReleaseControl(sql, DEFAULT_CONTROL, quotas)
	const room = { id: "room-q", expiresAt: 1_900_000_000_000 }
	const check = await control.active(room)
	events = []
	await control.command(room.id, "actor", "digest-1", check)
	assert.deepEqual(events, ["control write"], "no second room check, no read-back")
	assert.equal(db.state().commands.length, 1)

	events = []
	await control.command(room.id, "actor", "digest-2", check)
	assert.deepEqual(events, ["quota proof", "control read", "control write"], "a check is used once")
	events = []
	await control.command("another-room", "actor", "digest-3", await control.active(room))
	assert.ok(events.includes("quota proof"), "a check for another room proves nothing")

	// A newer row (another instance's grant) makes the first try lose: the retry reads and checks the room again.
	const stale = await control.active(room)
	await control.command(room.id, "other", "digest-4")
	events = []
	await control.command(room.id, "actor", "digest-5", stale)
	assert.deepEqual(events, ["control write", "quota proof", "control read", "control write"])
	assert.equal(db.state().commands.length, 5)

	// A lost acknowledgement is still settled by reading the row back.
	const fresh = await control.active(room)
	db.lose()
	events = []
	await control.command(room.id, "actor", "digest-6", fresh)
	assert.deepEqual(events, ["control write", "control read"])
	assert.equal(db.state().commands.length, 6)
})
