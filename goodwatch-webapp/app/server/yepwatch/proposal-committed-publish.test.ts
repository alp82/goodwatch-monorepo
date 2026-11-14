import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import type { RoomCommand, RoomCommitted, RoomInvalidation, GuestAdmission } from "../../../packages/yepwatch-contracts/proposal.ts"
import { paths } from "../../../packages/yepwatch-contracts/proposal.ts"
import { ProposalService, revisionMessage } from "./proposal-service.server.ts"
import { ProposalMemoryRepository, proposalFixtureCatalog } from "./proposal-test-support.ts"
import { createProposalHandler } from "./proposal-http.server.ts"

const secret = "committed-publish-secret-over-thirty-two"

/** Counts room reads; the published events are kept in order. */
class CountingRepository extends ProposalMemoryRepository {
	reads = 0
	override async read(...args: Parameters<ProposalMemoryRepository["read"]>) {
		this.reads++
		return super.read(...args)
	}
}
async function started() {
	const repo = new CountingRepository()
	const events: (RoomInvalidation | RoomCommitted)[] = []
	const catalog = {
		...proposalFixtureCatalog,
		async metadata() {
			return { countries: [{ code: "US", name: "United States" }], services: [{ id: 1, name: "1", logoUrl: null }], moods: [] }
		},
	}
	const service = new ProposalService(repo, catalog, secret, async (event) => {
		events.push(structuredClone(event))
	})
	const admission = (nickname: string) => ({
		contractVersion: 3 as const,
		commandId: randomUUID(),
		admissionSecret: "a".repeat(43),
		nickname,
	})
	const a = await service.create(admission("Host"))
	const id = a.credential.roomId
	const b = await service.join(id, { ...admission("Friend"), inviteCode: a.invite.code })
	const send = async (c: RoomCommand, who: GuestAdmission = a) => {
		const s = await service.read(id, who.credential)
		return service.command(id, who.credential, { commandId: randomUUID(), sequence: s.own.nextSequence, command: c })
	}
	let s = await service.read(id, a.credential)
	await send({ type: "configure", expectedContextVersion: s.shared.contextVersion, country: "US" })
	await send({ type: "set_services", serviceIds: [1] })
	s = await service.read(id, a.credential)
	const start = await send({
		type: "start",
		expectedContextVersion: s.shared.contextVersion,
		expectedRosterVersion: s.shared.rosterVersion,
		hostReady: true,
	})
	// Let notify/repair of the setup commands settle before measuring a vote.
	await new Promise((resolve) => setTimeout(resolve, 20))
	const vote = (who: GuestAdmission, candidateId = start.snapshot.shared.candidates[0].id) =>
		send({ type: "vote", generation: start.snapshot.shared.generation, candidateId, expectedVoteRevision: 0, value: "watch" }, who)
	return { repo, service, events, a, b, id, send, vote, start }
}
const isCommitted = (e: RoomInvalidation | RoomCommitted): e is RoomCommitted => "snapshot" in e

test("a vote publishes the committed room: the snapshot the gateway would read, and who may view it", async () => {
	const r = await started()
	const before = r.events.length
	const result = await r.vote(r.b)
	await new Promise((resolve) => setTimeout(resolve, 20))
	const published = r.events.slice(before).filter((e) => e.revision === result.receipt.appliedRevision)
	// The committed room, then its plain hint for a gateway that knows only those; notify doesn't publish again.
	assert.equal(published.length, 2, "published once")
	const event = published[0]
	assert.ok(isCommitted(event), "carries the committed room")
	assert.deepEqual(published[1], { roomId: r.id, revision: result.receipt.appliedRevision })
	// What the gateway would otherwise have read back for this revision.
	const attachments = await Promise.all(
		[r.a, r.b].map(async (p) => r.service.attach(r.id, (await r.service.ticket(r.id, p.credential)).ticket))
	)
	const views = await r.service.views(r.id, attachments.map((x) => x.lease))
	assert.deepEqual(event.snapshot, views.snapshot)
	const byId = (x: { participantId: string }, y: { participantId: string }) => x.participantId.localeCompare(y.participantId)
	assert.deepEqual(
		[...event.viewers].sort(byId),
		attachments.map((x) => ({ participantId: x.participantId, capabilityEpoch: x.capabilityEpoch })).sort(byId)
	)
})

