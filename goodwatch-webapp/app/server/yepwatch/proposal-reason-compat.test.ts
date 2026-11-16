import test from "node:test"
import assert from "node:assert/strict"
import { rankingRoom, cards } from "./proposal-ranking-test-support.ts"
import { proposalSnapshot } from "./proposal-machine.ts"
// The parser installed bundles run (frozen), and the current app's parser.
import { parseFrame } from "./installed-wire.fixture.ts"
import { parseFrame as parseCurrentFrame } from "../../../../yepwatch-app/src/core/continuous/wire.ts"
import { ProposalService } from "./proposal-service.server.ts"
import { ProposalMemoryRepository, proposalFixtureCatalog } from "./proposal-test-support.ts"
import { createProposalHandler } from "./proposal-http.server.ts"
import { paths } from "../../../packages/yepwatch-contracts/proposal.ts"
test("actual installed wire parser reads legacy frames; new reasons are delivered only on declared support", () => {
	const room = rankingRoom()
	room.candidates = cards(1)
	room.candidates[0].reason = { code: "well_liked", text: "Well liked on GoodWatch" }
	const shared = proposalSnapshot(room, room.hostId).shared
	const frame = (snapshot: typeof shared) => JSON.stringify({ type: "room.updated", snapshot })
	assert.equal(parseFrame(frame(shared)), null, "the old strict bundle rejects new fields")
	// What the gateway sends a phone that didn't declare candidateReasons (proposalForClient, tested in
	// yepwatch-realtime/test/proposal-reason.test.ts; its sources don't load under plain node --test).
	const { ins, inVersion, tiebreak, ...withoutMatchesIn } = shared
	const legacy = {
		...withoutMatchesIn,
		participants: shared.participants.map((p) => {
			const legacy = { ...p }
			delete legacy.answered
			return legacy
		}),
		candidates: shared.candidates.map(({ reason: _, ...candidate }) => candidate),
	}
	assert.ok(
		parseFrame(frame(legacy)),
		"default gateway delivery keeps the installed bundle working",
	)
})
test("HTTP read responses omit reasons by default and include them only with candidateReasons=1", async () => {
	const repo = new ProposalMemoryRepository(),
		service = new ProposalService(
			repo,
			proposalFixtureCatalog,
			"compat-test-secret-at-least-thirty-two",
		)
	const admission = await service.create({
		contractVersion: 3,
		commandId: "new",
		admissionSecret: "a".repeat(43),
		nickname: "Host",
	})
	const id = admission.credential.roomId,
		row = repo.rows.get(id)!
	row.room.phase = "choosing"
	row.room.candidates = cards(1)
	row.room.candidates[0].reason = { code: "well_liked", text: "Well liked on GoodWatch" }
	const handler = createProposalHandler(service, {
		serviceSecret: "s".repeat(32),
		allowedOrigins: ["https://yepwatch.example"],
	})
	const read = async (query = "") => {
		const response = await handler(
			new Request(`https://yepwatch.example${paths.rooms}/${id}${query}`, {
				headers: {
					origin: "https://yepwatch.example",
					authorization: `Bearer ${admission.credential.token}`,
					"x-yepwatch-participant": admission.credential.participantId,
				},
			}),
		)
		assert.equal(response.status, 200)
		return response.json()
	}
	assert.equal("reason" in (await read()).shared.candidates[0], false)
	assert.equal("answered" in (await read()).shared.participants[0], false)
	assert.equal(
		"answered" in (await read("?matchesIn=1&candidateReasons=1")).shared.participants[0],
		false,
	)
	assert.equal((await read("?answeredCounts=1")).shared.participants[0].answered, 0)
	assert.equal("ins" in (await read("?answeredCounts=1")).shared, false)
	assert.equal((await read("?candidateReasons=1")).shared.candidates[0].reason.code, "well_liked")
	const legacy = await read()
	assert.ok(parseFrame(JSON.stringify({ type: "room.snapshot", snapshot: legacy.shared })))
	for (const key of ["ins", "inVersion", "tiebreak"]) assert.equal(key in legacy.shared, false)
	for (const key of ["ins", "favorite"]) assert.equal(key in legacy.own, false)
	const supported = await read("?matchesIn=1")
	assert.deepEqual(supported.shared.ins, [])
	assert.equal(supported.shared.inVersion, 0)
	assert.equal(supported.shared.tiebreak, null)
	assert.deepEqual(supported.own.ins, { candidateIds: [], revision: 0 })
	assert.equal(supported.own.favorite, null)
	assert.equal(
		parseFrame(JSON.stringify({ type: "room.snapshot", snapshot: supported.shared })),
		null,
	)
	assert.ok(
		parseCurrentFrame(
			JSON.stringify({
				type: "room.snapshot",
				snapshot: (await read("?matchesIn=1&candidateReasons=1")).shared,
			}),
		),
		"the current app reads what it opts into",
	)
})

test("internal views gate matches and answered counts; attach stays attachment-only", async () => {
	const repo = new ProposalMemoryRepository(),
		service = new ProposalService(
			repo,
			proposalFixtureCatalog,
			"internal-compat-secret-at-least-thirty-two",
		)
	const admission = await service.create({
		contractVersion: 3,
		commandId: "new",
		admissionSecret: "a".repeat(43),
		nickname: "Host",
	})
	const id = admission.credential.roomId
	const ticket = await service.ticket(id, admission.credential)
	const attached = await service.attach(id, ticket.ticket)
	const handler = createProposalHandler(service, {
		serviceSecret: "s".repeat(32),
		allowedOrigins: [],
	})
	for (const path of [paths.realtimeAttach, paths.realtimeView, paths.realtimeViews])
		for (const optIn of [false, true]) {
			const response = await handler(
				new Request(`https://api.example${path}${optIn ? "?matchesIn=1&answeredCounts=1" : ""}`, {
					method: "POST",
					headers: {
						authorization: `Bearer ${"s".repeat(32)}`,
						"content-type": "application/json",
					},
					body: JSON.stringify({
						roomId: id,
						...(path === paths.realtimeAttach
							? { ticket: (await service.ticket(id, admission.credential)).ticket }
							: path === paths.realtimeView
								? { lease: attached.lease }
								: { leases: [attached.lease] }),
					}),
				}),
			)
			assert.equal(response.status, 200)
			const value = await response.json()
			if (path === paths.realtimeAttach) {
				assert.equal(value.snapshot, undefined)
				continue
			}
			for (const key of ["ins", "inVersion", "tiebreak"]) assert.equal(key in value.snapshot, optIn)
			assert.equal("answered" in value.snapshot.participants[0], optIn)
		}
})
