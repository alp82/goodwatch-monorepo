import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
const binary = new URL("./node_modules/.bin/mcp-inspector", import.meta.url)
	.pathname
const env = {
	...process.env,
	MCP_INSPECTOR_OAUTH_STATE_PATH:
		process.env.MCP_INSPECTOR_OAUTH_STATE_PATH ??
		new URL("../results/inspector-oauth.json", import.meta.url).pathname,
	MCP_INSPECTOR_SECRET_STORE: "file",
	MCP_INSPECTOR_SECRET_FILE:
		process.env.MCP_INSPECTOR_SECRET_FILE ??
		new URL("../results/inspector-secrets.json", import.meta.url).pathname,
}
for (const [name, args] of [
	["get_my_shows", {}],
	["get_show_progress", { title_id: "show:1399" }],
	["search_titles", { query: "Local Movie" }],
	["get_title", { title_id: "show:1399" }],
	["get_tonight", {}],
	["get_library", {}],
	["get_taste", {}],
]) {
	const output = execFileSync(
		binary,
		[
			"--cli",
			"http://127.0.0.1:3356/mcp",
			"--transport",
			"http",
			"--protocol-era",
			"modern",
			"--stored-auth-only",
			"--method",
			"tools/call",
			"--tool-name",
			name,
			"--tool-args-json",
			JSON.stringify(args),
		],
		{
			env,
			encoding: "utf8",
			timeout: 60000,
			stdio: ["ignore", "pipe", "pipe"],
		},
	)
	const result = JSON.parse(output)
	assert.ok(!result.isError)
	assert.ok(result.structuredContent)
	if (name === "get_my_shows")
		assert.equal(result.structuredContent.items[0].next_episode.number, 3)
	if (name === "get_title")
		assert.equal(result.structuredContent.title.name, "Local Orbit")
	console.log(
		JSON.stringify({ client: "Inspector", tool: name, status: "PASS" }),
	)
}
