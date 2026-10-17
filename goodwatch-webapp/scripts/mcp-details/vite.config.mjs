import personal from "../mcp-personal/vite.config.mjs"
import ranked from "../mcp-ranked-vite.config.mjs"
export default {
	...personal,
	plugins: [
		...personal.plugins,
		...ranked.plugins.map((plugin) => ({
			...plugin,
			transform(code, id) {
				return plugin.transform(code, id)?.replaceAll("15769", "15969")
			},
		})),
		{
			name: "isolated-mcp-details-ports",
			transform(code, id) {
				if (!id.includes("/scripts/") || !id.endsWith(".integration.ts")) return
				return code
					.replaceAll("15767", "15967")
					.replaceAll("16767", "16967")
					.replaceAll("15769", "15969")
			},
		},
	],
}
