// Share card images at /og/lists/<id>/<content hash>.png: render, cache, and warm them.
// Renders run in child processes (render.server.tsx). PNGs are cached in process and in Redis, keyed by list id and
// content hash, so a changed list is rendered once and its old images age out.
import { renderShareCard } from "~/server/share-card/render.server"
import { getList, type ShareList } from "~/server/share-lists/store.server"
import { resolveCardTitles } from "~/server/share-lists/titles.server"
import { designByKey } from "~/ui/share-card/designs"
import { cardDate } from "~/ui/share-card/model"
import { getRedisCluster } from "~/utils/cache"

// Bump when a design changes in a way that should redraw cached cards.
const CACHE_PREFIX = "share-card:v1:"
const STORE_SECONDS = 30 * 24 * 60 * 60
const MEMORY_CACHE_MAX_BYTES = 128 * 1024 * 1024
const WARM_DEBOUNCE_MS = 3000

const memory = new Map<string, Buffer>()
let memoryBytes = 0

function memoryRead(key: string) {
	const png = memory.get(key)
	if (!png) return null
	// Re-insert so the Map's order is recency order.
	memory.delete(key)
	memory.set(key, png)
	return png
}

function memoryWrite(key: string, png: Buffer) {
	const old = memory.get(key)
	if (old) memoryBytes -= old.length
	memory.set(key, png)
	memoryBytes += png.length
	for (const [oldestKey, oldest] of memory) {
		if (memoryBytes <= MEMORY_CACHE_MAX_BYTES) break
		memory.delete(oldestKey)
		memoryBytes -= oldest.length
	}
}

async function cacheRead(key: string): Promise<Buffer | null> {
	const hit = memoryRead(key)
	if (hit) return hit
	try {
		const png = await getRedisCluster()?.getBuffer(key)
		if (!png?.length) return null
		memoryWrite(key, png)
		return png
	} catch (error) {
		console.warn("[share-card] cache read failed", error)
		return null
	}
}

async function cacheWrite(key: string, png: Buffer) {
	memoryWrite(key, png)
	try {
		await getRedisCluster()?.setex(key, STORE_SECONDS, png)
	} catch (error) {
		console.warn("[share-card] cache write failed", error)
	}
}

async function render(list: ShareList): Promise<Buffer> {
	const started = Date.now()
	const design = designByKey(list.design)
	const items = await resolveCardTitles(list.items)
	const png = await renderShareCard(design, {
		title: list.title,
		name: list.signature,
		theme: list.theme,
		items,
		date: cardDate(new Date(list.createdAt)),
	})
	console.info(`[share-card] rendered ${list.id}/${list.contentHash} (${design.key}) in ${Date.now() - started} ms`)
	return png
}

// Concurrent requests for the same card share one render.
const pending = new Map<string, Promise<Buffer>>()

async function cardFor(list: ShareList): Promise<Buffer> {
	const key = `${CACHE_PREFIX}${list.id}:${list.contentHash}`
	const cached = await cacheRead(key)
	if (cached) return cached
	let rendering = pending.get(key)
	if (!rendering) {
		rendering = render(list)
			.then(async (png) => {
				await cacheWrite(key, png)
				return png
			})
			.finally(() => pending.delete(key))
		pending.set(key, rendering)
	}
	return rendering
}

/**
 * The card image of a list, or null when the list doesn't exist. An old hash answers with the current card.
 * Throws when the render fails.
 */
export async function getShareCardImage(id: string, hash: string): Promise<{ png: Buffer; current: boolean } | null> {
	const list = await getList(id)
	if (!list) return null
	return { png: await cardFor(list), current: list.contentHash === hash }
}

const warmTimers = new Map<string, NodeJS.Timeout>()

/** Renders a list's current card in the background after a save, once edits settle. Only the latest hash renders. */
export function warmShareCard(list: Pick<ShareList, "id">) {
	clearTimeout(warmTimers.get(list.id))
	warmTimers.set(
		list.id,
		setTimeout(() => {
			warmTimers.delete(list.id)
			getList(list.id)
				.then((current) => current && cardFor(current))
				.catch((error) => console.warn("[share-card] warmup failed", list.id, error))
		}, WARM_DEBOUNCE_MS),
	)
}
