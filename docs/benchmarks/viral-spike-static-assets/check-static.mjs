// check-static.mjs <base-url> <client-build-directory>: checks every file of a client build against a running webapp.
// For each file it requests the URL with Brotli, gzip, and no encoding, decodes the body, compares it with the file on
// disk, and checks Content-Encoding, Content-Length, ETag, Vary, Cache-Control, and Content-Type. Then it checks HEAD,
// If-None-Match, ranges, a missing asset, and path traversal attempts. Exits 1 when anything fails.
import { readFile, readdir } from "node:fs/promises"
import http from "node:http"
import { connect } from "node:net"
import { join, relative, sep } from "node:path"
import { brotliDecompressSync, gunzipSync } from "node:zlib"

const [base, directory] = process.argv.slice(2)
const target = new URL(base)
const agent = new http.Agent({ keepAlive: true, maxSockets: 8 })
const failures = []
const fail = (what) => failures.push(what)

const ask = (path, headers = {}, method = "GET") =>
	new Promise((resolve, reject) => {
		const request = http.request(
			{ host: target.hostname, port: target.port, path, method, agent, headers: { Cookie: "gw_browser=1", ...headers } },
			(response) => {
				const chunks = []
				response.on("data", (chunk) => chunks.push(chunk))
				response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }))
			},
		)
		request.on("error", reject)
		request.end()
	})
// A request line as written, for paths that an HTTP client would normalise or refuse.
const raw = (path) =>
	new Promise((resolve) => {
		const socket = connect(Number(target.port), target.hostname, () =>
			socket.write(`GET ${path} HTTP/1.1\r\nHost: ${target.host}\r\nConnection: close\r\nCookie: gw_browser=1\r\n\r\n`),
		)
		let data = ""
		socket.on("data", (chunk) => {
			data += chunk.toString("latin1")
		})
		socket.on("close", () => resolve({ status: Number(data.slice(9, 12)) || 0, text: data }))
		socket.on("error", () => resolve({ status: 0, text: "" }))
	})

const COMPRESSED_ALREADY = /\.(png|jpe?g|gif|webp|avif|woff2?|mp4|webm)$/
const SHORT = /\.(txt|xml|json|webmanifest|html)$/
const expectedCache = (url) =>
	url.startsWith("/assets/")
		? "public, max-age=31536000, immutable"
		: SHORT.test(url) || url.startsWith("/sitemaps/")
			? "public, max-age=3600"
			: "public, max-age=86400, stale-while-revalidate=604800"

const entries = await readdir(directory, { recursive: true, withFileTypes: true })
const files = entries
	.filter((entry) => entry.isFile() && !/\.(br|gz)$/.test(entry.name))
	.map((entry) => join(entry.parentPath, entry.name))
const onDisk = new Set(entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name)))
const counts = { files: files.length, requests: 0, br: 0, gzip: 0, identity: 0, bytes: { identity: 0, br: 0, gzip: 0 } }
const kinds = new Map()

const checkFile = async (file) => {
	const url = `/${relative(directory, file).split(sep).join("/")}`
	const disk = await readFile(file)
	const etags = new Set()
	for (const [name, accept] of [["br", "gzip, deflate, br, zstd"], ["gzip", "gzip, deflate"], ["identity", "identity"]]) {
		const response = await ask(url, { "Accept-Encoding": accept })
		counts.requests++
		const where = `${url} [${name}]`
		if (response.status !== 200) {
			fail(`${where}: status ${response.status}`)
			continue
		}
		const encoding = response.headers["content-encoding"] ?? "identity"
		let body = response.body
		try {
			if (encoding === "br") body = brotliDecompressSync(body)
			else if (encoding === "gzip") body = gunzipSync(body)
			else if (encoding !== "identity") fail(`${where}: unknown Content-Encoding ${encoding}`)
		} catch {
			fail(`${where}: body doesn't decode as ${encoding}`)
			continue
		}
		if (!body.equals(disk)) fail(`${where}: decoded body differs from the file`)
		if (name === "identity" && encoding !== "identity") fail(`${where}: encoded for an identity client`)
		if (name === "gzip" && encoding === "br") fail(`${where}: Brotli for a gzip client`)
		if (COMPRESSED_ALREADY.test(url) && encoding !== "identity") fail(`${where}: ${encoding} on a compressed format`)
		const hasVariant = onDisk.has(`${file}.br`) || onDisk.has(`${file}.gz`)
		if (name === "br" && onDisk.has(`${file}.br`) && encoding !== "br") fail(`${where}: no Brotli though a .br file exists`)
		if (name === "gzip" && onDisk.has(`${file}.gz`) && encoding !== "gzip") fail(`${where}: no gzip though a .gz file exists`)
		if (Number(response.headers["content-length"]) !== response.body.length)
			fail(`${where}: Content-Length ${response.headers["content-length"]} for ${response.body.length} bytes`)
		if (!/^"[^"]+"$/.test(response.headers.etag ?? "")) fail(`${where}: ETag ${response.headers.etag}`)
		etags.add(response.headers.etag)
		if (hasVariant && response.headers.vary !== "Accept-Encoding") fail(`${where}: Vary ${response.headers.vary}`)
		if (response.headers["cache-control"] !== expectedCache(url))
			fail(`${where}: Cache-Control ${response.headers["cache-control"]}`)
		if (!response.headers["content-type"]) fail(`${where}: no Content-Type`)
		counts[encoding === "br" ? "br" : encoding === "gzip" ? "gzip" : "identity"]++
		counts.bytes[name] += response.body.length
		if (name === "br") {
			const kind = `${url.startsWith("/assets/") ? "assets" : "public"} .${url.split(".").pop()}`
			const seen = kinds.get(kind) ?? { files: 0, type: response.headers["content-type"], cache: response.headers["cache-control"], encoding }
			seen.files++
			kinds.set(kind, seen)
			// A revalidation with the tag just received, and a HEAD with the same headers and no body.
			const again = await ask(url, { "Accept-Encoding": accept, "If-None-Match": response.headers.etag })
			if (again.status !== 304 || again.body.length) fail(`${where}: If-None-Match answers ${again.status}`)
			if (again.headers["cache-control"] !== expectedCache(url)) fail(`${where}: 304 Cache-Control ${again.headers["cache-control"]}`)
			const head = await ask(url, { "Accept-Encoding": accept }, "HEAD")
			if (head.status !== 200 || head.body.length || head.headers["content-length"] !== response.headers["content-length"])
				fail(`${where}: HEAD ${head.status} length ${head.headers["content-length"]}`)
			counts.requests += 2
		}
	}
	if (onDisk.has(`${file}.br`) && etags.size < 2) fail(`${url}: the encodings share one ETag`)
}
const queue = [...files]
await Promise.all(Array.from({ length: 8 }, async () => {
	while (queue.length) await checkFile(queue.pop())
}))

