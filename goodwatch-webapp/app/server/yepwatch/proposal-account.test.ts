import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes, createHash } from "node:crypto"
import { releaseMembers, releaseMemberConfig } from "./proposal-release-members.ts"
import { createMemberResource } from "./member-resource.server.ts"
import { ProposalMemoryRepository, proposalFixtureCatalog } from "./proposal-test-support.ts"
import type { RoomCommand } from "../../../packages/yepwatch-contracts/proposal.ts"
import { ProposalService } from "./proposal-service.server.ts"
import { createProposalHandler, MEMBER_COOKIE, MEMBER_INTENT_COOKIE, MEMBER_LINK_WAIT_MS } from "./proposal-http.server.ts"

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
	identityReply?: () => Response | Promise<Response> | undefined
	/** The room catalog instead of the fixture one. */
	catalog?: typeof proposalFixtureCatalog
} = {}) {
	const config = releaseMemberConfig(env, origin)!
	const repo = new ProposalMemoryRepository()
	const service = new ProposalService(repo, options.catalog ?? proposalFixtureCatalog, secret)
	const grants = new Map<string, number>()
	/** `goodwatch`: every account read sent to GoodWatch (identity, prefill, seen), not token requests. */
	const calls = { token: [] as URLSearchParams[], verify: 0, goodwatch: 0 }
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
		calls.goodwatch++
		return (await options.identityReply?.()) ?? resource(request)
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

test("rooms created or joined while signed in link to the device session; Log out keeps this device in the room as a guest without the account", async () => {
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
	// Services are only valid within a country: a room without one takes the member's GoodWatch country,
	// so friends can pick their services (the app's own country step can lose the race with this link).
	assert.equal(snapshot.shared.screens[0]?.country, "DE")
	assert.equal(JSON.stringify(snapshot).includes("grant-"), false)
	const before = (await repo.read(roomId))!.room.revision
	const again = await handler(new Request(api(`/rooms/${roomId}/member/link`), { method: "POST", headers: { origin, "content-type": "application/json", cookie: both }, body: "{}" }))
	assert.equal((await again.json()).state, "linked")
	assert.equal((await repo.read(roomId))!.room.revision, before, "linking an already linked room changes nothing")
	const out = await handler(new Request(api("/account/logout"), { method: "POST", headers: { origin, "content-type": "application/json", cookie: both }, body: "{}" }))
	assert.equal(out.status, 200)
	assert.equal(cookies(out)[MEMBER_COOKIE].maxAge, 0)
	assert.deepEqual((await out.json()).keptRooms.map((r: { roomId: string; nickname: string }) => [r.roomId, r.nickname]), [[roomId, "Alper"]], "the app lists the kept room on the device")
	const guest = await handler(new Request(api("/account"), { headers: { cookie: `yepwatch3_${roomId}=${roomCookie}` } }))
	assert.equal((await guest.json()).state, "guest")
	const kept = await handler(new Request(api(`/rooms/${roomId}`), { headers: { cookie: `yepwatch3_${roomId}=${roomCookie}` } }))
	assert.equal(kept.status, 200, "the retained room cookie keeps this device's seat")
	const guestView = await kept.json()
	assert.equal(guestView.own.participantId, snapshot.own.participantId, "same seat: name, votes and host role stay")
	assert.equal(guestView.own.member.state, "guest", "a retained room cookie acts as a guest, never as the signed-out account")
	assert.equal(guestView.own.member.prefill, null)
	const stored = (await repo.read(roomId))!.room.participants[0]
	assert.equal(stored.memberUserId, null, "the GoodWatch link is removed")
	assert.equal(stored.memberGrant, undefined, "no GoodWatch grant stays in the room")
	assert.deepEqual(stored.sessions, [])
	assert.deepEqual(guestView.shared.participants.find((p: { participantId: string }) => p.participantId === guestView.own.participantId).serviceIds, [8, 9], "the room keeps the services already chosen")
	const command = await handler(new Request(api(`/rooms/${roomId}/commands`), {
		method: "POST", headers: { origin, "content-type": "application/json", cookie: `yepwatch3_${roomId}=${roomCookie}` },
		body: JSON.stringify({ commandId: randomBytes(16).toString("hex"), sequence: guestView.own.nextSequence, command: { type: "rename", nickname: "Al" } }),
	}))
	assert.equal(command.status, 200, "the guest seat keeps acting, in sequence")
	const home = await handler(new Request(api("/account/home"), { headers: { cookie: `yepwatch3_${roomId}=${roomCookie}; ${MEMBER_COOKIE}=${session}` } }))
	assert.equal(home.status, 403, "the replayed sealed sign-in reads no account data")
	const replayed = await handler(new Request(api(`/rooms/${roomId}`), { headers: { cookie: both } }))
	assert.equal(replayed.status, 200, "a read racing Log out (its sign-in cookie not yet cleared) reads the guest place")
	assert.equal((await replayed.json()).own.member.state, "guest", "the replayed sealed sign-in adds no account access")
	const relink = await handler(new Request(api(`/rooms/${roomId}/member/link`), { method: "POST", headers: { origin, "content-type": "application/json", cookie: both }, body: "{}" }))
	assert.equal(relink.status, 403, "the replayed sealed sign-in cannot link the room again")
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
	assert.equal(refused.status, 503)
	assert.equal((await refused.json()).error.code, "busy", "no room links to an unverified identity")
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

test('two signed-in browsers share one room place and host rights; a new device lists and resumes it without an invitation', async () => {
  const { handler } = setup()
  const phone = cookies((await signIn(handler, `${origin}/`)).callback)[MEMBER_COOKIE].value
  const pc = cookies((await signIn(handler, `${origin}/`)).callback)[MEMBER_COOKIE].value
  const created = await handler(new Request(api('/rooms'), {
    method: 'POST', headers: { origin, 'content-type': 'application/json', cookie: `${MEMBER_COOKIE}=${phone}` },
    body: JSON.stringify({ contractVersion: 3, commandId: 'account-cross-device-create', admissionSecret: randomBytes(32).toString('base64url'), nickname: '' }),
  }))
  assert.equal(created.status, 200)
  const first = await created.json(), id = first.credential.roomId
  const roster = first.snapshot.shared.rosterVersion
  const listed = await handler(new Request(api('/account/home'), { headers: { cookie: `${MEMBER_COOKIE}=${pc}` } }))
  const home = await listed.json()
  assert.equal(home.rooms.length, 1)
  assert.equal(home.rooms[0].snapshot.own.participantId, first.credential.participantId)
  assert.equal(home.rooms[0].snapshot.own.canHost, true)
  assert.equal(JSON.stringify(home).includes('account-1'), false)
  const resumed = await handler(new Request(api(`/rooms/${id}/resume`), {
    method: 'POST', headers: { origin, 'content-type': 'application/json', cookie: `${MEMBER_COOKIE}=${pc}` }, body: '{}',
  }))
  assert.equal(resumed.status, 200)
  const second = await resumed.json()
  assert.equal(second.credential.participantId, first.credential.participantId)
  assert.notEqual(second.credential.sessionKey, first.credential.sessionKey)
  assert.equal(second.snapshot.shared.rosterVersion, roster)
  assert.equal(second.snapshot.shared.participants.length, 1)
  const both = `${MEMBER_COOKIE}=${pc}; yepwatch3_${id}=${cookies(resumed)[`yepwatch3_${id}`].value}`
  const archived = await handler(new Request(api(`/rooms/${id}/archive`), { method: 'POST', headers: { origin, 'content-type': 'application/json', cookie: both }, body: '{"archived":true}' }))
  assert.equal(archived.status, 200)
  const phoneHome = await (await handler(new Request(api('/account/home'), { headers: { cookie: `${MEMBER_COOKIE}=${phone}` } }))).json()
  assert.ok(phoneHome.rooms[0].archivedAt)
  await handler(new Request(api('/account/logout'), { method: 'POST', headers: { origin, 'content-type': 'application/json', cookie: both }, body: '{}' }))
  const replay = await handler(new Request(api(`/rooms/${id}/resume`), { method: 'POST', headers: { origin, 'content-type': 'application/json', cookie: both }, body: '{}' }))
  assert.equal(replay.status, 403, 'a logged-out sealed session cannot mint new room credentials')
  const kept = await handler(new Request(api('/account/home'), { headers: { cookie: `${MEMBER_COOKIE}=${phone}` } }))
  assert.equal((await kept.json()).rooms.length, 1)
  const guest = await handler(new Request(api('/account/home')))
  assert.equal(guest.status, 403)
  const forged = await handler(new Request(api(`/rooms/${id}/resume`), { method: 'POST', headers: { origin, 'content-type': 'application/json', cookie: `${MEMBER_COOKIE}=${phone}` }, body: '{"userId":"someone-else"}' }))
  assert.equal(forged.status, 400)
})

test('logging out a lapsed sign-in needs no successful refresh or available GoodWatch issuer', async () => {
  const { handler, calls } = setup({ offline: true, lifetime: 1, refreshReply: () => new Response('unavailable', { status: 503 }) })
  const session = cookies((await signIn(handler, `${origin}/`)).callback)[MEMBER_COOKIE].value
  const before = calls.token.length
  const out = await handler(new Request(api('/account/logout'), { method: 'POST', headers: { origin, 'content-type': 'application/json', cookie: `${MEMBER_COOKIE}=${session}` }, body: '{}' }))
  assert.equal(out.status, 200)
  assert.equal(cookies(out)[MEMBER_COOKIE].maxAge, 0)
  assert.equal(calls.token.length, before, 'logout never tries to refresh the old login')
})

test('signing in before joining with an existing guest cookie claims that place rather than allocating a second voter', async () => {
  const { handler } = setup()
  const original = await handler(new Request(api('/rooms'), { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ contractVersion: 3, commandId: 'guest-before-account', admissionSecret: randomBytes(32).toString('base64url'), nickname: 'Guest' }) }))
  const guest = await original.json(), id = guest.credential.roomId
  const roomCookie = cookies(original)[`yepwatch3_${id}`].value
  const session = cookies((await signIn(handler, `${origin}/`)).callback)[MEMBER_COOKIE].value
  const joining = await handler(new Request(api(`/rooms/${id}/join`), { method: 'POST', headers: { origin, 'content-type': 'application/json', cookie: `yepwatch3_${id}=${roomCookie}; ${MEMBER_COOKIE}=${session}` }, body: JSON.stringify({ contractVersion: 3, commandId: 'claim-on-join', admissionSecret: randomBytes(32).toString('base64url'), nickname: 'Alex', inviteCode: guest.invite.code }) }))
  assert.equal(joining.status, 200)
  const linked = await joining.json()
  assert.equal(linked.credential.participantId, guest.credential.participantId)
  assert.equal(linked.snapshot.shared.participants.length, 1)
  assert.equal(linked.snapshot.own.canHost, true)
  assert.notEqual(linked.credential.sessionKey, guest.credential.sessionKey)
})

test("a room created with setup while signed in takes the member's GoodWatch country over the device's, in the same request", async () => {
	const { handler } = setup()
	const { callback } = await signIn(handler, `${origin}/`)
	const session = cookies(callback)[MEMBER_COOKIE].value
	const create = (cookie: string | null, country: string) => handler(new Request(api("/rooms"), {
		method: "POST", headers: { origin, "content-type": "application/json", ...(cookie ? { cookie } : {}) },
		body: JSON.stringify({ contractVersion: 3, commandId: randomBytes(16).toString("hex"), admissionSecret: randomBytes(32).toString("base64url"), nickname: "", setup: { country } }),
	}))
	const member = await create(`${MEMBER_COOKIE}=${session}`, "JP")
	assert.equal(member.status, 200)
	const linked = await member.json()
	assert.equal(linked.snapshot.own.member.prefill.country, "DE")
	assert.equal(linked.snapshot.shared.screens[0].country, "DE")
	const same = await (await create(`${MEMBER_COOKIE}=${session}`, "DE")).json()
	assert.equal(same.snapshot.shared.screens[0].country, "DE")
	assert.equal(same.snapshot.own.nextSequence, 1, "nothing more is sent when the countries agree")
	const guest = await (await create(null, "JP")).json()
	assert.equal(guest.snapshot.shared.screens[0].country, "JP")
})

test("a join answers within the link wait while GoodWatch's identity check hangs, and the link lands afterwards", async () => {
	// Production 2026-11-12: GoodWatch's identity check for the room link hung its full 12 s, the member's join
	// answered never (the app gave up at 6 s, resent) and the join page said "Reconnecting…" with no outage.
	let hold: Promise<void> | null = null
	let release = () => {}
	const { handler, repo } = setup({
		identityReply: () => hold?.then(() => undefined) as Promise<Response> | undefined,
	})
	const host = await handler(new Request(api("/rooms"), { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ contractVersion: 3, commandId: randomBytes(16).toString("hex"), admissionSecret: randomBytes(32).toString("base64url"), nickname: "Host" }) }))
	const room = await host.json(), id = room.credential.roomId
	const session = cookies((await signIn(handler, `${origin}/`)).callback)[MEMBER_COOKIE].value
	hold = new Promise<void>((resolve) => { release = resolve })
	const started = Date.now()
	const joining = await handler(new Request(api(`/rooms/${id}/join`), { method: "POST", headers: { origin, "content-type": "application/json", cookie: `${MEMBER_COOKIE}=${session}` }, body: JSON.stringify({ contractVersion: 3, commandId: randomBytes(16).toString("hex"), admissionSecret: randomBytes(32).toString("base64url"), nickname: "Alper", inviteCode: room.invite.code }) }))
	const took = Date.now() - started
	assert.equal(joining.status, 200)
	assert.ok(took < MEMBER_LINK_WAIT_MS + 1000, `the join answered in ${took} ms`)
	const joined = await joining.json()
	assert.equal(joined.snapshot.shared.participants.length, 2, "the place is made")
	assert.notEqual(joined.snapshot.own.member.state, "linked", "the answer says the link is still to come: the room links itself")
	release()
	for (let i = 0; i < 50 && (await repo.read(id))!.room.participants.find((p) => p.id === joined.credential.participantId)?.member.state !== "linked"; i++)
		await new Promise((resolve) => setTimeout(resolve, 20))
	const stored = (await repo.read(id))!.room.participants.find((p) => p.id === joined.credential.participantId)!
	assert.equal(stored.member.state, "linked", "the link goes on and lands")
	assert.deepEqual(stored.serviceIds, [8, 9], "with the account's saved services")
})

