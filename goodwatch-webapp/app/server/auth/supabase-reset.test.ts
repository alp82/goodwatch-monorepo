import assert from "node:assert/strict"
import { test } from "node:test"
import { type SupabaseResetAuth, resetSupabasePassword } from "./supabase-reset.server.ts"

function fakeAuth(options: {
	exchange?: unknown
	user?: unknown
	update?: { message: string; code?: string; status?: number } | null
}) {
	const calls: string[] = []
	const auth: SupabaseResetAuth = {
		async exchangeCodeForSession(code) {
			calls.push(`exchange:${code}`)
			return { error: options.exchange ?? null }
		},
		async getUser() {
			calls.push("getUser")
			return { data: { user: options.user ?? null } }
		},
		async updateUser({ password }) {
			calls.push(`update:${password}`)
			return { error: options.update ?? null }
		},
	}
	return { auth, calls }
}

test("a valid code and password save the password", async () => {
	const { auth, calls } = fakeAuth({})
	assert.deepEqual(await resetSupabasePassword(auth, "code", "long enough pw"), {
		status: 200,
		body: { success: true },
	})
	assert.deepEqual(calls, ["exchange:code", "update:long enough pw"])
})

test("a spent or expired code without a session is an expired link", async () => {
	const { auth, calls } = fakeAuth({ exchange: new Error("invalid grant") })
	const answer = await resetSupabasePassword(auth, "old", "long enough pw")
	assert.equal(answer.status, 400)
	assert.equal("code" in answer.body && answer.body.code, "expired")
	assert.deepEqual(calls, ["exchange:old", "getUser"])
})

test("a password Supabase rejects keeps Supabase's reason, not an expired link", async () => {
	const { auth } = fakeAuth({
		update: { message: "New password should be different from the old password.", code: "same_password", status: 422 },
	})
	assert.deepEqual(await resetSupabasePassword(auth, "code", "long enough pw"), {
		status: 422,
		body: { error: "New password should be different from the old password.", code: "same_password" },
	})
})

test("a second try after a rejection saves under the session the first try made", async () => {
	const { auth, calls } = fakeAuth({ exchange: new Error("code already used"), user: { id: "member" } })
	assert.equal((await resetSupabasePassword(auth, "code", "another long pw")).status, 200)
	assert.deepEqual(calls, ["exchange:code", "getUser", "update:another long pw"])
})

test("a short password, a throttled save and an outage get their own answers", async () => {
	assert.equal((await resetSupabasePassword(fakeAuth({}).auth, "code", "short")).status, 422)
	assert.equal((await resetSupabasePassword(fakeAuth({}).auth, "", "long enough pw")).status, 400)
	const throttled = fakeAuth({ update: { message: "Too many requests", status: 429 } })
	assert.equal((await resetSupabasePassword(throttled.auth, "code", "long enough pw")).status, 429)
	const down = fakeAuth({ update: { message: "upstream", status: 502 } })
	assert.equal((await resetSupabasePassword(down.auth, "code", "long enough pw")).status, 503)
})
