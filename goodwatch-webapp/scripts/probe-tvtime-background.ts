/** Synthetic, local-only DB-load probe; never connects to a real catalog/provider. */
import "../app/server/tracking-loader.test-support.ts"
import { ImportDb } from "../app/server/imports/import-db.test-support.ts"
import { FakeTrackingCrate } from "../app/server/tracking-fake-crate.ts"
process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = ""
process.env.TMDB_API_KEY = "synthetic-probe-key"
const { setCrateClientForTest } = await import("../app/utils/crate.ts")
const { setImportDbForTest } = await import(
	"../app/server/imports/store.server.ts"
)
const service = await import("../app/server/imports/service.server.ts")
const runtime = await import(
	"../app/server/imports/resolution-runtime.server.ts"
)
const { createResolutionTmdb } = await import(
	"../app/server/imports/resolution-tmdb.server.ts"
)
const db = new ImportDb()
db.catalog = [
	{
		media_type: "show",
		tmdb_id: 10,
		tvdb_id: 100,
		title: "Synthetic show",
		imdb_id: null,
		release_year: 2000,
	},
]
db.episodes = Array.from({ length: 400 }, (_, i) => ({
	show_id: 10,
	tmdb_id: i + 101,
	season_number: 1,
	episode_number: i + 1,
	tvdb_id: null,
	name: `Synthetic episode ${i + 1}`,
}))
setImportDbForTest(db)
setCrateClientForTest(new FakeTrackingCrate())
let measuring = false
let statements = 0
let resolutionStatements = 0
let failedCas = 0
let requests = 0
const read = db.select.bind(db)
const write = db.run.bind(db)
const count = (sql: string) => {
	if (measuring) {
		statements++
		if (sql.includes("doc.user_import")) resolutionStatements++
	}
}
db.select = async (sql, params) => {
	count(sql)
	return read(sql, params)
}
db.run = async (sql, params) => {
	count(sql)
	const result = await write(sql, params)
	if (measuring && sql.includes("_seq_no = ?") && result.rowcount === 0)
		failedCas++
	return result
}
const api = createResolutionTmdb({
	take: async () => ({ allowed: true, store: "memory" }),
	fetch: async (url) => {
		requests++
		const id = Number(new URL(String(url)).pathname.split("/").at(-1))
		return Response.json({
			tv_results: [],
			tv_episode_results: [{ id: id - 20000 + 101, show_id: 10 }],
		})
	},
})
runtime.setResolutionNetworkForTest((ctx, path, params) =>
	api.get(ctx, path, params),
)
try {
	const p = await service.previewImport(
		"synthetic-member",
		"tvtime",
		"tracking-prod-records-v2.csv",
		Buffer.from(
			`key,s_id,ep_id,s_no,ep_no,created_at\n${Array.from({ length: 400 }, (_, i) => `watch-episode-${i},100,${20000 + i},1,${i + 1},2024-01-01`).join("\n")}`,
		),
	)
	measuring = true
	const start = performance.now()
	await runtime.resolutionJobs.run(p.id)
	measuring = false
	const j = await runtime.resolutionJobs.read(p.id)
	const final = await service.getImport(
		"synthetic-member",
		j?.replacementId ?? p.id,
	)
	console.log(
		JSON.stringify({
			episodes: 400,
			requests,
			statements,
			resolutionStatements,
			statementsPerRequest: statements / requests,
			resolutionStatementsPerRequest: resolutionStatements / requests,
			failedCas,
			elapsedMs: Math.round(performance.now() - start),
			matched: final.counts.new,
			watchesWritten: db.watches.length,
		}),
	)
} finally {
	runtime.setResolutionNetworkForTest()
	setImportDbForTest()
	setCrateClientForTest(null)
}
