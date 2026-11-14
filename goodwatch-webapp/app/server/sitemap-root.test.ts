import assert from "node:assert/strict"
import { test } from "node:test"
import "./title-filter/test-alias.ts"

const { loader, SITEMAP_INDEX_PATH } = await import(
	"../routes/sitemap[.]xml.ts"
)

// The Allow and Disallow lines of the group whose User-agent lines name this agent (RFC 9309).
// A blank line, comment or Sitemap line doesn't end a group.
const robotsGroup = (robots: string, agent: string) => {
	const lines: string[] = []
	let inAgents = false
	let matches = false
	for (const raw of robots.split("\n")) {
		const line = raw.replace(/#.*/, "").trim()
		if (!line) continue
		const userAgent = line.match(/^User-agent:\s*(\S+)/i)?.[1]
		if (userAgent !== undefined) {
			if (!inAgents) matches = false
			inAgents = true
			if (userAgent.toLowerCase() === agent.toLowerCase()) matches = true
			continue
		}
		// Other records, such as Sitemap, belong to no group and don't end one.
		if (!/^(?:Allow|Disallow):/i.test(line)) continue
		inAgents = false
		if (matches) lines.push(line)
	}
	return lines
}

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
	const blocked = robotsGroup(robots, "*")
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

test("robots.txt keeps Apple from training on the site and lets Applebot search it", async () => {
	const { readFile } = await import("node:fs/promises")
	const robots = await readFile(
		new URL("../../public/robots.txt", import.meta.url),
		"utf8",
	)
	assert.deepEqual(robotsGroup(robots, "Applebot-Extended"), ["Disallow: /"])
	assert.deepEqual(robotsGroup(robots, "Applebot"), [])
	assert.ok(robotsGroup(robots, "*").includes("Allow: /"))
})
