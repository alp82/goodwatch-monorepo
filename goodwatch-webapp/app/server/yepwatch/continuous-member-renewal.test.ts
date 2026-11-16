import { MemoryMemberSessions } from "./member-session-store.ts"
import { test } from "node:test"
import assert from "node:assert/strict"
import {
	ContinuousMembers,
	MemberRefreshNotSent,
	type MemberIssuer,
} from "./continuous-members.server.ts"
import type { ContinuousRepository } from "./continuous-types.ts"
import { RoomError } from "./errors.ts"

/** A GoodWatch double whose refresh tokens rotate once each, on a clock the test moves. */
function members() {
	const clock = { now: 1_000_000_000_000 }
	const spent: string[] = []
	let issued = 0
	const live = new Set<string>()
	const issuer: MemberIssuer = {
		authorize: () => "https://goodwatch.example/authorize",
		exchange: async () => {
			throw new Error("not used")
		},
		async verify(token) {
			if (!live.has(token)) throw new RoomError("unauthorized", "expired", 401)
			return { userId: "account-1", expiresAt: clock.now + 300_000, displayName: "Alper" }
		},
		async refresh({ refreshToken }) {
			spent.push(refreshToken)
			if (spent.filter((t) => t === refreshToken).length > 1)
				throw new RoomError("unauthorized", "invalid_grant", 401)
			const n = ++issued
			live.add(`grant-${n}`)
			return {
				accessToken: `grant-${n}`,
				expiresAt: clock.now + 300_000,
				refreshToken: `refresh-${n}`,
			}
		},
	}
	const store = new MemoryMemberSessions()
	const restart = () =>
		new ContinuousMembers(
			{} as ContinuousRepository,
			issuer,
			{
				prefill: async () => {
					throw new Error("not used")
				},
			},
			{
				callbackUrl: "https://yepwatch.example/callback",
				browserOrigins: ["https://yepwatch.example"],
				nativeReturnUri: "yepwatch://auth/callback",
				sessionSecret: "test-renewal-secret-at-least-thirty-two-chars",
				sessionStore: store,
			},
			() => clock.now,
		)
	const m = restart()
	// Signed in long ago: the access token has lapsed, the refresh grant still holds.
	const lapsed = m.sealSession({
		v: 1,
		sessionId: "device-1",
		userId: "account-1",
		displayName: "Alper",
		accessToken: "grant-0",
		expiresAt: clock.now - 1,
		refreshToken: "refresh-0",
	})
	const settle = () => new Promise((resolve) => setTimeout(resolve, 10))
	return { m, clock, spent, lapsed, settle, restart, issuer, store }
}

test("a rotation the device never received is kept for it as long as the refresh grant lasts", async () => {
	const { m, clock, spent, lapsed, settle } = members()
	const during = await m.account(lapsed, { background: true })
	assert.equal(during.renewing, true)
	assert.equal(during.changed, false, "the answer carries the session as it was")
	await settle()
	assert.deepEqual(spent, ["refresh-0"])
	// The app was closed right after that answer and comes back weeks later with the replaced session.
	clock.now += 30 * 86_400_000
	const back = await m.account(lapsed, { background: true })
	assert.equal(back.changed, true, "the kept rotation goes back to the device")
	assert.equal(back.session?.refreshToken, "refresh-1")
	await settle()
	assert.deepEqual(
		spent,
		["refresh-0", "refresh-1"],
		"the spent refresh-0 is never sent again; refresh-1's lapsed access renews",
	)
})

test("renewal survives a restart with the same store and the old device session", async () => {
	const { m, clock, lapsed, restart, spent } = members()
	await m.account(lapsed)
	clock.now += 301_000
	const back = await restart().account(lapsed)
	assert.equal(back.status.state, "member")
	assert.equal(back.session?.refreshToken, "refresh-2")
	assert.deepEqual(spent, ["refresh-0", "refresh-1"])
})

