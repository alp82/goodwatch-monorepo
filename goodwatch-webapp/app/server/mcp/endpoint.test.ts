import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import type { OAuthTokenVerifier } from "@modelcontextprotocol/server"
import { createMcpHandler } from "@modelcontextprotocol/server"
import { renderMetrics } from "../metrics/registry.server.ts"
const { createReadToolServer, createToolServer } = await import(
	"./tools.server.ts"
)

const { createReadMcpHandler } = await import("./endpoint.server.ts")

test("MCP refuses anonymous callers and never caches the challenge", async () => {
	const handle = createReadMcpHandler({ resource: "http://localhost:3336/mcp" })
	const response = await handle(new Request("http://localhost:3336/mcp"))
	assert.equal(response.status, 401)
	assert.match(response.headers.get("WWW-Authenticate") ?? "", /Bearer/)
	assert.doesNotMatch(
		response.headers.get("WWW-Authenticate") ?? "",
		/(?:^|[, ])scope=/,
	)
	assert.match(
		response.headers.get("WWW-Authenticate") ?? "",
		/resource_metadata=/,
	)
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
const writer: OAuthTokenVerifier = {
	async verifyAccessToken(token) {
		return {
			...(await verifier.verifyAccessToken(token)),
			scopes: ["mcp:read", "mcp:write"],
		}
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

test("The usage log line carries the authenticated member id, never the arguments or the token", async (t) => {
	const lines: string[] = []
	t.mock.method(console, "log", (line: unknown) => lines.push(String(line)))
	const handle = createReadMcpHandler({
		resource,
		authorization: verifier,
		limiter: {
			async take() {
				return { allowed: false, store: "valkey", retryAfterSeconds: 1 }
			},
		},
	})
	await handle(
		rpc("tools/call", {
			name: "search_titles",
			arguments: { query: "secret query" },
		}),
	)
	const anonymous = await handle(new Request(resource, { method: "POST" }))
	assert.equal(anonymous.status, 401)
	assert.deepEqual(lines, [
		"MCP rpc: user=member-A method=tools/call tool=search_titles protocol=2026-07-28 ui=none",
	])
	assert.doesNotMatch(lines.join("\n"), /secret|test-token/)
})

test("Read-only tokens cannot force a write and receive an HTTP scope challenge", async () => {
	const handle = createReadMcpHandler({
		resource,
		authorization: verifier,
		limiter: unlimited,
	})
	const response = await handle(
		rpc("tools/call", {
			name: "log_watch",
			arguments: { title_id: "movie:2000", action_id: "local-watch" },
		}),
	)
	assert.equal(response.status, 403)
	assert.match(
		response.headers.get("WWW-Authenticate") ?? "",
		/insufficient_scope/,
	)
	assert.match(
		response.headers.get("WWW-Authenticate") ?? "",
		/scope="mcp:read mcp:write"/,
	)
	assert.match(response.headers.get("Cache-Control") ?? "", /no-transform/)
})

test("MCP rejects cross-origin requests before authorization", async () => {
	const handle = createReadMcpHandler({ resource })
	const request = rpc("tools/list")
	request.headers.set("Origin", "https://evil.example")
	assert.equal((await handle(request)).status, 403)
})

// Production: remix-serve behind Traefik rebuilds request.url as http:// and Traefik sets X-Forwarded-Proto.
const production = "https://goodwatch.app/mcp"
const proxied = (host: string, headers: Record<string, string> = {}) =>
	new Request(`http://${host}/mcp`, {
		method: "POST",
		headers: {
			"X-Forwarded-Proto": "https",
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
			...headers,
		},
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
	})

test("MCP behind the proxy answers a client without Origin with the bearer challenge", async () => {
	const handle = createReadMcpHandler({ resource: production })
	const response = await handle(proxied("goodwatch.app"))
	assert.equal(response.status, 401)
	assert.match(
		response.headers.get("WWW-Authenticate") ?? "",
		/resource_metadata="https:\/\/goodwatch\.app\/\.well-known\/oauth-protected-resource\/mcp"/,
	)
})

test("MCP behind the proxy accepts its own Origin and rejects a foreign one or a wrong Host", async () => {
	const handle = createReadMcpHandler({ resource: production })
	const own = await handle(
		proxied("goodwatch.app", { Origin: "https://goodwatch.app" }),
	)
	assert.equal(own.status, 401)
	const foreign = await handle(
		proxied("goodwatch.app", { Origin: "https://evil.example" }),
	)
	assert.equal(foreign.status, 403)
	const wrongHost = await handle(proxied("evil.example"))
	assert.equal(wrongHost.status, 403)
	const plainHttp = await handle(
		proxied("goodwatch.app", { "X-Forwarded-Proto": "http" }),
	)
	assert.equal(plainHttp.status, 403)
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
			"discover_titles",
			"get_discover_filters",
			"get_title",
			"get_similar_titles",
			"get_my_shows",
			"get_show_progress",
			"get_tonight",
			"get_library",
			"get_taste",
			"search_people",
			"get_person",
			"get_my_lists",
			"get_list",
			"get_settings",
		],
	)
	for (const tool of tools) {
		assert.equal(tool.annotations.readOnlyHint, true)
		assert.equal(tool.annotations.idempotentHint, true)
		assert.equal(tool.annotations.destructiveHint, false)
		assert.equal(tool.inputSchema.type, "object")
		assert.match(tool.description, /ready-made link field VERBATIM/)
		assert.match(tool.description, /page_url/)
		assert.match(tool.description, /Poster cards do not replace the text/)
		assert.match(
			tool.description,
			/bulleted list of links, one title per bullet/,
		)
		assert.match(tool.description, /ready-made link first, then a short note/)
		assert.match(
			tool.description,
			/every person name.*ready-made link field VERBATIM/,
		)
	}
})

test(
	"read/write tools, ranked search and error answers work under remix-serve's fetch polyfill",
	{ timeout: 15_000 },
	async () => {
		// remix-serve installs @remix-run/web-fetch (the app has no v3_singleFetch): its Response has no static json(),
		// which the MCP SDK calls while it answers. Without the server entry's fill, tools/list never settled.
		const { installGlobals } = await import("@remix-run/node")
		const { fillWebFetchGaps } = await import("../web-fetch-gaps.server.ts")
		const names = [
			"fetch",
			"Request",
			"Response",
			"Headers",
			"FormData",
		] as const
		const original = Object.fromEntries(
			names.map((name) => [name, globalThis[name]]),
		)
		// remix-serve's order: it imports the server build first, so the entry's fill sees the native classes and does
		// nothing, and only then installs the polyfill. The handler has to fill the gaps when a request arrives.
		fillWebFetchGaps()
		installGlobals()
		try {
			const anonymous = await createReadMcpHandler({
				resource,
				authorization: verifier,
				limiter: unlimited,
			})(
				new Request(resource, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: "{}",
				}),
			)
			assert.equal(anonymous.status, 401, await anonymous.clone().text())
			assert.match(anonymous.headers.get("WWW-Authenticate") ?? "", /^Bearer /)
			const unconfigured = await createReadMcpHandler({
				authorization: verifier,
				limiter: unlimited,
			})(new Request(resource))
			assert.equal(unconfigured.status, 401)
			const cookies = new Headers()
			cookies.append("Set-Cookie", "gw.session_token=local; Path=/; HttpOnly")
			cookies.append(
				"Set-Cookie",
				"other=local; Expires=Thu, 15 Oct 2026 03:00:00 GMT",
			)
			assert.equal(cookies.getSetCookie().length, 2)
			const listed = await createReadMcpHandler({
				resource,
				authorization: verifier,
				limiter: unlimited,
			})(rpc("tools/list"))
			assert.equal(listed.status, 200, await listed.clone().text())
			assert.ok((await result(listed)).result.tools.length > 0)
			const handle = createReadMcpHandler({
				resource,
				authorization: writer,
				limiter: unlimited,
			})
			const tools = (await result(await handle(rpc("tools/list")))).result.tools
			assert.equal(tools.length, 25)
			assert.equal(
				tools.find((tool: { name: string }) => tool.name === "search_titles")
					.inputSchema.properties.ranked.default,
				false,
			)
			const oversized = rpc("tools/list")
			oversized.headers.set("Content-Length", String(4 * 1024 * 1024 + 1))
			assert.equal((await handle(oversized)).status, 413)
			const malformed = new Request(resource, {
				method: "POST",
				headers: {
					Authorization: "Bearer local",
					"Content-Type": "application/json",
				},
				body: "{",
			})
			assert.equal((await handle(malformed)).status, 400)
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
	},
)

test("Ranked catalog search is an explicit opt-in and documents its member quota", async () => {
	const handle = createReadMcpHandler({
		resource,
		authorization: verifier,
		limiter: unlimited,
	})
	const tools = (await result(await handle(rpc("tools/list")))).result.tools
	const search = tools.find(
		(tool: { name: string }) => tool.name === "search_titles",
	)
	assert.equal(search.title, "Search titles by name")
	assert.doesNotMatch(search.description, /ranked search/i)
	assert.match(search.description, /smarter match/)
	assert.equal(search.inputSchema.properties.ranked.type, "boolean")
	assert.equal(search.inputSchema.properties.ranked.default, false)
	assert.match(search.description, /20.*UTC day/)
	assert.match(search.description, /paging.*free/i)
})

test("Write scopes expose all writes with destructive hints on every write and no approval-token schema", async () => {
	const handle = createReadMcpHandler({
		resource,
		authorization: writer,
		limiter: unlimited,
	})
	const listed = (await result(await handle(rpc("tools/list")))).result.tools
	assert.equal(listed.length, 25)
	const writes = listed.filter(
		(tool: { annotations: { readOnlyHint: boolean } }) =>
			!tool.annotations.readOnlyHint,
	)
	assert.deepEqual(
		writes.map((tool: { name: string }) => tool.name),
		[
			"log_watch",
			"rate_title",
			"set_want_to_see",
			"set_not_interested",
			"set_show_status",
			"undo_watch",
			"set_my_services",
			"set_settings",
			"create_list",
			"update_list_titles",
		],
	)
	for (const tool of writes) {
		assert.equal(tool.annotations.readOnlyHint, false)
		assert.equal(tool.annotations.destructiveHint, true)
		assert.equal(tool.annotations.idempotentHint, true)
		assert.equal(tool.inputSchema.required.includes("action_id"), true)
		assert.equal(
			JSON.stringify(tool.inputSchema).includes("confirmation_id"),
			false,
		)
	}
	assert.equal(
		writes.find((tool: { name: string }) => tool.name === "undo_watch").title,
		"Remove a watch",
	)
})

test("Write policy is checked again after a tool was registered", async () => {
	const server = createToolServer("member-A", new URL(resource).origin, true)
	const handler = createMcpHandler(() => server, { legacy: "stateless" })
	process.env.REC_MCP_WRITE = "off"
	try {
		const called = (
			await result(
				await handler.fetch(
					rpc("tools/call", {
						name: "log_watch",
						arguments: {
							title_id: "movie:2000",
							action_id: "write-policy-probe",
						},
					}),
				),
			)
		).result
		assert.equal(called.isError, true)
		assert.equal(called.structuredContent.outcome, "disabled")
	} finally {
		Reflect.deleteProperty(process.env, "REC_MCP_WRITE")
		await handler.close()
	}
})

test("A read-only batch containing a write is rejected before any dispatch", async () => {
	const handle = createReadMcpHandler({
		resource,
		authorization: verifier,
		limiter: unlimited,
	})
	const request = new Request(resource, {
		method: "POST",
		headers: {
			Authorization: "Bearer local",
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
		},
		body: JSON.stringify([
			{ jsonrpc: "2.0", id: 1, method: "tools/list" },
			{
				jsonrpc: "2.0",
				id: 2,
				method: "tools/call",
				params: {
					name: "set_my_services",
					arguments: { country: "US", services: [], action_id: "batch-denied" },
				},
			},
		]),
	})
	assert.equal((await handle(request)).status, 403)
})

test("The write-scope preflight bounds the body and rejects malformed JSON", async () => {
	const handle = createReadMcpHandler({
		resource,
		authorization: writer,
		limiter: unlimited,
	})
	const oversized = rpc("tools/list")
	oversized.headers.set("Content-Length", String(4 * 1024 * 1024 + 1))
	assert.equal((await handle(oversized)).status, 413)
	const malformed = new Request(resource, {
		method: "POST",
		headers: {
			Authorization: "Bearer local",
			"Content-Type": "application/json",
		},
		body: "{",
	})
	const response = await handle(malformed)
	assert.equal(response.status, 400)
	assert.match(response.headers.get("Cache-Control") ?? "", /no-transform/)
})

test("MCP initialization tells clients to link titles and end with the page link", async () => {
	const handle = createReadMcpHandler({
		resource,
		authorization: verifier,
		limiter: unlimited,
	})
	const response = await handle(
		new Request(resource, {
			method: "POST",
			headers: {
				Authorization: "Bearer local",
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: "2025-03-26",
					capabilities: {},
					clientInfo: { name: "local", version: "1" },
				},
			}),
		}),
	)
	assert.equal(response.status, 200)
	const initialized = (await result(response)).result
	const { mcpServerInfo } = await import("./identity.ts")
	assert.deepEqual(initialized.serverInfo, mcpServerInfo)
	assert.match(initialized.instructions, /ready-made link field VERBATIM/)
	assert.match(initialized.instructions, /See it on GoodWatch:/)
	assert.match(initialized.instructions, /Poster cards do not replace the text/)
	assert.match(
		initialized.instructions,
		/bulleted list of links, one title per bullet/,
	)
	assert.match(
		initialized.instructions,
		/every person name.*ready-made link field VERBATIM/,
	)
	assert.match(initialized.instructions, /stream_link field VERBATIM/)
})

