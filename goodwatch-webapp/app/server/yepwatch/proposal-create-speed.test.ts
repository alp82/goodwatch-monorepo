import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { paths } from "../../../packages/yepwatch-contracts/proposal.ts"
import { ProposalService, type ProposalOperationGuard } from "./proposal-service.server.ts"
import { ProposalMemoryRepository, proposalFixtureCatalog } from "./proposal-test-support.ts"
import { createProposalHandler } from "./proposal-http.server.ts"
import { IndeterminateWrite } from "./errors.ts"

const secret = "create-speed-secret-at-least-thirty-two-chars"
const admission = () => ({
	contractVersion: 3 as const,
	commandId: randomBytes(16).toString("hex"),
	admissionSecret: randomBytes(32).toString("base64url"),
	nickname: "Host",
})

/** Counts what a create asks of the room store. */
class CountingRepository extends ProposalMemoryRepository {
	reads = 0
	invites = 0
	inserts = 0
	loseInsert = false
	override async read(id: string) {
		this.reads++
		return super.read(id)
	}
	override async rememberInvite(hash: string, roomId: string, expiresAt: number) {
		this.invites++
		return super.rememberInvite(hash, roomId, expiresAt)
	}
	override async insert(room: Parameters<ProposalMemoryRepository["insert"]>[0]) {
		this.inserts++
		const inserted = await super.insert(room)
		if (this.loseInsert) {
			this.loseInsert = false
			throw new IndeterminateWrite("lost insert acknowledgement")
		}
		return inserted
	}
}
/** A guard that records what it was asked: `writes` counts creates that went past the existence check. */
function recordingGuard(expiresAt = Date.now() + 3_600_000) {
	const calls = { active: 0, creates: 0, writes: 0, skipped: 0 }
	const guard: ProposalOperationGuard = {
		async active() {
			calls.active++
		},
		async create(_id, _digest, _creator, proceed) {
			calls.creates++
			if (proceed && !(await proceed)) {
				calls.skipped++
				return null
			}
			calls.writes++
			return expiresAt
		},
		async join() {},
		async command() {},
	}
	return { guard, calls }
}

test("a fresh create reads the room once, reserves its invite once and answers from the room it stored", async () => {
	const repo = new CountingRepository()
	const { guard, calls } = recordingGuard()
	const service = new ProposalService(repo, proposalFixtureCatalog, secret, undefined, Date.now, guard)
	const request = admission()
	const created = await service.create(request)
	assert.equal(repo.reads, 1, "one existence read, no read-back")
	assert.equal(repo.invites, 1, "the invite is reserved once")
	assert.equal(repo.inserts, 1)
	assert.equal(calls.active, 0, "no capacity re-check of the room it just reserved")
	assert.equal(calls.writes, 1)
	// The answer is what a read of the stored room gives.
	const stored = (await repo.read(created.credential.roomId))!.room
	assert.equal(created.credential.expiresAt, stored.expiresAt)
	assert.equal(created.invite.path, `/r/${created.invite.code}`)
	const read = await service.read(created.credential.roomId, {
		participantId: created.credential.participantId,
		token: created.credential.token,
	})
	assert.deepEqual(created.snapshot, read)
	// An exact retry finds the room: same place, same invite, and the guard charges nothing.
	const checked = calls.active // the read above checked capacity, as every read does
	const retry = await service.create(request)
	assert.deepEqual(retry.credential, created.credential)
	assert.deepEqual(retry.invite, created.invite)
	assert.equal(calls.writes, 1)
	assert.equal(calls.skipped, 1, "the retry's guard stopped at the existence check")
	assert.equal(calls.active, checked + 1, "an existing room's capacity is checked as before")
})

test("a create whose insert acknowledgement was lost recovers the stored room", async () => {
	const repo = new CountingRepository()
	const { guard, calls } = recordingGuard()
	const service = new ProposalService(repo, proposalFixtureCatalog, secret, undefined, Date.now, guard)
	repo.loseInsert = true
	const created = await service.create(admission())
	assert.equal(repo.inserts, 1)
	assert.equal(repo.reads, 2, "the lost acknowledgement is resolved by reading the room")
	assert.equal(calls.writes, 1)
	assert.equal(created.snapshot.shared.roomId, created.credential.roomId)
})

test("a create with setup stores the setup and answers with it", async () => {
	const repo = new CountingRepository()
	const service = new ProposalService(repo, proposalFixtureCatalog, secret)
	const created = await service.create({ ...admission(), setup: { country: "DE" } })
	const stored = (await repo.read(created.credential.roomId))!.room
	assert.equal(stored.screens[0]?.country, "DE")
	assert.equal(created.snapshot.shared.contextVersion, stored.contextVersion)
	assert.equal(repo.reads, 2) // one in create, one above
})

test("create answers with Server-Timing marks for its steps", async () => {
	const repo = new CountingRepository()
	const { guard } = recordingGuard()
	const handler = createProposalHandler(new ProposalService(repo, proposalFixtureCatalog, secret, undefined, Date.now, guard), {
		serviceSecret: secret,
		allowedOrigins: [],
		secureCookies: false,
	})
	const response = await handler(
		new Request(`http://api${paths.rooms}`, {
			method: "POST",
			headers: { "content-type": "application/json", "x-yepwatch-client": "native" },
			body: JSON.stringify({ ...admission(), setup: { country: "DE" } }),
		})
	)
	assert.equal(response.status, 200)
	const header = response.headers.get("server-timing") ?? ""
	for (const mark of ["read", "guard", "setup", "invite", "insert", "total"])
		assert.match(header, new RegExp(`(^|, )${mark};dur=`), `${mark} in ${header}`)
})

test("an invite this room reserved earlier with another expiry is passed over: the room keeps its reservation's expiry", async () => {
	const repo = new CountingRepository()
	let expiry = Date.now() + 3_600_000
	const guard: ProposalOperationGuard = {
		async active(room) {
			if (room.expiresAt !== expiry) throw new Error("capacity proof and room disagree")
		},
		async create() {
			return expiry
		},
		async join() {},
		async command() {},
	}
	const service = new ProposalService(repo, proposalFixtureCatalog, secret, undefined, Date.now, guard)
	const request = admission()
	// An earlier attempt of this request reserved the first code with its own expiry, then stopped short of the room.
	const first = await service.create(request)
	repo.rows.delete(first.credential.roomId)
	expiry += 60_000
	const created = await service.create(request)
	assert.equal(created.credential.expiresAt, expiry)
	assert.notEqual(created.invite.code, first.invite.code)
	const read = await service.read(created.credential.roomId, { participantId: created.credential.participantId, token: created.credential.token })
	assert.equal(read.shared.roomId, created.credential.roomId)
	assert.equal((await service.resolveInvite(created.invite.code)).roomId, created.credential.roomId)
})
