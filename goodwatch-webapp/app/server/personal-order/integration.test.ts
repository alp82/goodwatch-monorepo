// Real filter and Watch next planner; all external reads/writes replaced before imports.
import ts from "typescript"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { after, mock, test } from "node:test"
import { gzipSync } from "node:zlib"
import type { ListExposureInput } from "../list-exposure.server.ts"
import type { ViewerContext } from "../viewer.server.ts"
import type { Taste } from "../taste/taste.server.ts"
import type { TitleSnapshot } from "../title-snapshot/snapshot.server.ts"
import {
	createPersonalOrderReader,
	PERSONAL_ORDER_MODEL_HASH,
	type PersonalOrderPayload,
} from "./reader.server.ts"

const state = {
	now: Date.now(),
	snapshot: null as TitleSnapshot | null,
	raw: null as string | null,
	reads: 0,
	exposures: [] as ListExposureInput[],
	taste: null as Taste | null,
}
;(
	globalThis as unknown as { personalOrderTest: typeof state }
).personalOrderTest = state
const clock = mock.method(Date, "now", () => state.now)
after(() => clock.mock.restore())
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	load(url, context, next) {
		let source: string | undefined
		if (url.endsWith("/title-snapshot/format.server.ts"))
			source = `${readFileSync(new URL(url), "utf8")}\nexport const getTitleSnapshot = () => globalThis.personalOrderTest.snapshot;`
		else if (url.endsWith("/utils/cache.ts"))
			source = `import { gzipSync } from "node:zlib"; export const getRedisCluster = () => ({ getBuffer: async key => { if (!key.startsWith("personal-order:v1:")) throw Error("Unexpected key"); globalThis.personalOrderTest.reads++; return globalThis.personalOrderTest.raw === null ? null : gzipSync(globalThis.personalOrderTest.raw) } });`
		else if (url.endsWith("/utils/crate.ts"))
			source = `export const query = () => { throw Error('Unexpected database read') };`
		else if (url.endsWith("/list-exposure.server.ts"))
			source = `export const recordListExposure = (_ctx, input) => { globalThis.personalOrderTest.exposures.push(input); return "list-1" };`
		else if (url.endsWith("/availability-index.server.ts"))
			source = `export const countryServices = () => null; export const isOnServices = (_c, _s, k) => k !== 1e12 + 4;`
		else if (url.endsWith("/title-filter/id-sets.server.ts"))
			source = `export const similarTitles = async () => new Set(); export const personTitles = similarTitles; export const legacyTitles = similarTitles; export const titlesOnServicesByColumn = similarTitles;`
		else if (url.endsWith("/title-filter/matches.server.ts"))
			source = `export const universeTaste = (_s, taste, _rows, keys) => ({ matches: Uint8Array.from(taste.match([...keys])), percentiles: Float32Array.from(taste.percentile([...keys])) });`
		else if (url.endsWith("/taste/index.server.ts"))
			source = `export const loadTaste = () => globalThis.personalOrderTest.taste;`
		else if (url.endsWith("/movie-runtimes.server.ts"))
			source = `export const movieRuntimes = () => { throw Error('Unexpected runtime read') };`
		else if (url.endsWith("/title-cards.server.ts"))
			source = `export const MAX_KEYS = 60; export const getTitleCards = keys => keys.map(key => ({ key, match: 77 })); export const getDisplayFields = () => new Map(); export const getServiceCards = () => [];`
		if (source === undefined) return next(url, context)
		return {
			format: "module",
			source: ts.transpileModule(source, {
				compilerOptions: {
					module: ts.ModuleKind.ESNext,
					target: ts.ScriptTarget.ESNext,
				},
			}).outputText,
			shortCircuit: true,
		}
	},
})
const { filterTitles } = await import("../title-filter/index.server.ts")
const { planWatchNext, getWatchNext, getWatchNextCardsPage } = await import(
	"../watch-next.server.ts"
)
const { defaultFilterState } = await import("../../domain/filter-state.ts")
const { MOOD_KEYS } = await import("../../domain/moods.ts")
const keys = [1e12 + 1, 1e12 + 2, 1e12 + 3, 1e12 + 4, 2e12 + 5, 2e12 + 6]
const snapshot = {
	version: "personalOrder-test",
	count: keys.length,
	rowOf: (k: number) => keys.indexOf(k),
	has: (k: number) => keys.includes(k),
	forEach: () => {},
	fingerprint: () => null,
	columns: {
		pointIds: Float64Array.from(keys),
		genres: new Uint32Array(6),
		genreNames: [],
		releaseDays: new Int32Array(6).fill(19000),
		votes: new Uint32Array(6).fill(1000),
		popularity: Float32Array.from([6, 5, 4, 3, 2, 1]),
		scores: new Uint8Array(6).fill(80),
		flags: new Uint8Array(6).fill(1),
		moods: new Uint16Array(6),
		themes: new Uint16Array(6),
		styles: new Uint16Array(6),
		ratings: null,
	},
	facts: (k: number) => ({
		moods: k === keys[3] ? [] : [MOOD_KEYS[0]],
		hasBackdrop: false,
		releaseDay: 19000,
		score: 80,
		popularity: 10,
	}),
} as unknown as TitleSnapshot
const taste = {
	signal: "some",
	ratings: 20,
	liked: 15,
	percentile: (ks: number[]) => ks.map((k) => 90 - keys.indexOf(k)),
	match: (ks: number[]) => ks.map(() => 77),
} as unknown as Taste
const ctx = (): ViewerContext => ({
	viewer: { kind: "member", userId: "owner" },
	country: "DE",
	services: [],
	seen: new Set(),
	skipped: new Set(),
	hidden: new Set(),
	notInterested: new Set(),
	ratings: new Map(),
	wishlist: new Map(keys.map((k) => [k, new Date(1)])),
	forYou: true,
})
const payload = (): PersonalOrderPayload => ({
	format: 1,
	modelHash: PERSONAL_ORDER_MODEL_HASH,
	snapshotVersion: snapshot.version,
	builtAt: new Date(state.now).toISOString(),
	pointIds: keys,
	ownTasteRank: [0.1, 0.9, 0.8, 0.99, 0.7, 0.6],
	pooledRatingTopHalf: [true, true, true, true, true, true],
	movieSeriesId: [1, 1, -1, -1, -1, -1],
	show: [false, false, false, false, true, true],
	animation: [false, false, false, false, false, false],
	ownShares: null,
	othersCount: 1,
	othersRatingsCount: 1,
})
const input = () => ({
	universe: "catalog" as const,
	state: defaultFilterState({ onMyServices: false, notSeenYet: false }),
	sort: "match" as const,
	taste,
	forYou: null,
	viewer: ctx(),
})
function reset() {
	state.now += 45_000
	state.snapshot = snapshot
	state.taste = taste
	state.raw = JSON.stringify(payload())
	state.reads = 0
	state.exposures = []
}

