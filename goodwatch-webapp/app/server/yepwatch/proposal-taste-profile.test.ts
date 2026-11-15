import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import {
	TasteProfiles,
	ProfileConflict,
	SqlProfileStore,
	PROFILE_RETENTION_MS,
	FOLLOWUP_MIN_MS,
	FOLLOWUP_MAX_MS,
} from "./proposal-taste-profile.ts"
import {
	MemoryProfileStore,
	tasteFixture,
	tasteDisplays,
	key,
} from "./proposal-taste-test-support.ts"
import { ProposalService } from "./proposal-service.server.ts"
import {
	ProposalMemoryRepository,
	proposalFixtureCatalog,
} from "./proposal-test-support.ts"
import { createProposalHandler } from "./proposal-http.server.ts"
import {
	paths,
	PROFILE_HEADER,
} from "../../../packages/yepwatch-contracts/proposal.ts"
import { deckInputs, deckBase } from "./proposal-prepared-decks.ts"
const secret = "test-profile-secret-at-least-32-bytes"
function fixture() {
	let now = 1800000000000
	const store = new MemoryProfileStore(),
		snapshot = tasteFixture()
	const profiles = new TasteProfiles(
		store,
		secret,
		() => snapshot,
		tasteDisplays,
		() => now
	)
	const device = randomBytes(32).toString("base64url"),
		id = profiles.identity(device)
	return {
		profiles,
		store,
		id,
		device,
		now: () => now,
		advance: (ms: number) => {
			now += ms
		},
	}
}
const request = () => ({
	contractVersion: 3 as const,
	commandId: randomBytes(16).toString("hex"),
	admissionSecret: randomBytes(32).toString("base64url"),
	nickname: "Mia",
})
test("Identity is canonical HMAC, counts, undo, retry idempotence and stale revisions", async () => {
	const f = fixture(),
		p = f.profiles
	assert.equal(p.identity(f.device), f.id)
	assert.notEqual(f.id, f.device)
	assert.throws(() => p.identity("short"))
	assert.throws(() => p.identity("_".repeat(43)))
	assert.equal((await p.summary(f.id)).answered, 0)
	const body = {
		revision: 0,
		items: [{ key: key(1), answer: "loved" as const, at: f.now() }],
	}
	assert.deepEqual(await p.answers(f.id, body), { revision: 1, answered: 1 })
	assert.deepEqual(await p.answers(f.id, body), { revision: 1, answered: 1 })
	await assert.rejects(
		p.answers(f.id, {
			revision: 0,
			items: [{ key: key(5), answer: "not_for_me", at: f.now() }],
		}),
		ProfileConflict
	)
	await p.answers(f.id, {
		revision: 1,
		items: [{ key: key(1), answer: null, at: f.now() + 1 }],
	})
	assert.equal((await p.summary(f.id)).answered, 0)
	await p.answers(f.id, body) // old delivery never resurrects an undo
	assert.equal((await p.summary(f.id)).answered, 0)
	assert.equal(
		f.store.rows.get(f.id)!.profile.expires_at,
		f.now() + PROFILE_RETENTION_MS
	)
	assert.ok(!JSON.stringify(f.store.rows.get(f.id)).includes("Mia"))
})
test("500 latest answers, persistent 120-write budget, delete and expiry", async () => {
	const f = fixture(),
		p = f.profiles
	let revision = 0
	for (let batch = 0; batch < 11; batch++) {
		const result = await p.answers(f.id, {
			revision,
			items: Array.from({ length: 50 }, (_, i) => ({
				key: key(batch * 50 + i + 1),
				answer: "unseen",
				at: f.now() + batch,
			})),
		})
		revision = result.revision
	}
	const row = f.store.rows.get(f.id)!.profile
	assert.equal(row.answers.items.length, 500)
	assert.ok(!row.answers.items.some((a) => a.key === key(1)))
	const restarted = new TasteProfiles(
		f.store,
		secret,
		() => tasteFixture(),
		tasteDisplays,
		f.now
	)
	for (let n = 11; n < 120; n++)
		revision = (
			await restarted.answers(f.id, {
				revision,
				items: [
					{
						key: key(1),
						answer: n % 2 ? "loved" : "not_for_me",
						at: f.now() + n,
					},
				],
			})
		).revision
	await assert.rejects(
		restarted.answers(f.id, {
			revision,
			items: [{ key: key(1), answer: "unseen", at: f.now() + 121 }],
		}),
		(e) => (e as { status: number }).status === 429
	)
	f.advance(3600000)
	await restarted.answers(f.id, {
		revision,
		items: [{ key: key(1), answer: "unseen", at: f.now() }],
	})
	await restarted.delete(f.id)
	assert.equal(f.store.rows.has(f.id), false)
	assert.equal((await restarted.signal(f.id)).vector, null)
	await p.touch(f.id)
	f.advance(PROFILE_RETENTION_MS)
	assert.equal((await p.summary(f.id)).answered, 0)
	await p.expire()
	assert.equal(f.store.rows.has(f.id), false)
})
test("CAS conflicts across processes cannot lose an answer", async () => {
	const f = fixture()
	const other = new TasteProfiles(
		f.store,
		secret,
		() => tasteFixture(),
		tasteDisplays,
		f.now
	)
	const results = await Promise.allSettled(
		[f.profiles, other].map((p, i) =>
			p.answers(f.id, {
				revision: 0,
				items: [{ key: key(1 + i * 4), answer: "loved", at: f.now() }],
			})
		)
	)
	assert.equal(results.filter((r) => r.status === "fulfilled").length, 1)
	assert.equal(results.filter((r) => r.status === "rejected").length, 1)
	assert.equal((await f.profiles.summary(f.id)).answered, 1)
})
test("Follow-ups include members, are idempotent, obey 10h–7d, feed only YepWatch, dismiss and delete stay empty", async () => {
	const f = fixture(),
		repo = new ProposalMemoryRepository(),
		service = new ProposalService(repo, proposalFixtureCatalog, secret)
	const admission = await service.create(request())
	const room = (await repo.read(admission.credential.roomId))!.room
	const otherDevice = randomBytes(32).toString("base64url"),
		memberId = f.profiles.identity(otherDevice)
	room.participants[0].profileId = f.id
	room.participants.push({
		...structuredClone(room.participants[0]),
		id: "member",
		profileId: memberId,
		memberUserId: "goodwatch-account",
	})
	room.candidates = [
		{
			id: "picked",
			identity: { kind: "movie", tmdbId: 1 },
			title: "Picked",
			year: 2020,
			overview: null,
			posterUrl: null,
			runtimeMinutes: 100,
			viewingDuration: { minutes: 100, scope: "movie" },
			availability: [],
		},
	]
	room.decision = {
		candidateId: "picked",
		decidedAt: f.now(),
		agreementVersion: 1,
		availability: [],
	}
	await f.profiles.touch(f.id)
	await f.profiles.touch(memberId)
	await f.profiles.recordDecision(room)
	await f.profiles.recordDecision(room)
	assert.equal(f.store.rows.get(f.id)!.profile.followups.length, 1)
	assert.equal(f.store.rows.get(memberId)!.profile.followups.length, 1)
	assert.equal((await f.profiles.summary(f.id)).revision, 0, "decisions do not change taste revision")
	assert.equal((await f.profiles.summary(f.id)).followups.length, 0)
	const decidedAt = f.now()
	f.advance(FOLLOWUP_MIN_MS)
	assert.equal((await f.profiles.summary(f.id)).followups.length, 1)
	const s = await f.profiles.summary(f.id)
	await f.profiles.answers(f.id, {
		revision: s.revision,
		items: [
			{
				key: key(1),
				answer: "loved",
				source: "followup",
				decidedAt,
				at: f.now(),
			},
		],
	})
	assert.equal((await f.profiles.summary(f.id)).followups.length, 0)
	assert.ok((await f.profiles.signal(f.id)).seen.has(key(1)))
	const m = await f.profiles.summary(memberId)
	await f.profiles.answers(memberId, {
		revision: m.revision,
		items: [
			{
				key: key(1),
				answer: "did_not_watch",
				source: "followup",
				decidedAt,
				at: f.now(),
			},
		],
	})
	assert.equal(f.store.rows.get(memberId)!.profile.answers.items.length, 0)
	assert.equal((await f.profiles.summary(memberId)).followups.length, 0)
	const memberRevision = (await f.profiles.summary(memberId)).revision
	await f.profiles.answers(memberId, {
		revision: memberRevision,
		items: [
			{
				key: key(1),
				answer: "loved",
				source: "followup",
				decidedAt,
				at: f.now() + 1,
			},
		],
	})
	assert.equal((await f.profiles.signal(memberId)).seen.has(key(1)), true)
	assert.equal((await f.profiles.summary(memberId)).loved, 1)
	await f.profiles.delete(f.id)
	await f.profiles.recordDecision(room)
	assert.equal(f.store.rows.has(f.id), false)
	f.advance(FOLLOWUP_MAX_MS - FOLLOWUP_MIN_MS)
	assert.equal((await f.profiles.summary(memberId)).followups.length, 0)
	await assert.rejects(
		f.profiles.answers(memberId, {
			revision: 2,
			items: [
				{
					key: key(1),
					answer: "loved",
					source: "followup",
					decidedAt,
					at: f.now(),
				},
			],
		})
	)
})
test("HTTP contract: private profiles, admission binding, deck, conflict body, CORS and DELETE", async () => {
	const f = fixture(),
		repo = new ProposalMemoryRepository()
	const service = new ProposalService(
		repo,
		proposalFixtureCatalog,
		secret,
		undefined,
		f.now,
		undefined,
		undefined,
		{ profiles: f.profiles }
	)
	const handler = createProposalHandler(service, {
		serviceSecret: secret,
		allowedOrigins: ["https://yepwatch.test"],
	})
	const headers = {
		[PROFILE_HEADER]: f.device,
		"x-yepwatch-client": "native",
		"content-type": "application/json",
	}
	const call = (path: string, method = "GET", body?: unknown) =>
		handler(
			new Request(`https://api.test${path}`, {
				method,
				headers,
				...(body ? { body: JSON.stringify(body) } : {}),
			})
		)
	assert.equal(
		(await handler(new Request(`https://api.test${paths.profile}`))).status,
		401
	)
	const admissionResponse = await call(paths.rooms, "POST", request())
	assert.equal(admissionResponse.status, 200)
	const admission = await admissionResponse.json()
	// Linking follows the response and completes independently.
	await new Promise(resolve => setImmediate(resolve))
	const room = (await repo.read(admission.credential.roomId))!.room
	assert.equal(room.participants[0].profileId, f.id)
	assert.ok(!JSON.stringify(admission).includes(f.id))
	assert.ok(!JSON.stringify(admission).includes("tasteRevision"))
	const before = deckInputs(room)
	const result = await call(paths.profileAnswers, "POST", {
		revision: 0,
		items: [{ key: key(1), answer: "loved", at: f.now() }],
	})
	assert.equal(result.status, 200)
	await service.prepareProfiles(room)
	assert.notEqual(deckInputs(room), before)
	const conflict = await call(paths.profileAnswers, "POST", {
		revision: 0,
		items: [{ key: key(5), answer: "loved", at: f.now() }],
	})
	assert.equal(conflict.status, 409)
	assert.equal((await conflict.json()).profile.revision, 1)
	assert.equal(
		(await (await call(paths.profileTasteDeck + "?count=10")).json()).cards
			.length,
		10
	)
	const options = await handler(
		new Request(`https://api.test${paths.profile}`, {
			method: "OPTIONS",
			headers: { origin: "https://yepwatch.test" },
		})
	)
	assert.match(
		options.headers.get("access-control-allow-headers")!,
		/x-yepwatch-profile/
	)
	assert.match(options.headers.get("access-control-allow-methods")!, /DELETE/)
	assert.equal((await call(paths.profile, "DELETE")).status, 204)
	const readRoom = () => handler(new Request(`https://api.test${paths.rooms}/${admission.credential.roomId}`, {
		headers: { ...headers, authorization: `Bearer ${admission.credential.token}`, "x-yepwatch-participant": admission.credential.participantId },
	}))
	assert.equal((await readRoom()).status, 200)
	assert.equal(f.store.rows.has(f.id), false, "room GET must not recreate a deleted profile")
	assert.equal((await (await call(paths.profile)).json()).answered, 0)
	assert.equal((await call(paths.profileTasteDeck + "?count=11")).status, 400)
})
test("A profile answer rebuilds only its own setup rooms; delete changes the prepared inputs", async () => {
	const f = fixture(),
		repo = new ProposalMemoryRepository()
	const builds: string[] = []
	const catalog = {
		...proposalFixtureCatalog,
		async page(room: Parameters<typeof proposalFixtureCatalog.page>[0]) {
			builds.push(room.id)
			return proposalFixtureCatalog.page(room)
		},
	}
	const service = new ProposalService(
		repo,
		catalog,
		secret,
		undefined,
		f.now,
		undefined,
		undefined,
		{ profiles: f.profiles, decks: { delayMs: 1 } }
	)
	const a = await service.create({ ...request(), setup: { country: "DE" } })
	const b = await service.create({ ...request(), setup: { country: "DE" } })
	const credential = {
		participantId: a.credential.participantId,
		token: a.credential.token,
	}
	await service.bindProfile(a.credential.roomId, credential, f.id)
	for (const admission of [a, b]) {
		await service.command(
			admission.credential.roomId,
			{
				participantId: admission.credential.participantId,
				token: admission.credential.token,
			},
			{
				commandId: randomBytes(16).toString("hex"),
				sequence: 1,
				command: { type: "set_services", serviceIds: [1] },
			}
		)
	}
	await service.decks.idle()
	const aBuilds = builds.filter((id) => id === a.credential.roomId).length
	const bBuilds = builds.filter((id) => id === b.credential.roomId).length
	await f.profiles.answers(f.id, {
		revision: 0,
		items: [{ key: key(1), answer: "loved", at: f.now() }],
	})
	await service.decks.idle()
	assert.equal(
		builds.filter((id) => id === a.credential.roomId).length,
		aBuilds + 1
	)
	assert.equal(
		builds.filter((id) => id === b.credential.roomId).length,
		bBuilds
	)
	const before = (await repo.read(a.credential.roomId))!.room
	await service.prepareProfiles(before)
	await f.profiles.delete(f.id)
	await service.prepareProfiles(structuredClone(before))
	// Cold profile reads warm the next preparation without blocking the room.
	await new Promise(resolve => setImmediate(resolve))
	const after = structuredClone(before)
	await service.prepareProfiles(after)
	assert.notEqual(deckInputs(before), deckInputs(after))
	assert.notEqual(deckBase(before), deckBase(after))
	await service.decks.idle()
	service.decks.forget(a.credential.roomId)
	service.decks.forget(b.credential.roomId)
})
test("A committed decision automatically creates a follow-up and retrying its notification adds none", async () => {
	const f = fixture(),
		repo = new ProposalMemoryRepository()
	const service = new ProposalService(
		repo,
		proposalFixtureCatalog,
		secret,
		undefined,
		f.now,
		undefined,
		undefined,
		{ profiles: f.profiles }
	)
	const a = await service.create({ ...request(), setup: { country: "DE" } })
	const id = a.credential.roomId,
		credential = {
			participantId: a.credential.participantId,
			token: a.credential.token,
		}
	await service.bindProfile(id, credential, f.id)
	const tasteRevision = (await f.profiles.summary(f.id)).revision
	const send = async (
		command: import("../../../packages/yepwatch-contracts/proposal.ts").RoomCommand
	) => {
		const s = await service.read(id, credential)
		return service.command(id, credential, {
			commandId: randomBytes(16).toString("hex"),
			sequence: s.own.nextSequence,
			command,
		})
	}
	await send({ type: "set_services", serviceIds: [1] })
	let s = await service.read(id, credential)
	await send({
		type: "start",
		expectedRosterVersion: s.shared.rosterVersion,
		expectedContextVersion: s.shared.contextVersion,
		hostReady: true,
	})
	s = await service.read(id, credential)
	const candidateId = s.shared.candidates[0].id
	await send({
		type: "vote",
		generation: s.shared.generation,
		candidateId,
		expectedVoteRevision: 0,
		value: "watch",
	})
	s = await service.read(id, credential)
	await send({
		type: "propose",
		generation: s.shared.generation,
		expectedRosterVersion: s.shared.rosterVersion,
		expectedProposalVersion: s.shared.proposalVersion,
		candidateId,
	})
	s = await service.read(id, credential)
	if (s.shared.phase === "choosing")
		await send({
			type: "agree",
			generation: s.shared.generation,
			expectedRosterVersion: s.shared.rosterVersion,
			expectedProposalVersion: s.shared.proposalVersion,
			candidateId,
			expectedOwnAgreementRevision: s.own.agreement.revision,
			agreed: true,
		})
	await service.settle(id)
	await service.notify(id)
	assert.equal((await service.read(id, credential)).shared.phase, "decided")
	assert.equal(f.store.rows.get(f.id)!.profile.followups.length, 1)
	await service.notify(id)
	assert.equal(f.store.rows.get(f.id)!.profile.followups.length, 1)
	const beforeRead = (await repo.read(id))!.room.revision
	await service.read(id, credential)
	assert.equal((await repo.read(id))!.room.revision, beforeRead)
	await f.profiles.answers(f.id, { revision: tasteRevision, items: [{ key: key(5), answer: "loved", at: f.now() }] })
	f.advance(FOLLOWUP_MIN_MS)
	assert.equal((await f.profiles.summary(f.id)).followups.length, 1)
})

