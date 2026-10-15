import { createHash } from "node:crypto"
import { gunzipSync } from "node:zlib"
import {
	requestOrder,
	refill,
	type G1Components,
	type OwnShares,
} from "./order.ts"
import type { TitleSnapshot } from "../title-snapshot/snapshot.server.ts"
import type { recG1Order } from "../features.server.ts"

export const G1_MODEL_HASH =
	"e864bd47ced025f9641fdbfe041e3b7bd5717dac77f8d8d67cf26c9705feebd1"
export const G1_REVALIDATE_MS = 45_000
export const G1_CACHE_MS = 10 * 60_000
export const G1_MAX_AGE_MS = 36 * 60 * 60_000
export interface G1Payload extends G1Components {
	format: 1
	modelHash: string
	snapshotVersion: string
	builtAt: string
	ownShares: OwnShares
	othersCount: number
	othersRatingsCount: number
}
export interface G1PreparedPayload extends Omit<G1Payload, keyof G1Components> {
	pointIds: Float64Array
	b3Rank: Float32Array
	b5TopHalf: Uint8Array
	// Preserve format-1 negative sentinels and safe integer franchise ids exactly.
	movieSeriesId: Float64Array
	show: Uint8Array
	animation: Uint8Array
}
export interface G1Prepared {
	member: string
	payload: G1PreparedPayload
	/** Payload index per snapshot row; -1 for unrated candidates outside the offline pool. */
	indices: Int32Array
}
export interface G1Read {
	data: G1Prepared | null
	fallbackReason: string | null
}
export interface G1Exposure {
	flag: ReturnType<typeof recG1Order>
	fallbackReason: string | null
	payloadBuildTime: string | null
	modelHash: string | null
	snapshotVersion: string | null
	todayFirst100: number[] | null
	g1First100: number[] | null
	titles: Map<number, { group: number; mixPlaced: boolean }>
}

function decode(raw: Buffer, snapshot: TitleSnapshot, now: number): G1Read {
	let json: string
	try {
		json = gunzipSync(raw).toString("utf8")
	} catch {
		return { data: null, fallbackReason: "malformed-gzip" }
	}
	let p: G1Payload
	try {
		p = JSON.parse(json)
	} catch {
		return { data: null, fallbackReason: "malformed-json" }
	}
	if (!p || p.format !== 1)
		return { data: null, fallbackReason: "malformed-shape" }
	if (p.modelHash !== G1_MODEL_HASH)
		return { data: null, fallbackReason: "model-mismatch" }
	if (p.snapshotVersion !== snapshot.version)
		return { data: null, fallbackReason: "snapshot-mismatch" }
	const built = typeof p.builtAt === "string" ? Date.parse(p.builtAt) : NaN
	if (!Number.isFinite(built) || built > now)
		return { data: null, fallbackReason: "invalid-build-time" }
	if (now - built > G1_MAX_AGE_MS)
		return { data: null, fallbackReason: "stale-payload" }
	const unit = (n: unknown) =>
		typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1
	if (
		!Array.isArray(p.pointIds) ||
		![p.b3Rank, p.b5TopHalf, p.movieSeriesId, p.show, p.animation].every(
			(a) => Array.isArray(a) && a.length === p.pointIds.length,
		) ||
		!p.b3Rank.every(unit) ||
		![p.b5TopHalf, p.show, p.animation].every((a) =>
			a.every((v) => typeof v === "boolean"),
		) ||
		!p.movieSeriesId.every(Number.isSafeInteger) ||
		!(
			p.ownShares === null ||
			(Array.isArray(p.ownShares) &&
				p.ownShares.length === 2 &&
				p.ownShares.every(unit))
		) ||
		![p.othersCount, p.othersRatingsCount].every(
			(n) => Number.isSafeInteger(n) && n >= 0,
		)
	)
		return { data: null, fallbackReason: "malformed-shape" }
	const indices = new Int32Array(snapshot.count).fill(-1)
	for (let i = 0; i < p.pointIds.length; i++) {
		const key = p.pointIds[i]
		if (
			!Number.isSafeInteger(key) ||
			!((key > 1e12 && key < 2e12) || (key > 2e12 && key < 3e12)) ||
			(i > 0 && key <= p.pointIds[i - 1])
		)
			return { data: null, fallbackReason: "malformed-point-ids" }
		const row = snapshot.rowOf(key)
		if (row < 0) return { data: null, fallbackReason: "unmappable-point-id" }
		const isShow = key >= 2e12
		if (p.show[i] !== isShow)
			return { data: null, fallbackReason: "malformed-shape" }
		indices[row] = i
	}
	const prepared: G1PreparedPayload = {
		format: p.format,
		modelHash: p.modelHash,
		snapshotVersion: p.snapshotVersion,
		builtAt: p.builtAt,
		ownShares: p.ownShares,
		othersCount: p.othersCount,
		othersRatingsCount: p.othersRatingsCount,
		pointIds: Float64Array.from(p.pointIds),
		b3Rank: Float32Array.from(p.b3Rank),
		b5TopHalf: Uint8Array.from(p.b5TopHalf, Number),
		movieSeriesId: Float64Array.from(p.movieSeriesId),
		show: Uint8Array.from(p.show, Number),
		animation: Uint8Array.from(p.animation, Number),
	}
	return {
		data: { member: "", payload: prepared, indices },
		fallbackReason: null,
	}
}

