// Times the grouped query of tracking (QG in docs/implementation/tracking/data-model.md, section 3) for one member:
// one warm-up run, then 30 runs one after the other, and prints the median and the slowest as the client sees them
// and as Crate reports them. Read-only: it sends this one SELECT and nothing else.
//
// The data model calls the query slow when, for the largest member, the client-side median is above 100 ms or the
// slowest of the 30 runs is above 250 ms. Run it for the largest member, one with about 5,000 log rows and a
// typical one, once the migration has filled user_watch_log.
//
// Run from goodwatch-webapp. The input file contains only the member's user id, so the id stays out of the shell
// history:
//   node --env-file=.env scripts/measure-watch-groups.mjs <user-id-file> [runs]
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { GROUPED_QUERY } from "../app/server/tracking-sql.ts"

const SLOW_MEDIAN_MS = 100
const SLOW_MAX_MS = 250

if (!process.argv[2])
	throw new Error(
		"Usage: node --env-file=.env scripts/measure-watch-groups.mjs <user-id-file> [runs]",
	)
const userId = readFileSync(process.argv[2], "utf8").trim()
const runs = Number.parseInt(process.argv[3] ?? "30", 10)
if (!userId || !(runs > 0)) throw new Error("A user id and a number of runs")
if (!process.env.CRATE_HOSTS) throw new Error("CRATE_HOSTS is not set")

const require = createRequire(`${process.cwd()}/package.json`)
const crate = require("node-crate")
crate.connect(
	process.env.CRATE_HOSTS.split(",")
		.map(
			(host) =>
				`http://${process.env.CRATE_USER}:${process.env.CRATE_PASS}@${host}:${process.env.CRATE_PORT || 4200}`,
		)
		.join(" "),
)

async function once() {
	const started = performance.now()
	const result = await crate.execute(GROUPED_QUERY, [userId])
	return {
		wallMs: performance.now() - started,
		crateMs: result.duration,
		rows: result.rowcount,
		logRows: result.json.reduce((n, row) => n + Number(row.watch_count), 0),
	}
}

const median = (values) => {
	const sorted = [...values].sort((a, b) => a - b)
	const middle = Math.floor(sorted.length / 2)
	return sorted.length % 2
		? sorted[middle]
		: (sorted[middle - 1] + sorted[middle]) / 2
}
const ms = (value) => `${value.toFixed(1)} ms`

const warmUp = await once()
const measured = []
for (let i = 0; i < runs; i++) measured.push(await once())

const wall = measured.map((m) => m.wallMs)
const inCrate = measured.map((m) => m.crateMs)
const slow = median(wall) > SLOW_MEDIAN_MS || Math.max(...wall) > SLOW_MAX_MS
console.log(
	`Grouped query: ${warmUp.rows} groups over ${warmUp.logRows} log rows, ${runs} runs after one warm-up (${ms(warmUp.wallMs)})`,
)
console.log(
	`  client: median ${ms(median(wall))}, slowest ${ms(Math.max(...wall))}, fastest ${ms(Math.min(...wall))}`,
)
console.log(
	`  Crate:  median ${ms(median(inCrate))}, slowest ${ms(Math.max(...inCrate))}`,
)
console.log(
	slow
		? `  SLOW: above a median of ${SLOW_MEDIAN_MS} ms or a run of ${SLOW_MAX_MS} ms. See "If it is slow" in the data model.`
		: `  Within the limits: median up to ${SLOW_MEDIAN_MS} ms, no run above ${SLOW_MAX_MS} ms.`,
)
process.exit(0)