test("Discover catalogue match uses Personal order with filter-local franchise promotion, preserving card match", async () => {
	reset()
	const i = input()
	i.viewer = { ...i.viewer, hidden: new Set([keys[1]]) }
	const result = await filterTitles(i)
	assert.deepEqual(result.keys, [keys[3], keys[2], keys[4], keys[5], keys[0]])
	assert.equal(result.personalOrder!.titles.get(keys[0])!.group, 2)
	assert.deepEqual(result.personalOrder!.todayFirst100, [
		keys[0],
		keys[2],
		keys[3],
		keys[4],
		keys[5],
	])
	assert.deepEqual(
		taste.match(result.keys),
		result.keys.map(() => 77),
	)
})
test("ranked search, Explorer lists, other sorts and guests keep today's order", async () => {
	reset()
	const ranked = await filterTitles({ ...input(), universe: keys })
	assert.deepEqual(ranked.keys, keys)
	assert.equal(ranked.personalOrder, undefined)
	assert.deepEqual(
		(await filterTitles({ ...input(), universe: [keys[5], keys[0]] })).keys,
		[keys[0], keys[5]],
	)
	assert.deepEqual(
		(await filterTitles({ ...input(), sort: "popular", forYou: "browse" }))
			.keys,
		keys,
	)
	const i = input()
	i.viewer.viewer = { kind: "guest", progress: { interactions: [] } }
	assert.deepEqual((await filterTitles(i)).keys, keys)
	assert.equal(state.reads, 0)
})
test("missing payload keeps today's order and exposes its reason without warning", async () => {
	reset()
	state.raw = null
	const logs: unknown[][] = [],
		warn = console.warn
	console.warn = (...args) => logs.push(args)
	try {
		const result = await filterTitles(input())
		assert.deepEqual(result.keys, keys)
		assert.equal(result.personalOrder!.fallbackReason, "missing-payload")
		assert.equal(logs.length, 0)
	} finally {
		console.warn = warn
	}
})
test("Watch next franchise grouping precedes fit grouping and mix stays inside fitting; Not tonight stays at its end", async () => {
	reset()
	const p = payload()
	p.ownShares = [1, 0]
	const read = await createPersonalOrderReader(async () =>
		gzipSync(JSON.stringify(p)),
	)("owner", snapshot)
	const plan = planWatchNext(
		ctx(),
		taste,
		{ sort: "match", moods: [MOOD_KEYS[0]], notTonight: [keys[5]] },
		undefined,
		undefined,
		read,
	)
	const display = [
		...plan.head.map((e) => e.key),
		...plan.tiers.flatMap((t) => t.keys),
	]
	assert.deepEqual(display, [
		keys[4],
		keys[1],
		keys[2],
		keys[0],
		keys[5],
		keys[3],
	])
	assert.equal(plan.personalOrder.titles.get(keys[3])!.mixPlaced, false)
	assert.equal(plan.personalOrder.titles.get(keys[5])!.mixPlaced, false)
	assert.equal(plan.personalOrder.titles.get(keys[4])!.mixPlaced, true)
	assert.deepEqual(plan.personalOrder.todayFirst100, [
		keys[0],
		keys[1],
		keys[2],
		keys[4],
		keys[5],
		keys[3],
	])
	const top = planWatchNext(
		ctx(),
		taste,
		{ sort: "top" },
		undefined,
		undefined,
		read,
	)
	assert.equal(top.personalOrder.todayFirst100, null)
})
test("Watch next page and later batches use the reader and log actual Personal order tiers", async () => {
	reset()
	const result = await getWatchNext(ctx(), { sort: "match" }, taste)
	assert.equal(state.reads, 1)
	assert.equal(result.hero!.key, keys[3])
	assert.equal(result.listId, "list-1")
	assert.equal(state.exposures[0].ordering, "personal-order")
	assert.equal(state.exposures[0].watchNextTiers!.get(keys[3]), "hero")
	assert.deepEqual(state.exposures[0].personalOrder!.todayFirst100, keys)
	// The later-batch helper normally loads taste; supply it via the test stub here.
	const batch = await getWatchNextCardsPage(
		ctx(),
		[keys[5], keys[0]],
		{
			sort: "match",
		},
		result.planId,
	)
	assert.equal(batch.listId, "list-1")
	assert.equal(state.exposures[1].batch, "cards")
	assert.deepEqual(
		state.exposures[1].titles.map((t) => t.key),
		[keys[5], keys[0]],
	)
	assert.equal(state.exposures[1].watchNextTiers!.get(keys[0]), "upNext")
	assert.equal(state.reads, 1)
})