for (const earlierTaste of [false, true]) {
	test(`Follow-up dismissal and undo preserve Taste answers (earlier Taste: ${earlierTaste})`, async () => {
		const f = fixture()
		await f.profiles.touch(f.id)
		if (earlierTaste) await f.profiles.answers(f.id, { revision: 0, items: [{ key: key(1), answer: "not_for_me", at: f.now() }] })
		const row = f.store.rows.get(f.id)!
		const original = structuredClone(row.profile.answers)
		const decidedAt = f.now()
		row.profile.followups.push({ key: key(1), decided_at: decidedAt, state: "pending" })
		f.advance(FOLLOWUP_MIN_MS)
		const send = async (answer: "loved" | "did_not_watch" | null) => {
			const { revision } = await f.profiles.summary(f.id)
			f.advance(1)
			return f.profiles.answers(f.id, { revision, items: [{ key: key(1), answer, source: "followup", decidedAt, at: f.now() }] })
		}
		await send("did_not_watch")
		const revision = (await f.profiles.summary(f.id)).revision
		await send(null)
		assert.equal((await f.profiles.summary(f.id)).revision, revision)
		assert.deepEqual(f.store.rows.get(f.id)!.profile.answers, original)
		await send("loved")
		await send("did_not_watch")
		assert.equal(f.store.rows.get(f.id)!.profile.followups[0].state, "dismissed")
		if (earlierTaste) assert.deepEqual(f.store.rows.get(f.id)!.profile.answers, original)
		else assert.equal((await f.profiles.summary(f.id)).answered, 0)
	})
}

