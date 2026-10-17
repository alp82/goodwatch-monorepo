// Measures the current Newly available history reader (#637), using SELECT statements only.
// Node 24+: node --env-file=.env scripts/measure-newly-available.mjs [runs] [country]
import { existsSync } from "node:fs"
import { registerHooks } from "node:module"
import { fileURLToPath } from "node:url"

if (process.argv.includes("--help")) {
	console.log(
		"Usage: node --env-file=.env scripts/measure-newly-available.mjs [runs=3] [country=US]",
	)
	process.exit(0)
}
const runs = Number(process.argv[2] ?? 3)
const country = (process.argv[3] ?? "US").toUpperCase()
if (!Number.isSafeInteger(runs) || runs < 1)
	throw new Error("Runs must be a positive integer")
if (!/^[A-Z]{2}$/.test(country))
	throw new Error("Country must be a two-letter code")
if (!process.env.CRATE_HOSTS) throw new Error("CRATE_HOSTS is not set")

// This standalone reader needs only the app alias and Node's TypeScript support.
const app = new URL("../app/", import.meta.url)
registerHooks({
	resolve(specifier, context, next) {
		const path = specifier.startsWith("~/")
			? new URL(specifier.slice(2), app)
			: specifier.startsWith(".") && context.parentURL
				? new URL(specifier, context.parentURL)
				: null
		if (path && existsSync(`${fileURLToPath(path)}.ts`))
			return next(`${path.href}.ts`, context)
		return next(specifier, context)
	},
})
const { readFirstSeen, keptSince } = await import(
	"../app/server/availability-first-seen.server.ts"
)
const host = process.env.CRATE_HOSTS.split(",")[0]
const endpoint = `http://${host}:${process.env.CRATE_PORT || 4200}/_sql`
const authorization = `Basic ${Buffer.from(`${process.env.CRATE_USER}:${process.env.CRATE_PASS}`).toString("base64")}`
const since = keptSince()
for (let round = 1; round <= runs; round++) {
	const statements = []
	const started = performance.now()
	const landings = await readFirstSeen(
		{ country, types: ["flatrate", "free", "ads"], since },
		async (sql, params) => {
			if (!/^\s*SELECT\b/i.test(sql)) throw new Error("Read-only: SELECT only")
			const queryStart = performance.now()
			const response = await fetch(endpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: authorization,
				},
				body: JSON.stringify({ stmt: sql, args: params }),
			})
			if (!response.ok)
				throw new Error(`Crate returned HTTP ${response.status}`)
			const result = await response.json()
			statements.push({
				sql,
				params,
				rowcount: result.rows.length,
				elapsedMs: performance.now() - queryStart,
			})
			return result
		},
	)
	console.log(
		JSON.stringify({
			round,
			country,
			since,
			titles: landings.size,
			elapsedMs: performance.now() - started,
			statements,
		}),
	)
}
