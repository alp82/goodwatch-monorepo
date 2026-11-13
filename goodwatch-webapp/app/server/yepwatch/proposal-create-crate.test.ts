import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { crateSql, type Sql } from "./repository.server.ts"
import { RelationalProposalRepository } from "./proposal-relational-repository.ts"
import { provisionReleaseStore } from "./proposal-release-store.ts"
import { ReleaseControl, provisionControl, DEFAULT_CONTROL } from "./proposal-release-control.ts"
import { SqlCreationQuotas } from "./proposal-creation-quota.ts"
import { ProposalService } from "./proposal-service.server.ts"
import { proposalFixtureCatalog } from "./proposal-test-support.ts"
import { IndeterminateWrite } from "./errors.ts"

const enabled = process.env.YEPWATCH_TEST_RELATIONAL_CRATE === "1"
const secret = "create-crate-secret-at-least-thirty-two-chars"
const docker = (...args: string[]) => execFileSync("docker", args, { encoding: "utf8" }).trim()
const admission = () => ({
	contractVersion: 3 as const,
	commandId: randomBytes(16).toString("hex"),
	admissionSecret: randomBytes(32).toString("base64url"),
	nickname: "Host",
})
/** Statements with their start and end, to find the longest chain of statements that ran one after another. */
function recorder(sql: Sql) {
	let log: { stmt: string; start: number; end: number }[] = []
	const recording: Sql = async (stmt, args) => {
		const entry = { stmt, start: performance.now(), end: Infinity }
		log.push(entry)
		try {
			return await sql(stmt, args)
		} finally {
			entry.end = performance.now()
		}
	}
	return {
		sql: recording,
		take() {
			const taken = log
			log = []
			return taken
		},
	}
}
/** The most statements of `log` that ran strictly one after another: the round trips the caller waited for. */
function sequentialDepth(log: { start: number; end: number }[]) {
	const sorted = [...log].sort((a, b) => a.end - b.end)
	const depth = sorted.map(() => 1)
	for (let i = 0; i < sorted.length; i++)
		for (let j = 0; j < i; j++) if (sorted[j].end <= sorted[i].start) depth[i] = Math.max(depth[i], depth[j] + 1)
	return Math.max(0, ...depth)
}