for (const change of ["publish", "delete"] as const) {
	test(`later cards retain initial ordering provenance after payload ${change}`, async () => {
		reset()
		const options = { sort: "match" as const }
		const initial = await getWatchNext(ctx(), options, taste)
		const original = state.exposures[0]
		state.raw =
			change === "delete"
				? null
				: JSON.stringify({
						...payload(),
						ownTasteRank: [0.99, 0.1, 0.2, 0.3, 0.4, 0.5],
						builtAt: new Date(
							Date.parse(original.personalOrder!.payloadBuildTime!) - 1_000,
						).toISOString(),
					})
		// After revalidation a new list sees the change; old lazy batches retain their plan.
		state.now += 45_000
		const warn = console.warn
		console.warn = () => {}
		try {
			await getWatchNext(ctx(), options, taste)
			const latest = state.exposures[1]
			if (change === "delete")
				assert.equal(latest.personalOrder!.fallbackReason, "missing-payload")
			else
				assert.notEqual(
					latest.personalOrder!.payloadBuildTime,
					original.personalOrder!.payloadBuildTime,
				)
			const batch = await getWatchNextCardsPage(
				ctx(),
				[keys[5], keys[0]],
				options,
				initial.planId,
			)
			assert.equal(batch.refreshRequired, false)
			assert.equal(state.exposures[2].personalOrder, original.personalOrder)
			assert.deepEqual(
				state.exposures[2].watchNextTiers,
				original.watchNextTiers,
			)
			const reads = state.reads,
				exposures = state.exposures.length
			assert.deepEqual(
				await getWatchNextCardsPage(ctx(), [keys[0]], options, "lost-plan"),
				{
					titles: [],
					listId: null,
					refreshRequired: true,
				},
			)
			const stranger = ctx()
			stranger.viewer = { kind: "member", userId: "stranger" }
			assert.equal(
				(
					await getWatchNextCardsPage(
						stranger,
						[keys[0]],
						options,
						initial.planId,
					)
				).refreshRequired,
				true,
			)
			assert.equal(
				(
					await getWatchNextCardsPage(
						ctx(),
						[keys[0]],
						{ sort: "top" },
						initial.planId,
					)
				).refreshRequired,
				true,
			)
			assert.equal(state.reads, reads)
			assert.equal(state.exposures.length, exposures)
		} finally {
			console.warn = warn
		}
	})
}

