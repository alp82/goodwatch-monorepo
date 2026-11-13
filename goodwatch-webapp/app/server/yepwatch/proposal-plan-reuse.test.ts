import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { ProposalService } from "./proposal-service.server.ts"
import { ProposalMemoryRepository, proposalFixtureCatalog } from "./proposal-test-support.ts"
import { RelationalProposalRepository } from "./proposal-relational-repository.ts"
import type { ProposalStored } from "./proposal-types.ts"
import type { Sql } from "./repository.server.ts"

// A vote's write plans every record of the room again. Records it planned before (same content) are reused: the
// statements sent are exactly the ones a repository planning from scratch sends, and invalid content still fails.

const secret = "plan-reuse-secret-at-least-thirty-two-chars"

/** Every statement sent; INSERTs answer with every row inserted, the head UPDATE with one row. */
function recordingSql() {
	const sent: [string, unknown[]][] = []
	const sql = (async (statement: string, args: unknown[] = []) => {
		sent.push([statement, structuredClone(args)])
		const rows = statement.startsWith("INSERT") ? (statement.match(/\),\(|\) ON CONFLICT/g) ?? []).length : 1
		return { rows: [], rowcount: rows, cols: [] }
	}) as unknown as Sql
	return { sql, sent }
}

/** Guest rooms (no encrypted columns, so statements compare exactly) after each of a run of votes by three people. */
async function rooms() {
	const repo = new ProposalMemoryRepository()
	const catalog = {
		...proposalFixtureCatalog,
		async metadata() {
			return { countries: [{ code: "US", name: "United States" }], services: [{ id: 1, name: "1", logoUrl: null }], moods: [] }
		},
	}
	const service = new ProposalService(repo, catalog, secret, async () => {})
	const admission = (nickname: string) => ({ contractVersion: 3 as const, commandId: randomUUID(), admissionSecret: "a".repeat(43), nickname })
	const a = await service.create(admission("Host"))
	const id = a.credential.roomId
	const b = await service.join(id, { ...admission("Friend"), inviteCode: a.invite.code })
	const send = async (command: any, who = a) => {
		const s = await service.read(id, who.credential)
		return service.command(id, who.credential, { commandId: randomUUID(), sequence: s.own.nextSequence, command })
	}
	let s = await service.read(id, a.credential)
	await send({ type: "configure", expectedContextVersion: s.shared.contextVersion, country: "US" })
	await send({ type: "set_services", serviceIds: [1] })
	s = await service.read(id, a.credential)
	const start = await send({ type: "start", expectedContextVersion: s.shared.contextVersion, expectedRosterVersion: s.shared.rosterVersion, hostReady: true })
	const history: ProposalStored[] = [structuredClone(repo.rows.get(id)!)]
	for (const c of start.snapshot.shared.candidates) {
		for (const who of [a, b]) {
			await send({ type: "vote", generation: start.snapshot.shared.generation, candidateId: c.id, expectedVoteRevision: 0, value: "pass" }, who)
			history.push(structuredClone(repo.rows.get(id)!))
		}
	}
	return history
}

test("a write reuses records it planned before and sends exactly what planning from scratch sends", async () => {
	const history = await rooms()
	assert.ok(history.length >= 3)
	const warm = recordingSql()
	const reused = new RelationalProposalRepository(warm.sql, secret)
	for (let i = 1; i < history.length; i++) {
		const fresh = recordingSql()
		const scratch = new RelationalProposalRepository(fresh.sql, secret)
		const before = warm.sent.length
		// Fresh copies, as each command's rooms are: nothing is shared with an earlier write but content.
		assert.equal(await reused.compareAndSwap(structuredClone(history[i - 1]), structuredClone(history[i].room), true), true)
		assert.equal(await scratch.compareAndSwap(structuredClone(history[i - 1]), structuredClone(history[i].room), true), true)
		assert.deepEqual(warm.sent.slice(before), fresh.sent, `write ${i}`)
	}
})

test("content planned before is still validated: an invalid record fails the write as it always did", async () => {
	const history = await rooms()
	const warm = recordingSql()
	const reused = new RelationalProposalRepository(warm.sql, secret)
	const last = history.at(-1)!
	assert.equal(await reused.compareAndSwap(structuredClone(history.at(-2)!), structuredClone(last.room), true), true)
	const invalid = structuredClone(last.room)
	const voter = invalid.participants.find((p) => Object.keys(p.votes).length)!
	const vote = Object.values(voter.votes)[0]
	vote.revision = Number.NaN // the same JSON as null, never a valid revision
	const sent = warm.sent.length
	await assert.rejects(reused.compareAndSwap(structuredClone(last), invalid, true))
	assert.equal(warm.sent.slice(sent).some(([statement]) => statement.startsWith("UPDATE")), false, "no head names it")
})
