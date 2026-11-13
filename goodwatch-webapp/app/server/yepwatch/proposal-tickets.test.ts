import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { execFileSync } from "node:child_process"
import type { GuestAdmission, RoomCommand } from "../../../packages/yepwatch-contracts/proposal.ts"
import { paths } from "../../../packages/yepwatch-contracts/proposal.ts"
import { ProposalService } from "./proposal-service.server.ts"
import { ProposalMemoryRepository, proposalFixtureCatalog } from "./proposal-test-support.ts"
import { createProposalHandler } from "./proposal-http.server.ts"
import { MemoryTicketStore, ValkeyTicketStore, type TicketStore } from "./proposal-tickets.ts"
import { hash } from "./crypto.server.ts"
import { RoomError } from "./errors.ts"

const secret = "ticket-tests-secret-at-least-thirty-two-chars"
const admission = (nickname = "A") => ({
	contractVersion: 3 as const,
	commandId: randomBytes(16).toString("hex"),
	admissionSecret: randomBytes(32).toString("base64url"),
	nickname,
})
const credential = (a: GuestAdmission) => ({ participantId: a.credential.participantId, token: a.credential.token })

/** A repository whose compare-and-swaps can be held: the room's write lane stays occupied while one is. */
class HeldRepository extends ProposalMemoryRepository {
	writes = 0
	hold: Promise<void> | null = null
	held: (() => void) | null = null
	override async compareAndSwap(...args: Parameters<ProposalMemoryRepository["compareAndSwap"]>) {
		this.writes++
		if (this.hold) {
			this.held?.()
			await this.hold
		}
		return super.compareAndSwap(...args)
	}
}
async function room(tickets?: TicketStore) {
	const repo = new HeldRepository()
	const service = new ProposalService(repo, proposalFixtureCatalog, secret, undefined, Date.now, undefined, undefined, { tickets })
	const a = await service.create(admission())
	const b = await service.join(a.credential.roomId, { ...admission("B"), inviteCode: a.invite.code })
	const id = a.credential.roomId
	const send = async (who: GuestAdmission, command: RoomCommand) => {
		const s = await service.read(id, credential(who))
		return service.command(id, credential(who), { commandId: randomBytes(12).toString("hex"), sequence: s.own.nextSequence, command })
	}
	return { repo, service, a, b, id, send }
}

test("issuing and consuming a realtime ticket writes nothing to the room and never waits in its write lane", async () => {
	const r = await room()
	let release!: () => void
	r.repo.hold = new Promise<void>((resolve) => (release = resolve))
	const entered = new Promise<void>((resolve) => (r.repo.held = resolve))
	const rename = r.send(r.b, { type: "rename", nickname: "Bee" } as RoomCommand)
	await entered // B's command holds the lane, mid compare-and-swap
	const writes = r.repo.writes
	const issued = await Promise.race([
		r.service.ticket(r.id, credential(r.a)),
		new Promise<never>((_, reject) => setTimeout(() => reject(new Error("ticket waited behind the command")), 1000)),
	])
	const attached = await Promise.race([
		r.service.attach(r.id, issued.ticket),
		new Promise<never>((_, reject) => setTimeout(() => reject(new Error("attach waited behind the command")), 1000)),
	])
	assert.equal(attached.participantId, r.a.credential.participantId)
	assert.equal(r.repo.writes, writes, "no room write for the ticket")
	r.repo.hold = null
	release()
	await rename
	assert.deepEqual((await r.repo.read(r.id))!.room.tickets, [], "the room keeps no tickets")
})

test("a ticket attaches once; a participant holds at most four; consuming one frees its place", async () => {
	const r = await room()
	const first = await r.service.ticket(r.id, credential(r.a))
	await r.service.attach(r.id, first.ticket)
	await assert.rejects(r.service.attach(r.id, first.ticket), { code: "unauthorized" })
	const held = []
	for (let i = 0; i < 4; i++) held.push(await r.service.ticket(r.id, credential(r.a)))
	await assert.rejects(r.service.ticket(r.id, credential(r.a)), { code: "limit_reached" })
	await r.service.ticket(r.id, credential(r.b)) // another person's allowance is their own
	await r.service.attach(r.id, held[0].ticket)
	await r.service.ticket(r.id, credential(r.a))
	await assert.rejects(r.service.attach("x".repeat(32), held[1].ticket), { code: "unauthorized" }, "another room's ticket")
})

