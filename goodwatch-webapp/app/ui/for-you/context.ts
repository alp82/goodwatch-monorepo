// What every part of the For you page reads: the decoded pool, the taste, the pool statistics, the current ranking,
// and the title details that load on demand.
import { createContext, useContext } from "react"
import type {
	DecodedPool,
	ForYouDetail,
	ForYouTaste,
} from "~/domain/for-you-page/contract"
import type { PoolStats, Ranked } from "~/domain/for-you-page/rank"
import type { TitleCard } from "~/server/title-cards.server"
import { titlePath } from "~/utils/helpers"
import { titleKey } from "~/utils/title-key"

export type TasteAttribute = ForYouTaste["attributes"][number]

/** Loads the details of up to 12 titles by pool key ("movie-550"). */
export type DetailsLoader = (
	keys: string[],
	signal?: AbortSignal,
) => Promise<Record<string, ForYouDetail>>

export interface ForYouContextValue {
	pool: DecodedPool
	taste: ForYouTaste
	stats: PoolStats
	ranked: Ranked[]
	attr: (key: string) => TasteAttribute | undefined
	/** Asks for these titles' details in one batch (cached; already loaded ones are skipped). */
	prefetch: (keys: string[]) => void
	/** The cached detail of a title, without loading it. */
	detail: (key: string) => ForYouDetail | null | undefined
	/** Loads one title's detail (batched with the other requests of the same tick); the signal cancels it. */
	loadDetail: (
		key: string,
		signal?: AbortSignal,
	) => Promise<ForYouDetail | null>
}

export const ForYouContext = createContext<ForYouContextValue | null>(null)

export function useForYou(): ForYouContextValue {
	const ctx = useContext(ForYouContext)
	if (!ctx) throw new Error("useForYou outside ForYouPage")
	return ctx
}

export interface PoolTitle {
	key: string
	kind: "movie" | "show"
	tmdbId: number
	name: string
	year: number | null
	poster: string | null
	/** GoodWatch score 0-100, null when unknown. */
	score: number | null
	href: string
}

/** The pool's title at row `i`. */
export function titleAt(pool: DecodedPool, i: number): PoolTitle {
	const key = pool.keys[i]
	const dash = key.indexOf("-")
	const kind = key.slice(0, dash) === "show" ? "show" : "movie"
	const tmdbId = Number(key.slice(dash + 1))
	const name = pool.names[i]
	const score = pool.scores[i]
	return {
		key,
		kind,
		tmdbId,
		name,
		year: pool.years[i],
		poster: pool.posters[i] || null,
		score: score >= 0 ? score : null,
		href: titlePath(kind, tmdbId, name),
	}
}

/** A ranked pick as the site's poster card data (TitlePosterCard). */
export function toCard(pool: DecodedPool, r: Ranked): TitleCard {
	const t = titleAt(pool, r.index)
	return {
		key: titleKey(t.kind, t.tmdbId),
		tmdb_id: t.tmdbId,
		media_type: t.kind,
		title: t.name,
		poster_path: t.poster,
		backdrop_path: null,
		release_year: t.year,
		runtime: null,
		tagline: null,
		goodwatch_overall_score_normalized_percent: t.score,
		goodwatch_overall_score_voting_count: 1000,
		match: pool.steps[r.index] || null,
		reasons: r.reasons.map((x) => x.key) as TitleCard["reasons"],
		services: null,
		seen: false,
		wantToSee: false,
		notInterested: false,
		rating: null,
	}
}

/** The TanStack Query key of one title's detail. */
export const detailQueryKey = (key: string) => ["for-you-detail", key] as const

/** At most this many titles per details request. */
export const DETAILS_BATCH = 12

/** A details request that failed with an HTTP status (401 once the session has ended). */
export class DetailsError extends Error {
	constructor(readonly status: number) {
		super(`Details failed: ${status}`)
		this.name = "DetailsError"
	}
}

/** True for a failure that asking again won't fix: the session has ended. */
export const isSignedOut = (error: unknown) =>
	error instanceof DetailsError && error.status === 401

/** The details query's options, shared by the detail views and the prefetches. A 401 is not retried. */
export function detailQuery(
	key: string,
	loadDetail: ForYouContextValue["loadDetail"],
) {
	return {
		queryKey: detailQueryKey(key),
		queryFn: ({ signal }: { signal: AbortSignal }) => loadDetail(key, signal),
		retry: (failures: number, error: unknown) =>
			!isSignedOut(error) && failures < 3,
	}
}

const aborted = (signal: AbortSignal) =>
	signal.reason ?? new DOMException("Aborted", "AbortError")

/**
 * Collects the detail requests made in one tick into requests of up to 12 titles. A request whose signal aborts
 * leaves its batch (or the queue); a batch whose requests have all left aborts its fetch.
 */
export function detailBatcher(load: DetailsLoader) {
	type Batch = { controller: AbortController; waiters: Set<Waiter> }
	type Waiter = {
		resolve: (d: ForYouDetail | null) => void
		reject: (e: unknown) => void
		batch: Batch | null
	}
	let queue = new Map<string, Waiter[]>()
	let timer: ReturnType<typeof setTimeout> | null = null
	const flush = () => {
		timer = null
		const all = [...queue]
		queue = new Map()
		for (let at = 0; at < all.length; at += DETAILS_BATCH) {
			const part = all.slice(at, at + DETAILS_BATCH)
			const batch: Batch = {
				controller: new AbortController(),
				waiters: new Set(part.flatMap(([, waiters]) => waiters)),
			}
			for (const w of batch.waiters) w.batch = batch
			load(
				part.map(([key]) => key),
				batch.controller.signal,
			).then(
				(found) => {
					for (const [key, waiters] of part)
						for (const w of waiters) w.resolve(found[key] ?? null)
				},
				(error) => {
					for (const [, waiters] of part)
						for (const w of waiters) w.reject(error)
				},
			)
		}
	}
	const leave = (key: string, w: Waiter) => {
		if (w.batch) {
			const { batch } = w
			batch.waiters.delete(w)
			if (batch.waiters.size === 0) batch.controller.abort()
			return
		}
		const waiters = queue.get(key)?.filter((x) => x !== w) ?? []
		if (waiters.length) queue.set(key, waiters)
		else queue.delete(key)
		if (queue.size === 0 && timer) {
			clearTimeout(timer)
			timer = null
		}
	}
	return (key: string, signal?: AbortSignal) =>
		new Promise<ForYouDetail | null>((resolve, reject) => {
			if (signal?.aborted) return reject(aborted(signal))
			const w: Waiter = { resolve, reject, batch: null }
			const waiters = queue.get(key) ?? []
			waiters.push(w)
			queue.set(key, waiters)
			timer ??= setTimeout(flush, 0)
			signal?.addEventListener(
				"abort",
				() => {
					leave(key, w)
					reject(aborted(signal))
				},
				{ once: true },
			)
		})
}

/** The details endpoint: GET /api/for-you/details?keys=a,b,c. */
export const fetchDetails: DetailsLoader = async (keys, signal) => {
	const res = await fetch(
		`/api/for-you/details?keys=${keys.map(encodeURIComponent).join(",")}`,
		{ signal },
	)
	if (!res.ok) throw new DetailsError(res.status)
	return res.json()
}

export const posterSrc = (path: string | null, size = "w342") =>
	path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined
export const backdropSrc = (path: string | null, size = "w1280") =>
	path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined
