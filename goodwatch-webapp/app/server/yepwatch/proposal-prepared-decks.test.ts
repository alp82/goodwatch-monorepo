import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import type { RoomCommand } from "../../../packages/yepwatch-contracts/proposal.ts"
import { ProposalService } from "./proposal-service.server.ts"
import { deckInputs } from "./proposal-prepared-decks.ts"
import { ProposalMemoryRepository, proposalFixtureCatalog } from "./proposal-test-support.ts"
import type { ProposalCatalog, ProposalRoom } from "./proposal-types.ts"

const secret = "prepared-decks-test-secret-at-least-32-chars"
function fixture(options: { delayMs?: number; excluded?: string[] } = {}) {
	const repository = new ProposalMemoryRepository()
	const pages: ProposalRoom[] = []
	const catalog: ProposalCatalog = {
		...proposalFixtureCatalog,
		async page(room) {
			pages.push(structuredClone(room))
			return proposalFixtureCatalog.page(room)
		},
		...(options.excluded ? { excludedKeys: async () => options.excluded! } : {}),
	}
	const service = new ProposalService(repository, catalog, secret, async () => {}, Date.now, undefined, undefined, {
		decks: { delayMs: options.delayMs ?? 1 },
	})
	return { repository, service, pages }
}
async function room(f: ReturnType<typeof fixture>) {
	const host = await f.service.create({
		contractVersion: 3,
		commandId: randomBytes(16).toString("hex"),
		admissionSecret: randomBytes(32).toString("base64url"),
		nickname: "Host",
		setup: { country: "DE" },
	})
	const id = host.credential.roomId
	const credential = { participantId: host.credential.participantId, token: host.credential.token }
	const send = async (command: RoomCommand) => {
		const s = await f.service.read(id, credential)
		return f.service.command(id, credential, { commandId: randomBytes(16).toString("hex"), sequence: s.own.nextSequence, command })
	}
	const start = async () => {
		const s = await f.service.read(id, credential)
		return send({ type: "start", expectedRosterVersion: s.shared.rosterVersion, expectedContextVersion: s.shared.contextVersion, expectedGeneration: s.shared.generation, hostReady: true } as RoomCommand)
	}
	return { id, credential, send, start, stored: async () => (await f.repository.read(id))!.room }
}

test("the first deck is built during setup and Start uses it without asking the catalog again", async () => {
	const f = fixture()
	const r = await room(f)
	await r.send({ type: "set_services", serviceIds: [1] })
	await f.service.decks.idle()
	assert.equal(f.pages.length, 1, "built once in the background")
	assert.ok(f.service.decks.prepared(await r.stored()))
	const started = await r.start()
	assert.equal(f.pages.length, 1, "Start reused the prepared deck")
	assert.equal(started.snapshot.shared.phase, "choosing")
	assert.ok(started.snapshot.shared.candidates.length > 0)
})

test("a setup change after preparation is never answered with the old deck", async () => {
	const f = fixture({ delayMs: 60_000 })
	const r = await room(f)
	await r.send({ type: "set_services", serviceIds: [1] })
	const before = await r.stored()
	await f.service.decks.page(before) // prepared for movies and new shows
	assert.ok(f.service.decks.prepared(before))
	const s = await f.service.read(r.id, r.credential)
	await r.send({ type: "configure", expectedContextVersion: s.shared.contextVersion, constraints: { kinds: ["movie"], maxMinutes: null, moods: [] } })
	const after = await r.stored()
	assert.ok(!f.service.decks.prepared(after))
	await r.start()
	assert.equal(f.pages.length, 2)
	assert.deepEqual(f.pages[1].constraints.kinds, ["movie"])
	f.service.decks.forget(r.id)
})

test("names, readiness and command receipts don't make a prepared deck out of date", async () => {
	const f = fixture()
	const r = await room(f)
	await r.send({ type: "set_services", serviceIds: [1] })
	const before = deckInputs(await r.stored())
	await r.send({ type: "rename", nickname: "Somebody else" } as RoomCommand)
	assert.equal(deckInputs(await r.stored()), before)
})

test("Start retried after losing its compare-and-swap reuses the deck it built", async () => {
	const f = fixture({ delayMs: 60_000 })
	const r = await room(f)
	await r.send({ type: "set_services", serviceIds: [1] })
	const cas = f.repository.compareAndSwap.bind(f.repository)
	let lost = 0
	f.repository.compareAndSwap = async (old, next, notify) => {
		if (next.phase === "choosing" && !lost++) {
			// A friend's unrelated write lands first.
			const current = f.repository.rows.get(next.id)!
			f.repository.rows.set(next.id, { ...current, seq: current.seq + 1 })
			return false
		}
		return cas(old, next, notify)
	}
	const started = await r.start()
	assert.equal(lost, 2)
	assert.equal(f.pages.length, 1, "the retry didn't build the deck again")
	assert.equal(started.snapshot.shared.phase, "choosing")
	f.service.decks.forget(r.id)
})

test("a member's seen titles are left out at Start, also from a deck prepared earlier", async () => {
	const base = fixture()
	const b = await room(base)
	await b.send({ type: "set_services", serviceIds: [1] })
	await base.service.decks.idle()
	const deck = await base.service.decks.page(await b.stored())
	const seen = deck.candidates[0]
	const key = `${seen.identity.kind === "movie" ? "movie" : "show"}_${seen.identity.tmdbId}`
	const f = fixture({ excluded: [key] })
	const r = await room(f)
	await r.send({ type: "set_services", serviceIds: [1] })
	await f.service.decks.idle()
	const started = await r.start()
	assert.equal(f.pages.length, 1)
	assert.ok(!started.snapshot.shared.candidates.some((c) => c.id === seen.id))
})
