import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { ProposalService } from "./proposal-service.server.ts"
import { ProposalMemoryRepository, proposalFixtureCatalog } from "./proposal-test-support.ts"
import { proposalAdmissionSchema, proposalCreateSchema, proposalJoinSchema } from "./proposal-validation.ts"
import type { CreateRoomRequest, RoomCommand } from "../../../packages/yepwatch-contracts/proposal.ts"
import type { ProposalRoom } from "./proposal-types.ts"

/** A service whose repository counts writes, so "one stored write" is checkable. */
function fixture(options: { search?: "ok" | "fail" | "none" } = {}) {
	const repo = new ProposalMemoryRepository()
	let inserts = 0
	let swaps = 0
	const insert = repo.insert.bind(repo)
	const swap = repo.compareAndSwap.bind(repo)
	repo.insert = async (room: ProposalRoom) => { inserts++; return insert(room) }
	repo.compareAndSwap = async (...args: Parameters<typeof swap>) => { swaps++; return swap(...args) }
	let searches = 0
	const catalog = {
		...proposalFixtureCatalog,
		async refresh(room: ProposalRoom) { return structuredClone(room.candidates) },
		async metadata() {
			return {
				countries: [{ code: "DE", name: "Germany" }, { code: "US", name: "United States" }],
				services: [1, 2, 3].map((id) => ({ id, name: String(id), logoUrl: null })),
				moods: []
			}
		}
	}
	const search = options.search ?? "ok"
	const service = new ProposalService(
		repo, catalog, "create-setup-test-secret-over-thirty-two", undefined, Date.now, undefined,
		search === "none" ? undefined : async (prompt) => {
			searches++
			if (search === "fail") throw new Error("search down")
			return { prompt, attributes: [{ text: "heist", kind: "attribute" as const }], rankedKeys: [1_000_000_000_001], interpretedAt: 7 }
		}
	)
	const request = (setup?: CreateRoomRequest["setup"]): CreateRoomRequest => ({
		contractVersion: 3, commandId: randomUUID(), admissionSecret: "a".repeat(43), nickname: "", ...(setup ? { setup } : {})
	})
	return { repo, service, request, inserts: () => inserts, swaps: () => swaps, searches: () => searches }
}

test("create schema: setup is optional and strict; joins and plain admissions refuse it", () => {
	const base = { contractVersion: 3, commandId: "a", admissionSecret: "x".repeat(43), nickname: "" }
	assert.equal(proposalCreateSchema.safeParse(base).success, true)
	assert.equal(proposalCreateSchema.safeParse({ ...base, setup: { country: "DE", idea: "  space heist " } }).data?.setup?.idea, "space heist")
	assert.equal(proposalCreateSchema.safeParse({ ...base, setup: { country: "DE" } }).success, true)
	assert.equal(proposalCreateSchema.safeParse({ ...base, setup: { country: "de" } }).success, false)
	assert.equal(proposalCreateSchema.safeParse({ ...base, setup: { country: "DE", idea: "x" } }).success, false)
	assert.equal(proposalCreateSchema.safeParse({ ...base, setup: { country: "DE", extra: 1 } }).success, false)
	// Servers before setup refuse it (400): the app then sends the request again without it.
	assert.equal(proposalAdmissionSchema.safeParse({ ...base, setup: { country: "DE" } }).success, false)
	assert.equal(proposalJoinSchema.safeParse({ ...base, nickname: "Mia", inviteCode: "c", setup: { country: "DE" } }).success, false)
})

test("one create with setup stores a room with its country and first idea in one write", async () => {
	const f = fixture()
	const a = await f.service.create(f.request({ country: "DE", idea: "space heist" }))
	const s = a.snapshot.shared
	assert.equal(s.screens[0]?.country, "DE")
	assert.deepEqual(s.ideas.map((i) => [i.text, i.authorId, i.on]), [["space heist", a.snapshot.own.participantId, true]])
	assert.deepEqual(s.ideas[0].attributes, [{ text: "heist", kind: "attribute" }])
	assert.equal(s.phase, "setup")
	// Nothing was sent as a command: the client's first command is still sequence 1.
	assert.equal(a.snapshot.own.nextSequence, 1)
	assert.equal(f.inserts(), 1)
	assert.equal(f.swaps(), 0)
	assert.equal(f.searches(), 1)
	const stored = await f.service.read(s.roomId, a.credential)
	assert.equal(stored.shared.screens[0]?.country, "DE")
	assert.equal(stored.shared.ideas.length, 1)
})

test("a retried create with setup returns the same room and never searches or writes again", async () => {
	const f = fixture()
	const request = f.request({ country: "US", idea: "rainy day whodunit" })
	const first = await f.service.create(request)
	const again = await f.service.create(structuredClone(request))
	assert.equal(again.credential.roomId, first.credential.roomId)
	assert.equal(again.credential.participantId, first.credential.participantId)
	assert.deepEqual(again.snapshot.shared.ideas.map((i) => i.id), first.snapshot.shared.ideas.map((i) => i.id))
	assert.equal(f.inserts(), 1)
	assert.equal(f.searches(), 1)
	// The same command id with a different setup is a changed admission, not a second room.
	await assert.rejects(f.service.create({ ...request, setup: { country: "DE" } }), { code: "conflict" })
})

test("the host's later commands follow on from a set-up room (edit idea, change country)", async () => {
	const f = fixture()
	const a = await f.service.create(f.request({ country: "DE", idea: "space heist" }))
	const id = a.credential.roomId
	const send = async (command: RoomCommand) => {
		const s = await f.service.read(id, a.credential)
		return f.service.command(id, a.credential, { commandId: randomUUID(), sequence: s.own.nextSequence, command })
	}
	const idea = a.snapshot.shared.ideas[0]
	await send({ type: "edit_idea", ideaId: idea.id, text: "space opera" })
	const s = await f.service.read(id, a.credential)
	await send({ type: "configure", expectedContextVersion: s.shared.contextVersion, country: "US" })
	const after = await f.service.read(id, a.credential)
	assert.deepEqual(after.shared.ideas.map((i) => i.text), ["space opera"])
	assert.equal(after.shared.screens[0]?.country, "US")
	assert.equal(after.own.nextSequence, 3)
})

test("setup that can't apply is left for the app's own commands; the room is still created", async () => {
	const failed = fixture({ search: "fail" })
	const a = await failed.service.create(failed.request({ country: "DE", idea: "space heist" }))
	assert.equal(a.snapshot.shared.screens[0]?.country, "DE")
	assert.deepEqual(a.snapshot.shared.ideas, [])
	const none = fixture({ search: "none" })
	const b = await none.service.create(none.request({ country: "DE", idea: "space heist" }))
	assert.equal(b.snapshot.shared.screens[0]?.country, "DE")
	assert.deepEqual(b.snapshot.shared.ideas, [])
	const unknown = fixture()
	const c = await unknown.service.create(unknown.request({ country: "ZZ", idea: "space heist" }))
	assert.deepEqual(c.snapshot.shared.screens, [])
	assert.deepEqual(c.snapshot.shared.ideas, [])
	assert.equal(unknown.searches(), 0)
})

test("a create without setup (older apps) is unchanged: no country, no idea", async () => {
	const f = fixture()
	const a = await f.service.create(f.request())
	assert.deepEqual(a.snapshot.shared.screens, [])
	assert.deepEqual(a.snapshot.shared.ideas, [])
	assert.equal(f.searches(), 0)
})
