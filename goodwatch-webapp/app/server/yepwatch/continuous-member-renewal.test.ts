import { test } from "node:test"
import assert from "node:assert/strict"
import { ContinuousMembers, RENEWABLE_SESSION_MS, type MemberIssuer } from "./continuous-members.server.ts"
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
		exchange: async () => { throw new Error("not used") },
		async verify(token) {
			if (!live.has(token)) throw new RoomError("unauthorized", "expired", 401)
			return { userId: "account-1", expiresAt: clock.now + 300_000, displayName: "Alper" }
		},
		async refresh({ refreshToken }) {
			spent.push(refreshToken)
			if (spent.filter((t) => t === refreshToken).length > 1) throw new RoomError("unauthorized", "invalid_grant", 401)
			const n = ++issued
			live.add(`grant-${n}`)
			return { accessToken: `grant-${n}`, expiresAt: clock.now + 300_000, refreshToken: `refresh-${n}` }
		},
	}
	const m = new ContinuousMembers({} as ContinuousRepository, issuer, { prefill: async () => { throw new Error("not used") } }, {
		callbackUrl: "https://yepwatch.example/callback",
		browserOrigins: ["https://yepwatch.example"],
		nativeReturnUri: "yepwatch://auth/callback",
		sessionSecret: "test-renewal-secret-at-least-thirty-two-chars",
	}, () => clock.now)
	// Signed in long ago: the access token has lapsed, the refresh grant still holds.
	const lapsed = m.sealSession({ v: 1, sessionId: "device-1", userId: "account-1", displayName: "Alper", accessToken: "grant-0", expiresAt: clock.now - 1, refreshToken: "refresh-0" })
	const settle = () => new Promise((resolve) => setTimeout(resolve, 10))
	return { m, clock, spent, lapsed, settle }
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
	assert.deepEqual(spent, ["refresh-0", "refresh-1"], "the spent refresh-0 is never sent again; refresh-1's lapsed access renews")
})

test("once the device sends the rotated session, the replaced one is kept only for requests still in flight", async () => {
	const { m, clock, lapsed, settle } = members()
	await m.account(lapsed, { background: true })
	await settle()
	const rotated = (await m.account(lapsed)).session!
	assert.equal(rotated.refreshToken, "refresh-1")
	await m.account(m.sealSession(rotated))
	const racing = await m.account(lapsed)
	assert.equal(racing.session?.refreshToken, "refresh-1", "a request sent before the device kept it still gets it")
	clock.now += RENEWABLE_SESSION_MS - 1
	const replay = await m.account(lapsed)
	assert.equal(replay.status.state, "guest", "a long-replaced session is GoodWatch's to refuse")
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
	assert.equal(new Set(spent).size, spent.length, `no refresh token is sent twice: ${spent.slice(before).join(",")}`)
})

test("verifying a rotated session keeps track of the session it replaced", async () => {
	const { m, clock, lapsed, settle } = members()
	const internals = m as unknown as { landed: Map<string, { until: number }> }
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
	const longest = Math.max(...[...internals.landed.values()].map((v) => v.until - clock.now))
	assert.ok(longest <= 5 * 60_000, `every replaced session is kept only for in-flight requests (${longest} ms)`)
})
