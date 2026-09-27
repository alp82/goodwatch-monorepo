import { type BackdropTile, type Rgb, TILE_SIZE } from "./types"

// An island's surface: a collage of its first titles' backdrops, melted into one soft landscape and color-graded
// toward the island's color. Canvas `filter` does the blur where it works; Safari has long ignored it, so a feature
// check picks a box blur on the pixels instead.

const TMDB_BACKDROP = "https://image.tmdb.org/t/p/w300"
/** At most this many backdrops go into one tile. */
export const BACKDROPS_PER_TILE = 4

/** Loads backdrops by TMDB path; the ones that fail are left out. CORS-clean, so WebGL can upload them. */
export async function loadBackdropImages(
	paths: string[],
): Promise<HTMLImageElement[]> {
	const images = await Promise.all(
		paths.slice(0, BACKDROPS_PER_TILE).map(async (path) => {
			const image = new Image()
			image.crossOrigin = "anonymous"
			image.decoding = "async"
			image.src = `${TMDB_BACKDROP}${path}`
			try {
				await image.decode()
				return image
			} catch {
				return null
			}
		}),
	)
	return images.filter((image): image is HTMLImageElement => !!image)
}

let filterBlurWorks: boolean | undefined
/** Whether canvas `filter: blur()` actually blurs (it's a no-op in Safari before 18). */
export function canvasFilterBlurWorks(): boolean {
	if (filterBlurWorks !== undefined) return filterBlurWorks
	const canvas = document.createElement("canvas")
	canvas.width = 11
	canvas.height = 11
	const g = canvas.getContext("2d", { willReadFrequently: true })
	if (!g) {
		filterBlurWorks = false
		return false
	}
	g.filter = "blur(2px)"
	g.fillStyle = "#fff"
	g.fillRect(4, 4, 3, 3)
	// Three pixels left of the square is blank unless the blur spread it.
	filterBlurWorks = g.getImageData(1, 5, 1, 1).data[3] > 0
	return filterBlurWorks
}

const canvasOf = (size: number) => {
	const canvas = document.createElement("canvas")
	canvas.width = size
	canvas.height = size
	return canvas
}

/** Widths of three box blurs that add up to a Gaussian of this sigma. */
function boxWidths(sigma: number): number[] {
	const ideal = Math.sqrt((12 * sigma * sigma) / 3 + 1)
	let lower = Math.floor(ideal)
	if (lower % 2 === 0) lower--
	const upper = lower + 2
	const m = Math.round(
		(12 * sigma * sigma - 3 * lower * lower - 12 * lower - 9) /
			(-4 * lower - 4),
	)
	return [0, 1, 2].map((i) => (i < m ? lower : upper))
}

/** One box blur pass along rows (step 4) or columns (step 4 * width), edges clamped. */
function boxPass(
	src: Float32Array,
	dst: Float32Array,
	width: number,
	height: number,
	radius: number,
	horizontal: boolean,
) {
	const lines = horizontal ? height : width
	const length = horizontal ? width : height
	const step = horizontal ? 4 : 4 * width
	const scale = 1 / (2 * radius + 1)
	for (let line = 0; line < lines; line++) {
		const start = horizontal ? line * width * 4 : line * 4
		for (let c = 0; c < 4; c++) {
			const at = (i: number) =>
				src[start + Math.max(0, Math.min(length - 1, i)) * step + c]
			let sum = 0
			for (let i = -radius; i <= radius; i++) sum += at(i)
			for (let i = 0; i < length; i++) {
				dst[start + i * step + c] = sum * scale
				sum += at(i + radius + 1) - at(i - radius)
			}
		}
	}
}

/** Blurs and saturates a canvas's pixels in place, without canvas `filter`. */
function blurPixels(
	canvas: HTMLCanvasElement,
	sigma: number,
	saturate: number,
) {
	const g = canvas.getContext("2d", {
		willReadFrequently: true,
	}) as CanvasRenderingContext2D
	const { width, height } = canvas
	const image = g.getImageData(0, 0, width, height)
	const a = Float32Array.from(image.data)
	const b = new Float32Array(a.length)
	for (const w of boxWidths(sigma)) {
		const radius = (w - 1) / 2
		boxPass(a, b, width, height, radius, true)
		boxPass(b, a, width, height, radius, false)
	}
	if (saturate !== 1)
		for (let k = 0; k < a.length; k += 4) {
			const grey = 0.2126 * a[k] + 0.7152 * a[k + 1] + 0.0722 * a[k + 2]
			a[k] = grey + (a[k] - grey) * saturate
			a[k + 1] = grey + (a[k + 1] - grey) * saturate
			a[k + 2] = grey + (a[k + 2] - grey) * saturate
		}
	image.data.set(a)
	g.putImageData(image, 0, 0)
}

