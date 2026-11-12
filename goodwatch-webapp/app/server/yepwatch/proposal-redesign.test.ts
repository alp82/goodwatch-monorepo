import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { ProposalService } from "./proposal-service.server.ts"
import { RoomError } from "./errors.ts"
import {
	ProposalMemoryRepository,
	proposalFixtureCatalog
} from "./proposal-test-support.ts"
import { proposalTransition, proposalSnapshot } from "./proposal-machine.ts"
import {
	attributeCandidates,
	matchingIdeaIds,
	retireIneligible,
	rankedKey,
	titleKey
} from "./proposal-redesign.ts"
import { roomIntentKeys } from "./proposal-intent.ts"
import {
	proposalAdmissionSchema,
	proposalJoinSchema,
	proposalCommandSchema
} from "./proposal-validation.ts"
import { applyRoomRedesign } from "./migrations/apply-room-redesign.ts"
import type { RoomCommand } from "../../../packages/yepwatch-contracts/proposal.ts"
import type { ProposalRoom } from "./proposal-types.ts"

/** A room as the app makes it: created, configured with a country, joined by a friend. */
async function fixture(countrySpecific = false, country: string | null = "US") {
	const repo = new ProposalMemoryRepository()
	let searches = 0
	let refreshes = 0
	const catalog = {
		...proposalFixtureCatalog,
		async refresh(room: ProposalRoom) {
			refreshes++
			return structuredClone(room.candidates)
		},
		async metadata(country: string | null) {
			return {
				countries: [
					{ code: "DE", name: "Germany" },
					{ code: "US", name: "United States" }
				],
				services: (!countrySpecific
					? [1, 2, 3]
					: country === "DE"
					? [1, 2]
					: country === "US"
					? [1, 3]
					: []
				).map((id) => ({
					id,
					name: String(id),
					logoUrl: null
				})),
				moods: []
			}
		}
	}
	const service = new ProposalService(
		repo,
		catalog,
		"redesign-test-secret-over-thirty-two",
		undefined,
		Date.now,
		undefined,
		async (prompt) => {
			searches++
			return {
				prompt,
				attributes: [],
				rankedKeys: [1_000_000_000_001],
				interpretedAt: 1
			}
		}
	)
	const admission = (nickname: string) => ({
		contractVersion: 3 as const,
		commandId: randomUUID(),
		admissionSecret: "a".repeat(43),
		nickname
	})
	const a = await service.create(admission("")),
		id = a.credential.roomId
	const b = await service.join(id, {
		...admission("Friend"),
		inviteCode: a.invite.code
	})
	async function send(c: RoomCommand, who = a) {
		const s = await service.read(id, who.credential)
		return service.command(id, who.credential, {
			commandId: randomUUID(),
			sequence: s.own.nextSequence,
			command: c
		})
	}
	if (country) {
		const s = await service.read(id, a.credential)
		await send({ type: "configure", expectedContextVersion: s.shared.contextVersion, country })
	}
	async function start() {
		await send({ type: "rename", nickname: "Host" })
		await send({ type: "set_services", serviceIds: [1] })
		const s = await service.read(id, a.credential)
		return send({
			type: "start",
			expectedContextVersion: s.shared.contextVersion,
			expectedRosterVersion: s.shared.rosterVersion,
			hostReady: true
		})
	}
	return {
		repo,
		service,
		a,
		b,
		id,
		send,
		start,
		searches: () => searches,
		refreshes: () => refreshes
	}
}
const command = (room: ProposalRoom, c: RoomCommand, actorId = room.hostId) =>
	proposalTransition(
		room,
		actorId,
		{ commandId: randomUUID(), sequence: 1, command: c },
		Date.now()
	)