test("after a vote, nothing reads the room again to publish or acknowledge it", async () => {
	const r = await started()
	const sequence = (await r.service.read(r.id, r.b.credential)).own.nextSequence
	const reads = r.repo.reads
	await r.service.command(r.id, r.b.credential, {
		commandId: randomUUID(),
		sequence,
		command: { type: "vote", generation: r.start.snapshot.shared.generation, candidateId: r.start.snapshot.shared.candidates[0].id, expectedVoteRevision: 0, value: "watch" },
	})
	await new Promise((resolve) => setTimeout(resolve, 30))
	assert.equal(r.repo.reads - reads, 1, "only the command's own read")
	assert.equal((await r.repo.read(r.id))!.pendingRevision, 0, "acknowledged")
})

test("a departed participant is not a viewer of the committed room", async () => {
	const r = await started()
	await r.send({ type: "leave" } as RoomCommand, r.b)
	const before = r.events.length
	await r.vote(r.a)
	await new Promise((resolve) => setTimeout(resolve, 20))
	const event = r.events.slice(before).find(isCommitted)
	assert.ok(event)
	assert.deepEqual(event.viewers.map((v) => v.participantId), [r.a.credential.participantId])
})

test("a vote's Server-Timing names its publish", async () => {
	const r = await started()
	const handler = createProposalHandler(r.service, { serviceSecret: secret, allowedOrigins: [], secureCookies: false })
	const s = await r.service.read(r.id, r.b.credential)
	const response = await handler(
		new Request(`http://api${paths.commands(r.id)}`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-yepwatch-client": "native",
				authorization: `Bearer ${r.b.credential.token}`,
				"x-yepwatch-participant": r.b.credential.participantId,
			},
			body: JSON.stringify({
				commandId: randomUUID(),
				sequence: s.own.nextSequence,
				command: { type: "vote", generation: r.start.snapshot.shared.generation, candidateId: r.start.snapshot.shared.candidates[0].id, expectedVoteRevision: 0, value: "watch" },
			}),
		})
	)
	assert.equal(response.status, 200)
	const header = response.headers.get("server-timing") ?? ""
	for (const name of ["body", "read", "preflight", "transition", "write", "publish", "snapshot"])
		assert.match(header, new RegExp(`(^|, )${name};dur=`), `${name} in ${header}`)
})

test("a committed room is serialized once: the bus message is the JSON its size was checked on", async () => {
	const r = await started()
	const messages: string[] = []
	;(r.service as unknown as { publish: (e: RoomInvalidation | RoomCommitted) => Promise<void> }).publish = async (event) => {
		messages.push(revisionMessage(event))
	}
	const stringify = JSON.stringify
	let committedSerializations = 0
	JSON.stringify = ((value: unknown, ...rest: unknown[]) => {
		if (value && typeof value === "object" && "snapshot" in value && "viewers" in value) committedSerializations++
		return (stringify as (...args: unknown[]) => string)(value, ...rest)
	}) as typeof JSON.stringify
	let result
	try {
		result = await r.vote(r.b)
		await new Promise((resolve) => setTimeout(resolve, 20))
	} finally {
		JSON.stringify = stringify
	}
	const committed = messages.map((m) => JSON.parse(m)).filter((e) => e.revision === result.receipt.appliedRevision)
	assert.equal(committed.length, 2)
	assert.ok(isCommitted(committed[0]))
	assert.equal(committedSerializations, 1, "the size check and the bus message share one JSON.stringify")
})

test("a room read that names the shared revision it holds gets only its own part while the room is still there", async () => {
	const r = await started()
	const handler = createProposalHandler(r.service, { serviceSecret: secret, allowedOrigins: [], secureCookies: false })
	const read = (query = "") => handler(new Request(`http://api${paths.snapshot(r.id)}${query}`, {
		headers: { "x-yepwatch-client": "native", authorization: `Bearer ${r.b.credential.token}`, "x-yepwatch-participant": r.b.credential.participantId },
	})).then(async (response) => ({ status: response.status, body: await response.json() }))
	const full = await read()
	assert.equal(full.status, 200)
	const revision = full.body.shared.revision
	// Current: the own part and the revision it belongs to.
	assert.deepEqual(await read(`?known=${revision}`), { status: 200, body: { own: full.body.own, sharedRevision: revision } })
	// Behind (or ahead of) the room, or not a revision: the whole room, as before.
	for (const known of [revision - 1, revision + 1, "x", "", "1e3"]) {
		const answer = await read(`?known=${known}`)
		assert.equal(answer.status, 200)
		assert.deepEqual(Object.keys(answer.body).sort(), ["own", "shared"], `known=${known}`)
	}
	await r.vote(r.a)
	const after = await read(`?known=${revision}`)
	assert.ok(after.body.shared.revision > revision, "a newer room comes whole")
})
