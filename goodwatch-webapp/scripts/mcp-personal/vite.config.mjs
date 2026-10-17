import { fileURLToPath } from "node:url"
const fixture = fileURLToPath(new URL("./taste-fixture.ts", import.meta.url))
export default {
	plugins: [
		{
			name: "isolated-mcp-member-taste",
			transform(code, id) {
				if (!id.endsWith("/taste/index.server.ts")) return
				const line =
					'if (viewer.kind === "member") return loadMemberTaste(viewer.userId)'
				if (!code.includes(line))
					throw new Error("Taste seam changed; refusing to run the fixture")
				const replacement = `if (viewer.kind === "member" && viewer.userId.startsWith("mcp-taste-")) return fixtureTaste(viewer.userId);\n${line}`
				return `import {fixtureTaste} from ${JSON.stringify(fixture)};\n${code.replace(line, replacement)}`
			},
		},
	],
	resolve: {
		alias: [
			{
				find: /^~\//,
				replacement: fileURLToPath(new URL("../../app/", import.meta.url)),
			},
		],
	},
}