test("Pruning old follow-ups preserves taste revision", async () => {
	const f = fixture()
	await f.profiles.touch(f.id)
	const row = f.store.rows.get(f.id)!
	row.profile.followups.push({ key: key(1), decided_at: f.now() - FOLLOWUP_MAX_MS, state: "pending" })
	const store = new SqlProfileStore(async (statement) => ({ rows: statement.includes("array_min") ? [[f.id]] : [], rowcount: 0 }))
	store.read = f.store.read.bind(f.store)
	store.save = f.store.save.bind(f.store)
	await store.expire(f.now())
	assert.deepEqual(f.store.rows.get(f.id)!.profile.followups, [])
	assert.equal(f.store.rows.get(f.id)!.profile.revision, 0)
})

test("Cold catalog accepts answers and links; repeated links with a cold cache bypass the write lane", async () => {
	const f = fixture()
	let snapshot: ReturnType<typeof tasteFixture> | null = null
	const profiles = new TasteProfiles(f.store, secret, () => snapshot, tasteDisplays, f.now)
	const repo = new ProposalMemoryRepository()
	const service = new ProposalService(repo, proposalFixtureCatalog, secret, undefined, f.now, undefined, undefined, { profiles })
	const a = await service.create(request())
	const credential = { participantId: a.credential.participantId, token: a.credential.token }
	await profiles.answers(f.id, { revision: 0, items: [{ key: key(1), answer: "loved", at: f.now() }] })
	await service.bindProfile(a.credential.roomId, credential, f.id)
	assert.equal((await repo.read(a.credential.roomId))!.room.participants[0].profileId, f.id)
	const room = (await repo.read(a.credential.roomId))!.room
	await service.prepareProfiles(room)
	assert.equal(room.participants[0].tasteRevision, 1)
	snapshot = tasteFixture()
	assert.ok((await profiles.signal(f.id)).seen.has(key(1)), "saved answers prepare once the snapshot is ready")

	// A restarted service has neither profile cache nor local room state. Block its write lane deliberately.
	const restarted = new ProposalService(repo, proposalFixtureCatalog, secret, undefined, f.now, undefined, undefined,
		{ profiles: new TasteProfiles(f.store, secret, () => snapshot, tasteDisplays, f.now) })
	const reads = f.store.reads
	const revision = (await repo.read(room.id))!.room.revision
	const internals = restarted as unknown as { write: () => Promise<never> }
	internals.write = () => { throw new Error("already linked must not enter the write lane") }
	await restarted.bindProfile(room.id, credential, f.id)
	assert.equal(f.store.reads, reads)
	assert.equal((await repo.read(room.id))!.room.revision, revision)
})

