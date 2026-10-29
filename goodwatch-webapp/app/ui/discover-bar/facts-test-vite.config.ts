import path from "node:path"
import { defineConfig } from "vite"

export default defineConfig({
	resolve: { alias: { "~": path.resolve(process.cwd(), "app") } },
	plugins: [
		{
			name: "facts-unit-test",
			enforce: "pre",
			load(id) {
				// Keep route/database imports and requests out of these UI unit tests.
				if (id.endsWith("/ui/filter-bar/useFilterData.ts"))
					return `
				export const useMyServices = () => ({ country: 'US', providers: [], countryProviders: [] });
				export const useTitleNames = () => ({ byKey: new Map() });
				export const usePeopleNames = () => ({ byId: new Map() });
			`
			},
		},
	],
})
