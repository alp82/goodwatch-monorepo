import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import type { RoomCommand } from "../../../packages/yepwatch-contracts/proposal.ts"
import { ProposalService, type ProposalOperationGuard } from "./proposal-service.server.ts"
import { deckInputs } from "./proposal-prepared-decks.ts"
import { ProposalMemoryRepository, proposalFixtureCatalog } from "./proposal-test-support.ts"
import type { ExcludedKeysOptions, ProposalCatalog, ProposalRoom } from "./proposal-types.ts"

const secret = "prepared-decks-test-secret-at-least-32-chars"
function fixture(options: { delayMs?: number | "default"; excluded?: string[]; now?: () => number; guard?: ProposalOperationGuard } = {}) {
	const repository = new ProposalMemoryRepository()
	const pages: ProposalRoom[] = []
	const exclusionReads: (ExcludedKeysOptions | undefined)[] = []
	const catalog: ProposalCatalog = {
		...proposalFixtureCatalog,
		async metadata(country) {
			const m = await proposalFixtureCatalog.metadata(country)
			return { ...m, services: [1, 2, 3].map((id) => ({ id, name: `Fixture service ${id}`, logoUrl: null })) }
		},
		async page(room) {
			pages.push(structuredClone(room))
			return proposalFixtureCatalog.page(room)
		},
		...(options.excluded ? { excludedKeys: async (_room, read) => { exclusionReads.push(read); return options.excluded! } } : {}),
	}
	const service = new ProposalService(repository, catalog, secret, async () => {}, options.now ?? Date.now, options.guard, undefined, {
		decks: options.delayMs === "default" ? {} : { delayMs: options.delayMs ?? 1 },
	})
	return { repository, service, pages, exclusionReads }
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
	const join = async (nickname: string) => {
		const friend = await f.service.join(id, {
			contractVersion: 3,
			commandId: randomBytes(16).toString("hex"),
			admissionSecret: randomBytes(32).toString("base64url"),
			nickname,
			inviteCode: host.invite.code,
		} as Parameters<ProposalService["join"]>[1])
		const own = { participantId: friend.credential.participantId, token: friend.credential.token }
		return async (command: RoomCommand) => {
			const s = await f.service.read(id, own)
			return f.service.command(id, own, { commandId: randomBytes(16).toString("hex"), sequence: s.own.nextSequence, command })
		}
	}
	return { id, credential, invite: host.invite.code, send, start, join, stored: async () => (await f.repository.read(id))!.room }
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
	assert.deepEqual(f.exclusionReads.at(-1), { fresh: true }, "Start reads seen lists past any cache the background build filled")
})

test("saved progress decks are never remembered: each page reads progress again", async () => {
	const f = fixture({ delayMs: 60_000 })
	const r = await room(f)
	await r.send({ type: "set_services", serviceIds: [1] })
	const continuing = structuredClone(await r.stored())
	continuing.constraints.kinds = ["show_continue"]
	await f.service.decks.page(continuing)
	assert.ok(!f.service.decks.prepared(continuing), "not kept under its inputs")
	await f.service.decks.page(continuing)
	assert.equal(f.pages.length, 2, "a second page with the same inputs asks the catalog again")
	f.service.decks.forget(r.id)
})

test("a command answer still checks the room is live after the commit", async () => {
	let now = Date.now()
	const f = fixture({ delayMs: 60_000, now: () => now })
	const r = await room(f)
	const expiresAt = (await r.stored()).expiresAt
	const cas = f.repository.compareAndSwap.bind(f.repository)
	f.repository.compareAndSwap = async (old, next, notify) => {
		const ok = await cas(old, next, notify)
		now = expiresAt + 1 // The room expires while the rename commits.
		return ok
	}
	await assert.rejects(r.send({ type: "rename", nickname: "Late" } as RoomCommand), { code: "expired" })
	f.service.decks.forget(r.id)
})

