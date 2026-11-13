import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { releaseMembers, releaseMemberConfig } from "./proposal-release-members.ts"
import { createMemberResource } from "./member-resource.server.ts"
import { ProposalMemoryRepository, proposalFixtureCatalog } from "./proposal-test-support.ts"
import { ProposalService } from "./proposal-service.server.ts"
import { createProposalHandler, MEMBER_COOKIE, MEMBER_INTENT_COOKIE } from "./proposal-http.server.ts"
import { memberExclusions } from "./proposal-member-exclusions.ts"
import type { ContinuousMembers } from "./continuous-members.server.ts"
import type { ProposalCatalog } from "./proposal-types.ts"

// Q46 (owner, 2026-11-13): a member's seen titles are read when they sign in to a room and kept up while the room is
// set up; Start uses that copy instead of a GoodWatch request on its path.
const origin = "https://yepwatch.example"
const env = {
	YEPWATCH_MEMBER_ENABLED: "true",
	YEPWATCH_MEMBER_ISSUER_ORIGIN: "https://goodwatch.example",
	AUTH_YEPWATCH_CLIENT_ID: "yepwatch",
	AUTH_YEPWATCH_RESOURCE: `${origin}/api/yepwatch`,
	AUTH_YEPWATCH_REDIRECT_URIS: `${origin}/api/yepwatch/v1/proposal/member/callback`,
}
const secret = "test-seen-copies-secret-at-least-thirty-two"
const api = (path: string) => `${origin}/api/yepwatch/v1/proposal${path}`
const keyOf = (c: { identity: { kind: string; tmdbId: number } }) => `${c.identity.kind === "movie" ? "movie" : "show"}_${c.identity.tmdbId}`
const settle = () => new Promise((resolve) => setTimeout(resolve, 30))

/** GoodWatch double: grants, the member resource and its seen list, with seen reads counted, held or refused. */
function goodwatch() {
	const grants = new Map<string, number>()
	const state = { seen: [] as string[], seenReads: 0, revoked: false, hold: null as Promise<void> | null }
	let issued = 0
	const resource = createMemberResource({
		async verify(token) {
			const until = grants.get(token)
			if (!until || until <= Date.now() || state.revoked) throw new Error("expired")
			return { userId: "account-1", expiresAt: until }
		},
		async displayName() { return "Alper" },
		async prefill() { return { country: "DE", serviceIds: [1], savedProgressAvailable: false } },
		async seen() { return [...state.seen] },
		async progress() { return { source: "goodwatch", shows: [], limitReached: false } },
	})
	const transport: typeof fetch = async (input, init) => {
		const request = new Request(input, init)
		const url = new URL(request.url)
		if (url.pathname === "/api/auth/oauth2/token") {
			const accessToken = `grant-${++issued}`
			grants.set(accessToken, Date.now() + 600_000)
			return Response.json({ access_token: accessToken, expires_in: 600, token_type: "Bearer" })
		}
		if (url.searchParams.get("view") === "seen") {
			state.seenReads++
			await state.hold
		}
		return resource(request)
	}
	return { state, transport }
}

/** One API instance: its own service, members (and so its own seen copies) and handler, over a shared room store. */
function instance(repo: ProposalMemoryRepository, gw: ReturnType<typeof goodwatch>) {
	let members!: ContinuousMembers
	// Like production's rank: a deck build reads the members' seen lists (best effort) and leaves them out.
	const catalog: ProposalCatalog = {
		...proposalFixtureCatalog,
		async page(room) {
			const excluded = new Set(await memberExclusions(members).excludedKeys(room))
			const page = await proposalFixtureCatalog.page(room)
			return { ...page, candidates: page.candidates.filter((c) => !excluded.has(keyOf(c))) }
		},
		excludedKeys: (room, options) => memberExclusions(members).excludedKeys(room, options),
		refreshExcludedKeys: (room) => memberExclusions(members).refreshExcludedKeys(room),
	}
	const service = new ProposalService(repo, catalog, secret)
	members = releaseMembers(repo, releaseMemberConfig(env, origin)!, gw.transport, secret)
	const handler = createProposalHandler(service, { allowedOrigins: [origin], serviceSecret: "test-service-secret-at-least-thirty-two", members })
	return { service, members, handler }
}
const cookieOf = (response: Response, name: string) =>
	response.headers.getSetCookie().map((c) => c.split("; ")[0]).find((pair) => pair.startsWith(`${name}=`))?.slice(name.length + 1)

