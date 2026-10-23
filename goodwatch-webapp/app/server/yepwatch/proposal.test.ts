import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import type {
	GuestAdmission,
	RoomCommand,
	CommandEnvelope,
} from "../../../packages/yepwatch-contracts/proposal.ts"
import { paths } from "../../../packages/yepwatch-contracts/proposal.ts"
import { ProposalService } from "./proposal-service.server.ts"
import {
	ProposalMemoryRepository,
	proposalFixtureCatalog,
} from "./proposal-test-support.ts"
import { createProposalHandler } from "./proposal-http.server.ts"
import { RoomError } from "./errors.ts"
const secret = "continuous-tests-secret-at-least-thirty-two"
const admission = (nickname = "A") => ({
	contractVersion: 3 as const,
	commandId: randomBytes(16).toString("hex"),
	admissionSecret: randomBytes(32).toString("base64url"),
	nickname,
})
const credential = (a: GuestAdmission) => ({
	participantId: a.credential.participantId,
	token: a.credential.token,
})
async function fixture() {
	const repo = new ProposalMemoryRepository()
	const service = new ProposalService(repo, proposalFixtureCatalog, secret)
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
		value: "watch" | "pass" | null
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

	const propose = async (who: GuestAdmission, candidateId: string) => {
		const s = await service.read(id, credential(who))
		return send(who, {
			type: "propose",
			generation: s.shared.generation,
			expectedRosterVersion: s.shared.rosterVersion,
			expectedProposalVersion: s.shared.proposalVersion,
			candidateId,
		})
	}
	const agree = async (who: GuestAdmission, agreed = true) => {
		const s = await service.read(id, credential(who))
		return send(who, {
			type: "agree",
			generation: s.shared.generation,
			expectedRosterVersion: s.shared.rosterVersion,
			expectedProposalVersion: s.shared.proposalVersion,
			candidateId: s.shared.proposal!.candidateId,
			expectedOwnAgreementRevision: s.own.agreement.revision,
			agreed,
		})
	}
	return { repo, service, a, b, id, send, vote, propose, agree }
}

test("One shared proposal, anonymous counts, replacement clears approvals, explicit Agree automatically decides", async () => {
	const f = await fixture()
	const cards = (await f.service.read(f.id, credential(f.a))).shared.candidates
	for (const c of cards) {
		await f.vote(f.a, c.id, "watch")
		await f.vote(f.b, c.id, "watch")
	}
	let s = (await f.propose(f.a, cards[0].id)).snapshot
	assert.equal(s.shared.phase, "choosing")
	assert.equal(s.shared.proposal?.agreeCount, 1)
	assert.equal(s.own.agreement.isProposer, true)
	s = (await f.propose(f.b, cards[1].id)).snapshot
	assert.equal(s.shared.proposal?.previousCandidateId, cards[0].id)
	assert.equal(s.shared.proposal?.agreeCount, 1)
	assert.equal(
		(await f.service.read(f.id, credential(f.a))).own.agreement.agreed,
		false
	)
	s = (await f.agree(f.a)).snapshot
	assert.equal(s.shared.phase, "decided")
	assert.equal(s.shared.decision?.proposalVersion, s.shared.proposalVersion)
	const wire = JSON.stringify(s.shared)
	for (const key of [
		"proposerId",
		"baseParticipantIds",
		"approvedProposalVersion",
		"activeExposureMs",
		"timingSource",
		"isProposer",
		"votes",
		"pickCount",
	])
		assert.ok(!wire.includes(key), key)
})
test("Late join preserves proposal and approvals; missing/implied time unavailable; full roster required", async () => {
	const f = await fixture()
	const card = (await f.service.read(f.id, credential(f.a))).shared
		.candidates[0].id
	for (const [who, ms] of [
		[f.a, 1000],
		[f.b, 3000],
	] as const) {
		const s = await f.service.read(f.id, credential(who))
		await f.send(who, {
			type: "vote",
			generation: s.shared.generation,
			candidateId: card,
			expectedVoteRevision: 0,
			value: "watch",
			activeExposureMs: ms,
		})
	}
	let s = (await f.propose(f.a, card)).snapshot
	assert.equal(s.shared.matches[0].averageYepMs, 2000)
	const c = await f.service.join(f.id, {
		...admission("Late"),
		inviteCode: f.a.invite.code,
		screenId: "couch",
	})
	s = c.snapshot
	assert.equal(s.shared.matches.length, 0)
	assert.equal(s.shared.proposal?.averageYepMs, null)
	assert.equal(s.shared.proposal?.requiredCount, 3)
	assert.equal(s.shared.proposal?.agreeCount, 1)
	assert.deepEqual(s.own.votes, [])
	await f.agree(f.b)
	assert.equal(
		(await f.service.read(f.id, credential(f.a))).shared.phase,
		"choosing"
	)
	s = (await f.agree(c)).snapshot
	assert.equal(s.shared.phase, "decided")
	assert.equal(s.shared.proposal?.averageYepMs, null)
	assert.equal(s.own.votes[0].timingSource, "implied")
	assert.equal(s.own.votes[0].activeExposureMs, null)
})
for (const value of ["pass", null] as const)
	test(`Proposal invalidates on private ${value}; no approvals carry over`, async () => {
		const f = await fixture()
		const id = (await f.service.read(f.id, credential(f.a))).shared
			.candidates[0].id
		await f.vote(f.a, id, "watch")
		await f.vote(f.b, id, "watch")
		const old = (await f.propose(f.a, id)).snapshot.shared.proposalVersion
		const s = (await f.vote(f.b, id, value)).snapshot
		assert.equal(s.shared.proposal, null)
		assert.ok(s.shared.proposalVersion > old)
		assert.equal(s.own.agreement.agreed, false)
	})
