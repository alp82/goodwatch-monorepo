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

async function readCache(key: string) {
	try {
		return (await getRedisCluster()?.getBuffer(key)) ?? null
	} catch (error) {
		console.warn("[og-image] cache read failed", error)
		return null
	}
}

async function writeCache(key: string, png: Buffer) {
	try {
		await getRedisCluster()?.setex(key, CACHE_TTL_SECONDS, png)
	} catch (error) {
		console.warn("[og-image] cache write failed", error)
	}
}

async function render(path: string): Promise<Buffer | null> {
	const started = Date.now()
	let content: OgContent | null
	try {
		content = await resolveOgContent(path)
	} catch (error) {
		console.warn("[og-image] no data for", path, error)
		return null
	}
	if (!content) return null
	const png = await renderPng(<OgCard content={await inlineImages(content)} />)
	console.info(`[og-image] rendered ${path} in ${Date.now() - started} ms`)
	return png
}

// Concurrent requests for the same card share one render.
const pending = new Map<string, Promise<Buffer | null>>()

/** The PNG card for a page path, or null when the path has no card. */
export async function getOgImage(pagePath: string): Promise<Buffer | null> {
	const path = canonicalOgPath(pagePath)
	if (!path) return null

	const key = `${CACHE_PREFIX}${path}`
	const cachedPng = await readCache(key)
	if (cachedPng) return cachedPng

	let rendering = pending.get(path)
	if (!rendering) {
		rendering = render(path)
			.then(async (png) => {
				if (png) await writeCache(key, png)
				return png
			})
			.finally(() => pending.delete(path))
		pending.set(path, rendering)
	}
	return rendering
}
