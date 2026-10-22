import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import type {
	RoomCommand,
	CommandEnvelope,
	RoomSnapshot,
} from "../../../packages/yepwatch-contracts/continuous.ts"
import { ContinuousService } from "./continuous-service.server.ts"
import {
	ContinuousMemoryRepository,
	continuousFixtureCatalog,
} from "./continuous-test-support.ts"
const secret = "vote-order-ui-state-test-at-least-thirty-two"
const latest = (s: RoomSnapshot) =>
	s.own.votes
		.filter(
			(v) =>
				v.value !== null &&
				s.shared.candidates.some((c) => c.id === v.candidateId),
		)
		.at(-1) ?? null
test("Authoritative vote order restores immediate Undo after reload/replay and excludes retired or reset history", async () => {
	const repo = new ContinuousMemoryRepository()
	let service = new ContinuousService(repo, continuousFixtureCatalog, secret)
	const a = await service.create({
		contractVersion: 2,
		commandId: randomBytes(16).toString("hex"),
		admissionSecret: randomBytes(32).toString("base64url"),
		nickname: "Choosing",
	})
	const id = a.credential.roomId
	const credential = {
		participantId: a.credential.participantId,
		token: a.credential.token,
	}
	const read = () => service.read(id, credential)
	const send = async (command: RoomCommand) => {
		const s = await read()
		const envelope: CommandEnvelope = {
			commandId: randomBytes(16).toString("hex"),
			sequence: s.own.nextSequence,
			command,
		}
		return { envelope, result: await service.command(id, credential, envelope) }
	}
	await send({
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
	let s = await read()
	await send({
		type: "start",
		expectedRosterVersion: s.shared.rosterVersion,
		expectedContextVersion: s.shared.contextVersion,
		hostReady: true,
	})
	s = await read()
	const [first, second] = s.shared.candidates
	const generation = s.shared.generation
	const firstVote = await send({
		type: "vote",
		generation,
		candidateId: first.id,
		expectedVoteRevision: 0,
		value: "watch",
	})
	await send({
		type: "vote",
		generation,
		candidateId: second.id,
		expectedVoteRevision: 0,
		value: "pass",
	})
	assert.deepEqual(
		(await read()).own.votes.map((v) => v.candidateId),
		[first.id, second.id],
	)
	// The actual durable representation is JSON; a new service/client receives
	// the same authoritative order rather than depending on a local undo stack.
	repo.rows.set(id, JSON.parse(JSON.stringify(repo.rows.get(id))))
	service = new ContinuousService(repo, continuousFixtureCatalog, secret)
	s = await read()
	assert.equal(latest(s)?.candidateId, second.id)
	const replay = await service.command(id, credential, firstVote.envelope)
	assert.equal(replay.receipt.replayed, true)
	assert.deepEqual(replay.snapshot.own.votes, s.own.votes)
	assert.equal(latest(replay.snapshot)?.candidateId, second.id)
	await send({
		type: "vote",
		generation,
		candidateId: second.id,
		expectedVoteRevision: 1,
		value: null,
	})
	s = await read()
	assert.deepEqual(
		s.own.votes.map((v) => v.candidateId),
		[first.id, second.id],
	)
	assert.equal(latest(s)?.candidateId, first.id)
	await send({
		type: "vote",
		generation,
		candidateId: first.id,
		expectedVoteRevision: 1,
		value: "pass",
	})
	s = await read()
	assert.deepEqual(
		s.own.votes.map((v) => v.candidateId),
		[second.id, first.id],
	)
	assert.equal(latest(s)?.revision, 2)
	await send({
		type: "vote",
		generation,
		candidateId: first.id,
		expectedVoteRevision: 2,
		value: null,
	})
	assert.equal(latest(await read()), null)
	await send({
		type: "vote",
		generation,
		candidateId: first.id,
		expectedVoteRevision: 3,
		value: "pass",
	})
	await send({
		type: "vote",
		generation,
		candidateId: second.id,
		expectedVoteRevision: 2,
		value: "pass",
	})
	s = await read()
	await send({
		type: "refill",
		generation,
		expectedStreamVersion: s.shared.stream.version,
	})
	s = await read()
	assert.equal(s.shared.candidates.length, 1)
	assert.equal(s.shared.candidates[0].id, second.id)
	assert.deepEqual(
		s.own.votes.map((v) => v.candidateId),
		[second.id],
	)
	assert.equal(latest(s)?.candidateId, second.id)
	const oldReceipt = await service.command(id, credential, firstVote.envelope)
	assert.equal(latest(oldReceipt.snapshot)?.candidateId, second.id)
	assert.ok(
		!oldReceipt.snapshot.own.votes.some((v) => v.candidateId === first.id),
	)
	s = await read()
	await send({ type: "restart", expectedRevision: s.shared.revision })
	s = await read()
	assert.notEqual(s.shared.generation, generation)
	assert.deepEqual(s.own.votes, [])
	assert.equal(latest(s), null)
	assert.equal(
		latest(
			(await service.command(id, credential, firstVote.envelope)).snapshot,
		),
		null,
	)
})