test("Admissions and room reads finish while the profile store is blocked, then link later", { timeout: 3000 }, async () => {
	const f = fixture()
	const repo = new ProposalMemoryRepository()
	const service = new ProposalService(repo, proposalFixtureCatalog, secret, undefined, f.now, undefined, undefined, { profiles: f.profiles })
	const handler = createProposalHandler(service, { serviceSecret: secret, allowedOrigins: [] })
	let release!: () => void
	const gate = new Promise<void>(resolve => { release = resolve })
	const read = f.store.read.bind(f.store)
	f.store.read = async ids => { await gate; return read(ids) }
	try {
		const response = await handler(new Request(`https://api.test${paths.rooms}`, {
			method: "POST", headers: { [PROFILE_HEADER]: f.device, "x-yepwatch-client": "native", "content-type": "application/json" },
			body: JSON.stringify(request()),
		}))
		assert.equal(response.status, 200)
		const a = await response.json()
		assert.equal(f.store.rows.size, 0)
		const joinedResponse = await handler(new Request(`https://api.test${paths.join(a.credential.roomId)}`, {
			method: "POST", headers: { [PROFILE_HEADER]: f.device, "x-yepwatch-client": "native", "content-type": "application/json" },
			body: JSON.stringify({ ...request(), inviteCode: a.invite.code }),
		}))
		assert.equal(joinedResponse.status, 200)
		const joined = await joinedResponse.json()
		const preparing = structuredClone((await repo.read(a.credential.roomId))!.room)
		preparing.participants[0].profileId = f.id
		await service.prepareProfiles(preparing)
		assert.equal((await service.read(a.credential.roomId, a.credential)).shared.phase, "setup")
		release()
		for (let i = 0; i < 20; i++) {
			const room = (await repo.read(a.credential.roomId))!.room
			if ([a.credential.participantId, joined.credential.participantId].every(id => room.participants.find(p => p.id === id)?.profileId === f.id)) return
			await new Promise(resolve => setImmediate(resolve))
		}
		assert.fail("profile links after the store recovers")
	} finally { release() }
})