test("Watch next fitting metadata cannot mutate the shared composed order", async () => {
	reset()
	state.raw = JSON.stringify({ ...payload(), ownShares: [1, 0] })
	const read = await createPersonalOrderReader(async () =>
		state.raw === null ? null : gzipSync(state.raw),
	)("owner", snapshot)
	const { orderPersonalOrder } = await import("./reader.server.ts")
	const composed = orderPersonalOrder(keys, read.data!, snapshot, false)
	planWatchNext(ctx(), taste, { sort: "match" }, undefined, undefined, read)
	assert.ok([...composed.titles.values()].every((t) => !t.mixPlaced))
})

test("a snapshot reload while reading Personal order falls back safely", async () => {
	reset()
	const read = await createPersonalOrderReader(async () =>
		state.raw === null ? null : gzipSync(state.raw),
	)("owner", snapshot)
	state.snapshot = { ...snapshot, version: "replacement" }
	const warn = console.warn
	console.warn = () => {}
	try {
		const plan = planWatchNext(
			ctx(),
			taste,
			{ sort: "match" },
			undefined,
			undefined,
			read,
		)
		assert.equal(plan.personalOrder.fallbackReason, "snapshot-mismatch")
		assert.deepEqual(
			plan.head.map((e) => e.key),
			keys.slice(0, 4),
		)
	} finally {
		console.warn = warn
	}
})

for (const member of ["owner", "outside-former-preview"]) {
	test(`Best match uses personal order for ${member} on Discover and Watch next`, async () => {
		reset()
		const viewer = {
			...ctx(),
			viewer: { kind: "member" as const, userId: member },
		}
		const result = await filterTitles({ ...input(), viewer })
		assert.equal(result.keys[0], keys[3])
		assert.equal(result.personalOrder!.fallbackReason, null)
		const page = await getWatchNext(viewer, { sort: "match" }, taste)
		assert.equal(page.hero!.key, keys[3])
		assert.equal(state.exposures[0].ordering, "personal-order")
	})
}
