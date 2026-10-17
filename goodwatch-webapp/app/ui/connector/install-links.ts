// One-click install links for desktop apps that document an MCP install link, and the terminal commands for the
// command-line apps. Each format is the app maker's own, as their docs had it on October 17, 2026:
// - Cursor: cursor.com/docs/mcp/install-links
// - VS Code: code.visualstudio.com/api/extension-guides/ai/mcp
// - Goose: goose docs, "Using extensions", Deeplinks
// - LM Studio: lmstudio.ai/docs/app/mcp/deeplink
// The research behind the page: docs/implementation/mcp-distribution-research.md.
import { CLAUDE_CODE_NAME, CONNECTOR_NAME, CONNECTOR_URL } from "./connector"

export type Server = {
	// The short name the app files the server under, also used in terminal commands ("goodwatch").
	id: string
	// The name shown to people where the app has room for one ("GoodWatch").
	name: string
	url: string
	description: string
}

export const GOODWATCH_SERVER: Server = {
	id: CLAUDE_CODE_NAME,
	name: CONNECTOR_NAME,
	url: CONNECTOR_URL,
	description: "Find what to watch",
}

// Base64 of the JSON's UTF-8 bytes (btoa alone only takes Latin-1). btoa exists in browsers and in Node.
function base64Json(value: unknown) {
	const bytes = new TextEncoder().encode(JSON.stringify(value))
	return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
}

// Cursor: the server entry from mcp.json, without its name, as base64; the name goes separately.
export function cursorInstallLink(server: Server = GOODWATCH_SERVER) {
	const config = base64Json({ url: server.url })
	return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(server.id)}&config=${encodeURIComponent(config)}`
}

// VS Code: the whole server entry, name included, as URL-encoded JSON. Insiders has its own scheme.
export function vscodeInstallLink(
	server: Server = GOODWATCH_SERVER,
	{ insiders = false }: { insiders?: boolean } = {},
) {
	const config = { name: server.id, type: "http", url: server.url }
	return `${insiders ? "vscode-insiders" : "vscode"}:mcp/install?${encodeURIComponent(JSON.stringify(config))}`
}

// Goose: a remote Streamable HTTP extension, every value URL-encoded. The timeout is in seconds.
export function gooseInstallLink(server: Server = GOODWATCH_SERVER) {
	const params: [string, string][] = [
		["url", server.url],
		["type", "streamable_http"],
		["timeout", "300"],
		["id", server.id],
		["name", server.name],
		["description", server.description],
	]
	return `goose://extension?${params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&")}`
}

// LM Studio: like Cursor, the server entry as base64 (URL-encoded), the name separately.
export function lmStudioInstallLink(server: Server = GOODWATCH_SERVER) {
	const config = base64Json({ url: server.url })
	return `lmstudio://add_mcp?name=${encodeURIComponent(server.id)}&config=${encodeURIComponent(config)}`
}

// Terminal apps: first add the server, then sign in.
export type TerminalSteps = {
	add: string
	signIn: string
	signInWhere: "terminal" | "app"
}

export function claudeCodeCommands(
	server: Server = GOODWATCH_SERVER,
): TerminalSteps {
	return {
		add: `claude mcp add --transport http --scope user ${server.id} ${server.url}`,
		signIn: `claude mcp login ${server.id}`,
		signInWhere: "terminal",
	}
}

export function geminiCliCommands(
	server: Server = GOODWATCH_SERVER,
): TerminalSteps {
	return {
		add: `gemini mcp add --transport http --scope user ${server.id} ${server.url}`,
		// Typed inside Gemini CLI, not in the shell.
		signIn: `/mcp auth ${server.id}`,
		signInWhere: "app",
	}
}

export function codexCommands(
	server: Server = GOODWATCH_SERVER,
): TerminalSteps {
	return {
		add: `codex mcp add ${server.id} --url ${server.url}`,
		signIn: `codex mcp login ${server.id}`,
		signInWhere: "terminal",
	}
}

export const CLAUDE_CONNECTORS_URL = "https://claude.ai/customize/connectors"
export const CHATGPT_PLUGINS_URL = "https://chatgpt.com/plugins"