test("concurrent renewals across instances make exactly one GoodWatch refresh", async () => {
	const { m, lapsed, restart, spent } = members()
	const results = await Promise.all([m.account(lapsed), restart().account(lapsed)])
	assert.ok(results.every((r) => r.status.state === "member"))
	assert.deepEqual(spent, ["refresh-0"])
	assert.equal((await restart().account(lapsed)).session?.refreshToken, "refresh-1")
})

test("a timed-out rotation retries inside the 30 second reuse window", async () => {
	const { m, lapsed, clock, issuer, restart, spent } = members()
	const refresh = issuer.refresh!
	let calls = 0
	let rotated: Awaited<ReturnType<typeof refresh>>
	const started = clock.now
	issuer.refresh = async (input) => {
		calls++
		if (calls === 1) {
			rotated = await refresh(input)
			clock.now += 12_000
			throw new RoomError("busy", "timeout", 503, true)
		}
		assert.ok(clock.now - started < 30_000)
		return rotated!
	}
	const back = await m.account(lapsed)
	assert.equal(back.status.state, "member")
	assert.equal(calls, 2)
	assert.deepEqual(spent, ["refresh-0"])
	assert.equal((await restart().account(lapsed)).session?.refreshToken, "refresh-1")
})

test("a long run of rotations the device never received leads it to the newest, never back to a spent token", async () => {
	const { m, clock, spent, lapsed, settle } = members()
	// Every answer that carried a rotation was lost: the device keeps sending the session it signed in with, and each
	// rotation's own access token has lapsed again by its next request.
	for (let i = 0; i < 12; i++) {
		await m.account(lapsed, { background: true })
		await settle()
		clock.now += 301_000
	}
	const before = spent.length
	const back = await m.account(lapsed, { background: true })
	assert.equal(back.status.state, "member")
	assert.ok(back.changed)
	await settle()
	assert.equal(
		new Set(spent).size,
		spent.length,
		`no refresh token is sent twice: ${spent.slice(before).join(",")}`,
	)
})

test("verifying a rotated session keeps track of the session it replaced", async () => {
	const { m, lapsed, settle, restart } = members()
	// GoodWatch's identity check fails once, right after the rotation: the rotated session is kept unverified.
	const verify = (m as unknown as { issuer: MemberIssuer }).issuer.verify
	let outage = true
	;(m as unknown as { issuer: MemberIssuer }).issuer.verify = async (token) => {
		if (outage) throw new RoomError("busy", "down", 503, true)
		return verify(token)
	}
	await m.account(lapsed, { background: true })
	await settle()
	const unverified = (await m.account(lapsed, { background: true })).session!
	await settle()
	assert.equal(unverified.unverified, true)
	outage = false
	const verified = (await m.account(m.sealSession(unverified))).session!
	assert.equal(verified.unverified, undefined)
	await m.account(m.sealSession(verified))
	const back = await restart().account(lapsed)
	assert.equal(back.session?.unverified, undefined)
	assert.equal(back.session?.refreshToken, "refresh-1")
})

test("lazy migration inserts the legacy pair once and never overwrites a newer stored pair", async () => {
	const { m, lapsed, store, restart } = members()
	assert.equal(await store.read("device-1"), null)
	await m.account(lapsed)
	const row = (await store.read("device-1"))!
	assert.equal(row.value.session.refreshToken, "refresh-1")
	await restart().account(lapsed)
	assert.equal((await store.read("device-1"))?.version, row.version)
})

test("a restart during identity verification reads the already-persisted rotated pair", async () => {
	const { m, lapsed, issuer, store, restart, spent, settle } = members()
	const verify = issuer.verify
	let finish!: () => void
	const waiting = new Promise<void>((resolve) => {
		finish = resolve
	})
	issuer.verify = async (token) => {
		await waiting
		return verify(token)
	}
	await m.account(lapsed, { background: true })
	await settle()
	assert.equal((await store.read("device-1"))?.value.session.refreshToken, "refresh-1")
	const back = await restart().account(lapsed, { background: true })
	assert.equal(back.status.state, "member")
	assert.equal(back.session?.refreshToken, "refresh-1")
	assert.deepEqual(spent, ["refresh-0"])
	finish()
	await settle()
})

