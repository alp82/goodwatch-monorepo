// The images of a share list: its card at full resolution, /og/lists/<id>/<content hash>.png, and the same card as a
// small JPEG link preview, /og/lists/<id>/<content hash>.jpg, which is the list page's og:image. Render, cache, and
// warm them.
// Renders run in child processes (render.server.tsx), and one render draws both images. Images are cached in process
// and in Redis, keyed by list id and hash, so a changed list is rendered once and its old images age out.
// A render takes about 20 seconds, too long for a link-preview bot, so a list's images are drawn when it is saved
// (warmShareCard) and checked when its page is viewed (ensureShareCard).
import { imageEtag } from "~/server/og-image/store.server"
import {
	type ShareCardImages,
	renderShareCard,
} from "~/server/share-card/render.server"
import {
	type ListView,
	type ShareList,
	getListView,
} from "~/server/share-lists/store.server"
import { designByKey } from "~/ui/share-card/designs"
import { cardDate, listByline } from "~/ui/share-card/model"
import { getRedisCluster } from "~/utils/cache"

// Bump when a design changes in a way that should redraw cached images.
// v2: cards are signed with the owner's @handle instead of a free-text signature.
// Link previews use a ":preview900" suffix so cached 720-pixel previews cannot serve the 900-pixel image tags.
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

async function render({
	list,
	owner,
	titles: items,
}: ListView): Promise<ShareCardImages> {
	const started = Date.now()
	const design = designByKey(list.design)
	const images = await renderShareCard(design, {
		title: list.title,
		name: listByline(owner.handle),
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
	`${CACHE_PREFIX}${list.id}:${list.contentHash}${kind === "preview" ? ":preview900" : ""}`

// Concurrent requests for the same list and hash share one render, which caches both images.
const pending = new Map<string, Promise<ShareCardImages>>()

function renderBoth(view: ListView): Promise<ShareCardImages> {
	const { list } = view
	const key = `${list.id}:${list.contentHash}`
	let rendering = pending.get(key)
	if (!rendering) {
		rendering = render(view)
			.then(async (images) => {
				await Promise.all([
					cacheWrite(cacheKey(list, "card"), images.card),
					cacheWrite(cacheKey(list, "preview"), images.preview),
				])
				return images
			})
			.finally(() => pending.delete(key))
		pending.set(key, rendering)
	}
	return rendering
}

async function imageFor(view: ListView, kind: ShareCardKind): Promise<Buffer> {
	const hit = await cacheRead(cacheKey(view.list, kind))
	if (hit) return hit
	return (await renderBoth(view))[kind]
}

/**
 * A list's card or its link preview, or null when the list or its owner's profile doesn't exist. An old hash answers
 * with the current image. Throws when the render fails.
 */
export async function getShareCardImage(
	id: string,
	hash: string,
	kind: ShareCardKind,
): Promise<{ image: Buffer; current: boolean; etag: string } | null> {
	const view = await getListView(id)
	if (!view) return null
	const image = await imageFor(view, kind)
	return {
		image,
		etag: etagFor(image),
		current: view.list.contentHash === hash,
	}
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
			getListView(list.id)
				.then(async (current) => {
					if (!current) return
					// A miss on either image renders both; the second read then hits.
					await imageFor(current, "preview")
					await imageFor(current, "card")
				})
				.catch((error) =>
					console.warn("[share-card] warmup failed", list.id, error),
				)
		}, WARM_DEBOUNCE_MS),
	)
}

// One hash per image buffer, however often it is served.
const etags = new WeakMap<Buffer, string>()
function etagFor(image: Buffer) {
	let tag = etags.get(image)
	if (!tag) {
		tag = imageEtag(image)
		etags.set(image, tag)
	}
	return tag
}
// The lists and hashes whose preview this process has already looked for.
const CHECKED_MAX = 5000
const checked = new Set<string>()

/**
 * Makes sure a list's images exist, in the background: after an eviction or an expiry, the first page view draws
 * them again, before a link-preview bot asks. Returns at once and never throws.
 */
export function ensureShareCard(view: ListView): void {
	const key = cacheKey(view.list, "preview")
	if (memoryRead(key) || checked.has(key)) return
	if (checked.size >= CHECKED_MAX)
		checked.delete(checked.values().next().value as string)
	checked.add(key)
	void cacheRead(key)
		.then(async (hit) => {
			if (!hit) await renderBoth(view)
		})
		.catch((error) => {
			checked.delete(key)
			console.warn("[share-card] ensure failed", error)
		})
}
