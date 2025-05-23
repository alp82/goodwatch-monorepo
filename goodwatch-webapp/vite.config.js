import { vitePlugin as remix } from "@remix-run/dev"
import { installGlobals } from "@remix-run/node"
import { sentryVitePlugin } from "@sentry/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
// import { remixDevTools } from "remix-development-tools/vite";
import tsconfigPaths from "vite-tsconfig-paths"

installGlobals()

export default defineConfig(({ mode }) => ({
	define: {
		"process.env.NODE_ENV": JSON.stringify(mode),
	},

	server: {
		port: 3003,
	},

	plugins: [
		// remixDevTools(),
		remix({
			serverMinify: false,
			// ignoredRouteFiles: ["**/.*"],
			// TODO remove
			// serverModuleFormat: "cjs",
		}),
		tsconfigPaths({
			denyFiles: {
				client: ["**/server/**/*"],
			},
			denyImports: {
				client: ["fs-extra", /^node:/],
			},
		}),
		sentryVitePlugin({
			org: "goodwatch",
			project: "webapp",
		}),
		tailwindcss(),
	],

	build: {
		sourcemap: true,
	},
}))
