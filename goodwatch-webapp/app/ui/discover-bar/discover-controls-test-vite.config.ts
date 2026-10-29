import path from "node:path"
import { defineConfig } from "vite"

export default defineConfig({
	resolve: { alias: { "~": path.resolve(process.cwd(), "app") } },
	plugins: [
		{
			name: "discover-controls-test",
			enforce: "pre",
			load(id) {
				// These keyboard checks do not run a search preview. Keep its route's database imports out of the unit test.
				if (id.endsWith("/routes/api.discover_.results.ts"))
					return "export const useDiscoverResults = () => ({})"
			},
		},
	],
})
