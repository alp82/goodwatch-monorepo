// Exact serialization projection on captured production documents. Does not render or deploy code.
// Usage: node project.mjs <capture-dir> <output.json>
import assert from "node:assert/strict"
import { readFileSync, writeFileSync } from "node:fs"
import { contexts } from "../html-equivalence/core.mjs"
import { analyze } from "./measure.mjs"
const [directory, output] = process.argv.slice(2)
const serialize = (value) =>
	JSON.stringify(value).replace(
		/[<>&\u2028\u2029]/g,
		(char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
	)
const rows = []
for (const row of JSON.parse(readFileSync(`${directory}/capture.json`))) {
	if (row.status !== 200) continue
	const html = readFileSync(`${directory}/${row.file}`, "utf8"),
		context = contexts(html)[0]
	const route = context?.state?.loaderData?.["routes/$type.$category._index"]
	if (!route) continue
	const original = serialize(context)
	assert.ok(
		html.includes(original),
		"Captured serialization must match exactly",
	)
	const initialTitles = route.pageResults.reduce(
		(n, row) => n + row.results.length,
		0,
	)
	for (const row of route.pageResults) row.results = row.results.slice(0, 8)
	const first = html.replace(original, serialize(context))
	route.pageResults = route.pageResults.map((row) => ({
		path: row.path,
		label: row.label,
		results: row.results,
	}))
	const second = html.replace(original, serialize(context))
	const metrics = (html) => {
		const a = analyze(html)
		return {
			raw: a.raw,
			br11: a.br11,
			gzip9: a.gzip9,
			loaderScript: a.loaderScript,
		}
	}
	rows.push({
		path: row.path,
		initialTitles,
		renderedTitles: route.pageResults.reduce(
			(n, row) => n + row.results.length,
			0,
		),
		before: metrics(html),
		trimPreviews: metrics(first),
		trimMetadata: metrics(second),
	})
}
writeFileSync(output, JSON.stringify(rows, null, 2) + "\n")
console.log(JSON.stringify(rows, null, 2))
