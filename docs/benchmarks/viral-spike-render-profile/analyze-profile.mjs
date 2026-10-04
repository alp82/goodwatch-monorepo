// analyze-profile.mjs <file.cpuprofile> <requests> [server-index.js.map] [--top N] [--from ms --to ms]
// Attributes the samples of a V8 CPU profile to request phases and to the code that owns the time.
// - Phase: decided by marker frames anywhere in the stack (inclusive time).
// - Owner: the package or app source file of the nearest frame that isn't a Node internal or a V8 builtin.
import { readFileSync } from "node:fs"
import { SourceMap } from "node:module"

const args = process.argv.slice(2)
const flag = (name, fallback) => {
	const index = args.indexOf(name)
	if (index < 0) return fallback
	const value = args[index + 1]
	args.splice(index, 2)
	return value
}
const top = Number(flag("--top", 25))
const from = flag("--from")
const to = flag("--to")
const json = flag("--json")
const [file, requestsArg, mapFile] = args
const requests = Number(requestsArg) || 1
const profile = JSON.parse(readFileSync(file, "utf8"))
const sourceMap = mapFile ? new SourceMap(JSON.parse(readFileSync(mapFile, "utf8"))) : null

const byId = new Map(profile.nodes.map((node) => [node.id, node]))
const parent = new Map()
for (const node of profile.nodes) for (const child of node.children ?? []) parent.set(child, node.id)

const ownerCache = new Map()
function frameOwner(frame) {
	const { url, functionName, lineNumber, columnNumber } = frame
	if (!url) return null
	if (url.startsWith("node:")) return null
	const modules = url.lastIndexOf("node_modules/")
	if (modules >= 0) {
		const rest = url.slice(modules + 13).split("/")
		return rest[0].startsWith("@") ? `${rest[0]}/${rest[1]}` : rest[0]
	}
	if (url.includes("build/server/index.js")) {
		if (!sourceMap) return "app"
		const key = `${lineNumber}:${columnNumber}`
		let owner = ownerCache.get(key)
		if (owner === undefined) {
			const entry = sourceMap.findEntry(lineNumber, columnNumber)
			const source = entry?.originalSource ?? ""
			const app = source.indexOf("/app/")
			owner = source.includes("node_modules/")
				? frameOwner({ url: source })
				: app >= 0
					? `app:${source.slice(app + 5)}`
					: `app:${source || "?"}`
			ownerCache.set(key, owner)
		}
		return owner
	}
	if (url.includes("prof-preload")) return "measurement"
	return url
}

// Marker frames, checked from the root down. The first match names the phase.
const MARKERS = [
	[(f, o) => f.url === "node:inspector" || o === "measurement", "measurement overhead"],
	[(f, o) => o === "react-dom" && /server/.test(f.url), "React render and HTML write"],
	[(f) => f.functionName === "createServerHandoffString", "Loader data serialized for the browser (handoff)"],
	[(f) => f.functionName === "cacheGet" || f.functionName === "cacheSet", "Data cache read, parse and write"],
	[(f, o) => o === "ioredis" || o === "redis-parser" || o === "@ioredis/commands" || o === "denque" || o === "cluster-key-slot", "Redis client"],
	[(f, o) => o === "node-crate" || o === "@qdrant/js-client-rest" || o === "@qdrant/js-client-grpc" || o === "undici" || o === "@qdrant/openapi-typescript-fetch", "Crate and Qdrant clients"],
	[(f, o) => /^callLoader|^callRouteLoader|^loader$|^loadRouteData|^callDataStrategy/.test(f.functionName) || (o?.startsWith("app:routes/") ?? false) || (o?.startsWith("app:server/") ?? false), "Route loaders (own code)"],
	[(f, o) => o === "compression" || f.url === "node:zlib" || o === "on-headers" || o === "vary" || o === "negotiator" || o === "accepts" || o === "compressible", "Compression middleware and zlib"],
	[(f) => f.functionName === "writeReadableStreamToWritable" || f.functionName === "sendRemixResponse", "Response stream to the socket"],
	[(f, o) => o === "morgan" || o === "on-finished", "Request log (morgan)"],
	[(f, o) => o === "app:server/metrics/http.server.ts" || o === "app:server/metrics/registry.server.ts", "Metrics hooks"],
	[(f, o) => o === "@remix-run/router" || o === "@remix-run/server-runtime", "Remix router and server runtime"],
	[(f, o) => o === "@remix-run/express" || o === "@remix-run/node" || o === "@remix-run/web-fetch" || o === "@remix-run/web-stream" || o === "web-streams-polyfill" || o === "@remix-run/web-blob", "Remix request and response objects"],
	[(f, o) => o === "express" || o === "serve-static" || o === "send" || o === "finalhandler" || o === "parseurl", "Express and static file checks"],
	[(f) => /^node:(_http|internal\/http|net|internal\/stream|internal\/streams|internal\/webstreams|events|internal\/js_stream|internal\/stream_base)/.test(f.url), "Node HTTP and streams"],
]

