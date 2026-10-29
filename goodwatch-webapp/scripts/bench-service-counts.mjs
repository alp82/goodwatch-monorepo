// Run: node scripts/bench-service-counts.mjs
// Offline service-count micro-benchmark. Executes the production service block and ToggleCounts,
// including its per-title scan, option sorting and result construction. No app initialization or network I/O.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { performance } from "node:perf_hooks"
import ts from "typescript"

const source = readFileSync(
	new URL("../app/server/title-filter/passes.server.ts", import.meta.url),
	"utf8",
)
const toggleStart = source.indexOf("class ToggleCounts {")
const toggleEnd = source.indexOf("export function runPasses(", toggleStart)
const loopStart = source.indexOf(
	'if (services.kind === "index") {',
	source.indexOf("// Streaming services:"),
)
const loopEnd = source.indexOf("\n\t} else {", loopStart)
assert.ok(
	toggleStart >= 0 &&
		toggleEnd > toggleStart &&
		loopStart >= 0 &&
		loopEnd > loopStart,
)
const code = ts.transpileModule(
	`
${source.slice(toggleStart, toggleEnd)}
function countServices(input, MAX_SERVICE_OPTIONS) {
  const { services, masks } = input
  const n = masks.length
  const BIT = { services: 1 }
  const passesOthers = (i, bit) => (masks[i] & ~bit) === 0
  const optionCounts = {}
  ${source.slice(loopStart, loopEnd)}
  }
  return optionCounts.services
}
`,
	{ compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText
const countServices = new Function(`${code}; return countServices`)()

// A deterministic generated 260k-title availability snapshot, with a long tail of 180 services.
// Most titles have 1–4 offers; some have no offers. 20% fail another filter.
const titles = 260_000
const serviceCount = 180
const offsets = new Uint32Array(titles + 1)
const entries = []
let seed = 82
const random = () => {
	seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
	return seed
}
for (let row = 0; row < titles; row++) {
	const offers = random() % 6
	const on = new Set()
	for (let offer = 0; offer < offers; offer++) {
		const roll = random() % 100
		on.add(random() % (roll < 75 ? 30 : serviceCount))
	}
	entries.push(...on)
	offsets[row + 1] = entries.length
}
const input = {
	masks: Uint32Array.from({ length: titles }, (_, row) =>
		row % 5 === 0 ? 2 : 0,
	),
	services: {
		kind: "index",
		index: {
			services: Array.from({ length: serviceCount }, (_, s) => s + 1),
			offsets,
			entries: Uint16Array.from(entries),
		},
		availabilityRows: Int32Array.from({ length: titles }, (_, row) => row),
		mine: [0, 1, 2],
		chosen: [0, 1],
	},
}
const small = countServices(input, 60)
const large = countServices(input, 120)
assert.equal(Object.keys(small).length, 63) // all, any, mine
assert.equal(Object.keys(large).length, 123)
for (const key of Object.keys(small)) assert.equal(small[key], large[key])
for (let i = 0; i < 100; i++) {
	countServices(input, 60)
	countServices(input, 120)
}
const samples = { 60: [], 120: [] }
const batch = 10
for (let pair = 0; pair < 50; pair++) {
	// Alternate order to reduce systematic drift; report per-request median of batches.
	for (const limit of pair % 2 ? [120, 60] : [60, 120]) {
		const start = performance.now()
		for (let i = 0; i < batch; i++) countServices(input, limit)
		samples[limit].push((performance.now() - start) / batch)
	}
}
const median = (values) =>
	[...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const at60 = median(samples[60])
const at120 = median(samples[120])
console.log(
	`${process.version}; ${titles.toLocaleString("en-US")} generated titles; ${entries.length} offers; ${serviceCount} services`,
)
console.log(
	`Service count loop median ms/request (50 paired batches of ${batch}, after 100 warmups):`,
)
console.log(
	`60: ${at60.toFixed(3)} ms; 120: ${at120.toFixed(3)} ms; extra: ${(at120 - at60).toFixed(3)} ms`,
)
console.log(
	at120 - at60 > 1
		? 'Over 1 ms extra: count past the top 60 only while "+N more" is open.'
		: "Within the 1 ms extra budget.",
)
