import assert from "node:assert/strict"
import { test } from "node:test"
import "./title-filter/test-alias.ts"

const { loader, SITEMAP_INDEX_PATH } = await import(
	"../routes/sitemap[.]xml.ts"
)

test("/sitemap.xml moves for good to the sitemap index that Search Console knows", async () => {
	const response = loader()
	assert.equal(response.status, 301)
	assert.equal(response.headers.get("Location"), "/sitemaps/sitemap.xml")
	assert.equal(SITEMAP_INDEX_PATH, "/sitemaps/sitemap.xml")
})

test("robots.txt names the same sitemap index", async () => {
	const { readFile } = await import("node:fs/promises")
	const robots = await readFile(
		new URL("../../public/robots.txt", import.meta.url),
		"utf8",
	)
	assert.match(
		robots,
		/^Sitemap: https:\/\/goodwatch\.app\/sitemaps\/sitemap\.xml$/m,
	)
})

test("robots.txt lets a crawler read the pages that ask not to be indexed", async () => {
	const { readFile } = await import("node:fs/promises")
	const robots = await readFile(
		new URL("../../public/robots.txt", import.meta.url),
		"utf8",
	)
	// A rule's * matches anything; a $ at its end anchors it. A query-free path is tested, as the pages are linked.
	const blocked = robots
		.split("\n")
		.map((line) => line.match(/^Disallow:\s*(\S+)/i)?.[1])
		.filter((rule): rule is string => Boolean(rule))
		.map(
			(rule) =>
				new RegExp(
					`^${rule
						.replace(/[.+?^{}()|[\]\\]/g, "\\$&")
						.replace(/\*/g, ".*")
						.replace(/\\\$$/, "$")}`,
				),
		)
	const noindexPages = [
		"/taste",
		"/taste/fingerprint",
		"/taste/everyone",
		"/taste/quiz",
		"/settings",
		"/settings/account",
		"/sign-in",
		"/sign-up",
		"/forgot-password",
		"/reset-password",
	]
	for (const path of noindexPages)
		assert.ok(
			!blocked.some((rule) => rule.test(path)),
			`${path} is blocked, so a crawler never reads its noindex`,
		)
})
