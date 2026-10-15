import "node-crate"
import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import type { ViewerContext } from "./viewer.server.ts"
import {
	recordListExposure,
	type ListExposureInput,
} from "./list-exposure.server.ts"
import { setCrateClientForTest } from "../utils/crate.ts"
import { TASTE_KEY_VERSION } from "./taste/version.server.ts"

const turn = () => new Promise<void>((resolve) => setImmediate(resolve))
const ctx = {
	viewer: { kind: "member", userId: "member-A" },
	country: "DE",
	services: [8, 9],
} as ViewerContext
const input = (): ListExposureInput => ({
	surface: "discover",
	ordering: "taste-v2",
	flags: {},
	sort: "popular",
	sortRequested: "match",
	forYou: true,
	forYouApplied: false,
	filters: {
		type: "movie",
		onMyServices: true,
		moods: ["funny"],
		minMatch: 80,
	},
	page: 2,
	batch: "page",
	titles: Array.from({ length: 40 }, (_, i) => ({
		key: 1e12 + i + 1,
		match: i % 2 ? 87 : null,
	})),
})

let rows: Record<string, unknown>[]
beforeEach(() => {
	rows = []
	setCrateClientForTest({
		async execute(sql, params = []) {
			assert.match(sql, /INSERT INTO user_list_exposure/)
			assert.match(sql, /ON CONFLICT \("user_id", "list_id"\)\s+DO NOTHING/)
			const columns = [...sql.split("VALUES")[0].matchAll(/"(\w+)"/g)].map(
				(m) => m[1],
			)
			rows.push(
				Object.fromEntries(columns.map((column, i) => [column, params[i]])),
			)
			return { json: [], rowcount: 1 }
		},
	})
})
afterEach(async () => {
	await turn()
	setCrateClientForTest(null)
})

test("one deferred row holds the first 30 keys, one-based positions and shown matches", async () => {
	const data = input()
	const id = recordListExposure(ctx, data)
	assert.match(id ?? "", /^[\da-f-]{36}$/)
	assert.equal(
		rows.length,
		0,
		"the caller has returned before any write starts",
	)
	await turn()
	assert.equal(rows.length, 1)
	assert.deepEqual(rows[0], {
		user_id: "member-A",
		list_id: id,
		created_at: rows[0].created_at,
		updated_at: rows[0].updated_at,
		surface: "discover",
		ordering: "taste-v2",
		ordering_flags: {},
		sort: "popular",
		sort_requested: "match",
		for_you: true,
		for_you_applied: false,
		filters: data.filters,
		country: "DE",
		services: [8, 9],
		taste_key_version: TASTE_KEY_VERSION,
		page: 2,
		batch: "page",
		title_keys: data.titles.slice(0, 30).map((t) => t.key),
		positions: Array.from({ length: 30 }, (_, i) => i + 1),
		taste_matches: data.titles.slice(0, 30).map((t) => t.match),
		personal_order_flag_mode: "off",
		personal_order_fallback_reason: null,
		personal_order_payload_build_time: null,
		personal_order_model_hash: null,
		personal_order_snapshot_version: null,
		personal_order_groups: Array(30).fill(null),
		personal_order_mix_placed: Array(30).fill(null),
		watch_next_tiers: Array(30).fill(null),
		today_first_100: null,
		personal_order_first_100: null,
	})
	assert.ok(rows[0].created_at instanceof Date)
})

test("guests schedule no writes, including a guest with ratings", async () => {
	assert.equal(
		recordListExposure(
			{ ...ctx, viewer: { kind: "guest", progress: { interactions: [] } } },
			input(),
		),
		null,
	)
	await turn()
	assert.equal(rows.length, 0)
})

test("changed sort, filters, For you, ordering and flags get separate ids and snapshots", async () => {
	const first = recordListExposure(ctx, input())
	const next = {
		...input(),
		sort: "top",
		forYou: false,
		ordering: "personal-order" as const,
		flags: { personalOrder: true },
		filters: { type: "show", onMyServices: false, minMatch: 0 },
	}
	const second = recordListExposure(ctx, next)
	assert.notEqual(first, second)
	await turn()
	assert.deepEqual(
		rows.map((r) => [
			r.sort,
			r.for_you,
			r.filters,
			r.ordering,
			r.ordering_flags,
		]),
		[
			["popular", true, input().filters, "taste-v2", {}],
			["top", false, next.filters, "personal-order", { personalOrder: true }],
		],
	)
})

