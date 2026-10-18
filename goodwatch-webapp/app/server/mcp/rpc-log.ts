// One log line per JSON-RPC message that reaches the MCP tools: which method a client called, and on initialize
// which client it is and whether it supports MCP Apps (the poster grid). Diagnostics for client behavior only.
// Every line names the member by internal GoodWatch user ID (user=-  when the request isn't authenticated), so
// usage can be traced per member. Never logs tokens, email, names, arguments, query text or results: tool names and
// UI resource URIs are the only request values, and both come from fixed sets.
import { POSTER_GRID_URI } from "./poster-grid.server.ts"

const UI_EXTENSION = "io.modelcontextprotocol/ui"
const CAPABILITIES_META = "io.modelcontextprotocol/clientCapabilities"
const PROTOCOL_META = "io.modelcontextprotocol/protocolVersion"

const record = (value: unknown): Record<string, unknown> | null =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null
/** Short, printable, and free of anything that could split or forge a log line. */
const clean = (value: unknown, max = 40): string =>
	typeof value === "string"
		? value.replace(/[^\w.@/;=+ -]/g, "?").slice(0, max) || "-"
		: "-"

/** "text/html;profile=mcp-app" when the capabilities name the UI extension, "none" when they don't. */
function uiSupport(capabilities: unknown): string {
	const ui = record(record(record(capabilities)?.extensions)?.[UI_EXTENSION])
	if (!ui) return "none"
	const types = Array.isArray(ui.mimeTypes) ? ui.mimeTypes : []
	return types.length ? types.map((type) => clean(type, 60)).join(",") : "yes"
}

export function describeRpc(
	message: unknown,
	knownTools: ReadonlySet<string>,
	protocolHeader: string | null,
	userId: string | null = null,
): string | null {
	const rpc = record(message)
	if (!rpc || typeof rpc.method !== "string") return null
	const params = record(rpc.params)
	const meta = record(params?._meta)
	const parts = [`user=${clean(userId, 80)}`, `method=${clean(rpc.method)}`]
	if (rpc.method === "tools/call")
		parts.push(
			`tool=${typeof params?.name === "string" && knownTools.has(params.name) ? params.name : "other"}`,
		)
	if (rpc.method === "resources/read")
		parts.push(
			`uri=${params?.uri === POSTER_GRID_URI ? POSTER_GRID_URI : "other"}`,
		)
	const protocol =
		params?.protocolVersion ?? meta?.[PROTOCOL_META] ?? protocolHeader
	parts.push(`protocol=${clean(protocol)}`)
	if (rpc.method === "initialize") {
		const client = record(params?.clientInfo)
		parts.push(`client=${clean(client?.name)}/${clean(client?.version, 20)}`)
		parts.push(`ui=${uiSupport(params?.capabilities)}`)
	} else if (meta && CAPABILITIES_META in meta)
		parts.push(`ui=${uiSupport(meta[CAPABILITIES_META])}`)
	return `MCP rpc: ${parts.join(" ")}`
}
