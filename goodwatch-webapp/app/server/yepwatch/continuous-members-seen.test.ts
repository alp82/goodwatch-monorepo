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
function members(options: { timeoutMs?: number } = {}) {
	const calls: Call[] = []
	const reads: MemberReads = {
		seen: (userId, token) => new Promise((resolve, reject) => calls.push({ userId, token, resolve, reject })),
		prefill: async () => ({ country: null, serviceIds: [], savedProgressAvailable: false }),
	}
	const m = new ContinuousMembers(
		{} as ContinuousRepository,
		{} as MemberIssuer,
		reads,
		{ callbackUrl: "", browserOrigins: [], nativeReturnUri: "", seenReadTimeoutMs: options.timeoutMs ?? 1000 },
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

test("concurrent reads for one link share a request; nothing is kept once it settles", async () => {
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

test("a slow seen read is cut off at the bound and leaves the exclusions out; the late answer isn't kept", async () => {
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
	assert.equal(calls.length, 2, "the late answer wasn't kept: the next read asks again")
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