// Ranges on a file without variants.
const image = files.find((file) => /\.(png|webp|avif)$/.test(file))
if (image) {
	const url = `/${relative(directory, image).split(sep).join("/")}`
	const disk = await readFile(image)
	const part = await ask(url, { Range: "bytes=10-19" })
	if (part.status !== 206 || !part.body.equals(disk.subarray(10, 20)) || part.headers["content-range"] !== `bytes 10-19/${disk.length}`)
		fail(`${url}: range answers ${part.status} ${part.headers["content-range"]}`)
	const tail = await ask(url, { Range: "bytes=-5" })
	if (tail.status !== 206 || !tail.body.equals(disk.subarray(disk.length - 5))) fail(`${url}: suffix range answers ${tail.status}`)
	const beyond = await ask(url, { Range: `bytes=${disk.length}-` })
	if (beyond.status !== 416) fail(`${url}: a range past the end answers ${beyond.status}`)
	const stale = await ask(url, { Range: "bytes=10-19", "If-Range": '"other"' })
	if (stale.status !== 200 || !stale.body.equals(disk)) fail(`${url}: If-Range with another tag answers ${stale.status}`)
}

// A hashed file of another build, and paths that try to leave the client build.
const missing = await ask("/assets/chunk-of-another-build-AbCd1234.js", { "Accept-Encoding": "br" })
if (missing.status !== 404 || missing.headers["cache-control"] !== "no-store" || missing.headers.location)
	fail(`missing asset: ${missing.status} ${missing.headers["cache-control"]}`)
const secrets = ["remix-serve", "virtual:remix", "node_modules", '"dependencies"', "startStaticFiles"]
for (const path of [
	"/assets/../../server/index.js",
	"/assets/../../../package.json",
	"/assets/%2e%2e/%2e%2e/server/index.js",
	"/assets/..%2f..%2fserver%2findex.js",
	"/assets/%2e%2e%2f%2e%2e%2f%2e%2e%2fpackage.json",
	"/assets/....//....//package.json",
	"/..%2f..%2fpackage.json",
	"/%2e%2e/%2e%2e/package.json",
	"/../../package.json",
	"/assets//etc/passwd",
	"//etc/passwd",
	"/assets/%00",
	"/assets/x.js%00.png",
	"/robots.txt%00",
	"/assets/..\\..\\package.json",
	"/build/server/index.js",
]) {
	const response = await raw(path)
	const leaked = secrets.some((word) => response.text.includes(word)) || response.text.includes("root:x:")
	if (leaked || response.status === 200) fail(`traversal ${path}: status ${response.status}${leaked ? ", file content in the body" : ""}`)
	console.log(`traversal ${JSON.stringify(path)} -> ${response.status}`)
}
for (const [kind, seen] of [...kinds].sort()) console.log(`${kind}: ${seen.files} files, ${seen.type}, ${seen.cache}, ${seen.encoding} for a Brotli client`)
console.log(JSON.stringify(counts))
for (const failure of failures.slice(0, 40)) console.log(`FAIL ${failure}`)
console.log(failures.length ? `${failures.length} failures` : "all checks passed")
agent.destroy()
process.exit(failures.length ? 1 : 0)