test("create admits an unnamed host; joins require a name; Start requires name and enabled services", async () => {
	const f = await fixture()
	assert.equal(
		proposalAdmissionSchema.safeParse({
			contractVersion: 3,
			commandId: "a",
			admissionSecret: "x".repeat(43),
			nickname: ""
		}).success,
		true
	)
	assert.equal(
		proposalJoinSchema.safeParse({
			contractVersion: 3,
			commandId: "a",
			admissionSecret: "x".repeat(43),
			nickname: "",
			inviteCode: "a"
		}).success,
		false
	)
	let s = await f.service.read(f.id, f.a.credential)
	await assert.rejects(
		f.send({
			type: "start",
			expectedContextVersion: s.shared.contextVersion,
			expectedRosterVersion: s.shared.rosterVersion,
			hostReady: true
		}),
		{ code: "needs_context" }
	)
	await f.send({ type: "rename", nickname: "Host" })
	s = await f.service.read(f.id, f.a.credential)
	await assert.rejects(
		f.send({
			type: "start",
			expectedContextVersion: s.shared.contextVersion,
			expectedRosterVersion: s.shared.rosterVersion,
			hostReady: true
		}),
		{ code: "needs_context" }
	)
})
test("every new command validates strictly and configure rejects prompt and services", () => {
	const commands: RoomCommand[] = [
		{ type: "add_idea", text: "funny" },
		{ type: "edit_idea", ideaId: "a", text: "funny" },
		{ type: "remove_idea", ideaId: "a" },
		{ type: "set_idea", ideaId: "a", on: true },
		{ type: "set_services", serviceIds: [] },
		{ type: "set_service_enabled", serviceIds: [1], enabled: false },
		{ type: "configure", expectedContextVersion: 1, country: "DE" },
		{ type: "rename", nickname: "Host" },
		{ type: "set_show_seen", show: true }
	]
	for (const c of commands)
		assert.equal(
			proposalCommandSchema.safeParse({
				commandId: "a",
				sequence: 1,
				command: c
			}).success,
			true,
			c.type
		)
	assert.equal(
		proposalCommandSchema.safeParse({
			commandId: "a",
			sequence: 1,
			command: { type: "configure", expectedContextVersion: 1, prompt: "no" }
		}).success,
		false
	)
})
test("idea authors, host switches, editing, removing, no resets, and unchanged text refusal", async () => {
	const f = await fixture()
	await f.start()
	let s = (await f.send({ type: "add_idea", text: "Host idea" })).snapshot
	const hostIdea = s.shared.ideas[0],
		generation = s.shared.generation,
		version = s.shared.stream.version
	s = (await f.send({ type: "add_idea", text: "Friend idea" }, f.b)).snapshot
	const friend = s.shared.ideas[1]
	assert.equal(hostIdea.on, true)
	assert.equal(friend.on, true)
	assert.equal(friend.authorId, f.b.credential.participantId)
	await assert.rejects(
		f.send({ type: "set_idea", ideaId: friend.id, on: true }, f.b),
		{ code: "forbidden" }
	)
	await assert.rejects(
		f.send({ type: "edit_idea", ideaId: friend.id, text: "Stolen" }),
		{ code: "forbidden" }
	)
	await assert.rejects(
		f.send({ type: "edit_idea", ideaId: friend.id, text: friend.text }, f.b),
		{ code: "invalid_request" }
	)
	await f.send({ type: "set_idea", ideaId: friend.id, on: true })
	await f.send({ type: "edit_idea", ideaId: friend.id, text: "New idea" }, f.b)
	await f.send({ type: "remove_idea", ideaId: hostIdea.id })
	s = (await f.send({ type: "remove_idea", ideaId: friend.id })).snapshot
	assert.equal(s.shared.generation, generation)
	assert.equal(s.shared.phase, "choosing")
	assert.ok(s.shared.stream.version > version)
	assert.deepEqual(s.shared.ideas, [])
	assert.equal(f.searches(), 3)
})
test("interpretation occurs once across CAS publication retries, receipt replay never searches", async () => {
	const f = await fixture()
	const original = f.repo.compareAndSwap.bind(f.repo)
	let misses = 2
	f.repo.compareAndSwap = async (old, room, notify) => {
		if (room.ideas?.length && misses-- > 0) return false
		return original(old, room, notify)
	}
	const s = await f.service.read(f.id, f.a.credential),
		envelope = {
			commandId: "once",
			sequence: s.own.nextSequence,
			command: { type: "add_idea" as const, text: "Mystery" }
		}
	await f.service.command(f.id, f.a.credential, envelope)
	await f.service.command(f.id, f.a.credential, envelope)
	assert.equal(f.searches(), 1)
	assert.equal((await f.repo.read(f.id))!.room.interpretationCount, 1)
})
test("24 lifetime interpretations, including failed searches, survive idea removal and restart", async () => {
	const f = await fixture()
	for (let i = 0; i < 24; i++) {
		const s = (await f.send({ type: "add_idea", text: `Idea ${i}` })).snapshot
		await f.send({ type: "remove_idea", ideaId: s.shared.ideas[0].id })
	}
	const current = await f.service.read(f.id, f.a.credential)
	await f.send({ type: "restart", expectedRevision: current.shared.revision })
	await assert.rejects(f.send({ type: "add_idea", text: "Too many" }), {
		code: "limit_reached"
	})
	assert.equal(f.searches(), 24)
})
test("service union ignores null picks, enforces host switches and last-service safety; null pick still counts for agreement", async () => {
	const f = await fixture()
	await f.start()
	let s = await f.service.read(f.id, f.a.credential)
	assert.equal(s.shared.participants[1].serviceIds, null)
	await f.send({ type: "set_services", serviceIds: [2, 2] }, f.b)
	s = (
		await f.send({
			type: "set_service_enabled",
			serviceIds: [2],
			enabled: false
		})
	).snapshot
	assert.deepEqual(s.shared.screens[0].serviceIds, [1])
	assert.deepEqual(s.shared.disabledServiceIds, [2])
	await assert.rejects(
		f.send({ type: "set_service_enabled", serviceIds: [1], enabled: false }),
		{ code: "needs_context" }
	)
	await assert.rejects(
		f.send(
			{ type: "set_service_enabled", serviceIds: [2], enabled: true },
			f.b
		),
		{ code: "forbidden" }
	)
	await f.send({ type: "set_services", serviceIds: [] }, f.b)
	let room = (await f.repo.read(f.id))!.room
	room.participants[1].serviceIds = null
	const c = room.candidates[0]
	for (const p of room.participants)
		p.votes[c.id] = { value: "watch", revision: 1 }
	room = command(room, {
		type: "propose",
		candidateId: c.id,
		generation: room.generation,
		expectedRosterVersion: room.rosterVersion,
		expectedProposalVersion: room.proposalVersion
	})
	assert.equal(
		proposalSnapshot(room, room.hostId).shared.proposal!.requiredCount,
		2
	)
})
test("configure changes kinds and country during voting while retaining answers, generation and receipts", async () => {
	const f = await fixture()
	await f.start()
	const room = (await f.repo.read(f.id))!.room
	const answered = room.candidates[0]
	room.participants[0].votes[answered.id] = { value: "pass", revision: 1 }
	const next = command(room, {
		type: "configure",
		expectedContextVersion: room.contextVersion,
		country: "DE",
		constraints: { kinds: ["show_start"], moods: [], maxMinutes: null }
	})
	assert.equal(next.generation, room.generation)
	assert.equal(next.phase, "choosing")
	assert.deepEqual(next.participants[0].votes, room.participants[0].votes)
	assert.equal(next.screens[0].country, "DE")
	assert.throws(
		() =>
			command(
				room,
				{
					type: "configure",
					expectedContextVersion: room.contextVersion,
					country: "DE"
				},
				room.participants[1].id
			),
		{ code: "forbidden" }
	)
})
test("retirement removes seen keys, preserves any answer including undo, and attribution behaves as a set", async () => {
	const f = await fixture()
	await f.start()
	const room = (await f.repo.read(f.id))!.room
	const cards = room.candidates
	assert.ok(cards.length >= 2)
	room.ideas = [
		{
			id: "a",
			text: "idea a",
			authorId: room.hostId,
			on: true,
			attributes: [],
			rankedKeys: cards.map(rankedKey),
			interpretedAt: 1
		},
		{
			id: "b",
			text: "idea b",
			authorId: room.hostId,
			on: true,
			attributes: [],
			rankedKeys: [rankedKey(cards[0])],
			interpretedAt: 1
		}
	]
	for (const c of cards) c.ideaIds = ["a"]
	attributeCandidates(room)
	attributeCandidates(room)
	assert.deepEqual(cards[0].ideaIds, ["a", "b"])
	room.participants[1].votes[cards[1].id] = { value: null, revision: 1 }
	let next = command(room, { type: "set_idea", ideaId: "a", on: false })
	assert.ok(next.candidates.some((c) => c.id === cards[0].id))
	assert.ok(next.candidates.some((c) => c.id === cards[1].id))
	next = command(next, { type: "set_idea", ideaId: "b", on: false })
	assert.ok(!next.candidates.some((c) => c.id === cards[0].id))
	assert.ok(!next.seenKeys.includes(titleKey(cards[0])))
	next = command(next, { type: "set_idea", ideaId: "a", on: true })
	assert.ok(
		roomIntentKeys(next, cards.map(rankedKey)).includes(rankedKey(cards[0]))
	)
})
test("interleaved idea ranking falls back to popularity and skips already seen titles", () => {
	const idea = (id: string, rankedKeys: number[]) => ({
		id,
		text: id,
		authorId: "host",
		on: true,
		attributes: [],
		rankedKeys,
		interpretedAt: 1
	})
	const base = [1, 2, 3, 4, 5, 6].map((i) => 1_000_000_000_000 + i)
	assert.deepEqual(
		roomIntentKeys(
			{ ideas: [idea("a", [base[2]]), idea("b", [base[4]])], seenKeys: [] },
			base
		),
		[base[2], base[4], base[0], base[1], base[3], base[5]]
	)
	assert.deepEqual(
		roomIntentKeys({ ideas: [], seenKeys: ["movie_1"] }, base),
		base.slice(1)
	)
})
test("seen switch is members only, private, and excludes untouched titles while retaining answers", async () => {
	const f = await fixture()
	await f.start()
	await assert.rejects(f.send({ type: "set_show_seen", show: true }), {
		code: "member_required"
	})
	const room = (await f.repo.read(f.id))!.room
	room.participants[0].member = { state: "linked", prefill: null }
	const next = command(room, { type: "set_show_seen", show: true })
	assert.equal(proposalSnapshot(next, next.hostId).own.showSeen, true)
	assert.equal(
		"showSeen" in proposalSnapshot(next, next.hostId).shared.participants[0],
		false
	)
	const c = next.candidates[0]
	retireIneligible(next, new Set([titleKey(c)]))
	assert.ok(!next.candidates.some((v) => v.id === c.id))
})
test("migration replays idempotently using column metadata; no unsupported ADD IF NOT EXISTS", async () => {
	const added = new Set<string>()
	let writes = 0
	const sql = async (stmt: string, args: unknown[] = []) => {
		if (stmt.startsWith("SELECT"))
			return {
				rows: added.has(String(args[2])) ? [[args[2]]] : [],
				rowcount: 0
			}
		const match = /ADD COLUMN (\w+)/.exec(stmt)
		if (match) {
			assert.ok(!added.has(match[1]))
			added.add(match[1])
			writes++
		}
		return { rows: [], rowcount: 1 }
	}
	await applyRoomRedesign(sql)
	await applyRoomRedesign(sql)
	assert.equal(writes, 6)
})

