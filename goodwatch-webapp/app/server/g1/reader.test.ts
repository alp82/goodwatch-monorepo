import assert from "node:assert/strict"
import { test } from "node:test"
import {
	createG1Reader,
	G1_MODEL_HASH,
	G1_CACHE_MS,
	G1_MAX_AGE_MS,
	orderG1,
	type G1Payload,
} from "./reader.server.ts"
import { resolveRecG1 } from "../../utils/features.ts"
import type { TitleSnapshot } from "../title-snapshot/snapshot.server.ts"
const NOW = Date.parse("2026-10-14T12:00:00Z")
const keys = [1e12 + 1, 1e12 + 2, 2e12 + 3]
const snapshot = {
	version: "snap-1",
	count: 3,
	rowOf: (key: number) => keys.indexOf(key),
} as TitleSnapshot
const payload = (): G1Payload => ({
	format: 1,
	modelHash: G1_MODEL_HASH,
	snapshotVersion: "snap-1",
	builtAt: new Date(NOW).toISOString(),
	pointIds: keys,
	b3Rank: [0.3, 0.8, 0.6],
	b5TopHalf: [false, true, true],
	movieSeriesId: [-1, -1, -1],
	show: [false, false, true],
	animation: [false, false, false],
	ownShares: null,
	othersCount: 2,
	othersRatingsCount: 8,
})

test("modes are closed by default; preview and shadow only resolve for listed members", () => {
	for (const mode of [undefined, "off", "typo"])
		assert.deepEqual(resolveRecG1(mode, "owner", "owner"), {
			mode: "off",
			enabled: false,
			shadow: false,
		})
	assert.equal(resolveRecG1("preview", " owner,other ", "owner").enabled, true)
	assert.equal(resolveRecG1("preview", "owner", "stranger").enabled, false)
	assert.equal(resolveRecG1("shadow", "owner", "owner").shadow, true)
	assert.equal(resolveRecG1("shadow", "owner", "stranger").shadow, false)
	assert.equal(resolveRecG1("on", "", "stranger").enabled, true)
	assert.equal(resolveRecG1("on", "owner", null).enabled, false)
})
test("validated mapping is cached per member/build for 10 minutes; publishes, snapshots and deletes are visible", async () => {
	let now = NOW,
		raw: string | null = JSON.stringify(payload()),
		gets = 0
	const read = createG1Reader(
		async (key) => {
			assert.match(key, /^g1:v1:/)
			gets++
			return raw
		},
		() => now,
	)
	const a = await read("owner", snapshot)
	assert.deepEqual(Array.from(a.data!.indices), [0, 1, 2])
	assert.equal((await read("owner", snapshot)).data, a.data)
	assert.notEqual((await read("other", snapshot)).data, a.data)
	now += G1_CACHE_MS
	assert.notEqual((await read("owner", snapshot)).data, a.data)
	raw = JSON.stringify({ ...payload(), builtAt: new Date(now).toISOString() })
	const b = await read("owner", snapshot)
	assert.notEqual(b.data, a.data)
	assert.equal(
		(await read("owner", { ...snapshot, version: "snap-2" })).fallbackReason,
		"snapshot-mismatch",
	)
	raw = null
	assert.equal(
		(await read("owner", snapshot)).fallbackReason,
		"missing-payload",
	)
	assert.equal(gets, 7)
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
				builtAt: new Date(NOW - G1_MAX_AGE_MS - 1).toISOString(),
			},
			"stale-payload",
		],
		[{ ...payload(), b3Rank: [NaN, 0.8, 0.6] }, "malformed-shape"],
		[{ ...payload(), b5TopHalf: [1, true, true] }, "malformed-shape"],
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
		const read = createG1Reader(
			async () => (typeof p === "string" ? p : JSON.stringify(p)),
			() => NOW,
		)
		assert.deepEqual(await read("owner", snapshot), {
			data: null,
			fallbackReason: reason,
		})
	}
	assert.equal(
		(
			await createG1Reader(async () => {
				throw Error("offline")
			})("owner", snapshot)
		).fallbackReason,
		"valkey-read-failed",
	)
})
test("titles outside the payload follow the keyed titles in today's relative order", async () => {
	const p = payload()
	p.pointIds = [keys[0]]
	p.b3Rank = [0.3]
	p.b5TopHalf = [false]
	p.movieSeriesId = [-1]
	p.show = [false]
	p.animation = [false]
	const read = await createG1Reader(
		async () => JSON.stringify(p),
		() => NOW,
	)("owner", snapshot)
	assert.deepEqual(
		orderG1([keys[2], keys[0], keys[1]], read.data!, snapshot).keys,
		[keys[0], keys[2], keys[1]],
	)
})
