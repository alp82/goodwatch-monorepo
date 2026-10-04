// analyze-profile.mjs <file.cpuprofile> <requests> [bundle-line-ranges.json]
// Sums the samples of a CPU profile per owner: Node internals by module, node_modules by package, and the server
// bundle by the named line ranges (name -> [firstLine, lastLine], 1-based), self time and inclusive time.
import { readFileSync } from "node:fs"
const [file, requestsArg, rangesFile] = process.argv.slice(2)
const requests = Number(requestsArg)
const profile = JSON.parse(readFileSync(file, "utf8"))
const ranges = rangesFile ? Object.entries(JSON.parse(readFileSync(rangesFile, "utf8"))) : []
const byId = new Map(profile.nodes.map((node) => [node.id, node]))
const parent = new Map()
for (const node of profile.nodes) for (const child of node.children ?? []) parent.set(child, node.id)
const ownerOf = (node) => {
	const { url, lineNumber, functionName } = node.callFrame
	if (!url) return functionName === "(idle)" ? "(idle)" : functionName === "(garbage collector)" ? "(gc)" : `(native) ${functionName}`
	if (url.startsWith("node:")) return url.replace(/^node:internal\//, "node:")
	const pkg = url.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)
	if (pkg) return `pkg ${pkg[1]}`
	if (url.includes("/build/server/")) {
		for (const [name, [first, last]] of ranges) if (lineNumber + 1 >= first && lineNumber + 1 <= last) return `app ${name}`
		return "app other"
	}
	return url.split("/").slice(-1)[0]
}
const self = new Map()
const inclusive = new Map()
let total = 0
const deltas = profile.timeDeltas
profile.samples.forEach((id, index) => {
	const micros = deltas[index] ?? 0
	const node = byId.get(id)
	const owner = ownerOf(node)
	if (owner === "(idle)") return
	total += micros
	self.set(owner, (self.get(owner) ?? 0) + micros)
	const seen = new Set()
	for (let at = id; at !== undefined; at = parent.get(at)) {
		const name = ownerOf(byId.get(at))
		if (seen.has(name)) continue
		seen.add(name)
		inclusive.set(name, (inclusive.get(name) ?? 0) + micros)
	}
})
const row = ([name, micros]) => `${(micros / requests / 1000).toFixed(4)} ms  ${((micros / total) * 100).toFixed(1)}%  ${name}`
console.log(`busy ${(total / requests / 1000).toFixed(4)} ms per request over ${requests} requests`)
console.log("\nself time:")
console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(row).join("\n"))
console.log("\ninclusive time:")
console.log([...inclusive].sort((a, b) => b[1] - a[1]).slice(0, 30).map(row).join("\n"))