for (const race of ["join", "undo", "replace", "withdraw"] as const)
	test(`Held fresh check loses safely to ${race}`, async () => {
		const f = await fixture()
		const cards = (await f.service.read(f.id, credential(f.a))).shared
			.candidates
		for (const card of cards) {
			await f.vote(f.a, card.id, "watch")
			await f.vote(f.b, card.id, "watch")
		}
		await f.propose(f.a, cards[0].id)
		let release!: () => void
		let entered!: () => void
		const held = new Promise<void>((r) => (release = r))
		const reached = new Promise<void>((r) => (entered = r))
		let once = true
		const base = f.service.catalog.recheck
		f.service.catalog.recheck = async (room, c) => {
			if (once) {
				once = false
				entered()
				await held
			}
			return base(room, c)
		}
		const check = f.agree(f.b)
		await reached
		if (race === "join")
			await f.service.join(f.id, {
				...admission("Late"),
				inviteCode: f.a.invite.code,
				screenId: "couch",
			})
		if (race === "undo") await f.vote(f.a, cards[0].id, null)
		if (race === "replace") await f.propose(f.a, cards[1].id)
		if (race === "withdraw") await f.agree(f.a, false)
		release()
		await check
		const s = await f.service.read(f.id, credential(f.a))
		assert.equal(s.shared.phase, "choosing")
		assert.equal(s.shared.decision, null)
	})
test("Lost command acknowledgement replays exactly once and browsing does not withdraw", async () => {
	const f = await fixture()
	const id = (await f.service.read(f.id, credential(f.a))).shared.candidates[0]
		.id
	await f.vote(f.a, id, "watch")
	await f.vote(f.b, id, "watch")
	const s = await f.service.read(f.id, credential(f.a))
	const e: CommandEnvelope = {
		commandId: "lost-ack-proposal",
		sequence: s.own.nextSequence,
		command: {
			type: "propose",
			candidateId: id,
			generation: s.shared.generation,
			expectedRosterVersion: s.shared.rosterVersion,
			expectedProposalVersion: s.shared.proposalVersion,
		},
	}
	f.repo.ambiguousNext = true
	const first = await f.service.command(f.id, credential(f.a), e)
	const again = await f.service.command(f.id, credential(f.a), e)
	assert.equal(
		first.snapshot.shared.proposalVersion,
		again.snapshot.shared.proposalVersion
	)
	assert.equal(again.receipt.replayed, true)
	assert.equal(
		(await f.service.read(f.id, credential(f.a))).own.agreement.agreed,
		true
	)
})
test("HTTP contract3 guest admission/setup uses separate paths and candidate duration remains truthful", async () => {
	const repo = new ProposalMemoryRepository()
	const handler = createProposalHandler(
		new ProposalService(repo, proposalFixtureCatalog, secret),
		{
			serviceSecret: secret,
			allowedOrigins: ["http://127.0.0.1:8133"],
			secureCookies: false,
		}
	)
	const response = await handler(
		new Request(`http://127.0.0.1:15992${paths.rooms}`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin: "http://127.0.0.1:8133",
			},
			body: JSON.stringify(admission()),
		})
	)
	assert.equal(response.status, 200)
	assert.ok(response.headers.get("set-cookie")?.startsWith("yepwatch3_"))
	const a = await response.json()
	assert.equal(a.snapshot.shared.contractVersion, 3)
	assert.equal(a.credential.token, "")
})

