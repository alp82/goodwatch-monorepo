import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { releaseMembers, releaseMemberConfig } from "./proposal-release-members.ts"
import { createMemberResource } from "./member-resource.server.ts"
import { ProposalMemoryRepository, proposalFixtureCatalog } from "./proposal-test-support.ts"
import { ProposalService } from "./proposal-service.server.ts"
import { createProposalHandler, MEMBER_COOKIE, MEMBER_INTENT_COOKIE } from "./proposal-http.server.ts"

// A signed-in member's command: its room read runs alongside the sign-in checks (session, deletion) and the body,
// and every refusal still answers as it did when they ran one after another.

const origin = "https://yepwatch.example"
const env = {
	YEPWATCH_MEMBER_ENABLED: "true",
	YEPWATCH_MEMBER_ISSUER_ORIGIN: "https://goodwatch.example",
	AUTH_YEPWATCH_CLIENT_ID: "yepwatch",
	AUTH_YEPWATCH_RESOURCE: `${origin}/api/yepwatch`,
	AUTH_YEPWATCH_REDIRECT_URIS: `${origin}/api/yepwatch/v1/proposal/member/callback`,
}
const secret = "test-overlap-secret-at-least-thirty-two"
const api = (path: string) => `${origin}/api/yepwatch/v1/proposal${path}`

/** A gate a test opens by hand: what is waiting on it, and a way to let it through. */
function gate() {
	let open!: () => void
	const opened = new Promise<void>((resolve) => (open = resolve))
	return { opened, open }
}
const ticks = async (n = 20) => { for (let i = 0; i < n; i++) await new Promise((resolve) => setImmediate(resolve)) }

/** Logs every room read, in order with the member checks; `readFails` makes the room read fail. */
class LoggingRepository extends ProposalMemoryRepository {
	log: string[] = []
	readFails = false
	/** Room reads wait for this while set. */
	readGate: Promise<void> | null = null
	override async read(...args: Parameters<ProposalMemoryRepository["read"]>) {
		this.log.push("room read")
		if (this.readFails) throw new Error("store unavailable")
		if (this.readGate) await this.readGate
		return super.read(...args)
	}
}