test("an ambiguous rotation recorded before a crash is retried only inside the reuse window", async () => {
	const { m, lapsed, store, clock, restart, spent } = members()
	const session = m.openSession(lapsed)!
	await store.compareAndSwap("device-1", null, {
		session,
		owner: "crashed",
		rotating: true,
		startedAt: clock.now - 26_000,
		leaseUntil: clock.now - 1,
	})
	assert.equal((await restart().account(lapsed)).status.state, "member")
	assert.deepEqual(spent, ["refresh-0"])
})

test("an ambiguous rotation outside the reuse window requires sign-in without revoking other devices", async () => {
	const { m, lapsed, store, clock, restart, spent } = members()
	const session = m.openSession(lapsed)!
	await store.compareAndSwap("device-1", null, {
		session,
		owner: "crashed",
		rotating: true,
		startedAt: clock.now - 31_000,
		leaseUntil: clock.now - 1,
	})
	const back = await restart().account(lapsed)
	assert.equal(back.status.state, "guest")
	assert.equal(await store.read("device-1"), null)
	assert.deepEqual(spent, [])
})

test("a lost CAS reply uses the stored winner without another GoodWatch refresh", async () => {
	const { m, lapsed, store, spent, restart } = members()
	const swap = store.compareAndSwap.bind(store)
	store.compareAndSwap = async (...args) => {
		await swap(...args)
		return false // Every write landed, but the caller did not receive confirmation.
	}
	assert.equal((await m.account(lapsed)).status.state, "member")
	assert.deepEqual(spent, ["refresh-0"])
	assert.equal((await restart().account(lapsed)).session?.refreshToken, "refresh-1")
})

test("a connect outage longer than the replay window releases the claim and recovers", async () => {
	const { m, lapsed, clock, issuer, store, restart, spent } = members()
	const refresh = issuer.refresh!
	issuer.refresh = async () => {
		throw new MemberRefreshNotSent()
	}
	const down = await m.account(lapsed)
	assert.equal(down.status.state === "member" && down.status.unavailable, true)
	assert.equal((await store.read("device-1"))?.value.rotating, undefined)
	clock.now += 60_000
	issuer.refresh = refresh
	assert.equal((await restart().account(lapsed)).session?.refreshToken, "refresh-1")
	assert.deepEqual(spent, ["refresh-0"])
})

test("an unknown outage longer than the replay window gives a clean sign-in prompt after recovery", async () => {
	const { m, lapsed, clock, issuer, restart, store } = members()
	const refresh = issuer.refresh!
	issuer.refresh = async () => {
		throw new RoomError("busy", "lost response", 503, true)
	}
	await m.account(lapsed)
	clock.now += 60_000
	issuer.refresh = refresh
	assert.equal((await restart().account(lapsed)).status.state, "guest")
	assert.equal(await store.read("device-1"), null)
	assert.equal(
		(await restart().account(lapsed)).status.state,
		"guest",
		"the deny receipt survives another restart",
	)
})

for (const pending of [false, true])
	test(`a crashed ${pending ? "pending-save" : "verify-only"} claim starts a fresh refresh window`, async () => {
		const { m, lapsed, clock, store, spent } = members()
		await store.compareAndSwap("device-1", null, {
			session: { ...m.openSession(lapsed)!, ...(pending ? { unverified: true } : {}) },
			owner: "crashed",
			rotating: false,
			startedAt: clock.now - 60_000,
			leaseUntil: clock.now - 1,
		})
		const presented = pending
			? m.sealSession({ ...m.openSession(lapsed)!, unverified: true })
			: lapsed
		assert.equal((await m.account(presented)).session?.refreshToken, "refresh-1")
		assert.deepEqual(spent, ["refresh-0"])
	})

