import { test } from "node:test"
import assert from "node:assert/strict"
import { ContinuousMembers, type MemberIssuer, type MemberReads } from "./continuous-members.server.ts"
import { RoomError } from "./errors.ts"
import type { ContinuousRepository, ContinuousRoom } from "./continuous-types.ts"

/** A seat's seen list read through ContinuousMembers; only the fields `seen` uses are real. */
function seat(userId: string | null, token = `${userId}-grant`) {
	return {
		id: "room-1",
		rosterVersion: 1,
		participants: [
			userId
				? { id: "p1", memberUserId: userId, memberGrant: { accessToken: token, expiresAt: Date.now() + 600_000 }, member: { state: "linked", prefill: null } }
				: { id: "p1", memberUserId: null, member: { state: "guest", prefill: null } },
		],
	} as unknown as ContinuousRoom
}
type Call = { userId: string; token?: string; resolve: (keys: string[]) => void; reject: (e: unknown) => void }
function members(options: { timeoutMs?: number; copyMaxAgeMs?: number; now?: () => number; verify?: MemberIssuer["verify"] } = {}) {
	const calls: Call[] = []
	const reads: MemberReads = {
		seen: (userId, token) => new Promise((resolve, reject) => calls.push({ userId, token, resolve, reject })),
		prefill: async () => ({ country: null, serviceIds: [], savedProgressAvailable: false }),
	}
	const m = new ContinuousMembers(
		{} as ContinuousRepository,
		{ verify: options.verify } as MemberIssuer,
		reads,
		{ callbackUrl: "", browserOrigins: [], nativeReturnUri: "", seenReadTimeoutMs: options.timeoutMs ?? 1000, seenCopyMaxAgeMs: options.copyMaxAgeMs },
		options.now,
	)
	return { m, calls }
}
const tick = () => new Promise((resolve) => setImmediate(resolve))
function quiet<T>(run: () => Promise<T>) {
	const warn = console.warn
	const logged: string[] = []
	console.warn = (line: string) => { logged.push(line) }
	return run().finally(() => { console.warn = warn }).then((value) => ({ value, logged }))
}

test("concurrent reads for one link share a request; every later read asks GoodWatch again", async () => {
	const { m, calls } = members()
	const room = seat("account-a")
	// A background deck build reads the seen list; a second plain read meanwhile shares it.
	const older = m.seen(room, "p1")
	const shared = m.seen(room, "p1")
	assert.equal(calls.length, 1)
	// Start reads fresh: it never joins the earlier read, which may predate a title marked Seen.
	const fresh = m.seen(room, "p1", { fresh: true })
	assert.equal(calls.length, 2)
	// A plain read now shares the in-flight fresh read.
	const sharesFresh = m.seen(room, "p1")
	assert.equal(calls.length, 2)
	calls[1].resolve(["movie_1", "movie_2"])
	assert.deepEqual(await fresh, ["movie_1", "movie_2"])
	assert.deepEqual(await sharesFresh, ["movie_1", "movie_2"])
	calls[0].resolve(["movie_1"])
	assert.deepEqual(await older, ["movie_1"])
	assert.deepEqual(await shared, ["movie_1"])
	// Settled: the next read (a refill) asks GoodWatch again.
	const refill = m.seen(room, "p1")
	assert.equal(calls.length, 3)
	calls[2].resolve(["movie_1", "movie_2", "movie_3"])
	assert.deepEqual(await refill, ["movie_1", "movie_2", "movie_3"])
})

test("a failed seen read leaves the member's exclusions out instead of failing Start or the deck", async () => {
	const { m, calls } = members()
	const room = seat("account-a")
	const ok = m.seen(room, "p1")
	calls[0].resolve(["movie_1"])
	await ok
	const result = quiet(() => m.seenOrNone(room, "p1", { fresh: true }))
	await tick()
	calls[1].reject(new RoomError("busy", "GoodWatch is temporarily unavailable; your room is saved", 503, true))
	const { value, logged } = await result
	assert.deepEqual(value, [], "no earlier list stands in for a failed read")
	assert.match(logged.join("\n"), /yepwatch_member_seen_skipped.*"reason":"unavailable"/)
	assert.ok(!logged.join("\n").includes("account-a"), "the log names no account or grant")
})

