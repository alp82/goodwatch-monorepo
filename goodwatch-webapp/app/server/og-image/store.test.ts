import "react"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
const { createOgStore, CACHE_PREFIX, STORE_SECONDS, FRESH_MS } = await import(
	"./store.server.ts"
)
const { CardRendererBusyError } = await import(
	"../card-renderer/pool.server.ts"
)
const image = Buffer.from("jpeg")
const path = "/movie/603"
const canonical = (path: string) =>
	path === "/invalid" ? null : path.replace(/\/$/, "")
function fixture() {
	const values = new Map<string, Buffer>()
	const writes: { key: string; seconds: number; value: Buffer }[] = []
	let reads = 0
	const redis = {
		async getBuffer(key: string) {
			reads++
			return values.get(key) ?? null
		},
		async setex(key: string, seconds: number, value: Buffer) {
			writes.push({ key, seconds, value })
			values.set(key, value)
		},
	}
	return { redis, values, writes, reads: () => reads }
}
function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((r) => {
		resolve = r
	})
	return { promise, resolve }
}
test("versioned key, binary header, expiry, store hit fills memory", async () => {
	const f = fixture()
	const count: string[] = []
	const deps = {
		redis: () => f.redis,
		canonical,
		render: async () => image,
		now: () => 123456,
		count: (r: string) => count.push(r),
	}
	const first = await createOgStore(deps).getOgImage(path)
	assert.equal(first.status, "ok")
	if (first.status === "ok") assert.equal(first.source, "rendered")
	assert.equal(CACHE_PREFIX + path, "og-card:v1:/movie/603")
	assert.equal(f.writes[0].key, "og-card:v1:/movie/603")
	assert.equal(f.writes[0].seconds, 7 * 24 * 60 * 60)
	assert.equal(STORE_SECONDS, f.writes[0].seconds)
	assert.equal(f.writes[0].value.readBigUInt64BE(), BigInt(123456))
	assert.deepEqual(f.writes[0].value.subarray(8), image)
	const store = createOgStore(deps)
	assert.deepEqual(await store.getOgImage(path), { ...first, source: "store" })
	const reads = f.reads()
	assert.deepEqual(await store.getOgImage(path), { ...first, source: "memory" })
	assert.equal(f.reads(), reads)
	assert.deepEqual(count, ["rendered", "store", "memory"])
})
test("stale served while one redraw runs, failures preserve old image", async () => {
	const f = fixture()
	let now = 100
	let renders = 0
	let render = async () => image
	const store = createOgStore({
		redis: () => f.redis,
		canonical,
		now: () => now,
		render: () => {
			renders++
			return render()
		},
	})
	await store.getOgImage(path)
	now += FRESH_MS + 1
	const pending = deferred<Buffer>()
	render = () => pending.promise
	const hits = await Promise.all([
		store.getOgImage(path),
		store.getOgImage(path),
	])
	assert.equal(renders, 2)
	assert.equal(hits[0].status, "ok")
	for (const hit of hits) {
		assert.equal(hit.status, "ok")
		if (hit.status === "ok") assert.equal(hit.source, "stale")
	}
	pending.resolve(Buffer.from("new"))
	await new Promise((r) => setImmediate(r))
	now += FRESH_MS + 1
	render = async () => {
		throw new Error("unavailable")
	}
	const old = await store.getOgImage(path)
	await new Promise((r) => setImmediate(r))
	assert.equal(old.status, "ok")
	if (old.status === "ok") assert.equal(old.image.toString(), "new")
})
test("read and write errors are contained; every write expires", async () => {
	const store = createOgStore({
		canonical,
		redis: () => ({
			async getBuffer() {
				throw new Error("read")
			},
			async setex() {
				throw new Error("write")
			},
		}),
		render: async () => image,
	})
	assert.equal((await store.getOgImage(path)).status, "ok")
})
test("concurrent canonical requests share render; wait timeout keeps storing", async () => {
	const f = fixture()
	const pending = deferred<Buffer>()
	let calls = 0
	const store = createOgStore({
		redis: () => f.redis,
		canonical,
		render: () => {
			calls++
			return pending.promise
		},
	})
	const first = store.getOgImage(path, { waitMs: 1 })
	const second = store.getOgImage(`${path}/`, { waitMs: 1 })
	assert.deepEqual(await first, { status: "busy" })
	assert.deepEqual(await second, { status: "busy" })
	assert.equal(calls, 1)
	pending.resolve(image)
	await new Promise((r) => setImmediate(r))
	assert.equal(f.writes.length, 1)
	assert.equal((await store.getOgImage(path)).status, "ok")
})
test("missing, queue full, failed outcomes counted once", async () => {
	for (const [status, render] of [
		["missing", async () => null],
		[
			"busy",
			async () => {
				throw new CardRendererBusyError()
			},
		],
		[
			"failed",
			async () => {
				throw new Error("render")
			},
		],
	] as const) {
		const counts: string[] = []
		const store = createOgStore({
			canonical,
			redis: () => null,
			render,
			count: (r) => counts.push(r),
		})
		assert.deepEqual(await store.getOgImage(path), { status })
		assert.deepEqual(counts, [status])
	}
	const store = createOgStore({
		canonical,
		redis: () => null,
		render: async () => {
			throw new Error("unexpected")
		},
	})
	assert.deepEqual(await store.getOgImage("/invalid"), { status: "missing" })
})
test("stuck Redis operations are bounded", async () => {
	const store = createOgStore({
		canonical,
		redisTimeoutMs: 1,
		redis: () => ({
			getBuffer: () => new Promise(() => {}),
			setex: () => new Promise(() => {}),
		}),
		render: async () => image,
	})
	assert.equal((await store.getOgImage(path)).status, "ok")
})
