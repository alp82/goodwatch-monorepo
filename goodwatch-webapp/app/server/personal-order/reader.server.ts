import { createHash } from "node:crypto"
import { gunzipSync } from "node:zlib"
import {
	requestOrder,
	refill,
	type PersonalOrderComponents,
	type OwnShares,
} from "./order.ts"
import type { TitleSnapshot } from "../title-snapshot/snapshot.server.ts"
import type { recPersonalOrder } from "../features.server.ts"

export const PERSONAL_ORDER_MODEL_HASH =
	"e864bd47ced025f9641fdbfe041e3b7bd5717dac77f8d8d67cf26c9705feebd1"
export const PERSONAL_ORDER_REVALIDATE_MS = 45_000
export const PERSONAL_ORDER_CACHE_MS = 10 * 60_000
export const PERSONAL_ORDER_MAX_AGE_MS = 36 * 60 * 60_000
export interface PersonalOrderPayload extends PersonalOrderComponents {
	format: 1
	modelHash: string
	snapshotVersion: string
	builtAt: string
	ownShares: OwnShares
	othersCount: number
	othersRatingsCount: number
}
export interface PersonalOrderPreparedPayload
	extends Omit<PersonalOrderPayload, keyof PersonalOrderComponents> {
	pointIds: Float64Array
	ownTasteRank: Float32Array
	pooledRatingTopHalf: Uint8Array
	// Preserve format-1 negative sentinels and safe integer franchise ids exactly.
	movieSeriesId: Float64Array
	show: Uint8Array
	animation: Uint8Array
}
export interface PersonalOrderPrepared {
	member: string
	payload: PersonalOrderPreparedPayload
	/** Payload index per snapshot row; -1 for unrated candidates outside the offline pool. */
	indices: Int32Array
}
export interface PersonalOrderRead {
	data: PersonalOrderPrepared | null
	fallbackReason: string | null
}
export interface PersonalOrderExposure {
	flag: ReturnType<typeof recPersonalOrder>
	fallbackReason: string | null
	payloadBuildTime: string | null
	modelHash: string | null
	snapshotVersion: string | null
	todayFirst100: number[] | null
	personalOrderFirst100: number[] | null
	titles: Map<number, { group: number; mixPlaced: boolean }>
}

