import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes, createHash } from "node:crypto"
import { releaseMembers, releaseMemberConfig } from "./proposal-release-members.ts"
import { createMemberResource } from "./member-resource.server.ts"
import { ProposalMemoryRepository, proposalFixtureCatalog } from "./proposal-test-support.ts"
import { ProposalService } from "./proposal-service.server.ts"
import { createProposalHandler, MEMBER_COOKIE, MEMBER_INTENT_COOKIE } from "./proposal-http.server.ts"

const origin = "https://yepwatch.example"
const env = {
	YEPWATCH_MEMBER_ENABLED: "true",
	YEPWATCH_MEMBER_ISSUER_ORIGIN: "https://goodwatch.example",
	AUTH_YEPWATCH_CLIENT_ID: "yepwatch",
	AUTH_YEPWATCH_RESOURCE: `${origin}/api/yepwatch`,
	AUTH_YEPWATCH_REDIRECT_URIS: `${origin}/api/yepwatch/v1/proposal/member/callback`,
}
const secret = "test-account-secret-at-least-thirty-two"
const api = (path: string) => `${origin}/api/yepwatch/v1/proposal${path}`

/** A GoodWatch issuer double: codes become short-lived grants; with `offline` it also hands out refresh tokens, which rotate. */
function setup(options: {
	offline?: boolean
	lifetime?: number | (() => number)
	refreshReply?: () => Response | Promise<Response>
	/** A reply for GoodWatch's identity check instead of the real one (an outage). */
	identityReply?: () => Response | undefined
} = {}) {
	const config = releaseMemberConfig(env, origin)!
	const repo = new ProposalMemoryRepository()
	const service = new ProposalService(repo, proposalFixtureCatalog, secret)
	const grants = new Map<string, number>()
	const calls = { token: [] as URLSearchParams[], verify: 0 }
	/** Refresh tokens rotate: each one redeems once, then GoodWatch refuses it (invalid_grant). */
	const refreshTokens = new Set<string>()
	let issued = 0
	const resource = createMemberResource({
		async verify(token) {
			calls.verify++
			const until = grants.get(token)
			if (!until || until <= Date.now()) throw new Error("expired")
			return { userId: "account-1", expiresAt: until }
		},
		async displayName() { return "Alper" },
		async prefill() { return { country: "DE", serviceIds: [8, 9], savedProgressAvailable: false } },
		async seen() { return [] },
		async progress() { return { source: "goodwatch", shows: [], limitReached: false } },
	})
	const transport: typeof fetch = async (input, init) => {
		const request = new Request(input, init)
		if (new URL(request.url).pathname === "/api/auth/oauth2/token") {
			const form = new URLSearchParams(await request.text())
			calls.token.push(form)
			if (form.get("grant_type") === "refresh_token" && options.refreshReply) return options.refreshReply()
			if (form.get("grant_type") === "refresh_token" && !refreshTokens.delete(form.get("refresh_token")!))
				return Response.json({ error: "invalid_grant" }, { status: 400 })
			const accessToken = `grant-${++issued}`
			const lifetime = typeof options.lifetime === "function" ? options.lifetime() : options.lifetime ?? 300
			grants.set(accessToken, Date.now() + lifetime * 1000)
			if (options.offline) refreshTokens.add(`refresh-${issued}`)
			return Response.json({ access_token: accessToken, expires_in: lifetime, token_type: "Bearer", ...(options.offline ? { refresh_token: `refresh-${issued}` } : {}) })
		}
		return options.identityReply?.() ?? resource(request)
	}
	const members = releaseMembers(repo, config, transport, secret)
	const handler = createProposalHandler(service, { allowedOrigins: [origin], serviceSecret: "test-service-secret-at-least-thirty-two", members })
	return { repo, service, handler, calls, grants }
}
const cookies = (response: Response) =>
	Object.fromEntries(response.headers.getSetCookie().map((c) => {
		const [pair, ...attrs] = c.split("; ")
		const [name, value] = [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)]
		return [name, { value, maxAge: Number(attrs.find((a) => a.startsWith("Max-Age="))?.slice(8)) }]
	}))
