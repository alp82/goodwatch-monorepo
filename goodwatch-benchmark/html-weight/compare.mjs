// Review the two deliberate loader-only reductions after the strict HTML gate.
// Usage: node compare.mjs <equivalence-run-directory> [--previews-only]
import assert from "node:assert/strict"
import { readFileSync, writeFileSync } from "node:fs"
import { contexts, normalize } from "../html-equivalence/core.mjs"
import { analyze } from "./measure.mjs"
const directory = process.argv[2]
const read = (side) => {
	const folder = `${directory}/${side}-2`
	const snapshot = JSON.parse(readFileSync(`${folder}/snapshot.json`))
	assert.equal(snapshot.complete, true)
	return snapshot.entries.map((entry) => ({
		...entry,
		html: readFileSync(
			`${folder}/${entry.file.replace(".html", ".raw.html")}`,
			"utf8",
		),
	}))
}
const withoutContext = (html) =>
	normalize(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (script) =>
		script.includes("window.__remixContext")
			? "<script>[reviewed loader context]</script>"
			: script,
	)
const project = (context) => {
	const route = context.state?.loaderData?.["routes/$type.$category._index"]
	if (route)
		route.pageResults = route.pageResults.map((row) =>
			process.argv.includes("--previews-only")
				? { ...row, results: row.results.slice(0, 8) }
				: {
						path: row.path,
						label: row.label,
						results: row.results.slice(0, 8),
					},
		)
	return context
}
const before = read("base"),
	after = read("candidate"),
	rows = []
assert.equal(before.length, after.length)
for (let i = 0; i < before.length; i++) {
	const a = before[i],
		b = after[i]
	assert.deepEqual(
		[a.path, a.client, a.status, a.redirects, a.cacheControl],
		[b.path, b.client, b.status, b.redirects, b.cacheControl],
	)
	assert.equal(
		withoutContext(a.html),
		withoutContext(b.html),
		`markup or non-loader script changed: ${a.path} ${a.client}`,
	)
	const left = contexts(normalize(a.html)).map(project),
		right = contexts(normalize(b.html))
	assert.deepEqual(
		left,
		right,
		`unexpected loader change: ${a.path} ${a.client}`,
	)
	if (left[0]?.state?.loaderData?.["routes/$type.$category._index"]) {
		const x = analyze(a.html),
			y = analyze(b.html)
		rows.push({
			path: a.path,
			client: a.client,
			before: { raw: x.raw, br11: x.br11, gzip9: x.gzip9 },
			after: { raw: y.raw, br11: y.br11, gzip9: y.gzip9 },
		})
	}
}
writeFileSync(
	`${directory}/loader-only-review.json`,
	JSON.stringify({ documents: before.length, rows }, null, 2),
)
console.log(
	`${before.length} documents: identical markup, links, non-loader scripts, cache policy and statuses; only the exact preview/metadata projection differs`,
)
console.log(JSON.stringify(rows, null, 2))
