import { createRequire } from "node:module"
import { readFileSync, writeFileSync } from "node:fs"
import { gzipSync } from "node:zlib"
const base = process.cwd()
const require = createRequire(base + "/package.json")
const crate = require("node-crate")
const { transform } = require("esbuild")
// Run from goodwatch-webapp; the input file contains only the target user ID.
if (!process.argv[2])
	throw new Error(
		"Usage: node --env-file=.env scripts/benchmark-user-data.mjs <user-id-file> [results-file]",
	)
const uid = readFileSync(process.argv[2], "utf8").trim()
crate.connect(
	process.env.CRATE_HOSTS.split(",")
		.map(
			(h) =>
				`http://${process.env.CRATE_USER}:${process.env.CRATE_PASS}@${h}:${process.env.CRATE_PORT || 4200}`,
		)
		.join(" "),
)
const source = readFileSync(base + "/app/server/userData.server.ts", "utf8")
const body = source.slice(
	source.indexOf("async function _getUserData"),
	source.indexOf("export const resetUserDataCache"),
)
const compiled = (await transform(body, { loader: "ts", format: "cjs" })).code
const getData = new Function(
	"query",
	"createMediaKey",
	compiled + "; return _getUserData;",
)
let mode = "full",
	batch = [],
	measures = []
const query = async (sql, args) => {
	if (mode === "one") {
		sql += " AND tmdb_id = ? AND media_type = ?"
		args = [...args, 411088, "movie"]
	}
	if (mode === "batch_or") {
		sql +=
			" AND (" +
			batch.map(() => "(tmdb_id = ? AND media_type = ?)").join(" OR ") +
			")"
		args = [...args, ...batch.flatMap((x) => [x.id, x.type])]
	}
	if (mode === "batch_in") {
		const types = [...new Set(batch.map((x) => x.type))]
		const parts = []
		const extra = []
		for (const type of types) {
			const ids = batch.filter((x) => x.type === type).map((x) => x.id)
			parts.push(
				"(media_type = ? AND tmdb_id IN (" +
					ids.map(() => "?").join(",") +
					"))",
			)
			extra.push(type, ...ids)
		}
		sql += " AND (" + parts.join(" OR ") + ")"
		args = [...args, ...extra]
	}
	const t = performance.now()
	const r = await crate.execute(sql, args)
	measures.push({
		table: sql.match(/FROM\s+(\w+)/i)[1],
		wallMs: performance.now() - t,
		dbMs: r.duration,
		rows: r.rowcount,
	})
	return r.json
}
const actual = getData(query, (type, id) => `${type}-${id}`)
const results = {
	method:
		"Original _getUserData function transpiled from source; same node-crate driver, connection and five parallel SQL queries. Scoped variants append title predicates. No auth/HTTP/browser time included.",
	rounds: [],
}
try {
	for (let round = 0; round < 11; round++) {
		for (const variant of round % 2
			? ["counts", "batch_in", "batch_or", "one", "full"]
			: ["full", "one", "batch_or", "batch_in", "counts"]) {
			mode = variant
			measures = []
			const t = performance.now()
			let data
			if (mode === "counts") {
				data = Object.fromEntries(
					await Promise.all(
						[
							"user_score",
							"user_wishlist",
							"user_watch_history",
							"user_favorite",
							"user_skipped",
						].map(async (table) => {
							const rows = await query(
								`SELECT count(*) AS count FROM ${table} WHERE user_id = ?`,
								[uid],
							)
							return [table, rows[0].count]
						}),
					),
				)
			} else data = await actual({ user_id: uid })
			const fetchMs = performance.now() - t
			const s = performance.now()
			const json = JSON.stringify(data)
			const stringifyMs = performance.now() - s
			if (round === 0 && mode === "full") {
				results.counts = Object.fromEntries(
					Object.entries(data).map(([k, v]) => [k, Object.keys(v).length]),
				)
				const keys = [
					...new Set(Object.values(data).flatMap((v) => Object.keys(v))),
				]
				results.uniqueTitles = keys.length
				const sample = ["movie", "show"].flatMap((type) =>
					Object.keys(data.scores)
						.filter((k) => k.startsWith(type + "-"))
						.sort()
						.slice(0, 12),
				)
				batch = sample.map((k) => ({
					type: k.split("-")[0],
					id: Number(k.split("-")[1]),
				}))
				results.batchTitleCount = batch.length
				results.batchSelection =
					"First 12 rated movies and 12 rated shows in lexicographic media-key order; synthetic populated batch, not a captured viewport."
				results.reviewCount = Object.values(data.scores).filter(
					(x) => x.review,
				).length
				results.reviewBytes = Object.values(data.scores).reduce(
					(n, x) => n + Buffer.byteLength(x.review || ""),
					0,
				)
			}
			results.rounds.push({
				round,
				variant,
				fetchMs,
				stringifyMs,
				bytes: Buffer.byteLength(json),
				gzipBytes: gzipSync(json).length,
				queries: measures,
			})
		}
	}
	writeFileSync(
		process.argv[3] || "/tmp/goodwatch-user-data-results.json",
		JSON.stringify(results, null, 2),
		{ mode: 0o600 },
	)
	const median = (a) => {
		a.sort((x, y) => x - y)
		const m = Math.floor(a.length / 2)
		return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
	}
	const summary = {
		counts: results.counts,
		uniqueTitles: results.uniqueTitles,
		batchTitleCount: results.batchTitleCount,
		reviewCount: results.reviewCount,
		reviewBytes: results.reviewBytes,
		variants: {},
	}
	for (const v of ["full", "one", "batch_or", "batch_in", "counts"]) {
		const first = results.rounds.find((x) => x.variant === v)
		const rows = results.rounds.filter((x) => x.variant === v && x.round > 0)
		summary.variants[v] = {
			firstMs: first.fetchMs,
			medianMs: median(rows.map((x) => x.fetchMs)),
			minMs: Math.min(...rows.map((x) => x.fetchMs)),
			maxMs: Math.max(...rows.map((x) => x.fetchMs)),
			bytes: first.bytes,
			gzipBytes: first.gzipBytes,
			medianStringifyMs: median(rows.map((x) => x.stringifyMs)),
			tables: first.queries.map((q) => ({
				table: q.table,
				rows: q.rows,
				medianWallMs: median(
					rows.flatMap((r) =>
						r.queries.filter((x) => x.table === q.table).map((x) => x.wallMs),
					),
				),
				medianDbMs: median(
					rows.flatMap((r) =>
						r.queries.filter((x) => x.table === q.table).map((x) => x.dbMs),
					),
				),
			})),
		}
	}
	console.log(JSON.stringify(summary, null, 2))
} catch (e) {
	console.log(
		JSON.stringify({
			error: "Benchmark failed",
			code: e.code || null,
			name: e.name,
		}),
	)
	process.exitCode = 1
}
