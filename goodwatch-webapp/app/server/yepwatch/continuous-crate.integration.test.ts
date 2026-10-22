import { test } from "node:test"
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { randomBytes } from "node:crypto"
import type { RoomCommand } from "../../../packages/yepwatch-contracts/continuous.ts"
import { ContinuousService } from "./continuous-service.server.ts"
import { continuousFixtureCatalog } from "./continuous-test-support.ts"
import {
	crateSql,
	CrateRoomRepository,
	installRoomTable,
} from "./repository.server.ts"
import type { ContinuousRoom } from "./continuous-types.ts"
import { IndeterminateWrite } from "./errors.ts"
const origin = process.env.YEPWATCH_TEST_CONTINUOUS_CRATE_ORIGIN
const secret = "isolated-continuous-crate-secret-at-least-32"
test(
	"Real isolated Crate: PK reads, CAS, encrypted v2, lost ack, restart and persisted auto-agreement repair",
	{ skip: !origin },
	async () => {
		assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin!).hostname))
		const sql = crateSql(origin!, "crate", "")
		await installRoomTable(sql, 0, "doc.yepwatch_room_v2")
		const repo = new CrateRoomRepository<ContinuousRoom>(
			sql,
			secret,
			"doc.yepwatch_room_v2",
		)
		const service = new ContinuousService(
			repo,
			continuousFixtureCatalog,
			secret,
		)
		const created = await service.create({
			contractVersion: 2,
			commandId: randomBytes(16).toString("hex"),
			admissionSecret: randomBytes(32).toString("base64url"),
			nickname: "Real crate test",
		})
		const id = created.credential.roomId
		const credential = {
			participantId: created.credential.participantId,
			token: created.credential.token,
		}
		const initial = (await repo.read(id))!
		const a = structuredClone(initial.room)
		a.revision++
		const b = structuredClone(a)
		const race = await Promise.all([
			repo.compareAndSwap(initial, a, true),
			new CrateRoomRepository<ContinuousRoom>(
				sql,
				secret,
				"doc.yepwatch_room_v2",
			).compareAndSwap(initial, b, true),
		])
		assert.equal(race.filter(Boolean).length, 1)
		const encrypted = String(
			(await sql("SELECT payload FROM doc.yepwatch_room_v2 WHERE id=?", [id]))
				.rows[0][0],
		)
		assert.ok(!encrypted.includes("Real crate test"))
		assert.ok(!encrypted.includes("tokenHash"))
		let lost = true
		const uncertain = new CrateRoomRepository<ContinuousRoom>(
			async (stmt, args) => {
				const result = await sql(stmt, args)
				if (
					lost &&
					stmt.startsWith("UPDATE doc.yepwatch_room_v2 SET payload=")
				) {
					lost = false
					throw new IndeterminateWrite("Real commit ack lost")
				}
				return result
			},
			secret,
			"doc.yepwatch_room_v2",
		)
		const writer = new ContinuousService(
			uncertain,
			continuousFixtureCatalog,
			secret,
		)
		const send = async (command: RoomCommand) => {
			const s = await writer.read(id, credential)
			return writer.command(id, credential, {
				commandId: randomBytes(16).toString("hex"),
				sequence: s.own.nextSequence,
				command,
			})
		}
		await send({
			type: "setup",
			expectedContextVersion: 1,
			screens: [
				{
					id: "tv",
					label: "TV",
					country: "DE",
					serviceIds: [1],
					confirmed: true,
				},
			],
			constraints: { kinds: ["movie"], maxMinutes: null, moods: [] },
			screenId: "tv",
		})
		let s = await writer.read(id, credential)
		assert.equal(s.own.nextSequence, 2)
		await send({
			type: "start",
			expectedRosterVersion: s.shared.rosterVersion,
			expectedContextVersion: s.shared.contextVersion,
			hostReady: true,
		})
		s = await writer.read(id, credential)
		const candidate = s.shared.candidates[0].id
		await send({
			type: "vote",
			generation: s.shared.generation,
			candidateId: candidate,
			expectedVoteRevision: 0,
			value: "watch",
		})
		const failingCatalog = {
			...continuousFixtureCatalog,
			async recheck() {
				throw new Error("API exits before check")
			},
		}
		const interrupted = new ContinuousService(repo, failingCatalog, secret)
		s = await interrupted.read(id, credential)
		await interrupted.command(id, credential, {
			commandId: "pending_real_check",
			sequence: s.own.nextSequence,
			command: {
				type: "pick",
				generation: s.shared.generation,
				expectedRosterVersion: s.shared.rosterVersion,
				candidateId: candidate,
				expectedPickRevision: s.own.pick.revision,
			},
		})
		const stored = (await repo.read(id))!
		assert.equal(stored.room.agreement.state, "checking")
		assert.equal(stored.pendingRevision, 0)
		await sql("REFRESH TABLE doc.yepwatch_room_v2") // Only repair discovery uses search visibility; correctness reads never need this.
		const second = new CrateRoomRepository<ContinuousRoom>(
			sql,
			secret,
			"doc.yepwatch_room_v2",
		)
		assert.ok((await second.pending(100)).includes(id))
		const restarted = new ContinuousService(
			second,
			continuousFixtureCatalog,
			secret,
		)
		await restarted.repair()
		assert.equal((await restarted.read(id, credential)).shared.phase, "decided")
		if (process.env.YEPWATCH_TEST_RESTART_CONTAINER) {
			assert.match(
				process.env.YEPWATCH_TEST_RESTART_CONTAINER,
				/^yepwatch-continuous-verify-[a-z0-9-]+$/,
			)
			const binding = await promisify(execFile)("docker", [
				"port",
				process.env.YEPWATCH_TEST_RESTART_CONTAINER,
				"4200/tcp",
			])
			assert.equal(
				origin,
				`http://${binding.stdout.trim()}`,
				"Only the explicitly disposable test store may restart",
			)
			await promisify(execFile)("docker", [
				"restart",
				process.env.YEPWATCH_TEST_RESTART_CONTAINER,
			])
			let recovered = false
			for (let attempt = 0; attempt < 80; attempt++) {
				try {
					const after = await restarted.read(id, credential)
					assert.equal(after.shared.phase, "decided")
					assert.equal(after.shared.decision?.candidateId, candidate)
					recovered = true
					break
				} catch {
					await new Promise((r) => setTimeout(r, 250))
				}
			}
			assert.ok(recovered, "Disk-backed room must survive actual Crate restart")
		}
		const ticket = await restarted.ticket(id, credential)
		const consumers = await Promise.allSettled([
			restarted.attach(id, ticket.ticket),
			service.attach(id, ticket.ticket),
		])
		assert.equal(consumers.filter((x) => x.status === "fulfilled").length, 1)
	},
)