test("Profile traffic is independent of room commands and venue addresses; batches are limited per profile", async () => {
	const f = fixture()
	const repo = new ProposalMemoryRepository()
	const service = new ProposalService(repo, proposalFixtureCatalog, secret, undefined, f.now, undefined, undefined, { profiles: f.profiles })
	const handler = createProposalHandler(service, { serviceSecret: secret, allowedOrigins: [] })
	const call = (device: string, path: string, method = "GET", body?: unknown) => handler(new Request(`https://api.test${path}`, {
		method, headers: { [PROFILE_HEADER]: device, "x-yepwatch-client": "native", "content-type": "application/json", "x-forwarded-for": "192.0.2.1" },
		...(body ? { body: JSON.stringify(body) } : {}),
	}))
	let revision = 0
	for (let batch = 0; batch < 120; batch++) {
		const response = await call(f.device, paths.profileAnswers, "POST", { revision,
			items: Array.from({ length: 10 }, (_, i) => ({ key: key(i + 1), answer: batch % 2 ? "loved" : "unseen", at: f.now() + batch })),
		})
		assert.equal(response.status, 200)
		revision = (await response.json()).revision
	}
	assert.equal((await call(f.device, paths.profileAnswers, "POST", { revision, items: [{ key: key(1), answer: "not_for_me", at: f.now() + 121 }] })).status, 429)
	for (let person = 0; person < 130; person++) {
		const device = randomBytes(32).toString("base64url")
		assert.equal((await call(device, paths.profile)).status, 200)
		assert.equal((await call(device, paths.profileTasteDeck)).status, 200)
		assert.equal((await call(device, paths.profileAnswers, "POST", { revision: 0, items: [{ key: key(1), answer: "loved", at: f.now() }] })).status, 200)
	}
	assert.equal((await call(f.device, paths.profile)).status, 200, "write limit does not block reads")
	assert.equal((await call(f.device, paths.profile, "DELETE")).status, 204)
})