/** GoodWatch answers account reads only once `release` is called; until then a member's link waits. */
function slowGoodWatch(failAfterRelease = false, catalog?: typeof proposalFixtureCatalog) {
	let hold: Promise<void> | null = null
	let release = () => {}
	const env = setup({
		identityReply: () => hold?.then(() => failAfterRelease ? new Response("down", { status: 500 }) : undefined) as Promise<Response> | undefined,
		catalog,
	})
	const json = (body: unknown, cookie?: string) => ({ method: "POST", headers: { origin, "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) })
	const admission = () => ({ contractVersion: 3, commandId: randomBytes(16).toString("hex"), admissionSecret: randomBytes(32).toString("base64url") })
	return {
		...env,
		json,
		admission,
		hold: () => { hold = new Promise<void>((resolve) => { release = resolve }) },
		release: async () => { release(); await new Promise((resolve) => setTimeout(resolve, 100)) },
		/** A host's room, and the member's join that answers while GoodWatch still holds the link. */
		async memberJoins() {
			const host = await (await env.handler(new Request(api("/rooms"), json({ ...admission(), nickname: "Host" })))).json()
			const id = host.credential.roomId as string
			const session = cookies((await signIn(env.handler, `${origin}/`)).callback)[MEMBER_COOKIE].value
			this.hold()
			const joining = await env.handler(new Request(api(`/rooms/${id}/join`), json({ ...admission(), nickname: "Alper", inviteCode: host.invite.code }, `${MEMBER_COOKIE}=${session}`)))
			assert.equal(joining.status, 200)
			const joined = await joining.json()
			assert.notEqual(joined.snapshot.own.member.state, "linked", "the answer came before the link")
			const roomCookie = `yepwatch3_${id}=${cookies(joining)[`yepwatch3_${id}`].value}`
			return { id, joined, session, roomCookie, both: `${roomCookie}; ${MEMBER_COOKIE}=${session}` }
		},
	}
}

test("a link GoodWatch answers after Log out restores nothing: the device stays in the room as a guest", async () => {
	const env = slowGoodWatch()
	const { id, joined, roomCookie, both } = await env.memberJoins()
	const out = await env.handler(new Request(api("/account/logout"), env.json({}, both)))
	assert.equal(out.status, 200)
	await env.release()
	const stored = (await env.repo.read(id))!.room.participants.find((p) => p.id === joined.credential.participantId)!
	assert.equal(stored.memberUserId, null, "the late link doesn't bring the account back")
	assert.equal(stored.memberGrant, undefined, "nor its grant")
	assert.equal(stored.member.state, "guest")
	assert.equal(stored.member.prefill, null, "nor its prefill")
	const kept = await env.handler(new Request(api(`/rooms/${id}`), { headers: { cookie: roomCookie } }))
	assert.equal(kept.status, 200, "the retained guest credential keeps working")
	assert.equal((await kept.json()).own.member.state, "guest")
})

test("a link GoodWatch answers after Leave changes nothing in the room", async () => {
	const env = slowGoodWatch()
	const { id, joined, both } = await env.memberJoins()
	const left = await env.handler(new Request(api(`/rooms/${id}/commands`), env.json({ commandId: randomBytes(16).toString("hex"), sequence: joined.snapshot.own.nextSequence, command: { type: "leave" } }, both)))
	assert.equal(left.status, 200)
	const before = structuredClone((await env.repo.read(id))!.room)
	await env.release()
	const after = (await env.repo.read(id))!.room
	assert.deepEqual(after, before, "no grant, prefill or seen titles land on the left place, and no candidate is retired")
	assert.equal(after.participants.find((p) => p.id === joined.credential.participantId)!.memberGrant, undefined)
})

test("the room's own member/link joins the link its admission started instead of asking GoodWatch again", async () => {
	const env = slowGoodWatch()
	const { id, joined, both } = await env.memberJoins()
	const asked = env.calls.goodwatch
	const linking = env.handler(new Request(api(`/rooms/${id}/member/link`), env.json({}, both)))
	await new Promise((resolve) => setTimeout(resolve, 50))
	await env.release()
	const linked = await linking
	assert.equal(linked.status, 200)
	assert.equal((await linked.json()).state, "linked")
	// One link asks GoodWatch three times (identity, prefill, seen); the first identity read was already sent.
	assert.equal(env.calls.goodwatch - asked, 2, "one set of GoodWatch reads for both")
	assert.equal((await env.repo.read(id))!.room.participants.find((p) => p.id === joined.credential.participantId)!.member.state, "linked")
})

test("a link that fails after the admission answered is logged without credentials", async (t) => {
	const env = slowGoodWatch(true)
	const warn = t.mock.method(console, "warn", () => {})
	const { id, joined, session, roomCookie } = await env.memberJoins()
	await env.release()
	const lines = warn.mock.calls.map((c) => String(c.arguments[0])).filter((l) => l.includes("yepwatch_member_link_late_failure"))
	assert.equal(lines.length, 1)
	const line = JSON.parse(lines[0])
	assert.equal(line.roomId, id)
	assert.equal(line.participantId, joined.credential.participantId)
	assert.match(line.error, /^RoomError:/)
	assert.equal([session, roomCookie.split("=")[1].split(".")[1], "grant-"].some((secret) => lines[0].includes(secret)), false)
})

test("a room created while GoodWatch is slow takes the member's country once the late link lands", async () => {
	const env = slowGoodWatch()
	const session = cookies((await signIn(env.handler, `${origin}/`)).callback)[MEMBER_COOKIE].value
	env.hold()
	const created = await env.handler(new Request(api("/rooms"), env.json({ ...env.admission(), nickname: "", setup: { country: "JP" } }, `${MEMBER_COOKIE}=${session}`)))
	assert.equal(created.status, 200)
	const admission = await created.json()
	const id = admission.credential.roomId
	assert.equal(admission.snapshot.shared.screens[0].country, "JP", "answered before the link")
	await env.release()
	const room = (await env.repo.read(id))!.room
	assert.equal(room.participants[0].member.state, "linked")
	assert.equal(room.screens[0].country, "DE", "the late link brings the member's GoodWatch country")
})

/** A signed-in create answered while GoodWatch still holds the link, and the creator's command sender. */
async function slowCreate(env: ReturnType<typeof slowGoodWatch>, country: string, catalog = proposalFixtureCatalog) {
	const session = cookies((await signIn(env.handler, `${origin}/`)).callback)[MEMBER_COOKIE].value
	env.hold()
	const created = await env.handler(new Request(api("/rooms"), env.json({ ...env.admission(), nickname: "Host", setup: { country } }, `${MEMBER_COOKIE}=${session}`)))
	assert.equal(created.status, 200)
	const admission = await created.json()
	const id = admission.credential.roomId as string
	assert.notEqual(admission.snapshot.own.member.state, "linked", "the answer came before the link")
	const both = `yepwatch3_${id}=${cookies(created)[`yepwatch3_${id}`].value}; ${MEMBER_COOKIE}=${session}`
	let snapshot = admission.snapshot
	const send = async (command: Record<string, unknown>) => {
		const reply = await env.handler(new Request(api(`/rooms/${id}/commands`), env.json({ commandId: randomBytes(16).toString("hex"), sequence: snapshot.own.nextSequence, command }, both)))
		assert.equal(reply.status, 200, JSON.stringify(await reply.clone().json()))
		snapshot = (await reply.json()).snapshot
		return snapshot
	}
	/** The same command through another API instance (its own write lane), as a second server would take it. */
	const other = new ProposalService(env.repo, catalog, secret)
	const [participantId, token] = cookies(created)[`yepwatch3_${id}`].value.split(".")
	const sendElsewhere = async (command: RoomCommand) => {
		const sessionId = (await env.repo.read(id))!.room.participants[0].sessions![0].id
		const result = await other.command(id, { participantId, token, accountId: "account-1", sessionId },
			{ commandId: randomBytes(16).toString("hex"), sequence: snapshot.own.nextSequence, command })
		snapshot = result.snapshot
		return snapshot
	}
	return { id, admission, send, sendElsewhere, snapshot: () => snapshot }
}

/**
 * Runs `change` right after the first room read once the late link is stored and announced: the caller of that read
 * (the create country step) then holds a room the change has already replaced.
 */
function raceAfterLink(env: ReturnType<typeof slowGoodWatch>, change: () => Promise<unknown>) {
	const notify = env.service.notify.bind(env.service)
	const read = env.repo.read.bind(env.repo)
	let armed = false
	let done = false
	env.service.notify = async (id, options) => {
		const stored = await notify(id, options)
		if (!done && (await read(id))?.room.participants[0].member.state === "linked") armed = true
		return stored
	}
	env.repo.read = async (id) => {
		const stored = await read(id)
		if (armed) {
			armed = false
			done = true
			await change()
		}
		return stored
	}
	return () => assert.ok(done, "the change raced the country step")
}

/** The fixture catalog, also selling in the United States. */
const withUS: typeof proposalFixtureCatalog = {
	...proposalFixtureCatalog,
	async metadata(country) {
		const m = await proposalFixtureCatalog.metadata(country)
		return { ...m, countries: [...m.countries, { code: "US", name: "United States" }] }
	},
}

test("a country the creator chooses while the late link lands stays: the link doesn't bring GoodWatch's", async () => {
	const env = slowGoodWatch(false, withUS)
	const { id, sendElsewhere, snapshot } = await slowCreate(env, "JP", withUS)
	const raced = raceAfterLink(env, () => sendElsewhere({ type: "configure", expectedContextVersion: snapshot().shared.contextVersion, country: "US" }))
	await env.release()
	raced()
	const room = (await env.repo.read(id))!.room
	assert.equal(room.participants[0].member.state, "linked", "the link still lands")
	assert.equal(room.screens[0].country, "US", "the creator's own choice wins over the member's DE")
})

test("a creator who changed the country and back before the late link lands keeps it", async () => {
	const env = slowGoodWatch()
	const { id, send, snapshot } = await slowCreate(env, "JP")
	await send({ type: "configure", expectedContextVersion: snapshot().shared.contextVersion, country: "DE" })
	await send({ type: "configure", expectedContextVersion: snapshot().shared.contextVersion, country: "JP" })
	await env.release()
	assert.equal((await env.repo.read(id))!.room.screens[0].country, "JP", "a chosen JP is not the create country left alone")
})

test("a room started while the late link lands keeps its country", async () => {
	const env = slowGoodWatch()
	const { id, send, sendElsewhere, snapshot } = await slowCreate(env, "JP")
	await send({ type: "set_services", serviceIds: [1] })
	const raced = raceAfterLink(env, () => sendElsewhere({ type: "start", expectedContextVersion: snapshot().shared.contextVersion, expectedRosterVersion: snapshot().shared.rosterVersion, expectedGeneration: snapshot().shared.generation, hostReady: true }))
	await env.release()
	raced()
	assert.notEqual(snapshot().shared.phase, "setup", "started")
	const room = (await env.repo.read(id))!.room
	assert.equal(room.participants[0].member.state, "linked", "the link still lands")
	assert.equal(room.screens[0].country, "JP", "a started room never switches to the member's DE")
})