test("proposal and matches withdraw when their only service or idea is switched off; votes survive", async () => {
	const f = await fixture()
	await f.start()
	let room = (await f.repo.read(f.id))!.room
	const card = room.candidates[0]
	for (const p of room.participants)
		p.votes[card.id] = { value: "watch", revision: 1 }
	room = command(room, {
		type: "propose",
		candidateId: card.id,
		generation: room.generation,
		expectedRosterVersion: room.rosterVersion,
		expectedProposalVersion: room.proposalVersion
	})
	const idea = {
		id: "only",
		text: "Only idea",
		authorId: room.hostId,
		on: true,
		attributes: [],
		rankedKeys: [rankedKey(card)],
		interpretedAt: 1
	}
	room.ideas = [idea]
	card.ideaIds = [idea.id]
	room.candidates.find((c) => c.id === card.id)!.ideaIds = [idea.id]
	let next = command(room, { type: "set_idea", ideaId: idea.id, on: false })
	assert.equal(next.proposal, null)
	assert.equal(proposalSnapshot(next, next.hostId).shared.matches.length, 0)
	assert.ok(next.candidates.some((c) => c.id === card.id))
	assert.equal(next.participants[0].votes[card.id].value, "watch")
	room.participants[0].serviceIds = [1, 2]
	next = command(room, {
		type: "set_service_enabled",
		serviceIds: [1],
		enabled: false
	})
	assert.equal(next.proposal, null)
	assert.equal(proposalSnapshot(next, next.hostId).shared.matches.length, 0)
})
test("failed interpretations consume the budget and keep the idea uninterpreted; a spend-limit refusal is refunded; idea count is capped at eight", async () => {
	const f = await fixture()
	const failing = (error: Error) => new ProposalService(
		f.repo,
		proposalFixtureCatalog,
		"redesign-test-secret-over-thirty-two",
		undefined,
		Date.now,
		undefined,
		async () => {
			throw error
		}
	)
	const broken = failing(new Error("search unavailable"))
	let s = await broken.read(f.id, f.a.credential)
	// A failing search never refuses the idea: it is stored without attributes or ranked keys.
	s = (await broken.command(f.id, f.a.credential, {
		commandId: "failure",
		sequence: s.own.nextSequence,
		command: { type: "add_idea", text: "Fail search" }
	})).snapshot
	assert.deepEqual(s.shared.ideas.map((i) => [i.text, i.attributes]), [["Fail search", []]])
	let room = (await f.repo.read(f.id))!.room
	assert.equal(room.interpretationCount, 1)
	assert.deepEqual(room.ideas![0].rankedKeys, [])
	// GoodWatch's spend limit refused before any search: the idea is kept, the room's budget is not spent.
	const limited = failing(new RoomError("catalog_unavailable", "Mood matching is unavailable for now. You can still start without an idea.", 503, false))
	s = (await limited.command(f.id, f.a.credential, {
		commandId: "budget",
		sequence: s.own.nextSequence,
		command: { type: "edit_idea", ideaId: s.shared.ideas[0].id, text: "Budget refused" }
	})).snapshot
	assert.deepEqual(s.shared.ideas.map((i) => [i.text, i.attributes]), [["Budget refused", []]])
	room = (await f.repo.read(f.id))!.room
	assert.equal(room.interpretationCount, 1)
	for (let i = 0; i < 7; i++)
		await f.send({ type: "add_idea", text: `Idea ${i}` })
	await assert.rejects(f.send({ type: "add_idea", text: "Ninth idea" }), {
		code: "limit_reached"
	})
	assert.equal(f.searches(), 7)
})

