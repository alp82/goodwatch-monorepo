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

// Each group's rules keyed by its User-agent lines; consecutive User-agent lines share a group.
function robotsGroups(robots: string): Map<string, string[]> {
	const groups = new Map<string, string[]>()
	let agents: string[] = []
	let rulesStarted = false
	for (const line of robots.split("\n")) {
		const agent = line.match(/^User-agent:\s*(\S+)/i)?.[1]
		if (agent) {
			if (rulesStarted) agents = []
			rulesStarted = false
			agents.push(agent)
			if (!groups.has(agent)) groups.set(agent, [])
			continue
		}
		if (!/^(Allow|Disallow):/i.test(line)) continue
		rulesStarted = true
		for (const name of agents) groups.get(name)?.push(line.trim())
	}
	return groups
}

test("robots.txt keeps Google's AI training out and leaves every other crawler's rules alone", async () => {
	const { readFile } = await import("node:fs/promises")
	const robots = await readFile(
		new URL("../../public/robots.txt", import.meta.url),
		"utf8",
	)
	const groups = robotsGroups(robots)
	assert.deepEqual(groups.get("Google-Extended"), ["Disallow: /"])
	assert.deepEqual([...groups.keys()], ["*", "Google-Extended"])
	assert.deepEqual(groups.get("*"), [
		"Disallow: /api/",
		"Disallow: /browser-check",
		"Disallow: /go/",
		"Disallow: /person/*?",
		"Disallow: /discover?",
		"Disallow: /discover/*?",
		"Allow: /",
	])
})

test("robots.txt lets a crawler read the pages that ask not to be indexed", async () => {
	const { readFile } = await import("node:fs/promises")
	const robots = await readFile(
		new URL("../../public/robots.txt", import.meta.url),
		"utf8",
	)
	// Googlebot and other search crawlers follow the * group. A rule's * matches anything; a $ at its end anchors it. A query-free path is tested, as the pages are linked.
	const blocked = (robotsGroups(robots).get("*") ?? [])
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
