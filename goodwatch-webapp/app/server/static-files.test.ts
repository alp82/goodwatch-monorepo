import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { createServer, request } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { brotliCompressSync } from "node:zlib"
import { createBuildFileStore } from "./build-file-store.server.ts"
import { answerStatic, buildStaticManifest } from "./static-files.server.ts"

test("another build serves shared files with matching headers and conditional responses", async (t) => {
	const directory = await mkdtemp(join(tmpdir(), "static-builds-"))
	t.after(() => rm(directory, { recursive: true, force: true }))
	const first = join(directory, "first")
	const second = join(directory, "second")
	await mkdir(join(first, "assets"), { recursive: true })
	await mkdir(join(second, "assets"), { recursive: true })
	const path = "/assets/root-AbCd1234.js"
	const identity = Buffer.from("export const value = 123;".repeat(100))
	const br = brotliCompressSync(identity)
	await writeFile(join(first, path), identity)
	await writeFile(join(first, `${path}.br`), br)
	await writeFile(join(second, "assets/root-EfGh5678.js"), "other")
	await writeFile(join(first, "assets/icon-AbCd1234.png"), "image")
	const a = await buildStaticManifest(first, "/assets/")
	const b = await buildStaticManifest(second, "/assets/")
	const values = new Map<string, Buffer>()
	const store = createBuildFileStore({
		redis: () => ({
			async getBuffer(key) {
				return values.get(key) ?? null
			},
			async setex(key, _seconds, value) {
				values.set(key, value)
			},
		}),
	})
	await store.publish(
		[...a.files].map(([urlPath, entry]) => ({
			urlPath,
			...(entry.br ?? entry.identity),
			encoding: entry.br ? "br" : "identity",
		})),
	)
	let manifest = b
	let shared: Pick<typeof store, "lookup"> | undefined = store
	const server = createServer((req, res) => {
		if (!answerStatic(manifest, req, res, shared)) {
			res.writeHead(418)
			res.end()
		}
	})
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
	t.after(
		() =>
			new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve())),
			),
	)
	const address = server.address()
	assert.ok(address && typeof address !== "string")
	const get = (
		url = path,
		headers: Record<string, string> = {},
		method = "GET",
	) =>
		new Promise<{
			status: number | undefined
			headers: import("node:http").IncomingHttpHeaders
			body: Buffer
		}>((resolve, reject) => {
			const req = request(
				{ host: "127.0.0.1", port: address.port, path: url, headers, method },
				(res) => {
					const chunks: Buffer[] = []
					res.on("data", (chunk) => chunks.push(chunk))
					res.on("end", () =>
						resolve({
							status: res.statusCode,
							headers: res.headers,
							body: Buffer.concat(chunks),
						}),
					)
				},
			)
			req.on("error", reject)
			req.end()
		})
	for (const encoding of ["", "gzip", "br"]) {
		const headers = { "Accept-Encoding": encoding }
		manifest = a
		const own = await get(path, headers)
		manifest = b
		const remote = await get(`${path}?v=1`, headers)
		assert.equal(remote.status, 200)
		assert.equal(remote.headers["access-control-allow-origin"], "*")
		assert.deepEqual(remote.body, encoding === "br" ? br : identity)
		for (const name of [
			"etag",
			"cache-control",
			"content-type",
			"content-length",
			"vary",
			"content-encoding",
		])
			assert.equal(remote.headers[name], own.headers[name], name)
		assert.match(String(remote.headers["cache-control"]), /immutable/)
		assert.equal(
			remote.headers["content-encoding"],
			encoding === "br" ? "br" : undefined,
		)
		const conditional = await get(path, {
			...headers,
			"If-None-Match": String(own.headers.etag),
		})
		assert.equal(conditional.status, 304)
		assert.equal(conditional.headers["access-control-allow-origin"], "*")
		assert.equal(conditional.body.length, 0)
		const head = await get(path, headers, "HEAD")
		assert.equal(head.status, 200)
		assert.equal(head.body.length, 0)
		assert.equal(head.headers.etag, own.headers.etag)
	}
	const range = await get("/assets/icon-AbCd1234.png", { Range: "bytes=1-3" })
	assert.equal(range.status, 206)
	assert.equal(range.headers["access-control-allow-origin"], "*")
	assert.equal(range.body.toString(), "mag")
	for (const url of [
		"/assets/unknown-123.js",
		"/assets/a.map",
		"/assets/%61.js",
	]) {
		const missing = await get(url)
		assert.equal(missing.status, 404)
		assert.equal(missing.headers["cache-control"], "no-store")
	}
	shared = undefined
	assert.equal((await get()).status, 404)
	shared = {
		lookup: async () => {
			throw new Error("unavailable")
		},
	}
	const failed = await get()
	assert.equal(failed.status, 404)
	assert.equal(failed.headers["cache-control"], "no-store")
})