async function signIn(handler: ReturnType<typeof instance>["handler"]) {
	const started = await handler(new Request(api("/account/start"), {
		method: "POST", headers: { origin, "content-type": "application/json" },
		body: JSON.stringify({ returnTo: `${origin}/`, client: "browser" }),
	}))
	const { state } = await started.json()
	const callback = await handler(new Request(`${api("/member/callback")}?state=${encodeURIComponent(state)}&code=code-1`, {
		headers: { cookie: `${MEMBER_INTENT_COOKIE}=${cookieOf(started, MEMBER_INTENT_COOKIE)}` },
	}))
	return cookieOf(callback, MEMBER_COOKIE)!
}
const admission = (nickname: string) => ({ contractVersion: 3, commandId: randomBytes(16).toString("hex"), admissionSecret: randomBytes(32).toString("base64url"), nickname })

/** A guest host's room (DE, service 1) that a signed-in member joins by invitation; both can send commands. */
async function memberRoom(seen: (keys: string[]) => string[] = (keys) => [keys[0]]) {
	const repo = new ProposalMemoryRepository()
	const gw = goodwatch()
	const a = instance(repo, gw)
	const json = (body: unknown, cookie?: string) => ({ method: "POST", headers: { origin, "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) })
	const host = await a.handler(new Request(api("/rooms"), json({ ...admission("Host"), setup: { country: "DE" } })))
	const hostAdmission = await host.json()
	const id = hostAdmission.credential.roomId as string
	const hostCookie = `yepwatch3_${id}=${cookieOf(host, `yepwatch3_${id}`)}`
	const people = { host: { cookie: hostCookie, sequence: hostAdmission.snapshot.own.nextSequence as number }, member: { cookie: "", sequence: 0 } }
	let handler = a.handler
	const send = async (who: keyof typeof people, command: Record<string, unknown>) => {
		const reply = await handler(new Request(api(`/rooms/${id}/commands`), json({ commandId: randomBytes(16).toString("hex"), sequence: people[who].sequence, command }, people[who].cookie)))
		const body = await reply.json()
		assert.equal(reply.status, 200, JSON.stringify(body))
		people[who].sequence = body.snapshot.own.nextSequence
		return body.snapshot
	}
	await send("host", { type: "set_services", serviceIds: [1] })
	// The deck the room gets without any member: the titles a member's seen list can take out.
	const keys = (await proposalFixtureCatalog.page((await repo.read(id))!.room)).candidates.map(keyOf)
	gw.state.seen = seen(keys)
	const session = await signIn(a.handler)
	const reads = gw.state.seenReads
	const joined = await a.handler(new Request(api(`/rooms/${id}/join`), json({ ...admission("Alper"), inviteCode: hostAdmission.invite.code }, `${MEMBER_COOKIE}=${session}`)))
	const joinedAdmission = await joined.json()
	assert.equal(joinedAdmission.snapshot.own.member.state, "linked")
	people.member = { cookie: `yepwatch3_${id}=${cookieOf(joined, `yepwatch3_${id}`)}; ${MEMBER_COOKIE}=${session}`, sequence: joinedAdmission.snapshot.own.nextSequence }
	await a.service.decks.idle()
	await settle()
	const start = async () => {
		const s = (await (await handler(new Request(api(`/rooms/${id}`), { headers: { cookie: hostCookie } }))).json()).shared
		return send("host", { type: "start", expectedRosterVersion: s.rosterVersion, expectedContextVersion: s.contextVersion, expectedGeneration: s.generation, hostReady: true })
	}
	return {
		repo, gw, a, id, keys, send, start, signInReads: gw.state.seenReads - reads,
		memberCookie: () => people.member.cookie,
		/** Later requests go to another API instance (a restarted server, or a second container). */
		use: (other: ReturnType<typeof instance>) => { handler = other.handler },
	}
}
const shown = (snapshot: { shared: { candidates: { identity: { kind: string; tmdbId: number } }[] } }) => snapshot.shared.candidates.map(keyOf)

test("joining signed in reads the member's seen titles; Start leaves them out without a GoodWatch request", async () => {
	const r = await memberRoom()
	assert.ok(r.signInReads >= 1, "the sign-in to the room read the seen list")
	const before = r.gw.state.seenReads
	const started = await r.start()
	assert.equal(started.shared.phase, "choosing")
	assert.equal(r.gw.state.seenReads, before, "Start asked GoodWatch nothing")
	assert.ok(!shown(started).includes(r.keys[0]), "the member's seen title is left out")
	assert.ok(started.shared.candidates.length > 0)
})

test("a setup change reads the seen list again when the copy is missing, and Start uses what it read", async () => {
	const r = await memberRoom(() => [])
	// The copy is gone (as after a sign-in whose seen read failed); a title is marked Seen on GoodWatch meanwhile.
	;(r.a.members as unknown as { seenCopies: Map<string, unknown> }).seenCopies.clear()
	r.gw.state.seen.push(r.keys[0])
	const before = r.gw.state.seenReads
	await r.send("host", { type: "rename", nickname: "Host 2" })
	await r.a.service.decks.idle()
	await settle()
	assert.ok(r.gw.state.seenReads > before, "the room change read the list in the background")
	const reads = r.gw.state.seenReads
	const started = await r.start()
	assert.equal(r.gw.state.seenReads, reads, "Start asked GoodWatch nothing")
	assert.ok(!shown(started).includes(r.keys[0]), "the title marked Seen meanwhile is left out")
	assert.ok(shown(started).includes(r.keys[1]))
})

test("on another instance or after a restart (no copy), Start reads the seen list once, as before", async () => {
	const r = await memberRoom()
	const b = instance(r.repo, r.gw)
	r.use(b)
	const before = r.gw.state.seenReads
	const started = await r.start()
	assert.equal(started.shared.phase, "choosing")
	assert.ok(!shown(started).includes(r.keys[0]), "the member's seen title is left out")
	assert.equal(r.gw.state.seenReads - before, 1, "one fresh read at Start")
})

test("on another instance with GoodWatch hanging, Start answers within the seen bound without the member's exclusions", async () => {
	const r = await memberRoom()
	const b = instance(r.repo, r.gw)
	r.use(b)
	let release = () => {}
	r.gw.state.hold = new Promise<void>((resolve) => { release = resolve })
	const began = Date.now()
	const started = await r.start()
	const took = Date.now() - began
	release()
	assert.equal(started.shared.phase, "choosing")
	assert.ok(took < 1500, `Start answered in ${took} ms`)
	assert.ok(started.shared.candidates.length > 0)
})

test("a member who logs out before Start no longer shapes the deck", async () => {
	const r = await memberRoom((keys) => keys.slice(0, 3))
	const out = await r.a.handler(new Request(api("/account/logout"), { method: "POST", headers: { origin, "content-type": "application/json", cookie: r.memberCookie() }, body: "{}" }))
	assert.equal(out.status, 200)
	await r.a.service.decks.idle()
	await settle()
	const started = await r.start()
	assert.ok(r.keys.slice(0, 3).every((key) => shown(started).includes(key)), "the logged-out member's seen titles are shown")
})

test("a member who leaves before Start no longer shapes the deck", async () => {
	const r = await memberRoom((keys) => keys.slice(0, 3))
	await r.send("member", { type: "leave" })
	await r.a.service.decks.idle()
	await settle()
	const started = await r.start()
	assert.ok(r.keys.slice(0, 3).every((key) => shown(started).includes(key)), "the member who left has no say")
})

test("a grant GoodWatch revoked stops excluding once a room change finds out, without Start asking GoodWatch", async () => {
	const r = await memberRoom((keys) => keys.slice(0, 3))
	r.gw.state.revoked = true
	// A setup change rebuilds the deck in the background, and that build's seen read is refused.
	const s = await r.send("host", { type: "rename", nickname: "Host" })
	await r.send("host", { type: "configure", expectedContextVersion: s.shared.contextVersion, constraints: { kinds: ["movie", "show_start"], maxMinutes: 600, moods: [] } })
	await r.a.service.decks.idle()
	await settle()
	const before = r.gw.state.seenReads
	const started = await r.start()
	assert.equal(r.gw.state.seenReads, before, "Start asked GoodWatch nothing")
	assert.ok(r.keys.slice(0, 3).every((key) => shown(started).includes(key)), "the revoked grant's seen titles are shown")
})
