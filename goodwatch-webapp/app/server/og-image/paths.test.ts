// Bundle only the path resolver; service readers are discarded and never contact live data.
import assert from "node:assert/strict"
import path from "node:path"
import { test } from "node:test"
import { build } from "esbuild"

const app = path.resolve("app")
const result = await build({
	stdin: {
		contents:
			'export { canonicalOgPath } from "./server/og-image/content.server.ts"',
		resolveDir: app,
	},
	bundle: true,
	write: false,
	platform: "node",
	format: "esm",
	alias: { "~": app },
	logOverride: { "import-is-undefined": "silent" },
	plugins: [
		{
			name: "no-service-readers",
			setup(builder) {
				builder.onResolve({ filter: /^~\// }, (args) => {
					if (
						["~/ui/og-image/copy", "~/ui/og-image/profile-card-model"].includes(
							args.path,
						)
					)
						return
					return { path: args.path, namespace: "fixture" }
				})
				builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
					contents:
						args.path === "~/ui/explore/main-nav"
							? "export const mainHierarchy = {}; export const mainNavigation = {};"
							: "",
				}))
			},
		},
	],
})
const { canonicalOgPath } = await import(
	`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
)

test("old and new map and wishlist image addresses keep their cards", () => {
	for (const address of ["/explorer", "/map"])
		assert.equal(canonicalOgPath(address), "/map")
	for (const address of ["/u/Ana/wishlist", "/u/Ana/want"])
		assert.equal(canonicalOgPath(address), "/u/ana/wishlist")
	assert.equal(canonicalOgPath("/watch/shows"), "/watch/shows")
})
