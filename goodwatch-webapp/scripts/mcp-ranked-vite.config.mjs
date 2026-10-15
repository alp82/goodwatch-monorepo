import { fileURLToPath } from "node:url";
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export default {
	plugins: [{
		name: "loopback-mcp-ranked-providers",
		transform(code, id) {
			if (id.endsWith("/search-runtime/runtime.server.ts")) {
				if (!code.includes('"https://api.typesafe.ai"')) throw new Error("Provider fixture rewrite needs updating; refusing external transport");
				return code.replace('"https://api.typesafe.ai"', '"http://127.0.0.1:15769"');
			}
			if (id.endsWith("/combined-search/search.server.ts"))
				return code.replace("https://api.themoviedb.org/3/search/multi", "http://127.0.0.1:15769/tmdb/search/multi");
		},
	}],
	resolve: {
		alias: [{ find: /^~\//, replacement: `${here("../app")}/` }],
	},
};
