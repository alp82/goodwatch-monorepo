import { copyFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { vitePlugin as remix } from "@remix-run/dev"
import { installGlobals } from "@remix-run/node"
import { sentryVitePlugin } from "@sentry/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
// import { remixDevTools } from "remix-development-tools/vite";
import tsconfigPaths from "vite-tsconfig-paths"

installGlobals()

// The query encoder runs in a worker thread, which needs its own file next to the server bundle.
// app/server/search-ranking/query-encoder.server.ts loads it from there.
const QUERY_ENCODER_WORKER = "app/server/search-ranking/query-encoder.worker.js"
function queryEncoderWorker() {
	let root
	let outDir
	let ssr = false
	return {
		name: "query-encoder-worker",
		apply: "build",
		configResolved(config) {
			root = config.root
			outDir = config.build.outDir
			ssr = Boolean(config.build.ssr)
		},
		closeBundle() {
			if (!ssr) return
			copyFileSync(
				join(root, QUERY_ENCODER_WORKER),
				resolve(root, outDir, "query-encoder.worker.js"),
			)
		},
	}
}

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
			disable: process.env.SENTRY_DISABLE_AUTO_UPLOAD === "true",
			org: "goodwatch",
			project: "webapp",
		}),
		tailwindcss(),
		queryEncoderWorker(),
	],

	build: {
		sourcemap: true,
	},
}))
