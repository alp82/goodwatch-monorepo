import "react"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
const { createOgStore, CACHE_PREFIX, FIRST_SECONDS, STORE_SECONDS, FRESH_MS } =
	await import("./store.server.ts")
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
	const expires: { key: string; seconds: number }[] = []
	const keys: string[] = []
	let reads = 0
	const redis = {
		async getBuffer(key: string) {
			keys.push(key)
			reads++
			return values.get(key) ?? null
		},
		async expire(key: string, seconds: number): Promise<number> {
			keys.push(key)
			expires.push({ key, seconds })
			return values.has(key) ? 1 : 0
		},
		async setex(key: string, seconds: number, value: Buffer) {
			keys.push(key)
			writes.push({ key, seconds, value })
			values.set(key, value)
		},
	}
	return { redis, values, writes, expires, keys, reads: () => reads }
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
	assert.equal(f.writes.length, 1)
	assert.equal(f.writes[0].seconds, 1800)
	assert.deepEqual(f.expires, [])
	if (first.status === "ok") assert.equal(first.kept, false)
	assert.equal(FIRST_SECONDS, f.writes[0].seconds)
	assert.equal(STORE_SECONDS, 604800)
	assert.equal(f.writes[0].value.readBigUInt64BE(), BigInt(123456))
	assert.deepEqual(f.writes[0].value.subarray(8), image)
	const store = createOgStore(deps)
	assert.deepEqual(await store.getOgImage(path), {
		...first,
		source: "store",
		kept: true,
	})
	const reads = f.reads()
	assert.deepEqual(await store.getOgImage(path), {
		...first,
		source: "memory",
		kept: true,
	})
	assert.equal(f.reads(), reads)
	assert.deepEqual(f.expires, [
		{ key: CACHE_PREFIX + path, seconds: STORE_SECONDS },
	])
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
	assert.equal(f.writes[1].seconds, STORE_SECONDS)
	const fresh = await store.getOgImage(path)
	if (fresh.status === "ok") assert.equal(fresh.kept, true)
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
			async expire() {
				return 1
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
			expire: () => new Promise(() => {}),
			getBuffer: () => new Promise(() => {}),
			setex: () => new Promise(() => {}),
		}),
		render: async () => image,
	})
	assert.equal((await store.getOgImage(path)).status, "ok")
})

const tick = () => new Promise((resolve) => setImmediate(resolve))

test("memory keeps a card once and only touches versioned keys", async () => {
	const f = fixture()
	const store = createOgStore({
		redis: () => f.redis,
		canonical,
		render: async () => image,
	})
	const first = await store.getOgImage(path)
	assert.equal(first.status, "ok")
	if (first.status === "ok") assert.equal(first.kept, false)
	assert.deepEqual(f.expires, [])
	const second = await store.getOgImage(path)
	assert.deepEqual(second, { ...first, source: "memory", kept: true })
	await store.getOgImage(path)
	assert.deepEqual(f.expires, [
		{ key: "og-card:v1:/movie/603", seconds: 604800 },
	])
	assert.equal(f.writes.length, 1)
	assert.ok(f.keys.every((key) => key.startsWith("og-card:v1:")))
})

test("keeping an evicted card writes the same bytes with the long lifetime", async () => {
	const f = fixture()
	const store = createOgStore({
		redis: () => f.redis,
		canonical,
		render: async () => image,
	})
	await store.getOgImage(path)
	f.values.clear()
	await store.getOgImage(path)
	await tick()
	assert.equal(f.expires.length, 1)
	assert.equal(f.writes.length, 2)
	assert.equal(f.writes[1].seconds, STORE_SECONDS)
	assert.deepEqual(f.writes[1].value, f.writes[0].value)
	assert.ok(f.keys.every((key) => key.startsWith(CACHE_PREFIX)))
})

