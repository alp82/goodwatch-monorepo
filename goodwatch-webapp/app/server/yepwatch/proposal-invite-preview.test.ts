import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { paths } from "../../../packages/yepwatch-contracts/proposal.ts"
import { createProposalHandler } from "./proposal-http.server.ts"
import { ProposalService } from "./proposal-service.server.ts"
import { ProposalMemoryRepository, proposalFixtureCatalog } from "./proposal-test-support.ts"
import { RoomError } from "./errors.ts"
import { hash, keyed } from "./crypto.server.ts"
import { previousInvite } from "./proposal-invites.ts"

const secret = "invite-preview-test-secret-over-thirty-two"
async function fixture() {
	const repo = new ProposalMemoryRepository()
	let now = Date.now()
	const service = new ProposalService(repo, proposalFixtureCatalog, secret, undefined, () => now)
	const a = await service.create({
		contractVersion: 3, commandId: randomUUID(), admissionSecret: "a".repeat(43), nickname: "Alp"
	})
	const row = repo.rows.get(a.credential.roomId)!
	const handler = createProposalHandler(service, { serviceSecret: secret, allowedOrigins: [] })
	const post = (path: string, body: unknown) => handler(new Request(`http://fixture.test${path}`, {
		method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
	}))
	return { repo, row, a, post, expire: () => { now = row.room.expiresAt + 1 } }
}

test("public invite preview projects only enabled idea text in order, current people and room context without writes", async () => {
	const f = await fixture()
	const room = f.row.room
	room.ideas = [true, false, true].map((on, i) => ({
		id: `idea-${i}`, text: `Idea ${i}`, on, authorId: room.hostId,
		attributes: [{text: "private interpretation", kind: "phrase"}], rankedKeys: [123], interpretedAt: 1
	}))
	room.participants.push({ ...structuredClone(room.participants[0]), id: "left-person", nickname: "Left", leftAt: 1 })
	room.constraints.kinds = ["movie", "show_start"]
	for (const phase of ["setup", "choosing", "decided"] as const) {
		room.phase = phase
		const before = structuredClone([...f.repo.rows])
		const response = await f.post(paths.invitePreview, { code: f.a.invite.code.toLowerCase() })
		assert.equal(response.status, 200)
		assert.equal(response.headers.get("cache-control"), "private, no-store")
		assert.equal(response.headers.get("set-cookie"), null)
		assert.deepEqual(await response.json(), {
			roomId: room.id, hostName: "Alp", ideas: [{text: "Idea 0"}, {text: "Idea 2"}],
			kinds: ["movie", "show_start"], phase, people: 1
		})
		assert.deepEqual([...f.repo.rows], before)
	}
	room.participants[0].nickname = ""
	room.ideas = undefined
	assert.equal((await (await f.post(paths.invitePreview, {code: f.a.invite.code})).json()).hostName, null)
	assert.deepEqual((await (await f.post(paths.invitePreview, {code: f.a.invite.code})).json()).ideas, [])
})

test("preview shares resolve validation and errors for unknown, malformed and expired codes", async () => {
	const f = await fixture()
	for (const body of [{ code: "ZZZZZZ" }, { code: "bad" }, { code: "" }, { code: "x".repeat(201) }, {}, { code: f.a.invite.code, extra: true }]) {
		const resolve = await f.post(paths.resolveInvite, body)
		const preview = await f.post(paths.invitePreview, body)
		assert.equal(preview.status, resolve.status)
		assert.ok(preview.status >= 400)
		assert.deepEqual(await preview.json(), await resolve.json())
	}
	f.expire()
	const resolve = await f.post(paths.resolveInvite, { code: f.a.invite.code })
	const preview = await f.post(paths.invitePreview, { code: f.a.invite.code })
	assert.equal(preview.status, 410)
	assert.deepEqual(await preview.json(), await resolve.json())
})

test("preview accepts grouped short, previous 16-character and legacy signed invites like resolve", async () => {
	const f = await fixture()
	const grouped = f.a.invite.code.toLowerCase().match(/.{1,3}/g)!.join("- ")
	const legacy = `${f.row.room.id}.${keyed(secret, "proposal-invite", f.row.room.id)}`
	for (const code of [grouped, previousInvite(secret, f.row.room.id), legacy]) {
		// Existing room hashes are authoritative for each historical invite format.
		if (code !== grouped) {
			f.row.room.inviteHash = hash(code)
			await f.repo.rememberInvite(hash(code), f.row.room.id, f.row.room.expiresAt)
		}
		assert.equal((await f.post(paths.resolveInvite, {code})).status, 200)
		const response = await f.post(paths.invitePreview, {code})
		assert.equal(response.status, 200)
		assert.equal((await response.json()).roomId, f.row.room.id)
	}
})


test("preview uses resolve's active-room guard and preserves budget denial", async () => {
	const f = await fixture()
	let checks = 0
	const service = new ProposalService(f.repo, proposalFixtureCatalog, secret, undefined, Date.now, {
		async active() { checks++; throw new RoomError("limit_reached", "Read budget reached", 429, true) },
		async create() { throw new Error("Unexpected create") },
		async join() { throw new Error("Unexpected join") },
		async command() { throw new Error("Unexpected command") }
	})
	const handler = createProposalHandler(service, {serviceSecret: secret, allowedOrigins: []})
	const responses = []
	for (const path of [paths.resolveInvite, paths.invitePreview]) {
		const response = await handler(new Request(`http://fixture.test${path}`, {
			method: "POST", headers: {"content-type": "application/json"},
			body: JSON.stringify({code: f.a.invite.code})
		}))
		assert.equal(response.status, 429)
		responses.push(await response.json())
	}
	assert.equal(checks, 2)
	assert.deepEqual(responses[0], responses[1])
})
