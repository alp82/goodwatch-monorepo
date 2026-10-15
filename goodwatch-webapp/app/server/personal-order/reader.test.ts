import assert from "node:assert/strict"
import { test } from "node:test"
import { gzipSync } from "node:zlib"
import {
	createPersonalOrderReader,
	createPersonalOrderCache,
	PERSONAL_ORDER_MODEL_HASH,
	PERSONAL_ORDER_CACHE_MS,
	PERSONAL_ORDER_REVALIDATE_MS,
	logPersonalOrder,
	personalOrderExposure,
	PERSONAL_ORDER_MAX_AGE_MS,
	orderPersonalOrder,
	type PersonalOrderPayload,
} from "./reader.server.ts"
import { resolveRecPersonalOrder } from "../../utils/features.ts"
import type { TitleSnapshot } from "../title-snapshot/snapshot.server.ts"
const NOW = Date.parse("2026-10-14T12:00:00Z")
const keys = [1e12 + 1, 1e12 + 2, 2e12 + 3]
const snapshot = {
	version: "snap-1",
	count: 3,
	rowOf: (key: number) => keys.indexOf(key),
} as TitleSnapshot
const payload = (): PersonalOrderPayload => ({
	format: 1,
	modelHash: PERSONAL_ORDER_MODEL_HASH,
	snapshotVersion: "snap-1",
	builtAt: new Date(NOW).toISOString(),
	pointIds: keys,
	ownTasteRank: [0.3, 0.8, 0.6],
	pooledRatingTopHalf: [false, true, true],
	movieSeriesId: [-1, -1, -1],
	show: [false, false, true],
	animation: [false, false, false],
	ownShares: null,
	othersCount: 2,
	othersRatingsCount: 8,
})

test("a warm reader cannot keep a payload beyond the 36-hour freshness limit", async () => {
	let now = NOW + PERSONAL_ORDER_MAX_AGE_MS - 1_000
	const read = createPersonalOrderReader(
		async () => gzipSync(JSON.stringify(payload())),
		() => now,
	)
	assert.ok((await read("owner", snapshot)).data)
	now += 2_000 // The reader is still inside its ten-minute mapping TTL.
	assert.equal((await read("owner", snapshot)).fallbackReason, "stale-payload")
})

test("composed orders reuse metadata and isolate candidate order, mix, member, snapshot and payload identity", async () => {
	let raw = JSON.stringify(payload()),
		now = NOW
	const read = createPersonalOrderReader(
		async () => gzipSync(raw),
		() => now,
	)
	const a = (await read("owner", snapshot)).data!
	const order = createPersonalOrderCache({ now: () => now })
	const first = order(keys, a, snapshot)
	assert.equal(order([...keys], a, snapshot), first)
	assert.notEqual(order([...keys].reverse(), a, snapshot), first)
	assert.notEqual(order(keys.slice(1), a, snapshot), first)
	assert.notEqual(order(keys, a, snapshot, false), first)
	assert.notEqual(
		order(keys, (await read("other", snapshot)).data!, snapshot),
		first,
	)
	assert.notEqual(order(keys, a, { ...snapshot, version: "other" }), first)
	raw = JSON.stringify({ ...payload(), ownTasteRank: [0.9, 0.1, 0.2] })
	now += PERSONAL_ORDER_REVALIDATE_MS
	assert.notEqual(
		order(keys, (await read("owner", snapshot)).data!, snapshot),
		first,
	)
	now += PERSONAL_ORDER_CACHE_MS
	assert.notEqual(order(keys, a, snapshot), first)
	// Even a warm mapping is rejected after its payload ages out.
	now = NOW + PERSONAL_ORDER_MAX_AGE_MS + 1
	assert.equal((await read("owner", snapshot)).fallbackReason, "stale-payload")
})

test("composed cache bounds total titles, variants and entries", async () => {
	const a = (
		await createPersonalOrderReader(
			async () => gzipSync(JSON.stringify(payload())),
			() => NOW,
		)("owner", snapshot)
	).data!
	for (const limits of [
		{ maxTitles: 3 },
		{ maxEntries: 1 },
		{ maxPerMember: 1 },
	]) {
		const order = createPersonalOrderCache(limits)
		const first = order(keys, a, snapshot)
		order(keys.slice(1), a, snapshot)
		assert.notEqual(order(keys, a, snapshot), first)
	}
	const order = createPersonalOrderCache({ maxTitles: 2 })
	assert.notEqual(order(keys, a, snapshot), order(keys, a, snapshot))
})

