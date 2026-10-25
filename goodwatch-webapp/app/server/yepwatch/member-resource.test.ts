import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { test } from "node:test"
import { installGlobals } from "@remix-run/node"
import { createMemberResource } from "./member-resource.server.ts"
import {
	releaseMembers,
	releaseMemberConfig,
} from "./proposal-release-members.ts"
import { createProposalHandler } from "./proposal-http.server.ts"
import { ProposalService } from "./proposal-service.server.ts"
import {
	ProposalMemoryRepository,
	proposalFixtureCatalog,
} from "./proposal-test-support.ts"

test("first YepWatch callback after Remix installs its fetch globals completes without another auth request", async () => {
	// remix-serve imports the build first, then installs this older Response.
	const globals = { fetch, Request, Response, Headers, FormData, File }
	installGlobals()
	try {
		assert.equal(typeof Response.json, "undefined")
		const repo = new ProposalMemoryRepository()
		const service = new ProposalService(
			repo,
			proposalFixtureCatalog,
			"callback-test-secret-at-least-thirty-two",
		)
		const admission = await service.create({
			contractVersion: 3,
			commandId: randomBytes(16).toString("hex"),
			admissionSecret: randomBytes(32).toString("base64url"),
			nickname: "Guest",
		})
		const origin = "https://yepwatch.example"
		const config = releaseMemberConfig(
			{
				YEPWATCH_MEMBER_ENABLED: "true",
				YEPWATCH_MEMBER_ISSUER_ORIGIN: "https://goodwatch.example",
				AUTH_YEPWATCH_CLIENT_ID: "fixture-client",
				AUTH_YEPWATCH_RESOURCE: `${origin}/api/yepwatch`,
				AUTH_YEPWATCH_REDIRECT_URIS: `${origin}/api/yepwatch/v1/proposal/member/callback`,
			},
			origin,
		)
		assert.ok(config)
		let reads = 0
		const resource = createMemberResource({
			async verify(token) {
				assert.equal(token, "fixture-grant")
				reads++
				return { userId: "fixture-member", expiresAt: Date.now() + 600_000 }
			},
			async prefill() {
				return { country: "DE", serviceIds: [8], savedProgressAvailable: true }
			},
			async progress() {
				return { source: "goodwatch", shows: [], limitReached: false }
			},
		})
		const members = releaseMembers(repo, config, async (input, init) => {
			const request = new Request(input, init)
			if (new URL(request.url).pathname === "/api/auth/oauth2/token")
				return new Response(
					JSON.stringify({
						access_token: "fixture-grant",
						expires_in: 600,
						token_type: "Bearer",
					}),
				)
			try {
				return await resource(request)
			} catch {
				return new Response("Internal Server Error", { status: 500 })
			}
		})
		const { roomId, participantId, token } = admission.credential
		const returnTo = `${origin}/room/${roomId}`
		const started = await members.start(roomId, participantId, {
			roomId,
			client: "browser",
			returnTo,
		})
		const handler = createProposalHandler(service, {
			serviceSecret: "callback-gateway-secret-at-least-thirty-two",
			allowedOrigins: [origin],
			members,
		})
		const response = await handler(
			new Request(
				`${config.callbackUrl}?${new URLSearchParams({ state: started.state, code: "fixture-code" })}`,
				{
					headers: { cookie: `yepwatch3_${roomId}=${participantId}.${token}` },
				},
			),
		)
		const body = await response.text()
		assert.equal(response.status, 200, body)
		assert.match(response.headers.get("content-type") ?? "", /text\/html/)
		assert.ok(body.includes(returnTo))
		assert.ok(!body.includes("fixture-grant"))
		assert.equal(reads, 2)
		assert.equal((await members.status(roomId, participantId)).state, "linked")
	} finally {
		Object.assign(globalThis, globals)
	}
})