test("a slow seen read is cut off at the bound and leaves the exclusions out; a deck build reads again rather than reuse the late answer", async () => {
	const { m, calls } = members({ timeoutMs: 30 })
	const room = seat("account-a")
	const began = performance.now()
	const { value, logged } = await quiet(() => m.seenOrNone(room, "p1", { fresh: true }))
	const waited = performance.now() - began
	assert.deepEqual(value, [])
	assert.ok(waited < 200, `Start waited ${waited.toFixed(0)} ms, not the 12 s transport timeout`)
	assert.match(logged.join("\n"), /"reason":"timeout"/)
	calls[0].resolve(["movie_7"])
	await tick()
	const next = m.seenOrNone(room, "p1")
	assert.equal(calls.length, 2, "a deck build asks again")
	calls[1].resolve(["movie_7", "movie_8"])
	assert.deepEqual(await next, ["movie_7", "movie_8"])
	// Another timeout leaves the exclusions out rather than reusing the last list.
	const again = await quiet(() => m.seenOrNone(room, "p1", { fresh: true }))
	assert.deepEqual(again.value, [])
})

test("an in-flight read that never settles stops being shared after the transport timeout", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	const { m, calls } = members()
	const room = seat("account-a")
	void m.seen(room, "p1")
	void m.seen(room, "p1")
	assert.equal(calls.length, 1)
	t.mock.timers.tick(12_000)
	void m.seen(room, "p1")
	assert.equal(calls.length, 2, "the stuck read was dropped from the in-flight map")
})

test("a revoked grant leaves the member's exclusions out", async () => {
	const { m, calls } = members()
	const room = seat("account-a")
	const first = m.seen(room, "p1")
	calls[0].resolve(["movie_1"])
	await first
	const result = quiet(() => m.seenOrNone(room, "p1", { fresh: true }))
	await tick()
	calls[1].reject(new RoomError("member_required", "Connect GoodWatch again", 403))
	const { value, logged } = await result
	assert.deepEqual(value, [])
	assert.match(logged.join("\n"), /"reason":"refused"/)
	const next = m.seen(room, "p1")
	assert.equal(calls.length, 3, "the revoked link's earlier list isn't used again")
	calls[2].reject(new RoomError("member_required", "Connect GoodWatch again", 403))
	await assert.rejects(next)
})

test("a refusal followed by a delayed success from an earlier read never gives later reads the revoked list", async () => {
	const { m, calls } = members()
	const room = seat("account-a")
	// A background deck build reads the seen list; Start then reads fresh and GoodWatch refuses the grant.
	const older = m.seen(room, "p1")
	const fresh = m.seen(room, "p1", { fresh: true })
	assert.equal(calls.length, 2)
	calls[1].reject(new RoomError("member_required", "Connect GoodWatch again", 403))
	await assert.rejects(fresh)
	// The older read, answered before the revocation, lands last.
	calls[0].resolve(["movie_1"])
	await older
	// Later reads ask GoodWatch again; refused, or with GoodWatch down, they have no list for this link.
	const next = quiet(() => m.seenOrNone(room, "p1"))
	const start = quiet(() => m.seenOrNone(room, "p1", { fresh: true }))
	await tick()
	assert.equal(calls.length, 4, "neither later read was answered from the earlier read")
	calls[2].reject(new RoomError("member_required", "Connect GoodWatch again", 403))
	calls[3].reject(new RoomError("busy", "GoodWatch is temporarily unavailable", 503, true))
	assert.deepEqual((await next).value, [])
	assert.deepEqual((await start).value, [], "Start leaves the revoked grant's exclusions out")
})

