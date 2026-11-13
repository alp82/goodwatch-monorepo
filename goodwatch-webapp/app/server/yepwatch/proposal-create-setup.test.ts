import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { ProposalService } from "./proposal-service.server.ts"
import { IndeterminateWrite, RoomError } from "./errors.ts"
import { ProposalMemoryRepository, proposalFixtureCatalog } from "./proposal-test-support.ts"
import { proposalAdmissionSchema, proposalCreateSchema, proposalJoinSchema } from "./proposal-validation.ts"
import type { CreateRoomRequest, RoomCommand } from "../../../packages/yepwatch-contracts/proposal.ts"
import { PENDING_IDEA_ATTRIBUTE } from "../../../packages/yepwatch-contracts/proposal.ts"
import { INTERPRETATION_CONCURRENCY, INTERPRETATION_LEASE_MS } from "./proposal-service.server.ts"
import { SearchBusy } from "./proposal-intent.ts"
import type { ProposalRepository, ProposalRoom } from "./proposal-types.ts"

type Search = "ok" | "fail" | "budget" | "busy" | "none"
/**
 * A service whose repository counts writes, so "one stored write" is checkable. `hold()` makes the next searches
 * wait until `release()`; `clock` moves this fixture's time (rooms, leases); `instance()` is a second API process on
 * the same store (optionally through another repository object, e.g. a stalled one).
 */
function fixture(options: { search?: Search } = {}) {
	const repo = new ProposalMemoryRepository()
	let inserts = 0
	let swaps = 0
	const insert = repo.insert.bind(repo)
	const swap = repo.compareAndSwap.bind(repo)
	repo.insert = async (room: ProposalRoom) => { inserts++; return insert(room) }
	repo.compareAndSwap = async (...args: Parameters<typeof swap>) => { swaps++; return swap(...args) }
	let searches = 0
	let inFlight = 0
	let maxInFlight = 0
	let held: { promise: Promise<void>; resolve: () => void } | null = null
	const clock = { offset: 0 }
	const now = () => Date.now() + clock.offset
	const published: number[] = []
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
	const state = { search: options.search ?? "ok" as Search, attribute: "heist" }
	const interpret = async (prompt: string) => {
		searches++
		maxInFlight = Math.max(maxInFlight, ++inFlight)
		const attribute = state.attribute
		const mode = state.search
		try {
			if (held) await held.promise
		} finally {
			inFlight--
		}
		if (mode === "busy") throw new SearchBusy()
		if (mode === "fail") throw new Error("search down")
		if (mode === "budget")
			throw new RoomError("catalog_unavailable", "Mood matching is unavailable for now. You can still start without an idea.", 503, false)
		return { prompt, attributes: [{ text: attribute, kind: "attribute" as const }], rankedKeys: [1_000_000_000_001], interpretedAt: 7 }
	}
	const instance = (repository: ProposalRepository = repo) => new ProposalService(
		repository, catalog, "create-setup-test-secret-over-thirty-two", async (e) => { published.push(e.revision) }, now, undefined,
		state.search === "none" ? undefined : interpret
	)
	const service = instance()
	const request = (setup?: CreateRoomRequest["setup"]): CreateRoomRequest => ({
		contractVersion: 3, commandId: randomUUID(), admissionSecret: "a".repeat(43), nickname: "", ...(setup ? { setup } : {})
	})
	const hold = () => {
		let resolve!: () => void
		const promise = new Promise<void>((r) => { resolve = r })
		held = { promise, resolve }
		return () => { held = null; resolve() }
	}
	/** Until `n` searches have started: create answers once the room is stored, its search starts right after. */
	const searched = async (n: number) => {
		for (let i = 0; searches < n && i < 100; i++) await new Promise((r) => setImmediate(r))
	}
	return {
		repo, service, request, instance, hold, clock, state, published, searched,
		inserts: () => inserts, swaps: () => swaps, searches: () => searches, maxInFlight: () => maxInFlight
	}
}
/**
 * Holds every takeover claim (a compare-and-swap storing a new job on a pending idea) until `count` have
 * arrived, so they all read the room before any stores; resolves with each claim's result.
 */
