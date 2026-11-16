import test from "node:test"
import assert from "node:assert/strict"
import { PreparedDecks } from "./proposal-prepared-decks.ts"
import { PosterPreviews } from "./proposal-poster-preview.ts"
import { ProposalService } from "./proposal-service.server.ts"
import { ProposalMemoryRepository, proposalFixtureCatalog } from "./proposal-test-support.ts"
import { rankingRoom, cards } from "./proposal-ranking-test-support.ts"
import type { ProposalCatalog } from "./proposal-types.ts"
import { hash } from "./crypto.server.ts"
import { createProposalHandler } from "./proposal-http.server.ts"
import { paths, PENDING_IDEA_ATTRIBUTE } from "../../../packages/yepwatch-contracts/proposal.ts"

const secret = "poster-preview-tests-secret-at-least-thirty-two"
test("preview passes current services, kinds and stored enabled ideas to a five-card page, caches and never mutates the room", async () => {
	const room = rankingRoom()
	room.phase = "setup"
	room.ideas = [
		{
			id: "idea",
			authorId: room.hostId,
			text: "witty",
			on: true,
			attributes: [{ kind: "want", key: "wit_wordplay", text: "witty" }],
			rankedKeys: [1e12 + 2],
			interpretedAt: 1,
		},
	]
	let calls = 0,
		revision = "taste-1",
		now = 100
	const catalog: ProposalCatalog = {
		...proposalFixtureCatalog,
		inputRevision: () => revision,
		async page(got, options) {
			calls++
			assert.deepEqual(options, { limit: 5, preview: true })
			assert.deepEqual(got.screens, room.screens)
			assert.deepEqual(got.constraints, room.constraints)
			assert.deepEqual(
				got.ideas,
				(room.ideas ?? []).filter((i) => i.on),
			)
			// Even a mutating catalog can only change the detached copy.
			got.seenKeys.push("movie_999")
			got.participants[0].votes.extra = { value: "pass", revision: 1 }
			return {
				candidates: cards(8).map((c) => ({
					...c,
					posterUrl: "https://posters.invalid/title.jpg",
					ideaIds: ["idea"],
				})),
				exhausted: false,
			}
		},
	}
	const preview = new PosterPreviews(catalog, () => now)
	const before = structuredClone(room)
	const [first, second] = await Promise.all([preview.read(room), preview.read(room)])
	assert.equal(first.candidates.length, 5)
	assert.deepEqual(second, first)
	assert.equal(calls, 1)
	assert.equal(first.candidates[0].posterUrl, "https://posters.invalid/title.jpg")
	assert.equal("ideaIds" in first.candidates[0], false, "same public projection as the deck")
	first.candidates[0].title = "client mutation"
	assert.notEqual((await preview.read(room)).candidates[0].title, "client mutation")
	assert.deepEqual(room, before)
	room.screens[0].serviceIds = [2]
	await preview.read(room)
	room.constraints.kinds = ["show_start"]
	await preview.read(room)
	room.screens[0].country = "US"
	await preview.read(room)
	room.ideas[0].attributes = [{ kind: "avoid", key: "horror", text: "no horror" }]
	await preview.read(room)
	room.ideas[0].on = false
	await preview.read(room)
	revision = "taste-2"
	await preview.read(room)
	assert.equal(calls, 7)
	now += 10_001
	await preview.read(room)
	assert.equal(calls, 8)
	room.screens[0].serviceIds = []
	assert.deepEqual(await preview.read(room), { candidates: [] })
	assert.equal(calls, 8)
})

test("timeout keeps the build, failures are retryable, and the fifth busy room is not cached", async () => {
	const room = rankingRoom()
	room.phase = "setup"
	let finish!: (page: { candidates: ReturnType<typeof cards>; exhausted: boolean }) => void
	let calls = 0
	const preview = new PosterPreviews({
		...proposalFixtureCatalog,
		page: async () => {
			calls++
			return new Promise((resolve) => {
				finish = resolve
			})
		},
	})
	await assert.rejects(preview.read(room), { status: 503, retryable: true })
	finish({ candidates: cards(5), exhausted: false })
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal((await preview.read(room)).candidates.length, 5)
	assert.equal(calls, 1)
	const releases: (() => void)[] = []
	const busy = new PosterPreviews({
		...proposalFixtureCatalog,
		page: async () => {
			calls++
			await new Promise<void>((resolve) => releases.push(resolve))
			return { candidates: cards(5), exhausted: false }
		},
	})
	const pending = Array.from({ length: 4 }, (_, i) => busy.read({ ...room, id: `busy-${i}` }))
	const fifth = { ...room, id: "fifth" }
	await assert.rejects(busy.read(fifth), { status: 503, retryable: true })
	releases.forEach((resolve) => resolve())
	await Promise.all(pending)
	const next = busy.read(fifth)
	await new Promise((resolve) => setImmediate(resolve))
	releases.at(-1)!()
	assert.equal((await next).candidates.length, 5)
	let failures = 0
	const broken = new PosterPreviews({
		...proposalFixtureCatalog,
		page: async () => {
			failures++
			throw Error("down")
		},
	})
	for (let i = 0; i < 2; i++)
		await assert.rejects(broken.read(room), { status: 503, retryable: true })
	assert.equal(failures, 2)
	room.phase = "choosing"
	assert.deepEqual(await broken.read(room), { candidates: [] })
	room.phase = "setup"
	room.constraints.kinds = ["show_continue"]
	assert.deepEqual(await broken.read(room), { candidates: [] })
})

