import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import type {
	GuestAdmission,
	RoomCommand,
	CommandEnvelope,
} from "../../../packages/yepwatch-contracts/continuous.ts"
import { paths } from "../../../packages/yepwatch-contracts/continuous.ts"
import { ContinuousService } from "./continuous-service.server.ts"
import {
	ContinuousMemoryRepository,
	continuousFixtureCatalog,
} from "./continuous-test-support.ts"
import { createContinuousHandler } from "./continuous-http.server.ts"
import { RoomError } from "./errors.ts"
const secret = "continuous-tests-secret-at-least-thirty-two"
const admission = (nickname = "A") => ({
	contractVersion: 2 as const,
	commandId: randomBytes(16).toString("hex"),
	admissionSecret: randomBytes(32).toString("base64url"),
	nickname,
})
const credential = (a: GuestAdmission) => ({
	participantId: a.credential.participantId,
	token: a.credential.token,
})
async function fixture() {
	const repo = new ContinuousMemoryRepository()
	const service = new ContinuousService(repo, continuousFixtureCatalog, secret)
	const a = await service.create(admission())
	const b = await service.join(a.credential.roomId, {
		...admission("B"),
		inviteCode: a.invite.code,
	})
	const id = a.credential.roomId
	const send = async (who: GuestAdmission, command: RoomCommand) => {
		const s = await service.read(id, credential(who))
		return service.command(id, credential(who), {
			commandId: randomBytes(16).toString("hex"),
			sequence: s.own.nextSequence,
			command,
		})
	}
	await send(a, {
		type: "setup",
		expectedContextVersion: 1,
		screens: [
			{
				id: "couch",
				label: "TV",
				country: "DE",
				serviceIds: [1],
				confirmed: true,
			},
		],
		constraints: {
			kinds: ["movie", "show_start"],
			maxMinutes: null,
			moods: [],
		},
		screenId: "couch",
	})
	await send(b, {
		type: "assign_screen",
		expectedContextVersion: 2,
		screenId: "couch",
	})
	let s = await service.read(id, credential(a))
	await send(b, {
		type: "ready",
		expectedContextVersion: s.shared.contextVersion,
		ready: true,
	})
	s = await service.read(id, credential(a))
	await send(a, {
		type: "start",
		expectedRosterVersion: s.shared.rosterVersion,
		expectedContextVersion: s.shared.contextVersion,
		hostReady: true,
	})
	const vote = async (
		who: GuestAdmission,
		candidateId: string,
		value: "watch" | "pass" | null,
	) => {
		const s = await service.read(id, credential(who))
		return send(who, {
			type: "vote",
			generation: s.shared.generation,
			candidateId,
			expectedVoteRevision:
				s.own.votes.find((v) => v.candidateId === candidateId)?.revision ?? 0,
			value,
		})
	}
	const pick = async (who: GuestAdmission, candidateId: string | null) => {
		const s = await service.read(id, credential(who))
		return send(who, {
			type: "pick",
			generation: s.shared.generation,
			expectedRosterVersion: s.shared.rosterVersion,
			expectedPickRevision: s.own.pick.revision,
			candidateId,
		})
	}
	return { repo, service, a, b, id, send, vote, pick }
}
test("Immediate match never waits for deck completion; one private pick persists, replacement automatically decides", async () => {
	const f = await fixture()
	const cards = (await f.service.read(f.id, credential(f.a))).shared.candidates
	assert.equal(cards.length, 2)
	await f.vote(f.a, cards[0].id, "watch")
	let result = await f.vote(f.b, cards[0].id, "watch")
	assert.equal(result.snapshot.shared.matches.length, 1)
	assert.equal(result.snapshot.shared.phase, "choosing")
	assert.equal(result.snapshot.own.nextCandidateId, cards[1].id)
	await f.pick(f.a, cards[0].id)
	let s = await f.service.read(f.id, credential(f.a))
	assert.equal(s.own.pick.candidateId, cards[0].id)
	assert.equal(s.shared.matches[0].pickCount, 1)
	await f.vote(f.a, cards[1].id, "watch")
	await f.vote(f.b, cards[1].id, "watch")
	await f.pick(f.b, cards[1].id)
	assert.equal(
		(await f.service.read(f.id, credential(f.a))).shared.phase,
		"choosing",
	)
	result = await f.pick(f.b, cards[0].id)
	assert.equal(result.snapshot.shared.phase, "decided")
	assert.equal(result.snapshot.shared.decision?.candidateId, cards[0].id)
	const wire = JSON.stringify(result.snapshot.shared)
	for (const forbidden of [
		"tokenHash",
		"memberUserId",
		"votes",
		"nextSequence",
		"currentCard",
		"completedCount",
	])
		assert.ok(!wire.includes(forbidden))
	assert.equal(result.snapshot.shared.matches[0].pickCount, 2)
})
test("Undo immediately invalidates match and every pick; late join counts with no invented votes", async () => {
	const f = await fixture()
	const card = (await f.service.read(f.id, credential(f.a))).shared
		.candidates[0].id
	await f.vote(f.a, card, "watch")
	await f.vote(f.b, card, "watch")
	await f.pick(f.a, card)
	await f.vote(f.b, card, null)
	let s = await f.service.read(f.id, credential(f.a))
	assert.equal(s.shared.matches.length, 0)
	assert.equal(s.own.pick.candidateId, null)
	await f.vote(f.b, card, "watch")
	await f.pick(f.a, card)
	const c = await f.service.join(f.id, {
		...admission("Late"),
		inviteCode: f.a.invite.code,
		screenId: "couch",
	})
	assert.equal(c.snapshot.own.votes.length, 0)
	assert.equal(c.snapshot.shared.matches.length, 0)
	s = await f.service.read(f.id, credential(f.a))
	assert.equal(s.own.pick.candidateId, null)
	await f.vote(c, card, "watch")
	assert.equal(
		(await f.service.read(f.id, credential(f.a))).shared.matches.length,
		1,
	)
})
for (const race of ["join", "undo", "replace"] as const)
	test(`Held final recheck loses CAS against ${race}; no stale automatic decision`, async () => {
		const f = await fixture()
		const cards = (await f.service.read(f.id, credential(f.a))).shared
			.candidates
		for (const c of cards) {
			await f.vote(f.a, c.id, "watch")
			await f.vote(f.b, c.id, "watch")
		}
		await f.pick(f.a, cards[0].id)
		let enter!: () => void
		let release!: () => void
		const entered = new Promise<void>((r) => (enter = r))
		const hold = new Promise<void>((r) => (release = r))
		const original = f.service.catalog.recheck
		let once = true
		f.service.catalog.recheck = async (room, candidate) => {
			if (once) {
				once = false
				enter()
				await hold
			}
			return original(room, candidate)
		}
		try {
			const pending = f.pick(f.b, cards[0].id)
			await entered
			if (race === "join")
				await f.service.join(f.id, {
					...admission("Late"),
					inviteCode: f.a.invite.code,
					screenId: "couch",
				})
			else if (race === "undo") await f.vote(f.a, cards[0].id, null)
			else await f.pick(f.a, cards[1].id)
			release()
			await pending
			const s = await f.service.read(f.id, credential(f.a))
			assert.equal(s.shared.phase, "choosing")
			assert.equal(s.shared.decision, null)
		} finally {
			f.service.catalog.recheck = original
		}
	})
