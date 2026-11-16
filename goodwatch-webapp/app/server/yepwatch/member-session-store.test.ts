import { codec } from "./crypto.server.ts"
import test from "node:test"
import assert from "node:assert/strict"
import { MemoryMemberSessions, SqlMemberSessions } from "./member-session-store.ts"
import type { Sql } from "./repository.server.ts"
import { releaseMembers, releaseMemberConfig } from "./proposal-release-members.ts"
import { ProposalMemoryRepository } from "./proposal-test-support.ts"

const secret = "member-store-unit-test-secret-at-least-thirty-two"

test("SQL session encryption rejects a short secret at construction", () => {
	const sql: Sql = async () => {
		throw new Error("must not contact storage")
	}
	assert.throws(() => new SqlMemberSessions(sql, "short"), /at least 32/)
	assert.ok(new SqlMemberSessions(sql, "a".repeat(32)))
})

for (const code of [
	"ECONNREFUSED",
	"ENOTFOUND",
	"EAI_AGAIN",
	"CERT_HAS_EXPIRED",
	"ERR_TLS_CERT_ALTNAME_INVALID",
	"UND_ERR_CONNECT_TIMEOUT",
	"ECONNRESET",
	"UND_ERR_SOCKET",
	"ETIMEDOUT",
]) {
	test(`refresh transport ${code}: only proven connect failures release the rotation`, async () => {
		const store = new MemoryMemberSessions()
		const origin = "https://yepwatch.example"
		const config = releaseMemberConfig(
			{
				YEPWATCH_MEMBER_ENABLED: "true",
				YEPWATCH_MEMBER_ISSUER_ORIGIN: "https://goodwatch.example",
				AUTH_YEPWATCH_CLIENT_ID: "yepwatch",
				AUTH_YEPWATCH_RESOURCE: `${origin}/api/yepwatch`,
				AUTH_YEPWATCH_REDIRECT_URIS: `${origin}/api/yepwatch/v1/proposal/member/callback`,
			},
			origin,
		)!
		let calls = 0
		const transport: typeof fetch = async () => {
			calls++
			throw Object.assign(new TypeError("fetch failed"), {
				cause: Object.assign(new Error("transport"), { code }),
			})
		}
		const members = releaseMembers(new ProposalMemoryRepository(), config, transport, secret, store)
		const session = members.sealSession({
			v: 1,
			sessionId: "device",
			userId: "member",
			displayName: null,
			accessToken: "old",
			refreshToken: "refresh",
			expiresAt: Date.now() - 1,
		})
		const result = await members.account(session)
		assert.equal(result.status.state === "member" && result.status.unavailable, true)
		const ambiguous = ["ECONNRESET", "UND_ERR_SOCKET", "ETIMEDOUT"].includes(code)
		assert.equal((await store.read("device"))?.value.rotating === true, ambiguous)
		assert.equal(calls, ambiguous ? 2 : 1)
	})
}

test("expiry sweep bounds its page, preserves a live refresh and deletes with OCC", async () => {
	const cipher = codec(`member-store\0${secret}`)
	const now = 1000000
	const session = {
		v: 1 as const,
		userId: "member",
		displayName: null,
		accessToken: "access",
		expiresAt: now - 1,
		refreshToken: "refresh",
	}
	const rows = [
		["expired", 7, 1, cipher.encode({ session, expiresAt: now - 1 }, "expired")],
		[
			"refreshing",
			8,
			2,
			cipher.encode(
				{ session, expiresAt: now - 1, owner: "worker", leaseUntil: now + 1000 },
				"refreshing",
			),
		],
	]
	const deleted: unknown[][] = []
	const sql: Sql = async (stmt, args = []) => {
		if (stmt.startsWith("SELECT")) {
			assert.ok(stmt.includes("LIMIT 100"))
			return { rows, rowcount: rows.length }
		}
		if (stmt.startsWith("DELETE")) {
			assert.ok(stmt.includes("AND _seq_no=? AND _primary_term=?"))
			deleted.push(args)
		}
		return { rows: [], rowcount: 1 }
	}
	await new SqlMemberSessions(sql, secret).purgeExpired(now)
	assert.deepEqual(deleted, [["expired", 7, 1]])
})