test("a seat logged out and relinked to another account never gets the previous account's seen list", async () => {
	const { m, calls } = members()
	const linkedA = seat("account-a")
	const a = m.seen(linkedA, "p1")
	// Log out while A's read is in flight: the seat stays as a guest; the roster version doesn't change.
	const guest = seat(null)
	await assert.rejects(m.seen(guest, "p1"), (e: RoomError) => e.code === "member_required")
	assert.deepEqual((await quiet(() => m.seenOrNone(guest, "p1"))).value, [])
	assert.equal(calls.length, 1)
	// Relinked to another account, same seat and roster version, with A's read still in flight: B's own list is read.
	const linkedB = seat("account-b")
	const b = m.seen(linkedB, "p1")
	assert.equal(calls.length, 2)
	assert.equal(calls[1].userId, "account-b")
	assert.equal(calls[1].token, "account-b-grant")
	calls[0].resolve(["movie_1", "show_2"])
	calls[1].resolve(["movie_9"])
	assert.deepEqual(await a, ["movie_1", "show_2"])
	assert.deepEqual(await b, ["movie_9"])
	// A failing read for B never falls back to A's list.
	const failing = quiet(() => m.seenOrNone(seat("account-b", "account-b-grant-2"), "p1", { fresh: true }))
	await tick()
	calls[2].reject(new RoomError("busy", "down", 503, true))
	assert.deepEqual((await failing).value, [])
})

/** Reads the seat's list once, so the link has a copy. */
async function copied(m: ContinuousMembers, calls: Call[], room: ContinuousRoom, keys: string[]) {
	const read = m.seen(room, "p1")
	calls.at(-1)!.resolve(keys)
	await read
	await tick()
}
function info<T>(run: () => Promise<T>) {
	const log = console.info
	const logged: string[] = []
	console.info = (line: string) => { logged.push(line) }
	return run().finally(() => { console.info = log }).then((value) => ({ value, logged }))
}

test("Start uses the link's copy from an earlier read without asking GoodWatch", async () => {
	const { m, calls } = members()
	const room = seat("account-a")
	await copied(m, calls, room, ["movie_1", "show_2"])
	const { value, logged } = await info(() => m.seenStored(room, "p1"))
	assert.deepEqual(value, ["movie_1", "show_2"])
	assert.equal(calls.length, 1, "no GoodWatch request at Start")
	assert.match(logged.join("\n"), /yepwatch_member_seen_start.*"source":"copy"/)
	assert.ok(!logged.join("\n").includes("account-a"), "the log names no account or grant")
})

test("without a copy (a restarted server, another instance) Start reads fresh, bounded, and that read becomes the copy", async () => {
	const { m, calls } = members()
	const room = seat("account-a")
	// A background deck build's read is in flight: Start never joins it (it may predate a title marked Seen).
	void m.seen(room, "p1")
	const start = info(() => m.seenStored(room, "p1"))
	await tick()
	assert.equal(calls.length, 2, "one fresh read for Start")
	calls[1].resolve(["movie_1"])
	assert.deepEqual((await start).value, ["movie_1"])
	assert.match((await start).logged.join("\n"), /"source":"read"/)
	calls[0].resolve([])
	await tick()
	assert.deepEqual(await m.seenStored(room, "p1"), ["movie_1"], "an older read landing later never replaces a newer copy")
	assert.equal(calls.length, 2)
})

test("without a copy and with GoodWatch slow, Start goes on without the member's exclusions at the bound", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	const { m, calls } = members({ timeoutMs: 30 })
	const room = seat("account-a")
	const start = quiet(() => m.seenStored(room, "p1"))
	await tick()
	t.mock.timers.tick(30)
	const { value } = await start
	assert.deepEqual(value, [])
	// The late answer is still the link's copy: the next Start (a restart of the room) uses it.
	calls[0].resolve(["movie_7"])
	await tick()
	assert.deepEqual(await m.seenStored(room, "p1"), ["movie_7"])
	assert.equal(calls.length, 1)
})

