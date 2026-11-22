import assert from "node:assert/strict"
import test from "node:test"
import type { User } from "@supabase/auth-js"
import { legacyAvatarLogin } from "./legacy-avatar-login.ts"

const post = (options: RequestInit = {}) =>
	new Request("https://goodwatch.app/api/profile/avatar-refresh", { method: "POST", ...options })

test("legacy avatar refresh accepts only a verified session on a same-site POST", async () => {
	for (const [request, enabled, status] of [
		[post({ method: "GET" }), false, 405],
		[post({ headers: { "Sec-Fetch-Site": "cross-site" } }), false, 403],
		[post(), true, 404],
	] as const) {
		const res = await legacyAvatarLogin(
			request,
			enabled,
			async () => assert.fail(),
			async () => assert.fail(),
		)
		assert.equal(res.status, status)
	}
	const result = await legacyAvatarLogin(
		post(),
		false,
		async ({ fresh }) => {
			assert.equal(fresh, true)
			return null
		},
		async () => assert.fail(),
	)
	assert.equal(result.status, 401)
})

test("legacy refresh binds the upstream picture and login time to the auth server's identity", async () => {
	const picture = "https://lh3.googleusercontent.com/a/verified"
	const login = "2026-11-23T00:00:00Z"
	const user: User = {
		id: "member",
		aud: "authenticated",
		app_metadata: {},
		user_metadata: { avatar_url: "ignored" },
		created_at: login,
		last_sign_in_at: login,
		identities: [
			{
				id: "google-id",
				identity_id: "identity",
				user_id: "member",
				provider: "google",
				identity_data: { picture },
			},
		],
	}
	const request = post({
		body: JSON.stringify({ userId: "intruder", picture: "https://example.com", at: Date.now() }),
	})
	const calls: { id: string; at: number; photo?: string | null }[] = []
	const res = await legacyAvatarLogin(
		request,
		false,
		async () => user,
		async (id, signIn) => calls.push({ id, ...signIn }),
	)
	assert.equal(res.status, 204)
	assert.deepEqual(calls, [{ id: "member", photo: picture, at: Date.parse(login) }])
})
