import assert from "node:assert/strict"
import { test } from "node:test"
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server"
import { instrument } from "@posthog/mcp"
import { PostHog } from "posthog-node"
import * as z from "zod4"
import { instrumentMcpServer, mcpAnalyticsOptions } from "./analytics.server.ts"

const rpc = (method: string, params: unknown = {}) =>
	new Request("http://localhost/mcp", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
			"MCP-Protocol-Version": "2025-11-25",
		},
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
	})

async function result(response: Response) {
	const text = await response.text()
	return JSON.parse(
		text.startsWith("event:") ? text.split("data: ")[1].split("\n")[0] : text,
	)
}

test("stateless SDK v2 captures identity, intent and failures without tool payloads", async () => {
	const captured: Parameters<PostHog["capture"]>[0][] = []
	const posthog = new PostHog("test", { disabled: true })
	posthog.capture = (event) => {
		captured.push(event)
	}
	const handler = createMcpHandler(
		() => {
			const server = new McpServer({ name: "test", version: "1" })
			instrument(server, posthog, mcpAnalyticsOptions("verified-member"))
			server.registerTool(
				"echo",
				{ inputSchema: z.object({ text: z.string() }) },
				async ({ text }) => ({ content: [{ type: "text", text }] }),
			)
			server.registerTool("fail", { inputSchema: z.object({}) }, async () => {
				throw new Error("test failure")
			})
			return server
		},
		{ legacy: "stateless" },
	)
	try {
		// No tools/list or initialize on this instance: analytics arguments must
		// still be removed before the original strict schema runs.
		const response = await handler.fetch(
			rpc("tools/call", {
				name: "echo",
				arguments: {
					text: "private library",
					context: "Find something to watch",
					llm_model: "test-model",
				},
			}),
		)
		assert.equal(response.status, 200)
		const answer = await result(response)
		assert.equal(answer.result.isError, undefined)
		assert.equal(answer.result.content[0].text, "private library")
		await result(
			await handler.fetch(rpc("tools/call", { name: "fail", arguments: {} })),
		)
		const calls = captured.filter((event) => event.event === "$mcp_tool_call")
		assert.equal(calls.length, 2)
		assert.equal(calls[0].distinctId, "verified-member")
		assert.equal(calls[0].properties?.source, "mcp")
		assert.ok(JSON.stringify(calls[0]).includes("Find something to watch"))
		assert.ok(captured.some((event) => event.event === "$exception"))
		for (const event of captured) {
			assert.equal(event.properties?.$mcp_parameters, undefined)
			assert.equal(event.properties?.$mcp_response, undefined)
		}
		assert.ok(!JSON.stringify(captured).includes("private library"))
	} finally {
		await handler.close()
		await posthog.shutdown()
	}
})

test("disabled analytics leaves advertised tool schemas unchanged", async () => {
	const previous = { ...process.env }
	try {
		for (const settings of [
			{
				NODE_ENV: "development",
				POSTHOG_API_KEY: "test",
				POSTHOG_DISABLED: "false",
			},
			{
				NODE_ENV: "production",
				POSTHOG_API_KEY: "test",
				POSTHOG_DISABLED: "true",
			},
			{
				NODE_ENV: "production",
				POSTHOG_API_KEY: "",
				POSTHOG_DISABLED: "false",
			},
		]) {
			Object.assign(process.env, settings)
			const handler = createMcpHandler(
				() => {
					const server = new McpServer({ name: "test", version: "1" })
					instrumentMcpServer(server, "member")
					server.registerTool(
						"echo",
						{ inputSchema: z.object({ text: z.string() }) },
						async () => ({ content: [] }),
					)
					return server
				},
				{ legacy: "stateless" },
			)
			try {
				const response = await handler.fetch(rpc("tools/list"))
				const answer = await result(response)
				assert.deepEqual(
					Object.keys(answer.result.tools[0].inputSchema.properties),
					["text"],
				)
			} finally {
				await handler.close()
			}
		}
	} finally {
		for (const key of ["NODE_ENV", "POSTHOG_API_KEY", "POSTHOG_DISABLED"]) {
			if (previous[key] === undefined) delete process.env[key]
			else process.env[key] = previous[key]
		}
	}
})
