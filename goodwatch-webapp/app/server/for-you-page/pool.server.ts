import {
	FAMILY_ORDER,
	FP_KEYS,
	type ForYouPool,
	type ForYouTaste,
	encodeFingerprints,
} from "~/domain/for-you-page/contract"
import { LIBRARY, MIN_FIT, ownRecipes } from "~/domain/for-you-page/recipes"
import { type Bundle, familyPushes } from "~/domain/for-you-page/shape"
import { rankStep } from "~/domain/taste-match"
import type { ExplorerPool } from "~/server/explorer/pool.server"
import type { Taste } from "~/server/taste/index.server"
import type { ViewerContext } from "~/server/viewer.server"

export const QUALITY_FLOOR = 63
export const MIN_ON_SERVICES = 600
export const POOL_MAX = 1500

export interface PoolInput {
	pool: Pick<ExplorerPool, "n" | "rows" | "keys" | "snapshot">
	ctx: Pick<
		ViewerContext,
		"viewer" | "services" | "seen" | "hidden" | "skipped" | "wishlist"
	>
	taste: Pick<Taste, "vector">
	tasteView: ForYouTaste | null
	/** Null means the country's availability is not loaded. */
	onServices: ((key: number) => boolean) | null
}

export function eligiblePool(input: PoolInput): {
	indices: number[]
	scope: ForYouPool["scope"]
} {
	const { pool, ctx } = input
	const indices: number[] = []
	const services: number[] = []
	for (let i = 0; i < pool.n; i++) {
		const key = pool.keys[i]
		const score = pool.snapshot.columns.scores[pool.rows[i]]
		if (
			score === 255 ||
			score < QUALITY_FLOOR ||
			ctx.seen.has(key) ||
			ctx.hidden.has(key) ||
			ctx.skipped.has(key) ||
			ctx.wishlist.has(key)
		)
			continue
		indices.push(i)
		if (
			ctx.viewer.kind === "member" &&
			ctx.services.length &&
			input.onServices?.(key)
		)
			services.push(i)
	}
	return services.length >= MIN_ON_SERVICES
		? { indices: services, scope: "services" }
		: { indices, scope: "everywhere" }
}

/** Bounded min heap; ties keep the earlier Explorer index. */
function top(indices: number[], scores: Float64Array, count: number): number[] {
	const heap: number[] = []
	const worse = (a: number, b: number) =>
		scores[a] < scores[b] || (scores[a] === scores[b] && a > b)
	for (const i of indices) {
		if (heap.length < count) {
			let at = heap.length
			heap.push(i)
			while (at > 0) {
				const parent = (at - 1) >>> 1
				if (!worse(i, heap[parent])) break
				heap[at] = heap[parent]
				at = parent
			}
			heap[at] = i
		} else if (worse(heap[0], i)) {
			let at = 0
			while (at * 2 + 1 < heap.length) {
				let child = at * 2 + 1
				if (child + 1 < heap.length && worse(heap[child + 1], heap[child]))
					child++
				if (!worse(heap[child], i)) break
				heap[at] = heap[child]
				at = child
			}
			heap[at] = i
		}
	}
	return heap.sort((a, b) => scores[b] - scores[a] || a - b)
}