/** A tile-sized copy of `source`, enlarged by `inset` on every side, blurred by sigma and saturated. */
function blurredCopy(
	source: HTMLCanvasElement,
	sigma: number,
	saturate: number,
	inset: number,
) {
	const out = canvasOf(TILE_SIZE)
	const g = out.getContext("2d", {
		willReadFrequently: true,
	}) as CanvasRenderingContext2D
	const at = -inset
	const size = TILE_SIZE + 2 * inset
	if (canvasFilterBlurWorks()) {
		g.filter = `blur(${sigma}px)${saturate !== 1 ? ` saturate(${saturate})` : ""}`
		g.drawImage(source, at, at, size, size)
	} else {
		g.drawImage(source, at, at, size, size)
		blurPixels(out, sigma, saturate)
	}
	return out
}

const css = (c: Rgb) =>
	`rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`

function cover(
	g: CanvasRenderingContext2D,
	image: HTMLImageElement,
	size: number,
) {
	const s = Math.max(size / image.naturalWidth, size / image.naturalHeight)
	const sw = size / s
	const sh = size / s
	g.drawImage(
		image,
		(image.naturalWidth - sw) / 2,
		(image.naturalHeight - sh) / 2,
		sw,
		sh,
		0,
		0,
		size,
		size,
	)
}

/**
 * Paints an island's tile from up to four backdrops. Each fills the tile and fades out from its own spot, so they melt
 * into one landscape; then the whole is blurred, slightly enlarged so the blur doesn't darken the edges, and graded
 * toward the island's color. Returns null without images.
 */
export function paintBackdropTile(
	images: HTMLImageElement[],
	color: Rgb,
): BackdropTile | null {
	const used = images.slice(0, BACKDROPS_PER_TILE)
	if (!used.length) return null
	const collage = canvasOf(TILE_SIZE)
	const g = collage.getContext("2d") as CanvasRenderingContext2D
	g.fillStyle = "#070a14"
	g.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
	const spots = [
		[0.32, 0.34],
		[0.7, 0.3],
		[0.3, 0.72],
		[0.72, 0.7],
	]
	const layer = canvasOf(TILE_SIZE)
	const l = layer.getContext("2d") as CanvasRenderingContext2D
	used.forEach((image, k) => {
		const [sx, sy] = used.length === 1 ? [0.5, 0.5] : spots[k]
		l.globalCompositeOperation = "source-over"
		l.clearRect(0, 0, TILE_SIZE, TILE_SIZE)
		cover(l, image, TILE_SIZE)
		l.globalCompositeOperation = "destination-in"
		const fade = l.createRadialGradient(
			sx * TILE_SIZE,
			sy * TILE_SIZE,
			0,
			sx * TILE_SIZE,
			sy * TILE_SIZE,
			TILE_SIZE * (used.length === 1 ? 0.8 : 0.52),
		)
		fade.addColorStop(0, "rgba(0,0,0,1)")
		fade.addColorStop(0.55, "rgba(0,0,0,.75)")
		fade.addColorStop(1, "rgba(0,0,0,0)")
		l.fillStyle = fade
		l.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
		g.drawImage(layer, 0, 0)
	})

	g.drawImage(blurredCopy(collage, 9, 1.3, 40), 0, 0)
	// Grade toward the island's color.
	g.globalCompositeOperation = "soft-light"
	g.fillStyle = css(color)
	g.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
	g.globalCompositeOperation = "source-over"

	const one = canvasOf(1)
	const o = one.getContext("2d", {
		willReadFrequently: true,
	}) as CanvasRenderingContext2D
	o.drawImage(collage, 0, 0, 1, 1)
	const d = o.getImageData(0, 0, 1, 1).data
	return { canvas: collage, average: [d[0] / 255, d[1] / 255, d[2] / 255] }
}
