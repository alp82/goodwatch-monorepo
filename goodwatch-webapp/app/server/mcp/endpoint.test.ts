import assert from "node:assert/strict"
import { test } from "node:test"
import type { OAuthTokenVerifier } from "@modelcontextprotocol/server"
import { createMcpHandler } from "@modelcontextprotocol/server"
import { renderMetrics } from "../metrics/registry.server.ts"
import { createReadToolServer } from "./tools.server.ts"

const { createReadMcpHandler } = await import("./endpoint.server.ts")

test("MCP refuses anonymous callers and never caches the challenge", async () => {
	const handle = createReadMcpHandler({ resource: "http://localhost:3336/mcp" })
	const response = await handle(new Request("http://localhost:3336/mcp"))
	assert.equal(response.status, 401)
	assert.match(response.headers.get("WWW-Authenticate") ?? "", /Bearer/)
	assert.equal(
		response.headers.get("Cache-Control"),
		"private, no-store, no-transform",
	)
})

const resource = "http://localhost:3336/mcp"
const verifier: OAuthTokenVerifier = {
	async verifyAccessToken(token) {
		return {
			token,
			clientId: "local-test",
			scopes: ["mcp:read"],
			expiresAt: Date.now() / 1000 + 60,
			resource: new URL(resource),
			extra: { userId: "member-A" },
		}
	},
}
const unlimited = {
	async take() {
		return { allowed: true as const, store: "memory" as const }
	},
}
const rpc = (method: string, params: Record<string, unknown> = {}) =>
	new Request(resource, {
		method: "POST",
		headers: {
			Authorization: "Bearer test-token",
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
			"MCP-Protocol-Version": "2026-07-28",
			"Mcp-Method": method,
			...(typeof params.name === "string" ? { "Mcp-Name": params.name } : {}),
		},
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method,
			params: {
				...params,
				_meta: {
					"io.modelcontextprotocol/protocolVersion": "2026-07-28",
					"io.modelcontextprotocol/clientCapabilities": {},
				},
			},
		}),
	})

test("Hidden member tools cannot be listed or forced, and never call data services", async () => {
	process.env.REC_MCP_TASTE = "member-B"
	try {
		const handle = createReadMcpHandler({
			resource,
			authorization: verifier,
			limiter: unlimited,
		})
		const listed = (await result(await handle(rpc("tools/list")))).result.tools
		assert.equal(
			listed.some((t: { name: string }) => t.name === "get_taste"),
			false,
		)
		const called = await result(
			await handle(rpc("tools/call", { name: "get_taste", arguments: {} })),
		)
		assert.ok(called.error || called.result?.isError)
	} finally {
		Reflect.deleteProperty(process.env, "REC_MCP_TASTE")
	}
})

test("MCP checks scope, audience, expiry and verified member identity", async () => {
	for (const extra of [
		{ scopes: ["mcp:write"] },
		{ resource: new URL("http://localhost:3336/other") },
		{ expiresAt: 1 },
		{ extra: {} },
		{ expiresAt: undefined },
	]) {
		const authorization: OAuthTokenVerifier = {
			async verifyAccessToken(token) {
				return { ...(await verifier.verifyAccessToken(token)), ...extra }
			},
		}
		const response = await createReadMcpHandler({
			resource,
			authorization,
			limiter: unlimited,
		})(rpc("tools/list"))
		assert.ok([401, 403].includes(response.status))
		assert.match(response.headers.get("Cache-Control") ?? "", /no-transform/)
	}
})

test("MCP rate limiting returns a retry delay before dispatch", async () => {
	const handle = createReadMcpHandler({
		resource,
		authorization: verifier,
		limiter: {
			async take(_name, member) {
				assert.equal(member, "member-A")
				return { allowed: false, store: "valkey", retryAfterSeconds: 17 }
			},
		},
	})
	const response = await handle(
		rpc("tools/call", { name: "get_library", arguments: {} }),
	)
	assert.equal(response.status, 429)
	assert.equal(response.headers.get("Retry-After"), "17")
})

test("MCP rejects cross-origin requests before authorization", async () => {
	const handle = createReadMcpHandler({ resource })
	const request = rpc("tools/list")
	request.headers.set("Origin", "https://evil.example")
	assert.equal((await handle(request)).status, 403)
})