test("a ticket of someone who left, or whose capability moved on, no longer attaches", async () => {
	const r = await room()
	const left = await r.service.ticket(r.id, credential(r.b))
	await r.send(r.b, { type: "leave" } as RoomCommand)
	await assert.rejects(r.service.attach(r.id, left.ticket), (e: { code?: string }) => ["forbidden", "unauthorized"].includes(e.code ?? ""))
	const revoked = await r.service.ticket(r.id, credential(r.a))
	await r.service.revokeParticipant(r.id, r.a.credential.participantId)
	await assert.rejects(r.service.attach(r.id, revoked.ticket), { code: "forbidden" })
})

test("tickets of an earlier capability (before leaving and coming back) don't use up the new one's allowance", async () => {
	const store = new MemoryTicketStore()
	const now = Date.now()
	for (let i = 0; i < 4; i++) assert.equal(await store.issue("r", `old${i}`, { participantId: "p", epoch: 1, expiresAt: now + 30_000 }, 4, now), true)
	assert.equal(await store.issue("r", "old4", { participantId: "p", epoch: 1, expiresAt: now + 30_000 }, 4, now), false)
	assert.equal(await store.issue("r", "new0", { participantId: "p", epoch: 2, expiresAt: now + 30_000 }, 4, now), true)
	const r = await room()
	for (let i = 0; i < 4; i++) await r.service.ticket(r.id, credential(r.b))
	await r.send(r.b, { type: "leave" } as RoomCommand)
	const back = await r.service.resumeOrJoin(r.id, credential(r.b), { ...admission("B"), inviteCode: r.a.invite.code })
	const fresh = await r.service.ticket(r.id, { participantId: back.credential.participantId, token: back.credential.token })
	assert.equal((await r.service.attach(r.id, fresh.ticket)).participantId, back.credential.participantId)
})

test("an expired ticket does not attach", async () => {
	let now = Date.now()
	const repo = new ProposalMemoryRepository()
	const service = new ProposalService(repo, proposalFixtureCatalog, secret, undefined, () => now)
	const a = await service.create(admission())
	const t = await service.ticket(a.credential.roomId, credential(a))
	now += 31_000
	await assert.rejects(service.attach(a.credential.roomId, t.ticket), { code: "unauthorized" })
})

test("a ticket issued into the room before this release still attaches once", async () => {
	const r = await room()
	const ticket = "legacy-ticket-" + randomBytes(16).toString("hex")
	const stored = (await r.repo.read(r.id))!
	const next = structuredClone(stored.room)
	next.tickets.push({ hash: hash(ticket), participantId: r.a.credential.participantId, epoch: 1, expiresAt: Date.now() + 30_000 })
	assert.ok(await r.repo.compareAndSwap(stored, next, false))
	const attached = await r.service.attach(r.id, ticket)
	assert.equal(attached.participantId, r.a.credential.participantId)
	assert.deepEqual((await r.repo.read(r.id))!.room.tickets, [])
	await assert.rejects(r.service.attach(r.id, ticket), { code: "unauthorized" })
})

test("an unknown ticket is refused; a room store failure while checking for an old one is reported, not refused", async () => {
	const r = await room()
	await assert.rejects(r.service.attach(r.id, "never-issued"), { code: "unauthorized" })
	const read = r.repo.read.bind(r.repo)
	r.repo.read = async () => {
		throw new RoomError("busy", "Store unavailable", 503, true)
	}
	await assert.rejects(r.service.attach(r.id, "never-issued"), { code: "busy" })
	r.repo.read = read
})

test("a command's answer says how long it waited in the room's write lane", async () => {
	const r = await room()
	const handler = createProposalHandler(r.service, { serviceSecret: secret, allowedOrigins: [], secureCookies: false })
	const command = async (who: GuestAdmission, cmd: RoomCommand) => {
		const s = await r.service.read(r.id, credential(who))
		return handler(
			new Request(`http://api${paths.commands(r.id)}`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-yepwatch-client": "native",
					authorization: `Bearer ${who.credential.token}`,
					"x-yepwatch-participant": who.credential.participantId,
				},
				body: JSON.stringify({ commandId: randomBytes(12).toString("hex"), sequence: s.own.nextSequence, command: cmd }),
			})
		)
	}
	let release!: () => void
	r.repo.hold = new Promise<void>((resolve) => (release = resolve))
	const entered = new Promise<void>((resolve) => (r.repo.held = resolve))
	const first = command(r.b, { type: "rename", nickname: "Bee" } as RoomCommand)
	await entered
	r.repo.hold = null
	const second = command(r.a, { type: "rename", nickname: "Ay" } as RoomCommand)
	await new Promise((resolve) => setTimeout(resolve, 40))
	release()
	await first
	const header = (await second).headers.get("server-timing") ?? ""
	const lane = Number(/lane;dur=([\d.]+)/.exec(header)?.[1])
	assert.ok(lane >= 30, `lane wait recorded: ${header}`)
})

