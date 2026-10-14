/** REC flags accept on/off or comma-separated member IDs. Checked afresh for every list and call. */
export function readToolEnabled(userId: string, tool: string): boolean {
	const enabled = (name: string) => {
		const value = process.env[name]?.trim()
		if (!value || /^(1|on|true|all)$/i.test(value)) return true
		if (/^(0|off|false|none)$/i.test(value)) return false
		return value.split(",").some((id) => id.trim() === userId)
	}
	return (
		enabled("REC_MCP_READ") &&
		enabled(`REC_MCP_${tool.replace(/^get_/, "").toUpperCase()}`)
	)
}
