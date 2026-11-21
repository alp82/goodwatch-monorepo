#!/usr/bin/env node
// Crawls the Browse pages the way a search engine meets them and fails on what would cost them in the index:
// - a link inside the site that answers 404 (or any 4xx/5xx),
// - a link inside the site that redirects (an internal link must point at the final address),
// - an indexable page whose canonical isn't itself.
// It starts at /movies and /shows, follows internal links two levels deep, and expands only Browse pages
// (/movies, /shows, /all and below); every other internal link it finds is fetched once, not expanded.
// With --sitemap it also checks every URL of /sitemaps/sitemap_browse.xml: 200, index, self-canonical.
//
//   node scripts/browse-crawl.mjs --origin http://127.0.0.1:3291 [--depth 2] [--max 1500] [--sitemap]
//
// Run it against a preview server (never against production by default). Exits 1 on any failure.
import process from "node:process"

const args = process.argv.slice(2)
const opt = (name, fallback) => {
	const i = args.indexOf(`--${name}`)
	return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback
}
const ORIGIN = opt("origin", "http://127.0.0.1:3291").replace(/\/$/, "")
const DEPTH = Number(opt("depth", "2"))
const MAX = Number(opt("max", "1500"))
const SITEMAP = args.includes("--sitemap")
const CONCURRENCY = 4
const CANONICAL_HOST = "https://goodwatch.app"

const BROWSE = /^\/(movies|shows|all)(\/|$)/
// Links that aren't pages: files, APIs, auth, and the member-only areas a guest is sent away from.
const SKIP =
	/^\/(api|build|assets|images|fonts|flags|sitemaps|auth|resources|_)\b|\.(png|jpe?g|webp|svg|ico|css|js|xml|txt|json)(\?|$)/

const failures = []
const fail = (kind, url, detail) => failures.push({ kind, url, detail })

/** href="..." values that point inside the site, as paths with their query. */
function internalLinks(html) {
	const out = new Set()
	for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"#]+)/g)) {
		let href = m[1].replace(/&amp;/g, "&")
		if (href.startsWith(CANONICAL_HOST)) href = href.slice(CANONICAL_HOST.length) || "/"
		if (!href.startsWith("/") || href.startsWith("//")) continue
		if (SKIP.test(href)) continue
		out.add(href)
	}
	return out
}

const meta = (html, re) => html.match(re)?.[1]?.replace(/&amp;/g, "&")
const robotsOf = (html) =>
	meta(html, /<meta[^>]+name="robots"[^>]+content="([^"]*)"/) ?? "index, follow"
const canonicalOf = (html) => meta(html, /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/)

async function get(path) {
	try {
		const res = await fetch(ORIGIN + path, {
			redirect: "manual",
			headers: { "User-Agent": "goodwatch-browse-crawl" },
		})
		const html = res.status === 200 ? await res.text() : ""
		return { status: res.status, location: res.headers.get("location"), html }
	} catch (error) {
		return { status: 0, location: null, html: "", error: String(error) }
	}
}

/** An indexable page must name itself (without its list state) as canonical. */
function checkCanonical(path, html) {
	if (/noindex/.test(robotsOf(html))) return
	const canonical = canonicalOf(html)
	if (!canonical) return fail("missing canonical", path)
	const want = new URL(path, CANONICAL_HOST)
	const got = new URL(canonical, CANONICAL_HOST)
	if (got.pathname !== want.pathname) fail("indexable, canonical elsewhere", path, canonical)
}

const seen = new Map() // path -> status
let requests = 0

async function visit(path, from) {
	if (seen.has(path)) return null
	if (requests >= MAX) return null
	requests++
	seen.set(path, "pending")
	const r = await get(path)
	seen.set(path, r.status)
	if (r.status >= 300 && r.status < 400)
		fail("internal link redirects", path, `${r.status} -> ${r.location} (linked from ${from})`)
	else if (r.status !== 200)
		fail(`status ${r.status}`, path, `linked from ${from}${r.error ? `: ${r.error}` : ""}`)
	return r
}

async function pool(items, run) {
	let next = 0
	await Promise.all(
		Array.from({ length: CONCURRENCY }, async () => {
			while (next < items.length) await run(items[next++])
		}),
	)
}

async function crawl() {
	let frontier = ["/movies", "/shows"].map((p) => ({ path: p, from: "(start)" }))
	for (let level = 0; level <= DEPTH && frontier.length; level++) {
		const nextLevel = []
		await pool(frontier, async ({ path, from }) => {
			const r = await visit(path, from)
			if (!r || r.status !== 200 || !BROWSE.test(path.split("?")[0])) return
			checkCanonical(path, r.html)
			if (level === DEPTH) return
			for (const link of internalLinks(r.html))
				if (!seen.has(link)) nextLevel.push({ path: link, from: path })
		})
		frontier = nextLevel.filter((x, i, all) => all.findIndex((y) => y.path === x.path) === i)
	}
}

async function checkSitemap() {
	const r = await get("/sitemaps/sitemap_browse.xml")
	if (r.status !== 200) return fail(`sitemap status ${r.status}`, "/sitemaps/sitemap_browse.xml")
	const xml = await (await fetch(`${ORIGIN}/sitemaps/sitemap_browse.xml`)).text()
	const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
		m[1].replace(CANONICAL_HOST, "").replace(/&amp;/g, "&"),
	)
	let checked = 0
	await pool(paths, async (path) => {
		const page = await get(path)
		checked++
		if (page.status !== 200)
			return fail(`sitemap URL status ${page.status}`, path, page.location ?? "")
		if (/noindex/.test(robotsOf(page.html))) return fail("sitemap URL says noindex", path)
		checkCanonical(path, page.html)
	})
	return { listed: paths.length, checked }
}

const started = Date.now()
await crawl()
const sitemap = SITEMAP ? await checkSitemap() : null
const browsePages = [...seen.keys()].filter((p) => BROWSE.test(p.split("?")[0])).length
console.log(
	`crawled ${seen.size} internal URLs (${browsePages} Browse pages) in ${Math.round((Date.now() - started) / 1000)} s` +
		(requests >= MAX ? ` (stopped at --max ${MAX})` : "") +
		(sitemap ? `; sitemap: ${sitemap.checked}/${sitemap.listed} URLs checked` : ""),
)
const byKind = Object.groupBy(failures, (f) => f.kind)
for (const [kind, list] of Object.entries(byKind)) {
	console.log(`\n${kind}: ${list.length}`)
	for (const f of list.slice(0, 25)) console.log(`  ${f.url}${f.detail ? `  ${f.detail}` : ""}`)
}
console.log(
	failures.length
		? `\nFAILED: ${failures.length}`
		: "\nOK: no 404, no internal redirect, every indexable page self-canonical",
)
process.exit(failures.length ? 1 : 0)
