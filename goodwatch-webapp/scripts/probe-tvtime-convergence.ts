/** Synthetic, local-only probe. Never opens connections to a real catalog. */
import "../app/server/tracking-loader.test-support.ts"
import { setTimeout as delay } from "node:timers/promises"
import { ImportDb } from "../app/server/imports/import-db.test-support.ts"
import { FakeTrackingCrate } from "../app/server/tracking-fake-crate.ts"

process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = ""
const { setCrateClientForTest } = await import("../app/utils/crate.ts")
const { holdTasteRebuildsForTest } = await import(
	"../app/server/taste/member.server.ts"
)
const { setImportDbForTest } = await import(
	"../app/server/imports/store.server.ts"
)
const { previewImport } = await import(
	"../app/server/imports/service.server.ts"
)
holdTasteRebuildsForTest()
const latencyMs = Number(process.argv[2] ?? 0)
const db = new ImportDb()
db.catalog = [
	{
		media_type: "show",
		tmdb_id: 1668,
		tvdb_id: 100,
		title: "Synthetic show",
		imdb_id: null,
		release_year: 1994,
	},
]
db.episodes = Array.from({ length: 5_000 }, (_, i) => ({
	tmdb_id: i + 101,
	show_id: 1668,
	season_number: 1,
	episode_number: i + 1,
	tvdb_id: null,
	name: `Episode ${i + 1}`,
}))
setImportDbForTest(db)
setCrateClientForTest(new FakeTrackingCrate())
const originalFetch = globalThis.fetch
let requests = 0
globalThis.fetch = async (url) => {
	requests++
	if (latencyMs) await delay(latencyMs)
	const id = Number(String(url).match(/\/find\/(\d+)/)?.[1])
	return new Response(
		JSON.stringify(
			id === 100
				? { tv_results: [{ id: 1668 }] }
				: { tv_episode_results: [{ id: id - 20_000 + 101, show_id: 1668 }] },
		),
	)
}
const file = Buffer.from(
	`key,s_id,ep_id,s_no,ep_no,created_at\n${Array.from({ length: 5_000 }, (_, i) => `watch-episode-${i},100,${i + 20_000},1,${i + 1},2024-01-01 12:00:00\n`).join("")}`,
)
try {
	for (let preview = 1; preview <= 2; preview++) {
		requests = 0
		const start = performance.now()
		const result = await previewImport(
			"probe-member",
			"tvtime",
			"tracking-prod-records-v2.csv",
			file,
		)
		const codes: Record<string, number> = {}
		for (const row of db.items.filter((r) => r.import_id === result.id)) {
			const code = JSON.parse(String(row.payload)).problem?.code ?? row.outcome
			codes[code] = (codes[code] ?? 0) + 1
		}
		console.log(
			JSON.stringify({
				preview,
				latencyMs,
				elapsedMs: Math.round(performance.now() - start),
				requests,
				matched: result.counts.new,
				unmatched: result.counts.unmatched,
				cachedEpisodes: db.episodes.filter((e) => e.tvdb_id != null).length,
				codes,
			}),
		)
	}
} finally {
	globalThis.fetch = originalFetch
	setImportDbForTest()
	setCrateClientForTest(null)
}