// Cache prepared values and fallbacks, never compressed bytes, JSON strings or parsed arrays.
// Coalesce concurrent loads and revalidate at most once per 45 seconds per resident member.
export function createG1Reader(
	get: (key: string) => Promise<Buffer | null>,
	now = () => Date.now(),
) {
	const cache = new Map<
		string,
		{ checked: number; expires: number; result: G1Read }
	>()
	const pending = new Map<string, Promise<G1Read>>()
	const usable = (result: G1Read, snapshot: TitleSnapshot): G1Read => {
		const p = result.data?.payload
		if (!p) return result
		if (p.snapshotVersion !== snapshot.version)
			return { data: null, fallbackReason: "snapshot-mismatch" }
		const built = Date.parse(p.builtAt)
		if (built > now())
			return { data: null, fallbackReason: "invalid-build-time" }
		if (now() - built > G1_MAX_AGE_MS)
			return { data: null, fallbackReason: "stale-payload" }
		return result
	}
	return async (member: string, snapshot: TitleSnapshot): Promise<G1Read> => {
		const cached = cache.get(member)
		if (
			cached &&
			cached.expires > now() &&
			now() - cached.checked < G1_REVALIDATE_MS
		) {
			cache.delete(member)
			cache.set(member, cached)
			return usable(cached.result, snapshot)
		}
		const active = pending.get(member)
		if (active) return usable(await active, snapshot)
		const load = async (): Promise<G1Read> => {
			let result: G1Read
			try {
				const raw = await get(`g1:v2:${member}`)
				result = raw
					? decode(raw, snapshot, now())
					: { data: null, fallbackReason: "missing-payload" }
				if (result.data) result.data.member = member
			} catch {
				result = { data: null, fallbackReason: "valkey-read-failed" }
			}
			cache.delete(member)
			for (const [id, entry] of cache)
				if (entry.expires <= now()) cache.delete(id)
			if (cache.size >= 50) cache.delete(cache.keys().next().value!)
			cache.set(member, {
				checked: now(),
				expires: now() + G1_CACHE_MS,
				result,
			})
			return result
		}
		const promise = load()
		pending.set(member, promise)
		try {
			return usable(await promise, snapshot)
		} finally {
			pending.delete(member)
		}
	}
}
const read = createG1Reader(async (key) => {
	const { getRedisCluster } = await import("../../utils/cache")
	const redis = getRedisCluster()
	if (!redis) throw new Error("Valkey unavailable")
	return redis.getBuffer(key)
})
export async function loadG1(
	member: string,
	snapshot: TitleSnapshot | null,
): Promise<G1Read> {
	return snapshot
		? read(member, snapshot)
		: { data: null, fallbackReason: "snapshot-unavailable" }
}

export function g1Exposure(flag: G1Exposure["flag"], read: G1Read): G1Exposure {
	const p = read.data?.payload
	return {
		flag,
		fallbackReason: read.fallbackReason,
		payloadBuildTime: p?.builtAt ?? null,
		modelHash: p?.modelHash ?? null,
		snapshotVersion: p?.snapshotVersion ?? null,
		todayFirst100: null,
		g1First100: null,
		titles: new Map(),
	}
}
function composeG1(
	keys: number[],
	data: G1Prepared,
	snapshot: TitleSnapshot,
	mix = true,
) {
	const known: number[] = [],
		unknown: number[] = [],
		at: number[] = []
	for (const key of keys) {
		const row = snapshot.rowOf(key),
			i = row < 0 ? -1 : data.indices[row]
		if (i < 0) unknown.push(key)
		else {
			known.push(key)
			at.push(i)
		}
	}
	const p = data.payload
	const c: G1Components = {
		pointIds: known,
		b3Rank: at.map((i) => p.b3Rank[i]),
		b5TopHalf: at.map((i) => Boolean(p.b5TopHalf[i])),
		movieSeriesId: at.map((i) => p.movieSeriesId[i]),
		show: at.map((i) => Boolean(p.show[i])),
		animation: at.map((i) => Boolean(p.animation[i])),
	}
	const result = requestOrder(c, mix ? p.ownShares : null)
	const titles = new Map(
		known.map((key, i) => [key, { group: result.groups[i], mixPlaced: false }]),
	)
	for (const i of result.order.slice(0, result.mixCount))
		titles.get(known[i])!.mixPlaced = true
	return {
		keys: [...result.order.map((i) => known[i]), ...unknown],
		titles,
		ranks: new Map(known.map((key, i) => [key, result.rank[i]])),
	}
}

