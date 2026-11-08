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

/** A GoodWatch issuer double: codes become short-lived grants; refresh tokens rotate when offline access is on. */
function setup(options: { offline?: boolean; lifetime?: number } = {}) {
	const config = releaseMemberConfig({ ...env, YEPWATCH_MEMBER_OFFLINE_ACCESS: options.offline ? "true" : "false" }, origin)!
	const repo = new ProposalMemoryRepository()
	const service = new ProposalService(repo, proposalFixtureCatalog, secret)
	const grants = new Map<string, number>()
	const calls = { token: [] as URLSearchParams[], verify: 0 }
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
			const accessToken = `grant-${++issued}`
			const lifetime = options.lifetime ?? 300
			grants.set(accessToken, Date.now() + lifetime * 1000)
			return Response.json({ access_token: accessToken, expires_in: lifetime, token_type: "Bearer", ...(options.offline ? { refresh_token: `refresh-${issued}` } : {}) })
		}
		return resource(request)
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

test("an expired session renews with a refresh token when offline access is on, and ends without one", async () => {
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