function decode(
	raw: Buffer,
	snapshot: TitleSnapshot,
	now: number,
): PersonalOrderRead {
	let json: string
	try {
		json = gunzipSync(raw).toString("utf8")
	} catch {
		return { data: null, fallbackReason: "malformed-gzip" }
	}
	let p: PersonalOrderPayload
	try {
		p = JSON.parse(json)
	} catch {
		return { data: null, fallbackReason: "malformed-json" }
	}
	if (!p || p.format !== 1)
		return { data: null, fallbackReason: "malformed-shape" }
	if (p.modelHash !== PERSONAL_ORDER_MODEL_HASH)
		return { data: null, fallbackReason: "model-mismatch" }
	if (p.snapshotVersion !== snapshot.version)
		return { data: null, fallbackReason: "snapshot-mismatch" }
	const built = typeof p.builtAt === "string" ? Date.parse(p.builtAt) : NaN
	if (!Number.isFinite(built) || built > now)
		return { data: null, fallbackReason: "invalid-build-time" }
	if (now - built > PERSONAL_ORDER_MAX_AGE_MS)
		return { data: null, fallbackReason: "stale-payload" }
	const unit = (n: unknown) =>
		typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1
	if (
		!Array.isArray(p.pointIds) ||
		![
			p.ownTasteRank,
			p.pooledRatingTopHalf,
			p.movieSeriesId,
			p.show,
			p.animation,
		].every((a) => Array.isArray(a) && a.length === p.pointIds.length) ||
		!p.ownTasteRank.every(unit) ||
		![p.pooledRatingTopHalf, p.show, p.animation].every((a) =>
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
	const prepared: PersonalOrderPreparedPayload = {
		format: p.format,
		modelHash: p.modelHash,
		snapshotVersion: p.snapshotVersion,
		builtAt: p.builtAt,
		ownShares: p.ownShares,
		othersCount: p.othersCount,
		othersRatingsCount: p.othersRatingsCount,
		pointIds: Float64Array.from(p.pointIds),
		ownTasteRank: Float32Array.from(p.ownTasteRank),
		pooledRatingTopHalf: Uint8Array.from(p.pooledRatingTopHalf, Number),
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
export function createPersonalOrderReader(
	get: (key: string) => Promise<Buffer | null>,
	now = () => Date.now(),
) {
	const cache = new Map<
		string,
		{ checked: number; expires: number; result: PersonalOrderRead }
	>()
	const pending = new Map<string, Promise<PersonalOrderRead>>()
	const usable = (
		result: PersonalOrderRead,
		snapshot: TitleSnapshot,
	): PersonalOrderRead => {
		const p = result.data?.payload
		if (!p) return result
		if (p.snapshotVersion !== snapshot.version)
			return { data: null, fallbackReason: "snapshot-mismatch" }
		const built = Date.parse(p.builtAt)
		if (built > now())
			return { data: null, fallbackReason: "invalid-build-time" }
		if (now() - built > PERSONAL_ORDER_MAX_AGE_MS)
			return { data: null, fallbackReason: "stale-payload" }
		return result
	}
	return async (
		member: string,
		snapshot: TitleSnapshot,
	): Promise<PersonalOrderRead> => {
		const cached = cache.get(member)
		if (
			cached &&
			cached.expires > now() &&
			now() - cached.checked < PERSONAL_ORDER_REVALIDATE_MS
		) {
			cache.delete(member)
			cache.set(member, cached)
			return usable(cached.result, snapshot)
		}
		const active = pending.get(member)
		if (active) return usable(await active, snapshot)
		const load = async (): Promise<PersonalOrderRead> => {
			let result: PersonalOrderRead
			try {
				const raw = await get(`personal-order:v1:${member}`)
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
				expires: now() + PERSONAL_ORDER_CACHE_MS,
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
const read = createPersonalOrderReader(async (key) => {
	const { getRedisCluster } = await import("../../utils/cache")
	const redis = getRedisCluster()
	if (!redis) throw new Error("Valkey unavailable")
	return redis.getBuffer(key)
})
export async function loadPersonalOrder(
	member: string,
	snapshot: TitleSnapshot | null,
): Promise<PersonalOrderRead> {
	return snapshot
		? read(member, snapshot)
		: { data: null, fallbackReason: "snapshot-unavailable" }
}

export function personalOrderExposure(
	flag: PersonalOrderExposure["flag"],
	read: PersonalOrderRead,
): PersonalOrderExposure {
	const p = read.data?.payload
	return {
		flag,
		fallbackReason: read.fallbackReason,
		payloadBuildTime: p?.builtAt ?? null,
		modelHash: p?.modelHash ?? null,
		snapshotVersion: p?.snapshotVersion ?? null,
		todayFirst100: null,
		personalOrderFirst100: null,
		titles: new Map(),
	}
}
function composePersonalOrder(
	keys: number[],
	data: PersonalOrderPrepared,
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
	const c: PersonalOrderComponents = {
		pointIds: known,
		ownTasteRank: at.map((i) => p.ownTasteRank[i]),
		pooledRatingTopHalf: at.map((i) => Boolean(p.pooledRatingTopHalf[i])),
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
export function createPersonalOrderCache({
	maxTitles = 200_000,
	maxEntries = 40,
	maxPerMember = 4,
	now = () => Date.now(),
} = {}) {
	type Result = ReturnType<typeof composePersonalOrder>
	const cache = new Map<
		string,
		{
			data: PersonalOrderPrepared
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
		data: PersonalOrderPrepared,
		snapshot: TitleSnapshot,
		mix = true,
	): Result => {
		// Include order: franchise grouping ties and the unknown suffix retain the input's relative order.
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
		const result = composePersonalOrder(keys, data, snapshot, mix)
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
			expires: now() + PERSONAL_ORDER_CACHE_MS,
			size: keys.length,
		})
		titles += keys.length
		return result
	}
}
export const orderPersonalOrder = createPersonalOrderCache()

// Preserve Watch next's fit/time/Not tonight groups. Only fitting, non-passed titles receive the mix.
export function mixPersonalOrderFitting(
	keys: number[],
	data: PersonalOrderPrepared,
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
export function logPersonalOrder(
	member: string,
	surface: string,
	exposure: PersonalOrderExposure,
	today: number[],
	personalOrder?: number[],
) {
	if (exposure.fallbackReason && exposure.fallbackReason !== "missing-payload")
		console.warn("Personal order fallback", {
			member,
			surface,
			reason: exposure.fallbackReason,
		})
	if (exposure.flag.shadow && personalOrder) {
		const first = new Set(today.slice(0, 30))
		console.info("Personal order shadow", {
			member,
			surface,
			overlap30: personalOrder.slice(0, 30).filter((k) => first.has(k)).length,
			compared: Math.min(30, today.length),
			builtAt: exposure.payloadBuildTime,
		})
	}
}