test("an empty result still records the filters and empty parallel arrays", async () => {
	recordListExposure(ctx, { ...input(), titles: [] })
	await turn()
	assert.deepEqual(
		[rows[0].title_keys, rows[0].positions, rows[0].taste_matches],
		[[], [], []],
	)
})

test("a pending backend never holds the caller and a failed write is logged", async (t) => {
	const errors = t.mock.method(console, "error", () => {})
	let reject!: (error: Error) => void
	setCrateClientForTest({
		execute: () =>
			new Promise((_, fail) => {
				reject = fail
			}),
	})
	assert.ok(recordListExposure(ctx, input()))
	await turn()
	assert.equal(errors.mock.callCount(), 0)
	reject(new Error("Crate unavailable"))
	await turn()
	assert.equal(errors.mock.callCount(), 1)
	assert.equal(
		errors.mock.calls[0].arguments[0],
		"Recording list exposure failed:",
	)
})

test("an outage bounds pending writes, logs drops, and recovers once writes finish", async (t) => {
	const errors = t.mock.method(console, "error", () => {})
	const finishes: (() => void)[] = []
	setCrateClientForTest({
		execute: () =>
			new Promise((resolve) =>
				finishes.push(() => resolve({ json: [], rowcount: 1 })),
			),
	})
	for (let i = 0; i < 1000; i++)
		assert.ok(recordListExposure(ctx, { ...input(), titles: [] }))
	assert.equal(recordListExposure(ctx, input()), null)
	assert.equal(errors.mock.callCount(), 1)
	await turn()
	assert.equal(finishes.length, 1000)
	for (const finish of finishes) finish()
	await turn()
	assert.ok(recordListExposure(ctx, input()))
	await turn()
	finishes[1000]()
	await turn()
})

test("Personal order exposure metadata stays aligned to returned cards, including unkeyed titles and tier batches", async () => {
	const data = input()
	const first = data.titles[0].key
	const personalOrder = {
		flag: { mode: "preview" as const, enabled: true, shadow: false },
		fallbackReason: null,
		payloadBuildTime: "2026-10-14T12:00:00.000Z",
		modelHash: "model",
		snapshotVersion: "snapshot",
		todayFirst100: [first, data.titles[1].key],
		personalOrderFirst100: null,
		titles: new Map([[first, { group: 2, mixPlaced: true }]]),
	}
	recordListExposure(ctx, {
		...data,
		surface: "watch-next",
		ordering: "personal-order",
		flags: { REC_G1_ORDER: true },
		personalOrder,
		watchNextTiers: new Map([[first, "hero"]]),
		batch: "cards",
	})
	await turn()
	assert.equal(rows[0].personal_order_flag_mode, "preview")
	assert.equal(rows[0].personal_order_model_hash, "model")
	assert.equal(rows[0].personal_order_snapshot_version, "snapshot")
	assert.equal(
		rows[0].personal_order_payload_build_time,
		personalOrder.payloadBuildTime,
	)
	assert.equal(rows[0].personal_order_fallback_reason, null)
	assert.deepEqual(rows[0].personal_order_groups, [2, ...Array(29).fill(null)])
	assert.deepEqual(rows[0].personal_order_mix_placed, [
		true,
		...Array(29).fill(null),
	])
	assert.deepEqual(rows[0].watch_next_tiers, ["hero", ...Array(29).fill(null)])
	assert.deepEqual(rows[0].today_first_100, personalOrder.todayFirst100)
	assert.equal(rows[0].personal_order_first_100, null)
	recordListExposure(ctx, {
		...data,
		personalOrder: {
			...personalOrder,
			flag: { mode: "shadow", enabled: false, shadow: true },
			todayFirst100: null,
			personalOrderFirst100: [first],
		},
	})
	await turn()
	assert.deepEqual(rows[1].personal_order_first_100, [first])
	assert.equal(rows[1].today_first_100, null)
	recordListExposure(ctx, {
		...data,
		personalOrder: {
			...personalOrder,
			fallbackReason: "missing-payload",
			todayFirst100: null,
		},
	})
	await turn()
	assert.equal(rows[2].personal_order_fallback_reason, "missing-payload")
})
