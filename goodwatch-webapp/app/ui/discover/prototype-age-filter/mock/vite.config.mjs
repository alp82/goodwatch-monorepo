// PROTOTYPE (throwaway): serves the age-filter mock page on its own, without the Remix server or any env vars.
// npm run prototype:age-filter
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"

const here = (p) => fileURLToPath(new URL(p, import.meta.url))

export default {
	root: here("."),
	plugins: [tailwindcss()],
	esbuild: { jsx: "automatic" },
	define: { "process.env.NODE_ENV": JSON.stringify("development") },
	resolve: {
		alias: [{ find: /^~\//, replacement: `${here("../../../..")}/` }],
	},
	server: { port: 3011, fs: { allow: [here("../../../../..")] } },
}