const spendLimit = () => new RoomError("catalog_unavailable", "Mood matching is unavailable for now. You can still start without an idea.", 503, false)
const limitedService = (repo: ProposalMemoryRepository) => new ProposalService(
	repo,
	proposalFixtureCatalog,
	"redesign-test-secret-over-thirty-two",
	undefined,
	Date.now,
	undefined,
	async () => {
		throw spendLimit()
	}
)
test("a spend-limit refusal handled twice at once refunds both reservations and stores one idea", async () => {
	const f = await fixture()
	const s = await f.service.read(f.id, f.a.credential)
	const envelope = {
		commandId: randomUUID(),
		sequence: s.own.nextSequence,
		command: { type: "add_idea" as const, text: "Twice refused" }
	}
	// Two API instances answer the same command: one publishes, the other replays its receipt.
	const results = await Promise.allSettled([
		limitedService(f.repo).command(f.id, f.a.credential, envelope),
		limitedService(f.repo).command(f.id, f.a.credential, envelope)
	])
	assert.ok(results.some((r) => r.status === "fulfilled"))
	const room = (await f.repo.read(f.id))!.room
	assert.equal(room.interpretationCount, 0)
	assert.deepEqual(room.ideas!.map((i) => i.text), ["Twice refused"])
})
test("a spend-limit refusal is refunded even when the idea's publication fails", async () => {
	const f = await fixture()
	const cas = f.repo.compareAndSwap.bind(f.repo)
	f.repo.compareAndSwap = async (old, room, notify) => {
		if (room.ideas?.some((i) => i.text === "Never stored")) throw new Error("store down")
		return cas(old, room, notify)
	}
	const s = await f.service.read(f.id, f.a.credential)
	await assert.rejects(
		limitedService(f.repo).command(f.id, f.a.credential, {
			commandId: randomUUID(),
			sequence: s.own.nextSequence,
			command: { type: "add_idea", text: "Never stored" }
		}),
		/store down/
	)
	const room = (await f.repo.read(f.id))!.room
	assert.equal(room.interpretationCount, 0)
	assert.deepEqual(room.ideas ?? [], [])
})

