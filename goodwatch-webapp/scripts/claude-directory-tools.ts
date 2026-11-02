// Run with vite-node --config scripts/mcp-personal/vite.config.mjs scripts/claude-directory-tools.ts.
import { writeFileSync } from "node:fs"
import * as z from "zod4"
import { readToolDefinitions } from "../app/server/mcp/tools.server"
import { writeToolDefinitions } from "../app/server/mcp/write-tools.server"

const tools = [
	...readToolDefinitions.map((tool) => ({ ...tool, mode: "read" })),
	...writeToolDefinitions.map((tool) => ({ ...tool, mode: "write" })),
]
const schemas = tools.map((tool) => {
	if (!/^[a-z][a-z0-9_]{0,63}$/.test(tool.name)) throw Error(tool.name)
	if (!tool.title || !tool.description) throw Error(`Missing metadata: ${tool.name}`)
	if (tool.mode === "write" && !("destructive" in tool && tool.destructive))
		throw Error(`Mutation lacks confirmation hint: ${tool.name}`)
	return { name: tool.name, inputSchema: z.toJSONSchema(tool.schema, { io: "input" }) }
})
const header = `# GoodWatch tool reference

Generated from current source using \`scripts/claude-directory-tools.ts\`. Re-run after tool changes. These are source definitions, not an authenticated production discovery result. Account flags and consent can reduce the visible inventory. [Exact input schemas](tool-schemas.json) accompany this reference; runtime refinements also enforce cross-field rules described below and in tool errors.

All reads require \`mcp:read\`; all writes additionally require \`mcp:write\`. All writes require a stable \`action_id\` reused only for retries of the exact action. Account identity comes from OAuth. Reads carry read-only/idempotent hints; all writes carry confirmation and idempotent hints. Share-list writes can publish data. Results return structured JSON plus text, with title/page links where applicable. Read failures set \`isError\` and a status; successful writes report \`applied\` or \`unchanged\`, before/after state and a durable receipt. Conflicts, missing permissions, ambiguous selectors, missing handles, unknown titles, quotas and unavailable data are explicit outcomes; never report them as success.

Discovery is bounded to 40 results; other limits and cursors follow the linked schemas. Title selectors accept canonical IDs or names with an optional year. For writes, an ID takes precedence over redundant name/year. Data can be missing or stale, particularly streaming availability and watch dates. Requests are limited to 60/minute and 1,000/hour; descriptive smarter search also has a 20-uncached-attempt daily quota.

`
writeFileSync(new URL("../../docs/implementation/claude-directory/tools.md", import.meta.url), header + tools.map((tool) => `## ${tool.name} (${tool.mode})\n\n**${tool.title}**\n\n${tool.description}\n`).join("\n"))
writeFileSync(new URL("../../docs/implementation/claude-directory/tool-schemas.json", import.meta.url), JSON.stringify(schemas, null, 2) + "\n")
console.log(`PASS: ${tools.length} names, metadata and mutation hints; generated reference and input schemas`)