test("Search, library and Watch next expose the requested client contract", async () => {
	const handle = createReadMcpHandler({
		resource,
		authorization: verifier,
		limiter: unlimited,
	})
	const tools = (await result(await handle(rpc("tools/list")))).result.tools
	const search = tools.find(
		(tool: { name: string }) => tool.name === "search_titles",
	)
	assert.equal(search.inputSchema.properties.limit.default, 40)
	assert.equal(search.inputSchema.properties.limit.maximum, 40)
	assert.equal(search.inputSchema.properties.for_you.type, "boolean")
	assert.equal(search.inputSchema.properties.exclude_seen.type, "boolean")
	assert.match(search.description, /never loop over get_title/)
	const library = tools.find(
		(tool: { name: string }) => tool.name === "get_library",
	)
	assert.deepEqual(library.inputSchema.properties.sort.enum, [
		"added",
		"waiting",
		"last",
		"score",
		"title",
		"match",
		"runtime",
	])
	assert.match(library.description, /added_at/)
	const next = tools.find(
		(tool: { name: string }) => tool.name === "get_tonight",
	)
	assert.equal(next.title, "Watch next")
	assert.match(next.description, /next episode/)
	assert.match(next.description, /get_library/)
})

test("Server instructions require GoodWatch taste and native full-library runtime sorting", async () => {
	const handle = createReadMcpHandler({
		resource,
		authorization: verifier,
		limiter: unlimited,
	})
	const tools = (await result(await handle(rpc("tools/list")))).result.tools
	for (const tool of tools) {
		assert.match(tool.description, /GoodWatch match/)
		assert.match(tool.description, /never replace them with your own judgment/)
		assert.match(tool.description, /stream_link field VERBATIM/)
	}
	const library = tools.find(
		(tool: { name: string }) => tool.name === "get_library",
	)
	assert.match(library.description, /Defaults to match/)
	assert.match(library.description, /entire filtered library/)
})