async function signedInRoom() {
	const config = releaseMemberConfig(env, origin)!
	const repo = new LoggingRepository()
	const service = new ProposalService(repo, proposalFixtureCatalog, secret)
	const grants = new Map<string, number>()
	let issued = 0
	const resource = createMemberResource({
		async verify(token) {
			const until = grants.get(token)
			if (!until || until <= Date.now()) throw new Error("expired")
			return { userId: "account-1", expiresAt: until }
		},
		async displayName() { return "Alper" },
		async prefill() { return { country: "DE", serviceIds: [8], savedProgressAvailable: false } },
		async seen() { return [] },
		async progress() { return { source: "goodwatch", shows: [], limitReached: false } },
	})
	const transport: typeof fetch = async (input, init) => {
		const request = new Request(input, init)
		if (new URL(request.url).pathname === "/api/auth/oauth2/token") {
			const accessToken = `grant-${++issued}`
			grants.set(accessToken, Date.now() + 300_000)
			return Response.json({ access_token: accessToken, expires_in: 300, token_type: "Bearer" })
		}
		return resource(request)
	}
	const members = releaseMembers(repo, config, transport, secret)
	const handler = createProposalHandler(service, { allowedOrigins: [origin], serviceSecret: "test-service-secret-at-least-thirty-two", members })
	const started = await handler(new Request(api("/account/start"), {
		method: "POST", headers: { origin, "content-type": "application/json" },
		body: JSON.stringify({ returnTo: `${origin}/`, client: "browser" }),
	}))
	const { state } = await started.json()
	const intent = started.headers.getSetCookie().find((c) => c.startsWith(`${MEMBER_INTENT_COOKIE}=`))!.split(";")[0]
	const callback = await handler(new Request(`${api("/member/callback")}?state=${encodeURIComponent(state)}&code=code-1`, { headers: { cookie: intent } }))
	const session = callback.headers.getSetCookie().find((c) => c.startsWith(`${MEMBER_COOKIE}=`))!.split(";")[0]
	const created = await handler(new Request(api("/rooms"), {
		method: "POST", headers: { origin, "content-type": "application/json", cookie: session },
		body: JSON.stringify({ contractVersion: 3, commandId: randomBytes(16).toString("hex"), admissionSecret: randomBytes(32).toString("base64url"), nickname: "" }),
	}))
	assert.equal(created.status, 200)
	const admission = await created.json()
	const roomId: string = admission.credential.roomId
	const roomCookie = created.headers.getSetCookie().find((c) => c.startsWith(`yepwatch3_${roomId}=`))!.split(";")[0]
	const cookie = `${roomCookie}; ${session}`
	const snapshot = await (await handler(new Request(api(`/rooms/${roomId}`), { headers: { cookie } }))).json()
	assert.equal(snapshot.own.member.state !== undefined, true)
	const command = (body: unknown) => handler(new Request(api(`/rooms/${roomId}/commands`), {
		method: "POST", headers: { origin, "content-type": "application/json", cookie },
		...(body instanceof ReadableStream ? { body, duplex: "half" } : { body: typeof body === "string" ? body : JSON.stringify(body) }),
	} as RequestInit))
	const rename = (nickname: string) => ({ commandId: randomBytes(16).toString("hex"), sequence: snapshot.own.nextSequence, command: { type: "rename", nickname } })
	/** Holds the member's session check and account deletion check until opened, logging when each starts. */
	const hold = () => {
		const session = gate(), deletion = gate()
		const sessionActive = service.accounts.sessionActive.bind(service.accounts)
		const get = service.deletions.get.bind(service.deletions)
		service.accounts.sessionActive = async (id) => { repo.log.push("session check"); await session.opened; return sessionActive(id) }
		service.deletions.get = async (subject) => { repo.log.push(`deletion check ${subject.kind}`); await deletion.opened; return get(subject) }
		return { session, deletion }
	}
	const logout = () => handler(new Request(api("/account/logout"), { method: "POST", headers: { origin, "content-type": "application/json", cookie }, body: "{}" }))
	return { repo, service, roomId, command, rename, hold, logout }
}

test("a signed-in member's command reads the room while its session and deletion checks are still running", async () => {
	const r = await signedInRoom()
	// Background work after the create (prepared deck, repair) settles first: only the command reads from here on.
	await new Promise((resolve) => setTimeout(resolve, 50))
	const before = (await r.repo.read(r.roomId))!.room.revision
	const { session, deletion } = r.hold()
	r.repo.log = []
	const answer = r.command(r.rename("Al"))
	await ticks()
	assert.deepEqual(r.repo.log.slice().sort(), ["deletion check account", "room read", "session check"], "all three run together")
	assert.equal((await r.repo.read(r.roomId))!.room.revision, before, "nothing is written while the checks run")
	session.open()
	await ticks()
	assert.equal((await r.repo.read(r.roomId))!.room.revision, before, "nor while the deletion check runs")
	deletion.open()
	const reply = await answer
	assert.equal(reply.status, 200)
	assert.equal((await reply.json()).snapshot.shared.participants[0].nickname, "Al")
})

test("an account being deleted refuses a command before its body or room is looked at, and writes nothing", async () => {
	const r = await signedInRoom()
	const before = (await r.repo.read(r.roomId))!.room.revision
	await r.service.deletions.schedule({ kind: "account", userId: "account-1" }, Date.now())
	for (const [label, body, readFails] of [
		["a valid command", r.rename("Al"), false],
		["a malformed body", "{", false],
		["an invalid command", { commandId: "x", sequence: -1, command: { type: "nope" } }, false],
		["a room read that fails", r.rename("Al"), true],
	] as const) {
		r.repo.readFails = readFails
		const reply = await r.command(body)
		assert.equal(reply.status, 403, label)
		assert.match((await reply.json()).error.message, /deletion is in progress/, label)
	}
	r.repo.readFails = false
	assert.equal((await r.repo.read(r.roomId))!.room.revision, before)
})

