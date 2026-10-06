// usage: node summarize.mjs <batch.jsonl> [x4]
import { readFileSync } from "node:fs"
const rows = readFileSync(process.argv[2], "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((r) => r.phases)
const q = (list, p) => {
	const s = [...list].sort((a, b) => a - b)
	if (!s.length) return NaN
	const i = (s.length - 1) * p
	const lo = Math.floor(i), hi = Math.ceil(i)
	return s[lo] + (s[hi] - s[lo]) * (i - lo)
}
const med = (l) => q(l, 0.5)
const f = (v, w = 6) => (Number.isFinite(v) ? v.toFixed(0) : "-").padStart(w)
const metrics = {
	loadCpu: (r) => r.phases.load.cpu,
	hydCpu: (r) => r.phases.hydrate.cpu,
	aftCpu: (r) => r.phases.after.cpu,
	reactCpu: (r) => r.phases.hydrate.cpu + r.phases.after.cpu,
	totCpu: (r) => r.phases.load.cpu + r.phases.hydrate.cpu + r.phases.after.cpu,
	hydWall: (r) => r.phases.hydrate.wall,
	aftWall: (r) => r.phases.after.wall,
	// Blocking time over 50 ms after first contentful paint, tasks 4 times as long (CPU time of the task).
	tbt: (r) => r.phases.load.tbtFcpCpu + r.phases.hydrate.tbtFcpCpu + r.phases.after.tbtFcpCpu,
	tbtLoad: (r) => r.phases.load.tbtFcpCpu,
	tbtHyd: (r) => r.phases.hydrate.tbtFcpCpu,
	tbtAft: (r) => r.phases.after.tbtFcpCpu,
	tbtWall: (r) => r.phases.load.tbtFcp + r.phases.hydrate.tbtFcp + r.phases.after.tbtFcp,
	styleLayout: (r) => ["load", "hydrate", "after"].reduce((s, p) => s + r.phases[p].self.style + r.phases[p].self.layout, 0),
	slHydAft: (r) => ["hydrate", "after"].reduce((s, p) => s + r.phases[p].self.style + r.phases[p].self.layout, 0),
	script: (r) => ["load", "hydrate", "after"].reduce((s, p) => s + r.phases[p].self.script, 0),
	longestHyd: (r) => r.phases.hydrate.longest,
	longestAft: (r) => r.phases.after.longest,
	els: (r) => r.info.elements,
}
const cols = (process.argv[3] ?? "loadCpu,hydCpu,aftCpu,reactCpu,totCpu,tbt,tbtHyd,tbtAft,slHydAft,els").split(",")
for (const page of ["movie", "show"]) {
	const variants = [...new Set(rows.filter((r) => r.page === page).map((r) => r.variant))]
	const stat = {}
	for (const v of variants) {
		const all = rows.filter((r) => r.page === page && r.variant === v)
		// A run in a slow spell of the machine is slow in every phase. The load phase is the same work in every run of a
		// variant, so it calibrates: runs whose load phase took over 1.35 times the variant's lower quartile are left out.
		const ref = q(all.map(metrics.loadCpu), 0.25)
		const kept = all.filter((r) => metrics.loadCpu(r) <= ref * 1.35 && r.pageCache === "hit" && !r.requests.localFetch.length)
		stat[v] = { n: all.length, kept: kept.length, errors: all.filter((r) => r.errors.length).length, fetches: all.filter((r) => r.requests.localFetch.length).length }
		for (const [name, fn] of Object.entries(metrics)) {
			const list = kept.map(fn)
			stat[v][name] = { med: med(list), q1: q(list, 0.25), q3: q(list, 0.75), min: Math.min(...list) }
		}
	}
	console.log(`\n== ${page} (unthrottled ms; CPU time of main-thread tasks; tbt = x4 blocking proxy after FCP) ==`)
	console.log(`${"variant".padEnd(15)} n/kept err ${cols.map((c) => c.padStart(18)).join("")}`)
	const base = stat.baseline
	for (const v of variants) {
		const s = stat[v]
		const cells = cols.map((c) => {
			const m = s[c]
			const d = base && v !== "baseline" ? m.med - base[c].med : NaN
			return `${f(m.med, 5)}[${f(m.q1, 4)}-${f(m.q3, 4)}]${Number.isFinite(d) ? f(d, 5) : "     "}`.padStart(18)
		})
		console.log(`${v.padEnd(15)} ${String(s.n).padStart(2)}/${String(s.kept).padEnd(2)} ${String(s.errors).padStart(2)}${s.fetches ? "f" + s.fetches : "  "} ${cells.join("")}`)
	}
}
