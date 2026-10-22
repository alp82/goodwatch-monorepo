import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import {
	ContinuousMembers,
	pkce,
	type MemberIssuer,
} from "./continuous-members.server.ts"
import {
	ContinuousMemoryRepository,
	continuousFixtureCatalog,
} from "./continuous-test-support.ts"
import { ContinuousService } from "./continuous-service.server.ts"
async function fixture() {
	const repo = new ContinuousMemoryRepository()
	const service = new ContinuousService(
		repo,
		continuousFixtureCatalog,
		"member-fixture-secret-at-least-thirty-two",
	)
	const a = await service.create({
		contractVersion: 2,
		commandId: randomBytes(16).toString("hex"),
		admissionSecret: randomBytes(32).toString("base64url"),
		nickname: "Guest",
	})
	let exchanges = 0
	let revoked = false
	const issuer: MemberIssuer = {
		authorize({ state, challenge }) {
			return `https://goodwatch.example/authorize?${new URLSearchParams({ state, challenge })}`
		},
		async exchange({ code }) {
			exchanges++
			return { accessToken: code, expiresAt: Date.now() + 100000 }
		},
		async verify(token) {
			if (revoked) throw new Error("Revoked")
			return { userId: token, expiresAt: Date.now() + 100000 }
		},
	}
	const reads = {
		async prefill() {
			return { country: "JP", serviceIds: [8], savedProgressAvailable: true }
		},
	}
	const members = new ContinuousMembers(repo, issuer, reads, {
		callbackUrl:
			"https://yepwatch.example/api/yepwatch/v1/continuous/member/callback",
		browserOrigins: ["https://yepwatch.example"],
		nativeReturnUri: "yepwatch://member/callback",
	})
	return {
		repo,
		service,
		a,
		members,
		count: () => exchanges,
		revoke: () => {
			revoked = true
		},
	}
}
test("Native S256/state/actor binding, callback replay, verified private prefill and revocation without replacing guest", async () => {
	const f = await fixture()
	const id = f.a.credential.roomId
	const actor = f.a.credential.participantId
	const verifier = randomBytes(32).toString("base64url")
	const started = await f.members.start(id, actor, {
		roomId: id,
		client: "native",
		returnTo: "yepwatch://member/callback",
		codeChallenge: pkce(verifier),
	})
	await assert.rejects(() =>
		f.members.exchange(id, actor, {
			roomId: id,
			state: started.state,
			code: "memberA",
			codeVerifier: randomBytes(32).toString("base64url"),
		}),
	)
	assert.equal(f.count(), 0)
	await assert.rejects(() =>
		f.members.exchange(id, actor, {
			roomId: id,
			state: `${id}.wrong`,
			code: "memberA",
			codeVerifier: verifier,
		}),
	)
	assert.equal(f.count(), 0)
	const linked = await f.members.exchange(id, actor, {
		roomId: id,
		state: started.state,
		code: "memberA",
		codeVerifier: verifier,
	})
	assert.equal(linked.status.state, "linked")
	assert.equal(f.count(), 1)
	await f.members.exchange(id, actor, {
		roomId: id,
		state: started.state,
		code: "memberA",
		codeVerifier: verifier,
	})
	assert.equal(f.count(), 1)
	const snapshot = await f.service.read(id, {
		participantId: actor,
		token: f.a.credential.token,
	})
	assert.equal(snapshot.own.participantId, actor)
	assert.equal(snapshot.own.canHost, true)
	assert.equal(snapshot.shared.screens.length, 0)
	assert.equal(snapshot.own.member.prefill?.country, "JP")
	assert.ok(!JSON.stringify(snapshot.shared).includes("memberA"))
	assert.ok(!JSON.stringify(snapshot.shared).includes("prefill"))
	f.revoke()
	assert.equal((await f.members.status(id, actor)).state, "unavailable")
})
test("Browser callback binds participant; allowlists and existing member identity cannot be overwritten", async () => {
	const f = await fixture()
	const id = f.a.credential.roomId
	const actor = f.a.credential.participantId
	await assert.rejects(() =>
		f.members.start(id, actor, {
			roomId: id,
			client: "browser",
			returnTo: "https://evil.example/room/" + id,
		}),
	)
	const first = await f.members.start(id, actor, {
		roomId: id,
		client: "browser",
		returnTo: `https://yepwatch.example/room/${id}`,
	})
	await assert.rejects(() =>
		f.members.callback(first.state, "memberA", "another-actor"),
	)
	assert.equal(f.count(), 0)
	await f.members.callback(first.state, "memberA", actor)
	const second = await f.members.start(id, actor, {
		roomId: id,
		client: "browser",
		returnTo: `https://yepwatch.example/room/${id}`,
	})
	await assert.rejects(() => f.members.callback(second.state, "memberB", actor))
	assert.equal(
		(await f.repo.read(id))!.room.participants[0].memberUserId,
		"memberA",
	)
})
for (const client of ["browser", "native"] as const)
	test(`${client} callback ends consent form at a protected document and preserves return binding`, async () => {
		const { createContinuousHandler } = await import(
			"./continuous-http.server.ts"
		)
		const { paths } = await import(
			"../../../packages/yepwatch-contracts/continuous.ts"
		)
		const f = await fixture()
		const id = f.a.credential.roomId
		const actor = f.a.credential.participantId
		const started = await f.members.start(id, actor, {
			roomId: id,
			client,
			returnTo:
				client === "browser"
					? `https://yepwatch.example/room/${id}`
					: "yepwatch://member/callback",
			...(client === "native"
				? { codeChallenge: pkce(randomBytes(32).toString("base64url")) }
				: {}),
		})
		const handler = createContinuousHandler(f.service, {
			serviceSecret: "callback-test-secret-at-least-thirty-two",
			allowedOrigins: ["https://yepwatch.example"],
			members: f.members,
		})
		const cookie = `yepwatch2_${id}=${actor}.${f.a.credential.token}`
		const response = await handler(
			new Request(
				`https://yepwatch.example${paths.memberCallback}?${new URLSearchParams({ state: started.state, code: "fixture-code" })}`,
				{ headers: client === "browser" ? { cookie } : {} },
			),
		)
		assert.equal(response.status, 200)
		assert.equal(response.headers.get("location"), null)
		assert.equal(response.headers.get("referrer-policy"), "no-referrer")
		assert.equal(response.headers.get("cache-control"), "private, no-store")
		assert.match(
			response.headers.get("content-security-policy")!,
			/default-src 'none'; script-src 'nonce-/,
		)
		const html = await response.text()
		assert.ok(!html.includes(f.a.credential.token))
		assert.ok(!html.includes("accessToken"))
		assert.ok(html.includes("location.replace("))
		if (client === "browser") {
			assert.ok(!html.includes("fixture-code"))
			assert.ok(html.includes(`/room/${id}`))
			assert.equal(f.count(), 1)
		} else {
			assert.ok(html.includes("yepwatch://member/callback?"))
			assert.ok(html.includes("code=fixture-code"))
			assert.equal(f.count(), 0)
		}
	})