test("Unknown fresh offers retain explicit proposal; exact versioned retry can finish later", async () => {
	const f = await fixture()
	const id = (await f.service.read(f.id, credential(f.a))).shared.candidates[0]
		.id
	await f.vote(f.a, id, "watch")
	await f.vote(f.b, id, "watch")
	await f.propose(f.a, id)
	const base = f.service.catalog.recheck
	f.service.catalog.recheck = async () => {
		throw new RoomError(
			"catalog_unavailable",
			"Current offer status unknown",
			503,
			true
		)
	}
	let s = (await f.agree(f.b)).snapshot
	assert.equal(s.shared.phase, "choosing")
	assert.equal(s.shared.proposal?.agreeCount, 2)
	assert.equal(s.shared.agreement.state, "unavailable")
	assert.equal(s.shared.decision, null)
	f.service.catalog.recheck = base
	s = (
		await f.send(f.a, {
			type: "retry_agreement",
			generation: s.shared.generation,
			expectedAgreementVersion: s.shared.agreement.version,
			expectedProposalVersion: s.shared.proposalVersion,
		})
	).snapshot
	assert.equal(s.shared.phase, "decided")
})
test("Active exposure bounds and missing data remain honest; no direction or individual timing in shared state", async () => {
	const f = await fixture()
	const s = await f.service.read(f.id, credential(f.a))
	const id = s.shared.candidates[0].id
	await assert.rejects(
		() =>
			f.send(f.a, {
				type: "vote",
				generation: s.shared.generation,
				candidateId: id,
				expectedVoteRevision: 0,
				value: "watch",
				activeExposureMs: 1200001,
			}),
		{ code: "invalid_request" }
	)
	assert.equal(
		(await f.service.read(f.id, credential(f.a))).own.nextSequence,
		s.own.nextSequence
	)
	await f.send(f.a, {
		type: "vote",
		generation: s.shared.generation,
		candidateId: id,
		expectedVoteRevision: 0,
		value: "watch",
		activeExposureMs: 0,
	})
	const result = await f.vote(f.b, id, "watch")
	assert.equal(result.snapshot.shared.matches[0].averageYepMs, null)
	assert.ok(
		!JSON.stringify(result.snapshot.shared).includes("activeExposureMs")
	)
	const measured = await f.send(f.b, {
		type: "vote",
		generation: s.shared.generation,
		candidateId: id,
		expectedVoteRevision: 1,
		value: "watch",
		activeExposureMs: 1200000,
	})
	assert.equal(measured.snapshot.shared.matches[0].averageYepMs, 600000)
})

test("short invitations: typed keys, normalized input, exact replay, legacy recovery and room binding", async () => {
	const repo = new ProposalMemoryRepository()
	const service = new ProposalService(repo, proposalFixtureCatalog, secret)
	const req = admission("Short host")
	const a = await service.create(req)
	assert.match(a.invite.code, /^[2-9A-HJKMNP-Z]{6}$/)
	assert.equal(a.invite.path, `/r/${a.invite.code}`)
	assert.equal((await service.create(req)).invite.code, a.invite.code)
	assert.equal(
		(await service.recoverAdmission(a.credential.roomId, credential(a))).invite
			.code,
		a.invite.code
	)
	const grouped = a.invite.code.match(/.{3}/g)!.join("-").toLowerCase()
	assert.equal(
		(await service.resolveInvite(grouped)).roomId,
		a.credential.roomId
	)
	const joined = await service.join(a.credential.roomId, {
		...admission("Guest"),
		inviteCode: grouped,
	})
	assert.equal(joined.invite.code, a.invite.code)
	const other = await service.create(admission("Other"))
	await assert.rejects(
		service.join(other.credential.roomId, {
			...admission(),
			inviteCode: a.invite.code,
		}),
		(e: any) => e.code === "not_found"
	)
	await assert.rejects(
		service.resolveInvite("0000000000000000"),
		(e: any) => e.code === "not_found"
	)
	const { hash, keyed } = await import("./crypto.server.ts")
	const row = repo.rows.get(a.credential.roomId)!
	const legacy = `${row.room.id}.${keyed(
		secret,
		"proposal-invite",
		row.room.id
	)}`
	row.room.inviteHash = hash(legacy)
	assert.equal((await service.create(req)).invite.code, legacy)
	assert.equal(
		(await service.recoverAdmission(row.room.id, credential(a))).invite.code,
		legacy
	)
	assert.equal((await service.resolveInvite(legacy)).roomId, row.room.id)
	await assert.rejects(
		service.resolveInvite(a.invite.code),
		(e: any) => e.code === "not_found"
	)
	row.room.expiresAt = 0
	await assert.rejects(
		service.resolveInvite(legacy),
		(e: any) => e.code === "expired"
	)
})

