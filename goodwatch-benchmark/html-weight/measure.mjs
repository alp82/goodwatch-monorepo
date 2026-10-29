// Measure saved HTML, or capture explicit document paths with serial, low-rate GETs.
// Usage: node measure.mjs capture <paths.json> <output-dir>
//        node measure.mjs analyze <output-dir>
import https from "node:https"
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs"
import { gzipSync, gunzipSync, brotliCompressSync, constants } from "node:zlib"
import { contexts } from "../html-equivalence/core.mjs"
const bytes = (s) => Buffer.byteLength(s)
const jsonBytes = (v) => bytes(JSON.stringify(v) ?? "")
const sum = (html, re) =>
	[...html.matchAll(re)].reduce((n, m) => n + bytes(m[0]), 0)
export function analyze(html) {
	const context = contexts(html)[0]
	const loaders = context?.state?.loaderData ?? {}
	const strings = new Map(),
		titles = new Map(),
		keys = new Map()
	function walk(v, path = "") {
		if (typeof v === "string") strings.set(v, (strings.get(v) ?? 0) + 1)
		if (!v || typeof v !== "object") return
		if (v.tmdb_id && v.title) {
			const s = JSON.stringify(v)
			titles.set(s, (titles.get(s) ?? 0) + 1)
		}
		for (const [k, child] of Object.entries(v)) {
			if (!Array.isArray(v)) keys.set(k, (keys.get(k) ?? 0) + jsonBytes(child))
			walk(child, `${path}.${k}`)
		}
	}
	walk(loaders)
	const scripts = sum(html, /<script\b[^>]*>[\s\S]*?<\/script>/gi)
	const loaderScript = [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)]
		.filter((m) => m[0].includes("window.__remixContext"))
		.reduce((n, m) => n + bytes(m[0]), 0)
	const parts = {
		raw: bytes(html),
		gzip9: gzipSync(html, { level: 9 }).length,
		br11: brotliCompressSync(html, {
			params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
		}).length,
		markup: bytes(html) - scripts,
		scripts,
		loaderScript,
		loaderJson: jsonBytes(loaders),
		svg: sum(html, /<svg\b[^>]*>[\s\S]*?<\/svg>/gi),
		styles:
			sum(html, /<style\b[^>]*>[\s\S]*?<\/style>/gi) +
			sum(html, /\sstyle="[^"]*"/g),
		classes: sum(html, /\sclass="[^"]*"/g),
		jsonLd: sum(
			html,
			/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi,
		),
		hiddenRelated: sum(html, /<p\b[^>]*class="pl-more"[^>]*>[\s\S]*?<\/p>/gi),
		routes: Object.fromEntries(
			Object.entries(loaders).map(([k, v]) => [
				k,
				{
					bytes: jsonBytes(v),
					keys: Object.entries(v ?? {})
						.map(([k, v]) => [k, jsonBytes(v)])
						.sort((a, b) => b[1] - a[1])
						.slice(0, 8),
				},
			]),
		),
		biggestKeys: [...keys].sort((a, b) => b[1] - a[1]).slice(0, 12),
		repeatedStrings: [...strings]
			.filter(([s, n]) => n > 1 && s.length > 20)
			.map(([s, n]) => ({
				sample: s.slice(0, 90),
				count: n,
				duplicateBytes: bytes(s) * (n - 1),
			}))
			.sort((a, b) => b.duplicateBytes - a.duplicateBytes)
			.slice(0, 10),
		duplicateTitleObjects: [...titles]
			.filter(([s, n]) => n > 1)
			.reduce((n, [s, count]) => n + bytes(s) * (count - 1), 0),
	}
	return parts
}
async function get(path) {
	return new Promise((resolve, reject) => {
		const req = https.get(
			`https://goodwatch.app${path}`,
			{
				headers: {
					"User-Agent":
						"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
					"Accept-Encoding": "gzip",
					Accept: "text/html",
				},
			},
			(res) => {
				const chunks = []
				res.on("data", (c) => chunks.push(c))
				res.on("end", () => {
					const wire = Buffer.concat(chunks),
						html = (
							res.headers["content-encoding"] === "gzip"
								? gunzipSync(wire)
								: wire
						).toString()
					resolve({
						status: res.statusCode,
						location: res.headers.location,
						encoding: res.headers["content-encoding"] ?? "identity",
						wire: wire.length,
						html,
					})
				})
			},
		)
		req.setTimeout(45000, () => req.destroy(new Error("timeout")))
		req.on("error", reject)
	})
}
const [mode, input, output] = process.argv.slice(2)
if (mode === "capture") {
	mkdirSync(output, { recursive: true })
	const rows = []
	for (const [i, path] of JSON.parse(readFileSync(input)).entries()) {
		try {
			const { html, ...meta } = await get(path)
			const file = `${String(i).padStart(3, "0")}.html`
			writeFileSync(`${output}/${file}`, html)
			rows.push({ path, file, ...meta })
			console.log(path, meta.status, bytes(html))
		} catch (error) {
			rows.push({ path, error: error.message })
			console.log(path, error.message)
		}
		writeFileSync(`${output}/capture.json`, JSON.stringify(rows, null, 2))
		await new Promise((r) => setTimeout(r, 1100))
	}
} else if (mode === "analyze") {
	const rows = JSON.parse(readFileSync(`${input}/capture.json`)).map((row) => ({
		...row,
		...(row.file ? analyze(readFileSync(`${input}/${row.file}`, "utf8")) : {}),
	}))
	writeFileSync(`${input}/analysis.json`, JSON.stringify(rows, null, 2))
	console.log(`Analyzed ${rows.length} documents`)
}
