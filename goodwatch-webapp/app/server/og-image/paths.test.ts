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
						[
							"~/ui/og-image/copy",
							"~/ui/og-image/profile-card-model",
							"~/server/og-image/awards-content.server",
							"~/domain/award-pages",
							"~/server/og-image/blog-content.server",
							"~/server/blog/posts.server",
							"~/content/blog/posts.json",
							"~/utils/blog-posts",
						].includes(args.path)
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

// Movies go through canonicalTitleId, which this bundle leaves out: shows only.
test("a title's sub-pages share the title's card", () => {
	assert.equal(canonicalOgPath("/show/95396-severance/tropes"), "/show/95396")
	assert.equal(canonicalOgPath("/show/95396/fingerprint"), "/show/95396")
	assert.equal(canonicalOgPath("/show/95396/at-a-glance"), "/show/95396")
	assert.equal(canonicalOgPath("/show/95396/cast"), null)
})

test("each kind of awards page has its own card path", () => {
	const paths: [string, string | null][] = [
		["/awards", "/awards"],
		["/AWARDS", "/awards"],
		["/awards/", "/awards"],
		["/awards/oscars", "/awards/oscars"],
		["/Awards/cesars/2026", "/awards/cesars/2026"],
		["/awards/oscars/1973", "/awards/oscars/1973"],
		["/awards/bafta/category/best-film", "/awards/bafta/category/best-film"],
		[
			"/awards/emmys/CATEGORY/outstanding-drama-series",
			"/awards/emmys/category/outstanding-drama-series",
		],
	]
	for (const [address, expected] of paths)
		assert.equal(canonicalOgPath(address), expected, address)
})

test("awards addresses without a page have no card", () => {
	for (const address of [
		"/awards/nope",
		"/awards/Oscars",
		"/awards/oscars/26",
		"/awards/oscars/category",
		"/awards/oscars/2026/best-picture",
		"/awards/oscars/category/best-picture/2026",
		`/awards/oscars/category/${"a".repeat(121)}`,
	])
		assert.equal(canonicalOgPath(address), null, address)
})

test("each blog post has its own card path; an address without a post has none", async () => {
	const { default: posts } = await import("../../content/blog/posts.json", {
		with: { type: "json" },
	})
	assert.ok(posts.length > 0)
	for (const { slug } of posts) {
		assert.equal(canonicalOgPath(`/blog/${slug}`), `/blog/${slug}`)
		assert.equal(canonicalOgPath(`/blog/${slug}/`), `/blog/${slug}`)
		assert.equal(canonicalOgPath(`/blog/${slug}/more`), null)
	}
	assert.equal(canonicalOgPath("/blog"), "/blog")
	for (const address of ["/blog/no-such-post", "/blog/rss.xml"])
		assert.equal(canonicalOgPath(address), null, address)
})

test("Hot on socials and its old address share one card", () => {
	assert.equal(canonicalOgPath("/hot"), "/hot")
	assert.equal(canonicalOgPath("/hot-on-socials"), "/hot")
})

test("By your tropes and its old address share one card", () => {
	for (const address of [
		"/watch/for-you/tropes",
		"/watch/for-you/tropes/",
		"/for-you/tropes",
	])
		assert.equal(canonicalOgPath(address), "/watch/for-you/tropes", address)
	assert.equal(canonicalOgPath("/watch/for-you"), "/watch/for-you")
	assert.equal(canonicalOgPath("/for-you"), "/watch/for-you")
})