test("a command answer still checks the room's capacity reservation after the commit", async () => {
	let revoked = false
	const guard: ProposalOperationGuard = {
		async active() { if (revoked) throw Object.assign(new Error("Room capacity unavailable"), { code: "capacity" }) },
		async create() { return Date.now() + 3_600_000 },
		async join() {},
		async command() {},
	}
	const f = fixture({ delayMs: 60_000, guard })
	const r = await room(f)
	await r.send({ type: "rename", nickname: "Early" } as RoomCommand) // the room is known: its check runs alongside the read
	const cas = f.repository.compareAndSwap.bind(f.repository)
	f.repository.compareAndSwap = async (old, next, notify) => {
		const ok = await cas(old, next, notify)
		revoked = true
		return ok
	}
	await assert.rejects(r.send({ type: "rename", nickname: "Late" } as RoomCommand), { code: "capacity" })
	f.service.decks.forget(r.id)
})

test("a command is refused, and commits nothing, once the room's capacity reservation is gone", async () => {
	let revoked = false
	const guard: ProposalOperationGuard = {
		async active() { if (revoked) throw Object.assign(new Error("Room capacity unavailable"), { code: "capacity" }) },
		async create() { return Date.now() + 3_600_000 },
		async join() {},
		async command() {},
	}
	const f = fixture({ delayMs: 60_000, guard })
	const r = await room(f)
	await r.send({ type: "rename", nickname: "Early" } as RoomCommand) // the room is known: its check now runs alongside the read
	const before = (await f.repository.read(r.id))!.room.revision
	revoked = true
	await assert.rejects(r.send({ type: "rename", nickname: "Late" } as RoomCommand), { code: "capacity" })
	assert.equal((await f.repository.read(r.id))!.room.revision, before, "nothing committed")
	f.service.decks.forget(r.id)
})

test("a guest joining and picking services the room already has keeps the prepared deck", async () => {
	const f = fixture({ delayMs: 60_000 })
	const r = await room(f)
	await r.send({ type: "set_services", serviceIds: [1] })
	await f.service.decks.page(await r.stored())
	const friend = await r.join("Friend")
	assert.ok(f.service.decks.prepared(await r.stored()), "a guest's arrival changes nothing a page reads")
	await friend({ type: "set_services", serviceIds: [1] })
	assert.ok(f.service.decks.prepared(await r.stored()), "nor do services the room already has")
	const started = await r.start()
	assert.equal(f.pages.length, 1, "Start used the deck prepared before the friend came")
	assert.equal(started.snapshot.shared.phase, "choosing")
	f.service.decks.forget(r.id)
})

test("a guest bringing a service the room didn't have makes the prepared deck out of date", async () => {
	const f = fixture({ delayMs: 60_000 })
	const r = await room(f)
	await r.send({ type: "set_services", serviceIds: [1] })
	await f.service.decks.page(await r.stored())
	const friend = await r.join("Friend")
	await friend({ type: "set_services", serviceIds: [2] })
	assert.ok(!f.service.decks.prepared(await r.stored()))
	await r.start()
	assert.equal(f.pages.length, 2)
	assert.deepEqual(f.pages[1].screens[0].serviceIds, [1, 2])
	f.service.decks.forget(r.id)
})

test("members count with who they are and their seen setting; leaving counts too", async () => {
	const f = fixture({ delayMs: 60_000 })
	const r = await room(f)
	await r.send({ type: "set_services", serviceIds: [1] })
	await r.join("Friend")
	const room0 = await r.stored()
	const before = deckInputs(room0)
	const member = structuredClone(room0)
	const friend = member.participants.at(-1)!
	friend.member = { state: "linked" } as typeof friend.member
	friend.memberUserId = "user-1"
	assert.notEqual(deckInputs(member), before, "a member's seen titles leave the deck")
	const other = structuredClone(member)
	other.participants.at(-1)!.memberUserId = "user-2"
	assert.notEqual(deckInputs(other), deckInputs(member), "another member, other seen titles")
	const showing = structuredClone(member)
	showing.participants.at(-1)!.showSeen = !member.participants.at(-1)!.showSeen
	assert.notEqual(deckInputs(showing), deckInputs(member), "the seen setting")
	const left = structuredClone(room0)
	left.participants.at(-1)!.screenId = null
	assert.notEqual(deckInputs(left), before, "a guest without a screen can't be dealt a deck")
})

