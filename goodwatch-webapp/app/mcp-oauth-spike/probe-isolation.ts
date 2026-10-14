// Separate process: SDK transport + fixture-member isolation, without external auth.
import assert from "node:assert/strict"
import { createMcpHandler } from "@modelcontextprotocol/server"
import { setTasteFlag } from "./fixtures.server"
import { createToolServer } from "./tools.server"
import { readRpcResponse } from "./probe-tool-set.mjs"

setTasteFlag("member-hidden", false)
setTasteFlag("member-visible", true)
let id = 1
async function rpc(
	member: string,
	method: string,
	params: Record<string, unknown>,
) {
	const handler = createMcpHandler(() =>
		createToolServer(member, "http://fixture.local"),
	)
	try {
		const response = await handler.fetch(
			new Request("http://fixture.local/mcp", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json, text/event-stream",
				},
				body: JSON.stringify({ jsonrpc: "2.0", id: id++, method, params }),
			}),
		)
		assert.equal(response.status, 200)
		const result = await readRpcResponse(response)
		assert.ok(!result.error)
		return result.result
	} finally {
		await handler.close()
	}
}
const call = async (
	member: string,
	name: string,
	args: Record<string, unknown>,
) =>
	(await rpc(member, "tools/call", { name, arguments: args })).structuredContent
const hidden = await rpc("member-hidden", "tools/list", {})
const visible = await rpc("member-visible", "tools/list", {})
assert.equal(hidden.tools.length, 13)
assert.equal(visible.tools.length, 14)
const before = await call("member-visible", "get_library", {})
await call("member-hidden", "log_watch", {
	title_id: "show:1399",
	season: 1,
	episode: 3,
	action_id: "isolation-watch",
})
const pending = await call("member-hidden", "undo_watch", {
	title_id: "show:1399",
})
assert.equal(
	(
		await call("member-visible", "undo_watch", {
			title_id: "show:1399",
			confirmation_id: pending.confirmation_id,
		})
	).status,
	"watch_not_found",
)
assert.deepEqual(await call("member-visible", "get_library", {}), before)
assert.equal(
	(await call("member-hidden", "get_show_progress", { title_id: "show:1399" }))
		.next_episode.episode,
	4,
)
assert.equal(
	(await call("member-visible", "get_show_progress", { title_id: "show:1399" }))
		.next_episode.episode,
	3,
)
await call("member-visible", "log_watch", {
	title_id: "show:1399",
	season: 1,
	episode: 3,
	action_id: "isolation-watch",
})
assert.equal(
	(
		await call("member-visible", "undo_watch", {
			title_id: "show:1399",
			confirmation_id: pending.confirmation_id,
		})
	).status,
	"confirmation_invalid",
)
await call("member-hidden", "rate_title", {
	title_name: "Lighthouse",
	score: 8,
})
assert.equal((await call("member-visible", "get_taste", {})).rated_titles, 0)
console.log(
	JSON.stringify({
		isolationProbe: "PASS",
		memberScopedFixtures: true,
		perMemberToolCounts: [13, 14],
		crossMemberConfirmationRejected: true,
	}),
)
