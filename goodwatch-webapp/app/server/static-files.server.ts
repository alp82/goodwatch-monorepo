// Answers requests for the files of the client build (`build/client`: Vite's hashed files under `/assets/` and the
// files copied from `public/`) before Express sees them. `remix-serve` serves those files with `express.static` behind
// `compression`, which compresses every response again on every request and sends every file as `immutable` for a
// year. Here the work is done once: `scripts/precompress.mjs` writes a Brotli and a gzip file next to each compressible
// file at build time, and this module reads the directory once at start into a manifest (URL path to file, size, type,
// ETag, cache policy, and the precompressed variants). A request then costs one map lookup and one write.
//
// - A request path is only ever looked up in the manifest. No path from a request reaches the file system, so there is
//   nothing to traverse. Whatever the manifest doesn't know goes on to Express and Remix, with one exception: an unknown
//   path under `/assets/` answers 404 with `no-store`. Those names carry a content hash, so a miss is a file of another
//   build (a tab opened before a deploy), and a redirect to `/` would hand a script tag an HTML page.
// - Hashed files are `immutable` for a year. Files from `public/` keep their URL when their content changes, so they
//   get a short lifetime and are revalidated with their ETag (see `cachePolicy`). The ETag comes from the content, so it
//   stays the same across deploys and across processes.
// - Images, WOFF2 and video are sent as they are, never with `Content-Encoding`.
// - A compressible file without a precompressed variant is left to Express, which still compresses it. That keeps a
//   build without the precompression step correct.
//
// `remix-serve` owns the HTTP server, so this module finds it through Node's request event and wraps its listeners,
// as the browser gate does. It keeps its own state and doesn't care which wrapper is the outer one.
import { createHash } from "node:crypto"
import { subscribe } from "node:diagnostics_channel"
import { createReadStream } from "node:fs"
import { open, readFile, readdir, stat } from "node:fs/promises"
import type {
	IncomingMessage,
	RequestListener,
	Server,
	ServerResponse,
} from "node:http"
import { availableParallelism } from "node:os"
import { extname, join, relative, resolve, sep } from "node:path"

type Headers = Record<string, string | number>
type Variant = {
	path: string
	size: number
	etag: string
	body?: Buffer
	headers: Headers
}
type StaticEntry = {
	size: number
	identity: Variant
	br?: Variant
	gzip?: Variant
	etags: Set<string>
	conditionalHeaders: Headers
}
export type StaticManifest = {
	files: Map<string, StaticEntry>
	assetsPrefix: string
	fallback: Set<string>
}
const contentTypes: Record<string, string> = {
	js: "text/javascript; charset=utf-8",
	mjs: "text/javascript; charset=utf-8",
	css: "text/css; charset=utf-8",
	html: "text/html; charset=utf-8",
	json: "application/json; charset=utf-8",
	map: "application/json; charset=utf-8",
	webmanifest: "application/manifest+json; charset=utf-8",
	xml: "application/xml; charset=utf-8",
	txt: "text/plain; charset=utf-8",
	svg: "image/svg+xml",
	ico: "image/x-icon",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	wasm: "application/wasm",
}
for (const extension of "png gif webp avif".split(" "))
	contentTypes[extension] = `image/${extension}`
for (const extension of "woff2 woff ttf otf".split(" "))
	contentTypes[extension] = `font/${extension}`
for (const extension of ["mp4", "webm"])
	contentTypes[extension] = `video/${extension}`

const compressible =
	/^(js|mjs|css|html|svg|json|map|webmanifest|xml|txt|ttf|otf|ico|wasm)$/
