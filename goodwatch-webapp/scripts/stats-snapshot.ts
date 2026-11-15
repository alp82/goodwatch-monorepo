// Computes the /stats snapshot once and prints each statement's time, without storing anything.
//
//   CRATE_HOSTS=127.0.0.1 CRATE_PORT=14210 npx vite-node scripts/stats-snapshot.ts [out.json]
//
// Point CRATE_HOSTS at a read-only endpoint; every statement is a SELECT.
import { writeFileSync } from "node:fs"
import { computeStatsSnapshot } from "~/server/stats/compute.server"

const start = performance.now()
const { snapshot, timings } = await computeStatsSnapshot()
for (const t of [...timings].sort((a, b) => b.ms - a.ms))
	console.log(`${String(t.ms).padStart(7)} ms  ${t.name}`)
console.log(
	`${timings.length} statements, ${Math.round(performance.now() - start)} ms in all`,
)
const out = process.argv[2]
if (out) {
	writeFileSync(out, `${JSON.stringify(snapshot, null, "\t")}\n`)
	console.log(`wrote ${out}`)
}