test("Unknown final evidence preserves picks and retry repairs automatically; lost ack is idempotent", async () => {
	const f = await fixture()
	const card = (await f.service.read(f.id, credential(f.a))).shared
		.candidates[0].id
	await f.vote(f.a, card, "watch")
	await f.vote(f.b, card, "watch")
	await f.pick(f.a, card)
	const original = f.service.catalog.recheck
	f.service.catalog.recheck = async () => {
		throw new RoomError("catalog_unavailable", "Unknown", 503, true)
	}
	try {
		await f.pick(f.b, card)
		let s = await f.service.read(f.id, credential(f.a))
		assert.equal(s.shared.agreement.state, "unavailable")
		assert.equal(s.own.pick.candidateId, card)
		assert.equal(s.shared.decision, null)
		f.service.catalog.recheck = original
		f.repo.ambiguousNext = true
		const body: CommandEnvelope = {
			commandId: "lost_ack",
			sequence: s.own.nextSequence,
			command: {
				type: "retry_agreement",
				generation: s.shared.generation,
				expectedAgreementVersion: s.shared.agreement.version,
			},
		}
		const done = await f.service.command(f.id, credential(f.a), body)
		const replay = await f.service.command(f.id, credential(f.a), body)
		assert.equal(done.snapshot.shared.phase, "decided")
		assert.equal(replay.receipt.appliedRevision, done.receipt.appliedRevision)
		assert.equal(replay.receipt.replayed, true)
	} finally {
		f.service.catalog.recheck = original
	}
})
test("Durable checking marker repairs after notification acknowledged and process restarted", async () => {
	const f = await fixture()
	const card = (await f.service.read(f.id, credential(f.a))).shared
		.candidates[0].id
	await f.vote(f.a, card, "watch")
	await f.vote(f.b, card, "watch")
	await f.pick(f.a, card)
	const original = f.service.catalog.recheck
	f.service.catalog.recheck = async () => {
		throw new Error("Process interrupted")
	}
	await f.pick(f.b, card)
	f.service.catalog.recheck = original
	assert.equal((await f.repo.read(f.id))!.pendingRevision, 0)
	assert.equal(
		(await f.service.read(f.id, credential(f.a))).shared.agreement.state,
		"checking",
	)
	const restarted = new ContinuousService(
		f.repo,
		continuousFixtureCatalog,
		secret,
	)
	await restarted.repair()
	assert.equal(
		(await restarted.read(f.id, credential(f.a))).shared.phase,
		"decided",
	)
})
test("Refill retires only fully answered nonmatches, dedupes, and has no finish gate", async () => {
	const f = await fixture()
	let s = await f.service.read(f.id, credential(f.a))
	const cards = s.shared.candidates
	await f.vote(f.a, cards[0].id, "pass")
	await f.vote(f.b, cards[0].id, "watch")
	await f.vote(f.a, cards[1].id, "pass")
	await f.vote(f.b, cards[1].id, "pass")
	s = await f.service.read(f.id, credential(f.a))
	await f.send(f.a, {
		type: "refill",
		generation: s.shared.generation,
		expectedStreamVersion: s.shared.stream.version,
	})
	s = await f.service.read(f.id, credential(f.a))
	assert.equal(s.shared.phase, "choosing")
	assert.equal(s.shared.candidates.length, 1)
	assert.equal(s.shared.candidates[0].id, cards[1].id)
	assert.equal(s.shared.stream.state, "exhausted")
	assert.ok(
		!(cards[0].id in (await f.repo.read(f.id))!.room.participants[0].votes),
	)
	assert.equal((await f.repo.read(f.id))!.room.seenKeys.length, 2)
})
test("New HTTP namespace authenticates cookie/native/tickets, preserves browser identity, rejects legacy mutation", async () => {
	const repo = new ContinuousMemoryRepository()
	const service = new ContinuousService(repo, continuousFixtureCatalog, secret)
	const handler = createContinuousHandler(service, {
		serviceSecret: secret,
		allowedOrigins: ["http://127.0.0.1:8131"],
		secureCookies: false,
	})
	const origin = "http://127.0.0.1:8131"
	const post = (
		path: string,
		value: unknown,
		extra: Record<string, string> = {},
	) =>
		handler(
			new Request(`http://127.0.0.1:15994${path}`, {
				method: "POST",
				headers: { origin, "content-type": "application/json", ...extra },
				body: JSON.stringify(value),
			}),
		)
	const response = await post(paths.rooms, admission())
	assert.equal(response.status, 200)
	const created = (await response.json()) as GuestAdmission
	assert.equal(created.credential.token, "")
	const cookie = response.headers.get("set-cookie")!.split(";")[0]
	assert.ok(cookie.startsWith("yepwatch2_"))
	const join = await post(
		paths.join(created.credential.roomId),
		{ ...admission(), inviteCode: created.invite.code },
		{ cookie },
	)
	assert.equal(join.status, 200)
	const recovered = (await join.json()) as GuestAdmission
	assert.equal(recovered.recovered, true)
	assert.equal(recovered.snapshot.own.canHost, true)
	assert.equal(recovered.snapshot.shared.participants.length, 1)
	const ticket = await post(
		paths.realtimeTicket(created.credential.roomId),
		{},
		{ cookie },
	)
	const t = (await ticket.json()) as { ticket: string }
	const attach = await handler(
		new Request(`http://127.0.0.1:15994${paths.realtimeAttach}`, {
			method: "POST",
			headers: {
				authorization: `Bearer ${secret}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({
				roomId: created.credential.roomId,
				ticket: t.ticket,
			}),
		}),
	)
	assert.equal(attach.status, 200)
	const invalid = await post(
		paths.commands(created.credential.roomId),
		{
			commandId: "old",
			sequence: 1,
			command: { type: "complete_round", roundVersion: 1 },
		},
		{ cookie },
	)
	assert.equal(invalid.status, 400)
	assert.equal(
		(await post(paths.rooms, { ...admission(), contractVersion: 1 })).status,
		400,
	)
})
test("Concurrent own screen assignments share a stable context; host context edits still fence stale confirmation", async () => {
	const repo = new ContinuousMemoryRepository()
	const service = new ContinuousService(repo, continuousFixtureCatalog, secret)
	const a = await service.create(admission())
	const id = a.credential.roomId
	const b = await service.join(id, {
		...admission("B"),
		inviteCode: a.invite.code,
	})
	const c = await service.join(id, {
		...admission("C"),
		inviteCode: a.invite.code,
	})
	const send = async (who: GuestAdmission, command: RoomCommand) => {
		const s = await service.read(id, credential(who))
		return service.command(id, credential(who), {
			commandId: randomBytes(16).toString("hex"),
			sequence: s.own.nextSequence,
			command,
		})
	}
	await send(a, {
		type: "setup",
		expectedContextVersion: 1,
		screens: [
			{
				id: "couch",
				label: "TV",
				country: "DE",
				serviceIds: [1],
				confirmed: true,
			},
		],
		constraints: {
			kinds: ["movie", "show_start"],
			maxMinutes: null,
			moods: [],
		},
		screenId: "couch",
	})
	const context = (await service.read(id, credential(a))).shared.contextVersion
	await Promise.all([
		send(b, {
			type: "assign_screen",
			expectedContextVersion: context,
			screenId: "couch",
		}),
		send(c, {
			type: "assign_screen",
			expectedContextVersion: context,
			screenId: "couch",
		}),
	])
	await Promise.all([
		send(b, { type: "ready", expectedContextVersion: context, ready: true }),
		send(c, { type: "ready", expectedContextVersion: context, ready: true }),
	])
	let s = await service.read(id, credential(a))
	assert.equal(s.shared.contextVersion, context)
	assert.ok(
		s.shared.participants
			.filter((p) => p.participantId !== a.credential.participantId)
			.every((p) => p.ready),
	)
	await send(a, {
		type: "setup",
		expectedContextVersion: context,
		screens: s.shared.screens,
		constraints: s.shared.constraints,
		screenId: "couch",
	})
	const before = structuredClone((await repo.read(id))!.room)
	await assert.rejects(
		() =>
			send(b, { type: "ready", expectedContextVersion: context, ready: true }),
		(e: unknown) => e instanceof RoomError && e.code === "conflict",
	)
	assert.deepEqual((await repo.read(id))!.room, before)
})
test("Security revocation denies credentials and leases without shrinking required roster or finalizing", async () => {
	const f = await fixture()
	const card = (await f.service.read(f.id, credential(f.a))).shared
		.candidates[0].id
	await f.vote(f.a, card, "watch")
	await f.vote(f.b, card, "watch")
	await f.pick(f.a, card)
	const ticket = await f.service.ticket(f.id, credential(f.b))
	const lease = await f.service.attach(f.id, ticket.ticket)
	await f.service.revokeParticipant(f.id, f.b.credential.participantId)
	await assert.rejects(() => f.service.read(f.id, credential(f.b)))
	await assert.rejects(() => f.service.view(f.id, lease.lease))
	const s = await f.service.read(f.id, credential(f.a))
	assert.equal(s.shared.participants.length, 2)
	assert.equal(s.shared.phase, "choosing")
	assert.equal(s.shared.decision, null)
	assert.equal(s.shared.matches[0].pickCount, 1)
})