for (const stuck of [false, true]) {
	test(`keep ${
		stuck ? "timeout" : "rejection"
	} answers and retries`, async () => {
		const f = fixture()
		let calls = 0
		const expire = f.redis.expire
		f.redis.expire = (key, seconds) => {
			calls++
			if (calls > 1) return expire(key, seconds)
			return stuck ? new Promise(() => {}) : Promise.reject(new Error("expire"))
		}
		const store = createOgStore({
			redis: () => f.redis,
			canonical,
			render: async () => image,
			redisTimeoutMs: 1,
		})
		await store.getOgImage(path)
		const hit = await store.getOgImage(path)
		assert.equal(hit.status, "ok")
		if (hit.status === "ok") assert.equal(hit.kept, true)
		await new Promise((resolve) => setTimeout(resolve, 10))
		assert.equal((await store.getOgImage(path)).status, "ok")
		await tick()
		assert.equal(calls, 2)
		await store.getOgImage(path)
		assert.equal(calls, 2)
	})
}

test("concurrent cold requests both get the first render without keeping", async () => {
	const f = fixture()
	const pending = deferred<Buffer>()
	let renders = 0
	const store = createOgStore({
		redis: () => f.redis,
		canonical,
		render: () => {
			renders++
			return pending.promise
		},
	})
	const first = store.getOgImage(path)
	const second = store.getOgImage(path)
	await tick()
	pending.resolve(image)
	for (const result of await Promise.all([first, second])) {
		assert.equal(result.status, "ok")
		if (result.status === "ok") {
			assert.equal(result.source, "rendered")
			assert.equal(result.kept, false)
		}
	}
	assert.equal(renders, 1)
	assert.equal(f.writes.length, 1)
	assert.equal(f.writes[0].seconds, FIRST_SECONDS)
	assert.deepEqual(f.expires, [])
})

test("lifetime overrides apply to first writes, keeps, and stale redraws", async () => {
	const f = fixture()
	let now = 100
	const store = createOgStore({
		redis: () => f.redis,
		canonical,
		render: async () => image,
		firstSeconds: 12,
		keptSeconds: 34,
		now: () => now,
	})
	await store.getOgImage(path)
	assert.equal(f.writes[0].seconds, 12)
	await store.getOgImage(path)
	assert.equal(f.expires[0].seconds, 34)
	now += FRESH_MS + 1
	await store.getOgImage(path)
	await tick()
	assert.equal(f.writes[1].seconds, 34)
})

test("a full render pool writes nothing and a later request renders for the short lifetime", async () => {
	const f = fixture()
	let busy = true
	const store = createOgStore({
		redis: () => f.redis,
		canonical,
		render: async () => {
			if (busy) throw new CardRendererBusyError()
			return image
		},
	})
	assert.deepEqual(await store.getOgImage(path), { status: "busy" })
	assert.equal(f.writes.length, 0)
	assert.equal(f.expires.length, 0)
	busy = false
	const result = await store.getOgImage(path)
	assert.equal(result.status, "ok")
	if (result.status === "ok") {
		assert.equal(result.source, "rendered")
		assert.equal(result.kept, false)
	}
	assert.equal(f.writes.length, 1)
	assert.equal(f.writes[0].seconds, FIRST_SECONDS)
	assert.deepEqual(f.expires, [])
})

test("without a cache a repeated card is answered and nothing is kept", async () => {
	const store = createOgStore({
		canonical,
		redis: () => null,
		render: async () => image,
	})
	await store.getOgImage(path)
	const second = await store.getOgImage(path)
	assert.equal(second.status, "ok")
	if (second.status === "ok") assert.equal(second.source, "memory")
})

// The share list store can't be loaded here (it imports the renderer's JSX), so this guards its source: its images
// keep their own key and their 30 days, and don't take the first-time lifetime of a page's card.
test("share list images keep their own key and lifetime", async () => {
	const source = await readFile(
		new URL("../share-card/images.server.ts", import.meta.url),
		"utf8",
	)
	assert.match(source, /const CACHE_PREFIX = "share-card:v2:"/)
	assert.match(source, /const STORE_SECONDS = 30 \* 24 \* 60 \* 60\n/)
	assert.match(source, /setex\(key, STORE_SECONDS, png\)/)
	assert.doesNotMatch(source, /FIRST_SECONDS|og-card/)
	assert.ok(!"share-card:v2:".startsWith(CACHE_PREFIX))
})
