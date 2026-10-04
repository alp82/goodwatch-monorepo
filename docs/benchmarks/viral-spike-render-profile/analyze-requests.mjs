// analyze-requests.mjs <label.jsonl> [--route /movie/] [--skip N] [--md]
// Per-phase wall time and main-thread CPU time from the marks that prof-preload.mjs records per request.
// CPU per phase is exact only when requests run one at a time (seq.sh).
import { readFileSync } from "node:fs"

const args = process.argv.slice(2)
const flag = (name, fallback) => {
	const index = args.indexOf(name)
	if (index < 0) return fallback
	const value = args[index + 1]
	args.splice(index, 2)
	return value
}
const route = flag("--route", "")
const skip = Number(flag("--skip", 0))
const rows = readFileSync(args[0], "utf8")
	.split("\n")
	.filter(Boolean)
	.map((line) => JSON.parse(line))
	.filter((row) => row.url !== "/metrics" && row.url.startsWith(route) && row.status === 200)
	.slice(skip)

const quantile = (values, q) => {
	if (!values.length) return 0
	const sorted = [...values].sort((a, b) => a - b)
	return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
}
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0)

// Phase boundaries from marks. Each phase: [name, wall ms, cpu ms].
function phases(row) {
	const at = (name) => row.marks.find((mark) => mark[0] === name)
	const loaderStarts = row.marks.filter((mark) => mark[0].startsWith("loader_start:"))
	const loaderEnds = row.marks.filter((mark) => mark[0].startsWith("loader_end:"))
	const points = [
		["start", [null, 0, 0]],
		["Before loaders: HTTP parse, middleware, request object, route match", loaderStarts[0]],
		["Loaders: auth, cache reads, parse, queries", loaderEnds.at(-1)],
		["After loaders: loader results to JSON and back, headers, handoff string", at("render_start")],
		["React render", at("shell_ready") ?? at("all_ready")],
		["React writes the HTML into the response stream", at("react_stream_end")],
		["Stream to the socket: stream bridge, compression, socket writes", [null, row.total, row.cpu]],
	]
	const result = []
	for (let i = 1; i < points.length; i++) {
		const [name, mark] = points[i]
		const previous = points[i - 1][1]
		if (!mark || !previous) return null
		result.push([name, mark[1] - previous[1], mark[2] - previous[2]])
	}
	return result
}

const all = rows.map(phases).filter(Boolean)
console.log(`${rows.length} requests${route ? ` matching ${route}` : ""}`)
console.log("\n| Phase | Wall ms mean | Wall p95 | Main-thread CPU ms mean | CPU p95 | CPU share |\n| --- | --- | --- | --- | --- | --- |")
const cpuTotal = mean(rows.map((row) => row.cpu))
if (all.length)
	for (let i = 0; i < all[0].length; i++) {
		const wall = all.map((phase) => phase[i][1])
		const cpu = all.map((phase) => phase[i][2])
		console.log(
			`| ${all[0][i][0]} | ${mean(wall).toFixed(1)} | ${quantile(wall, 0.95).toFixed(1)} | ${mean(cpu).toFixed(1)} | ${quantile(cpu, 0.95).toFixed(1)} | ${((mean(cpu) / cpuTotal) * 100).toFixed(0)}% |`,
		)
	}
const total = rows.map((row) => row.total)
const cpu = rows.map((row) => row.cpu)
const headers = rows.map((row) => row.headers ?? 0)
console.log(`| **Whole request** | ${mean(total).toFixed(1)} | ${quantile(total, 0.95).toFixed(1)} | ${mean(cpu).toFixed(1)} | ${quantile(cpu, 0.95).toFixed(1)} | 100% |`)
console.log(`\nheaders at: mean ${mean(headers).toFixed(1)} ms, p95 ${quantile(headers, 0.95).toFixed(1)} ms; total p50 ${quantile(total, 0.5).toFixed(1)} ms`)
const sumKeys = new Set(rows.flatMap((row) => Object.keys(row.sums)))
for (const key of sumKeys) console.log(`${key}: mean ${mean(rows.map((row) => row.sums[key] ?? 0)).toFixed(2)}`)
console.log(`socket writes: mean ${mean(rows.map((row) => row.writes)).toFixed(0)}, compressed bytes: mean ${mean(rows.map((row) => row.bytes)).toFixed(0)}, encoding ${rows[0]?.encoding}`)
// Per loader: wall and cpu between its start and end marks.
const loaders = new Map()
for (const row of rows) {
	for (const mark of row.marks) {
		if (!mark[0].startsWith("loader_end:")) continue
		const id = mark[0].slice(11)
		const start = row.marks.find((other) => other[0] === `loader_start:${id}`)
		if (!start) continue
		if (!loaders.has(id)) loaders.set(id, [])
		loaders.get(id).push(mark[1] - start[1])
	}
}
for (const [id, wall] of loaders) console.log(`loader ${id}: wall mean ${mean(wall).toFixed(1)} ms, p95 ${quantile(wall, 0.95).toFixed(1)} ms`)
