import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import {
	authorizeUrl,
	requireLinkOrigin,
	callbackUri,
	consumeState,
	createState,
	discordIdentity,
	type StateStore,
} from "./oauth.server.ts"
import { finishLink } from "./link-callback.server.ts"
import { LinkingUnavailable } from "./link.server.ts"
function states() {
	const values = new Map<string, string>()
	const store: StateStore = {
		put: async (key, value, ttl) => {
			assert.equal(ttl, 600)
			values.set(key, value)
		},
		take: async (key) => {
			const value = values.get(key) ?? null
			values.delete(key)
			return value
		},
	}
	return store
}
const callback = (state: string, cookie: string, query = "&code=secret-code") =>
	new Request(
		`https://goodwatch.app/discord/link/callback?state=${state}${query}`,
		{ headers: { Cookie: cookie.split(";")[0] } },
	)
test("state expires in ten minutes, is single-use, and has a secure browser-only cookie", async () => {
	const store = states(),
		{ state, cookie } = await createState("member", store, 1000)
	assert.match(cookie, /HttpOnly; SameSite=Lax; Max-Age=600; Secure/)
	await consumeState(callback(state, cookie), "member", store, 600999)
	await assert.rejects(
		consumeState(callback(state, cookie), "member", store, 600999),
		/already used/,
	)
	const expired = await createState("member", store, 1000)
	await assert.rejects(
		consumeState(
			callback(expired.state, expired.cookie),
			"member",
			store,
			601000,
		),
		/expired/,
	)
})
for (const mismatch of ["cookie", "user", "signed-out"] as const)
	test(`state rejects ${mismatch} mismatch and consumes it`, async () => {
		const store = states(),
			{ state, cookie } = await createState("member", store)
		const request = callback(
			state,
			mismatch === "cookie" ? "gw_discord_state=wrong" : cookie,
		)
		await assert.rejects(
			consumeState(
				request,
				mismatch === "user"
					? "other"
					: mismatch === "signed-out"
					? undefined
					: "member",
				store,
			),
			/same/,
		)
		await assert.rejects(
			consumeState(callback(state, cookie), "member", store),
			/already used/,
		)
	})