test("readiness probes every new nullable column and the immutable idea table", async () => {
	const { checkRelationalRooms } = await import(
		"./proposal-relational-repository.ts"
	)
	const statements: string[] = []
	await checkRelationalRooms(async (stmt) => {
		statements.push(stmt)
		return { rows: [], rowcount: 0 }
	})
	const room = statements.find((s) => s.includes(" FROM doc.yepwatch_room "))!
	assert.match(room, /idea_records/)
	assert.match(room, /disabled_service_ids/)
	assert.match(room, /interpretation_count/)
	assert.match(
		statements.find((s) => s.includes(" FROM doc.yepwatch_participant "))!,
		/service_ids,show_seen/
	)
	assert.match(
		statements.find((s) => s.includes(" FROM doc.yepwatch_candidate "))!,
		/idea_ids/
	)
	assert.ok(statements.some((s) => s.includes(" FROM doc.yepwatch_idea ")))
})

test("idea switches retire cards without refreshing availability; only availability commands refresh", async () => {
	const f = await fixture()
	await f.start()
	const added = (await f.send({ type: "add_idea", text: "A mystery" })).snapshot
	const before = f.refreshes()
	await f.send({
		type: "set_idea",
		ideaId: added.shared.ideas[0].id,
		on: false
	})
	await f.send({ type: "rename", nickname: "New host" })
	let s = await f.service.read(f.id, f.a.credential)
	await f.send({
		type: "configure",
		expectedContextVersion: s.shared.contextVersion,
		constraints: { kinds: ["movie"], moods: [], maxMinutes: null }
	})
	assert.equal(f.refreshes(), before)
	s = await f.service.read(f.id, f.a.credential)
	await f.send({
		type: "configure",
		expectedContextVersion: s.shared.contextVersion,
		country: "DE"
	})
	assert.equal(f.refreshes(), before + 1)
	s = await f.service.read(f.id, f.a.credential)
	await f.send({
		type: "configure",
		expectedContextVersion: s.shared.contextVersion,
		country: "DE"
	})
	assert.equal(f.refreshes(), before + 1)
	await f.send({ type: "set_services", serviceIds: [1, 2] })
	await f.send({ type: "set_service_enabled", serviceIds: [2], enabled: false })
	assert.equal(f.refreshes(), before + 3)
	// Availability commands that leave the room's services as they were have nothing to check.
	await f.send({ type: "set_services", serviceIds: [1] }, f.b)
	assert.equal(f.refreshes(), before + 3)
	await f.send({ type: "set_services", serviceIds: [1, 3] }, f.b)
	assert.equal(f.refreshes(), before + 4)
	await f.send({ type: "leave" }, f.b)
	assert.equal(f.refreshes(), before + 5, "the room loses the friend's service")
})

test("fallback cards have no idea attribution and survive idea switches while obeying eligibility filters", async () => {
	const f = await fixture()
	await f.start()
	const room = (await f.repo.read(f.id))!.room
	const fallback = room.candidates.find((c) => c.identity.kind === "movie")!
	room.ideas = [
		{
			id: "idea",
			text: "A different title",
			authorId: room.hostId,
			on: true,
			attributes: [],
			rankedKeys: [rankedKey(fallback) + 100],
			interpretedAt: 1
		}
	]
	fallback.ideaIds = matchingIdeaIds(room, fallback)
	assert.deepEqual(fallback.ideaIds, [])
	assert.deepEqual(
		matchingIdeaIds(room, {
			identity: { kind: "movie", tmdbId: fallback.identity.tmdbId + 100 }
		}),
		["idea"]
	)
	let next = command(room, { type: "set_idea", ideaId: "idea", on: false })
	assert.ok(next.candidates.some((c) => c.id === fallback.id))
	next = command(next, { type: "set_idea", ideaId: "idea", on: true })
	assert.ok(next.candidates.some((c) => c.id === fallback.id))
	for (const rule of ["availability", "kinds", "seen"]) {
		const filtered = structuredClone(next)
		if (rule === "availability") filtered.screens[0].serviceIds = [999]
		if (rule === "kinds") filtered.constraints.kinds = ["show_start"]
		retireIneligible(
			filtered,
			new Set(rule === "seen" ? [titleKey(fallback)] : [])
		)
		assert.ok(!filtered.candidates.some((c) => c.id === fallback.id), rule)
	}
})