test("deploy overlap adopts a newer sealed cookie and never rolls it back", async () => {
	const { m, lapsed, clock, store } = members()
	const old = m.openSession(lapsed)!
	await m.current(old)
	const newer = {
		...old,
		accessToken: "legacy-new",
		refreshToken: "legacy-refresh",
		expiresAt: clock.now + 300_000,
	}
	assert.equal((await m.current(newer))?.session.refreshToken, "legacy-refresh")
	assert.equal((await m.current(old))?.session.refreshToken, "legacy-refresh")
	const row = (await store.read("device-1"))!
	await store.compareAndSwap("device-1", row, { ...row.value, owner: "refreshing", rotating: true })
	assert.equal(
		(await m.current({ ...newer, expiresAt: newer.expiresAt + 1000, refreshToken: "later" }))
			?.session.refreshToken,
		"legacy-refresh",
	)
})

test("a lost unavailable-write reply preserves unavailable, with the unchanged expired session", async () => {
	const { m, lapsed, issuer, store } = members()
	issuer.refresh = async () => {
		throw new MemberRefreshNotSent()
	}
	const swap = store.compareAndSwap.bind(store)
	store.compareAndSwap = async (...args) => {
		await swap(...args)
		return false
	}
	const back = await m.account(lapsed)
	assert.equal(back.status.state === "member" && back.status.unavailable, true)
	assert.equal(back.session?.refreshToken, "refresh-0")
})

test("two 12 second refresh attempts then verification outlive the original 25 second lease", async () => {
	const { m, lapsed, issuer, store, clock, restart, spent } = members()
	const refresh = issuer.refresh!
	const verify = issuer.verify
	let pair: Awaited<ReturnType<typeof refresh>>
	let attempts = 0
	issuer.refresh = async (input) => {
		clock.now += 12_000
		if (++attempts === 1) {
			pair = await refresh(input)
			throw new RoomError("busy", "lost reply", 503, true)
		}
		return pair!
	}
	issuer.verify = async (token) => {
		clock.now += 12_000
		const row = (await store.read("device-1"))!
		assert.equal(row.value.rotating, false)
		assert.ok(row.value.leaseUntil! > clock.now, "rotated pair gets its own verification lease")
		const concurrent = await restart().account(lapsed, { background: true })
		assert.equal(concurrent.session?.refreshToken, "refresh-1")
		return verify(token)
	}
	assert.equal((await m.account(lapsed)).session?.unverified, undefined)
	assert.deepEqual(spent, ["refresh-0"])
})

test("logout, definitive refusal and expiry physically remove stored credentials", async () => {
	const { m, lapsed, issuer, clock, store } = members()
	const session = m.openSession(lapsed)!
	await m.current(session)
	await m.logout(session)
	assert.equal(await store.read("device-1"), null)
	assert.equal(await m.current(session), null)
	issuer.refresh = async () => {
		throw new RoomError("unauthorized", "revoked", 401)
	}
	const refusedSession = { ...session, sessionId: "refused-device" }
	assert.equal((await m.account(m.sealSession(refusedSession))).status.state, "guest")
	assert.equal(await store.read("refused-device"), null)
	const expiring = { ...session, sessionId: "expired-device" }
	await store.compareAndSwap("expired-device", null, {
		session: expiring,
		expiresAt: clock.now - 1,
	})
	assert.equal(await m.current(expiring), null)
	assert.equal(await store.read("expired-device"), null)
})

test("refresh expiry advances on rotation and stays fixed during identity-only verification", async () => {
	const { m, lapsed, issuer, store, clock } = members()
	const verify = issuer.verify
	issuer.verify = async () => {
		throw new RoomError("busy", "identity outage", 503, true)
	}
	await m.account(lapsed)
	const rotated = (await store.read("device-1"))!
	assert.equal(rotated.value.expiresAt, clock.now + 90 * 86400000)
	clock.now += 60_000
	issuer.verify = verify
	await m.account(m.sealSession(rotated.value.session))
	assert.equal((await store.read("device-1"))?.value.expiresAt, rotated.value.expiresAt)
	clock.now += 301_000
	await m.account(lapsed)
	assert.equal((await store.read("device-1"))?.value.expiresAt, clock.now + 90 * 86400000)
})
