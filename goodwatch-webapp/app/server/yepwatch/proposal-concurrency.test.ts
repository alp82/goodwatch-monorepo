import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import type { RoomCommand } from "../../../packages/yepwatch-contracts/proposal.ts"
import type { ProposalRepository } from "./proposal-types.ts"
import { ProposalService } from "./proposal-service.server.ts"
import {
	ProposalMemoryRepository,
	proposalFixtureCatalog,
} from "./proposal-test-support.ts"

const admission = (nickname: string) => ({
	contractVersion: 3 as const,
	commandId: randomBytes(16).toString("hex"),
	admissionSecret: randomBytes(32).toString("base64url"),
	nickname,
})
const credential = (a: Awaited<ReturnType<ProposalService["create"]>>) => ({
	participantId: a.credential.participantId,
	token: a.credential.token,
})

const crateOrigin = process.env.YEPWATCH_TEST_CONCURRENCY_CRATE_ORIGIN
for (const backend of ["memory", "crate"] as const)
	test(
		`Full room concurrent joins, handshakes and votes (${backend})`,
		{ skip: backend === "crate" && !crateOrigin },
		async () => {
			const secret = "concurrency-test-secret-at-least-32-characters"
			let repository: ProposalRepository = new ProposalMemoryRepository()
			if (backend === "crate") {
				assert.ok(crateOrigin)
				assert.ok(
					["127.0.0.1", "localhost"].includes(new URL(crateOrigin).hostname),
				)
				const { crateSql } = await import("./repository.server.ts")
				const { RelationalProposalRepository } = await import(
					"./proposal-relational-repository.ts"
				)
				const { provisionReleaseStore } = await import(
					"./proposal-release-store.ts"
				)
				const sql = crateSql(crateOrigin, "crate", "")
				await provisionReleaseStore(sql, 0, "concurrency-test", secret)
				repository = new RelationalProposalRepository(sql, secret)
			}
			const service = new ProposalService(
				repository,
				proposalFixtureCatalog,
				secret,
			)
			const host = await service.create(admission("Host"))
			const id = host.credential.roomId
			const guests = await Promise.allSettled(
				Array.from({ length: 11 }, (_, i) =>
					service.join(id, {
						...admission(`Guest ${i}`),
						inviteCode: host.invite.code,
					}),
				),
			)
			assert.equal(
				guests.filter((r) => r.status === "rejected").length,
				0,
				"simultaneous joins must all succeed within the 12-person limit",
			)
			const people = [
				host,
				...guests.map((r) => {
					if (r.status === "rejected") throw r.reason
					return r.value
				}),
			]
			const tickets = await Promise.allSettled(
				people.map((p) => service.ticket(id, credential(p))),
			)
			assert.equal(
				tickets.filter((r) => r.status === "rejected").length,
				0,
				"simultaneous connections must all receive tickets",
			)
			const attachments = await Promise.allSettled(
				tickets.map((r) => {
					if (r.status === "rejected") throw r.reason
					return service.attach(id, r.value.ticket)
				}),
			)
			assert.equal(
				attachments.filter((r) => r.status === "rejected").length,
				0,
				"simultaneous connections must all authenticate",
			)
			await service.command(id, credential(host), {
				commandId: randomBytes(16).toString("hex"),
				sequence: host.snapshot.own.nextSequence,
				command: {
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
					constraints: { kinds: ["movie"], maxMinutes: null, moods: [] },
					screenId: "couch",
				},
			})
			const snapshots = await Promise.all(
				people.map((p) => service.read(id, credential(p))),
			)
			const commands = await Promise.allSettled(
				people.map((p, i) =>
					service.command(id, credential(p), {
						commandId: randomBytes(16).toString("hex"),
						sequence: snapshots[i].own.nextSequence,
						command: {
							type: "assign_screen",
							expectedContextVersion: snapshots[i].shared.contextVersion,
							screenId: "couch",
						},
					}),
				),
			)
			assert.equal(
				commands.filter((r) => r.status === "rejected").length,
				0,
				"simultaneous actions must all be acknowledged",
			)
			const send = async (person: typeof host, command: RoomCommand) => {
				const snapshot = await service.read(id, credential(person))
				return service.command(id, credential(person), {
					commandId: randomBytes(16).toString("hex"),
					sequence: snapshot.own.nextSequence,
					command,
				})
			}
			await Promise.all(
				people.slice(1).map((person) =>
					send(person, {
						type: "ready",
						expectedContextVersion: 2,
						ready: true,
					}),
				),
			)
			const { shared } = await service.read(id, credential(host))
			const started = await send(host, {
				type: "start",
				expectedContextVersion: shared.contextVersion,
				expectedRosterVersion: shared.rosterVersion,
				hostReady: true,
			})
			const candidateId = started.snapshot.shared.candidates[0].id
			const votes = await Promise.all(
				people.map((person) =>
					send(person, {
						type: "vote",
						generation: started.snapshot.shared.generation,
						candidateId,
						expectedVoteRevision: 0,
						value: "watch",
					}),
				),
			)
			assert.equal(votes.length, 12)
			for (const person of people) {
				const snapshot = await service.read(id, credential(person))
				assert.equal(
					snapshot.own.votes.find((vote) => vote.candidateId === candidateId)
						?.value,
					"watch",
				)
			}
			assert.ok(
				(await service.read(id, credential(host))).shared.matches.some(
					(match) => match.candidateId === candidateId,
				),
			)
			// Everyone's deck runs low together: their refills race on one stream version and all succeed.
			const before = (await service.read(id, credential(host))).shared
			const refills = await Promise.allSettled(
				people.map((person) =>
					send(person, {
						type: "refill",
						generation: before.generation,
						expectedStreamVersion: before.stream.version,
					}),
				),
			)
			assert.deepEqual(
				refills.flatMap((r) => (r.status === "rejected" ? [String(r.reason)] : [])),
				[],
				"simultaneous refills must all be acknowledged",
			)
			const after = (await service.read(id, credential(host))).shared
			assert.equal(after.stream.version, before.stream.version + 1, "one refill fills the deck; the rest are no-ops")
		},
	)