test(
	"create on the release store: few round trips in sequence, no read-backs, answered as stored, retries and lost acknowledgements",
	{ skip: !enabled, timeout: 180000 },
	async (t) => {
		const name = `yepwatch-create-test-${process.pid}`
		docker("run", "-d", "--name", name, "-p", "127.0.0.1::4200", "-e", "CRATE_HEAP_SIZE=512m", "crate:6.4.6", "crate", "-Cdiscovery.type=single-node", "-Ccluster.name=" + name)
		t.after(() => {
			docker("rm", "-f", name)
		})
		const port = docker("port", name, "4200/tcp").split(":").at(-1)
		const sql = crateSql(`http://127.0.0.1:${port}`, "crate", "")
		for (let i = 0; ; i++) {
			try {
				await sql("SELECT 1")
				break
			} catch (e) {
				if (i > 100) throw e
				await new Promise((r) => setTimeout(r, 300))
			}
		}
		await provisionReleaseStore(sql, 0, "create-test", secret)
		const policy = { ...DEFAULT_CONTROL, admissions: 120 }
		await provisionControl(sql, policy, 0)
		let loseHead = false,
			dropProof = false
		const flaky: Sql = async (stmt, args) => {
			if (dropProof && stmt.startsWith("INSERT INTO doc.yepwatch_creation_reservation ")) {
				dropProof = false
				throw new IndeterminateWrite("proof insert lost before it landed")
			}
			const result = await sql(stmt, args)
			if (loseHead && stmt.startsWith("INSERT INTO doc.yepwatch_room ")) {
				loseHead = false
				throw new IndeterminateWrite("lost head acknowledgement")
			}
			return result
		}
		const r = recorder(flaky)
		const service = () =>
			new ProposalService(
				new RelationalProposalRepository(r.sql, secret),
				proposalFixtureCatalog,
				secret,
				undefined,
				Date.now,
				new ReleaseControl(r.sql, policy, new SqlCreationQuotas(r.sql, 10))
			)
		const a = service()
		// A creator's first room (no allowance row yet), then a second one.
		for (const label of ["first room", "second room"]) {
			r.take()
			const created = await a.create(admission(), undefined, "creator-1")
			const log = r.take()
			const depth = sequentialDepth(log)
			t.diagnostic(`${label}: ${log.length} statements, ${depth} in sequence`)
			assert.ok(depth <= 5, `${label}: ${depth} statements in sequence:\n${log.map((l) => l.stmt.slice(0, 70)).join("\n")}`)
			assert.equal(log.filter((l) => l.stmt.startsWith("SELECT") && l.stmt.includes("FROM doc.yepwatch_room ")).length, 1, "one room read")
			assert.equal(log.filter((l) => l.stmt.includes("doc.yepwatch_invitation")).length, 1, "the invite is written once and not read back")
			assert.equal(log.filter((l) => l.stmt === "SELECT CURRENT_TIMESTAMP").length, 0)
			// The answer is what another process reading the stored room gives.
			const fresh = new ProposalService(new RelationalProposalRepository(sql, secret), proposalFixtureCatalog, secret, undefined, Date.now, new ReleaseControl(sql, policy, new SqlCreationQuotas(sql, 10)))
			const read = await fresh.read(created.credential.roomId, { participantId: created.credential.participantId, token: created.credential.token })
			assert.deepEqual(created.snapshot, read)
			const invited = await fresh.resolveInvite(created.invite.code)
			assert.equal(invited.roomId, created.credential.roomId)
		}
		// An exact retry, here from another process: the same admission, nothing charged or written.
		const request = admission()
		const created = await a.create(request, undefined, "creator-1")
		r.take()
		const retry = await service().create(request, undefined, "creator-1")
		assert.deepEqual(retry.credential, created.credential)
		assert.deepEqual(retry.invite, created.invite)
		// (Recovering the invite re-inserts its mapping with ON CONFLICT DO NOTHING, a no-op, as it always has.)
		const writes = r.take().filter((l) => !l.stmt.startsWith("SELECT") && !l.stmt.startsWith("INSERT INTO doc.yepwatch_invitation "))
		assert.deepEqual(writes.map((l) => l.stmt.slice(0, 40)), [], "a retry charges and writes nothing")
		// A lost head acknowledgement is resolved by reading the room: the same room, answered once.
		loseHead = true
		const lost = await a.create(admission(), undefined, "creator-2")
		const read = await service().read(lost.credential.roomId, { participantId: lost.credential.participantId, token: lost.credential.token })
		assert.equal(read.shared.roomId, lost.credential.roomId)
		// The room's capacity proof is written alongside the invite and records: when it didn't land, nothing names
		// the room, the create fails retryably, and the same request then finishes it.
		const rooms = async () => {
			await sql("REFRESH TABLE doc.yepwatch_room")
			return Number((await sql("SELECT count(*) FROM doc.yepwatch_room")).rows[0][0])
		}
		const before = await rooms()
		dropProof = true
		const unproven = admission()
		await assert.rejects(a.create(unproven, undefined, "creator-3"), { code: "busy" })
		assert.equal(await rooms(), before, "no room head without its proof")
		const finished = await a.create(unproven, undefined, "creator-3")
		assert.equal((await sql("SELECT count(*) FROM doc.yepwatch_room WHERE id=?", [finished.credential.roomId])).rows[0][0], 1)
		assert.equal((await sql("SELECT count(*) FROM doc.yepwatch_creation_reservation WHERE room_id=?", [finished.credential.roomId])).rows[0][0], 1)
		// Every room holds its creator's allowance: the eleventh of one creator is refused.
		for (let i = 0; i < 7; i++) await a.create(admission(), undefined, "creator-1")
		await assert.rejects(a.create(admission(), undefined, "creator-1"), { code: "limit_reached" })
	}
)