test("by default a deck starts building as soon as the room has everything, and a change mid-build builds again once", async () => {
	const f = fixture({ delayMs: "default" })
	const r = await room(f)
	let release!: () => void
	const gate = new Promise<void>((resolve) => { release = resolve })
	const page = f.service.decks["catalog"].page
	let building = 0
	f.service.decks["catalog"].page = async (room) => { building++; await gate; return page(room) }
	await r.send({ type: "set_services", serviceIds: [1] })
	await new Promise((resolve) => setTimeout(resolve, 5))
	assert.equal(building, 1, "started without waiting for quiet")
	await r.send({ type: "set_services", serviceIds: [1, 2] })
	await r.send({ type: "set_services", serviceIds: [1, 2, 3] })
	await new Promise((resolve) => setTimeout(resolve, 5))
	assert.equal(building, 1, "one build per room at a time")
	release()
	await f.service.decks.idle()
	assert.equal(building, 2, "then one more for the latest setup")
	assert.ok(f.service.decks.prepared(await r.stored()))
	f.service.decks.forget(r.id)
})

test("service picks that leave the room's services as they were don't check the deck's offers again", async () => {
	const f = fixture({ delayMs: 60_000 })
	let refreshes = 0
	const refresh = f.service["catalog"].refresh ?? (async (room: ProposalRoom) => room.candidates)
	f.service["catalog"].refresh = async (room) => { refreshes++; return refresh(room) }
	const r = await room(f)
	await r.send({ type: "set_services", serviceIds: [1] })
	assert.ok(refreshes > 0, "the room's services changed")
	await r.start()
	const friend = await r.join("Friend")
	refreshes = 0
	await friend({ type: "set_services", serviceIds: [1] })
	assert.equal(refreshes, 0, "the room still watches on the same services")
	await friend({ type: "set_services", serviceIds: [1, 2] })
	assert.equal(refreshes, 1, "a new service can make more cards watchable")
	f.service.decks.forget(r.id)
})

test("a Start queued behind a friend's service pick commits on its first compare-and-swap", async () => {
	const f = fixture({ delayMs: 60_000 })
	// Like Crate, clearing pending_revision is a write: it moves the row's sequence number.
	let cleared = () => {}
	f.repository.acknowledge = async (id, revision) => {
		const s = f.repository.rows.get(id)
		if (s && s.pendingRevision <= revision) f.repository.rows.set(id, { ...s, seq: s.seq + 1, pendingRevision: 0 })
		if (!f.repository.rows.get(id)?.pendingRevision) cleared()
	}
	const cas = f.repository.compareAndSwap.bind(f.repository)
	const attempts: string[] = []
	f.repository.compareAndSwap = async (old, next, notify) => {
		const ok = await cas(old, next, notify)
		attempts.push(`${next.phase}:${ok}`)
		return ok
	}
	const r = await room(f)
	await r.send({ type: "set_services", serviceIds: [1] })
	const joined = await f.service.join(r.id, {
		contractVersion: 3,
		commandId: randomBytes(16).toString("hex"),
		admissionSecret: randomBytes(32).toString("base64url"),
		nickname: "Friend",
		inviteCode: r.invite,
	} as Parameters<ProposalService["join"]>[1])
	const friend = { participantId: joined.credential.participantId, token: joined.credential.token }
	const mine = await f.service.read(r.id, friend)
	const host = await f.service.read(r.id, r.credential)
	attempts.length = 0
	const acknowledged = new Promise<void>((resolve) => { cleared = resolve })
	// The friend's pick and the host's Start arrive together: Start waits in the room's lane behind the pick.
	const pick = f.service.command(r.id, friend, { commandId: randomBytes(16).toString("hex"), sequence: mine.own.nextSequence, command: { type: "set_services", serviceIds: [1] } })
	const start = f.service.command(r.id, r.credential, { commandId: randomBytes(16).toString("hex"), sequence: host.own.nextSequence, command: { type: "start", expectedRosterVersion: host.shared.rosterVersion, expectedContextVersion: host.shared.contextVersion, expectedGeneration: host.shared.generation, hostReady: true } as RoomCommand })
	const [, started] = await Promise.all([pick, start])
	assert.equal(started.snapshot.shared.phase, "choosing")
	assert.deepEqual(attempts, ["setup:true", "choosing:true"], "the pick's notification never made Start write twice")
	// Notifications run after the answers (they answer with the room they committed).
	await acknowledged
	assert.equal((await f.repository.read(r.id))!.pendingRevision, 0, "the last notification still clears the pending revision")
	f.service.decks.forget(r.id)
})