test("a copy older than the bound isn't used: Start reads again", async () => {
	let now = 1_000_000
	const { m, calls } = members({ copyMaxAgeMs: 60_000, now: () => now })
	const room = seat("account-a")
	;(room.participants[0] as { memberGrant: { expiresAt: number } }).memberGrant.expiresAt = now + 3_600_000
	await copied(m, calls, room, ["movie_1"])
	now += 60_001
	const start = m.seenStored(room, "p1")
	await tick()
	assert.equal(calls.length, 2)
	calls[1].resolve(["movie_1", "movie_2"])
	assert.deepEqual(await start, ["movie_1", "movie_2"])
})

test("a refusal ends the link's copy: Start leaves the member's titles out without asking GoodWatch, and an older read landing later stores nothing", async () => {
	const { m, calls } = members()
	const room = seat("account-a")
	await copied(m, calls, room, ["movie_1"])
	// A deck build's read is in flight when a room change's read is refused (grant revoked on GoodWatch).
	const older = m.seen(room, "p1")
	const refusedRead = m.seen(room, "p1", { fresh: true })
	calls[2].reject(new RoomError("member_required", "Connect GoodWatch again", 403))
	await assert.rejects(refusedRead)
	calls[1].resolve(["movie_1", "movie_2"])
	await older
	await tick()
	const { value, logged } = await quiet(() => m.seenStored(room, "p1"))
	assert.deepEqual(value, [])
	assert.match(logged.join("\n"), /"reason":"refused"/)
	assert.equal(calls.length, 3, "Start asked GoodWatch nothing for the refused link")
	// A new grant (the member signed in again) is another link, read on its own.
	const relinked = seat("account-a", "account-a-grant-2")
	const start = m.seenStored(relinked, "p1")
	await tick()
	assert.equal(calls.length, 4)
	assert.equal(calls[3].token, "account-a-grant-2")
	calls[3].resolve(["show_5"])
	assert.deepEqual(await start, ["show_5"])
})

test("a GoodWatch outage on a later read keeps the copy", async () => {
	const { m, calls } = members()
	const room = seat("account-a")
	await copied(m, calls, room, ["movie_1"])
	const failing = m.seen(room, "p1", { fresh: true })
	calls[1].reject(new RoomError("busy", "GoodWatch is temporarily unavailable", 503, true))
	await assert.rejects(failing)
	assert.deepEqual(await m.seenStored(room, "p1"), ["movie_1"])
	assert.equal(calls.length, 2)
})

test("a logged-out seat, another account or a renewed grant never gets the link's copy", async () => {
	const { m, calls } = members()
	await copied(m, calls, seat("account-a"), ["movie_1", "show_2"])
	// Log out: the seat is a guest. Leave also removes the grant.
	assert.deepEqual((await quiet(() => m.seenStored(seat(null), "p1"))).value, [])
	assert.equal(calls.length, 1)
	// Relinked to account B on the same seat: B's own list, never A's copy.
	const b = m.seenStored(seat("account-b"), "p1")
	await tick()
	assert.equal(calls.length, 2)
	assert.equal(calls[1].userId, "account-b")
	calls[1].resolve(["movie_9"])
	assert.deepEqual(await b, ["movie_9"])
	// A's grant renewed: the copy belonged to the old grant; the new one is read (and proves itself).
	const renewed = m.seenStored(seat("account-a", "account-a-grant-2"), "p1")
	await tick()
	assert.equal(calls.length, 3)
	calls[2].resolve(["movie_1"])
	assert.deepEqual(await renewed, ["movie_1"])
	// An expired grant has no copy either.
	const expired = seat("account-a")
	;(expired.participants[0] as { memberGrant: { expiresAt: number } }).memberGrant.expiresAt = Date.now() - 1
	assert.deepEqual((await quiet(() => m.seenStored(expired, "p1"))).value, [])
	assert.equal(calls.length, 3)
})

