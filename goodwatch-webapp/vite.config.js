import { createHash } from "node:crypto"
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { basename, join, resolve } from "node:path"
import { vitePlugin as remix } from "@remix-run/dev"
import { installGlobals } from "@remix-run/node"
import { sentryVitePlugin } from "@sentry/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
// import { remixDevTools } from "remix-development-tools/vite";
import tsconfigPaths from "vite-tsconfig-paths"

// The esbuild that Vite itself depends on: npm nests it under Vite, because another package pins an older one at the
// top level.
const require = createRequire(import.meta.url)
const { build: bundleWorker } = createRequire(require.resolve("vite"))("esbuild")

installGlobals()

// The query encoder worker thread and the share card renderer process each need their own file next to the
// server bundle. query-encoder.server.ts and card-renderer/pool.server.ts load them from there. The two are plain
// JavaScript and are copied, together with svg-filters.js, which the renderer imports. The workers that load the
// search index and the title snapshot share TypeScript modules
// with the server, so each is bundled into one file there (search-index.server.ts and
// title-snapshot/prepare-worker.server.ts start them). A bundle that fails, fails the build.
const SEPARATE_ENTRIES = [
	"app/server/search-ranking/query-encoder.worker.js",
	"app/server/card-renderer/render.child.js",
	"app/server/card-renderer/svg-filters.js",
]
const BUNDLED_WORKERS = [
	"app/server/search-ranking/search-index.worker.ts",
	"app/server/title-snapshot/title-snapshot.worker.ts",
]
// The related map's engine as one minified classic script among the client build's files, with a content hash in its
// name like Vite's own files, so that it is served, compressed, cached for a year, and kept for other builds the same
// way. A title page loads it before hydration. The server reads its address from a small file next to the server
// bundle (app/server/related-map.server.ts).
const RELATED_MAP_SCRIPT = { entry: "app/ui/related-map/inline.ts", name: "related-map", list: "related-map.assets.json" }
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
		async closeBundle() {
			if (!ssr) return
			for (const file of SEPARATE_ENTRIES)
				copyFileSync(join(root, file), resolve(root, outDir, basename(file)))
			await bundleWorker({
				entryPoints: BUNDLED_WORKERS.map((file) => join(root, file)),
				outdir: resolve(root, outDir),
				// Flat, next to index.js: without it esbuild keeps each entry's directory.
				entryNames: "[name]",
				bundle: true,
				platform: "node",
				format: "esm",
				target: "node24",
				external: ["node:*"],
				tsconfig: join(root, "tsconfig.json"),
			})
			const built = await bundleWorker({
				entryPoints: [join(root, RELATED_MAP_SCRIPT.entry)],
				bundle: true,
				minify: true,
				write: false,
				platform: "browser",
				format: "iife",
				target: "es2019",
				tsconfig: join(root, "tsconfig.json"),
			})
			const script = built.outputFiles[0].contents
			const hash = createHash("sha256").update(script).digest("base64url").slice(0, 8)
			// The client build's files are next to the server's: build/client/assets and build/server.
			const assets = resolve(root, outDir, "../client/assets")
			mkdirSync(assets, { recursive: true })
			writeFileSync(join(assets, `${RELATED_MAP_SCRIPT.name}-${hash}.js`), script)
			writeFileSync(
				resolve(root, outDir, RELATED_MAP_SCRIPT.list),
				JSON.stringify({ script: `/assets/${RELATED_MAP_SCRIPT.name}-${hash}.js` }),
			)
		},
	}
}

// The recommendation, share list, title actions, watch log, episode list, Watching and tracking prototypes are kept in the repository for context, and so is
// the harness that mounts the real episode tracking components on the prototypes' fixtures (prototype.episode-tracking-real). They are
// routes in development only: a production build leaves the routes out, and the stylesheet doesn't get the
// class names that only they use (about a quarter of its rules).
const PROTOTYPES = {
	// Files in app/routes.
	routes: ["prototype.rec-*", "prototype.share-list*", "prototype.title-actions*", "prototype.watch-log*", "prototype.episode-list*", "prototype.episode-tracking*", "prototype.watching*", "prototype.tracking*", "prototype.my-library*"],
	// Directories in app/ui that only those routes import.
	ui: ["prototype-rec-*", "prototype-share-list", "prototype-title-actions", "prototype-watch-log", "prototype-episode-list", "prototype-episode-list-2", "prototype-episode-list-3", "prototype-episode-list-4", "prototype-episode-tracking", "prototype-watching", "prototype-watching-2", "prototype-watching-3", "prototype-tracking-hub", "prototype-my-library"],
}
const PROTOTYPE_SOURCES = [
	...PROTOTYPES.routes.map((name) => `./routes/${name}`),
	...PROTOTYPES.ui.map((name) => `./ui/${name}`),
]
const PROTOTYPE_MODULE = new RegExp(
	`/app/(${PROTOTYPE_SOURCES.map((source) =>
		source
			.slice(2)
			.replace(/[.]/g, "\\.")
			.replace(/\*/g, "[^/]*"),
	).join("|")})(/|\\.[^/]*$|$)`,
)
const TAILWIND_ENTRY = /\/app\/tailwind\.css$/
const APP_MODULE_FILE = /\/app\/.*\.[jt]sx?$/

