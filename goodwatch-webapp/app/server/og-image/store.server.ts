// Where rendered Open Graph cards are kept, and how a request gets one.
//
// A card lives in Valkey, so it survives a deploy and both webapp instances share it, with a small in-process cache
// in front for the cards that are requested again and again. Cards requested once by crawlers must not fill the cache:
// a first render lives for thirty minutes, and a second request keeps it for seven days. Link previews of shared pages
// are requested again. Requests sharing a pending render all count as the first request. After one day a kept card
// is still served, and one redraw runs in the background, so title data that changed reaches the card within a day
// of its next request. A card that isn't stored is rendered while the request waits, for a few seconds at most:
// link-preview bots give up after a few seconds, so a late answer is worth less than a generic one.
//
// This module has no JSX and takes its Redis client, its renderer, and its clock as arguments, so it runs in tests.
import { createHash } from "node:crypto"
import { CardRendererBusyError } from "~/server/card-renderer/pool.server"

// The key holds the card's version: bump it when the card's design, its text rules, or the image format change, so
// that stored cards are drawn again. Keys of an older version expire by themselves.
export const CACHE_PREFIX = "og-card:v1:"
// First renders expire soon so cards fetched only once do not fill Valkey.
export const FIRST_SECONDS = 30 * 60
// How long Valkey keeps a requested-again card. The cluster's LFU policy may evict it sooner.
export const STORE_SECONDS = 7 * 24 * 60 * 60
// A card older than this is still served, and redrawn in the background for the next request.
export const FRESH_MS = 24 * 60 * 60 * 1000
// About 250 cards per process.
export const MEMORY_CACHE_MAX_BYTES = 32 * 1024 * 1024
// How long a request waits for a card that isn't stored before it gets the busy answer.
export const OG_WAIT_MS = 4000
export type CachedCard = {
	image: Buffer
	renderedAt: number
	etag: string
	kept: boolean
}
export type OgResult =
	| ({
			status: "ok"
			source: "memory" | "store" | "stale" | "rendered"
	  } & CachedCard)
	| { status: "missing" | "busy" | "failed" }