test("service picks without a room country are refused until the host sets one", async () => {
	const f = await fixture(true, null)
	// Joins and other room commands never pick a country on the host's behalf.
	await f.send({ type: "add_idea", text: "Something funny" })
	assert.equal((await f.service.read(f.id, f.a.credential)).shared.screens[0]?.country ?? null, null)
	await assert.rejects(f.send({ type: "set_services", serviceIds: [2, 3] }), {
		code: "needs_context"
	})
	const s = await f.service.read(f.id, f.a.credential)
	await f.send({ type: "configure", expectedContextVersion: s.shared.contextVersion, country: "US" })
	await f.send({ type: "set_services", serviceIds: [1, 3] })
})

test("linked service picks accept the union of room and prefill countries; guests use only the room country", async () => {
	const f = await fixture(true)
	const s = await f.service.read(f.id, f.a.credential)
	await f.send({
		type: "configure",
		expectedContextVersion: s.shared.contextVersion,
		country: "DE"
	})
	const old = (await f.repo.read(f.id))!
	const room = structuredClone(old.room)
	room.participants[1].member = {
		state: "linked",
		prefill: {
			country: "US",
			serviceIds: [3],
			savedProgressAvailable: false
		}
	}
	await f.repo.compareAndSwap(old, room, false)
	await f.send({ type: "set_services", serviceIds: [2, 3] }, f.b)
	assert.deepEqual(
		(await f.repo.read(f.id))!.room.participants[1].serviceIds,
		[2, 3]
	)
	await assert.rejects(
		f.send({ type: "set_services", serviceIds: [999] }, f.b),
		{ code: "invalid_request" }
	)
	await assert.rejects(f.send({ type: "set_services", serviceIds: [3] }), {
		code: "invalid_request"
	})
	await f.send({ type: "set_services", serviceIds: [2] })
})
test("a deck waiting for answers reopens once a vote lets a card retire, so the next refill can run", async () => {
	const f = await fixture()
	await f.start()
	const room = (await f.repo.read(f.id))!.room
	const [one, two] = room.candidates
	assert.ok(one && two)
	const friend = room.participants.find((p) => p.id !== room.hostId)!
	friend.votes[one.id] = { value: "pass", revision: 1 }
	friend.votes[two.id] = { value: "pass", revision: 1 }
	friend.lastVotedId = two.id
	room.stream = {
		version: room.stream.version + 1,
		state: "capacity",
		reason: "awaiting_answers"
	}
	const vote = (r: ProposalRoom, candidateId: string) =>
		command(r, {
			type: "vote",
			generation: r.generation,
			candidateId,
			expectedVoteRevision: 0,
			value: "pass"
		})
	// The host's own last answer stays pinned: nothing can retire yet, the deck keeps waiting.
	let next = vote(room, one.id)
	assert.deepEqual(next.stream, room.stream)
	// Now the first card is answered by everyone and no longer pinned: the stream is ready again.
	next = vote(next, two.id)
	assert.deepEqual(next.stream, {
		version: room.stream.version + 1,
		state: "ready",
		reason: null
	})
	assert.ok(next.candidates.some((c) => c.id === one.id), "a vote does not retire cards itself")
	// A full room (seen-title capacity) stays closed.
	const full = structuredClone(room)
	full.stream = { ...room.stream, reason: "room_capacity" }
	assert.equal(vote(vote(full, one.id), two.id).stream.state, "capacity")
})
test("a departed person's last answer still pins its card, so a full deck keeps waiting", async () => {
	const f = await fixture()
	await f.start()
	const room = (await f.repo.read(f.id))!.room
	const [one, two] = room.candidates
	assert.ok(one && two)
	const friend = room.participants.find((p) => p.id !== room.hostId)!
	friend.votes[one.id] = { value: "pass", revision: 1 }
	friend.votes[two.id] = { value: "pass", revision: 1 }
	friend.lastVotedId = two.id
	const gone = structuredClone(friend)
	gone.id = "gone"
	gone.leftAt = 1
	gone.lastVotedId = one.id
	room.participants.push(gone)
	room.stream = {
		version: room.stream.version + 1,
		state: "capacity",
		reason: "awaiting_answers"
	}
	const vote = (r: ProposalRoom, candidateId: string) =>
		command(r, {
			type: "vote",
			generation: r.generation,
			candidateId,
			expectedVoteRevision: 0,
			value: "pass"
		})
	// Card one is held by the departed person's last answer, card two by the others': nothing can
	// retire, so the stream must not flip to ready (a refill would make no progress).
	const next = vote(vote(room, one.id), two.id)
	assert.deepEqual(next.stream, room.stream)
})