test("a malformed body still answers before a room read failure, and a failing room read still answers busy", async () => {
	const r = await signedInRoom()
	r.repo.readFails = true
	const malformed = await r.command("{")
	assert.equal(malformed.status, 400)
	const failed = await r.command(r.rename("Al"))
	assert.equal(failed.status, 503)
	assert.equal((await failed.json()).error.code, "busy")
})

test("a signed-out (revoked) session on a command answers as before: the room credential decides, nothing is written", async () => {
	const r = await signedInRoom()
	const before = (await r.repo.read(r.roomId))!.room.revision
	r.service.accounts.sessionActive = async () => false
	const reply = await r.command(r.rename("Al"))
	assert.equal(reply.status, 401)
	assert.equal((await r.repo.read(r.roomId))!.room.revision, before)
})

test("a command whose body never finishes arriving holds up no other command in the room", async () => {
	const r = await signedInRoom()
	let stop!: () => void
	const hung = r.command(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("{")); stop = () => controller.close() } }))
	await ticks()
	const other = await Promise.race([
		r.command(r.rename("Al")).then((reply) => reply.status),
		new Promise((resolve) => setTimeout(() => resolve("blocked"), 1000)),
	])
	assert.equal(other, 200)
	stop()
	assert.equal((await hung).status, 400)
})

test("a refused sign-in answers at once, without waiting for a body that never finishes", async () => {
	const r = await signedInRoom()
	await r.service.deletions.schedule({ kind: "account", userId: "account-1" }, Date.now())
	let stop!: () => void
	const reply = r.command(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("{")); stop = () => controller.close() } }))
	const status = await Promise.race([reply.then((x) => x.status), new Promise((resolve) => setTimeout(() => resolve("waiting"), 1000))])
	stop()
	assert.equal(status, 403)
})

test("a refused sign-in answers at once while another command holds the room's lane", async () => {
	const r = await signedInRoom()
	await new Promise((resolve) => setTimeout(resolve, 50))
	const held = gate()
	r.repo.readGate = held.opened
	const first = r.command(r.rename("Al"))
	await ticks()
	await r.service.deletions.schedule({ kind: "account", userId: "account-1" }, Date.now())
	const status = await Promise.race([r.command(r.rename("Bo")).then((x) => x.status), new Promise((resolve) => setTimeout(() => resolve("queued"), 1000))])
	assert.equal(status, 403)
	r.repo.readGate = null
	held.open()
	assert.equal((await first).status, 200)
})

test("a malformed body answers at once while another command holds the room's lane, and takes no place in it", async () => {
	const r = await signedInRoom()
	await new Promise((resolve) => setTimeout(resolve, 50))
	const held = gate()
	r.repo.readGate = held.opened
	const first = r.command(r.rename("Al"))
	await ticks()
	const status = await Promise.race([r.command("{").then((x) => x.status), new Promise((resolve) => setTimeout(() => resolve("queued"), 1000))])
	assert.equal(status, 400)
	assert.equal((r.service as unknown as { writes: Map<string, { count: number }> }).writes.get(r.roomId)?.count, 1, "only the held command is queued")
	r.repo.readGate = null
	held.open()
	assert.equal((await first).status, 200)
})

test("a command whose sign-in ends in a Log out that lands meanwhile acts as the kept guest place, as it would after it", async () => {
	const r = await signedInRoom()
	await new Promise((resolve) => setTimeout(resolve, 50))
	const held = gate()
	const sessionActive = r.service.accounts.sessionActive.bind(r.service.accounts)
	let calls = 0
	// Only the command's own session check waits; Log out's passes straight through.
	r.service.accounts.sessionActive = async (id) => { if (calls++ === 0) await held.opened; return sessionActive(id) }
	r.repo.log = []
	const answer = r.command(r.rename("Al"))
	await ticks()
	assert.ok(r.repo.log.includes("room read"), "the command read the room while signed in")
	assert.equal((await r.logout()).status, 200)
	held.open()
	const reply = await answer
	assert.equal(reply.status, 200, "the device's place is a guest's now, and acts as one")
	const room = (await r.repo.read(r.roomId))!.room
	assert.equal(room.participants[0].memberUserId, null)
	assert.equal(room.participants[0].nickname, "Al")
})