test("Valkey ticket store: one use, per-participant limit, rooms apart, expiry", { skip: process.env.YEPWATCH_TEST_VALKEY !== "1", timeout: 60000 }, async (t) => {
	const { Redis } = await import("ioredis")
	const name = `yepwatch-ticket-valkey-${process.pid}`
	execFileSync("docker", ["run", "-d", "--rm", "--name", name, "-p", "127.0.0.1::6379", "valkey/valkey:8"], { stdio: "ignore" })
	t.after(() => execFileSync("docker", ["rm", "-f", name], { stdio: "ignore" }))
	const port = execFileSync("docker", ["port", name, "6379/tcp"]).toString().trim().split("\n")[0].split(":").at(-1)
	const client = new Redis({ host: "127.0.0.1", port: Number(port), lazyConnect: true, maxRetriesPerRequest: 1 })
	t.after(() => client.disconnect())
	for (let i = 0; ; i++) {
		try {
			await client.connect()
			break
		} catch (error) {
			if (i > 50) throw error
			await new Promise((resolve) => setTimeout(resolve, 200))
		}
	}
	const store = new ValkeyTicketStore(client)
	const now = Date.now()
	const record = (participantId: string, expiresAt = now + 30_000) => ({ participantId, epoch: 2, expiresAt, sessionId: "s1", member: true })
	assert.equal(await store.issue("room-a", "h1", record("p1"), 2, now), true)
	assert.equal(await store.issue("room-a", "h2", record("p1"), 2, now), true)
	assert.equal(await store.issue("room-a", "h3", record("p1"), 2, now), false, "limit")
	assert.equal(await store.issue("room-a", "h4", record("p2"), 2, now), true, "per participant")
	assert.equal(await store.consume("room-b", "h1", now), null, "another room")
	assert.deepEqual(await store.consume("room-a", "h1", now), record("p1"))
	assert.equal(await store.consume("room-a", "h1", now), null, "one use")
	assert.equal(await store.issue("room-a", "h5", record("p1"), 2, now), true, "consuming freed a place")
	assert.equal(await client.pttl("yepwatch:ticket:{room-a}:h5") <= 30_000, true)
	assert.equal(await store.issue("room-a", "h6", record("p3", now + 50), 2, now), true)
	await new Promise((resolve) => setTimeout(resolve, 120))
	assert.equal(await store.consume("room-a", "h6", Date.now()), null, "expired")
	assert.equal(await store.issue("room-a", "h7", record("p3"), 1, now + 1000), true, "expired ones no longer count")
	// An earlier epoch's tickets don't count against the current one.
	assert.equal(await store.issue("room-c", "e1", { ...record("p1"), epoch: 1 }, 1, now), true)
	assert.equal(await store.issue("room-c", "e2", { ...record("p1"), epoch: 2 }, 1, now), true)
	assert.equal(await store.issue("room-c", "e3", { ...record("p1"), epoch: 2 }, 1, now), false)
	assert.deepEqual(await store.consume("room-c", "e2", now), record("p1"))
	assert.equal(await store.issue("room-c", "e3", { ...record("p1"), epoch: 2 }, 1, now), true, "consuming freed the place")
	await store.check()
	// A script resent after its answer was lost (a client that retries) gets the first answer again.
	const resending = new ValkeyTicketStore({
		async eval(...args: Parameters<typeof client.eval>) {
			await client.eval(...args) // this answer is "lost"
			return client.eval(...args)
		},
	} as never)
	assert.equal(await resending.issue("room-d", "r1", record("p9"), 1, now), true, "a resent issue is the same issue")
	await assert.rejects(store.issue("room-d", "r1", record("p8"), 1, now), /ticket exists/)
	assert.deepEqual(await resending.consume("room-d", "r1", now), record("p9"), "a resent consume gets its record")
	assert.equal(await store.consume("room-d", "r1", now), null, "and nobody else does")
	assert.ok((await client.pttl("yepwatch:ticket:{room-d}:r1")) <= 30_000, "the consumed marker keeps the ticket's expiry")
	const concurrent = await Promise.all(Array.from({ length: 8 }, () => store.consume("room-a", "h2", now)))
	assert.equal(concurrent.filter(Boolean).length, 1, "exactly one concurrent consume wins")
	// A memory store follows the same rules.
	const memory = new MemoryTicketStore()
	assert.equal(await memory.issue("room-a", "h1", record("p1"), 1, now), true)
	assert.equal(await memory.issue("room-a", "h2", record("p1"), 1, now), false)
})
