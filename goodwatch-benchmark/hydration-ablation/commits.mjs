// Prints the React commits of each run of a profiling-build batch: time, root render ms, and per-section render ms.
import { readFileSync } from "node:fs"
const rows = readFileSync(process.argv[2], "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((r) => r.info?.profile)
for (const r of rows) {
	const p = r.info.profile
	const commits = new Map()
	for (const e of p) {
		const key = e.commitTime.toFixed(1)
		if (!commits.has(key)) commits.set(key, {})
		const c = commits.get(key)
		c[e.id] = (c[e.id] ?? 0) + e.actualDuration
		c._phase = c._phase ?? e.phase
	}
	const total = [...commits.values()].reduce((s, c) => s + (c.ROOT ?? 0), 0)
	console.log(`\n${r.page} ${r.variant} run ${r.run}: load cpu ${r.phases.load.cpu} hyd ${r.phases.hydrate.cpu} after ${r.phases.after.cpu}; marks call ${r.marks.call} layout ${r.marks.layout} passive ${r.marks.passive}; commits ${commits.size}, root render total ${total.toFixed(0)} ms`)
	for (const [t, c] of commits) {
		const parts = Object.entries(c).filter(([k, v]) => !k.startsWith("_") && k !== "ROOT" && v >= 0.5).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(0)}`)
		if ((c.ROOT ?? 0) < 1 && !parts.length) continue
		console.log(`  t=${Number(t).toFixed(0).padStart(5)} ${String(c._phase).padEnd(6)} ROOT ${(c.ROOT ?? 0).toFixed(0).padStart(4)} | ${parts.join(", ")}`)
	}
}