test("six-character reservation retries collisions without stealing another room; preserves sixteen-character rooms", async () => {
	const { hash, keyed } = await import("./crypto.server.ts")
	const { shortInvite, previousInvite } = await import("./proposal-invites.ts")
	const repo = new ProposalMemoryRepository(),
		service = new ProposalService(repo, proposalFixtureCatalog, secret)
	const req = admission("Collision host")
	const id = keyed(
		secret,
		"proposal-room",
		JSON.stringify([req.commandId, req.admissionSecret])
	).slice(0, 32)
	const occupied = shortInvite(secret, id)
	await repo.rememberInvite(hash(occupied), "existing-other-room", 1234)
	const [a, replay] = await Promise.all([
		service.create(req),
		service.create(req),
	])
	assert.equal(a.invite.code, shortInvite(secret, id, 1))
	assert.equal(replay.invite.code, a.invite.code)
	assert.equal(await repo.findInvite(hash(occupied)), "existing-other-room")
	assert.equal((await service.resolveInvite(a.invite.code)).roomId, id)
	const old = previousInvite(secret, id)
	repo.rows.get(id)!.room.inviteHash = hash(old)
	assert.equal(
		(await service.recoverAdmission(id, credential(a))).invite.code,
		old
	)
	assert.equal((await service.resolveInvite(old)).roomId, id)
})

test("Leave removes a required voter, transfers host, and exact retry recovers the departure", async () => {
	const f = await fixture()
	const card = (await f.service.read(f.id, credential(f.a))).shared
		.candidates[0]
	await f.vote(f.b, card.id, "watch")
	assert.equal(
		(await f.service.read(f.id, credential(f.b))).shared.matches.length,
		0
	)
	const before = await f.service.read(f.id, credential(f.a))
	const leave: CommandEnvelope = {
		commandId: "leave-host",
		sequence: before.own.nextSequence,
		command: { type: "leave" },
	}
	const first = await f.service.command(f.id, credential(f.a), leave)
	assert.equal(first.snapshot.own.left, true)
	assert.equal(
		(await f.service.read(f.id, credential(f.b))).shared.hostParticipantId,
		f.b.credential.participantId
	)
	assert.equal(first.snapshot.shared.participants.length, 0)
	assert.equal(
		(await f.service.read(f.id, credential(f.b))).shared.matches[0].candidateId,
		card.id
	)
	const retry = await f.service.command(f.id, credential(f.a), leave)
	assert.equal(retry.receipt.replayed, true)
	assert.equal(
		retry.snapshot.shared.rosterVersion,
		first.snapshot.shared.rosterVersion
	)
	await assert.rejects(f.service.read(f.id, credential(f.a)), /left this room/)
	await assert.rejects(
		f.service.ticket(f.id, credential(f.a)),
		/left this room/
	)
	await f.propose(f.b, card.id)
	assert.equal(
		(await f.service.read(f.id, credential(f.b))).shared.phase,
		"decided"
	)
	const recovered = await f.service.command(f.id, credential(f.a), leave)
	assert.equal(recovered.snapshot.own.left, true)
	assert.deepEqual(recovered.snapshot.shared.participants, [])
	assert.deepEqual(recovered.snapshot.shared.candidates, [])
	assert.equal(recovered.snapshot.shared.decision, null)
	assert.equal(recovered.snapshot.shared.description, null)
})

