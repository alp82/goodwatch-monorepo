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
// server bundle. query-encoder.server.ts and card-renderer/pool.server.ts load them from there.
const SEPARATE_ENTRIES = [
	"app/server/search-ranking/query-encoder.worker.js",
	"app/server/card-renderer/render.child.js",
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

// Client chunking. Every route module is an entry point for Rollup, and Rollup gives each module that a different set
// of entry points shares its own file. A title page loaded 88 files that way, 53 of them under 2 KB (one icon each).
// The rules, first match wins:
// 1. Libraries that every page loads get a chunk per library group. They change only with a dependency update, so their
//    file names stay the same across deploys and a returning visitor keeps them in the browser cache.
// 2. Everything else that the root route or the browser entry imports is on every page anyway. App code goes to
//    `shell`, which changes with most deploys, and the remaining library code to `vendor`.
// 3. App modules under 3 KB that more than one module imports (helpers, hooks, small components) also go to `shell`.
//    Together they are about 30 KB minified, and each was a request of its own.
// 4. Rollup splits the rest by route, as before.
// Rollup puts a module's own imports into the same manual chunk unless a rule names another one. Rule 3 therefore only
// takes modules whose imports are on every page already or match rule 3 themselves, so it can't pull a large module or
// a library such as framer-motion onto every page.
const VENDOR_CHUNKS = [
	["react", /\/node_modules\/(react|react-dom|scheduler)\//],
	[
		"remix",
		/\/node_modules\/(@remix-run\/[^/]+|react-router|react-router-dom|turbo-stream)\//,
	],
	["supabase", /\/node_modules\/(@supabase\/[^/]+|cookie)\//],
	["motion", /\/node_modules\/framer-motion\//],
	[
		"headless",
		/\/node_modules\/(@headlessui\/react|@react-aria\/[^/]+|@react-stately\/[^/]+|@floating-ui\/[^/]+|@tanstack\/(react-virtual|virtual-core)|tabbable)\//,
	],
	["query", /\/node_modules\/@tanstack\/(react-query|query-core)\//],
]
const BUNDLER_HELPERS = /^\0(commonjsHelpers\.js|vite\/)/
const SHELL_ROOTS = /\/app\/(root|entry\.client)\.tsx$/
const APP_MODULE = /\/app\/(?!routes\/)/
// A shared module above this size stays with the routes that use it.
const SHARED_SMALL_MODULE_MAX_BYTES = 3_000

function clientChunks() {
	const vendorChunk = (id) => {
		if (!id.includes("/node_modules/")) return undefined
		for (const [name, pattern] of VENDOR_CHUNKS)
			if (pattern.test(id)) return name
	}
	// The modules that are loaded on every page: what the root route and the browser entry import, directly or through
	// other static imports. Collected once, when Rollup asks about the first module.
	let everyPage
	const isOnEveryPage = (id, { getModuleInfo, getModuleIds }) => {
		if (!everyPage) {
			everyPage = new Set()
			const queue = [...getModuleIds()].filter((moduleId) =>
				SHELL_ROOTS.test(moduleId),
			)
			for (const moduleId of queue) {
				if (everyPage.has(moduleId)) continue
				everyPage.add(moduleId)
				queue.push(...(getModuleInfo(moduleId)?.importedIds ?? []))
			}
		}
		return everyPage.has(id)
	}
	const isSharedSmallModule = (id, graph, depth = 0) => {
		const info = graph.getModuleInfo(id)
		if (!info || id.includes("/node_modules/") || !APP_MODULE.test(id))
			return false
		if (info.importers.length < 2 && depth === 0) return false
		if ((info.code?.length ?? 0) > SHARED_SMALL_MODULE_MAX_BYTES) return false
		return info.importedIds.every(
			(imported) =>
				isOnEveryPage(imported, graph) ||
				(depth < 3 && isSharedSmallModule(imported, graph, depth + 1)),
		)
	}
	return (id, graph) => {
		// The bundler's own helpers (CommonJS interop, the dynamic import preloader) have no imports and every chunk may
		// use them. They live in the lowest chunk, or the library chunks would import the shell and the shell them.
		if (BUNDLER_HELPERS.test(id)) return "react"
		const vendor = vendorChunk(id)
		if (vendor) return vendor
		// Route modules stay entry points of their own: Remix loads them by name.
		if (SHELL_ROOTS.test(id) || graph.getModuleInfo(id)?.isEntry)
			return undefined
		if (isOnEveryPage(id, graph))
			return id.includes("/node_modules/") ? "vendor" : "shell"
		if (isSharedSmallModule(id, graph)) return "shell"
		return undefined
	}
}

// Browser code imports utils/auth.ts for its hooks. That module also holds the server's session check, which imports
// the Supabase packages. The browser uses none of that: it loads the Supabase client on first use, through the
// dynamic import in utils/supabase-browser.ts. Rollup still kept the packages as an import of every page, because
// they don't declare themselves free of side effects (the auth package patches `globalThis` when it loads). This
// says so for them: a file of these packages that nothing is imported from is left out. A file that is in use keeps
// everything it does when it loads.
const UNUSED_IS_SAFE_TO_DROP = /\/node_modules\/(@supabase\/[^/]+|cookie)\//

export default defineConfig(({ mode, isSsrBuild }) => ({
	// resvg is a native module used only on the server to render share cards. Keep the client dependency scan away
	// from it, or the optimizer fails on its .node binary and the dev server can't serve client scripts.
	optimizeDeps: { exclude: ["@resvg/resvg-js"] },
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
		rollupOptions: isSsrBuild
			? undefined
			: {
					treeshake: {
						moduleSideEffects: (id) => !UNUSED_IS_SAFE_TO_DROP.test(id),
					},
					output: {
						manualChunks: clientChunks(),
					},
				},
	},
}))