test("A registered tool rechecks its member flag at call time and records bounded metrics", async () => {
	const server = createReadToolServer("member-A", new URL(resource).origin)
	const handler = createMcpHandler(() => server, { legacy: "stateless" })
	process.env.REC_MCP_TASTE = "off"
	try {
		const response = await handler.fetch(
			rpc("tools/call", { name: "get_taste", arguments: {} }),
		)
		const called = (await result(response)).result
		assert.equal(called.isError, true)
		assert.equal(called.structuredContent.status, "tool_disabled")
		const metrics = renderMetrics()
		assert.match(
			metrics,
			/goodwatch_mcp_tool_calls_total\{tool="get_taste",outcome="disabled"\} 1/,
		)
		assert.match(
			metrics,
			/goodwatch_mcp_tool_duration_seconds_count\{tool="get_taste"\} 1/,
		)
		assert.equal(metrics.includes("member-A"), false)
	} finally {
		Reflect.deleteProperty(process.env, "REC_MCP_TASTE")
		await handler.close()
	}
})
async function result(response: Response) {
	const text = await response.text()
	return JSON.parse(
		text.startsWith("event:") ? text.split("data: ")[1].split("\n")[0] : text,
	)
}

test("A member sees separate catalog and personal read tools, with valid schemas and read annotations", async () => {
	const handle = createReadMcpHandler({
		resource,
		authorization: verifier,
		limiter: unlimited,
	})
	const response = await handle(rpc("tools/list"))
	assert.equal(response.status, 200, await response.clone().text())
	const tools = (await result(response)).result.tools
	assert.deepEqual(
		tools.map((t: { name: string }) => t.name),
		[
			"search_titles",
			"get_title",
			"get_my_shows",
			"get_show_progress",
			"get_tonight",
			"get_library",
			"get_taste",
		],
	)
	for (const tool of tools) {
		assert.equal(tool.annotations.readOnlyHint, true)
		assert.equal(tool.annotations.destructiveHint, false)
		assert.equal(tool.inputSchema.type, "object")
	}
})

test("tools/list and the rate-limit answer work under remix-serve's fetch polyfill", { timeout: 15_000 }, async () => {
	// remix-serve installs @remix-run/web-fetch (the app has no v3_singleFetch): its Response has no static json(),
	// which the MCP SDK calls while it answers. Without the server entry's fill, tools/list never settled.
	const { installGlobals } = await import("@remix-run/node")
	const { fillWebFetchGaps } = await import("../web-fetch-gaps.server.ts")
	const names = ["fetch", "Request", "Response", "Headers", "FormData"] as const
	const original = Object.fromEntries(names.map((name) => [name, globalThis[name]]))
	// remix-serve's order: it imports the server build first, so the entry's fill sees the native classes and does
	// nothing, and only then installs the polyfill. The handler has to fill the gaps when a request arrives.
	fillWebFetchGaps()
	installGlobals()
	try {
		const anonymous = await createReadMcpHandler({ resource, authorization: verifier, limiter: unlimited })(
			new Request(resource, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }),
		)
		assert.equal(anonymous.status, 401, await anonymous.clone().text())
		assert.match(anonymous.headers.get("WWW-Authenticate") ?? "", /^Bearer /)
		const unconfigured = await createReadMcpHandler({ authorization: verifier, limiter: unlimited })(
			new Request(resource),
		)
		assert.equal(unconfigured.status, 401)
		const listed = await createReadMcpHandler({
			resource,
			authorization: verifier,
			limiter: unlimited,
		})(rpc("tools/list"))
		assert.equal(listed.status, 200, await listed.clone().text())
		assert.ok((await result(listed)).result.tools.length > 0)
		const limited = await createReadMcpHandler({
			resource,
			authorization: verifier,
			limiter: {
				async take() {
					return { allowed: false, store: "valkey", retryAfterSeconds: 17 }
				},
			},
		})(rpc("tools/list"))
		assert.equal(limited.status, 429)
		assert.deepEqual(await limited.json(), { error: "rate_limited" })
	} finally {
		Object.assign(globalThis, original)
	}
})
