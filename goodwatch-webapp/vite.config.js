import { copyFileSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import { vitePlugin as remix } from "@remix-run/dev"
import { installGlobals } from "@remix-run/node"
import { sentryVitePlugin } from "@sentry/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
// import { remixDevTools } from "remix-development-tools/vite";
import tsconfigPaths from "vite-tsconfig-paths"

installGlobals()

// The query encoder worker thread and the share card renderer process each need their own file next to the
// server bundle. query-encoder.server.ts and share-card/render.server.tsx load them from there.
const SEPARATE_ENTRIES = [
	"app/server/search-ranking/query-encoder.worker.js",
	"app/server/share-card/render.child.js",
]
function separateEntryFiles() {
	let root
	let outDir
	let ssr = false
	return {
		name: "separate-entry-files",
		apply: "build",
		configResolved(config) {
			root = config.root
			outDir = config.build.outDir
			ssr = Boolean(config.build.ssr)
		},
		closeBundle() {
			if (!ssr) return
			for (const file of SEPARATE_ENTRIES)
				copyFileSync(join(root, file), resolve(root, outDir, basename(file)))
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
		separateEntryFiles(),
	],

	build: {
		sourcemap: true,
	},
}))
