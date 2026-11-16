import test from "node:test"
import assert from "node:assert/strict"
import { rankingRoom, cards } from "./proposal-ranking-test-support.ts"
import { proposalSnapshot, proposalTransition, retire } from "./proposal-machine.ts"
import type { ProposalRoom } from "./proposal-types.ts"

function fixture() {
	const room = rankingRoom()
	room.candidates = cards(3)
	room.participants.push({ ...structuredClone(room.participants[0]), id: "peer" })
	return room
}
function vote(room: ProposalRoom, value: "watch" | "pass" | null) {
	return proposalTransition(
		room,
		room.hostId,
		{
			commandId: "vote",
			sequence: 1,
			command: {
				type: "vote",
				generation: room.generation,
				candidateId: room.candidates[0].id,
				value,
				expectedVoteRevision: room.participants[0].votes[room.candidates[0].id]?.revision ?? 0,
			},
		},
		Date.now(),
	)
}
const counts = (room: ProposalRoom) =>
	proposalSnapshot(room, room.hostId).shared.participants.map((p) => p.answered)
test("answered counts current non-null votes, including Nope; undo and clear reduce it", () => {
	let room = fixture()
	assert.deepEqual(counts(room), [0, 0])
	room = vote(room, "watch")
	assert.deepEqual(counts(room), [1, 0])
	const revision = room.revision
	room = vote(room, "pass")
	assert.deepEqual(counts(room), [1, 0])
	assert.ok(room.revision > revision)
	room = vote(room, null)
	assert.deepEqual(counts(room), [0, 0])
	room.participants[0].votes["not-in-deck"] = { value: "watch", revision: 1 }
	assert.deepEqual(counts(room), [0, 0])
})
test("retiring fully answered nonmatches removes them from each count", () => {
	const room = fixture()
	for (const p of room.participants) {
		p.votes[room.candidates[0].id] = { value: "pass", revision: 1 }
		p.votes[room.candidates[1].id] = { value: "watch", revision: 1 }
		p.lastVotedId = room.candidates[1].id
	}
	assert.deepEqual(counts(room), [2, 2])
	retire(room)
	assert.equal(room.candidates.length, 2)
	assert.deepEqual(counts(room), [1, 1])
})
test("left participants retain their own count and do not contribute answers to others", () => {
	let room = fixture()
	room.participants[1].votes[room.candidates[0].id] = { value: "pass", revision: 1 }
	room = proposalTransition(
		room,
		"peer",
		{ commandId: "leave", sequence: 1, command: { type: "leave" } },
		Date.now(),
	)
	assert.deepEqual(counts(room), [0, 1])
	assert.equal(proposalSnapshot(room, room.hostId).shared.participants[1].dropped, true)
	room.participants = room.participants.filter((p) => p.id !== "peer")
	assert.deepEqual(counts(room), [0])
})
