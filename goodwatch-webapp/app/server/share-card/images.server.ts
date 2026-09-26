// The images of a share list: its card at full resolution, /og/lists/<id>/<content hash>.png, and the same card as a
// small JPEG link preview, /og/lists/<id>/<content hash>.jpg, which is the list page's og:image. Render, cache, and
// warm them.
// Renders run in child processes (render.server.tsx), and one render draws both images. Images are cached in process
// and in Redis, keyed by list id and hash, so a changed list is rendered once and its old images age out.
import { type ShareCardImages, renderShareCard } from "~/server/share-card/render.server"
import { type ShareList, getList, getProfileByUserId } from "~/server/share-lists/store.server"
import { resolveCardTitles } from "~/server/share-lists/titles.server"
import { designByKey } from "~/ui/share-card/designs"
import { cardDate, listByline } from "~/ui/share-card/model"
import { getRedisCluster } from "~/utils/cache"

// Bump when a design changes in a way that should redraw cached images.
// v2: cards are signed with the owner's @handle instead of a free-text signature.
// Link previews live under the same prefix with a ":preview" suffix.
const CACHE_PREFIX = "share-card:v2:"
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

export type ShareCardKind = keyof ShareCardImages

async function render(list: ShareList, byline: string): Promise<ShareCardImages> {
	const started = Date.now()
	const design = designByKey(list.design)
	const items = await resolveCardTitles(list.items)
	const images = await renderShareCard(design, {
		title: list.title,
		name: byline,
		theme: list.theme,
		items,
		date: cardDate(new Date(list.createdAt)),
	})
	console.info(
		`[share-card] rendered ${list.id}/${list.contentHash} (${design.key}) in ${Date.now() - started} ms: ` +
			`card ${images.card.length} bytes, preview ${images.preview.length} bytes`,
	)
	return images
}

// A list's handle never changes, so the content hash alone identifies its images.
const cacheKey = (list: ShareList, kind: ShareCardKind) =>
	`${CACHE_PREFIX}${list.id}:${list.contentHash}${kind === "preview" ? ":preview" : ""}`

// Concurrent requests for the same list and hash share one render, which caches both images.
const pending = new Map<string, Promise<ShareCardImages>>()

function renderBoth(list: ShareList, byline: string): Promise<ShareCardImages> {
	const key = `${list.id}:${list.contentHash}`
	let rendering = pending.get(key)
	if (!rendering) {
		rendering = render(list, byline)
			.then(async (images) => {
				await Promise.all([cacheWrite(cacheKey(list, "card"), images.card), cacheWrite(cacheKey(list, "preview"), images.preview)])
				return images
			})
			.finally(() => pending.delete(key))
		pending.set(key, rendering)
	}
	return rendering
}

async function imageFor(list: ShareList, byline: string, kind: ShareCardKind): Promise<Buffer> {
	const hit = await cacheRead(cacheKey(list, kind))
	if (hit) return hit
	return (await renderBoth(list, byline))[kind]
}

/** The byline a list's images show, or null when its owner has no profile (a deleted account). */
async function bylineOf(list: ShareList) {
	const owner = await getProfileByUserId(list.userId)
	return owner ? listByline(owner.handle) : null
}

/**
 * A list's card or its link preview, or null when the list or its owner's profile doesn't exist. An old hash answers
 * with the current image. Throws when the render fails.
 */
export async function getShareCardImage(
	id: string,
	hash: string,
	kind: ShareCardKind,
): Promise<{ image: Buffer; current: boolean } | null> {
	const list = await getList(id)
	if (!list) return null
	const byline = await bylineOf(list)
	if (byline === null) return null
	return { image: await imageFor(list, byline, kind), current: list.contentHash === hash }
}

const warmTimers = new Map<string, NodeJS.Timeout>()

/**
 * Renders a list's current card and preview in the background after a save or a page view, once edits settle.
 * Only the latest hash renders.
 */
export function warmShareCard(list: Pick<ShareList, "id">) {
	clearTimeout(warmTimers.get(list.id))
	warmTimers.set(
		list.id,
		setTimeout(() => {
			warmTimers.delete(list.id)
			getList(list.id)
				.then(async (current) => {
					if (!current) return
					const byline = await bylineOf(current)
					if (byline === null) return
					// A miss on either image renders both; the second read then hits.
					await imageFor(current, byline, "preview")
					await imageFor(current, byline, "card")
				})
				.catch((error) => console.warn("[share-card] warmup failed", list.id, error))
		}, WARM_DEBOUNCE_MS),
	)
}
