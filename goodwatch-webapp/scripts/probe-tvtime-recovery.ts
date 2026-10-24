/** Read-only catalog access; all import, member and resolution writes stay in memory. Real exports stay outside Git. */
import "../app/server/tracking-loader.test-support.ts"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { ImportDb } from "../app/server/imports/import-db.test-support.ts"
import { FakeTrackingCrate } from "../app/server/tracking-fake-crate.ts"

process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = ""
const { setImportDbForTest } = await import(
	"../app/server/imports/store.server.ts"
)
const { setCrateClientForTest } = await import("../app/utils/crate.ts")
const { holdTasteRebuildsForTest } = await import(
	"../app/server/taste/member.server.ts"
)
const runtime = await import(
	"../app/server/imports/resolution-runtime.server.ts"
)
const service = await import("../app/server/imports/service.server.ts")
const { createResolutionTmdb } = await import(
	"../app/server/imports/resolution-tmdb.server.ts"
)
const archive = process.argv[2]
const cacheDir = process.argv[3]
if (!archive || !cacheDir)
	throw Error(
		"Usage: probe-tvtime-recovery.ts <private archive> <private cache directory>",
	)
await mkdir(cacheDir, { recursive: true, mode: 0o700 })
holdTasteRebuildsForTest()
const db = new ImportDb()
const select = db.select.bind(db)
const run = db.run.bind(db)
let reads = 0
db.select = async (sql, params = []) => {
	if (/\bFROM (?:movie|show|episode)\b/.test(sql)) {
		if (!sql.startsWith("SELECT "))
			throw Error("Only catalog SELECTs can reach the database")
		reads++
		const response = await fetch(
			`http://${process.env.CRATE_HOSTS!.split(",")[0].trim()}:${process.env.CRATE_PORT || 4200}/_sql`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization:
						"Basic " +
						Buffer.from(
							`${process.env.CRATE_USER}:${process.env.CRATE_PASS}`,
						).toString("base64"),
				},
				body: JSON.stringify({ stmt: sql, args: params }),
				signal: AbortSignal.timeout(15000),
			},
		)
		const result = await response.json()
		if (result.error) throw Error(result.error.message)
		return result.rows.map((row: unknown[]) =>
			Object.fromEntries(
				result.cols.map((col: string, i: number) => [col, row[i]]),
			),
		)
	}
	return select(sql, params)
}
db.run = async (sql, params) =>
	/^UPDATE (?:show|episode) SET/.test(sql) ? { rowcount: 0 } : run(sql, params)
setImportDbForTest(db)
setCrateClientForTest(new FakeTrackingCrate())
let requests = 0
let cached = 0
const api = createResolutionTmdb({
	take: async () => ({ allowed: true, store: "memory" }),
	fetch: async (input, init) => {
		const url = new URL(String(input))
		const identity = new URL(url)
		identity.searchParams.delete("api_key")
		const key = `${cacheDir}/${createHash("sha256").update(identity.toString()).digest("hex")}.json`
		try {
			const stored = JSON.parse(await readFile(key, "utf8"))
			cached++
			return new Response(stored.body, {
				status: stored.status,
				headers: stored.headers,
			})
		} catch {}
		requests++
		if (requests % 50 === 0)
			console.log(JSON.stringify({ requests, cached, reads }))
		const response = await fetch(input, init)
		const body = await response.text()
		if (response.ok || response.status === 404)
			await writeFile(
				key,
				JSON.stringify({
					body,
					status: response.status,
					headers: Object.fromEntries(response.headers),
				}),
				{ mode: 0o600 },
			)
		return new Response(body, {
			status: response.status,
			headers: response.headers,
		})
	},
})
runtime.setResolutionNetworkForTest((ctx, path, params) =>
	api.get(ctx, path, params),
)
const start = Date.now()
try {
	const preview = await service.previewImport(
		"recovery-probe",
		"tvtime",
		"tvtime-data.zip",
		await readFile(archive),
	)
	console.log(
		"Initial",
		JSON.stringify({ counts: preview.counts, kinds: preview.kinds }),
	)
	await runtime.resolutionJobs.run(preview.id)
	const job = await runtime.resolutionJobs.read(preview.id)
	if (!job?.replacementId) throw Error(`No publication: ${job?.state}`)
	const summary = await service.getImport("recovery-probe", job.replacementId)
	const failures: Record<string, number> = {}
	for (const row of db.items.filter((r) => r.import_id === job.replacementId)) {
		const payload = JSON.parse(String(row.payload))
		if (payload.problem)
			failures[payload.problem.code || payload.problem.reason] =
				(failures[payload.problem.code || payload.problem.reason] || 0) + 1
	}
	console.log(
		"Final",
		JSON.stringify({
			counts: summary.counts,
			kinds: summary.kinds,
			failures,
			state: job.state,
			requests,
			cached,
			reads,
			elapsedSeconds: Math.round((Date.now() - start) / 1000),
		}),
	)
} finally {
	runtime.setResolutionNetworkForTest()
	setImportDbForTest()
	setCrateClientForTest(null)
}