const phaseMs = new Map()
const ownerMs = new Map()
const phaseOwnerMs = new Map()
const leafMs = new Map()
let total = 0
let window = 0
let clock = profile.startTime
const add = (map, key, value) => map.set(key, (map.get(key) ?? 0) + value)
const stackCache = new Map()
function describe(id) {
	let result = stackCache.get(id)
	if (result) return result
	const frames = []
	for (let at = id; at !== undefined; at = parent.get(at)) frames.push(byId.get(at).callFrame)
	frames.reverse()
	const leaf = frames.at(-1)
	let phase
	if (leaf.functionName === "(idle)") phase = "idle"
	else if (leaf.functionName === "(garbage collector)") phase = "Garbage collection"
	else {
		for (const frame of frames) {
			const owner = frameOwner(frame)
			const match = MARKERS.find(([test]) => test(frame, owner))
			if (match) {
				phase = match[1]
				break
			}
		}
		phase ??= leaf.functionName === "(program)" ? "Native, not attributed (program)" : "Other"
	}
	let owner = null
	for (let i = frames.length - 1; i >= 0 && !owner; i--) owner = frameOwner(frames[i])
	owner ??= leaf.functionName.startsWith("(") ? leaf.functionName : "node internals"
	const leafName = `${frameOwner(leaf) ?? (leaf.url || "native")} :: ${leaf.functionName || "(anonymous)"}`
	result = { phase, owner, leafName }
	stackCache.set(id, result)
	return result
}
profile.samples.forEach((id, index) => {
	const delta = profile.timeDeltas[index] / 1000
	clock += profile.timeDeltas[index]
	const atMs = (clock - profile.startTime) / 1000
	if ((from !== undefined && atMs < Number(from)) || (to !== undefined && atMs > Number(to))) return
	window += delta
	const { phase, owner, leafName } = describe(id)
	if (phase === "idle") return
	total += delta
	add(phaseMs, phase, delta)
	add(ownerMs, owner, delta)
	add(phaseOwnerMs, `${phase} | ${owner}`, delta)
	add(leafMs, leafName, delta)
})

const table = (title, map, limit = top) => {
	console.log(`\n## ${title}`)
	console.log("| Item | ms per request | Share |\n| --- | --- | --- |")
	for (const [key, value] of [...map].sort((a, b) => b[1] - a[1]).slice(0, limit))
		console.log(`| ${key} | ${(value / requests).toFixed(2)} | ${((value / total) * 100).toFixed(1)}% |`)
}
console.log(`profile window ${window.toFixed(0)} ms, busy ${total.toFixed(0)} ms (${((total / window) * 100).toFixed(1)}%), ${requests} requests, ${(total / requests).toFixed(1)} ms busy per request`)
table("Phase (inclusive, by marker frame)", phaseMs, 40)
table("Owner (nearest package or app file)", ownerMs)
table("Phase and owner", phaseOwnerMs, top * 2)
table("Leaf functions (self time)", leafMs)
if (json)
	console.log(
		JSON.stringify({
			busyMs: total,
			requests,
			phases: Object.fromEntries(phaseMs),
			owners: Object.fromEntries([...ownerMs].sort((a, b) => b[1] - a[1]).slice(0, 60)),
		}),
	)