/** Returns Explorer indices, without I/O or changes to the snapshot. */
export function selectPool(input: PoolInput): Int32Array {
	const { pool, taste, tasteView } = input
	const { indices } = eligiblePool(input)
	const snapshot = pool.snapshot
	const personal = tasteView?.subject !== "sample" && taste.vector !== null
	const cosines = new Float64Array(pool.n)
	let sum = 0
	let squares = 0
	if (personal && taste.vector)
		for (const i of indices) {
			const value = snapshot.cosineAt(pool.rows[i], taste.vector) ?? 0
			cosines[i] = value
			sum += value
			squares += value * value
		}
	const mean = sum / (indices.length || 1)
	const sd =
		Math.sqrt(Math.max(0, squares / (indices.length || 1) - mean * mean)) || 1
	const tasteZ = Float64Array.from(cosines, (v) =>
		personal ? (v - mean) / sd : 0,
	)
	const z = new Float32Array(pool.n * FP_KEYS.length)
	for (const i of indices) {
		const fp = snapshot.fingerprintAt(pool.rows[i])
		for (let k = 0; k < FP_KEYS.length; k++)
			z[i * FP_KEYS.length + k] =
				((fp[k] === 255 ? 0 : fp[k]) - snapshot.stats.mean[k]) /
				(snapshot.stats.sd[k] || 1)
	}
	const score = new Float64Array(pool.n)
	const quota = (attrs: Bundle, count: number) => {
		const terms = Object.entries(attrs).flatMap(([key, weight]) => {
			const k = FP_KEYS.indexOf(key as (typeof FP_KEYS)[number])
			return k < 0 ? [] : [[k, weight]]
		})
		const norm = terms.reduce((s, [, w]) => s + Math.abs(w), 0) || 1
		const ks = Int32Array.from(terms, (t) => t[0])
		const weights = Float64Array.from(terms, (t) => t[1])
		for (const i of indices) {
			let fit = 0
			const offset = i * FP_KEYS.length
			for (let t = 0; t < ks.length; t++) fit += weights[t] * z[offset + ks[t]]
			score[i] = personal
				? (0.7 * fit) / norm + 0.3 * tasteZ[i]
				: fit / norm + 0.3 * ((snapshot.columns.scores[pool.rows[i]] - 70) / 12)
		}
		return top(indices, score, count)
	}
	const recipes = [
		...LIBRARY,
		...ownRecipes(tasteView?.groups ?? []).slice(0, 5),
	].map((r) => quota(r.attrs, 40))
	const selected = new Set<number>()
	const add = (list: Iterable<number>) => {
		for (const i of list) if (selected.size < POOL_MAX) selected.add(i)
	}
	if (personal) add(top(indices, cosines, 500))
	// Reserve each recipe's minimum before filling the rest of its quota.
	for (const list of recipes) add(list.slice(0, MIN_FIT))
	for (const list of recipes) add(list)
	if (tasteView) {
		const pushes = familyPushes(tasteView)
		for (const family of FAMILY_ORDER) {
			add(quota(pushes[family].peak, 30))
			add(
				quota(
					Object.fromEntries(
						Object.entries(pushes[family].wide).map(([k, w]) => [k, -w]),
					),
					30,
				),
			)
		}
	}
	for (const i of indices) score[i] = snapshot.columns.scores[pool.rows[i]]
	add(top(indices, score, 100))
	return Int32Array.from(selected)
}

export async function getForYouPool(
	ctx: ViewerContext,
	taste: Taste,
	tasteView: ForYouTaste | null,
): Promise<ForYouPool> {
	const started = performance.now()
	const [{ getTitleSnapshot }, { explorerPool }, { countryServices }] =
		await Promise.all([
			import("~/server/title-snapshot/index.server"),
			import("~/server/explorer/pool.server"),
			import("~/server/availability-index.server"),
		])
	const snapshot = getTitleSnapshot()
	if (!snapshot) throw new Error("For you snapshot unavailable")
	const pool = await explorerPool(snapshot)
	const country =
		ctx.viewer.kind === "member" && ctx.services.length
			? countryServices(ctx.country)
			: null
	const own = new Set(
		ctx.services
			.map((id) => country?.indexOfService(id))
			.filter((id) => id !== undefined && id >= 0),
	)
	const onServices = country
		? (key: number) => {
				const row = country.rowOf(key)
				if (row < 0) return false
				for (let at = country.offsets[row]; at < country.offsets[row + 1]; at++)
					if (own.has(country.entries[at])) return true
				return false
			}
		: null
	const input = { pool, ctx, taste, tasteView, onServices }
	const indices = [...selectPool(input)]
	const rows = indices.map((i) => pool.rows[i])
	const percentiles =
		tasteView?.subject === "sample"
			? indices.map(() => null)
			: taste.percentile(indices.map((i) => pool.keys[i]))
	const c = pool.snapshot.columns
	const result: ForYouPool = {
		keys: indices.map((i) => publicKey(pool.keys[i])),
		names: indices.map((i) => pool.display[i].title),
		years: indices.map((i) => pool.display[i].year),
		posters: indices.map((i) => pool.display[i].poster),
		scores: rows.map((r) => (c.scores[r] === 255 ? -1 : c.scores[r])),
		steps: percentiles.map((p) => (p === null ? 0 : rankStep(p))),
		moods: rows.map((r) => c.moods[r]),
		themes: rows.map((r) => c.themes[r]),
		styles: rows.map((r) => c.styles[r]),
		fingerprints: encodeFingerprints(
			rows.map((r) => pool.snapshot.fingerprintAt(r)),
		),
		scope: eligiblePool(input).scope,
	}
	console.info(
		`For you pool: ${indices.length} titles, computed in ${Math.round(performance.now() - started)} ms`,
	)
	return result
}

export const publicKey = (key: number) =>
	key >= 2e12 ? `show-${key - 2e12}` : `movie-${key - 1e12}`
