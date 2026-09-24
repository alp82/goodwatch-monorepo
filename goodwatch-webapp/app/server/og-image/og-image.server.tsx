// Open Graph images for every page: resolve what the card shows, render it, and cache the PNG.
import {
	canonicalOgPath,
	resolveOgContent,
} from "~/server/og-image/content.server"
import { renderPng, toDataUri } from "~/server/og-image/render.server"
import { OgCard, type OgContent } from "~/ui/og-image/OgCard"
import { getRedisCluster } from "~/utils/cache"

// Bump the version when the card design changes, so cached PNGs are rendered again.
const CACHE_PREFIX = "og-image:v1:"
const CACHE_TTL_SECONDS = 60 * 60 * 24

// Title and person cards carry a photo (around 700 KB each) and there is one per title or
// person, so they stay out of the shared Redis and live in a byte-bounded in-process LRU.
// The CDN holds them in front of that.
const MEMORY_CACHE_MAX_BYTES = 64 * 1024 * 1024
const MAX_CONCURRENT_RENDERS = 2

const isPerEntityPath = (path: string) => /^\/(movie|show|person)\//.test(path)

type MemoryEntry = { png: Buffer; expires: number }
const memoryCache = new Map<string, MemoryEntry>()
let memoryCacheBytes = 0

function memoryDelete(key: string) {
	const entry = memoryCache.get(key)
	if (!entry) return
	memoryCache.delete(key)
	memoryCacheBytes -= entry.png.length
}

function memoryRead(key: string) {
	const entry = memoryCache.get(key)
	if (!entry) return null
	memoryDelete(key)
	if (entry.expires < Date.now()) return null
	// Re-insert so the Map's insertion order doubles as recency order.
	memoryCache.set(key, entry)
	memoryCacheBytes += entry.png.length
	return entry.png
}

function memoryWrite(key: string, png: Buffer) {
	if (png.length > MEMORY_CACHE_MAX_BYTES) return
	memoryDelete(key)
	memoryCache.set(key, {
		png,
		expires: Date.now() + CACHE_TTL_SECONDS * 1000,
	})
	memoryCacheBytes += png.length
	for (const oldest of memoryCache.keys()) {
		if (memoryCacheBytes <= MEMORY_CACHE_MAX_BYTES) break
		memoryDelete(oldest)
	}
}

async function redisRead(key: string) {
	try {
		return (await getRedisCluster()?.getBuffer(key)) ?? null
	} catch (error) {
		console.warn("[og-image] cache read failed", error)
		return null
	}
}

async function redisWrite(key: string, png: Buffer) {
	try {
		await getRedisCluster()?.setex(key, CACHE_TTL_SECONDS, png)
	} catch (error) {
		console.warn("[og-image] cache write failed", error)
	}
}

const readCache = (key: string, path: string) =>
	isPerEntityPath(path) ? memoryRead(key) : redisRead(key)

const writeCache = async (key: string, path: string, png: Buffer) =>
	isPerEntityPath(path) ? memoryWrite(key, png) : redisWrite(key, png)

// Rendering is CPU and memory heavy, so only a few cards render at once and the rest wait.
let activeRenders = 0
const waiting: (() => void)[] = []

async function withRenderSlot<T>(task: () => Promise<T>): Promise<T> {
	if (activeRenders < MAX_CONCURRENT_RENDERS) {
		activeRenders++
	} else {
		// The finishing render hands its slot straight to the next waiter.
		await new Promise<void>((resolve) => waiting.push(resolve))
	}
	try {
		return await task()
	} finally {
		const next = waiting.shift()
		if (next) next()
		else activeRenders--
	}
}

async function inlineImages(content: OgContent): Promise<OgContent> {
	switch (content.kind) {
		case "title":
			return { ...content, poster: await toDataUri(content.poster) }
		case "person":
			return { ...content, photo: await toDataUri(content.photo) }
		default:
			return { ...content, backdrop: await toDataUri(content.backdrop) }
	}
}

// Errors while resolving the content propagate, so an outage isn't answered with a 404.
async function render(path: string): Promise<Buffer | null> {
	const started = Date.now()
	const content = await resolveOgContent(path)
	if (!content) return null
	const png = await renderPng(<OgCard content={await inlineImages(content)} />)
	console.info(`[og-image] rendered ${path} in ${Date.now() - started} ms`)
	return png
}

// Concurrent requests for the same card share one render.
const pending = new Map<string, Promise<Buffer | null>>()

/**
 * The PNG card for a page path, or null when the path has no card or its data is missing.
 * Throws when the data can't be loaded.
 */
export async function getOgImage(pagePath: string): Promise<Buffer | null> {
	const path = canonicalOgPath(pagePath)
	if (!path) return null

	const key = `${CACHE_PREFIX}${path}`
	const cachedPng = await readCache(key, path)
	if (cachedPng) return cachedPng

	let rendering = pending.get(path)
	if (!rendering) {
		rendering = withRenderSlot(() => render(path))
			.then(async (png) => {
				if (png) await writeCache(key, path, png)
				return png
			})
			.finally(() => pending.delete(path))
		pending.set(path, rendering)
	}
	return rendering
}
