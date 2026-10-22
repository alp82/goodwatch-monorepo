import { RelationalProposalRepository } from "./proposal-relational-repository.ts"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import {
	ReleaseControl,
	CONTROL_TABLE,
	CONTROL_COLUMNS,
	controlState,
	controlRow,
} from "./proposal-release-control.ts"
import { crateSql, type Sql } from "./repository.server.ts"
import { ProposalService } from "./proposal-service.server.ts"
import { proposalFixtureCatalog } from "./proposal-test-support.ts"
import { createProposalHandler } from "./proposal-http.server.ts"
import { releaseHttp } from "./proposal-release-http.ts"
import { IndeterminateWrite, RoomError } from "./errors.ts"
import { paths } from "../../../packages/yepwatch-contracts/proposal.ts"
import type { GuestAdmission } from "../../../packages/yepwatch-contracts/proposal.ts"
import type { ProposalRoom } from "./proposal-types.ts"
const enabled = process.env.YEPWATCH_TEST_CONTROL_CRATE === "1"
const secret = "disposable-capacity-real-crate-at-least-thirty-two"
const request = () => ({
	contractVersion: 3 as const,
	commandId: randomBytes(16).toString("hex"),
	admissionSecret: randomBytes(32).toString("base64url"),
	nickname: "A",
})
const credential = (a: GuestAdmission) => ({
	participantId: a.credential.participantId,
	token: a.credential.token,
})
test(
	"Disposable Crate + two actual HTTP API instances: concurrent cap, lost acknowledgements, budgets, restart, expiry and delayed insert",
	{ skip: !enabled, timeout: 150000 },
	async () => {
		const port = Number(process.env.YEPWATCH_TEST_CONTROL_PORT ?? 15978)
		if (port !== 15978)
			throw Error("This disposable harness only binds its documented15978 port")
		const name = `yepwatch-control-proof-${process.pid}`
		const docker = (...args: string[]) =>
			execFileSync("docker", args, { stdio: "pipe" })
		const sql = crateSql(`http://127.0.0.1:${port}`, "crate", "")
		const ready = async () => {
			for (let i = 0; i < 65; i++) {
				try {
					await sql("SELECT 1")
					return
				} catch {}
				await new Promise((r) => setTimeout(r, 500))
			}
			throw Error("Disposable Crate unavailable")
		}
		const policy = { rooms: 3, admissions: 4, commands: 3, actorCommands: 2 }
		let servers: Awaited<ReturnType<typeof releaseHttp>>[] = []
		let backupRows: { table: string; columns: Record<string, unknown> }[] = []
		try {
			docker(
				"run",
				"-d",
				"--name",
				name,
				"-p",
				`127.0.0.1:${port}:4200`,
				"-e",
				"CRATE_HEAP_SIZE=256m",
				"crate:5.10.16",
				"-Cdiscovery.type=single-node",
				"-Cnetwork.host=0.0.0.0"
			)
			await ready()
			const operator = fileURLToPath(
				new URL("../../../build/yepwatch-release/operator.mjs", import.meta.url)
			)
			const operatorEnv = {
				PATH: process.env.PATH,
				NODE_ENV: "test" as const,
				YEPWATCH_PROPOSAL_CRATEDB_ORIGIN: `http://127.0.0.1:${port}`,
				YEPWATCH_PROPOSAL_CRATEDB_USERNAME: "crate",
				YEPWATCH_PROPOSAL_SECRET: secret,
				YEPWATCH_PROPOSAL_KEY_ID: "control-proof",
				YEPWATCH_PROPOSAL_MAX_ACTIVE_ROOMS: "3",
				YEPWATCH_PROPOSAL_ADMISSIONS_PER_MINUTE: "4",
				YEPWATCH_PROPOSAL_COMMANDS_PER_MINUTE: "3",
				YEPWATCH_PROPOSAL_ACTOR_COMMANDS_PER_MINUTE: "2",
			}
			const operate = (...args: string[]) =>
				JSON.parse(
					execFileSync(process.execPath, [operator, ...args], {
						env: operatorEnv,
						encoding: "utf8",
					})
				)
			assert.equal(
				operate("provision", "--apply", "--disposable-single-node").ready,
				true
			)
			assert.equal(operate("check").ready, true)
			assert.equal(operate("inventory").controls.activeReservations, 0)
			// All assertions below intentionally share a real database window. Avoid beginning just before rollover.
			const windowPosition =
				Number((await sql("SELECT CURRENT_TIMESTAMP")).rows[0][0]) % 60000
			if (windowPosition > 45000)
				await new Promise((r) => setTimeout(r, 60000 - windowPosition + 25))
			let fenceFirstControl = true,
				loseControl = true,
				loseRoom = false
			const unreliable: Sql = async (stmt, args) => {
				// Exercise the actual SQL CASE no-op fence without changing the database clock.
				if (fenceFirstControl && stmt.startsWith("UPDATE " + CONTROL_TABLE)) {
					fenceFirstControl = false
					const delayedArgs = [...(args ?? [])]
					for (let i = 0; i < delayedArgs.length - 3; i += 2) delayedArgs[i] = 0
					return sql(stmt, delayedArgs)
				}
				const result = await sql(stmt, args)
				if (
					result.rowcount === 1 &&
					((loseControl && stmt.startsWith("UPDATE " + CONTROL_TABLE)) ||
						(loseRoom && stmt.startsWith("UPDATE doc.yepwatch_room SET")))
				) {
					if (stmt.startsWith("UPDATE " + CONTROL_TABLE)) loseControl = false
					else loseRoom = false
					throw new IndeterminateWrite("Injected after actual commit")
				}
				return result
			}
			const build = (connection: Sql) =>
				new ProposalService(
					new RelationalProposalRepository(connection, secret),
					proposalFixtureCatalog,
					secret,
					async () => {},
					Date.now,
					new ReleaseControl(connection, policy)
				)
			let a = build(unreliable),
				b = build(sql)
			for (const service of [a, b])
				servers.push(
					await releaseHttp(
						createProposalHandler(service, {
							serviceSecret: secret,
							allowedOrigins: ["https://yepwatch.com"],
						}),
						"127.0.0.1",
						0
					)
				)
			const origins = servers.map(
				(s) => `http://127.0.0.1:${(s.address() as { port: number }).port}`
			)
			const requests = Array.from({ length: 9 }, request)
			const results = await Promise.all(
				requests.map(async (body, i) => {
					const response = await fetch(origins[i % 2] + paths.rooms, {
						method: "POST",
						headers: {
							"content-type": "application/json",
							"x-yepwatch-client": "native",
						},
						body: JSON.stringify(body),
					})
					return {
						status: response.status,
						body: await response.json(),
						request: body,
					}
				})
			)
			const accepted = results.filter((r) => r.status === 200)
			assert.equal(
				accepted.length,
				3,
				JSON.stringify(
					results.map((r) => ({ status: r.status, error: r.body.error }))
				)
			)
			assert.equal(
				(await new ReleaseControl(sql, policy).summary()).activeReservations,
				3
			)
			assert.ok(
				results.filter((r) => r.status !== 200).every((r) => r.status === 503)
			)
			const first = accepted[0].body as GuestAdmission,
				id = first.credential.roomId
			assert.equal(
				(await b.create(accepted[0].request)).credential.participantId,
				first.credential.participantId
			)
			const setup = (version: number) => ({
				commandId: randomBytes(16).toString("hex"),
				sequence: version,
				command: {
					type: "setup" as const,
					expectedContextVersion: version,
					screens: [
						{
							id: "tv",
							label: "TV",
							country: "DE",
							serviceIds: [1],
							confirmed: true,
						},
					],
					constraints: {
						kinds: ["movie" as const, "show_start" as const],
						maxMinutes: null,
						moods: [],
					},
					screenId: "tv",
				},
			})
			const cmd1 = setup(1)
			loseRoom = true
			await a.command(id, credential(first), cmd1)
			await b.command(id, credential(first), setup(2))
			await assert.rejects(
				a.command(id, credential(first), setup(3)),
				(e: RoomError) => e.status === 429
			)
			assert.equal(
				(await b.command(id, credential(first), cmd1)).receipt.replayed,
				true
			)
			const other = accepted[1].body as GuestAdmission
			await b.command(other.credential.roomId, credential(other), setup(1))
			await assert.rejects(
				b.command(other.credential.roomId, credential(other), setup(2)),
				(e: RoomError) => e.status === 429
			)
			// A new join consumes the fourth admission; a second cannot bypass exhausted global admission tokens.
			const joinRequest = { ...request(), inviteCode: first.invite.code }
			const joined = await a.join(id, joinRequest)
			assert.equal(
				(await b.join(id, joinRequest)).credential.participantId,
				joined.credential.participantId
			)
			await assert.rejects(
				b.join(id, { ...request(), inviteCode: first.invite.code }),
				(e: RoomError) => e.status === 429
			)
			for (const server of servers)
				await new Promise<void>((resolve) => server.close(() => resolve()))
			servers = []
			// Quiesced export includes the exact control row, never silently starting capacity from zero on restore.
			const backupDirectory = mkdtempSync(
				join(tmpdir(), "yepwatch-control-backup-")
			)
			try {
				const destination = join(backupDirectory, "rooms.jsonl")
				const report = operate("backup", destination, "--writers-stopped")
				assert.equal(report.controlIncluded, true)
				const lines = readFileSync(destination, "utf8")
					.trim()
					.split("\n")
					.map((line) => JSON.parse(line))
				assert.equal(lines[0].format, 3)
				backupRows = lines.slice(1)
				assert.equal(
					lines.find((line) => line.table === CONTROL_TABLE).columns
						.room_reservations.length,
					3
				)
			} finally {
				rmSync(backupDirectory, { recursive: true })
			}

			docker("restart", name)
			await ready()
			// A fresh OS process reads only these disposable room/control tables; credentials enter on stdin, never argv/logs.
			const childSource = `
              import {readFileSync} from 'node:fs';
              const input=JSON.parse(readFileSync(0,'utf8'));
              const {crateSql}=await import(${JSON.stringify(
								new URL("./repository.server.ts", import.meta.url).href
							)});
              const {RelationalProposalRepository}=await import(${JSON.stringify(
								new URL("./proposal-relational-repository.ts", import.meta.url)
									.href
							)});
              const {ReleaseControl}=await import(${JSON.stringify(
								new URL("./proposal-release-control.ts", import.meta.url).href
							)});
              const {ProposalService}=await import(${JSON.stringify(
								new URL("./proposal-service.server.ts", import.meta.url).href
							)});
              const {proposalFixtureCatalog}=await import(${JSON.stringify(
								new URL("./proposal-test-support.ts", import.meta.url).href
							)});
              const sql=crateSql(input.origin,'crate','');
              const service=new ProposalService(new RelationalProposalRepository(sql,input.secret),proposalFixtureCatalog,input.secret,async()=>{},Date.now,new ReleaseControl(sql,input.policy));
              let s; for(let attempt=0;attempt<65;attempt++){try{s=await service.read(input.id,input.credential);break}catch(error){if(error.status!==503 || attempt===64)throw error;await new Promise(r=>setTimeout(r,500))}}
              console.log(JSON.stringify({actor:s.own.participantId,host:s.shared.hostParticipantId,sequence:s.own.nextSequence}));
            `
			const recoveredChild = JSON.parse(
				execFileSync(
					process.execPath,
					["--input-type=module", "-e", childSource],
					{
						encoding: "utf8",
						input: JSON.stringify({
							origin: `http://127.0.0.1:${port}`,
							secret,
							policy,
							id,
							credential: credential(first),
						}),
					}
				)
			)
			assert.equal(recoveredChild.actor, first.credential.participantId)
			assert.equal(recoveredChild.host, first.credential.participantId)
			assert.equal(recoveredChild.sequence, 3)
			a = build(sql)
			b = build(sql)
			const resumed = await a.read(id, credential(first))
			assert.equal(resumed.own.participantId, first.credential.participantId)
			assert.equal(
				resumed.shared.hostParticipantId,
				first.credential.participantId
			)
			assert.equal(resumed.own.nextSequence, 3)
			assert.equal(
				(await b.command(id, credential(first), cmd1)).receipt.replayed,
				true
			)
			await assert.rejects(
				b.create(request()),
				(e: RoomError) => e.status === 503
			)
			await assert.rejects(
				new ReleaseControl(sql, { ...policy, rooms: 4 }).check(),
				/mismatch/
			)
			// Controlled fixture expiry on this disposable store only: keep room expiry and reservation expiry identical.
			const repository = new RelationalProposalRepository(sql, secret)
			const stored = (await repository.read(id))!,
				dbNow = Number((await sql("SELECT CURRENT_TIMESTAMP")).rows[0][0]),
				expiredAt = dbNow - 1
			const expired = structuredClone(stored.room)
			expired.expiresAt = expiredAt
			expired.revision++
			assert.equal(await repository.compareAndSwap(stored, expired, true), true)
			const row = (
				await sql(
					`SELECT ${CONTROL_COLUMNS.join(
						","
					)} FROM ${CONTROL_TABLE} WHERE id=?`,
					["proposal3"]
				)
			).rows[0]
			const state = controlState(
				Object.fromEntries(CONTROL_COLUMNS.map((k, i) => [k, row[i]]))
			)
			state.rooms.find((r) => r[0] === id)![2] = expiredAt
			// Reset only budget-window fixture to the previous SQL minute, exercising rollover without waiting a minute.
			state.window = Math.floor(dbNow / 60000) - 1
			const changed = CONTROL_COLUMNS.filter((k) => k !== "id"),
				typed = controlRow(state)
			await sql(
				`UPDATE ${CONTROL_TABLE} SET ${changed
					.map((k) => `${k}=?`)
					.join(",")} WHERE id=?`,
				[...changed.map((k) => typed[k]), "proposal3"]
			)
			await assert.rejects(
				a.read(id, credential(first)),
				(e: RoomError) => e.status === 410
			)
			const replacement = await b.create(request())
			assert.notEqual(replacement.credential.roomId, id)
			assert.equal(
				(await new ReleaseControl(sql, policy).summary()).activeReservations,
				3
			)
			// Existing repository's database-side insert fence refuses an expired delayed room; no reservation can resurrect it.
			const delayed = { ...expired, id: "delayed-expired-fixture" }
			await assert.rejects(repository.insert(delayed))
			assert.equal(await repository.read(delayed.id), null)
			const purge = operate("purge-expired", "--apply", "--writers-stopped")
			assert.equal(purge.deleted["doc.yepwatch_room"], 1)
			assert.equal(await repository.read(id), null)
			assert.ok(await repository.read(replacement.credential.roomId))
			// Restore the complete quiesced typed backup into an empty store in THIS disposable container only.
			// No shared database or retained services are used by this harness.
			const names = [...new Set(backupRows.map((r) => r.table))]
			for (const table of names) await sql(`DELETE FROM ${table}`)
			for (const row of backupRows) {
				const keys = Object.keys(row.columns)
				await sql(
					`INSERT INTO ${row.table} (${keys.join(",")}) VALUES (${keys
						.map(() => "?")
						.join(",")})`,
					keys.map((k) => row.columns[k])
				)
			}
			const restored = build(sql)
			assert.equal(
				(await restored.read(id, credential(first))).own.participantId,
				first.credential.participantId
			)

			console.log(
				JSON.stringify({
					proof: "disposable-control-crate",
					apiInstances: 2,
					concurrentCreates: 9,
					accepted: 3,
					globalCap: 3,
					lostControlAndRoomAckRecovered: true,
					admissionAndCommandLimits: true,
					exactReplay: true,
					restartRecovery: true,
					expiryReplacement: true,
					delayedExpiredInsertDenied: true,
					expiredTypedCleanup: true,
					typedBackupRestore: true,
					productionAccess: false,
				})
			)
		} finally {
			for (const server of servers)
				await new Promise<void>((resolve) => server.close(() => resolve()))
			try {
				docker("rm", "-f", name)
			} catch {}
		}
	}
)