test("file-only decisions block pages, health, unknown paths and non-GET methods without a server", async (t) => {
	const directory = await mkdtemp(join(tmpdir(), "static-only-"))
	t.after(() => rm(directory, { recursive: true, force: true }))
	await mkdir(join(directory, "assets"))
	await writeFile(join(directory, "assets/test.js"), "ok")
	await writeFile(join(directory, "fallback.css"), "x".repeat(2048))
	await writeFile(join(directory, "fallback.ttf"), "x".repeat(2048))
	const manifest = await buildStaticManifest(directory, "/assets/")
	const answer = (
		url: string,
		method = "GET",
		filesOnly = true,
		loaded = true,
	) => {
		let status = 0
		let headers: Record<string, string | number> = {}
		let body: unknown
		const handled = answerStatic(
			loaded ? manifest : undefined,
			{
				url,
				method,
				headers: {},
			} as import("node:http").IncomingMessage,
			{
				writeHead(code: number, values: typeof headers) {
					status = code
					headers = values
				},
				setHeader(name: string, value: string) {
					headers[name] = value
				},
				end(value: unknown) {
					body = value
				},
			} as import("node:http").ServerResponse,
			undefined,
			{ filesOnly },
		)
		return { handled, status, headers, body }
	}
	for (const path of [
		"/",
		"/health/live",
		"/health/ready",
		"/unknown",
		"/missing.png",
		"/assets/missing.js",
		"/%68ealth/live",
	])
		for (const method of ["GET", "HEAD", "POST"]) {
			const result = answer(path, method)
			assert.equal(result.handled, true)
			assert.equal(result.status, 404)
			assert.equal(result.headers["Cache-Control"], "no-store")
			assert.equal(result.headers["Content-Type"], "text/plain; charset=utf-8")
			assert.equal(result.body, method === "HEAD" ? undefined : "Not found")
		}
	assert.equal(answer("/assets/test.js").status, 200)
	assert.equal(answer("/assets/test.js", "POST").status, 404)
	assert.equal(answer("/fallback.ttf").handled, false)
	assert.equal(
		answer("/fallback.ttf").headers["Access-Control-Allow-Origin"],
		"*",
	)
	assert.equal(answer("/fallback.css").handled, false)
	assert.equal(answer("/fallback.css", "POST").status, 404)
	assert.equal(answer("/%66allback.css").handled, false)
	assert.equal(answer("/health/live", "GET", false).handled, false)
	assert.equal(answer("/", "GET", true, false).status, 503)
	assert.equal(
		answer("/", "GET", true, false).headers["Cache-Control"],
		"no-store",
	)
})

test("CORS follows asset, font and webmanifest files on 200, 206 and 304", async (t) => {
	const directory = await mkdtemp(join(tmpdir(), "static-cors-"))
	t.after(() => rm(directory, { recursive: true, force: true }))
	await mkdir(join(directory, "assets"))
	const cors = [
		"assets/test.js",
		"font.woff2",
		"font.woff",
		"font.ttf",
		"font.otf",
		"site.webmanifest",
	]
	const sameHost = ["robots.txt", "sitemap.xml", "image.png"]
	for (const file of [...cors, ...sameHost])
		await writeFile(join(directory, file), "body")
	const manifest = await buildStaticManifest(directory, "/assets/")
	for (const file of [...cors, ...sameHost]) {
		const entry = manifest.files.get(`/${file}`)!
		for (const [status, headers] of [
			[200, {}],
			[206, { range: "bytes=0-1" }],
			[304, { "if-none-match": entry.identity.etag }],
		] as const) {
			let answered = false
			answerStatic(
				manifest,
				{
					url: `/${file}`,
					method: "GET",
					headers,
				} as import("node:http").IncomingMessage,
				{
					writeHead(code: number, values: Record<string, string | number>) {
						answered = true
						assert.equal(code, status)
						assert.equal(
							values["Access-Control-Allow-Origin"],
							cors.includes(file) ? "*" : undefined,
						)
					},
					end() {},
				} as import("node:http").ServerResponse,
			)
			assert.equal(answered, true)
		}
	}
})

test("file-only shared-store responses carry CORS on 200, 206 and 304", async () => {
	const manifest = {
		files: new Map(),
		fallback: new Set<string>(),
		assetsPrefix: "/assets/",
	}
	const file = { identity: Buffer.from("image") }
	const store = { lookup: async () => file }
	let etag = ""
	for (const [status, headers] of [
		[200, {}],
		[206, { range: "bytes=1-3" }],
		[304, { "if-none-match": "*" }],
	] as const) {
		await new Promise<void>((resolve, reject) => {
			const handled = answerStatic(
				manifest,
				{
					url: "/assets/icon-AbCd1234.png",
					method: "GET",
					headers,
				} as import("node:http").IncomingMessage,
				{
					writeHead(code: number, values: Record<string, string | number>) {
						try {
							assert.equal(code, status)
							assert.equal(values["Access-Control-Allow-Origin"], "*")
							if (etag) assert.equal(values.ETag, etag)
							else etag = String(values.ETag)
						} catch (error) {
							reject(error)
						}
					},
					end() {
						resolve()
					},
				} as import("node:http").ServerResponse,
				store,
				{ filesOnly: true },
			)
			assert.equal(handled, true)
		})
	}
})