test("a member linking just before Start doesn't make Start wait for a new deck build", async () => {
	// Production smoke 2026-11-12: a signed-in member joined and linked ~150 ms before the host's Start. The link
	// made the prepared deck out of date, so Start waited for a whole new build (Start → first card 2.2-4 s against
	// 0.26-0.43 s for guest-only rooms). A member brings nothing a deck needs but their seen titles, and Start reads
	// those fresh and leaves them out of whatever deck it uses.
	const base = fixture()
	const b = await room(base)
	await b.send({ type: "set_services", serviceIds: [1] })
	const deck = await base.service.decks.page(await b.stored())
	const seen = deck.candidates[0]
	const key = `${seen.identity.kind === "movie" ? "movie" : "show"}_${seen.identity.tmdbId}`

	const f = fixture({ excluded: [key] })
	let hold: Promise<void> | null = null
	const page = f.service["catalog"].page.bind(f.service["catalog"])
	f.service["catalog"].page = async (room) => { await hold; return page(room) }
	const r = await room(f)
	await r.send({ type: "set_services", serviceIds: [1] })
	await r.join("Member")
	await f.service.decks.idle()
	assert.ok(f.service.decks.prepared(await r.stored()), "the deck was ready before the member linked")
	// The member's link lands (what ContinuousMembers.applyLink writes), then a build for it is slow.
	let release = () => {}
	hold = new Promise<void>((resolve) => { release = resolve })
	const old = (await f.repository.read(r.id))!
	const linked = structuredClone(old.room)
	const member = linked.participants.at(-1)!
	member.member = { state: "linked", prefill: { country: "DE", serviceIds: [], savedProgressAvailable: true } } as typeof member.member
	member.memberUserId = "member-1"
	member.memberGrant = { accessToken: "grant", expiresAt: Date.now() + 3_600_000 }
	member.serviceIds = []
	linked.revision++
	assert.ok(await f.repository.compareAndSwap(old, linked, true))
	await f.service.notify(r.id)
	assert.ok(!f.service.decks.prepared(await r.stored()), "the link changed the deck inputs")

	const started = await Promise.race([
		r.start(),
		new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000).unref()),
	])
	release()
	assert.ok(started, "Start answered without waiting for the build the link started")
	assert.equal(started.snapshot.shared.phase, "choosing")
	assert.ok(started.snapshot.shared.candidates.length > 0)
	assert.ok(!started.snapshot.shared.candidates.some((c) => c.id === seen.id), "the member's seen title is left out")
	await f.service.decks.idle()
	f.service.decks.forget(r.id)
})

test("a member bringing a service the room didn't have still waits for the deck that has it", async () => {
	const f = fixture({ delayMs: 60_000 })
	const r = await room(f)
	await r.send({ type: "set_services", serviceIds: [1] })
	await f.service.decks.page(await r.stored())
	await r.join("Member")
	const old = (await f.repository.read(r.id))!
	const linked = structuredClone(old.room)
	const member = linked.participants.at(-1)!
	member.member = { state: "linked", prefill: { country: "DE", serviceIds: [2], savedProgressAvailable: true } } as typeof member.member
	member.memberUserId = "member-1"
	member.memberGrant = { accessToken: "grant", expiresAt: Date.now() + 3_600_000 }
	linked.screens[0].serviceIds = [1, 2]
	linked.revision++
	assert.ok(await f.repository.compareAndSwap(old, linked, true))
	await r.start()
	assert.equal(f.pages.length, 2, "Start built the deck for the room's new services")
	assert.deepEqual(f.pages[1].screens[0].serviceIds, [1, 2])
	f.service.decks.forget(r.id)
})
