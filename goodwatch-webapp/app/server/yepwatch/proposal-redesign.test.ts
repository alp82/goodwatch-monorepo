import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { ProposalService } from "./proposal-service.server.ts"
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

async function fixture(countrySpecific = false) {
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
	assert.equal(friend.on, false)
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
test("failed interpretations consume the budget and do not publish ideas; idea count is capped at eight", async () => {
	const f = await fixture()
	const broken = new ProposalService(
		f.repo,
		proposalFixtureCatalog,
		"redesign-test-secret-over-thirty-two",
		undefined,
		Date.now,
		undefined,
		async () => {
			throw new Error("search unavailable")
		}
	)
	const s = await broken.read(f.id, f.a.credential)
	await assert.rejects(
		broken.command(f.id, f.a.credential, {
			commandId: "failure",
			sequence: s.own.nextSequence,
			command: { type: "add_idea", text: "Fail search" }
		}),
		/search unavailable/
	)
	assert.equal((await f.repo.read(f.id))!.room.interpretationCount, 1)
	assert.deepEqual(
		(await f.service.read(f.id, f.a.credential)).shared.ideas,
		[]
	)
	for (let i = 0; i < 8; i++)
		await f.send({ type: "add_idea", text: `Idea ${i}` })
	await assert.rejects(f.send({ type: "add_idea", text: "Ninth idea" }), {
		code: "limit_reached"
	})
	assert.equal(f.searches(), 8)
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
	await f.send({ type: "leave" }, f.b)
	assert.equal(f.refreshes(), before + 4)
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
	const f = await fixture(true)
	const old = (await f.repo.read(f.id))!
	const room = structuredClone(old.room)
	room.screens = []
	await f.repo.compareAndSwap(old, room, false)
	await assert.rejects(f.send({ type: "set_services", serviceIds: [2, 3] }), {
		code: "needs_context"
	})
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