// Bound both the number of filter variants and total retained title metadata. Payload object identity
// changes on publish (including identical build times), expiry, or revalidation by the reader.
export function createG1OrderCache({
	maxTitles = 200_000,
	maxEntries = 40,
	maxPerMember = 4,
	now = () => Date.now(),
} = {}) {
	type Result = ReturnType<typeof composeG1>
	const cache = new Map<
		string,
		{
			data: G1Prepared
			result: Result
			expires: number
			size: number
		}
	>()
	let titles = 0
	const remove = (key: string) => {
		titles -= cache.get(key)!.size
		cache.delete(key)
	}
	return (
		keys: number[],
		data: G1Prepared,
		snapshot: TitleSnapshot,
		mix = true,
	): Result => {
		// Include order: F3 ties and the unknown suffix retain the input's relative order.
		const bytes = Float64Array.from(keys)
		const hash = createHash("sha256")
			.update(new Uint8Array(bytes.buffer))
			.digest("hex")
		const key = JSON.stringify([
			data.member,
			data.payload.builtAt,
			snapshot.version,
			hash,
			mix,
		])
		const cached = cache.get(key)
		if (cached && cached.data === data && cached.expires > now()) {
			cache.delete(key)
			cache.set(key, cached)
			return cached.result
		}
		if (cached) remove(key)
		const result = composeG1(keys, data, snapshot, mix)
		if (keys.length > maxTitles) return result
		for (const [id, item] of cache)
			if (
				item.expires <= now() ||
				(item.data.member === data.member && item.data !== data)
			)
				remove(id)
		const memberKeys = [...cache]
			.filter(([, item]) => item.data.member === data.member)
			.map(([id]) => id)
		while (memberKeys.length >= maxPerMember) remove(memberKeys.shift()!)
		while (cache.size >= maxEntries || titles + keys.length > maxTitles)
			remove(cache.keys().next().value!)
		cache.set(key, {
			data,
			result,
			expires: now() + G1_CACHE_MS,
			size: keys.length,
		})
		titles += keys.length
		return result
	}
}
export const orderG1 = createG1OrderCache()

// Preserve Watch next's fit/time/Not tonight groups. Only fitting, non-passed titles receive the mix.
export function mixFitting(
	keys: number[],
	data: G1Prepared,
	snapshot: TitleSnapshot,
	ranks: Map<number, number>,
) {
	const known = keys.filter((k) => ranks.has(k)),
		unknown = keys.filter((k) => !ranks.has(k))
	const at = known.map((k) => data.indices[snapshot.rowOf(k)])
	const p = data.payload
	const result = refill(
		known.map((_, i) => i),
		known.map((k) => ranks.get(k)!),
		at.map((i) => Boolean(p.show[i])),
		at.map((i) => Boolean(p.animation[i])),
		p.ownShares,
	)
	return {
		keys: [...result.order.map((i) => known[i]), ...unknown],
		placed: result.order.slice(0, result.mixCount).map((i) => known[i]),
	}
}
export function logG1(
	member: string,
	surface: string,
	exposure: G1Exposure,
	today: number[],
	g1?: number[],
) {
	if (exposure.fallbackReason && exposure.fallbackReason !== "missing-payload")
		console.warn("G1 fallback", {
			member,
			surface,
			reason: exposure.fallbackReason,
		})
	if (exposure.flag.shadow && g1) {
		const first = new Set(today.slice(0, 30))
		console.info("G1 shadow", {
			member,
			surface,
			overlap30: g1.slice(0, 30).filter((k) => first.has(k)).length,
			compared: Math.min(30, today.length),
			builtAt: exposure.payloadBuildTime,
		})
	}
}