const shortCache = new Set("txt xml json webmanifest html".split(" "))
function cachePolicy(
	urlPath: string,
	extension: string,
	assetsPrefix: string,
): string {
	if (urlPath.startsWith(assetsPrefix))
		return "public, max-age=31536000, immutable"
	// Unversioned files keep their URL when content changes, so they must not be immutable.
	if (shortCache.has(extension) || urlPath.startsWith("/sitemaps/"))
		return "public, max-age=3600"
	// Images and fonts change less often, and can be reused while a cache refreshes them.
	return "public, max-age=86400, stale-while-revalidate=604800"
}
async function parallel<T>(items: T[], run: (item: T) => Promise<void>) {
	let next = 0
	const worker = async () => {
		while (next < items.length) await run(items[next++])
	}
	const length = Math.min(availableParallelism(), items.length)
	await Promise.all(Array.from({ length }, worker))
}
function memoryLimit(name: string, fallback: number) {
	const value = Number(process.env[name] ?? fallback)
	return Number.isSafeInteger(value) && value >= 0 ? value : fallback
}
async function contentTag(path: string) {
	// Hash large videos in chunks without retaining the entire file during startup.
	const file = await open(path, "r")
	try {
		const hash = createHash("sha1")
		for await (const chunk of file.createReadStream()) hash.update(chunk)
		return hash.digest("base64url").slice(0, 20)
	} finally {
		await file.close()
	}
}

export async function buildStaticManifest(
	directory: string,
	assetsPrefix: string,
): Promise<StaticManifest> {
	const started = performance.now()
	const root = resolve(directory)
	const entries = await readdir(root, { recursive: true, withFileTypes: true })
	const urlOf = (path: string) =>
		`/${relative(root, path).split(sep).join("/")}`
	const paths = new Set<string>()
	for (const entry of entries) {
		const path = join(entry.parentPath, entry.name)
		if (entry.isFile() && !/(^|\/)\./.test(urlOf(path))) paths.add(path)
	}
	const files = new Map<string, StaticEntry>()
	const fallback = new Set<string>()
	const variants: Variant[] = []
	let brCount = 0
	let gzipCount = 0
	await parallel([...paths], async (path) => {
		const extension = extname(path).slice(1).toLowerCase()
		if (extension === "br" || extension === "gz") return
		const urlPath = urlOf(path)
		const contentType = contentTypes[extension]
		fallback.add(urlPath)
		if (typeof contentType !== "string") return
		const { size } = await stat(path)
		const tag = await contentTag(path)
		const make = (path: string, size: number, suffix = ""): Variant => ({
			path,
			size,
			etag: `"${tag}${suffix}"`,
			headers: {},
		})
		const identity = make(path, size)
		const policy = cachePolicy(urlPath, extension, assetsPrefix)
		const conditionalHeaders: Headers = { "Cache-Control": policy }
		const entry: StaticEntry = {
			size,
			identity,
			etags: new Set([identity.etag]),
			conditionalHeaders,
		}
		if (compressible.test(extension)) {
			for (const encoding of ["br", "gzip"] as const) {
				const suffix = encoding === "br" ? "br" : "gz"
				const sibling = `${path}.${suffix}`
				if (!paths.has(sibling)) continue
				const variant = await stat(sibling)
				if (variant.size < size)
					entry[encoding] = make(sibling, variant.size, `-${suffix}`)
			}
			// Older builds still get Express compression, including existing files under assets.
			if (size > 1024 && !entry.br && !entry.gzip) return
		}
		if (entry.br) brCount++
		if (entry.gzip) gzipCount++
		if (entry.br || entry.gzip) conditionalHeaders.Vary = "Accept-Encoding"
		for (const encoding of ["identity", "br", "gzip"] as const) {
			const item = entry[encoding]
			if (!item) continue
			item.headers = {
				...conditionalHeaders,
				"Content-Type": contentType,
				"Content-Length": item.size,
				ETag: item.etag,
			}
			if (encoding !== "identity") item.headers["Content-Encoding"] = encoding
			if (!entry.br && !entry.gzip) item.headers["Accept-Ranges"] = "bytes"
			entry.etags.add(item.etag)
			// Kept in memory: what a browser asks for on a page view. Not source maps, and not the uncompressed form
			// of a file that has compressed variants. Those are rare requests and are streamed from disk.
			const rare =
				extension === "map" ||
				(encoding === "identity" && (entry.br || entry.gzip))
			if (!rare) variants.push(item)
		}
		files.set(urlPath, entry)
		fallback.delete(urlPath)
	})
	const fileMax = memoryLimit("STATIC_MEMORY_FILE_MAX_BYTES", 262144)
	const totalMax = memoryLimit("STATIC_MEMORY_TOTAL_MAX_BYTES", 33554432)
	let memory = 0
	const held = variants
		.sort((a, b) => a.size - b.size)
		.filter((item) => {
			if (!fileMax || item.size > fileMax || memory + item.size > totalMax)
				return false
			memory += item.size
			return true
		})
	await parallel(held, async (item) => {
		item.body = await readFile(item.path)
	})
	console.info(
		`Static manifest: ${files.size} files, ${brCount} Brotli, ${gzipCount} gzip, ${memory} bytes in memory, ${Math.round(performance.now() - started)} ms`,
	)
	return { files, assetsPrefix, fallback }
}

