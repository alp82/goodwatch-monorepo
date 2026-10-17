// The install links must match each app's documented format byte for byte: an app that can't parse the link opens
// nothing, and the member never learns why.
import "../../server/title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import type { Server } from "./install-links"

const {
	claudeCodeCommands,
	codexCommands,
	cursorInstallLink,
	geminiCliCommands,
	gooseInstallLink,
	lmStudioInstallLink,
	vscodeInstallLink,
} = await import("./install-links.ts")

// The links the research worked out from each app's docs (docs/implementation/mcp-distribution-research.md).
test("Cursor link for GoodWatch", () => {
	assert.equal(
		cursorInstallLink(),
		"cursor://anysphere.cursor-deeplink/mcp/install?name=goodwatch&config=eyJ1cmwiOiJodHRwczovL2dvb2R3YXRjaC5hcHAvbWNwIn0%3D",
	)
})

test("VS Code link for GoodWatch", () => {
	assert.equal(
		vscodeInstallLink(),
		"vscode:mcp/install?%7B%22name%22%3A%22goodwatch%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fgoodwatch.app%2Fmcp%22%7D",
	)
})

test("VS Code Insiders link uses its own scheme", () => {
	assert.ok(
		vscodeInstallLink(undefined, { insiders: true }).startsWith(
			"vscode-insiders:mcp/install?%7B",
		),
	)
})

test("Goose link for GoodWatch", () => {
	assert.equal(
		gooseInstallLink(),
		"goose://extension?url=https%3A%2F%2Fgoodwatch.app%2Fmcp&type=streamable_http&timeout=300&id=goodwatch&name=GoodWatch&description=Find%20what%20to%20watch",
	)
})

test("LM Studio link for GoodWatch", () => {
	assert.equal(
		lmStudioInstallLink(),
		"lmstudio://add_mcp?name=goodwatch&config=eyJ1cmwiOiJodHRwczovL2dvb2R3YXRjaC5hcHAvbWNwIn0%3D",
	)
})

// A server whose values need every kind of escaping: spaces, @, &, =, + and a base64 result with + and /.
const awkward: Server = {
	id: "good watch@home",
	name: "Good & Watch",
	url: "https://example.com/mcp?a=1&b=2+3&c=ü>>>?",
	description: "Find 100% what to watch",
}

const query = (link: string) =>
	new URLSearchParams(link.slice(link.indexOf("?") + 1))
const fromBase64 = (value: string) =>
	JSON.parse(Buffer.from(value, "base64").toString("utf8"))

test("Cursor and LM Studio links survive escaping", () => {
	for (const build of [cursorInstallLink, lmStudioInstallLink]) {
		const link = build(awkward)
		const params = query(link)
		assert.deepEqual([...params.keys()], ["name", "config"])
		assert.equal(params.get("name"), awkward.id)
		assert.deepEqual(fromBase64(params.get("config") ?? ""), {
			url: awkward.url,
		})
		// No raw characters that a query parser would split on or turn into a space.
		assert.doesNotMatch(link.split("config=")[1], /[+/=&]/)
	}
})

test("VS Code link survives escaping", () => {
	const link = vscodeInstallLink(awkward)
	assert.deepEqual(
		JSON.parse(decodeURIComponent(link.slice("vscode:mcp/install?".length))),
		{
			name: awkward.id,
			type: "http",
			url: awkward.url,
		},
	)
})

test("Goose link survives escaping", () => {
	const params = query(gooseInstallLink(awkward))
	assert.deepEqual(Object.fromEntries(params), {
		url: awkward.url,
		type: "streamable_http",
		timeout: "300",
		id: awkward.id,
		name: awkward.name,
		description: awkward.description,
	})
	// Spaces are %20, never +, as Goose's docs ask.
	assert.doesNotMatch(gooseInstallLink(awkward), /\+/)
})

test("terminal commands", () => {
	assert.deepEqual(claudeCodeCommands(), {
		add: "claude mcp add --transport http --scope user goodwatch https://goodwatch.app/mcp",
		signIn: "claude mcp login goodwatch",
		signInWhere: "terminal",
	})
	assert.deepEqual(geminiCliCommands(), {
		add: "gemini mcp add --transport http --scope user goodwatch https://goodwatch.app/mcp",
		signIn: "/mcp auth goodwatch",
		signInWhere: "app",
	})
	assert.deepEqual(codexCommands(), {
		add: "codex mcp add goodwatch --url https://goodwatch.app/mcp",
		signIn: "codex mcp login goodwatch",
		signInWhere: "terminal",
	})
})
