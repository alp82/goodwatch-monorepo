import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import type { RoomCommand } from "../../../packages/yepwatch-contracts/proposal.ts"
import type { ProposalCatalog } from "./proposal-types.ts"
import { ProposalService } from "./proposal-service.server.ts"
import { ProposalMemoryRepository, proposalFixtureCatalog } from "./proposal-test-support.ts"

const admission = (nickname: string) => ({
	contractVersion: 3 as const,
	commandId: randomBytes(16).toString("hex"),
	admissionSecret: randomBytes(32).toString("base64url"),
	nickname,
})

async function room() {
	const state: { hold: Promise<void> | null; entered: (() => void) | null; pages: number } = { hold: null, entered: null, pages: 0 }
	// An endless deck: pages of 3 titles the room hasn't seen, built from a fixture card.
	const catalog: ProposalCatalog = {
		...proposalFixtureCatalog,
		async page(room) {
			state.pages++
			if (state.hold) {
				state.entered?.()
				await state.hold
			}
			const template = (await proposalFixtureCatalog.page(room)).candidates[0] ?? (await proposalFixtureCatalog.page({ ...room, seenKeys: [] })).candidates[0]
			const seen = new Set(room.seenKeys)
			const fresh = Array.from({ length: 60 }, (_, i) => 7000 + i).filter((tmdbId) => !seen.has(`movie_${tmdbId}`)).slice(0, 3)
			return {
				candidates: fresh.map((tmdbId) => ({ ...structuredClone(template), id: `fixture-${tmdbId}`, identity: { kind: "movie" as const, tmdbId } })),
				exhausted: false,
			}
		},
	}
	const service = new ProposalService(new ProposalMemoryRepository(), catalog, "refill-lane-test-secret-at-least-32-chars")
	const host = await service.create(admission("Host"))
	const friend = await service.join(host.credential.roomId, { ...admission("Friend"), inviteCode: host.invite.code })
	const id = host.credential.roomId
	const who = (a: typeof host) => ({ participantId: a.credential.participantId, token: a.credential.token })
	const send = async (person: typeof host, command: RoomCommand) => {
		const snapshot = await service.read(id, who(person))
		return service.command(id, who(person), { commandId: randomBytes(16).toString("hex"), sequence: snapshot.own.nextSequence, command })
	}
	await send(host, {
		type: "setup",
		expectedContextVersion: 1,
		screens: [{ id: "couch", label: "TV", country: "DE", serviceIds: [1], confirmed: true }],
		constraints: { kinds: ["movie"], maxMinutes: null, moods: [] },
		screenId: "couch",
	})
	const ready = await service.read(id, who(friend))
	await send(friend, { type: "assign_screen", expectedContextVersion: ready.shared.contextVersion, screenId: "couch" })
	await send(friend, { type: "ready", expectedContextVersion: (await service.read(id, who(friend))).shared.contextVersion, ready: true })
	const before = (await service.read(id, who(host))).shared
	const started = await send(host, { type: "start", expectedContextVersion: before.contextVersion, expectedRosterVersion: before.rosterVersion, hostReady: true })
	const { generation, candidates } = started.snapshot.shared
	assert.ok(candidates.length >= 3, "a deck to vote on")
	const vote = (person: typeof host, candidateId: string) =>
		send(person, { type: "vote", generation, candidateId, expectedVoteRevision: 0, value: "watch" })
	await vote(host, candidates[0].id)
	await vote(friend, candidates[0].id)
	return { state, service, id, host, friend, who, send, vote, generation, candidates }
}

test("a vote landing while a refill's page is read doesn't wait for it, and the refill still fills the deck", { timeout: 5000 }, async () => {
	const { state, service, id, host, friend, who, send, vote, generation, candidates } = await room()
	let release!: () => void
	state.hold = new Promise<void>((resolve) => { release = resolve })
	const building = new Promise<void>((resolve) => { state.entered = resolve })
	const low = (await service.read(id, who(host))).shared
	const refill = send(host, { type: "refill", generation, expectedStreamVersion: low.stream.version })
	refill.catch(() => {})
	await building
	try {
		// The page is still being read: the friend's vote lands anyway.
		const voted = await Promise.race([
			vote(friend, candidates[1].id).then(() => "voted"),
			new Promise((resolve) => setTimeout(() => resolve("waited behind the refill"), 1000)),
		])
		assert.equal(voted, "voted")
	} finally {
		state.hold = null
		release()
	}
	await refill
	const after = (await service.read(id, who(host))).shared
	assert.equal(after.stream.version, low.stream.version + 1, "the refill appended its page")
	assert.ok(after.candidates.length > low.candidates.length - 1, "new cards in the deck")
	assert.equal((await service.read(id, who(friend))).own.votes.find((v) => v.candidateId === candidates[1].id)?.value, "watch")
	service.decks.forget(id)
})

test("the same refill sent again while its page is built shares that build", { timeout: 5000 }, async () => {
	const { state, service, id, host, who, generation } = await room()
	let release!: () => void
	state.hold = new Promise<void>((resolve) => { release = resolve })
	const building = new Promise<void>((resolve) => { state.entered = resolve })
	const low = (await service.read(id, who(host))).shared
	const before = state.pages
	const envelope = {
		commandId: randomBytes(16).toString("hex"),
		sequence: (await service.read(id, who(host))).own.nextSequence,
		command: { type: "refill", generation, expectedStreamVersion: low.stream.version } as RoomCommand,
	}
	const sends = Array.from({ length: 10 }, () => service.command(id, who(host), envelope))
	await building
	await new Promise((resolve) => setTimeout(resolve, 50))
	assert.equal(state.pages - before, 1, "one page build for ten copies of the command")
	state.hold = null
	release()
	const results = await Promise.allSettled(sends)
	assert.deepEqual(results.filter((r) => r.status === "rejected").map((r) => String((r as PromiseRejectedResult).reason)), [])
	assert.equal((await service.read(id, who(host))).shared.stream.version, low.stream.version + 1)
	service.decks.forget(id)
})
