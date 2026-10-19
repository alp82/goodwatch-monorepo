// #708 real-file round trip. Prints aggregates only: no titles, native IDs or catalog IDs.
// Run from goodwatch-webapp:
//   node prototypes/justwatch-wishlist/real-report.ts ~/goodwatch-private/708/justwatch-708-capture.json [--reference=<count>] [--catalog=crate --env=<path to .env>]
// With --catalog=crate the preview's own catalog SELECTs (movie/show by TMDB ID, IMDb ID or exact title+year)
// go to production Crate read-only. Nothing else leaves the process; the import journal is in memory.
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Catalog, type CatalogRow, memoryCatalog } from "./preview-runner.ts"
import { buildReport } from "./report-core.ts"

const args = process.argv.slice(2)
const path = args.find((arg) => !arg.startsWith("--"))
if (!path) throw new Error("Pass the capture file path.")
const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1]
const bundle = JSON.parse(readFileSync(path, "utf8"))
if (bundle.kind !== "goodwatch-708-justwatch-capture") throw new Error("Not a #708 capture file.")

const ALLOWED = /^SELECT tmdb_id, imdb_id, title, release_year FROM (movie|show) WHERE (tmdb_id IN \(\?(?:,\?)*\)|imdb_id IN \(\?(?:,\?)*\)|lower\(title\) = lower\(\?\) AND release_year = \? LIMIT 2)$/
function crateCatalog(envPath: string): Catalog {
	const env = Object.fromEntries(
		readFileSync(envPath, "utf8")
			.split("\n")
			.flatMap((line) => {
				const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
				return match ? [[match[1], match[2].replace(/^["']|["']$/g, "")]] : []
			}),
	)
	const hosts = String(env.CRATE_HOSTS ?? "").split(",").map((host) => host.trim()).filter(Boolean)
	const port = env.CRATE_PORT || "4200"
	const auth = `Basic ${Buffer.from(`${env.CRATE_USER || "crate"}:${env.CRATE_PASS || ""}`).toString("base64")}`
	return async (_table, sql, params) => {
		if (!ALLOWED.test(sql)) throw new Error("Refused a catalog statement outside the read-only allowlist.")
		let lastError: unknown
		for (const host of hosts) {
			try {
				const response = await fetch(`http://${host}:${port}/_sql`, {
					method: "POST",
					headers: { "content-type": "application/json", authorization: auth },
					body: JSON.stringify({ stmt: sql, args: params }),
					signal: AbortSignal.timeout(10_000),
				})
				if (!response.ok) throw new Error(`Crate HTTP ${response.status}`)
				const body = (await response.json()) as { cols: string[]; rows: unknown[][] }
				return body.rows.map((row) => Object.fromEntries(body.cols.map((col, index) => [col, row[index]])) as CatalogRow)
			} catch (error) {
				lastError = error
			}
		}
		throw lastError
	}
}

const catalog = option("catalog") === "crate" ? crateCatalog(option("env") ?? "../../goodwatch-monorepo/goodwatch-webapp/.env") : memoryCatalog({ movie: [], show: [] })

const { lines } = await buildReport(bundle, catalog, { reference: option("reference"), catalogLabel: option("catalog") === "crate" ? "production, read-only" : undefined })
const out = join(dirname(path), "real-report.md")
writeFileSync(out, lines.join("\n"))
console.log(lines.join("\n"))
console.log(`\nSaved ${out}`)
