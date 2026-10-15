// auth-answers.ts on the Supabase path of the account pages (BETTER_AUTH_ENABLED off): how a password action's answer
// reads, how a session the server stored becomes the browser's sign-in, and how a screen without a form hears a failure.
import "../server/title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"

const { adoptServerSession, routeOutcome, whenAuthFails } = await import("./auth-answers.ts")

test("a password Supabase rejected keeps its reason; a dead link and an outage read as before", () => {
	assert.deepEqual(routeOutcome(200, { success: true }), { ok: true })
	assert.deepEqual(routeOutcome(422, { error: "New password should be different from the old password." }), {
		ok: false,
		failure: "password",
		message: "New password should be different from the old password.",
	})
	assert.deepEqual(routeOutcome(422, null), { ok: false, failure: "password" })
	assert.deepEqual(routeOutcome(400, { error: "Invalid or expired reset code" }), { ok: false, failure: "invalid" })
	assert.deepEqual(routeOutcome(429, null), { ok: false, failure: "throttled" })
	assert.deepEqual(routeOutcome(503, null), { ok: false, failure: "unavailable" })
})

test("the session a server action stored is set again, so the client announces the sign-in", async () => {
	const set: unknown[] = []
	const client = (session: { access_token: string; refresh_token: string } | null, error: unknown = null) => ({
		auth: {
			getSession: async () => ({ data: { session } }),
			setSession: async (tokens: { access_token: string; refresh_token: string }) => {
				set.push(tokens)
				return { error }
			},
		},
	})
	assert.equal(await adoptServerSession(client({ access_token: "a", refresh_token: "r" })), true)
	assert.deepEqual(set, [{ access_token: "a", refresh_token: "r" }])
	assert.equal(await adoptServerSession(client(null)), false)
	assert.equal(await adoptServerSession(client({ access_token: "a", refresh_token: "r" }, new Error("expired"))), false)
	assert.equal(await adoptServerSession(null), false)
	assert.equal(set.length, 2)
})

test("a failed or throwing sign-in reaches the screen's message; a working one doesn't", async () => {
	const said: string[] = []
	const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
	whenAuthFails(Promise.resolve({ ok: false, failure: "unavailable" } as const), () => said.push("failed"))
	whenAuthFails(Promise.reject(new Error("chunk failed")), () => said.push("threw"))
	whenAuthFails(Promise.resolve({ ok: true } as const), () => said.push("worked"))
	await settle()
	assert.deepEqual(said.sort(), ["failed", "threw"])
})
