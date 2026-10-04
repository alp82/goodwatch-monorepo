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
		assert.equal(conditional.body.length, 0)
		const head = await get(path, headers, "HEAD")
		assert.equal(head.status, 200)
		assert.equal(head.body.length, 0)
		assert.equal(head.headers.etag, own.headers.etag)
	}
	const range = await get("/assets/icon-AbCd1234.png", { Range: "bytes=1-3" })
	assert.equal(range.status, 206)
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