async function signIn(handler: ReturnType<typeof setup>["handler"], returnTo: string) {
	const started = await handler(new Request(api("/account/start"), {
		method: "POST", headers: { origin, "content-type": "application/json" },
		body: JSON.stringify({ returnTo, client: "browser" }),
	}))
	assert.equal(started.status, 200)
	const { authorizeUrl, state } = await started.json()
	const intent = cookies(started)[MEMBER_INTENT_COOKIE].value
	assert.ok(intent, "the sign-in intent is bound to this browser")
	const authorize = new URL(authorizeUrl)
	assert.equal(authorize.searchParams.get("state"), state)
	assert.equal(authorize.searchParams.has("prompt"), false, "a signed-in member is not asked to consent again")
	const callback = await handler(new Request(`${api("/member/callback")}?state=${encodeURIComponent(state)}&code=code-1`, {
		headers: { cookie: `${MEMBER_INTENT_COOKIE}=${intent}` },
	}))
	return { callback, state, intent, authorize }
}

test("Continue with GoodWatch signs this browser in without a room and returns to the exact page it started on", async () => {
	const { repo, handler, calls } = setup()
	const { callback, authorize } = await signIn(handler, `${origin}/?open=profile`)
	assert.equal(callback.status, 200)
	assert.match(await callback.text(), /location\.replace\("https:\/\/yepwatch\.example\/\?open=profile"\)/)
	const set = cookies(callback)
	assert.equal(set[MEMBER_INTENT_COOKIE].maxAge, 0, "the one-use intent is cleared")
	const session = set[MEMBER_COOKIE]
	assert.ok(session.value && session.maxAge > 0 && session.maxAge <= 300)
	assert.equal(session.value.includes("grant-"), false, "the grant is sealed, never readable in the cookie")
	// The verifier stays on the server: the token request proves the challenge sent to GoodWatch.
	const verifier = calls.token[0].get("code_verifier")!
	assert.equal(createHash("sha256").update(verifier).digest("base64url"), authorize.searchParams.get("code_challenge"))
	assert.equal(repo.rows.size, 0, "signing in creates no room")
	const status = await handler(new Request(api("/account"), { headers: { cookie: `${MEMBER_COOKIE}=${session.value}` } }))
	assert.deepEqual(await status.json(), { state: "member", displayName: "Alper" })
	const verified = calls.verify
	await handler(new Request(api("/account"), { headers: { cookie: `${MEMBER_COOKIE}=${session.value}` } }))
	assert.equal(calls.verify, verified, "a current session is answered without asking GoodWatch again")
})

test("a callback from another browser, a replayed state or a foreign return page never signs in", async () => {
	const { handler } = setup()
	const first = await signIn(handler, `${origin}/r/ABC234`)
	assert.equal(first.callback.status, 200)
	const other = await handler(new Request(`${api("/member/callback")}?state=${encodeURIComponent(first.state)}&code=code-2`))
	assert.equal(other.status, 401)
	assert.equal(cookies(other)[MEMBER_COOKIE], undefined)
	const foreign = await handler(new Request(api("/account/start"), {
		method: "POST", headers: { origin, "content-type": "application/json" },
		body: JSON.stringify({ returnTo: "https://evil.example/", client: "browser" }),
	}))
	assert.equal(foreign.status, 400)
	const status = await handler(new Request(api("/account"), { headers: { cookie: `${MEMBER_COOKIE}=forged.value.here` } }))
	assert.equal((await status.json()).state, "guest")
})

