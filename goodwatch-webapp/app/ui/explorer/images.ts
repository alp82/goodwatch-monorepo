// The map's poster images: loaded at the TMDB size that fits their size on screen (w92 to w500), decoded off the
// main thread, and kept in a cache with a size limit. Images not drawn in the last frames are evicted, oldest first,
// once the decoded pixels would pass the limit.
import { luminous, rgbCss } from "./color"

export const TMDB = "https://image.tmdb.org/t/p"

const SIZES = ["w92", "w154", "w185", "w342", "w500"] as const
type Size = (typeof SIZES)[number]
/** Decoded bytes per size (2:3 posters, 4 bytes a pixel). */
const BYTES: Record<Size, number> = {
	w92: 92 * 138 * 4,
	w154: 154 * 231 * 4,
	w185: 185 * 278 * 4,
	w342: 342 * 513 * 4,
	w500: 500 * 750 * 4,
}
/** About 64 MB of decoded posters. */
const LIMIT_BYTES = 64 * 1024 * 1024

interface Entry {
	image: HTMLImageElement
	ready: boolean
	bytes: number
	/** The frame it was last drawn in. */
	used: number
}

const cache = new Map<string, Entry>()
let bytes = 0
let frame = 0
let hold = false

const listeners = new Set<() => void>()
let notifyQueued = false
function notify() {
	if (notifyQueued) return
	notifyQueued = true
	requestAnimationFrame(() => {
		notifyQueued = false
		for (const listener of listeners) listener()
	})
}

/** Calls `listener` (at most once a frame) when an image finishes loading; returns the unsubscribe. */
export function onImageReady(listener: () => void) {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

/**
 * Starts a new frame for the cache's bookkeeping: what's drawn from here on counts as in use. While `zooming` (the
 * camera zooms fast), a poster with a size loaded keeps it, so the sizes it only passes through aren't loaded.
 */
export function beginImageFrame(zooming = false) {
	frame++
	hold = zooming
}

function evict() {
	if (bytes <= LIMIT_BYTES) return
	// Map order is insertion order; re-inserting on use keeps it roughly least recently used first.
	for (const [key, entry] of cache) {
		if (bytes <= LIMIT_BYTES * 0.85) break
		if (entry.used >= frame - 1) continue
		cache.delete(key)
		bytes -= entry.bytes
	}
}

function load(path: string, size: Size): Entry {
	const key = size + path
	const hit = cache.get(key)
	if (hit) {
		hit.used = frame
		cache.delete(key)
		cache.set(key, hit)
		return hit
	}
	const image = new Image()
	image.crossOrigin = "anonymous"
	image.decoding = "async"
	const entry: Entry = { image, ready: false, bytes: BYTES[size], used: frame }
	image.src = `${TMDB}/${size}${path}`
	image
		.decode()
		.then(() => {
			entry.ready = true
			notify()
		})
		.catch(() => {})
	cache.set(key, entry)
	bytes += entry.bytes
	evict()
	return entry
}

const sizeFor = (px: number): Size =>
	px < 70
		? "w92"
		: px < 130
			? "w154"
			: px < 170
				? "w185"
				: px < 320
					? "w342"
					: "w500"

/**
 * The poster to draw `px` device pixels wide: the right size once it has loaded, the sharpest size already loaded
 * until then, or null.
 */
export function posterImage(path: string, px: number): HTMLImageElement | null {
	const size = sizeFor(px)
	const want = hold ? cache.get(size + path) : load(path, size)
	if (want?.ready) {
		want.used = frame
		return want.image
	}
	for (let k = SIZES.length - 1; k >= 0; k--) {
		const other = cache.get(SIZES[k] + path)
		if (other?.ready) {
			other.used = frame
			return other.image
		}
	}
	if (!want) load(path, size)
	return null
}

/** An image at one TMDB size (a service's logo), once it has loaded. */
export function imageAt(path: string, size: Size): HTMLImageElement | null {
	const entry = load(path, size)
	return entry.ready ? entry.image : null
}

// ---------------------------------------------------------------- dots

const DOT_LIMIT = 6000
const dotColors = new Map<string, string>()
let averager: CanvasRenderingContext2D | null = null

/**
 * A far-away title's own color, from its smallest poster, for its dot; null until that poster has loaded. At most
 * `budget.left` new colors are read per frame (each reads a pixel back from a canvas).
 */
export function dotColor(
	path: string,
	budget: { left: number },
): string | null {
	const hit = dotColors.get(path)
	if (hit) return hit
	if (budget.left <= 0) return null
	const entry = load(path, "w92")
	if (!entry.ready) return null
	budget.left--
	let color = "rgba(200,210,240,1)"
	try {
		if (!averager) {
			const canvas = document.createElement("canvas")
			canvas.width = 1
			canvas.height = 1
			averager = canvas.getContext("2d", {
				willReadFrequently: true,
			}) as CanvasRenderingContext2D
		}
		averager.clearRect(0, 0, 1, 1)
		averager.drawImage(entry.image, 0, 0, 1, 1)
		const d = averager.getImageData(0, 0, 1, 1).data
		color = rgbCss(luminous([d[0] / 255, d[1] / 255, d[2] / 255]))
	} catch {}
	if (dotColors.size >= DOT_LIMIT) {
		const oldest = dotColors.keys().next().value
		if (oldest !== undefined) dotColors.delete(oldest)
	}
	dotColors.set(path, color)
	return color
}