test("modes are closed by default; preview and shadow only resolve for listed members", () => {
	for (const mode of [undefined, "off", "typo"])
		assert.deepEqual(resolveRecPersonalOrder(mode, "owner", "owner"), {
			mode: "off",
			enabled: false,
			shadow: false,
		})
	assert.equal(
		resolveRecPersonalOrder("preview", " owner,other ", "owner").enabled,
		true,
	)
	assert.equal(
		resolveRecPersonalOrder("preview", "owner", "stranger").enabled,
		false,
	)
	assert.equal(resolveRecPersonalOrder("shadow", "owner", "owner").shadow, true)
	assert.equal(
		resolveRecPersonalOrder("shadow", "owner", "stranger").shadow,
		false,
	)
	assert.equal(resolveRecPersonalOrder("on", "", "stranger").enabled, true)
	assert.equal(resolveRecPersonalOrder("on", "owner", null).enabled, false)
})
test("gzip decode uses typed arrays; revalidation bounds GETs and observes publishes and deletion", async () => {
	let now = NOW,
		raw: Buffer | null = gzipSync(JSON.stringify(payload())),
		gets = 0
	const read = createPersonalOrderReader(
		async (key) => {
			assert.equal(key, "personal-order:v1:owner")
			gets++
			return raw
		},
		() => now,
	)
	const a = await read("owner", snapshot)
	assert.deepEqual(Array.from(a.data!.indices), [0, 1, 2])
	const p = a.data!.payload
	assert.ok(p.pointIds instanceof Float64Array)
	assert.ok(p.ownTasteRank instanceof Float32Array)
	assert.ok(p.pooledRatingTopHalf instanceof Uint8Array)
	assert.ok(p.movieSeriesId instanceof Float64Array)
	assert.ok(p.show instanceof Uint8Array)
	assert.ok(p.animation instanceof Uint8Array)
	assert.deepEqual(Array.from(p.movieSeriesId), [-1, -1, -1])
	assert.equal("raw" in a.data!, false)
	raw = gzipSync(
		JSON.stringify({ ...payload(), ownTasteRank: [0.9, 0.1, 0.2] }),
	)
	now += PERSONAL_ORDER_REVALIDATE_MS - 1
	assert.equal((await read("owner", snapshot)).data, a.data)
	assert.equal(gets, 1)
	// A snapshot switch fails closed even inside the revalidation window.
	assert.equal(
		(await read("owner", { ...snapshot, version: "snap-2" })).fallbackReason,
		"snapshot-mismatch",
	)
	assert.equal(gets, 1)
	now++
	const b = await read("owner", snapshot)
	assert.notEqual(b.data, a.data)
	assert.equal(gets, 2)
	raw = null
	assert.equal((await read("owner", snapshot)).data, b.data)
	now += PERSONAL_ORDER_REVALIDATE_MS
	assert.equal(
		(await read("owner", snapshot)).fallbackReason,
		"missing-payload",
	)
	assert.equal(gets, 3)
	await read("owner", snapshot)
	assert.equal(gets, 3) // Missing values are negatively cached too.
	raw = gzipSync(JSON.stringify(payload()))
	now += PERSONAL_ORDER_REVALIDATE_MS
	assert.ok((await read("owner", snapshot)).data)
	assert.equal(gets, 4)
})

test("concurrent cold and revalidation reads coalesce", async () => {
	let gets = 0,
		now = NOW
	const read = createPersonalOrderReader(
		async () => {
			gets++
			await new Promise((resolve) => setImmediate(resolve))
			return gzipSync(JSON.stringify(payload()))
		},
		() => now,
	)
	for (let round = 0; round < 2; round++) {
		const results = await Promise.all(
			Array.from({ length: 10 }, () => read("owner", snapshot)),
		)
		assert.ok(results[0].data)
		assert.ok(results.every((r) => r.data === results[0].data))
		assert.equal(gets, round + 1)
		now += PERSONAL_ORDER_REVALIDATE_MS
	}
})