test("Profile lookup SQL uses primary-key equalities for batched reads, touch and answers", async () => {
	const statements: string[] = []
	const f = fixture()
	await f.profiles.touch(f.id)
	const p = f.store.rows.get(f.id)!.profile
	const store = new SqlProfileStore(async (statement, args) => {
		statements.push(statement)
		if (statement.startsWith("SELECT")) {
			assert.match(statement, /WHERE id=\?( OR id=\?)*$/)
			return { rows: args?.includes(f.id) ? [[p.id, p.answers, p.followups, p.dealt, p.revision, p.updated_at, p.expires_at, p.write_window, p.write_count, p.created_at, 1, 1]] : [], rowcount: 1 }
		}
		return { rows: [], rowcount: 1 }
	})
	const cold = new TasteProfiles(store, secret, () => tasteFixture(), tasteDisplays, f.now)
	assert.equal(await cold.touch(f.id), 0)
	await cold.answers(f.id, { revision: 0, items: [{ key: key(1), answer: "loved", at: f.now() }] })
	await store.read(Array.from({ length: 130 }, (_, i) => `profile-${i}`))
	const selects = statements.filter(s => s.startsWith("SELECT"))
	assert.equal(selects.length, 5)
	assert.equal(selects[2].match(/id=\?/g)!.length, 64)
	assert.equal(selects[4].match(/id=\?/g)!.length, 2)
})