test(
	"room write queues are bounded, isolate rooms and recover after rejected writes",
	{ timeout: 3000 },
	async () => {
		const repo = new ProposalMemoryRepository()
		const service = new ProposalService(
			repo,
			proposalFixtureCatalog,
			"queue-test-secret-at-least-32-characters",
		)
		const a = await service.create(admission("A"))
		const b = await service.create(admission("B"))
		let release!: () => void
		let entered!: () => void
		const blocked = new Promise<void>((resolve) => {
			release = resolve
		})
		const reached = new Promise<void>((resolve) => {
			entered = resolve
		})
		const cas = repo.compareAndSwap.bind(repo)
		let hold = true
		repo.compareAndSwap = async (old, room, notify) => {
			if (room.id === a.credential.roomId && hold) {
				hold = false
				entered()
				await blocked
			}
			return cas(old, room, notify)
		}
		// Renames are room writes: they take the room's write lane (realtime tickets no longer do).
		const rename = (who: typeof a, sequence: number, token = who.credential.token) =>
			service.command(who.credential.roomId, { ...credential(who), token }, {
				commandId: randomBytes(12).toString("hex"),
				sequence,
				command: { type: "rename", nickname: "Renamed" } as RoomCommand,
			})
		const first = rename(a, 1)
		await reached
		try {
			await rename(b, 1)
			const denied = Array.from({ length: 31 }, () => rename(a, 2, "invalid"))
			const settled = Promise.allSettled(denied)
			await assert.rejects(rename(a, 2), {
				code: "busy",
			})
			release()
			await first
			const results = await settled
			assert.ok(
				results.every(
					(result) =>
						result.status === "rejected" &&
						result.reason.code === "unauthorized",
				),
			)
			await rename(a, 2)
		} finally {
			release()
		}
	},
)

test("the gateway hears of a committed command from the room it committed, once, before the command answers", async () => {
	const repository = new ProposalMemoryRepository()
	const events: string[] = []
	const service = new ProposalService(repository, proposalFixtureCatalog, "early-hint-test-secret-at-least-32-chars", async (e) => {
		events.push(`publish ${e.revision}`)
	})
	const host = await service.create({ ...admission("Host"), setup: { country: "DE" } })
	const id = host.credential.roomId
	const own = credential(host)
	const s = await service.read(id, own)
	const read = repository.read.bind(repository)
	repository.read = async (roomId) => {
		events.push("read")
		return read(roomId)
	}
	const done = await service.command(id, own, { commandId: randomBytes(16).toString("hex"), sequence: s.own.nextSequence, command: { type: "set_services", serviceIds: [1] } as RoomCommand })
	const revision = done.receipt.appliedRevision
	const answered = events.length
	// The committed room, then its plain hint (for a gateway that knows only those).
	const once = [`publish ${revision}`, `publish ${revision}`]
	assert.deepEqual(events.slice(0, answered).filter((e) => e.startsWith("publish")), once, events.join(", "))
	assert.equal(events.slice(0, events.indexOf(`publish ${revision}`)).filter((e) => e === "read").length, 1, "only the command's own read")
	await new Promise((resolve) => setTimeout(resolve, 20))
	assert.deepEqual(events.filter((e) => e.startsWith("publish")), once, "notify doesn't publish it again")
	service.decks.forget(id)
})
