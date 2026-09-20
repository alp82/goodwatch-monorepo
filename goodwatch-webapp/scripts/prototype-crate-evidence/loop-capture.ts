// PROTOTYPE: cache the unchanged D4+ questions; two Jev calls per new request.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { interpretEvidencePrototype } from "../../app/server/prototype-jev-vector.server"

const [input, output] = process.argv.slice(2)
if (!input || !output) throw new Error("Usage: loop-capture <requests.json> <output.json>")
const raw: unknown = JSON.parse(readFileSync(input, "utf8"))
if (!Array.isArray(raw)) throw new Error("Requests must be a JSON array")
const requests = raw.map((entry: unknown, index: number) => {
	if (typeof entry === "string" && entry.trim()) return { request: entry }
	if (entry && typeof entry === "object" && "request" in entry && typeof entry.request === "string" && entry.request.trim()) {
		if ("id" in entry && typeof entry.id !== "string") throw new Error(`Request ${index}: id must be a string`)
		return { request: entry.request, ...("id" in entry ? { id: entry.id } : {}) }
	}
	throw new Error(`Request ${index}: expected a nonempty string or {id, request}`)
})
type Capture = Awaited<ReturnType<typeof interpretEvidencePrototype>> & { id?: string }
const cached: unknown = existsSync(output) ? JSON.parse(readFileSync(output, "utf8")) : []
if (!Array.isArray(cached) || cached.some((r) => !r || typeof r.request !== "string" || !r.attributes || !r.reading || !r.filters)) {
	throw new Error("Invalid interpretation cache; refusing to overwrite it")
}
const results: Capture[] = cached
mkdirSync(dirname(output), { recursive: true })
for (const entry of requests) {
	const exact = results.find((r) => r.request === entry.request && r.id === entry.id)
	if (exact) continue
	if (entry.id && results.some((r) => r.id === entry.id && r.request !== entry.request)) {
		throw new Error(`Request id ${entry.id} is already cached with different text`)
	}
	// Identical text may reuse a frozen reading under a different case id.
	const previous = results.find((r) => r.request === entry.request)
	const captured = previous ?? await interpretEvidencePrototype(entry.request)
	results.push({ ...captured, id: entry.id })
	const temporary = `${output}.tmp`
	writeFileSync(temporary, JSON.stringify(results, null, 2))
	renameSync(temporary, output)
	console.log(`Captured or reused: ${entry.id ?? entry.request}`)
}