test("GET preview uses snapshot participant authorization without starting pending interpretations or room writes", async () => {
	const repo = new ProposalMemoryRepository(),
		room = rankingRoom()
	room.id = "a".repeat(32)
	room.phase = "setup"
	room.participants[0].tokenHash = hash("token")
	room.ideas = [
		{
			id: "pending",
			text: "pending",
			on: true,
			authorId: room.hostId,
			attributes: [PENDING_IDEA_ATTRIBUTE],
			rankedKeys: [],
			interpretedAt: 0,
		},
	]
	await repo.insert(room)
	const before = structuredClone(repo.rows)
	let interpretations = 0,
		pages = 0
	const service = new ProposalService(
		repo,
		{
			...proposalFixtureCatalog,
			page: async () => {
				pages++
				return { candidates: cards(5), exhausted: false }
			},
		},
		secret,
		undefined,
		undefined,
		undefined,
		async () => {
			interpretations++
			throw Error("must never interpret")
		},
	)
	const handler = createProposalHandler(service, {
		serviceSecret: secret,
		allowedOrigins: ["https://app.invalid"],
	})
	const read = (token = "token", participantId = room.hostId) =>
		handler(
			new Request(`https://app.invalid${paths.roomPreview(room.id)}`, {
				headers: {
					"X-YepWatch-Client": "native",
					Authorization: `Bearer ${token}`,
					"X-YepWatch-Participant": participantId,
				},
			}),
		)
	const response = await read()
	assert.equal(response.status, 200)
	assert.equal((await response.json()).candidates.length, 5)
	assert.equal((await read("bad")).status, 401)
	assert.equal(interpretations, 0)
	assert.equal(pages, 1)
	assert.deepEqual(repo.rows, before)
	const peer = structuredClone(room.participants[0])
	peer.id = "peer"
	room.participants.push(peer)
	repo.rows.get(room.id)!.room.participants.push(peer)
	assert.equal((await read("token", "peer")).status, 200, "non-host participants may read")
	repo.rows.get(room.id)!.room.participants[1].leftAt = 1
	assert.equal((await read("token", "peer")).status, 403)
})

test("peek is detached, exact and has no build or consumption effects; preview leaves Start unchanged", async () => {
	const room = rankingRoom()
	room.phase = "setup"
	let calls = 0,
		revision = "v1",
		now = 100
	const catalog = {
		...proposalFixtureCatalog,
		inputRevision: () => revision,
		page: async () => {
			calls++
			return { candidates: cards(12), exhausted: false }
		},
	}
	const decks = new PreparedDecks(catalog, async () => room, { now: () => now })
	assert.equal(decks.peek(room), null)
	assert.equal(calls, 0)
	const pending = decks.page(room)
	assert.equal(decks.peek(room), null, "peek never waits for a build")
	const prepared = await pending
	const peek = decks.peek(room)!
	peek.candidates.reverse()
	const preview = new PosterPreviews(catalog, Date.now, decks)
	assert.deepEqual(
		(await preview.read(room)).candidates.map((c) => c.id),
		prepared.candidates.slice(0, 5).map((c) => c.id),
	)
	assert.deepEqual(await decks.page(room), prepared)
	assert.equal(calls, 1)
	revision = "v2"
	assert.equal(decks.peek(room), null)
	revision = "v1"
	now += 600_001
	assert.equal(decks.peek(room), null, "expired decks are not reused")
	now = 100
	const changed = structuredClone(room)
	changed.screens[0].serviceIds = [999]
	assert.equal(decks.peek(changed), null)
	assert.equal(calls, 1)
	assert.deepEqual(await decks.page(room), prepared)
	room.participants[0].tokenHash = hash("token")
	const start = async (withPreview: boolean, prepared: boolean) => {
		const repo = new ProposalMemoryRepository()
		await repo.insert(structuredClone(room))
		const service = new ProposalService(repo, catalog, secret)
		const credential = { participantId: room.hostId, token: "token" }
		if (prepared) await service.decks.page(room)
		if (withPreview)
			assert.equal((await service.posterPreview(room.id, credential)).candidates.length, 5)
		await service.command(room.id, credential, {
			commandId: "a".repeat(32),
			sequence: 1,
			command: {
				type: "start",
				expectedRosterVersion: room.rosterVersion,
				expectedContextVersion: room.contextVersion,
				hostReady: true,
			},
		})
		return repo.rows.get(room.id)!.room.candidates
	}
	for (const prepared of [false, true])
		assert.deepEqual(await start(true, prepared), await start(false, prepared))
})

test("preview starts a known-expiry guard check alongside its room read", async () => {
	const repo = new ProposalMemoryRepository(),
		room = rankingRoom()
	room.phase = "setup"
	room.participants[0].tokenHash = hash("token")
	await repo.insert(room)
	let checks = 0,
		block = false,
		release!: () => void
	const held = new Promise<void>((resolve) => {
		release = resolve
	})
	const read = repo.read.bind(repo)
	repo.read = async (id) => {
		if (block) await held
		return read(id)
	}
	const service = new ProposalService(repo, proposalFixtureCatalog, secret, undefined, undefined, {
		active: async () => {
			checks++
		},
		create: async () => {
			throw Error("must not create")
		},
		join: async () => {
			throw Error("must not join")
		},
		command: async () => {
			throw Error("must not reserve a command")
		},
	})
	const credential = { participantId: room.hostId, token: "token" }
	await service.read(room.id, credential)
	const before = checks
	block = true
	const preview = service.posterPreview(room.id, credential)
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(checks, before + 1, "guard started while the repository was still blocked")
	release()
	await preview
})