test("Start, settings and Start again commute with a friend's concurrent changes; real conflicts stay", async () => {
	const f = await fixture()
	await f.send({ type: "rename", nickname: "Host" })
	await f.send({ type: "set_services", serviceIds: [1] })
	// The host's view is read before the friend saves services and adds an idea.
	const stale = await f.service.read(f.id, f.a.credential)
	await f.send({ type: "set_services", serviceIds: [2] }, f.b)
	await f.send({ type: "configure", expectedContextVersion: stale.shared.contextVersion, constraints: { kinds: ["movie"], maxMinutes: null, moods: [] } })
	const started = await f.send({
		type: "start",
		expectedGeneration: stale.shared.generation,
		expectedContextVersion: stale.shared.contextVersion,
		expectedRosterVersion: stale.shared.rosterVersion,
		hostReady: true
	})
	assert.equal(started.snapshot.shared.phase, "choosing", "Start never fails on an unrelated settings change")
	const card = started.snapshot.shared.candidates[0].id
	// A vote for the previous round is a real conflict.
	await assert.rejects(
		f.send({ type: "vote", generation: started.snapshot.shared.generation - 1, candidateId: card, expectedVoteRevision: 0, value: "watch" }, f.b),
		(e: { code?: string }) => e.code === "conflict"
	)
	const before = await f.service.read(f.id, f.a.credential)
	await f.send({ type: "vote", generation: before.shared.generation, candidateId: card, expectedVoteRevision: 0, value: "watch" }, f.b)
	const again = await f.send({ type: "restart", expectedGeneration: before.shared.generation, expectedRevision: before.shared.revision })
	assert.equal(again.snapshot.shared.phase, "setup", "Start again commutes with a friend's vote")
})

test("two tabs on one session: a sequence the other tab took doesn't refuse a new command; a reused id with other content does", async () => {
	const f = await fixture()
	const s = await f.service.read(f.id, f.b.credential)
	const sequence = s.own.nextSequence
	const first = { commandId: randomUUID(), sequence, command: { type: "set_services" as const, serviceIds: [1] } }
	await f.service.command(f.id, f.b.credential, first)
	const second = await f.service.command(f.id, f.b.credential, { commandId: randomUUID(), sequence, command: { type: "rename", nickname: "Friendly" } })
	assert.equal(second.receipt.sequence, sequence + 1, "the second tab's command takes the next sequence")
	assert.equal(second.snapshot.shared.participants.find((p) => p.participantId === s.own.participantId)?.nickname, "Friendly")
	const replay = await f.service.command(f.id, f.b.credential, first)
	assert.equal(replay.receipt.replayed, true, "an exact retry still replays")
	await assert.rejects(
		f.service.command(f.id, f.b.credential, { ...first, command: { type: "set_services", serviceIds: [2] } }),
		(e: { code?: string }) => e.code === "conflict"
	)
})

const conflict = (e: { code?: string }) => e.code === "conflict"

test("Start again is fenced by its round: a delayed second Start again never clears the next round's votes", async () => {
	const f = await fixture()
	const started = await f.start()
	const seen = started.snapshot.shared
	// Two tabs of the host press Start again on the same decided/choosing view.
	const first = await f.send({ type: "restart", expectedGeneration: seen.generation, expectedRevision: seen.revision })
	assert.equal(first.snapshot.shared.phase, "setup")
	const again = await f.start()
	const card = again.snapshot.shared.candidates[0].id
	await f.send({ type: "vote", generation: again.snapshot.shared.generation, candidateId: card, expectedVoteRevision: 0, value: "watch" }, f.b)
	await assert.rejects(f.send({ type: "restart", expectedGeneration: seen.generation, expectedRevision: seen.revision }), conflict)
	const after = await f.service.read(f.id, f.b.credential)
	assert.equal(after.shared.phase, "choosing")
	assert.equal(after.own.votes.find((v) => v.candidateId === card)?.value, "watch", "the friend's vote in the new round stays")
})

test("an installed bundle's Start again (no round) keeps its strict revision fence", async () => {
	const f = await fixture()
	const started = await f.start()
	const seen = started.snapshot.shared
	await f.send({ type: "vote", generation: seen.generation, candidateId: seen.candidates[0].id, expectedVoteRevision: 0, value: "watch" }, f.b)
	await assert.rejects(f.send({ type: "restart", expectedRevision: seen.revision }), conflict)
	const current = await f.service.read(f.id, f.a.credential)
	const ok = await f.send({ type: "restart", expectedRevision: current.shared.revision })
	assert.equal(ok.snapshot.shared.phase, "setup")
})

