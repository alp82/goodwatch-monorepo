// check-page-files.mjs <origin> <page-path> ...: requests every same-origin static file that the pages' HTML
// references, with Brotli and with gzip, through whatever is in front of the webapp (the proxy in production).
// Checks the status, Content-Encoding, Cache-Control, ETag, and Vary, and that both encodings decode to the same
// bytes. Reports, without failing, when something on the way encodes an image or a WOFF2 font: the app never does.
import { createHash } from "node:crypto"
import http from "node:http"
import https from "node:https"
import { brotliDecompressSync, gunzipSync } from "node:zlib"

const [origin, ...pages] = process.argv.slice(2)
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
const failures = []
const files = new Set()
for (const page of pages) {
	const response = await fetch(`${origin}${page}`, { headers: { Cookie: "gw_browser=1", "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" } })
	if (response.status !== 200) failures.push(`page ${pages.indexOf(page) + 1}: status ${response.status}`)
	const html = await response.text()
	const pattern = /(?:href|src|content)="(\/[^"?#/][^"?#]*\.[a-z0-9]{2,11})"|["'(](\/assets\/[^"'()?#\s]+\.[a-z0-9]{2,5})["')]/g
	for (const match of html.matchAll(pattern)) {
		const path = match[1] ?? match[2]
		if (/\.(js|css|png|jpe?g|webp|avif|svg|ico|woff2?|ttf|webmanifest|json|txt|xml)$/.test(path)) files.add(path)
	}
}
files.add("/robots.txt")
files.add("/favicon.ico")

const COMPRESSED_ALREADY = /\.(png|jpe?g|gif|webp|avif|woff2?)$/
const SHORT = /\.(txt|xml|json|webmanifest|html)$/
const expectedCache = (path) =>
	path.startsWith("/assets/")
		? "public, max-age=31536000, immutable"
		: SHORT.test(path) || path.startsWith("/sitemaps/")
			? "public, max-age=3600"
			: "public, max-age=86400, stale-while-revalidate=604800"
// fetch decodes the body and hides what was sent, so these requests use the HTTP client directly.
const client = origin.startsWith("https:") ? https : http
const get = (path, accept) =>
	new Promise((resolve, reject) => {
		client
			.get(`${origin}${path}`, { headers: { "Accept-Encoding": accept, "User-Agent": UA } }, (response) => {
				const chunks = []
				response.on("data", (chunk) => chunks.push(chunk))
				response.on("end", () =>
					resolve({ status: response.statusCode, headers: { get: (name) => response.headers[name] ?? null }, body: Buffer.concat(chunks) }),
				)
			})
			.on("error", reject)
	})
const decode = (body, encoding) => (encoding === "br" ? brotliDecompressSync(body) : encoding === "gzip" ? gunzipSync(body) : body)
const totals = { files: files.size, br: 0, gzip: 0, decoded: 0, proxyEncoded: [] }
const rows = []
for (const path of [...files].sort()) {
	const hashes = new Set()
	for (const [name, accept] of [["br", "gzip, deflate, br"], ["gzip", "gzip, deflate"]]) {
		const where = `${path} [${name}]`
		const response = await get(path, accept)
		if (response.status !== 200) {
			failures.push(`${where}: status ${response.status}`)
			continue
		}
		const encoding = response.headers.get("content-encoding") ?? ""
		let decoded
		try {
			decoded = decode(response.body, encoding)
		} catch {
			failures.push(`${where}: body doesn't decode as ${encoding}`)
			continue
		}
		hashes.add(createHash("sha1").update(decoded).digest("hex"))
		const compressedAlready = COMPRESSED_ALREADY.test(path)
		if (compressedAlready && encoding) totals.proxyEncoded.push(`${path} [${name}]: ${encoding}`)
		if (!compressedAlready && decoded.length > 1024 && encoding !== name) failures.push(`${where}: Content-Encoding "${encoding}"`)
		if (response.headers.get("cache-control") !== expectedCache(path)) failures.push(`${where}: Cache-Control ${response.headers.get("cache-control")}`)
		if (!/^(W\/)?"[^"]+"$/.test(response.headers.get("etag") ?? "")) failures.push(`${where}: ETag ${response.headers.get("etag")}`)
		if (!compressedAlready && !(response.headers.get("vary") ?? "").includes("Accept-Encoding")) failures.push(`${where}: Vary ${response.headers.get("vary")}`)
		if (!decoded.length) failures.push(`${where}: empty body`)
		totals[name] += response.body.length
		if (name === "br") {
			totals.decoded += decoded.length
			rows.push(`${path}  ${encoding || "-"}  ${response.body.length}/${decoded.length}  ${response.headers.get("cache-control")}  length:${response.headers.get("content-length") ?? "-"}`)
		}
	}
	if (hashes.size > 1) failures.push(`${path}: Brotli and gzip decode to different bytes`)
}
const missing = await get("/assets/chunk-of-another-build-AbCd1234.js", "gzip, deflate, br")
if (missing.status !== 404 || !(missing.headers.get("cache-control") ?? "").includes("no-store"))
	failures.push(`missing asset: status ${missing.status}, Cache-Control ${missing.headers.get("cache-control")}, Location ${missing.headers.get("location")}`)
if (process.env.VERBOSE) console.log(rows.join("\n"))
console.log(JSON.stringify({ ...totals, proxyEncoded: totals.proxyEncoded.length }))
if (totals.proxyEncoded.length) console.log(`encoded on the way (not by the app): ${totals.proxyEncoded.slice(0, 4).join("; ")}${totals.proxyEncoded.length > 4 ? " ..." : ""}`)
for (const failure of failures.slice(0, 40)) console.log(`FAIL ${failure}`)
console.log(failures.length ? `${failures.length} failures` : "all checks passed")
process.exit(failures.length ? 1 : 0)