type Redis = {
	getBuffer(key: string): Promise<Buffer | null>
	expire(key: string, seconds: number): Promise<number>
	setex(key: string, seconds: number, value: Buffer): Promise<unknown>
}
type Dependencies = {
	redis: () => Redis | null | undefined
	render: (path: string) => Promise<Buffer | null>
	canonical: (path: string) => string | null
	count?: (result: string) => void
	now?: () => number
	redisTimeoutMs?: number
	firstSeconds?: number
	keptSeconds?: number
}
/** A strong ETag for an image: computed once per stored image and kept with it. */
export function imageEtag(image: Buffer) {
	return `"${createHash("sha1").update(image).digest("hex").slice(0, 16)}"`
}
// Resolves with the fallback when the promise takes longer than ms. The promise keeps running.
async function bounded<T>(
	promise: Promise<T>,
	ms: number,
	fallback: T,
): Promise<T> {
	let timer: NodeJS.Timeout | undefined
	try {
		return await Promise.race([
			promise,
			new Promise<T>((resolve) => {
				timer = setTimeout(() => resolve(fallback), ms)
			}),
		])
	} finally {
		clearTimeout(timer)
	}
}
export function createOgStore(deps: Dependencies) {
	const memory = new Map<string, CachedCard>()
	let bytes = 0
	const now = deps.now ?? Date.now
	// Concurrent requests for one card share one render in this process. There is no lock across processes: with two
	// instances a cold card renders at most once per instance, about 0.3 seconds of child CPU, which a lock's extra
	// round trips and failure modes aren't worth.
	const pending = new Map<string, Promise<CachedCard | null>>()
	function remember(path: string, card: CachedCard) {
		const old = memory.get(path)
		if (old) bytes -= old.image.length
		memory.delete(path)
		memory.set(path, card)
		bytes += card.image.length
		for (const [key, entry] of memory) {
			if (bytes <= MEMORY_CACHE_MAX_BYTES) break
			memory.delete(key)
			bytes -= entry.image.length
		}
	}
	// In Valkey, the render time is stored in front of the image as 8 bytes. A failed or slow read is a miss.
	async function read(path: string) {
		const hit = memory.get(path)
		if (hit) {
			remember(path, hit)
			return { card: hit, source: "memory" as const }
		}
		try {
			const value = await bounded(
				Promise.resolve(deps.redis()?.getBuffer(CACHE_PREFIX + path)),
				deps.redisTimeoutMs ?? 1000,
				undefined,
			)
			if (!value || value.length <= 8) return null
			const existing = memory.get(path)
			if (existing) return { card: existing, source: "memory" as const }
			const image = value.subarray(8)
			const card = {
				image,
				renderedAt: Number(value.readBigUInt64BE(0)),
				etag: imageEtag(image),
				kept: false,
			}
			remember(path, card)
			return { card, source: "store" as const }
		} catch {
			return null
		}
	}
	function value(card: CachedCard) {
		const header = Buffer.alloc(8)
		header.writeBigUInt64BE(BigInt(card.renderedAt))
		return Buffer.concat([header, card.image])
	}
	function keep(path: string, card: CachedCard) {
		if (card.kept) return
		card.kept = true
		// Mark before starting work so concurrent hits only extend the lifetime once.
		const work = Promise.resolve().then(async () => {
			const redis = deps.redis()
			// No cache right now: nothing to keep, and a later request tries again without a warning per request.
			if (!redis) {
				card.kept = false
				return
			}
			const key = CACHE_PREFIX + path
			const seconds = deps.keptSeconds ?? STORE_SECONDS
			if ((await redis.expire(key, seconds)) === 0)
				await redis.setex(key, seconds, value(card))
		})
		const timedOut = Symbol()
		void bounded<unknown>(work, deps.redisTimeoutMs ?? 1000, timedOut)
			.then((result) => {
				if (result === timedOut) throw new Error("cache keep timed out")
			})
			.catch((error) => {
				card.kept = false
				console.warn("[og-image] cache keep failed", error)
			})
	}
	function renderAndStore(path: string, kept = false) {
		let work = pending.get(path)
		if (!work) {
			work = Promise.resolve()
				.then(() => deps.render(path))
				.then(async (image) => {
					if (!image) return null
					const card = {
						image,
						renderedAt: now(),
						etag: imageEtag(image),
						kept,
					}
					try {
						const write = Promise.resolve(
							deps
								.redis()
								?.setex(
									CACHE_PREFIX + path,
									kept
										? (deps.keptSeconds ?? STORE_SECONDS)
										: (deps.firstSeconds ?? FIRST_SECONDS),
									value(card),
								),
						)
						const timedOut = Symbol()
						if (
							(await bounded<unknown>(
								write,
								deps.redisTimeoutMs ?? 1000,
								timedOut,
							)) === timedOut
						)
							console.warn("[og-image] cache write timed out")
					} catch (error) {
						console.warn("[og-image] cache write failed", error)
					}
					remember(path, card)
					return card
				})
				.catch((error) => {
					if (!(error instanceof CardRendererBusyError))
						console.error("[og-image] render failed", path, error)
					throw error
				})
				.finally(() => pending.delete(path))
			pending.set(path, work)
		}
		return work
	}
	/**
	 * The card for a page path. "ok" with a stored or freshly rendered card, "missing" when the path has no card or
	 * its page has no data, "busy" when the card isn't stored and the renderer's queue is full or the render outlasts
	 * waitMs (it keeps running and stores its card for the next request), and "failed" when the render or its data
	 * loading threw.
	 */
	async function getOgImage(
		pagePath: string,
		{ waitMs = OG_WAIT_MS } = {},
	): Promise<OgResult> {
		const finish = (result: string, answer: OgResult) => {
			deps.count?.(result)
			return answer
		}
		const path = deps.canonical(pagePath)
		if (!path) return finish("missing", { status: "missing" })
		const rendering = pending.get(path)
		const cached = rendering && !memory.has(path) ? null : await read(path)
		if (cached) {
			const stale = now() - cached.card.renderedAt > FRESH_MS
			keep(path, cached.card)
			if (stale) renderAndStore(path, true).catch(() => {})
			return finish(stale ? "stale" : cached.source, {
				status: "ok",
				source: stale ? "stale" : cached.source,
				...cached.card,
			})
		}
		try {
			const card = await bounded<CachedCard | null | undefined>(
				rendering ?? renderAndStore(path),
				waitMs,
				undefined,
			)
			if (card === undefined) return finish("busy", { status: "busy" })
			if (!card) return finish("missing", { status: "missing" })
			return finish("rendered", {
				status: "ok",
				source: "rendered",
				...card,
				kept: false,
			})
		} catch (error) {
			if (error instanceof CardRendererBusyError)
				return finish("busy", { status: "busy" })
			return finish("failed", { status: "failed" })
		}
	}
	return { getOgImage }
}