test("Room prompt is interpreted before publication and retained across start, refill and restart", async () => {
	const repo = new ProposalMemoryRepository()
	let interpreted = 0
	const service = new ProposalService(
		repo,
		proposalFixtureCatalog,
		secret,
		undefined,
		Date.now,
		undefined,
		async (prompt) => {
			interpreted++
			return {
				prompt,
				attributes: [{ text: "Funny", kind: "want", key: "humor" }],
				rankedKeys: [1000000000001],
				interpretedAt: 123,
			}
		}
	)
	const a = await service.create(admission())
	const id = a.credential.roomId
	const configured = await service.command(id, credential(a), {
		commandId: "describe",
		sequence: 1,
		command: {
			type: "configure",
			expectedContextVersion: 1,
			country: "DE",
			serviceIds: [1],
			constraints: { kinds: ["movie"], moods: [], maxMinutes: null },
			prompt: "Something funny",
		},
	})
	assert.equal(interpreted, 1)
	assert.equal(
		configured.snapshot.shared.description?.prompt,
		"Something funny"
	)
	assert.equal(configured.snapshot.shared.screens.length, 1)
	assert.equal(configured.snapshot.shared.participants[0].ready, true)
	await service.command(id, credential(a), {
		commandId: "describe",
		sequence: 1,
		command: {
			type: "configure",
			expectedContextVersion: 1,
			country: "DE",
			serviceIds: [1],
			constraints: { kinds: ["movie"], moods: [], maxMinutes: null },
			prompt: "Something funny",
		},
	})
	assert.equal(interpreted, 1, "committed retry never calls search again")
	async function send(command: RoomCommand) {
		const current = await service.read(id, credential(a))
		return service.command(id, credential(a), {
			commandId: randomBytes(12).toString("hex"),
			sequence: current.own.nextSequence,
			command,
		})
	}
	const ready = configured.snapshot.shared
	await send({
		type: "start",
		expectedContextVersion: ready.contextVersion,
		expectedRosterVersion: ready.rosterVersion,
		hostReady: true,
	})
	let current = await service.read(id, credential(a))
	await send({
		type: "refill",
		generation: current.shared.generation,
		expectedStreamVersion: current.shared.stream.version,
	})
	current = await service.read(id, credential(a))
	await send({ type: "restart", expectedRevision: current.shared.revision })
	assert.deepEqual(
		(await service.read(id, credential(a))).shared.description,
		configured.snapshot.shared.description
	)
	assert.equal(interpreted, 1)
})

test("Dropping out preserves cards and answers; repeated return restores the same identity and host if empty", async () => {
	const f = await fixture()
	const initial = await f.service.read(f.id, credential(f.a))
	const card = initial.shared.candidates[0]
	await f.vote(f.a, card.id, "pass")
	for (const who of [f.a, f.b]) {
		const current = await f.service.read(f.id, credential(who))
		await f.service.command(f.id, credential(who), {
			commandId: randomBytes(12).toString("hex"),
			sequence: current.own.nextSequence,
			command: { type: "leave" },
		})
	}
	const empty = (await f.repo.read(f.id))!.room
	assert.equal(empty.phase, "choosing")
	assert.equal(empty.proposal, null)
	assert.deepEqual(empty.candidates, initial.shared.candidates)
	const back = await f.service.resumeOrJoin(f.id, credential(f.a), {
		...admission("Returning"),
		inviteCode: f.a.invite.code,
	})
	assert.equal(back.credential.participantId, f.a.credential.participantId)
	assert.equal(back.credential.token, f.a.credential.token)
	assert.equal(
		back.snapshot.own.votes.find((v) => v.candidateId === card.id)?.value,
		"pass"
	)
	assert.equal(
		back.snapshot.shared.participants.find(
			(p) => p.participantId === f.b.credential.participantId
		)?.dropped,
		true
	)
	assert.equal(back.snapshot.shared.participants.length, 2)
	assert.equal(back.snapshot.own.canHost, true)
	const replay = await f.service.resumeOrJoin(f.id, credential(f.a), {
		...admission("Ignored"),
		inviteCode: f.a.invite.code,
	})
	assert.equal(replay.snapshot.shared.revision, back.snapshot.shared.revision)
	assert.equal(replay.snapshot.shared.participants.length, 2)
})

