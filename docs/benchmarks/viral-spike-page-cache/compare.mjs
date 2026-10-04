// compare.mjs: is a stored page the same bytes as a fresh render?
// For each path, on a freshly started instance: request 1 is a fresh render that isn't stored, request 2 is a fresh
// render that is stored, and requests 3 to 5 are answered from the store as Brotli, gzip, and without an encoding.
// Prints the SHA-256 of every decompressed body, and where the two fresh renders differ, if they do. A title page
// embeds the time of its render in the related panel's query state (`dataUpdatedAt`): `freshRendersEqualWithoutTime`
// compares the two renders with that number replaced.
//
//   node compare.mjs <base-url> <path> ...
import { createHash } from "node:crypto"
import http from "node:http"
import { brotliDecompressSync, gunzipSync } from "node:zlib"

const [base, ...paths] = process.argv.slice(2)
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
const get = (path, encoding) =>
	new Promise((resolve, reject) => {
		http
			.get(
				`${base}${path}`,
				{ headers: { "User-Agent": UA, Cookie: "gw_browser=1", "Accept-Language": "en-US,en;q=0.9", ...(encoding ? { "Accept-Encoding": encoding } : {}) } },
				(response) => {
					const parts = []
					response.on("data", (chunk) => parts.push(chunk))
					response.on("end", () => {
						const wire = Buffer.concat(parts)
						const coding = response.headers["content-encoding"]
						const body = coding === "br" ? brotliDecompressSync(wire) : coding === "gzip" ? gunzipSync(wire) : wire
						resolve({ status: response.statusCode, state: response.headers["gw-page-cache"] ?? "none", coding: coding ?? "identity", wire: wire.length, body })
					})
				},
			)
			.on("error", reject)
	})
const sha = (body) => createHash("sha256").update(body).digest("hex").slice(0, 16)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
for (const path of paths) {
	const answers = []
	for (const encoding of ["br", "br", "br", "gzip", undefined]) {
		answers.push(await get(path, encoding))
		await sleep(300)
	}
	const [first, second, ...stored] = answers
	const row = {
		path: path.replace(/\/u\/[^/]+\/lists\/\w+/, "/u/<handle>/lists/<id>"),
		status: [...new Set(answers.map((answer) => answer.status))].join(","),
		states: answers.map((answer) => answer.state).join(","),
		codings: answers.map((answer) => `${answer.coding}:${answer.wire}`).join(","),
		htmlBytes: second.body.length,
		sha: answers.map((answer) => sha(answer.body)),
		storedEqualsItsRender: stored.every((answer) => answer.body.equals(second.body)),
		freshRendersEqual: first.body.equals(second.body),
	}
	const timeless = (body) => body.toString().replace(/"dataUpdatedAt\\?":\d+/g, '"dataUpdatedAt":0')
	row.freshRendersEqualWithoutTime = timeless(first.body) === timeless(second.body)
	if (!row.freshRendersEqual) {
		let at = 0
		while (at < first.body.length && first.body[at] === second.body[at]) at++
		row.firstDifference = { at, a: first.body.subarray(Math.max(0, at - 60), at + 60).toString(), b: second.body.subarray(Math.max(0, at - 60), at + 60).toString() }
	}
	console.log(JSON.stringify(row))
}
