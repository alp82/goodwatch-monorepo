import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { randomBytes } from "node:crypto"
import { crateSql, type Sql } from "./repository.server.ts"
import {
	RelationalProposalRepository as OldRepository,
	provisionRelationalRooms,
} from "./storage-v1/repository.ts"
import { runtimeTable, tableDdl } from "./storage-v1/schema.ts"
import { RelationalProposalRepository } from "./proposal-relational-repository.ts"
import { ProposalService } from "./proposal-service.server.ts"
import { proposalFixtureCatalog } from "./proposal-test-support.ts"
import {
	prepareSettingsMigration,
	applySettingsMigration,
} from "./proposal-settings-migration.ts"
import { keyed } from "./crypto.server.ts"
import { CONTINUOUS_LIMITS } from "./continuous-types.ts"
const docker = (...args: string[]) =>
	execFileSync("docker", args, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim()
test(
	"Room settings migration preserves decisions, votes, credentials and resumes after a partial publication",
	{ skip: process.env.YEPWATCH_TEST_RELATIONAL_CRATE !== "1", timeout: 180000 },
	async (t) => {
		const name = `yepwatch-settings-test-${process.pid}`,
			directory = await mkdtemp(`${tmpdir()}/yepwatch-settings-test-`)
		docker(
			"run",
			"-d",
			"--name",
			name,
			"-p",
			"127.0.0.1::4200",
			"-e",
			"CRATE_HEAP_SIZE=512m",
			"crate:5.10.16",
			"crate",
			"-Cdiscovery.type=single-node",
			`-Ccluster.name=${name}`
		)
		t.after(async () => {
			docker("rm", "-f", name)
			await rm(directory, { recursive: true, force: true })
		})
		const port = docker("port", name, "4200/tcp").split(":").at(-1),
			sql = crateSql(`http://127.0.0.1:${port}`, "crate", "")
		for (let i = 0; ; i++) {
			try {
				await sql("SELECT 1")
				break
			} catch (e) {
				if (i > 100) throw e
				await new Promise((r) => setTimeout(r, 300))
			}
		}
		const secret = "settings-migration-test-secret-not-a-live-secret"
		await provisionRelationalRooms(sql, 0)
		await sql(tableDdl(runtimeTable, 0))
		await sql(
			"INSERT INTO doc.yepwatch_runtime (id,format_version,key_id,key_check,room_ttl_ms) VALUES (?,?,?,?,?)",
			[
				"proposal3",
				1,
				"test",
				keyed(secret, "typed-store-key", "relational-v1"),
				CONTINUOUS_LIMITS.roomMs,
			]
		)
		const old = new OldRepository(sql, secret),
			service = new ProposalService(old, proposalFixtureCatalog, secret)
		const admission = await service.create({
			contractVersion: 3,
			commandId: randomBytes(12).toString("hex"),
			admissionSecret: randomBytes(32).toString("base64url"),
			nickname: "Host",
		})
		const id = admission.credential.roomId,
			credential = admission.credential
		async function send(command: any) {
			const s = await service.read(id, credential)
			return service.command(id, credential, {
				commandId: randomBytes(12).toString("hex"),
				sequence: s.own.nextSequence,
				command,
			})
		}
		await send({
			type: "setup",
			expectedContextVersion: 1,
			screens: [
				{
					id: "old-tv",
					label: "Old TV",
					country: "DE",
					serviceIds: [1],
					confirmed: true,
				},
			],
			screenId: "old-tv",
			constraints: {
				kinds: ["movie", "show_start"],
				moods: [],
				maxMinutes: null,
			},
		})
		let s = await service.read(id, credential)
		await send({
			type: "start",
			expectedContextVersion: s.shared.contextVersion,
			expectedRosterVersion: s.shared.rosterVersion,
			hostReady: true,
		})
		s = await service.read(id, credential)
		const card = s.shared.candidates[0].id
		await send({
			type: "vote",
			generation: s.shared.generation,
			candidateId: card,
			expectedVoteRevision: 0,
			value: "watch",
		})
		s = await service.read(id, credential)
		await send({
			type: "propose",
			generation: s.shared.generation,
			expectedRosterVersion: s.shared.rosterVersion,
			expectedProposalVersion: s.shared.proposalVersion,
			candidateId: card,
		})
		const expected = await service.read(id, credential)
		assert.equal(expected.shared.phase, "decided")
		const before = (await old.read(id))!,
			legacy = structuredClone(before.room)
		legacy.screens[0].id = "old-tv"
		legacy.participants[0].screenId = "old-tv"
		for (const c of legacy.candidates)
			for (const a of c.availability) a.screenId = "old-tv"
		for (const a of legacy.decision!.availability) a.screenId = "old-tv"
		assert.equal(await old.compareAndSwap(before, legacy, false), true)
		const backup = `${directory}/backup.sealed`
		await prepareSettingsMigration(sql, secret, "test", `${backup}.stale`)
    await sql('UPDATE doc.yepwatch_room SET pending_revision=pending_revision WHERE id=?', [id])
    await assert.rejects(applySettingsMigration(sql, secret, "test", `${backup}.stale`), /Rooms changed since backup/)
    await prepareSettingsMigration(sql, secret, "test", backup)
		let lost = false
		const uncertain: Sql = async (stmt, args) => {
			const result = await sql(stmt, args)
			if (!lost && stmt.startsWith("UPDATE doc.yepwatch_room SET")) {
				lost = true
				throw new Error("Lost migration acknowledgement")
			}
			return result
		}
		await assert.rejects(
			applySettingsMigration(uncertain, secret, "test", backup),
			/Lost migration acknowledgement/
		)
		await applySettingsMigration(sql, secret, "test", backup)
		await applySettingsMigration(sql, secret, "test", backup)
		const current = new ProposalService(
				new RelationalProposalRepository(sql, secret),
				proposalFixtureCatalog,
				secret
			),
			after = await current.read(id, credential)
		assert.equal(after.shared.phase, "decided")
		assert.equal(after.shared.decision?.candidateId, card)
		assert.deepEqual(after.own.votes, expected.own.votes)
		assert.equal(after.own.nextSequence, expected.own.nextSequence)
		assert.equal(after.shared.screens[0].id, "room")
		const obsolete = (
			await sql(
				"SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='doc' AND (table_name='yepwatch_screen' OR (table_name='yepwatch_room' AND column_name='screen_records') OR (table_name='yepwatch_participant' AND column_name='screen_id'))"
			)
		).rows
		assert.deepEqual(obsolete, [])
		const described = {
			prompt: "A funny film",
			attributes: [{ text: "Funny", kind: "want" as const }],
			rankedKeys: [1000000000001],
			interpretedAt: Date.now(),
		}
		const nextService = new ProposalService(
			new RelationalProposalRepository(sql, secret),
			proposalFixtureCatalog,
			secret,
			undefined,
			Date.now,
			undefined,
			async () => described
		)
		let n = after.own.nextSequence
		await nextService.command(id, credential, {
			commandId: "restart-new-settings",
			sequence: n++,
			command: { type: "restart", expectedRevision: after.shared.revision },
		})
		const reset = await nextService.read(id, credential)
		await nextService.command(id, credential, {
			commandId: "describe-after-migration",
			sequence: n++,
			command: {
				type: "configure",
				expectedContextVersion: reset.shared.contextVersion,
				country: "DE",
				serviceIds: [1],
				constraints: { kinds: ["movie"], moods: [], maxMinutes: null },
				prompt: described.prompt,
			},
		})
		assert.deepEqual(
			(await new RelationalProposalRepository(sql, secret).read(id))!.room
				.intent,
			described
		)
		await nextService.command(id, credential, {
			commandId: "leave-after-migration",
			sequence: n++,
			command: { type: "leave" },
		})
		const departed = (await new RelationalProposalRepository(sql, secret).read(
			id
		))!.room.participants[0]
		assert.ok(departed.leftAt)
		await assert.rejects(nextService.read(id, credential), /left this room/)
		// A new service/repository process view restores this exact durable place.
		const returningService = new ProposalService(new RelationalProposalRepository(sql, secret), proposalFixtureCatalog, secret)
		const returned = await returningService.resumeOrJoin(id, credential, {
			contractVersion: 3, commandId: "return-to-saved-place", admissionSecret: randomBytes(32).toString("base64url"), nickname: "Ignored", inviteCode: admission.invite.code,
		})
		assert.equal(returned.credential.participantId, credential.participantId)
		assert.equal(returned.snapshot.shared.participants.length, 1)
		assert.equal(returned.snapshot.shared.participants[0].dropped, false)
		assert.equal(returned.snapshot.shared.participants[0].nickname, "Host")
		assert.equal((await new RelationalProposalRepository(sql, secret).read(id))!.room.participants[0].leftAt, null)
		assert.deepEqual(returned.snapshot.shared.description, {prompt: described.prompt, attributes: described.attributes})
	}
)