function takeoverBarrier(repo: ProposalMemoryRepository, count: number) {
	const swap = repo.compareAndSwap.bind(repo)
	const marker = (room: ProposalRoom) => room.ideas?.[0]?.attributes[0]?.key === PENDING_IDEA_ATTRIBUTE.key ? room.ideas[0].attributes[0].text : null
	const results: Promise<boolean>[] = []
	let open!: () => void
	const arrived = new Promise<void>((r) => { open = r })
	return new Promise<boolean[]>((done) => {
		repo.compareAndSwap = async (old, room, notify) => {
			const [was, next] = [marker(old.room), marker(room)]
			if (!was || !next || was === next) return swap(old, room, notify)
			const result = arrived.then(() => swap(old, room, notify))
			results.push(result)
			if (results.length === count) {
				open()
				repo.compareAndSwap = swap
				void Promise.all(results).then(done)
			}
			return result
		}
	})
}
/** A view of `repo` whose compare-and-swaps wait while `stalled.on` (a process whose store writes hang). */
function stalling(repo: ProposalMemoryRepository) {
	let resume = () => {}
	const gate = { on: false, wait: Promise.resolve() }
	const view = Object.create(repo) as ProposalMemoryRepository
	view.compareAndSwap = async (...args) => {
		if (gate.on) await gate.wait
		return repo.compareAndSwap(...args)
	}
	return {
		view,
		stall() { gate.on = true; gate.wait = new Promise((r) => { resume = r }) },
		resume() { gate.on = false; resume() }
	}
}
const stored = async (repo: ProposalMemoryRepository, id: string) => (await repo.read(id))!.room
const sender = (service: ProposalService, id: string, credential: Awaited<ReturnType<ProposalService["create"]>>["credential"]) =>
	async (command: RoomCommand) => {
		const now = await service.read(id, credential)
		return service.command(id, credential, { commandId: randomUUID(), sequence: now.own.nextSequence, command })
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
	const release = f.hold()
	const a = await f.service.create(f.request({ country: "DE", idea: "space heist" }))
	await f.searched(1)
	const s = a.snapshot.shared
	assert.equal(s.screens[0]?.country, "DE")
	assert.deepEqual(s.ideas.map((i) => [i.text, i.authorId, i.on]), [["space heist", a.snapshot.own.participantId, true]])
	// Pending: the room answers before search; the interpretation lands in a later revision.
	assert.deepEqual(s.ideas[0].attributes, [PENDING_IDEA_ATTRIBUTE])
	assert.equal(s.phase, "setup")
	// Nothing was sent as a command: the client's first command is still sequence 1.
	assert.equal(a.snapshot.own.nextSequence, 1)
	assert.equal(f.inserts(), 1)
	assert.equal(f.swaps(), 0)
	assert.equal(f.searches(), 1)
	release()
	await f.service.interpretationsIdle()
	const read = await f.service.read(s.roomId, a.credential)
	assert.equal(read.shared.screens[0]?.country, "DE")
	assert.deepEqual(read.shared.ideas.map((i) => i.attributes), [[{ text: "heist", kind: "attribute" }]])
	assert.equal(f.swaps(), 1, "the interpretation lands as one more committed revision")
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

test("search unavailable keeps the idea uninterpreted; an unknown country is left for the app's own commands", async () => {
	for (const search of ["fail", "budget", "none"] as const) {
		const f = fixture({ search })
		const a = await f.service.create(f.request({ country: "DE", idea: "space heist" }))
		const s = a.snapshot.shared
		assert.equal(s.screens[0]?.country, "DE", search)
		// The idea the app sent is in the room, so the app sends no add_idea command after the create.
		assert.deepEqual(s.ideas.map((i) => [i.text, i.authorId, i.on, i.attributes]), [["space heist", a.snapshot.own.participantId, true, search === "none" ? [] : [PENDING_IDEA_ATTRIBUTE]]], search)
		assert.equal(a.snapshot.own.nextSequence, 1, search)
		assert.equal(f.inserts(), 1, search)
		await f.service.interpretationsIdle()
		const room = (await f.repo.read(s.roomId))!.room
		assert.deepEqual(room.ideas![0].attributes, [], search)
		assert.deepEqual(room.ideas![0].rankedKeys, [], search)
		// The idea reserved one of the room's searches (as add_idea), spent whatever search answered; none without search.
		assert.equal(room.interpretationCount, search === "none" ? 0 : 1, search)
		// Setup goes on: the host can still start the room with the normal ranking.
		const send = async (command: RoomCommand) => {
			const now = await f.service.read(s.roomId, a.credential)
			return f.service.command(s.roomId, a.credential, { commandId: randomUUID(), sequence: now.own.nextSequence, command })
		}
		await send({ type: "rename", nickname: "Host" })
		await send({ type: "set_services", serviceIds: [1] })
		const ready = await f.service.read(s.roomId, a.credential)
		const started = await send({ type: "start", expectedContextVersion: ready.shared.contextVersion, expectedRosterVersion: ready.shared.rosterVersion, hostReady: true })
		assert.equal(started.snapshot.shared.phase, "choosing", search)
		assert.ok(started.snapshot.shared.candidates.length > 0, search)
		assert.deepEqual(started.snapshot.shared.ideas.map((i) => i.text), ["space heist"], search)
	}
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

// Owner decision Q32: Create room never waits for the idea's interpretation (two Jev calls, ~0.6-1.5 s).
test("create answers before search resolves; the interpretation lands later as a published revision and rebuilds the prepared deck", async () => {
	const f = fixture()
	const release = f.hold()
	const a = await f.service.create(f.request({ country: "DE", idea: "space heist" }))
	const id = a.credential.roomId
	assert.deepEqual(a.snapshot.shared.ideas[0].attributes, [PENDING_IDEA_ATTRIBUTE])
	let room = await stored(f.repo, id)
	assert.equal(room.interpretationCount, 1, "the running search holds its slot")
	assert.deepEqual(room.ideas![0].rankedKeys, [])
	const send = sender(f.service, id, a.credential)
	await send({ type: "rename", nickname: "Host" })
	await send({ type: "set_services", serviceIds: [1] })
	await f.service.decks.idle()
	room = await stored(f.repo, id)
	assert.equal(f.service.decks.prepared(room), true, "a deck is prepared while the idea is pending")
	const before = room.revision
	f.published.length = 0
	release()
	await f.service.interpretationsIdle()
	room = await stored(f.repo, id)
	assert.deepEqual(room.ideas![0].attributes, [{ text: "heist", kind: "attribute" }])
	assert.deepEqual(room.ideas![0].rankedKeys, [1_000_000_000_001])
	assert.equal(room.revision, before + 1)
	assert.deepEqual(f.published, [room.revision], "phones hear about it")
	assert.equal(room.interpretationCount, 1)
	await f.service.decks.idle()
	assert.equal(f.service.decks.prepared(room), true, "the deck is built again for the idea's ranked titles")
	assert.equal(f.searches(), 1)
})

test("add_idea and edit_idea answer before search; an edit meanwhile wins over the first search's late answer", async () => {
	const f = fixture()
	const a = await f.service.create(f.request({ country: "DE" }))
	const id = a.credential.roomId
	const send = sender(f.service, id, a.credential)
	const release = f.hold()
	f.state.attribute = "first"
	const added = (await send({ type: "add_idea", text: "space heist" })).snapshot
	const ideaId = added.shared.ideas[0].id
	assert.deepEqual(added.shared.ideas[0].attributes, [PENDING_IDEA_ATTRIBUTE])
	assert.equal((await stored(f.repo, id)).interpretationCount, 1)
	f.state.attribute = "second"
	const edited = (await send({ type: "edit_idea", ideaId, text: "space opera" })).snapshot
	assert.deepEqual(edited.shared.ideas[0].attributes, [PENDING_IDEA_ATTRIBUTE])
	assert.equal((await stored(f.repo, id)).interpretationCount, 2)
	release()
	await f.service.interpretationsIdle()
	const room = await stored(f.repo, id)
	assert.deepEqual(room.ideas!.map((i) => [i.text, i.attributes]), [["space opera", [{ text: "second", kind: "attribute" }]]])
	assert.equal(room.interpretationCount, 2)
	assert.equal(f.searches(), 2)
})

test("a spend-limit refusal keeps its slot spent and ends the idea uninterpreted; budget reached refuses the idea", async () => {
	const f = fixture({ search: "budget" })
	const a = await f.service.create(f.request({ country: "DE", idea: "space heist" }))
	const id = a.credential.roomId
	await f.service.interpretationsIdle()
	let room = await stored(f.repo, id)
	assert.deepEqual(room.ideas![0].attributes, [])
	assert.equal(room.interpretationCount, 1, "a reservation is spent whatever its search answers")
	f.state.search = "ok"
	const send = sender(f.service, id, a.credential)
	room = await stored(f.repo, id)
	await f.repo.compareAndSwap((await f.repo.read(id))!, { ...structuredClone(room), interpretationCount: 23, revision: room.revision + 1 }, false)
	await send({ type: "add_idea", text: "the last one" })
	await f.service.interpretationsIdle()
	assert.equal((await stored(f.repo, id)).interpretationCount, 24)
	await assert.rejects(send({ type: "add_idea", text: "one too many" }), { code: "limit_reached" })
})

test("a crashed instance's interpretation is taken over by any instance that reads the room after its lease", async () => {
	const f = fixture()
	f.hold() // never released: the first instance "crashes" mid-search
	const a = await f.service.create(f.request({ country: "DE", idea: "space heist" }))
	const id = a.credential.roomId
	f.state.attribute = "late"
	const other = f.instance()
	// Within the lease another instance leaves it alone.
	await other.read(id, a.credential)
	await other.interpretationsIdle()
	assert.equal(f.searches(), 1)
	f.hold()() // later searches answer; the first instance's never does
	f.clock.offset = INTERPRETATION_LEASE_MS + 1
	f.state.attribute = "taken over"
	// Two instances read at the same moment and both try to take over: both read the pending idea before either
	// stores its claim, and exactly one claim is stored, so only one searches again.
	const third = f.instance()
	const claims = takeoverBarrier(f.repo, 2)
	const [otherRead] = await Promise.all([other.read(id, a.credential), third.read(id, a.credential)])
	assert.deepEqual(otherRead.shared.ideas[0].attributes, [PENDING_IDEA_ATTRIBUTE], "still pending, never shown as unavailable")
	assert.deepEqual((await claims).sort(), [false, true], "one takeover wins")
	await Promise.all([other.interpretationsIdle(), third.interpretationsIdle()])
	assert.equal(f.searches(), 2)
	const room = await stored(f.repo, id)
	assert.deepEqual(room.ideas![0].attributes, [{ text: "taken over", kind: "attribute" }])
	assert.equal(room.interpretationCount, 1, "the takeover searches again on the slot already reserved")
})

test("Start before the interpretation lands doesn't wait: the deck starts with the usual ranking, the idea lands on it later", async () => {
	const f = fixture()
	const release = f.hold()
	const a = await f.service.create(f.request({ country: "DE", idea: "space heist" }))
	const id = a.credential.roomId
	const send = sender(f.service, id, a.credential)
	await send({ type: "rename", nickname: "Host" })
	await send({ type: "set_services", serviceIds: [1] })
	const ready = await f.service.read(id, a.credential)
	const started = await send({ type: "start", expectedContextVersion: ready.shared.contextVersion, expectedRosterVersion: ready.shared.rosterVersion, hostReady: true })
	assert.equal(started.snapshot.shared.phase, "choosing")
	assert.ok(started.snapshot.shared.candidates.length > 0)
	assert.deepEqual(started.snapshot.shared.ideas[0].attributes, [PENDING_IDEA_ATTRIBUTE])
	const cards = started.snapshot.shared.candidates.map((c) => c.id)
	release()
	await f.service.interpretationsIdle()
	const room = await stored(f.repo, id)
	assert.equal(room.phase, "choosing")
	assert.deepEqual(room.ideas![0].rankedKeys, [1_000_000_000_001])
	// The cards already dealt stay (no card changes under anyone's thumb); later pages use the idea.
	assert.deepEqual(room.candidates.map((c) => c.id), cards)
	const read = await f.service.read(id, a.credential)
	assert.deepEqual(read.shared.ideas[0].attributes, [{ text: "heist", kind: "attribute" }])
})

test("a stale attempt's late answer never lands over its takeover's: answered at 11 s, stalled, taken over at 16 s", async () => {
	const f = fixture()
	const a = stalling(f.repo)
	const first = f.instance(a.view)
	const release = f.hold()
	f.state.attribute = "stale"
	const created = await first.create(f.request({ country: "DE", idea: "space heist" }))
	await f.searched(1)
	const id = created.credential.roomId
	f.clock.offset = 11_000
	a.stall()
	release() // the first attempt answers; storing that hangs
	await new Promise((r) => setTimeout(r, 5))
	f.clock.offset = INTERPRETATION_LEASE_MS + 1_000
	f.state.attribute = "taken over"
	const other = f.instance()
	await other.read(id, created.credential)
	await other.interpretationsIdle()
	a.resume()
	await first.interpretationsIdle()
	const room = await stored(f.repo, id)
	assert.deepEqual(room.ideas![0].attributes, [{ text: "taken over", kind: "attribute" }])
	assert.equal(room.interpretationCount, 1, "one reservation, two attempts")
	assert.equal(f.searches(), 2)
})

test("an edit or removal while pending spends the replaced search's slot too; the replaced answer never lands", async () => {
	for (const change of ["edit", "remove"] as const) {
		const f = fixture({ search: "budget" })
		const a = await f.service.create(f.request({ country: "DE" }))
		const id = a.credential.roomId
		const send = sender(f.service, id, a.credential)
		const release = f.hold()
		const ideaId = (await send({ type: "add_idea", text: "space heist" })).snapshot.shared.ideas[0].id
		f.state.search = "ok"
		if (change === "edit") await send({ type: "edit_idea", ideaId, text: "space opera" })
		else await send({ type: "remove_idea", ideaId })
		release()
		await f.service.interpretationsIdle()
		const room = await stored(f.repo, id)
		assert.equal(room.interpretationCount, change === "edit" ? 2 : 1, change)
		assert.deepEqual(room.ideas!.map((i) => [i.text, i.attributes]), change === "edit" ? [["space opera", [{ text: "heist", kind: "attribute" }]]] : [], change)
	}
})

test("background searches run at most INTERPRETATION_CONCURRENCY at once per process; queued ones still land", async () => {
	const f = fixture()
	const release = f.hold()
	const rooms = []
	for (let i = 0; i < 10; i++) rooms.push((await f.service.create(f.request({ country: "DE", idea: `idea ${i}` }))).credential.roomId)
	await new Promise((r) => setTimeout(r, 10))
	assert.equal(f.searches(), INTERPRETATION_CONCURRENCY, "the rest wait for a slot, holding no lease yet")
	// Queued longer than the lease: another process could take them over; this one claims a fresh lease when it starts.
	f.clock.offset = INTERPRETATION_LEASE_MS + 1
	release()
	await f.service.interpretationsIdle()
	assert.equal(f.maxInFlight(), INTERPRETATION_CONCURRENCY)
	assert.equal(f.searches(), 10)
	for (const id of rooms) {
		const room = await stored(f.repo, id)
		assert.deepEqual(room.ideas![0].attributes, [{ text: "heist", kind: "attribute" }])
		assert.equal(room.interpretationCount, 1)
	}
})

test("GoodWatch search busy keeps the idea pending; a later read retries it after the lease and backoff", async () => {
	const f = fixture({ search: "busy" })
	const a = await f.service.create(f.request({ country: "DE", idea: "space heist" }))
	const id = a.credential.roomId
	await f.service.interpretationsIdle()
	let room = await stored(f.repo, id)
	assert.equal(room.ideas![0].attributes[0].key, PENDING_IDEA_ATTRIBUTE.key, "busy is not unavailable")
	assert.deepEqual((await f.service.read(id, a.credential)).shared.ideas[0].attributes, [PENDING_IDEA_ATTRIBUTE])
	f.state.search = "ok"
	f.clock.offset = INTERPRETATION_LEASE_MS + 1
	await f.service.read(id, a.credential)
	await f.service.interpretationsIdle()
	assert.equal(f.searches(), 1, "this process backs off the room first")
	f.clock.offset = 60_000
	await f.service.read(id, a.credential)
	await f.service.interpretationsIdle()
	room = await stored(f.repo, id)
	assert.deepEqual(room.ideas![0].attributes, [{ text: "heist", kind: "attribute" }])
	assert.equal(room.interpretationCount, 1, "retries spend no further slot")
	assert.equal(f.searches(), 2)
})

test("concurrent identical creates: only the request whose insert stored the room searches, and its answer lands", async () => {
	const f = fixture()
	const insert = f.repo.insert.bind(f.repo)
	let arrived = 0
	let open!: () => void
	const both = new Promise<void>((r) => { open = r })
	f.repo.insert = async (room) => {
		if (++arrived === 2) open()
		await both
		return insert(room)
	}
	const request = f.request({ country: "DE", idea: "space heist" })
	const second = f.instance()
	const [a, b] = await Promise.all([f.service.create(request), second.create(structuredClone(request))])
	assert.equal(a.credential.roomId, b.credential.roomId)
	// Had the loser searched too, its failure would clear the winner's pending idea.
	f.state.search = "fail"
	await Promise.all([f.service.interpretationsIdle(), second.interpretationsIdle()])
	assert.equal(f.searches(), 1)
	const room = await stored(f.repo, a.credential.roomId)
	assert.deepEqual(room.ideas![0].attributes, [{ text: "heist", kind: "attribute" }])
	assert.equal(room.interpretationCount, 1)
})

test("a create whose insert answer was lost recognizes its own stored job and searches once", async () => {
	const f = fixture()
	const insert = f.repo.insert.bind(f.repo)
	f.repo.insert = async (room) => {
		await insert(room)
		throw new IndeterminateWrite("lost insert answer")
	}
	const a = await f.service.create(f.request({ country: "DE", idea: "space heist" }))
	await f.service.interpretationsIdle()
	assert.equal(f.searches(), 1)
	assert.deepEqual((await stored(f.repo, a.credential.roomId)).ideas![0].attributes, [{ text: "heist", kind: "attribute" }])
})

test("the periodic sweep resumes a pending idea nobody reads once its lease ran out", async () => {
	const f = fixture()
	f.hold() // the creating instance crashes mid-search; no phone reads the room
	const a = await f.service.create(f.request({ country: "DE", idea: "space heist" }))
	await f.searched(1)
	const id = a.credential.roomId
	f.hold()()
	const sweeper = f.instance()
	await sweeper.resumeStaleInterpretations()
	await sweeper.interpretationsIdle()
	assert.equal(f.searches(), 1, "within the lease the sweep leaves it alone")
	f.clock.offset = INTERPRETATION_LEASE_MS + 1
	f.state.attribute = "swept"
	await sweeper.resumeStaleInterpretations()
	await sweeper.interpretationsIdle()
	assert.equal(f.searches(), 2)
	const room = await stored(f.repo, id)
	assert.deepEqual(room.ideas![0].attributes, [{ text: "swept", kind: "attribute" }])
	assert.equal(room.interpretationCount, 1)
	assert.deepEqual(await f.repo.stalePendingIdeas(f.clock.offset + Date.now(), Date.now() + f.clock.offset, 50), [], "nothing pending is left")
})

test("a pending idea's stored job never reaches phones", async () => {
	const f = fixture()
	f.hold()
	const a = await f.service.create(f.request({ country: "DE", idea: "space heist" }))
	const room = await stored(f.repo, a.credential.roomId)
	assert.notEqual(room.ideas![0].attributes[0].text, PENDING_IDEA_ATTRIBUTE.text, "stored with its job")
	assert.deepEqual(a.snapshot.shared.ideas[0].attributes, [PENDING_IDEA_ATTRIBUTE])
	assert.deepEqual((await f.service.read(a.credential.roomId, a.credential)).shared.ideas[0].attributes, [PENDING_IDEA_ATTRIBUTE])
})

test("the sweep moves past rooms that keep failing: more than 50 stale rooms, the first 50 never readable", async () => {
	const f = fixture()
	f.hold() // the creating instance hangs mid-search and never gets further
	const rooms: string[] = []
	for (let i = 0; i < 60; i++) rooms.push((await f.service.create(f.request({ country: "DE", idea: `idea ${i}` }))).credential.roomId)
	f.hold()()
	const stuck = f.searches()
	rooms.sort()
	const broken = new Set(rooms.slice(0, 50))
	let brokenReads = 0
	const view = Object.create(f.repo) as ProposalMemoryRepository
	view.read = async (id: string) => {
		if (broken.has(id)) {
			brokenReads++
			throw new Error("hydration failed")
		}
		return f.repo.read(id)
	}
	const sweeper = f.instance(view)
	f.clock.offset = INTERPRETATION_LEASE_MS + 1
	await sweeper.resumeStaleInterpretations()
	await sweeper.interpretationsIdle()
	assert.equal(brokenReads, 50)
	assert.equal(f.searches(), stuck, "the first sweep only reached the broken first 50")
	await sweeper.resumeStaleInterpretations()
	await sweeper.interpretationsIdle()
	for (const id of rooms.slice(50))
		assert.deepEqual((await stored(f.repo, id)).ideas![0].attributes, [{ text: "heist", kind: "attribute" }], "room 51+ is reached")
	assert.equal(f.searches(), stuck + 10)
	assert.equal(brokenReads, 50, "rooms backing off are passed over")
	f.clock.offset += 31_000
	await sweeper.resumeStaleInterpretations()
	assert.equal(brokenReads, 100, "and retried after their backoff")
})

/** True for a compare-and-swap that lands an answer on the room's pending idea (pending before, not after). */
const landing = (old: ProposalRoom, room: ProposalRoom) =>
	old.ideas?.some((i) => i.attributes[0]?.key === PENDING_IDEA_ATTRIBUTE.key &&
		room.ideas?.find((n) => n.id === i.id)?.attributes[0]?.key !== PENDING_IDEA_ATTRIBUTE.key) ?? false

test("a landing that never stores (outcome unknown, or every compare-and-swap lost) backs off: no search every lease", async () => {
	for (const outcome of ["unknown", "lost"] as const) {
		const f = fixture()
		const swap = f.repo.compareAndSwap.bind(f.repo)
		f.repo.compareAndSwap = async (old, room, notify) => {
			if (!landing(old.room, room)) return swap(old, room, notify)
			if (outcome === "unknown") throw new IndeterminateWrite("answer lost, nothing stored")
			return false
		}
		const a = await f.service.create(f.request({ country: "DE", idea: "space heist" }))
		const id = a.credential.roomId
		await f.service.interpretationsIdle()
		assert.equal((await stored(f.repo, id)).ideas![0].attributes[0].key, PENDING_IDEA_ATTRIBUTE.key, outcome)
		const at = async (ms: number) => {
			f.clock.offset = ms
			await f.service.read(id, a.credential)
			await f.service.interpretationsIdle()
			return f.searches()
		}
		// Backoff 30 s after the first failure, 60 s after the second (was: a search every lease, 16/32/48/64 s).
		assert.deepEqual([await at(16_000), await at(32_000), await at(48_000), await at(64_000)], [1, 2, 2, 2], outcome)
		assert.equal(await at(93_000), 3, outcome)
	}
})

test("a landing whose write outcome is unknown but stored counts as committed: published, backoff cleared", async () => {
	const f = fixture({ search: "busy" })
	const a = await f.service.create(f.request({ country: "DE", idea: "space heist" }))
	const id = a.credential.roomId
	await f.service.interpretationsIdle() // busy: backing off 30 s
	const swap = f.repo.compareAndSwap.bind(f.repo)
	let lost = 0
	f.repo.compareAndSwap = async (old, room, notify) => {
		if (!landing(old.room, room) || lost++) return swap(old, room, notify)
		await swap(old, room, notify)
		throw new IndeterminateWrite("stored, answer lost")
	}
	f.state.search = "ok"
	f.clock.offset = 31_000
	f.published.length = 0
	await f.service.read(id, a.credential)
	await f.service.interpretationsIdle()
	let room = await stored(f.repo, id)
	assert.deepEqual(room.ideas![0].attributes, [{ text: "heist", kind: "attribute" }])
	assert.equal(lost, 1, "verified by reading, not written twice")
	assert.ok(f.published.includes(room.revision), "phones hear about it")
	// The backoff was cleared: the next failure backs off 30 s again, not 60 s.
	f.state.search = "busy"
	await sender(f.service, id, a.credential)({ type: "edit_idea", ideaId: room.ideas![0].id, text: "space opera" })
	await f.service.interpretationsIdle()
	f.state.search = "ok"
	f.clock.offset = 31_000 + 31_000
	await f.service.read(id, a.credential)
	await f.service.interpretationsIdle()
	room = await stored(f.repo, id)
	assert.deepEqual(room.ideas!.map((i) => [i.text, i.attributes]), [["space opera", [{ text: "heist", kind: "attribute" }]]])
})

test("a stale search finishing after an edit's busy answer never clears the edit's backoff", async () => {
	const f = fixture()
	const a = await f.service.create(f.request({ country: "DE" }))
	const id = a.credential.roomId
	const send = sender(f.service, id, a.credential)
	const releaseFirst = f.hold()
	const ideaId = (await send({ type: "add_idea", text: "space heist" })).snapshot.shared.ideas[0].id
	f.state.search = "busy"
	const releaseEdit = f.hold()
	await send({ type: "edit_idea", ideaId, text: "space opera" })
	releaseEdit() // the edit's search: busy, the room backs off
	await new Promise((r) => setTimeout(r, 5))
	f.state.search = "ok"
	releaseFirst() // the stale search answers; it can't land (the edit holds the idea)
	// The edit's attempt replaced the stale one under the idea's key, so interpretationsIdle doesn't wait for it.
	await new Promise((r) => setTimeout(r, 20))
	await f.service.interpretationsIdle()
	assert.equal(f.searches(), 2)
	assert.equal((await stored(f.repo, id)).ideas![0].attributes[0].key, PENDING_IDEA_ATTRIBUTE.key)
	f.clock.offset = INTERPRETATION_LEASE_MS + 1
	await f.service.read(id, a.credential)
	await f.service.interpretationsIdle()
	assert.equal(f.searches(), 2, "still backing off after the edit's failure")
	f.clock.offset = 31_000
	await f.service.read(id, a.credential)
	await f.service.interpretationsIdle()
	assert.equal(f.searches(), 3)
	assert.deepEqual((await stored(f.repo, id)).ideas!.map((i) => [i.text, i.attributes]), [["space opera", [{ text: "heist", kind: "attribute" }]]])
})

test("eight stale pending ideas in one room under overload: one retry cycle, queued takeovers wait for the backoff", async () => {
	const f = fixture()
	f.hold() // the first process hangs on every search it starts
	const a = await f.service.create(f.request({ country: "DE", idea: "idea 0" }))
	const id = a.credential.roomId
	const send = sender(f.service, id, a.credential)
	for (let i = 1; i < 8; i++) await send({ type: "add_idea", text: `idea ${i}` })
	const hung = f.searches()
	f.hold()()
	f.state.search = "busy"
	const other = f.instance()
	f.clock.offset = INTERPRETATION_LEASE_MS + 1
	await other.read(id, a.credential)
	await other.interpretationsIdle()
	assert.equal(f.searches() - hung, INTERPRETATION_CONCURRENCY, "queued takeovers see the backoff when they start")
	// The concurrent failures counted as one: the room retries after 30 s, not 15 minutes.
	f.state.search = "ok"
	f.clock.offset += 31_000
	await other.read(id, a.credential)
	await other.interpretationsIdle()
	assert.equal(f.searches() - hung, INTERPRETATION_CONCURRENCY + 8)
	for (const idea of (await stored(f.repo, id)).ideas!) assert.deepEqual(idea.attributes, [{ text: "heist", kind: "attribute" }])
})