test("Start is fenced by its round: a Start from before a Start again doesn't begin the next round", async () => {
	const f = await fixture()
	await f.send({ type: "rename", nickname: "Host" })
	await f.send({ type: "set_services", serviceIds: [1] })
	const seen = (await f.service.read(f.id, f.a.credential)).shared
	const start = { type: "start" as const, expectedGeneration: seen.generation, expectedContextVersion: seen.contextVersion, expectedRosterVersion: seen.rosterVersion, hostReady: true }
	const started = await f.send(start)
	await f.send({ type: "restart", expectedGeneration: started.snapshot.shared.generation, expectedRevision: started.snapshot.shared.revision })
	await assert.rejects(f.send(start), conflict)
	assert.equal((await f.service.read(f.id, f.a.credential)).shared.phase, "setup", "the delayed Start didn't start the new round")
	// An installed bundle's Start (no round) keeps its strict version fences.
	const now = (await f.service.read(f.id, f.a.credential)).shared
	await f.send({ type: "set_services", serviceIds: [2] }, f.b)
	await assert.rejects(f.send({ type: "start", expectedContextVersion: now.contextVersion, expectedRosterVersion: now.rosterVersion, hostReady: true }), conflict)
})

test("settings commute with a friend's change but never apply to a decided room", async () => {
	const f = await fixture()
	const stale = (await f.service.read(f.id, f.a.credential)).shared
	await f.send({ type: "set_services", serviceIds: [2] }, f.b)
	const saved = await f.send({ type: "configure", expectedContextVersion: stale.contextVersion, constraints: { kinds: ["show"], maxMinutes: null, moods: [] } })
	assert.deepEqual(saved.snapshot.shared.constraints.kinds, ["show"])
	const room = structuredClone(await f.repo.read(f.id))!.room
	room.phase = "decided"
	assert.throws(() => command(room, { type: "configure", expectedContextVersion: 0, country: "DE" }), conflict)
	assert.throws(() => command(room, { type: "ready", expectedContextVersion: 0, ready: true }), conflict)
	assert.throws(() => command(room, { type: "assign_screen", expectedContextVersion: 0, screenId: "room" }), conflict)
})

test("propose keeps its round and proposal fences; only the roster version commutes", async () => {
	const f = await fixture()
	const started = await f.start()
	const s = started.snapshot.shared
	const card = s.candidates[0].id
	await f.send({ type: "vote", generation: s.generation, candidateId: card, expectedVoteRevision: 0, value: "watch" })
	await f.send({ type: "vote", generation: s.generation, candidateId: card, expectedVoteRevision: 0, value: "watch" }, f.b)
	const seen = (await f.service.read(f.id, f.a.credential)).shared
	await assert.rejects(f.send({ type: "propose", generation: seen.generation - 1, expectedRosterVersion: seen.rosterVersion, expectedProposalVersion: seen.proposalVersion, candidateId: card }), conflict)
	await assert.rejects(f.send({ type: "propose", generation: seen.generation, expectedRosterVersion: seen.rosterVersion, expectedProposalVersion: seen.proposalVersion - 1, candidateId: card }), conflict)
	const proposed = await f.send({ type: "propose", generation: seen.generation, expectedRosterVersion: seen.rosterVersion - 1, expectedProposalVersion: seen.proposalVersion, candidateId: card })
	assert.equal(proposed.snapshot.shared.proposal?.candidateId, card)
})

test("agree keeps its round, proposal and own-agreement fences; only the roster version commutes", async () => {
	const f = await fixture()
	const started = await f.start()
	const s = started.snapshot.shared
	const card = s.candidates[0].id
	await f.send({ type: "vote", generation: s.generation, candidateId: card, expectedVoteRevision: 0, value: "watch" })
	await f.send({ type: "vote", generation: s.generation, candidateId: card, expectedVoteRevision: 0, value: "watch" }, f.b)
	const seen = (await f.service.read(f.id, f.a.credential)).shared
	await f.send({ type: "propose", generation: seen.generation, expectedRosterVersion: seen.rosterVersion, expectedProposalVersion: seen.proposalVersion, candidateId: card })
	const view = await f.service.read(f.id, f.b.credential)
	const p = view.shared.proposal!
	const agree = (patch: Partial<Extract<RoomCommand, { type: "agree" }>>) => f.send({ type: "agree", generation: view.shared.generation, expectedRosterVersion: view.shared.rosterVersion - 1, expectedProposalVersion: p.version, candidateId: p.candidateId, expectedOwnAgreementRevision: view.own.agreement.revision, agreed: true, ...patch }, f.b)
	await assert.rejects(agree({ generation: view.shared.generation - 1 }), conflict)
	await assert.rejects(agree({ expectedProposalVersion: p.version - 1 }), conflict)
	await assert.rejects(agree({ expectedOwnAgreementRevision: view.own.agreement.revision + 1 }), conflict)
	const agreed = await agree({})
	assert.ok(agreed.snapshot.own.agreement.agreed || agreed.snapshot.shared.phase === "decided")
})