test("foreign browser preflights cannot reach MCP or obtain CORS permission", async () => {
	const handle = createReadMcpHandler({ resource })
	const response = await handle(
		new Request(resource, {
			method: "OPTIONS",
			headers: {
				Origin: "https://claude.ai",
				"Access-Control-Request-Method": "POST",
				"Access-Control-Request-Headers":
					"authorization,content-type,mcp-protocol-version",
			},
		}),
	)
	assert.equal(response.status, 403)
	assert.equal(response.headers.get("Access-Control-Allow-Origin"), null)
	assert.equal(response.headers.get("Access-Control-Allow-Credentials"), null)
})

test("Batch write tools list items up to 50, the file import for whole histories, and undo by batch_id", async () => {
	const handle = createReadMcpHandler({
		resource,
		authorization: writer,
		limiter: unlimited,
	})
	const listed = (await result(await handle(rpc("tools/list")))).result.tools
	const byName = new Map(
		listed.map((tool: { name: string }) => [tool.name, tool]),
	)
	for (const name of [
		"rate_title",
		"set_want_to_see",
		"set_not_interested",
		"set_show_status",
		"log_watch",
	]) {
		const tool = byName.get(name) as {
			description: string
			inputSchema: {
				required: string[]
				properties: Record<string, { maxItems?: number; minItems?: number }>
			}
			annotations: { destructiveHint: boolean }
		}
		assert.equal(tool.inputSchema.properties.items.maxItems, 50, name)
		assert.equal(tool.inputSchema.properties.items.minItems, 1, name)
		assert.deepEqual(tool.inputSchema.required, ["action_id"], name)
		assert.match(tool.description, /up to 50 per call/, name)
		assert.match(
			tool.description,
			/full history \(hundreds of titles or more\).*http:\/\/localhost:3336\/settings\/imports/,
			name,
		)
		assert.match(tool.description, /undo_watch with that batch_id/, name)
		assert.equal(tool.annotations.destructiveHint, true, name)
	}
	const undo = byName.get("undo_watch") as {
		description: string
		inputSchema: { properties: Record<string, unknown> }
	}
	assert.ok(undo.inputSchema.properties.batch_id)
	assert.match(undo.description, /batch_id/)
	assert.equal(
		(
			byName.get("set_my_services") as {
				inputSchema: { properties: Record<string, unknown> }
			}
		).inputSchema.properties.items,
		undefined,
	)
})

