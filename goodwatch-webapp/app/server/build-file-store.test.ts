import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { brotliCompressSync } from "node:zlib"
import {
	BUILD_FILE_MAX_BYTES,
	BUILD_FILE_PREFIX,
	BUILD_FILE_STORE_SECONDS,
	createBuildFileStore,
	isBuildFilePath,
} from "./build-file-store.server.ts"
import { contentTypes } from "./static-files.server.ts"

function fixture() {
	const values = new Map<string, Buffer>()
	let reads = 0
	const expiries: number[] = []
	const redis = {
		async getBuffer(key: string) {
			reads++
			return values.get(key) ?? null
		},
		async setex(key: string, seconds: number, value: Buffer) {
			expiries.push(seconds)
			values.set(key, value)
		},
	}
	return { values, redis, expiries, reads: () => reads }
}
test("publishes identity and Brotli with expiry and skips oversized files", async (t) => {
	const directory = await mkdtemp(join(tmpdir(), "build-store-"))
	t.after(() => rm(directory, { recursive: true, force: true }))
	const f = fixture()
	const store = createBuildFileStore({ redis: () => f.redis })
	const identity = Buffer.from("export const value = 123;".repeat(100))
	for (const encoding of ["identity", "br"] as const) {
		const body = encoding === "br" ? brotliCompressSync(identity) : identity
		const path = join(directory, encoding)
		await writeFile(path, body)
		const urlPath = `/assets/${encoding}-AbCd1234.js`
		assert.deepEqual(
			await store.publish([{ path, urlPath, encoding, size: body.length }]),
			{ written: 1, skipped: 0, failed: 0 },
		)
		const file = await store.lookup(urlPath)
		assert.deepEqual(file?.identity, identity)
		assert.deepEqual(file?.br, encoding === "br" ? body : undefined)
		assert.equal(
			f.values.get(BUILD_FILE_PREFIX + urlPath)?.[0],
			encoding === "br" ? 1 : 0,
		)
		assert.equal(await store.lookup(urlPath), file)
	}
	assert.deepEqual(f.expiries, [
		BUILD_FILE_STORE_SECONDS,
		BUILD_FILE_STORE_SECONDS,
	])
	assert.deepEqual(
		await store.publish([
			{
				path: "absent",
				urlPath: "/assets/large.js",
				encoding: "identity",
				size: BUILD_FILE_MAX_BYTES + 1,
			},
		]),
		{ written: 0, skipped: 1, failed: 0 },
	)
	assert.equal(store.stats().memoryHits, 2)
	assert.equal(store.stats().storeHits, 2)
})
test("negative cache expires and evicts its oldest path", async () => {
	const f = fixture()
	let now = 100
	const store = createBuildFileStore({ redis: () => f.redis, now: () => now })
	assert.equal(await store.lookup("missing"), null)
	assert.equal(await store.lookup("missing"), null)
	assert.equal(f.reads(), 1)
	now += 5000
	await store.lookup("missing")
	assert.equal(f.reads(), 2)
	for (let i = 0; i < 2000; i++) await store.lookup(String(i))
	await store.lookup("missing")
	assert.equal(f.reads(), 2003)
})
test("failed and timed out reads are retried; unavailable publishes fail", async () => {
	for (const timeout of [false, true]) {
		let reads = 0
		const store = createBuildFileStore({
			redis: () => ({
				async getBuffer() {
					reads++
					if (timeout) return new Promise<never>(() => {})
					throw new Error("offline")
				},
				async setex() {
					throw new Error("offline")
				},
			}),
			readTimeoutMs: 1,
		})
		assert.equal(await store.lookup("a"), null)
		assert.equal(await store.lookup("a"), null)
		assert.equal(reads, 2)
		assert.equal(store.stats().errors, 2)
	}
	assert.deepEqual(
		await createBuildFileStore({ redis: () => null }).publish([
			{ path: "a", urlPath: "a", encoding: "identity", size: 1 },
		]),
		{ written: 0, skipped: 0, failed: 1 },
	)
})
test("concurrent lookups share a read and only 32 paths can read at once", async () => {
	const f = fixture()
	let resolve!: (value: Buffer | null) => void
	let reads = 0
	const value = new Promise<Buffer | null>((r) => {
		resolve = r
	})
	const store = createBuildFileStore({
		redis: () => ({
			...f.redis,
			getBuffer() {
				reads++
				return value
			},
		}),
	})
	const first = store.lookup("a")
	const second = store.lookup("a")
	const others = Array.from({ length: 31 }, (_, i) => store.lookup(String(i)))
	assert.equal(await store.lookup("overflow"), null)
	assert.equal(reads, 32)
	resolve(Buffer.from([0, 42]))
	assert.equal(await first, await second)
	await Promise.all(others)
})
test("corrupt and oversized values are rejected", async () => {
	const f = fixture()
	const store = createBuildFileStore({ redis: () => f.redis })
	for (const value of [
		Buffer.alloc(0),
		Buffer.from([2, 1]),
		Buffer.from([1, 42]),
		Buffer.alloc(BUILD_FILE_MAX_BYTES + 2),
		Buffer.concat([
			Buffer.from([1]),
			brotliCompressSync(Buffer.alloc(16 * 1024 * 1024 + 1)),
		]),
	]) {
		f.values.set(`${BUILD_FILE_PREFIX}bad`, value)
		assert.equal(await store.lookup("bad"), null)
	}
	assert.equal(store.stats().errors, 5)
})
test("memory cache evicts least recently used bytes, including Brotli", async () => {
	const f = fixture()
	for (const path of ["a", "b", "c"])
		f.values.set(BUILD_FILE_PREFIX + path, Buffer.from([0, 1, 2]))
	const store = createBuildFileStore({
		redis: () => f.redis,
		memoryMaxBytes: 4,
	})
	await store.lookup("a")
	await store.lookup("b")
	await store.lookup("a")
	await store.lookup("c")
	await store.lookup("a")
	assert.equal(f.reads(), 3)
	await store.lookup("b")
	assert.equal(f.reads(), 4)
	const br = brotliCompressSync(Buffer.from("abc"))
	f.values.set(`${BUILD_FILE_PREFIX}br`, Buffer.concat([Buffer.from([1]), br]))
	await store.lookup("br")
	await store.lookup("br")
	assert.equal(f.reads(), 6)
})
test("build paths accept only raw filenames with supported extensions", () => {
	for (const path of [
		"/assets/root-AbCd1234.js",
		"/assets/_font-123.woff2",
		"/assets/a~b.css",
	])
		assert.equal(isBuildFilePath(path, "/assets/", contentTypes), true, path)
	for (const path of [
		"/assets/../a.js",
		"/assets/a..js",
		"/assets/%61.js",
		"/assets/a.js?x=1",
		"/other/a.js",
		"/assets/a.map",
		"/assets/a.br",
		"/assets/a.gz",
		"/assets/a.html",
		"/assets/sub/a.js",
		"/assets/a.exe",
		`/assets/${"a".repeat(200)}.js`,
	])
		assert.equal(isBuildFilePath(path, "/assets/", contentTypes), false, path)
})

test("publish limits concurrent writes and contains write timeouts", async (t) => {
	const directory = await mkdtemp(join(tmpdir(), "build-publish-"))
	t.after(() => rm(directory, { recursive: true, force: true }))
	const path = join(directory, "file")
	await writeFile(path, "body")
	const files = Array.from({ length: 17 }, (_, i) => ({
		path,
		urlPath: String(i),
		size: 4,
		encoding: "identity" as const,
	}))
	let active = 0
	let maximum = 0
	const store = createBuildFileStore({
		redis: () => ({
			async getBuffer() {
				return null
			},
			async setex() {
				active++
				maximum = Math.max(maximum, active)
				await new Promise((resolve) => setTimeout(resolve, 5))
				active--
			},
		}),
	})
	assert.deepEqual(await store.publish(files), {
		written: 17,
		skipped: 0,
		failed: 0,
	})
	assert.equal(maximum, 8)
	const stuck = createBuildFileStore({
		redis: () => ({
			async getBuffer() {
				return null
			},
			setex() {
				return new Promise(() => {})
			},
		}),
		writeTimeoutMs: 1,
	})
	assert.deepEqual(await stuck.publish(files.slice(0, 1)), {
		written: 0,
		skipped: 0,
		failed: 1,
	})
})
