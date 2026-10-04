// inclusive.mjs <file.cpuprofile> <requests> <name> [name ...]: inclusive ms per request for frames whose
// "package-or-url :: function" contains the given text (first matching frame from the root counts once per sample).
import { readFileSync } from "node:fs"
const [file, requests, ...names] = process.argv.slice(2)
const profile = JSON.parse(readFileSync(file, "utf8"))
const byId = new Map(profile.nodes.map((node) => [node.id, node]))
const parent = new Map()
for (const node of profile.nodes) for (const child of node.children ?? []) parent.set(child, node.id)
const label = (frame) => `${frame.url.replace(/.*node_modules\//, "").replace(/.*build\/server\/index\.js.*/, "app")} :: ${frame.functionName}`
const totals = Object.fromEntries(names.map((name) => [name, 0]))
const cache = new Map()
profile.samples.forEach((id, index) => {
	let hit = cache.get(id)
	if (!hit) {
		hit = new Set()
		for (let at = id; at !== undefined; at = parent.get(at)) {
			const text = label(byId.get(at).callFrame)
			for (const name of names) if (text.includes(name)) hit.add(name)
		}
		cache.set(id, hit)
	}
	for (const name of hit) totals[name] += profile.timeDeltas[index] / 1000
})
for (const name of names) console.log(`${(totals[name] / Number(requests)).toFixed(2).padStart(8)} ms per request  ${name}`)