test("rooms created or joined while signed in link to the device session; Log out keeps those rooms and ends the sign-in", async () => {
	const { handler, repo } = setup()
	const { callback } = await signIn(handler, `${origin}/`)
	const session = cookies(callback)[MEMBER_COOKIE].value
	const created = await handler(new Request(api("/rooms"), {
		method: "POST", headers: { origin, "content-type": "application/json", cookie: `${MEMBER_COOKIE}=${session}` },
		body: JSON.stringify({ contractVersion: 3, commandId: randomBytes(16).toString("hex"), admissionSecret: randomBytes(32).toString("base64url"), nickname: "" }),
	}))
	assert.equal(created.status, 200)
	const admission = await created.json()
	const roomId = admission.credential.roomId
	const roomCookie = cookies(created)[`yepwatch3_${roomId}`].value
	const both = `yepwatch3_${roomId}=${roomCookie}; ${MEMBER_COOKIE}=${session}`
	const linked = await handler(new Request(api(`/rooms/${roomId}/member/link`), { method: "POST", headers: { origin, "content-type": "application/json", cookie: both }, body: "{}" }))
	assert.equal(linked.status, 200)
	assert.equal((await linked.json()).state, "linked")
	const snapshot = await (await handler(new Request(api(`/rooms/${roomId}`), { headers: { cookie: both } }))).json()
	assert.equal(snapshot.own.member.state, "linked")
	const me = snapshot.shared.participants.find((p: { participantId: string }) => p.participantId === snapshot.own.participantId)
	assert.equal(me.nickname, "Alper")
	assert.deepEqual(me.serviceIds, [8, 9])
	assert.equal(JSON.stringify(snapshot).includes("grant-"), false)
	const before = (await repo.read(roomId))!.room.revision
	const again = await handler(new Request(api(`/rooms/${roomId}/member/link`), { method: "POST", headers: { origin, "content-type": "application/json", cookie: both }, body: "{}" }))
	assert.equal((await again.json()).state, "linked")
	assert.equal((await repo.read(roomId))!.room.revision, before, "linking an already linked room changes nothing")
	const out = await handler(new Request(api("/account/logout"), { method: "POST", headers: { origin, "content-type": "application/json", cookie: both }, body: "{}" }))
	assert.equal(out.status, 200)
	assert.equal(cookies(out)[MEMBER_COOKIE].maxAge, 0)
	const guest = await handler(new Request(api("/account"), { headers: { cookie: `yepwatch3_${roomId}=${roomCookie}` } }))
	assert.equal((await guest.json()).state, "guest")
	const kept = await (await handler(new Request(api(`/rooms/${roomId}`), { headers: { cookie: `yepwatch3_${roomId}=${roomCookie}` } }))).json()
	assert.equal(kept.own.member.state, "linked", "rooms linked before Log out keep their GoodWatch services")
	const unlinked = await handler(new Request(api(`/rooms/${roomId}/member/link`), { method: "POST", headers: { origin, "content-type": "application/json", cookie: `yepwatch3_${roomId}=${roomCookie}` }, body: "{}" }))
	assert.equal(unlinked.status, 403)
})

test("native sign-in returns the code to the app link without a room, and the app's verifier redeems a sealed session", async () => {
	const { handler, calls } = setup()
	const verifier = randomBytes(32).toString("base64url")
	const challenge = createHash("sha256").update(verifier).digest("base64url")
	const started = await handler(new Request(api("/account/start"), {
		method: "POST", headers: { "content-type": "application/json", "x-yepwatch-client": "native" },
		body: JSON.stringify({ returnTo: "yepwatch-preview://auth/callback", client: "native", codeChallenge: challenge }),
	}))
	assert.equal(started.status, 200)
	const { state, authorizeUrl } = await started.json()
	assert.equal(new URL(authorizeUrl).searchParams.get("code_challenge"), challenge)
	const callback = await handler(new Request(`${api("/member/callback")}?state=${encodeURIComponent(state)}&code=native-code`))
	const back = new URL(JSON.parse((await callback.text()).match(/location\.replace\((".*?")\)/)![1]))
	assert.equal(`${back.protocol}//${back.host}${back.pathname}`, "yepwatch-preview://auth/callback")
	assert.deepEqual([...back.searchParams.keys()].sort(), ["code", "state"])
	const exchanged = await handler(new Request(api("/account/exchange"), {
		method: "POST", headers: { "content-type": "application/json", "x-yepwatch-client": "native" },
		body: JSON.stringify({ state, code: "native-code", codeVerifier: verifier }),
	}))
	const body = await exchanged.json()
	assert.equal(body.state, "member")
	assert.equal(calls.token.at(-1)!.get("code_verifier"), verifier)
	const status = await handler(new Request(api("/account"), { headers: { "x-yepwatch-member": body.session } }))
	assert.equal((await status.json()).state, "member")
})