test("A batch over 50 items is answered with a split message and never dispatched", async () => {
	const server = createToolServer("member-A", new URL(resource).origin, true)
	const handler = createMcpHandler(() => server, { legacy: "stateless" })
	try {
		const called = (
			await result(
				await handler.fetch(
					rpc("tools/call", {
						name: "set_want_to_see",
						arguments: {
							action_id: "too-many",
							want_to_see: true,
							items: Array.from({ length: 51 }, (_, i) => ({
								title_id: `movie:${100 + i}`,
							})),
						},
					}),
				),
			)
		).result
		assert.equal(called.isError, true)
		assert.match(
			JSON.stringify(called.content),
			/At most 50 items per call\. Split the list into calls of 50 or fewer/,
		)
	} finally {
		await handler.close()
	}
})

test("Batch writes count once per item against the member's write budget", async () => {
	const { writeItemCount } = await import("./write-names.ts")
	const call = (args: Record<string, unknown>, name = "rate_title") => ({
		jsonrpc: "2.0",
		id: 1,
		method: "tools/call",
		params: { name, arguments: args },
	})
	assert.deepEqual(
		writeItemCount(call({ title_id: "movie:1", score: 5 }), 50),
		{
			count: 1,
			batches: 0,
		},
	)
	assert.deepEqual(
		writeItemCount(call({ items: Array.from({ length: 30 }, () => ({})) }), 50),
		{ count: 30, batches: 1 },
	)
	assert.deepEqual(
		writeItemCount(
			[
				call({ items: Array.from({ length: 80 }, () => ({})) }),
				call({}, "get_title"),
				call({}),
			],
			50,
		),
		{ count: 51, batches: 1 },
	)
	// A whole show marked Seen or a whole season costs 5; undoing a batch costs a full batch.
	assert.deepEqual(
		writeItemCount(
			call(
				{ status: "Seen", items: [{}, {}, { status: "On hold" }] },
				"set_show_status",
			),
			50,
		),
		{ count: 11, batches: 1 },
	)
	assert.deepEqual(
		writeItemCount(
			call({ title_id: "show:1", season: 1, whole_season: true }, "log_watch"),
			50,
		),
		{ count: 5, batches: 0 },
	)
	assert.deepEqual(
		writeItemCount(call({ action_id: "u", batch_id: "b" }, "undo_watch"), 50),
		{ count: 50, batches: 1 },
	)
	assert.deepEqual(
		writeItemCount({ jsonrpc: "2.0", method: "tools/list" }, 50),
		{
			count: 0,
			batches: 0,
		},
	)

	const takes: { name: string; cost?: number }[] = []
	const limiter = {
		async take(
			name: string,
			_member: string,
			_windows: unknown,
			cost?: number,
		) {
			takes.push({ name, cost })
			return name === "mcp-write-items"
				? {
						allowed: false as const,
						store: "memory" as const,
						retryAfterSeconds: 42,
					}
				: { allowed: true as const, store: "memory" as const }
		},
	}
	const handle = createReadMcpHandler({
		resource,
		authorization: writer,
		limiter,
	})
	const response = await handle(
		rpc("tools/call", {
			name: "set_want_to_see",
			arguments: {
				action_id: "budget",
				want_to_see: true,
				items: Array.from({ length: 12 }, (_, i) => ({
					title_id: `movie:${100 + i}`,
				})),
			},
		}),
	)
	assert.equal(response.status, 429)
	assert.equal(response.headers.get("Retry-After"), "42")
	const body = await response.json()
	assert.equal(body.scope, "write_items")
	assert.match(body.message, /http:\/\/localhost:3336\/settings\/imports/)
	assert.deepEqual(takes, [
		{ name: "mcp-read", cost: undefined },
		{ name: "mcp-write-items", cost: 12 },
	])
	takes.length = 0
	await handle(rpc("tools/list"))
	assert.deepEqual(takes, [{ name: "mcp-read", cost: undefined }])
})

test("A request with two batch writes is refused before any write or budget charge", async () => {
	const takes: string[] = []
	const handle = createReadMcpHandler({
		resource,
		authorization: writer,
		limiter: {
			async take(name: string) {
				takes.push(name)
				return { allowed: true as const, store: "memory" as const }
			},
		},
	})
	const batch = (id: number) => ({
		jsonrpc: "2.0",
		id,
		method: "tools/call",
		params: {
			name: "set_want_to_see",
			arguments: {
				action_id: `b${id}`,
				want_to_see: true,
				items: [{ title_id: "movie:100" }],
			},
		},
	})
	const response = await handle(
		new Request(resource, {
			method: "POST",
			headers: {
				Authorization: "Bearer local",
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
			},
			body: JSON.stringify([batch(1), batch(2)]),
		}),
	)
	assert.equal(response.status, 400)
	assert.match((await response.json()).error.message, /one batch write/)
	assert.deepEqual(takes, ["mcp-read"])
})