test("prepared cache evicts the least recently used member at 50 entries", async () => {
	const calls: string[] = []
	const read = createPersonalOrderReader(
		async (key) => {
			calls.push(key)
			return gzipSync(JSON.stringify(payload()))
		},
		() => NOW,
	)
	const first = (await read("0", snapshot)).data
	for (let i = 1; i < 50; i++) await read(String(i), snapshot)
	await read("0", snapshot)
	await read("50", snapshot)
	assert.equal((await read("0", snapshot)).data, first)
	await read("1", snapshot)
	assert.equal(calls.length, 52)
	assert.equal(calls.at(-1), "personal-order:v1:1")
})

test("uncompressed v1 JSON and corrupt gzip fail closed; missing payload does not warn", async (t) => {
	for (const raw of [
		Buffer.from(JSON.stringify(payload())),
		Buffer.from("bad gzip"),
	]) {
		const read = createPersonalOrderReader(
			async () => raw,
			() => NOW,
		)
		assert.equal(
			(await read("owner", snapshot)).fallbackReason,
			"malformed-gzip",
		)
	}
	const warn = t.mock.method(console, "warn", () => {})
	const flag = resolveRecPersonalOrder("on", "", "owner")
	logPersonalOrder(
		"owner",
		"discover",
		personalOrderExposure(flag, {
			data: null,
			fallbackReason: "missing-payload",
		}),
		[],
	)
	assert.equal(warn.mock.callCount(), 0)
	logPersonalOrder(
		"owner",
		"discover",
		personalOrderExposure(flag, {
			data: null,
			fallbackReason: "model-mismatch",
		}),
		[],
	)
	assert.equal(warn.mock.callCount(), 1)
})
test("bad shape/model/snapshot/age/id mapping and backend failure fall back", async () => {
	const cases: [unknown, string][] = [
		["bad json", "malformed-json"],
		[null, "malformed-shape"],
		[{ ...payload(), modelHash: "old" }, "model-mismatch"],
		[{ ...payload(), snapshotVersion: "old" }, "snapshot-mismatch"],
		[{ ...payload(), builtAt: "bad" }, "invalid-build-time"],
		[
			{ ...payload(), builtAt: new Date(NOW + 1).toISOString() },
			"invalid-build-time",
		],
		[
			{
				...payload(),
				builtAt: new Date(NOW - PERSONAL_ORDER_MAX_AGE_MS - 1).toISOString(),
			},
			"stale-payload",
		],
		[{ ...payload(), ownTasteRank: [NaN, 0.8, 0.6] }, "malformed-shape"],
		[{ ...payload(), pooledRatingTopHalf: [1, true, true] }, "malformed-shape"],
		[{ ...payload(), animation: [] }, "malformed-shape"],
		[{ ...payload(), ownShares: [2, 0] }, "malformed-shape"],
		[
			{ ...payload(), pointIds: [keys[1], keys[1], keys[2]] },
			"malformed-point-ids",
		],
		[
			{ ...payload(), pointIds: [keys[0], keys[1], 2e12 + 99] },
			"unmappable-point-id",
		],
	]
	for (const [p, reason] of cases) {
		const read = createPersonalOrderReader(
			async () => gzipSync(typeof p === "string" ? p : JSON.stringify(p)),
			() => NOW,
		)
		assert.deepEqual(await read("owner", snapshot), {
			data: null,
			fallbackReason: reason,
		})
	}
	assert.equal(
		(
			await createPersonalOrderReader(async () => {
				throw Error("offline")
			})("owner", snapshot)
		).fallbackReason,
		"valkey-read-failed",
	)
})
test("titles outside the payload follow the keyed titles in today's relative order", async () => {
	const p = payload()
	p.pointIds = [keys[0]]
	p.ownTasteRank = [0.3]
	p.pooledRatingTopHalf = [false]
	p.movieSeriesId = [-1]
	p.show = [false]
	p.animation = [false]
	const read = await createPersonalOrderReader(
		async () => gzipSync(JSON.stringify(p)),
		() => NOW,
	)("owner", snapshot)
	assert.deepEqual(
		orderPersonalOrder([keys[2], keys[0], keys[1]], read.data!, snapshot).keys,
		[keys[0], keys[2], keys[1]],
	)
})