test("parallel callbacks can only consume state once", async () => {
	const store = states(),
		{ state, cookie } = await createState("member", store)
	const results = await Promise.allSettled([
		consumeState(callback(state, cookie), "member", store),
		consumeState(callback(state, cookie), "member", store),
	])
	assert.equal(results.filter((r) => r.status === "fulfilled").length, 1)
})
test("authorize uses identify and the configured callback, without prompt=none", () => {
	const url = new URL(authorizeUrl("state"))
	assert.equal(url.searchParams.get("scope"), "identify")
	assert.equal(url.searchParams.get("redirect_uri"), callbackUri())
	assert.equal(url.searchParams.get("response_type"), "code")
	assert.equal(url.searchParams.has("prompt"), false)
})
test("code exchange posts form data then identifies with the short-lived bearer token", async () => {
	const calls: { url: string; init?: RequestInit }[] = []
	const identity = await discordIdentity("private-code", async (url, init) => {
		calls.push({ url: String(url), init })
		return Response.json(
			calls.length === 1
				? { access_token: "private-token" }
				: { id: "123", username: "tester" },
		)
	})
	assert.deepEqual(identity, { id: "123", username: "tester" })
	assert.equal(calls[0].url, "https://discord.com/api/v10/oauth2/token")
	assert.equal(calls[0].init?.method, "POST")
	const form = calls[0].init?.body as URLSearchParams
	assert.equal(form.get("code"), "private-code")
	assert.equal(form.get("grant_type"), "authorization_code")
	assert.equal(form.get("redirect_uri"), callbackUri())
	assert.equal(calls[1].url, "https://discord.com/api/v10/users/@me")
	assert.equal(
		new Headers(calls[1].init?.headers).get("Authorization"),
		"Bearer private-token",
	)
	assert.equal(calls[2].url, "https://discord.com/api/v10/oauth2/token/revoke")
	assert.equal(calls[2].init?.method, "POST")
	const revoke = calls[2].init?.body as URLSearchParams
	assert.equal(revoke.get("token"), "private-token")
	assert.equal(revoke.get("token_type_hint"), "access_token")
	assert.equal(revoke.get("client_id"), process.env.DISCORD_APP_ID ?? "")
	assert.equal(
		revoke.get("client_secret"),
		process.env.DISCORD_CLIENT_SECRET ?? "",
	)
	await assert.rejects(
		discordIdentity(
			"private-code",
			async () => new Response("private-token", { status: 400 }),
		),
		(error) => error instanceof Error && !/private/.test(error.message),
	)
})
test("callback links only after state and identity validation, clears cookie, and handles denial", async () => {
	const store = states(),
		{ state, cookie } = await createState("member", store)
	const links: string[][] = []
	const deps = {
		userId: async () => "member",
		consume: (req: Request, user: string | undefined) =>
			consumeState(req, user, store),
		identity: async () => ({ id: "123", username: "tester" }),
		link: async (...args: string[]) => {
			links.push(args)
		},
	}
	const result = await finishLink(callback(state, cookie), deps)
	assert.equal(result.username, "tester")
	assert.equal(result.status, "linked")
	assert.match(result.cookie, /Max-Age=0/)
	assert.deepEqual(links, [["123", "member", "tester"]])
	assert.ok((await finishLink(callback(state, cookie), deps)).error)
	assert.equal(links.length, 1)
	const denied = await createState("member", store)
	assert.match(
		(
			await finishLink(
				callback(denied.state, denied.cookie, "&error=access_denied"),
				deps,
			)
		).error!,
		/cancelled/,
	)
	assert.equal(links.length, 1)
})
test("missing production table yields a friendly callback result", async () => {
	const result = await finishLink(
		new Request("https://goodwatch.app/discord/link/callback?code=private"),
		{
			userId: async () => "member",
			consume: async () => {},
			identity: async () => ({ id: "123", username: "tester" }),
			link: async () => {
				throw new LinkingUnavailable()
			},
		},
	)
	assert.match(result.error!, /Linking isn't available yet/)
	assert.equal(result.username, null)
	assert.equal(result.status, "unavailable")
})

test("link writes accept the public HTTPS origin behind an HTTP proxy and reject missing or foreign origins", () => {
	const previous = process.env.APP_ORIGIN
	process.env.APP_ORIGIN = "https://goodwatch.app"
	try {
		const request = (origin?: string) =>
			new Request("http://goodwatch.app/discord/link", {
				method: "POST",
				headers: origin ? { Origin: origin } : {},
			})
		assert.doesNotThrow(() =>
			requireLinkOrigin(request("https://goodwatch.app")),
		)
		for (const origin of [
			undefined,
			"https://other.example",
			"http://goodwatch.app",
		])
			assert.throws(
				() => requireLinkOrigin(request(origin)),
				(error) => error instanceof Response && error.status === 403,
			)
	} finally {
		if (previous === undefined) delete process.env.APP_ORIGIN
		else process.env.APP_ORIGIN = previous
	}
})
for (const failure of ["network", "http"])
	test(`revocation ${failure} failures do not prevent linking`, async () => {
		let calls = 0
		const result = await discordIdentity("code", async () => {
			calls++
			if (calls === 1) return Response.json({ access_token: "token" })
			if (calls === 2) return Response.json({ id: "123", username: "tester" })
			if (failure === "network") throw new Error("offline")
			return new Response(null, { status: 500 })
		})
		assert.equal(result.id, "123")
		assert.equal(calls, 3)
	})
test("failed identity reads still revoke the token", async () => {
	const urls: string[] = []
	await assert.rejects(
		discordIdentity("code", async (url) => {
			urls.push(String(url))
			return urls.length === 1
				? Response.json({ access_token: "token" })
				: new Response(null, { status: 500 })
		}),
	)
	assert.equal(urls[2], "https://discord.com/api/v10/oauth2/token/revoke")
})

test("OAuth state carries only the stored message nonce, never the callback query nonce", async () => {
	const store = states()
	const nonce = "a".repeat(24)
	const { state, cookie } = await createState("member", store, 1000, nonce)
	assert.deepEqual(
		await consumeState(
			callback(state, cookie, `&n=${"b".repeat(24)}`),
			"member",
			store,
			2000,
		),
		{ nonce },
	)
	const plain = await createState("member", store, 1000)
	assert.deepEqual(
		await consumeState(
			callback(plain.state, plain.cookie, `&n=${nonce}`),
			"member",
			store,
			2000,
		),
		{ nonce: undefined },
	)
})