// Swiper's stylesheet embeds an icon font for its own arrow buttons (1.6 KB of the compressed stylesheet). Every
// carousel here brings its own buttons, so no element uses that font.
const SWIPER_ICON_FONT = /@font-face\s*\{[^}]*swiper-icons[^}]*\}/
const SWIPER_OWN_ARROWS = /swiper-button-(prev|next)(?![\w-])|createElements/

// Two cuts to the one stylesheet that blocks every page's first paint. It has two parts, around the Tailwind plugin:
// - Before it, in a production build: tell Tailwind not to read the prototypes' files, so their class names stay out.
// - After it: drop Swiper's icon font from the generated sheet.
// A missing class or font fails silently, so both cuts stop the build when code starts to need what they left out:
// a module of the build that is a prototype file, or app code that uses Swiper's own arrow buttons.
function leanStylesheet() {
	const entry = (id) => TAILWIND_ENTRY.test(id.split("?", 1)[0])
	return {
		before: {
			name: "lean-stylesheet:sources",
			apply: "build",
			enforce: "pre",
			transform(code, id) {
				const file = id.split("?", 1)[0]
				if (PROTOTYPE_MODULE.test(file))
					this.error(
						`${file} is a prototype file, and the production stylesheet has no class names from it. Move the code out of the prototype, or change PROTOTYPES in vite.config.js.`,
					)
				if (APP_MODULE_FILE.test(file) && SWIPER_OWN_ARROWS.test(code))
					this.error(
						`${file} uses Swiper's own arrow buttons, and the stylesheet has no icon font for them. Bring your own buttons (see ui/ListSwiper.tsx), or keep the font: SWIPER_ICON_FONT in vite.config.js.`,
					)
				if (!entry(id) || !code.includes("@import")) return
				return {
					code: `${code}\n${PROTOTYPE_SOURCES.map((source) => `@source not "${source}";`).join("\n")}\n`,
					map: null,
				}
			},
		},
		after: {
			name: "lean-stylesheet:fonts",
			enforce: "pre",
			transform(code, id) {
				if (!entry(id) || !SWIPER_ICON_FONT.test(code)) return
				return { code: code.replace(SWIPER_ICON_FONT, ""), map: null }
			},
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
// 4. Feature modules that load together get one chunk per group, see FEATURE_CHUNKS.
// 5. Rollup splits the rest by route, as before.
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

// Rule 4: modules that always load together but that Rollup would split, because different sets of routes import each.
// The title action set (score control, Want to See, Seen, Not interested) is on the first view of every title page and
// was four files there. A group lists every module it should hold: a module that a group's module imports and that no
// rule names is pulled into the group, for every page that uses it. That is why the mutation hooks, which the home page
// also loads, are a group of their own.
const FEATURE_CHUNKS = [
	["user-data", /\/app\/hooks\/useUserDataMutations\.ts$/],
	[
		"title-actions",
		/\/app\/ui\/(title-actions\/(ScoreControl|TitleScore|TitleActionSet|useTitleActions|ActionButton)|user\/actions\/ScoreAction)\.tsx?$/,
	],
]

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
		for (const [name, pattern] of FEATURE_CHUNKS) if (pattern.test(id)) return name
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
			ignoredRouteFiles: process.argv.some((arg) => arg === "vite:build" || arg === "build")
				? PROTOTYPES.routes.map((name) => `**/${name}`)
				: [],
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
		leanStylesheet().before,
		tailwindcss(),
		leanStylesheet().after,
		separateEntryFiles(),
	],

	experimental: {
		// A lazy chunk's preloads follow the chunk: their addresses are relative to the script that asks for them, not
		// to the page. A page can get its scripts from the static hostname (see app/utils/asset-url.ts).
		renderBuiltUrl: (filename, { hostType, ssr }) =>
			!ssr && hostType === "js" && filename.endsWith(".js")
				? { relative: true }
				: undefined,
	},

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
