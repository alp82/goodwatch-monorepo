// Local SQL equivalence and production-sized synthetic benchmark. Never accepts a remote endpoint.
import assert from "node:assert/strict"
import { writeFileSync } from "node:fs"
import "node-crate"
import "ioredis"
import "../../app/server/title-filter/test-alias.ts"
import { socialFixture } from "./fixture.ts"
const { readSocialTitles, crateSocialStore } = await import("../../app/server/talked-about-now/social-store.server.ts")
const { readTitleSql, socialQuery } = await import("../../app/server/talked-about-now/reference-social-sql.ts")
const endpoint = process.env.SOCIAL_BENCH_URL ?? "http://127.0.0.1:19640"
assert.match(endpoint, /^http:\/\/127\.0\.0\.1:\d+$/)
const schema = "social_followup"
const statements: { sql: string; ms: number; duration: number; plan?: unknown }[] = []
async function sql(stmt: string, args: unknown[] = []) {
	const start = performance.now()
	const response = await fetch(`${endpoint}/_sql`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stmt, args }) })
	const body = await response.json()
	if (!response.ok) throw Error(JSON.stringify(body))
	statements.push({ sql: stmt, ms: performance.now() - start, duration: body.duration })
	return body
}
const select = async <T extends {}>(stmt: string, args: (string | number)[]) => {
	const body = await sql(stmt, args)
	return body.rows.map((row: unknown[]) => Object.fromEntries(body.cols.map((col: string, i: number) => [col, row[i]]))) as T[]
}
const fixture = socialFixture()
for (const [name, rows] of Object.entries(fixture)) {
	const table = ({ posts: "social_post", links: "social_title_link", quality: "social_content_quality", relevance: "social_relevance", reports: "social_link_report", images: "social_image" } as Record<string, string>)[name]
	const keys = [...new Set(rows.flatMap(row => Object.keys(row)))]
	const types = (key: string) => key === "media_tmdb_id" ? "INTEGER" : key === "score" ? "DOUBLE" : key.endsWith("_at") ? "TIMESTAMP WITH TIME ZONE" : "TEXT"
	const pk = ["links", "relevance"].includes(name) ? "media_type, media_tmdb_id, post_id" : name === "reports" ? "report_id" : "post_id"
	await sql(`DROP TABLE IF EXISTS ${schema}.${table}`)
	await sql(`CREATE TABLE ${schema}.${table} (${keys.map(k => `${k} ${types(k)}`).join(", ")}, PRIMARY KEY (${pk})) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = 0)`)
	const stmt = `INSERT INTO ${schema}.${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`
	for (let offset = 0; offset < rows.length; offset += 200) {
		const bulk_args = rows.slice(offset, offset + 200).map(row => keys.map(k => (row as Record<string, unknown>)[k] ?? null))
		const r = await fetch(`${endpoint}/_sql`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stmt, bulk_args }) })
		const b = await r.json(); assert.ok(r.ok, JSON.stringify(b)); assert.ok(b.results.every((v: { rowcount: number }) => v.rowcount === 1), JSON.stringify(b))
	}
	await sql(`REFRESH TABLE ${schema}.${table}`)
}
async function equivalence() {
	for (const disabledLanes of [[], ["disabled"], ["exact", "disabled"]]) {
		for (const limit of [1, 50, 100]) {
			const legacy = await select<Record<string, unknown>>(readTitleSql(schema, disabledLanes), ["movie", 1, ...disabledLanes, limit])
			const staged = await crateSocialStore({ schema, select }).readTitle({ mediaType: "movie", tmdbId: 1 }, { disabledLanes, limit })
			const normalized = legacy.map(row => ({ ...row, published_at: new Date(row.published_at as number).toISOString() }))
			assert.deepEqual(staged, normalized)
		}
		const { sql: original, params } = socialQuery([{ mediaType: "movie", tmdbId: 1 }, { mediaType: "show", tmdbId: 2 }, { mediaType: "movie", tmdbId: 3 }], disabledLanes)
		const legacy = await select<Record<string, unknown>>(original.split("doc.").join(`${schema}.`), params)
		const staged = await readSocialTitles([{ mediaType: "movie", tmdbId: 1 }, { mediaType: "tv", tmdbId: 2 }, { mediaType: "movie", tmdbId: 3 }], { schema, select, disabledLanes })
		// The original ORDER BY leaves ties for the same post shared by two titles unspecified.
		const canonical = (rows: Record<string, unknown>[]) => rows.sort((a, b) => (Number(b.score ?? -Infinity) - Number(a.score ?? -Infinity)) || String(b.published_at).localeCompare(String(a.published_at)) || String(b.post_id).localeCompare(String(a.post_id)) || String(a.media_type).localeCompare(String(b.media_type)) || Number(a.media_tmdb_id) - Number(b.media_tmdb_id))
		assert.deepEqual(canonical(staged.map(({ lane, ...row }) => row)), canonical(legacy.map(row => ({ ...row, published_at: new Date(row.published_at as number).toISOString() }))))
	}
	console.log("SQL equivalence: 12 title/ranking scenarios passed (540 posts, every eligibility rule, 500-ID chunk boundary)")
}
await equivalence()
// Populate unrelated corpus rows without growing the small link set.
for (const table of ["social_post", "social_content_quality", "social_image"]) {
	const columns = table === "social_post" ? "post_id, content_hash, published_at, source, url, text" : table === "social_content_quality" ? "post_id, content_hash, version, status" : "post_id, status"
	const values = table === "social_post" ? "'bulk-' || x::text, 'bulk', CURRENT_TIMESTAMP, 'rss', 'https://example.com/bulk', 'Synthetic corpus'" : table === "social_content_quality" ? "'bulk-' || x::text, 'bulk', 'content-quality-1', 'pass'" : "'bulk-' || x::text, 'ok'"
	for (let first = 1; first <= 190000; first += 5000) {
		await sql(`INSERT INTO ${schema}.${table} (${columns}) SELECT ${values} FROM generate_series(${first}, ${first + 4999}) AS t(x)`)
	}
	await sql(`REFRESH TABLE ${schema}.${table}`)
}
for (const [table, count] of [["social_title_link", 1847 - fixture.links.length], ["social_relevance", 1859 - fixture.relevance.length]] as const) {
	await sql(`INSERT INTO ${schema}.${table} (media_type, media_tmdb_id, post_id, content_hash) SELECT 'movie', 1000, 'unlinked-' || x::text, 'bulk' FROM generate_series(1, ${count}) AS t(x)`)
	await sql(`REFRESH TABLE ${schema}.${table}`)
}
await equivalence()
const results = []
const board = (size: number) => Array.from({ length: size }, (_, i) => ({ mediaType: i === 1 ? "tv" as const : "movie" as const, tmdbId: i < 3 ? i + 1 : i + 100 }))
const cases = [
	{ label: "title empty", titles: [{ mediaType: "movie" as const, tmdbId: 603 }] },
	{ label: "title populated", titles: [{ mediaType: "movie" as const, tmdbId: 1 }] },
	{ label: "start row / API (8 titles)", titles: board(8) },
	{ label: "Hot page / start member / Discord (20 titles)", titles: board(20) },
]
for (const { label, titles } of cases) {
	const legacy = label.startsWith("title") ? { sql: readTitleSql(schema, []), params: ["movie", titles[0].tmdbId, 50] } : socialQuery(titles.map(t => ({ mediaType: t.mediaType === "tv" ? "show" : "movie", tmdbId: t.tmdbId })))
	const oldSql = legacy.sql.split("doc.").join(`${schema}.`)
	const before = [], after = []
	for (let i = 0; i < 3; i++) {
		let start = performance.now(); await select(oldSql, legacy.params); before.push(performance.now() - start)
		start = performance.now(); await readSocialTitles([...titles], { schema, select, limit: label.startsWith("title") ? 50 : 400 }); after.push(performance.now() - start)
	}
	results.push({ label, before, after })
	console.log(JSON.stringify(results.at(-1)))
	const plan = await sql(`EXPLAIN ANALYZE ${oldSql}`, legacy.params)
	statements.at(-1)!.plan = plan.rows
}
// Profile the actual bounded SQL emitted by the staged reader.
const queries = new Map<string, (string | number)[]>()
await readSocialTitles([{ mediaType: "movie", tmdbId: 1 }], { schema, select: async (s, p) => { queries.set(s, p); return select(s, p) } })
for (const [stmt, params] of queries) {
	const plan = await sql(`EXPLAIN ANALYZE ${stmt}`, params)
	statements.at(-1)!.plan = plan.rows
}
writeFileSync(process.env.SOCIAL_BENCH_OUTPUT!, JSON.stringify({ results, statements }, null, 2))