test("an expired session renews with a refresh token, and ends when GoodWatch gave none", async () => {
	const renewable = setup({ offline: true, lifetime: 1 })
	const { callback, authorize } = await signIn(renewable.handler, `${origin}/`)
	assert.equal(authorize.searchParams.get("scope"), "yepwatch:read offline_access")
	const session = cookies(callback)[MEMBER_COOKIE]
	assert.ok(session.maxAge > 80 * 86400, "a renewable session outlives its access token")
	const renewed = await renewable.handler(new Request(api("/account"), { headers: { cookie: `${MEMBER_COOKIE}=${session.value}` } }))
	assert.equal((await renewed.json()).state, "member")
	assert.equal(renewable.calls.token.at(-1)!.get("grant_type"), "refresh_token")
	assert.equal(renewable.calls.token.at(-1)!.get("refresh_token"), "refresh-1")
	assert.notEqual(cookies(renewed)[MEMBER_COOKIE].value, session.value, "the rotated grant is sealed into a new cookie")

	const short = setup({ lifetime: 1 })
	const signed = cookies((await signIn(short.handler, `${origin}/`)).callback)[MEMBER_COOKIE]
	const ended = await short.handler(new Request(api("/account"), { headers: { cookie: `${MEMBER_COOKIE}=${signed.value}` } }))
	assert.equal((await ended.json()).state, "guest")
	assert.equal(cookies(ended)[MEMBER_COOKIE].maxAge, 0)
})

test("a browser cookie renewed on a request that claims to be native is never returned to script", async () => {
	const { handler } = setup({ offline: true, lifetime: 1 })
	const session = cookies((await signIn(handler, `${origin}/`)).callback)[MEMBER_COOKIE]
	const renewed = await handler(new Request(api("/account"), {
		headers: { origin, cookie: `${MEMBER_COOKIE}=${session.value}`, "x-yepwatch-client": "native" },
	}))
	const body = await renewed.json()
	assert.equal(body.state, "member")
	assert.equal(body.session, undefined, "the HttpOnly session never appears in the JSON body")
	assert.ok(cookies(renewed)[MEMBER_COOKIE]?.value, "the renewal goes back as a cookie")
})

test("an app session sent in the header still gets its renewal in the body", async () => {
	const { handler } = setup({ offline: true, lifetime: 1 })
	const session = cookies((await signIn(handler, `${origin}/`)).callback)[MEMBER_COOKIE]
	const renewed = await handler(new Request(api("/account"), { headers: { "x-yepwatch-member": session.value, "x-yepwatch-client": "native" } }))
	const body = await renewed.json()
	assert.equal(body.state, "member")
	assert.ok(body.session && body.session !== session.value)
	assert.equal(cookies(renewed)[MEMBER_COOKIE], undefined)
})

for (const [label, reply] of [
	["throttled", () => new Response("slow down", { status: 429, headers: { "retry-after": "30" } })],
	["down", () => new Response("bad gateway", { status: 502 })],
	["unreachable", () => { throw new TypeError("fetch failed") }],
	["garbled", () => Response.json({ nope: true })],
] as const) {
	test(`a renewal while GoodWatch is ${label} keeps the session and says so instead of signing out`, async () => {
		let failing = false
		const { handler } = setup({ offline: true, lifetime: 1, refreshReply: () => { if (failing) return reply(); throw new Error("unreachable in this test") } })
		const session = cookies((await signIn(handler, `${origin}/`)).callback)[MEMBER_COOKIE]
		failing = true
		const status = await handler(new Request(api("/account"), { headers: { cookie: `${MEMBER_COOKIE}=${session.value}` } }))
		const body = await status.json()
		assert.equal(body.state, "member", "a temporary failure is not a sign-out")
		assert.equal(body.unavailable, true)
		assert.equal(body.displayName, "Alper")
		assert.equal(cookies(status)[MEMBER_COOKIE], undefined, "the cookie is left as it is")
	})
}

test("a renewal GoodWatch definitively refuses (invalid_grant) ends the session", async () => {
	const { handler } = setup({ offline: true, lifetime: 1, refreshReply: () => Response.json({ error: "invalid_grant" }, { status: 400 }) })
	const session = cookies((await signIn(handler, `${origin}/`)).callback)[MEMBER_COOKIE]
	const status = await handler(new Request(api("/account"), { headers: { cookie: `${MEMBER_COOKIE}=${session.value}` } }))
	assert.equal((await status.json()).state, "guest")
	assert.equal(cookies(status)[MEMBER_COOKIE].maxAge, 0)
})

/** A room created by this browser, with the cookie that opens it next to a member session. */
async function room(handler: ReturnType<typeof setup>["handler"]) {
	const created = await handler(new Request(api("/rooms"), {
		method: "POST", headers: { origin, "content-type": "application/json" },
		body: JSON.stringify({ contractVersion: 3, commandId: randomBytes(16).toString("hex"), admissionSecret: randomBytes(32).toString("base64url"), nickname: "" }),
	}))
	assert.equal(created.status, 200)
	const roomId = (await created.json()).credential.roomId
	const roomCookie = `yepwatch3_${roomId}=${cookies(created)[`yepwatch3_${roomId}`].value}`
	const link = (member: string) => handler(new Request(api(`/rooms/${roomId}/member/link`), {
		method: "POST", headers: { origin, "content-type": "application/json", cookie: `${roomCookie}; ${MEMBER_COOKIE}=${member}` }, body: "{}",
	}))
	return { roomId, link }
}

