import "../title-filter/test-alias.ts"
// The /mcp route loads the MCP SDK and the tools on its first request, so a server starts without them.
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { test } from "node:test"

const resolved: string[] = []
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(
			specifier: string,
			context: unknown,
			next: (specifier: string, context: unknown) => { url: string },
		): { url: string }
	}): void
}
registerHooks({
	resolve(specifier, context, next) {
		const result = next(specifier, context)
		resolved.push(result.url)
		return result
	},
})
const mcpModules = () =>
	resolved.filter((url) =>
		/@modelcontextprotocol|\/server\/mcp\/endpoint\.server\.ts/.test(url),
	)

test("importing the route loads nothing of MCP; the first request does and is answered", async () => {
	const route = await import("../../routes/mcp.ts")
	assert.deepEqual(mcpModules(), [])
	const response = await route.loader({
		request: new Request("http://localhost/mcp"),
		params: {},
		context: {},
	} as never)
	assert.equal(response.status, 401)
	assert.match(response.headers.get("WWW-Authenticate") ?? "", /^Bearer /)
	assert.ok(mcpModules().length > 0)
})