test("Dropped participants do not veto matches or block decisions; returning restores the place without reopening Done", async () => {
	const f = await fixture()
	const card = (await f.service.read(f.id, credential(f.a))).shared
		.candidates[0]
	await f.vote(f.a, card.id, "pass")
	await f.vote(f.b, card.id, "watch")
	const before = await f.service.read(f.id, credential(f.a))
	await f.service.command(f.id, credential(f.a), {
		commandId: "drop",
		sequence: before.own.nextSequence,
		command: { type: "leave" },
	})
	const active = await f.service.read(f.id, credential(f.b))
	assert.equal(active.shared.participants.length, 2)
	assert.equal(
		active.shared.participants.find(
			(p) => p.participantId === f.a.credential.participantId
		)?.dropped,
		true
	)
	assert.equal(active.shared.matches[0].candidateId, card.id)
	await f.propose(f.b, card.id)
	const decided = await f.service.read(f.id, credential(f.b))
	assert.equal(decided.shared.phase, "decided")
	const back = await f.service.resumeOrJoin(f.id, credential(f.a), {
		...admission(),
		inviteCode: f.a.invite.code,
	})
	assert.equal(back.credential.participantId, f.a.credential.participantId)
	assert.equal(
		back.snapshot.shared.participants.find(
			(p) => p.participantId === f.a.credential.participantId
		)?.dropped,
		false
	)
	assert.deepEqual(back.snapshot.shared.decision, decided.shared.decision)
	assert.equal(back.snapshot.shared.phase, "decided")
	assert.equal(
		back.snapshot.own.votes.find((v) => v.candidateId === card.id)?.value,
		"pass"
	)
})
test("Returning before decision counts again, keeps answers and does not allocate another place", async () => {
	const f = await fixture()
	const card = (await f.service.read(f.id, credential(f.a))).shared
		.candidates[0]
	await f.vote(f.a, card.id, "pass")
	await f.vote(f.b, card.id, "watch")
	const before = await f.service.read(f.id, credential(f.a))
	await f.service.command(f.id, credential(f.a), {
		commandId: "drop",
		sequence: before.own.nextSequence,
		command: { type: "leave" },
	})
	assert.equal(
		(await f.service.read(f.id, credential(f.b))).shared.matches.length,
		1
	)
	const back = await f.service.resumeOrJoin(f.id, credential(f.a), {
		...admission(),
		inviteCode: f.a.invite.code,
	})
	assert.equal(back.snapshot.shared.matches.length, 0)
	assert.equal(back.snapshot.shared.participants.length, 2)
	assert.equal(back.snapshot.own.left, false)
})

test("Native authenticated rejoin restores the retained place through the HTTP route", async () => {
	const f = await fixture()
	const before = await f.service.read(f.id, credential(f.a))
	await f.service.command(f.id, credential(f.a), {
		commandId: "drop",
		sequence: before.own.nextSequence,
		command: { type: "leave" },
	})
	const handler = createProposalHandler(f.service, {
		serviceSecret: secret,
		allowedOrigins: ["http://127.0.0.1:8133"],
		secureCookies: false,
	})
	const response = await handler(
		new Request(`http://127.0.0.1:15992${paths.join(f.id)}`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-yepwatch-client": "native",
				authorization: `Bearer ${f.a.credential.token}`,
				"x-yepwatch-participant": f.a.credential.participantId,
			},
			body: JSON.stringify({
				...admission("Ignored"),
				inviteCode: f.a.invite.code,
			}),
		})
	)
	assert.equal(response.status, 200)
	const back = await response.json()
	assert.equal(back.credential.participantId, f.a.credential.participantId)
	assert.equal(back.credential.token, f.a.credential.token)
	assert.equal(back.snapshot.own.left, false)
	assert.equal(back.snapshot.shared.participants.length, 2)
})

test("Shared provider defaults union active linked accounts without changing the chosen room services", async () => {
	const f = await fixture()
	const old = (await f.repo.read(f.id))!
	const room = structuredClone(old.room)
	room.participants[0].member = {
		state: "linked",
		prefill: {
			country: "DE",
			serviceIds: [8, 337],
			savedProgressAvailable: false,
		},
	}
	room.participants[1].member = {
		state: "linked",
		prefill: {
			country: "US",
			serviceIds: [8, 9],
			savedProgressAvailable: false,
		},
	}
	room.revision++
	assert.equal(await f.repo.compareAndSwap(old, room, true), true)
	const shared = (await f.service.read(f.id, credential(f.a))).shared
	assert.deepEqual(shared.savedServiceIds, [8, 9, 337])
	assert.deepEqual(shared.screens[0].serviceIds, [1])
	const b = await f.service.read(f.id, credential(f.b))
	await f.service.command(f.id, credential(f.b), {
		commandId: "drop-saved-provider",
		sequence: b.own.nextSequence,
		command: { type: "leave" },
	})
	const after = await f.service.read(f.id, credential(f.a))
	assert.deepEqual(after.shared.savedServiceIds, [8, 337])
	assert.deepEqual(after.shared.screens[0].serviceIds, [1])
})