test("a refresh that rotates the tokens while GoodWatch's identity check is down keeps the rotated grant", async () => {
	let outage = false
	const { handler, calls } = setup({ offline: true, lifetime: 1, identityReply: () => (outage ? new Response("bad gateway", { status: 502 }) : undefined) })
	const first = cookies((await signIn(handler, `${origin}/`)).callback)[MEMBER_COOKIE].value
	const { link } = await room(handler)
	outage = true
	const during = await handler(new Request(api("/account"), { headers: { cookie: `${MEMBER_COOKIE}=${first}` } }))
	const body = await during.json()
	assert.equal(body.state, "member", "an outage is not a sign-out")
	assert.equal(body.unavailable, true, "the identity behind the new tokens is not verified yet")
	assert.equal(calls.token.at(-1)!.get("refresh_token"), "refresh-1", "refresh-1 is consumed")
	const rotated = cookies(during)[MEMBER_COOKIE]?.value
	assert.ok(rotated && rotated !== first, "the rotated credentials are sealed into the cookie")
	assert.ok(cookies(during)[MEMBER_COOKIE].maxAge > 80 * 86400, "still a renewable session")

	// Room linking waits for a verified identity, and still keeps whatever rotation happened.
	const refused = await link(rotated)
	assert.equal(refused.status, 200)
	assert.equal((await refused.json()).state, "unavailable", "no room links to an unverified identity")
	const afterLink = cookies(refused)[MEMBER_COOKIE]?.value ?? rotated

	// The outage lasts past any reuse window: the next try uses the rotated refresh token, never refresh-1.
	outage = false
	const back = await handler(new Request(api("/account"), { headers: { cookie: `${MEMBER_COOKIE}=${afterLink}` } }))
	const after = await back.json()
	assert.equal(after.state, "member")
	assert.equal(after.unavailable, undefined)
	assert.equal(calls.token.filter((f) => f.get("refresh_token") === "refresh-1").length, 1, "the consumed refresh token is never sent again")
	const verified = cookies(back)[MEMBER_COOKIE].value
	const linked = await link(verified)
	assert.equal(linked.status, 200)
	assert.equal((await linked.json()).state, "linked")
})

test("a rotated grant whose identity check failed is verified again with its access token, without another refresh", async () => {
	let outage = false
	let lifetime = 1
	const { handler, calls } = setup({ offline: true, lifetime: () => lifetime, identityReply: () => (outage ? new Response("bad gateway", { status: 502 }) : undefined) })
	const first = cookies((await signIn(handler, `${origin}/`)).callback)[MEMBER_COOKIE].value
	lifetime = 300
	outage = true
	const during = await handler(new Request(api("/account"), { headers: { cookie: `${MEMBER_COOKIE}=${first}` } }))
	assert.equal((await during.json()).unavailable, true)
	const rotated = cookies(during)[MEMBER_COOKIE].value
	const still = await handler(new Request(api("/account"), { headers: { cookie: `${MEMBER_COOKIE}=${rotated}` } }))
	assert.equal((await still.json()).unavailable, true, "still down: still unverified")
	assert.equal(cookies(still)[MEMBER_COOKIE], undefined, "nothing new to keep")
	outage = false
	const tokenCalls = calls.token.length
	const back = await handler(new Request(api("/account"), { headers: { "x-yepwatch-member": rotated, "x-yepwatch-client": "native" } }))
	const body = await back.json()
	assert.equal(body.state, "member")
	assert.equal(body.unavailable, undefined)
	assert.equal(calls.token.length, tokenCalls, "the live access token is checked; no refresh token is spent")
	assert.ok(body.session && body.session !== rotated, "the verified session goes back to the app")
	const again = await handler(new Request(api("/account"), { headers: { "x-yepwatch-member": body.session, "x-yepwatch-client": "native" } }))
	assert.equal((await again.json()).session, undefined, "a verified live session is not renewed again")
})
