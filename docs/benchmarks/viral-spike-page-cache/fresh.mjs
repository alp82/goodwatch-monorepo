// fresh.mjs: do repeated fresh renders of one page differ? Run against an instance with PAGE_CACHE=off, where every
// request is rendered. Requests each path five times and prints the SHA-256 of each body, the same with the time in
// the related panel's query state (`dataUpdatedAt`) replaced, and where render 4 and render 5 differ, and render 1
// and render 5.
//
//   node fresh.mjs <base-url> <path> ...
import { createHash } from "node:crypto"
const [base, ...paths] = process.argv.slice(2)
const headers = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36", Cookie: "gw_browser=1", "Accept-Language": "en-US,en;q=0.9" }
const sha = (text) => createHash("sha256").update(text).digest("hex").slice(0, 10)
for (const path of paths) {
	const bodies = []
	const policies = []
	for (let i = 0; i < 5; i++) {
		const response = await fetch(base + path, { headers })
		policies.push(response.headers.get("cache-control"))
		bodies.push(await response.text())
		await new Promise((resolve) => setTimeout(resolve, 400))
	}
	const timeless = bodies.map((body) => body.replace(/\\?"dataUpdatedAt\\?":\d+/g, '"dataUpdatedAt":0'))
	const row = { path, sizes: bodies.map((b) => b.length), sha: bodies.map(sha), timelessSha: timeless.map(sha), policies: [...new Set(policies)] }
	const a = timeless[3], b = timeless[4]
	if (a !== b) {
		let at = 0
		while (at < a.length && a[at] === b[at]) at++
		row.diff34 = { at, a: a.slice(Math.max(0, at - 80), at + 80), b: b.slice(Math.max(0, at - 80), at + 80) }
	}
	const c = timeless[0]
	if (c !== b) {
		let at = 0
		while (at < c.length && c[at] === b[at]) at++
		row.diff04 = { at, a: c.slice(Math.max(0, at - 80), at + 80), b: b.slice(Math.max(0, at - 80), at + 80) }
	}
	console.log(JSON.stringify(row))
}
