import test from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { SqlMemberSessions } from "./member-session-store.ts"
import { crateSql, type Sql } from "./repository.server.ts"
import { memberSessionTable, revokedSessionTable, tableDdl } from "./proposal-storage-schema.ts"
import { IndeterminateWrite } from "./errors.ts"

const enabled = process.env.YEPWATCH_TEST_RELATIONAL_CRATE === "1"
const secret = "disposable-member-session-proof-at-least-thirty-two"
const docker = (...args: string[]) => execFileSync("docker", args, { encoding: "utf8" }).trim()

test(
	"Crate member sessions: CAS, lost replies, keyed user deletion and bounded expiry",
	{ skip: !enabled, timeout: 120000 },
	async (t) => {
		const name = `yepwatch-member-session-test-${process.pid}`
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
			`-Ccluster.name=${name}`,
		)
		t.after(() => {
			docker("rm", "-f", name)
		})
		const port = docker("port", name, "4200").split(":").at(-1)!
		const raw = crateSql(`http://127.0.0.1:${port}`, "crate", "")
		for (let i = 0; ; i++) {
			try {
				await raw("SELECT 1")
				break
			} catch (error) {
				if (i > 100) throw error
				await new Promise((resolve) => setTimeout(resolve, 300))
			}
		}
		await raw(tableDdl(memberSessionTable, 0))
		await raw(tableDdl(revokedSessionTable, 0))
		let lose = false
		const sql: Sql = async (stmt, args) => {
			const result = await raw(stmt, args)
			if (lose && /^(INSERT|UPDATE) /.test(stmt)) {
				lose = false
				throw new IndeterminateWrite("Lost session write reply")
			}
			return result
		}
		const a = new SqlMemberSessions(sql, secret)
		const b = new SqlMemberSessions(raw, secret)
		const now = Date.now()
		const value = {
			session: {
				v: 1 as const,
				sessionId: "one",
				userId: "alice",
				displayName: null,
				accessToken: "access-one",
				expiresAt: now + 300000,
				refreshToken: "refresh-one",
			},
			expiresAt: now + 90 * 86400000,
		}
		const inserted = await Promise.all([
			a.compareAndSwap("one", null, value),
			b.compareAndSwap("one", null, value),
		])
		assert.deepEqual(inserted.sort(), [false, true])
		const old = (await a.read("one"))!
		const newer = {
			...value,
			session: { ...value.session, accessToken: "access-two", refreshToken: "refresh-two" },
			expiresAt: value.expiresAt + 1000,
		}
		const updated = await Promise.all([
			a.compareAndSwap("one", old, newer),
			b.compareAndSwap("one", old, newer),
		])
		assert.deepEqual(updated.sort(), [false, true])
		assert.deepEqual((await a.read("one"))?.value, newer)
		lose = true
		assert.equal(await a.compareAndSwap("lost-insert", null, value), false)
		assert.deepEqual((await b.read("lost-insert"))?.value, value)
		lose = true
		assert.equal(
			await a.compareAndSwap("lost-insert", (await a.read("lost-insert"))!, newer),
			false,
		)
		assert.deepEqual((await b.read("lost-insert"))?.value, newer)
		await a.compareAndSwap("peer", null, { ...value, session: { ...value.session, userId: "bob" } })
		await raw("REFRESH TABLE doc.yepwatch_member_session")
		const rows = (
			await raw("SELECT id,user_key,session_ciphertext,expires_at FROM doc.yepwatch_member_session")
		).rows
		assert.ok(
			rows.every(
				(row) => row[0] !== "one" && row[1] !== "alice" && !String(row[2]).includes("refresh-one"),
			),
		)
		assert.ok(rows.every((row) => Number(row[3]) >= value.expiresAt))
		await a.deleteUser("alice")
		assert.equal(await a.read("one"), null)
		assert.equal(await a.read("lost-insert"), null)
		assert.ok(await a.read("peer"))
		await a.compareAndSwap("expired", null, { ...value, expiresAt: now - 1 })
		await a.purgeExpired(now)
		assert.equal(await a.read("expired"), null)
		assert.ok(await a.read("peer"))
		await a.delete("peer")
		assert.equal(await a.read("peer"), null)
	},
)