test("a copy is kept per room seat: the same account in another room reads its own", async () => {
	const { m, calls } = members()
	await copied(m, calls, seat("account-a"), ["movie_1"])
	const other = { ...seat("account-a"), id: "room-2" } as ContinuousRoom
	const start = m.seenStored(other, "p1")
	await tick()
	assert.equal(calls.length, 2)
	calls[1].resolve(["movie_1"])
	await start
})

test("a room change reads the list again only when the copy is missing or 10 s old, sharing a read in flight", async () => {
	let now = 1_000_000
	const { m, calls } = members({ now: () => now })
	const room = seat("account-a")
	;(room.participants[0] as { memberGrant: { expiresAt: number } }).memberGrant.expiresAt = now + 3_600_000
	m.refreshSeen(room, "p1")
	m.refreshSeen(room, "p1")
	assert.equal(calls.length, 1, "missing: read once, the second refresh shares it")
	calls[0].resolve(["movie_1"])
	await tick()
	now += 5_000
	m.refreshSeen(room, "p1")
	assert.equal(calls.length, 1, "a 5 s old copy is recent enough")
	now += 5_000
	m.refreshSeen(room, "p1")
	assert.equal(calls.length, 2, "10 s old: read again")
	calls[1].resolve(["movie_1", "movie_2"])
	await tick()
	assert.deepEqual(await m.seenStored(room, "p1"), ["movie_1", "movie_2"], "Start uses the refreshed copy")
	assert.equal(calls.length, 2)
	// Not linked (a guest seat): nothing to refresh, never a throw.
	m.refreshSeen(seat(null), "p1")
	assert.equal(calls.length, 2)
	// A refused refresh ends the copy.
	now += 10_000
	m.refreshSeen(room, "p1")
	calls[2].reject(new RoomError("member_required", "Connect GoodWatch again", 403))
	await tick()
	assert.deepEqual((await quiet(() => m.seenStored(room, "p1"))).value, [])
	assert.equal(calls.length, 3)
})

test("a refusal on any read with a grant ends its copies in every room and seat", async () => {
	let refuse = false
	const { m, calls } = members({ verify: async () => { if (refuse) throw new RoomError("member_required", "Connect GoodWatch again", 403); return { userId: "account-a", expiresAt: Date.now() + 600_000 } } })
	const roomA = seat("account-a")
	const roomB = { ...seat("account-a"), id: "room-2" } as ContinuousRoom
	await copied(m, calls, roomA, ["movie_1"])
	await copied(m, calls, roomB, ["movie_2"])
	// GoodWatch refuses the grant on an identity check (the room's member status) in room A.
	refuse = true
	await assert.rejects(m.identity(roomA, "p1"))
	for (const room of [roomA, roomB]) assert.deepEqual((await quiet(() => m.seenStored(room, "p1"))).value, [])
	assert.equal(calls.length, 2, "nothing asked GoodWatch for the refused grant")
	// A seen read with that grant landing later stores nothing either.
	const late = m.seen(roomB, "p1")
	calls[2].resolve(["movie_3"])
	await late
	await tick()
	assert.deepEqual((await quiet(() => m.seenStored(roomB, "p1"))).value, [])
})

test("a copy taken without reading is the copy or nothing, and a refusal since ends it", async () => {
	const { m, calls } = members()
	const room = seat("account-a")
	assert.deepEqual(await m.seenStored(room, "p1", { read: false }), [], "no copy: nothing, and no read")
	assert.equal(calls.length, 0)
	await copied(m, calls, room, ["movie_1"])
	assert.deepEqual(await m.seenStored(room, "p1", { read: false }), ["movie_1"])
	const refusedRead = m.seen(room, "p1")
	calls[1].reject(new RoomError("member_required", "Connect GoodWatch again", 403))
	await assert.rejects(refusedRead)
	assert.deepEqual(await m.seenStored(room, "p1", { read: false }), [])
	assert.equal(calls.length, 2)
})