const encodings = new Map<string, { br: boolean; gzip: boolean }>()
export function accepted(header: string) {
	const known = encodings.get(header)
	if (known) return known
	const qualities = new Map<string, number>()
	for (const part of header.toLowerCase().split(",")) {
		const [name, ...parameters] = part.trim().split(";")
		const q = parameters.find((value) => value.trim().startsWith("q="))
		const quality = q === undefined ? 1 : Number(q.trim().slice(2))
		qualities.set(name.trim(), quality > 0 && quality <= 1 ? quality : 0)
	}
	const result = {
		br: (qualities.get("br") ?? qualities.get("*") ?? 0) > 0,
		gzip: (qualities.get("gzip") ?? qualities.get("*") ?? 0) > 0,
	}
	if (encodings.size >= 200) encodings.clear()
	encodings.set(header, result)
	return result
}
type ByteRange = { start: number; end: number }
function byteRange(header: string, size: number): ByteRange | null | false {
	const match = /^bytes=(\d*)-(\d*)$/.exec(header)
	if (!match || (!match[1] && !match[2])) return null
	if (match[1] && match[2] && Number(match[2]) < Number(match[1])) return null
	const start = match[1]
		? Number(match[1])
		: Math.max(0, size - Number(match[2]))
	const end =
		match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1
	return start >= size || end < start ? false : { start, end }
}
function sendBody(
	variant: Variant,
	response: ServerResponse,
	head: boolean,
	range: ByteRange | null | false,
) {
	const status = range === false ? 416 : range ? 206 : 200
	const headers =
		range === null
			? variant.headers
			: {
					...variant.headers,
					"Content-Range": range
						? `bytes ${range.start}-${range.end}/${variant.size}`
						: `bytes */${variant.size}`,
					"Content-Length": range ? range.end - range.start + 1 : 0,
				}
	if (head || range === false || variant.body) {
		let body = variant.body
		if (range) body = body?.subarray(range.start, range.end + 1)
		response.writeHead(status, headers)
		response.end(head || range === false ? undefined : body)
		return
	}
	const stream = createReadStream(variant.path, range ?? undefined)
	const close = () => stream.destroy()
	response.once("close", close)
	stream.once("close", () => response.removeListener("close", close))
	stream.once("error", () => {
		if (response.headersSent) response.destroy()
		else {
			response.writeHead(500, {
				"Cache-Control": "no-store",
				"Content-Length": 0,
			})
			response.end()
		}
	})
	// Wait for open so a missing file gets a 500, with only one writeHead call.
	stream.once("open", () => {
		if (response.destroyed) return
		response.writeHead(status, headers)
		stream.pipe(response)
	})
}
export function answerStatic(
	manifest: StaticManifest,
	request: IncomingMessage,
	response: ServerResponse,
): boolean {
	if (request.method !== "GET" && request.method !== "HEAD") return false
	const url = request.url ?? "/"
	const query = url.indexOf("?")
	const path = query < 0 ? url : url.slice(0, query)
	let decoded = path
	let entry = manifest.files.get(path)
	if (!entry && path.includes("%")) {
		try {
			decoded = decodeURIComponent(path)
			entry = manifest.files.get(decoded)
		} catch {
			/* Invalid escapes cannot name a manifest entry. */
		}
	}
	if (!entry) {
		if (
			manifest.fallback.has(path) ||
			manifest.fallback.has(decoded) ||
			(!path.startsWith(manifest.assetsPrefix) &&
				!decoded.startsWith(manifest.assetsPrefix))
		)
			return false
		response.writeHead(404, {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "no-store",
			"Content-Length": 9,
		})
		response.end(request.method === "HEAD" ? undefined : "Not found")
		return true
	}
	const encoding = accepted(request.headers["accept-encoding"] ?? "")
	let variant = entry.identity
	if (entry.gzip && encoding.gzip) variant = entry.gzip
	if (entry.br && encoding.br) variant = entry.br
	const noneMatch = request.headers["if-none-match"]
	const matches = (tag: string) =>
		tag === "*" || entry.etags.has(tag.replace(/^W\//, ""))
	if (noneMatch?.split(",").some((tag) => matches(tag.trim()))) {
		response.writeHead(304, {
			...entry.conditionalHeaders,
			ETag: variant.etag,
		})
		response.end()
		return true
	}
	const { range: rangeHeader, "if-range": ifRange } = request.headers
	let range: ByteRange | null | false = null
	const canRange =
		!entry.br && !entry.gzip && (!ifRange || ifRange === entry.identity.etag)
	if (rangeHeader && canRange) range = byteRange(rangeHeader, entry.size)
	sendBody(variant, response, request.method === "HEAD", range)
	return true
}

// How long a request waits for the manifest after a start before the app answers it instead.
const MANIFEST_WAIT_MS = 10_000

const key = Symbol.for("goodwatch.static-files")
const initial = {
	started: false,
	wrapped: new WeakSet<Server>(),
	manifest: undefined as StaticManifest | undefined,
	// Resolves when the manifest is there, when building it failed, or after MANIFEST_WAIT_MS.
	settled: undefined as Promise<void> | undefined,
}
const shared = globalThis as typeof globalThis & { [key]?: typeof initial }
shared[key] ??= initial
const state = shared[key]
type RequestEvent = { server: Server; request: IncomingMessage }

/**
 * Starts answering the client build's files on the public HTTP server of this process, once. Call it while the server
 * build loads: the files must be answered from the first request on.
 */
export function startStaticFiles(): void {
	if (process.env.NODE_ENV !== "production" || state.started) return
	state.started = true
	// Lazy import lets the route modules finish evaluating before reading the build.
	const loading = (async () => {
		const build = await import("virtual:remix/server-build")
		state.manifest = await buildStaticManifest(
			build.assetsBuildDirectory,
			`${build.publicPath}assets/`,
		)
	})().catch((error) =>
		console.error("Static manifest could not be loaded:", error),
	)
	state.settled = Promise.race([
		loading,
		new Promise<void>((resolve) =>
			setTimeout(resolve, MANIFEST_WAIT_MS).unref(),
		),
	]).then(() => {
		state.settled = undefined
	})

	subscribe("http.server.request.start", (message) => {
		const { server, request } = message as RequestEvent
		if (
			request.socket.localPort !== (Number(process.env.PORT) || 3000) ||
			state.wrapped.has(server)
		)
			return
		state.wrapped.add(server)
		const listeners = server.listeners("request")
		server.removeAllListeners("request")
		const handle: RequestListener = (request, response) => {
			// The manifest takes a moment to build after a start. A request that arrives before it waits: Express
			// would answer a file from `public/` as immutable for a year, which is what this module is there to end.
			// Only requests that can name a file wait (a dot in the path): pages and health checks go on at once.
			if (
				state.settled &&
				(request.method === "GET" || request.method === "HEAD") &&
				request.url?.split("?", 1)[0].includes(".")
			) {
				void state.settled.then(() => handle(request, response))
				return
			}
			try {
				if (state.manifest && answerStatic(state.manifest, request, response))
					return
			} catch {
				// The app answers when no headers have been sent.
				if (response.headersSent) return void response.destroy()
			}
			for (const listener of listeners)
				Reflect.apply(listener, server, [request, response])
		}
		server.on("request", handle)
	})
}
