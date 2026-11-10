import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createProposalHandler } from "./proposal-http.server.ts"
import { ProposalService } from "./proposal-service.server.ts"
import { ProposalMemoryRepository, proposalFixtureCatalog } from "./proposal-test-support.ts"
import { cardHostName, inviteCard, renderCard, startCard, textWidth } from "./link-cards.ts"
import { inviteCardPng } from "./link-card-renderer.server.ts"

const secret = "link-card-test-secret-over-thirty-two-chars"
const PNG = [0x89, 0x50, 0x4e, 0x47]

async function fixture() {
	const repo = new ProposalMemoryRepository()
	let now = Date.now()
	const service = new ProposalService(repo, proposalFixtureCatalog, secret, undefined, () => now)
	const a = await service.create({ contractVersion: 3, commandId: randomUUID(), admissionSecret: "a".repeat(43), nickname: "Alp" })
	const drawn: (string | null)[] = []
	const handler = createProposalHandler(service, {
		serviceSecret: secret,
		allowedOrigins: [],
		inviteCard: async (host) => (drawn.push(host), new Uint8Array(PNG)),
	})
	const get = (code: string) => handler(new Request(`http://fixture.test/api/yepwatch/v1/proposal/invites/${code}/card.png`))
	return { a, get, drawn, expire: () => (now = repo.rows.get(a.credential.roomId)!.room.expiresAt + 1) }
}

test("invite card shows the host of the invited room, cacheable as PNG", async () => {
	const f = await fixture()
	const response = await f.get(f.a.invite.code)
	assert.equal(response.status, 200)
	assert.equal(response.headers.get("content-type"), "image/png")
	assert.equal(response.headers.get("cache-control"), "public, max-age=86400")
	assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], PNG)
	assert.deepEqual(f.drawn, ["Alp"])
})

test("unknown and ended invites get the generic card", async () => {
	const f = await fixture()
	assert.equal((await f.get("ZZZZZZ")).status, 200)
	f.expire()
	assert.equal((await f.get(f.a.invite.code)).status, 200)
	assert.deepEqual(f.drawn, [null, null])
})

test("names the font can't draw fall back to the generic headline", () => {
	assert.equal(cardHostName("  Zoë   Kraus "), "Zoë Kraus")
	assert.equal(cardHostName("Zoë 🎬"), null)
	assert.equal(cardHostName("山田"), null)
	assert.equal(cardHostName(""), null)
	assert.ok(textWidth("Alp invited you", 84) < 680)
})

test("both cards render as 1200 × 630 PNG", async () => {
	for (const card of [startCard(), inviteCard("Alp"), inviteCard(null), inviteCard("Maximilian-Alexander von Hohenzollern-Sig")]) {
		const png = await renderCard(card)
		assert.deepEqual([...png.subarray(0, 4)], PNG)
		assert.equal(png.readUInt32BE(16), 1200)
		assert.equal(png.readUInt32BE(20), 630)
	}
})

test("the child process renderer draws and keeps the card", async () => {
	const first = await inviteCardPng("Alp")
	assert.deepEqual([...first.subarray(0, 4)], PNG)
	assert.equal(await inviteCardPng("Alp"), first)
})
